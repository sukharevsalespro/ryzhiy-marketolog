"""Тесты ryzhiy-pay без сети (TG/MAX замоканы). Запуск: python3 yc/test_pay.py

Паритет подписи: PHP (parse_str тела + алгоритм Hmac.php Продамуса:
strval → рекурсивный ksort → json_encode JSON_UNESCAPED_UNICODE → hash_hmac sha256)
против нашего prodamus_sign на том же теле. Нужен php-cli; без него тест пропускается.
"""

from __future__ import annotations

import importlib.util
import io
import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

YC = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("lead", YC / "lead" / "index.py")
lead = importlib.util.module_from_spec(_spec)
sys.modules["lead"] = lead
_spec.loader.exec_module(lead)
sys.path.insert(0, str(YC / "ryzhiy-pay"))
import index as pay  # noqa: E402

SECRET = "test-secret-not-real-0123456789abcdef"
GATE = "g" * 40
os.environ.update(PRODAMUS_SECRET=SECRET, INGRESS_SECRET=GATE)

FIELDS = {
    "date": "2026-09-27T12:00:00+03:00",
    "order_id": "50000001",
    "order_num": "",
    "domain": "valentina-promarketing.payform.ru",
    "sum": "990.00",
    "currency": "rub",
    "customer_phone": "+79991234567",
    "customer_email": "ivan@example.com",
    "customer_extra": "http://x.ru/a/b «кавычки» & <тег>",
    "attempt": "1",
    "products[0][name]": "Онлайн нетворкинг. Тариф - Стандарт, октябрь 2026.",
    "products[0][price]": "990.00",
    "products[0][quantity]": "1",
    "products[0][sum]": "990.00",
    "payment_status": "success",
    "payment_status_description": "Успешная оплата",
}


def _body(fields: dict[str, str]) -> str:
    return urlencode(fields)


def _event(fields: dict[str, str], sign: str | None = None, gate: str | None = GATE, method: str = "POST") -> dict:
    body = _body(fields)
    if sign is None:
        sign = pay.prodamus_sign(pay.parse_body({"headers": {}, "body": body}), SECRET)
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Sign": sign}
    if gate:
        headers["X-Ryzhiy-Gateway-Key"] = gate
    return {"httpMethod": method, "headers": headers, "isBase64Encoded": False, "body": body}


class _Ctx:
    token = {"access_token": "iam-test"}


def _run(event: dict, tg: bool = True, mx: bool | None = True, ctx=None):
    with patch.object(pay, "_send_tg", return_value=tg) as t, patch.object(lead, "_send_max", return_value=mx) as m:
        resp = pay.handler(event, ctx)
    return resp, t, m


def _reset() -> None:
    pay._MEM_SENT.clear()


def test_success_ours_sends_both() -> None:
    _reset()
    resp, t, m = _run(_event(FIELDS))
    assert resp["statusCode"] == 200 and resp["body"] == "success"
    assert t.call_count == 1 and m.call_count == 1
    text = t.call_args[0][0]
    assert text.startswith("💳 <b>Оплата</b> — Онлайн нетворкинг")
    assert "990.00 ₽" in text and "+79991234567" in text and "ivan@example.com" in text and "заказ №50000001" in text
    assert "МСК" in text and "повтор" not in text
    assert "<b>" not in m.call_args[0][0]


def test_bad_sign_403_no_send() -> None:
    _reset()
    resp, t, m = _run(_event(FIELDS, sign="0" * 64))
    assert resp["statusCode"] == 403 and t.call_count == 0 and m.call_count == 0


def test_missing_sign_403() -> None:
    _reset()
    resp, t, _ = _run(_event(FIELDS, sign=""))
    assert resp["statusCode"] == 403 and t.call_count == 0


def test_tampered_sum_403() -> None:
    _reset()
    good = _event(FIELDS)
    bad = _event({**FIELDS, "sum": "1.00"}, sign=good["headers"]["Sign"])
    assert _run(bad)[0]["statusCode"] == 403


def test_sign_uppercase_accepted() -> None:
    _reset()
    ev = _event(FIELDS)
    ev["headers"]["Sign"] = ev["headers"]["Sign"].upper()
    assert _run(ev)[0]["statusCode"] == 200


def test_no_gateway_key_403() -> None:
    _reset()
    resp, t, _ = _run(_event(FIELDS, gate=None))
    assert resp["statusCode"] == 403 and t.call_count == 0


def test_get_405() -> None:
    assert _run(_event(FIELDS, method="GET"))[0]["statusCode"] == 405


def test_katipa_product_skipped() -> None:
    _reset()
    fields = {**FIELDS, "products[0][name]": "тариф «Самостоятельный»", "sum": "777.00"}
    resp, t, m = _run(_event(fields))
    assert resp["statusCode"] == 200 and t.call_count == 0 and m.call_count == 0


def test_all_our_products_match() -> None:
    for name in ("Онлайн нетворкинг. Тариф - Стандарт, октябрь 2026.",
                 'Доступ к вебинару "Личный бренд"', 'Доступ к вебинару "Маркетинг доверия"'):
        assert pay.is_our_product([name]), name
    assert not pay.is_our_product(["Вебинар «Распаковка снов»", "тариф «Проводник»"])


def test_non_success_skipped() -> None:
    _reset()
    for status in ("canceled", "denied"):
        resp, t, _ = _run(_event({**FIELDS, "payment_status": status}))
        assert resp["statusCode"] == 200 and t.call_count == 0


def test_duplicate_order_sent_once() -> None:
    _reset()
    ev = _event(FIELDS)
    _run(ev)
    resp, t, _ = _run(ev)
    assert resp["statusCode"] == 200 and t.call_count == 0


def test_retry_attempt_marked() -> None:
    _reset()
    _, t, _ = _run(_event({**FIELDS, "attempt": "2"}))
    assert "(повтор уведомления)" in t.call_args[0][0]


def test_both_channels_down_502_then_retry_sends() -> None:
    _reset()
    ev = _event(FIELDS)
    assert _run(ev, tg=False, mx=False)[0]["statusCode"] == 502
    resp, t, m = _run(ev)
    assert resp["statusCode"] == 200 and t.call_count == 1 and m.call_count == 1


def test_one_channel_down_502_retry_only_failed_channel() -> None:
    _reset()
    ev = _event(FIELDS)
    assert _run(ev, tg=False, mx=True)[0]["statusCode"] == 502
    resp, t, m = _run(ev)
    assert resp["statusCode"] == 200 and t.call_count == 1 and m.call_count == 0


def test_max_not_configured_is_not_failure() -> None:
    _reset()
    assert _run(_event(FIELDS), mx=None)[0]["statusCode"] == 200


def test_object_storage_dedup_survives_new_instance() -> None:
    _reset()
    store: dict[str, int] = {}
    calls: list[tuple[str, str]] = []

    def fake_storage(method: str, key: str, iam: str) -> int:
        assert iam == "iam-test"
        calls.append((method, key))
        if method == "PUT":
            store[key] = 1
            return 200
        return 200 if key in store else 404

    ev = _event({**FIELDS, "order_id": "ab/c 1"})
    with patch.dict(os.environ, DEDUP_BUCKET="bkt"), patch.object(pay, "_storage", fake_storage):
        assert _run(ev, tg=True, mx=False, ctx=_Ctx())[0]["statusCode"] == 502
        assert set(store) == {"ab_c_1/telegram"}
        pay._MEM_SENT.clear()  # «другой инстанс»
        resp, t, m = _run(ev, ctx=_Ctx())
        assert resp["statusCode"] == 200 and t.call_count == 0 and m.call_count == 1
        pay._MEM_SENT.clear()
        resp, t, m = _run(ev, ctx=_Ctx())
        assert resp["statusCode"] == 200 and t.call_count == 0 and m.call_count == 0


def test_storage_down_sends_anyway() -> None:
    _reset()

    def broken(method: str, key: str, iam: str) -> int:
        raise TimeoutError

    with patch.dict(os.environ, DEDUP_BUCKET="bkt"), patch.object(pay, "_storage", broken):
        resp, t, m = _run(_event(FIELDS), ctx=_Ctx())
    assert resp["statusCode"] == 200 and t.call_count == 1 and m.call_count == 1


def test_send_tg_retries_pinned_ip() -> None:
    attempts: list[str | None] = []

    def flaky(path, body, timeout, pin_ip):
        attempts.append(pin_ip)
        if len(attempts) < 3:
            raise TimeoutError

    with patch.dict(os.environ, TG_TOKEN="1:x", TG_CHAT_ID="-1"), patch.object(lead, "_post_telegram", flaky):
        assert pay._send_tg("t") is True
    assert attempts == [lead._TELEGRAM_PINNED_IP] * 3
    with patch.dict(os.environ, TG_TOKEN="1:x", TG_CHAT_ID="-1"), patch.object(lead, "_post_telegram", side_effect=TimeoutError):
        assert pay._send_tg("t") is False


def test_html_escaped_in_tg() -> None:
    _reset()
    _, t, _ = _run(_event({**FIELDS, "products[0][name]": "Нетворкинг <b>x</b> & co"}))
    assert "&lt;b&gt;x&lt;/b&gt; &amp; co" in t.call_args[0][0]


def test_two_products_and_empty_fields() -> None:
    _reset()
    fields = {**FIELDS, "customer_email": "", "products[1][name]": 'Доступ к вебинару "Личный бренд"',
              "products[1][price]": "800", "products[1][quantity]": "1", "products[1][sum]": "800"}
    _, t, _ = _run(_event(fields))
    text = t.call_args[0][0]
    assert "октябрь 2026.; Доступ к вебинару" in text and " · — · " in text


def test_multipart_body_parsed() -> None:
    boundary = "XyZ"
    parts = "".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in FIELDS.items())
    body = parts + f"--{boundary}--\r\n"
    data = pay.parse_body({"headers": {"Content-Type": f"multipart/form-data; boundary={boundary}"}, "body": body})
    assert data["products"]["0"]["name"].startswith("Онлайн нетворкинг")
    assert pay.prodamus_sign(data, SECRET) == pay.prodamus_sign(pay.parse_body({"headers": {}, "body": _body(FIELDS)}), SECRET)


def test_logs_have_no_pii() -> None:
    _reset()
    buf = io.StringIO()
    h = logging.StreamHandler(buf)
    pay.logger.addHandler(h)
    try:
        _run(_event(FIELDS))
        _run(_event({**FIELDS, "order_id": "2", "products[0][name]": "тариф «Самостоятельный»"}))
    finally:
        pay.logger.removeHandler(h)
    out = buf.getvalue()
    assert "50000001" in out
    for pii in ("+79991234567", "ivan@example.com", "Самостоятельный"):
        assert pii not in out, pii


PHP_REF = r"""
parse_str(stream_get_contents(STDIN), $data);
unset($data['sign']);
array_walk_recursive($data, function (&$v) { $v = strval($v); });
$sort = function (&$a) use (&$sort) { ksort($a, SORT_REGULAR); foreach ($a as &$v) { if (is_array($v)) $sort($v); } };
$sort($data);
echo hash_hmac('sha256', json_encode($data, JSON_UNESCAPED_UNICODE), $argv[1]);
"""


def test_signature_parity_with_php() -> None:
    if not shutil.which("php"):
        print("  (php нет — паритет пропущен)")
        return
    for fields in (FIELDS, {**FIELDS, "products[0][name]": 'Доступ к вебинару "Личный бренд" / запись\\x'}):
        body = _body(fields)
        php = subprocess.run(["php", "-r", PHP_REF, SECRET], input=body, capture_output=True, text=True, check=True).stdout
        py = pay.prodamus_sign(pay.parse_body({"headers": {}, "body": body}), SECRET)
        assert php == py, (php, py)


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    for name, fn in tests:
        fn()
        print("ok", name)
    print(f"{len(tests)} passed")
