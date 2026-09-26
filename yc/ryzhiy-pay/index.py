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
import re
from datetime import datetime
from email import message_from_bytes
from typing import Any
from urllib.parse import parse_qsl, quote, urlencode
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

# Дедуп ПО КАНАЛУ: маркер `<order_id>/<канал>` ставится только после успешной
# отправки. Любой канал упал → 502, Продамус повторит и дошлёт только в упавший.
# Хранилище — Object Storage (env DEDUP_BUCKET + сервисный аккаунт функции,
# IAM-токен из context.token). Без них — память инстанса (повтор, попавший
# в другой инстанс, может продублировать уже отправленный канал).
_MEM_SENT: set[str] = set()
_STORAGE_HOST = "storage.yandexcloud.net"

# Egress YC → Telegram: из проверенных 8 адресов (пробник 27.09) отвечает только
# 149.154.167.220, и то ~2 из 3 соединений; адрес из DNS (149.154.166.110) — никогда.
# Поэтому несколько коротких попыток на пиннинг вместо фолбэка на резолв.
TG_ATTEMPTS = 4
TG_ATTEMPT_TIMEOUT = 2.5


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


# ---------- доставка и дедуп ----------

def _send_tg(text: str) -> bool:
    token = os.environ.get("TG_TOKEN", "").strip()
    chat_id = os.environ.get("TG_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False
    body = urlencode({"chat_id": chat_id, "parse_mode": "HTML", "text": text, "disable_web_page_preview": "true"}).encode()
    for attempt in range(1, TG_ATTEMPTS + 1):
        try:
            lead._post_telegram(f"/bot{token}/sendMessage", body, timeout=TG_ATTEMPT_TIMEOUT, pin_ip=lead._TELEGRAM_PINNED_IP)
            logger.info(json.dumps({"event": "telegram", "ok": True, "attempt": attempt}))
            return True
        except Exception as exc:  # noqa: BLE001 — без трейса: в нём URL с токеном
            logger.warning(json.dumps({"event": "telegram", "ok": False, "attempt": attempt, "error": type(exc).__name__}))
    return False


def _iam_token(context: Any) -> str:
    token = getattr(context, "token", None)
    return token.get("access_token", "") if isinstance(token, dict) else ""


def _storage(method: str, key: str, iam: str) -> int:
    import http.client

    conn = http.client.HTTPSConnection(_STORAGE_HOST, timeout=3)
    try:
        conn.request(method, f"/{os.environ['DEDUP_BUCKET']}/{quote(key)}", body=b"1" if method == "PUT" else None,
                     headers={"X-YaCloud-SubjectToken": iam})
        resp = conn.getresponse()
        resp.read()
        return resp.status
    finally:
        conn.close()


def _was_sent(key: str, iam: str) -> bool:
    if key in _MEM_SENT:
        return True
    if not (iam and os.environ.get("DEDUP_BUCKET")):
        return False
    try:
        status = _storage("HEAD", key, iam)
    except Exception as exc:  # noqa: BLE001 — хранилище недоступно: лучше дубль, чем потеря
        logger.warning(json.dumps({"event": "dedup", "op": "head", "error": type(exc).__name__}))
        return False
    if status not in (200, 404):
        logger.warning(json.dumps({"event": "dedup", "op": "head", "status": status}))
    return status == 200


def _mark_sent(key: str, iam: str) -> None:
    _MEM_SENT.add(key)
    if not (iam and os.environ.get("DEDUP_BUCKET")):
        return
    try:
        status = _storage("PUT", key, iam)
    except Exception as exc:  # noqa: BLE001
        status = type(exc).__name__
    if status != 200:
        logger.warning(json.dumps({"event": "dedup", "op": "put", "status": status}))


def _order_key(order_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", order_id)[:100] if order_id else ""


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
    iam = _iam_token(context)
    okey = _order_key(order_id)
    senders = {
        "telegram": lambda: _send_tg(build_message_tg(data, names)),
        "max": lambda: lead._send_max(build_message_max(data, names)),
    }
    result: dict[str, str] = {}
    for channel, send in senders.items():
        key = f"{okey}/{channel}"
        if okey and _was_sent(key, iam):
            result[channel] = "already"
            continue
        ok = send()
        if ok is None:  # канал не сконфигурирован
            result[channel] = "off"
            continue
        result[channel] = "ok" if ok else "fail"
        if ok and okey:
            _mark_sent(key, iam)
    logger.info(json.dumps({**base_log, "action": "notify", **result, "store": bool(iam and os.environ.get("DEDUP_BUCKET"))}))
    if "fail" in result.values():
        return _resp(502, "delivery failed")  # Продамус повторит, дошлём только в упавший канал
    return _resp(200, "success")
