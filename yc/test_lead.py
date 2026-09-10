"""Тест lead/index.py без сети — Telegram-запрос замокан.

Запуск: python3 test_lead.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent / "lead"))

import index  # noqa: E402


def test_get_returns_405() -> None:
    resp = index.handler({"httpMethod": "GET"}, None)
    assert resp["statusCode"] == 405
    assert resp["headers"]["Access-Control-Allow-Origin"] == "*"


def test_empty_post_returns_422() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "isBase64Encoded": False,
        "body": "",
    }
    resp = index.handler(event, None)
    assert resp["statusCode"] == 422


def test_name_without_contact_returns_422() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "isBase64Encoded": False,
        "body": "name=Иван",
    }
    resp = index.handler(event, None)
    assert resp["statusCode"] == 422


def test_contact_falls_back_to_old_fields() -> None:
    form = {"phone": " +79991234567 "}
    assert index._pick_contact(form) == "+79991234567"

    form = {"telegram": "@ivan", "phone": ""}
    assert index._pick_contact(form) == "@ivan"

    form = {"contact": "@new", "telegram": "@old"}
    assert index._pick_contact(form) == "@new"

    assert index._pick_contact({}) == ""


def _lead_event() -> dict[str, Any]:
    return {
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "isBase64Encoded": False,
        "body": "name=Иван&contact=%40ivan&source_page=%2F&utm_source=vk&utm_campaign=test",
    }


def test_valid_lead_returns_200_and_sends_telegram() -> None:
    with patch.object(index, "_send_telegram", return_value=True) as mock_tg, \
         patch.object(index, "_send_max", return_value=True) as mock_max:
        resp = index.handler(_lead_event(), None)
    assert resp["statusCode"] == 200
    assert '"ok": true' in resp["body"]
    mock_tg.assert_called_once()
    mock_max.assert_called_once()
    text = mock_tg.call_args[0][0]
    assert "рыжий-маркетолог.рф" in text
    assert "Иван" in text
    assert "@ivan" in text
    assert "MSK" in text
    max_text = mock_max.call_args[0][0]
    assert "рыжий-маркетолог.рф" in max_text
    assert "Иван" in max_text
    assert "<b>" not in max_text  # MAX — без HTML-тегов


def test_tg_fails_max_ok_returns_200() -> None:
    with patch.object(index, "_send_telegram", return_value=False), \
         patch.object(index, "_send_max", return_value=True):
        resp = index.handler(_lead_event(), None)
    assert resp["statusCode"] == 200
    assert '"ok": true' in resp["body"]


def test_both_channels_fail_returns_502() -> None:
    with patch.object(index, "_send_telegram", return_value=False), \
         patch.object(index, "_send_max", return_value=False):
        resp = index.handler(_lead_event(), None)
    assert resp["statusCode"] == 502
    assert '"ok": false' in resp["body"]
    assert "delivery failed" in resp["body"]


def test_max_not_configured_only_telegram_sent() -> None:
    """MAX_TOKEN/MAX_CHAT_ID пустые -> _send_max сам возвращает None (канал пропущен)."""
    with patch.dict(index.os.environ, {"MAX_TOKEN": "", "MAX_CHAT_ID": ""}, clear=False), \
         patch.object(index, "_post_max") as mock_post_max, \
         patch.object(index, "_send_telegram", return_value=True):
        resp = index.handler(_lead_event(), None)
    assert resp["statusCode"] == 200
    assert '"ok": true' in resp["body"]
    mock_post_max.assert_not_called()


def test_message_escapes_html() -> None:
    data = {
        "product": "site",
        "name": "<script>alert(1)</script>",
        "contact": "@ok",
        "source_page": "",
        "utm_source": "",
        "utm_campaign": "",
        "utm_content": "",
    }
    text = index._build_message(data)
    assert "<script>" not in text
    assert "&lt;script&gt;" in text


def test_field_length_is_capped() -> None:
    event = {
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "isBase64Encoded": False,
        "body": "name=" + "А" * 500 + "&contact=@ivan",
    }
    with patch.object(index, "_send_telegram", return_value=True):
        resp = index.handler(event, None)
    assert resp["statusCode"] == 200


def main() -> None:
    tests = [obj for name, obj in globals().items() if name.startswith("test_") and callable(obj)]
    for test in tests:
        test()
        print(f"{test.__name__}: OK")
    print(f"\n{len(tests)} tests passed")


if __name__ == "__main__":
    main()
