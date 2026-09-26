"""Yandex Cloud Function ryzhiy-pay — вебхук оплат Продамуса → группы Валентины.

Аккаунт Продамуса (valentina-promarketing.payform.ru) общий с katipa-art.ru,
URL уведомлений в ЛК — на весь аккаунт. Поэтому в группу рыжего уходят только
оплаты товаров сайта рыжий-маркетолог.рф (OUR_PRODUCT_MARKERS), остальное —
200 без отправки (katipa обслуживает своя функция katipa-prodamus-webhook).

Вход только через nginx BTC `location = /public/ryzhiy-pay` (серверный ключ
X-Ryzhiy-Gateway-Key, как у ryzhiy-lead). Подпись Продамуса — заголовок Sign.
Доставка TG (пиннинг IP) и MAX (botapi.max.ru) — из lead.py (это yc/lead/index.py,
deploy кладёт его в zip под именем lead.py), чтобы грабли сети чинились в одном месте.

Env: PRODAMUS_SECRET, INGRESS_SECRET, TG_TOKEN, TG_CHAT_ID, MAX_TOKEN, MAX_CHAT_ID.
Логи без ПДн: только order_id, статус, сумма, результат каналов.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import logging
import os
from datetime import datetime
from email import message_from_bytes
from typing import Any
from urllib.parse import parse_qsl
from zoneinfo import ZoneInfo

import lead

logger = logging.getLogger("pay")
logger.setLevel(logging.INFO)

MSK = ZoneInfo("Europe/Moscow")
MAX_BODY_BYTES = 65_536
FIELD_LEN = 300

# Подстроки products[i][name], сверены 27.09.2026 со страницами ссылок:
# 6ccEnWO «Онлайн нетворкинг. Тариф - Стандарт, октябрь 2026.»,
# g9cC0N3 «Доступ к вебинару "Личный бренд"», e0cjdjM «Доступ к вебинару "Маркетинг доверия"».
# ponytail: список в коде; новый товар Валентины = строка сюда + деплой.
OUR_PRODUCT_MARKERS = ("нетворкинг", "личный бренд", "маркетинг доверия")

# ponytail: дедуп только в памяти тёплого инстанса; холодный старт/второй
# инстанс может дать дубль (тогда attempt>1 → пометка «повтор»). Апгрейд — YDB.
_SEEN_ORDERS: set[str] = set()


# ---------- разбор тела (bracket-нотация products[0][name], как $_POST в PHP) ----------

def _parse_multipart(body: bytes, content_type: str) -> list[tuple[str, str]]:
    import re

    raw = b"Content-Type: " + content_type.encode() + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
    msg = message_from_bytes(raw)
    if not msg.is_multipart():
        return []
    name_re = re.compile(r'name="([^"]*)"')
    pairs: list[tuple[str, str]] = []
    for part in msg.get_payload():
        match = name_re.search(part.get("Content-Disposition", ""))
        if not match:
            continue
        payload = part.get_payload(decode=True) or b""
        pairs.append((match.group(1), payload.decode(part.get_content_charset() or "utf-8", errors="replace")))
    return pairs


def _set_nested(root: dict[str, Any], raw_key: str, value: str) -> None:
    if "[" not in raw_key:
        root[raw_key] = value
        return
    base, _, rest = raw_key.partition("[")
    parts = [base] + rest.rstrip("]").split("][")
    node = root
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[parts[-1]] = value


def parse_body(event: dict[str, Any]) -> dict[str, Any]:
    content_type = lead._get_header(event.get("headers"), "Content-Type")
    body = lead._decode_body(event)
    if "application/json" in content_type:
        parsed = json.loads(body.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    if "multipart/form-data" in content_type:
        pairs = _parse_multipart(body, content_type)
    else:
        pairs = parse_qsl(body.decode("utf-8"), keep_blank_values=True)
    root: dict[str, Any] = {}
    for key, value in pairs:
        _set_nested(root, key, value)
    return root


# ---------- подпись: официальный алгоритм Продамуса (Hmac.php) ----------
# help.prodamus.ru → «Документация для самостоятельной интеграции сервисов»:
# 1) значения → строки; 2) сортировка по ключам, в том числе вглубь;
# 3) массив → json; 4) в json экранировать «/»; 5) HMAC-SHA256 секретным ключом.
# json_encode(JSON_UNESCAPED_UNICODE): кириллица как есть, «/» → «\/».

def _stringify(node: Any) -> Any:
    if isinstance(node, dict):
        return {k: _stringify(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_stringify(v) for v in node]
    if node is None or node is False:
        return ""
    if node is True:
        return "1"
    return str(node)


def _ksort_key(key: str) -> tuple[int, Any]:
    """ksort SORT_REGULAR: числовые ключи раньше строковых, между собой как числа."""
    try:
        return (0, float(key))
    except ValueError:
        return (1, key)


def _canonical(node: Any) -> Any:
    """Рекурсивный ksort; dict с ключами 0..n-1 → список (так json_encode видит PHP-массив)."""
    if isinstance(node, list):
        return [_canonical(v) for v in node]
    if not isinstance(node, dict):
        return node
    items = sorted(node.items(), key=lambda kv: _ksort_key(kv[0]))
    keys = [k for k, _ in items]
    values = [_canonical(v) for _, v in items]
    if keys and keys == [str(i) for i in range(len(keys))]:
        return values
    return dict(zip(keys, values))


def prodamus_sign(data: dict[str, Any], key: str) -> str:
    payload = _canonical(_stringify({k: v for k, v in data.items() if k != "sign"}))
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("/", "\\/")
    return hmac.new(key.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest()


# ---------- сообщение ----------

def _field(data: dict[str, Any], key: str) -> str:
    value = data.get(key, "")
    return str(value).strip()[:FIELD_LEN] if isinstance(value, (str, int, float)) else ""


def product_names(data: dict[str, Any]) -> list[str]:
    products = data.get("products")
    items = products.values() if isinstance(products, dict) else products if isinstance(products, list) else []
    return [str(p.get("name", "")).strip()[:FIELD_LEN] for p in items if isinstance(p, dict) and p.get("name")]


def is_our_product(names: list[str]) -> bool:
    return any(marker in name.lower() for name in names for marker in OUR_PRODUCT_MARKERS)


def _parts(data: dict[str, Any], names: list[str]) -> list[str]:
    name = _field(data, "customer_fio") or _field(data, "customer_name")  # есть ли имя у Продамуса — см. первый живой вебхук
    return [
        "; ".join(names) or "—",
        f'{_field(data, "sum") or "—"} ₽',
        *([name] if name else []),
        _field(data, "customer_phone") or "—",
        _field(data, "customer_email") or "—",
        f'заказ №{_field(data, "order_id") or _field(data, "order_num") or "—"}',
        datetime.now(MSK).strftime("%d.%m.%Y %H:%M") + " МСК",
    ]


def _is_retry(data: dict[str, Any]) -> bool:
    try:
        return int(_field(data, "attempt") or "1") > 1
    except ValueError:
        return False


def build_message_tg(data: dict[str, Any], names: list[str]) -> str:
    head = "💳 <b>Оплата</b>" + (" (повтор уведомления)" if _is_retry(data) else "")
    return head + " — " + " · ".join(html.escape(p, quote=True) for p in _parts(data, names))


def build_message_max(data: dict[str, Any], names: list[str]) -> str:
    head = "💳 Оплата" + (" (повтор уведомления)" if _is_retry(data) else "")
    return head + " — " + " · ".join(_parts(data, names))


# ---------- handler ----------

def _resp(status: int, body: str) -> dict[str, Any]:
    return {"statusCode": status, "headers": {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}, "body": body}


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if not lead._gateway_authorized(event):
        return _resp(403, "gateway required")
    if event.get("httpMethod") != "POST":
        return _resp(405, "POST only")
    raw = event.get("body") or ""
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        return _resp(413, "bad body")
    try:
        data = parse_body(event)
    except (ValueError, UnicodeError, LookupError):
        return _resp(400, "bad body")

    secret = os.environ.get("PRODAMUS_SECRET", "")
    sign = (lead._get_header(event.get("headers"), "Sign") or _field(data, "sign")).strip().lower()
    if not secret or not sign or not hmac.compare_digest(prodamus_sign(data, secret), sign):
        logger.warning("pay: bad sign")
        return _resp(403, "bad sign")

    order_id = _field(data, "order_id") or _field(data, "order_num")
    status = _field(data, "payment_status")
    names = product_names(data)
    base_log = {"order_id": order_id, "status": status, "sum": _field(data, "sum")}

    if status != "success" or not is_our_product(names):
        logger.info(json.dumps({**base_log, "action": "skip", "ours": is_our_product(names)}))
        return _resp(200, "success")
    if order_id and order_id in _SEEN_ORDERS:
        logger.info(json.dumps({**base_log, "action": "duplicate"}))
        return _resp(200, "success")

    tg_ok = lead._send_telegram(build_message_tg(data, names))
    max_ok = lead._send_max(build_message_max(data, names))
    logger.info(json.dumps({**base_log, "action": "notify", "telegram": bool(tg_ok), "max": bool(max_ok)}))
    if not tg_ok and not max_ok:
        return _resp(502, "delivery failed")  # Продамус повторит по своему расписанию
    if order_id:
        _SEEN_ORDERS.add(order_id)
    return _resp(200, "success")
