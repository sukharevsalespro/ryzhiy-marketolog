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
        # контроль: текст не вылезает из стеклянной колонки, фото закрывает всю карточку
        bad = pg.evaluate('''() => { const p=document.querySelector('.pn').getBoundingClientRect(), cs=getComputedStyle(document.querySelector('.pn'));
          const L=p.left+parseFloat(cs.paddingLeft)-1, Rr=p.right-parseFloat(cs.paddingRight)+1;
          const out=[...document.querySelectorAll('.pn > *, .pn .row > *')].filter(e=>{const r=e.getBoundingClientRect();
            const rg=document.createRange(); rg.selectNodeContents(e); const t=rg.getBoundingClientRect(); return t.right>Rr||t.left<L||t.bottom>p.bottom}).map(e=>e.className||e.tagName);
          const ph=document.getElementById('ph'), st=getComputedStyle(ph), img=new Image(); return out; }''')
        print(i, 'вылезает:', bad or 'нет')
        pg.screenshot(path=str(here / 'out' / f'{i}.png'))
    b.close()
