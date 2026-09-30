"""Рендер OG-картинок из og-template.html (Playwright; гонять на NVR, не на VPS).

Из корня репо: python render.py master-gruppa otzyvy ...  → PNG в specs/005-og-cards/out/,
затем JPEG q88 в assets/img/og-*.jpg (PIL) и поднять ?v= в apply-мете.
Шрифты сайта не содержат ₽ — нужен системный DejaVu Sans.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
(here / 'out').mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    for i in sys.argv[1:]:
        pg.goto((here / 'og-template.html').as_uri() + f'?id={i}'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        pg.screenshot(path=str(here / 'out' / f'{i}.png'))
    b.close()
