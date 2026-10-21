"""Рендер OG-картинок из og-template.html (Playwright; гонять на NVR, не на VPS).

Шаблон читает ../../assets/data/events.json через fetch, поэтому страницу открывать по http (из корня репо:
python3 -m http.server), не file://. Пример: python render.py http://127.0.0.1:8000 home networking …
→ PNG в specs/005-og-cards/out/, затем JPEG q88 в assets/img/og-*.jpg (PIL) и поднять V в apply-og.py.
Шрифты сайта не содержат ₽ — нужен системный DejaVu Sans.
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
(here / 'out').mkdir(exist_ok=True)
base, ids = sys.argv[1].rstrip('/'), sys.argv[2:]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    for i in ids:
        pg.goto(f'{base}/specs/005-og-cards/og-template.html?id={i}'); pg.wait_for_selector('body[data-ready]'); pg.wait_for_timeout(250)
        fit = json.loads(pg.evaluate('document.body.dataset.fit'))   # контроль: заголовок не заходит на фигуру, слово-эхо целиком
        print(i, fit, 'OK' if fit['hFits'] and fit['echoFits'] else 'ПРОВЕРИТЬ')
        pg.screenshot(path=str(here / 'out' / f'{i}.png'))
    b.close()
