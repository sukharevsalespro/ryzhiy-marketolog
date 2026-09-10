"""Yandex Cloud Function — приём заявок с сайта рыжий-маркетолог.рф.

Порт по образцу /root/clarity-marathon/yc/lead/index.py (python312, stdlib-only).
Точка входа handler(event, context) — формат HTTP-триггера Yandex Cloud Functions.

Оплата вебинара идёт по внешней ссылке payform Продамуса — наш код в оплате
не участвует, вебхука тут нет, только приём заявки с формы сайта.

Секреты — только из переменных окружения: TG_TOKEN, TG_CHAT_ID.
Никаких внешних зависимостей — только стандартная библиотека.
"""

from __future__ import annotations

import html
import http.client
import json
import logging
import os
import socket
import ssl
from datetime import datetime
from email import message_from_bytes
from typing import Any
from urllib.parse import parse_qsl, urlencode
from zoneinfo import ZoneInfo

logger = logging.getLogger("lead")
logger.setLevel(logging.INFO)

_TELEGRAM_HOST = "api.telegram.org"
# ponytail: egress этой функции из YC пускает только один конкретный IP
# api.telegram.org из десятка проверенных смоуком (остальные — TCP timeout,
# похоже на allowlist на маршруте, не блок со стороны Telegram). Резолв по
# имени регулярно попадает на недоступный IP → сперва коннект напрямую на
# проверенный адрес (с тем же SNI/сертификатом), резолв по имени — fallback.
# Апгрейд — если IP протухнет, добавить ещё проверенных кандидатов.
_TELEGRAM_PINNED_IP = "149.154.167.220"

MSK = ZoneInfo("Europe/Moscow")

MAX_LEN = 200

# Поля формы. product — по умолчанию "site". contact — телефон или Telegram,
# одно поле; на случай старой формы принимаем также phone/telegram/email.
FIELDS = ["product", "name", "source_page", "utm_source", "utm_campaign", "utm_content"]
CONTACT_KEYS = ("contact", "phone", "telegram", "email")


def _get_header(headers: dict[str, str] | None, name: str) -> str:
    """Регистронезависимый поиск заголовка в словаре события Яндекса."""
    if not headers:
        return ""
    name_lower = name.lower()
    for key, value in headers.items():
        if key.lower() == name_lower:
            return value or ""
    return ""


def _decode_body(event: dict[str, Any]) -> bytes:
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        import base64

        return base64.b64decode(body)
    return body.encode("utf-8")


def _parse_multipart(body: bytes, content_type: str) -> dict[str, str]:
    """Разбор multipart/form-data стандартной библиотекой (email.parser).

    ponytail: только текстовые поля (name= без filename=) — форма лендинга
    файлов не шлёт, полноценный разбор file-частей не нужен.
    """
    import re

    disposition_name_re = re.compile(r'name="([^"]*)"')
    raw = b"Content-Type: " + content_type.encode() + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
    msg = message_from_bytes(raw)
    fields: dict[str, str] = {}
    if not msg.is_multipart():
        return fields
    for part in msg.get_payload():
        disposition = part.get("Content-Disposition", "")
        match = disposition_name_re.search(disposition)
        if not match:
            continue
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        fields[match.group(1)] = payload.decode(charset, errors="replace")
    return fields


def _parse_body(event: dict[str, Any]) -> dict[str, str]:
    content_type = _get_header(event.get("headers"), "Content-Type")
    body = _decode_body(event)

    if "multipart/form-data" in content_type:
        return _parse_multipart(body, content_type)

    if "application/json" in content_type:
        try:
            parsed = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}
        return {k: str(v) for k, v in parsed.items()} if isinstance(parsed, dict) else {}

    # По умолчанию — application/x-www-form-urlencoded (и если Content-Type пуст)
    pairs = parse_qsl(body.decode("utf-8", errors="replace"), keep_blank_values=True)
    return dict(pairs)


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def _pick_contact(form: dict[str, str]) -> str:
    """Одно поле контакта: новое contact, иначе старые phone/telegram/email."""
    for key in CONTACT_KEYS:
        value = form.get(key, "").strip()
        if value:
            return value[:MAX_LEN]
    return ""


def _build_message(data: dict[str, str]) -> str:
    lines = [
        "🦊 <b>Заявка с сайта рыжий-маркетолог.рф</b>",
        "",
        f'📦 {_esc(data["product"] or "site")}',
        f'👤 {_esc(data["name"])}',
        f'📱 <code>{_esc(data["contact"])}</code>',
    ]
    if data["source_page"]:
        lines.append(f'🔗 {_esc(data["source_page"])}')

    meta = []
    utm_parts = [data[k] for k in ("utm_source", "utm_campaign", "utm_content") if data[k]]
    if utm_parts:
        meta.append("UTM: " + _esc(" / ".join(utm_parts)))
    meta.append("⏰ " + datetime.now(MSK).strftime("%d.%m.%Y %H:%M") + " MSK")

    lines.append("")
    lines.append("<blockquote>" + "\n".join(meta) + "</blockquote>")
    return "\n".join(lines)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS-соединение на заданный IP, но с SNI и проверкой сертификата по host."""

    def __init__(self, ip: str, host: str, timeout: float) -> None:
        super().__init__(host, 443, timeout=timeout)
        self._pinned_ip = ip

    def connect(self) -> None:
        sock = socket.create_connection((self._pinned_ip, self.port), self.timeout)
        context = self._context or ssl.create_default_context()
        self.sock = context.wrap_socket(sock, server_hostname=self.host)


def _post_telegram(path: str, body: bytes, timeout: float, pin_ip: str | None) -> None:
    conn: http.client.HTTPSConnection
    if pin_ip:
        conn = _PinnedHTTPSConnection(pin_ip, _TELEGRAM_HOST, timeout)
    else:
        conn = http.client.HTTPSConnection(_TELEGRAM_HOST, timeout=timeout)
    try:
        conn.request(
            "POST", path, body=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        conn.getresponse().read()
    finally:
        conn.close()


def _send_telegram(text: str) -> None:
    token = os.environ["TG_TOKEN"]
    chat_id = os.environ["TG_CHAT_ID"]
    params = urlencode({
        "chat_id": chat_id,
        "parse_mode": "HTML",
        "text": text,
        "disable_web_page_preview": "true",
    }).encode()
    path = f"/bot{token}/sendMessage"

    try:
        _post_telegram(path, params, timeout=5, pin_ip=_TELEGRAM_PINNED_IP)
        return
    except Exception:  # noqa: BLE001 — сбой Telegram не должен ронять ответ лиду
        logger.warning("telegram sendMessage via pinned IP failed", exc_info=True)

    try:
        _post_telegram(path, params, timeout=5, pin_ip=None)
        return
    except Exception:  # noqa: BLE001
        logger.exception("telegram sendMessage failed (pinned IP + hostname)")


def _json_response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(payload, ensure_ascii=False),
    }


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if event.get("httpMethod") != "POST":
        return _json_response(405, {"ok": False, "error": "POST only"})

    form = _parse_body(event)
    data = {field: form.get(field, "").strip()[:MAX_LEN] for field in FIELDS}
    data["product"] = data["product"] or "site"
    data["contact"] = _pick_contact(form)
    data["created_at"] = datetime.now(MSK).isoformat()
    data["ip"] = _get_header(event.get("headers"), "X-Forwarded-For")

    if data["name"] == "" or data["contact"] == "":
        return _json_response(422, {"ok": False, "error": "empty lead"})

    logger.info(json.dumps({"event": "lead", **data}, ensure_ascii=False))

    _send_telegram(_build_message(data))

    return _json_response(200, {"ok": True})


def _demo() -> None:
    """Самопроверка порта без сети (Telegram-запрос не выполняется)."""
    event = {
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "isBase64Encoded": False,
        "body": "name=Иван&contact=%2B79991234567&source_page=%2F&utm_source=vk",
    }
    form = _parse_body(event)
    assert form["name"] == "Иван"
    assert _pick_contact(form) == "+79991234567"

    empty_resp = handler({"httpMethod": "GET"}, None)
    assert empty_resp["statusCode"] == 405

    print("lead/index.py self-check: OK")


if __name__ == "__main__":
    _demo()
