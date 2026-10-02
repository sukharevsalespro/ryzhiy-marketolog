# Макеты T019 (статья /pozicionirovanie/) и T023 (служебная /rekvizity/ + 404), волны 4–5 spec 006.
# Собирает mockup/*.html из текущих страниц: шапка, подвал, мета — из исходника как есть; <main> — новый шаблон,
# тексты, ссылки, картинки и alt — вырезаются из исходника регулярками (не перепечатываются).
# usage: python3 specs/006-new-design-rollout/mockup/mk_w45.py   (из корня репо)
import re, pathlib
R = pathlib.Path('.')
M = 'specs/006-new-design-rollout/mockup/'
CSS = ('<link rel="stylesheet" href="/assets/css/home-blocks.css?v=3">'
       '<link rel="stylesheet" href="/assets/css/nd-pages.css?v=8">'
       '<link rel="stylesheet" href="/networking/nw-nd.css?v=1">'
       '<link rel="stylesheet" href="/assets/css/nd-read.css?v=1">')
ARROW = '<span class="nd-pay-c"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>'
ZOOM = '<span class="ndr-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8M10 5H5v14h14v-5"/></svg></span>'


def one(pat, s, flags=re.S):
    m = re.findall(pat, s, flags)
    assert len(m) == 1, (pat, len(m))
    return m[0]


def build(src, out, main, body, title, drop_css, live=False):
    h = src if src.lstrip().startswith('<!doctype') else (R / src).read_text()
    for c in drop_css:
        h, n = re.subn(r'<link[^>]*' + re.escape(c) + r'[^>]*>\n?', '', h)
        assert n == 1, c
    h = h.replace('<script src="/assets/js/theme.js?v=1"></script>', CSS + '<script src="/assets/js/theme.js?v=1"></script>', 1)
    if not live:
        h = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', h, 1)
        h = re.sub(r'<meta name="robots"[^>]*>', '', h)
        h = h.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>', 1)
    h = re.sub(r'<body[^>]*>', f'<body class="{body}">', h, 1)
    h = re.sub(r'<main id="main"[^>]*>.*?</main>', lambda m: main, h, 1, flags=re.S)
    if not live:
        h = re.sub(r'<script src="/(assets/js/main\.js|webinar/motion\.js|assets/js/metrika\.js)[^"]*" defer></script>', '', h)
        h = re.sub(r'<noscript>.*?</noscript>', '', h, flags=re.S)
    if '<!--copy-->' in h:  # «Копировать» на реквизитах: внешний скрипт (CSP script-src 'self')
        h = h.replace('<!--copy-->', '').replace('</body>', '<script src="/assets/js/copy.js?v=1" defer></script>\n</body>', 1)
    if '<!--legal-->' in h:  # оглавление оферты: свернуть на мобилке (внешний скрипт, CSP script-src 'self')
        h = h.replace('<!--legal-->', '').replace('</body>', '<script src="/assets/js/legal.js?v=1" defer></script>\n</body>', 1)
    assert h.count('<h1') == 1 and 'nd-read.css' in h and 'theme.js' in h
    (R / M / out).write_text(h)
    print(out, len(h))


# фото финала — кадр вебинара, на который ведёт CTA; alt — как у этого кадра на /zapis-lichnyj-brend/
# ---------- T019 (макет) / T020 (рабочая страница): статья ----------
# Исходник — версия страницы в старом дизайне из git (рабочую /pozicionirovanie/ этот же скрипт переводит, см. ниже).
import subprocess
s = subprocess.run(['git', 'show', '26ec547:pozicionirovanie/index.html'], capture_output=True, text=True, check=True).stdout
head = one(r'<header class="article-heading">(.*?)</header>', s)
back = one(r'<a class="article-back"[^>]*>.*?</a>', head)
kick = one(r'<p class="article-kicker">(.*?)</p>', head)
h1 = one(r'<h1>(.*?)</h1>', head)
sub = one(r'<p class="article-subtitle">(.*?)</p>', head)
origin = one(r'<p class="article-origin">(.*?)</p>', head)
byline = one(r'<aside class="article-byline">(.*?)</aside>', s)
body = one(r'<div class="article-body">\n(.*?)</div></div>\n</article>', s)
blocks = re.findall(r'<(?:p|ul|figure)[^>]*>.*?</(?:p|ul|figure)>', body, re.S)
assert ''.join(blocks) == body.replace('\n', ''), 'тело разобрано не целиком'
meme, figs = blocks[3], [b for b in blocks if b.startswith('<figure')]
assert 'definition.jpg' in meme
meme_a = one(r'<figure class="article-figure">(<a .*?</a>)</figure>', meme)


def restyle(b):
    if b.startswith('<figure'):
        return b.replace('<figure class="article-figure">', '<figure class="ndr-fig">').replace('</a></figure>', ZOOM + '</a></figure>')
    if b.startswith('<p><i>'):
        return b.replace('<p>', '<p class="ndr-quote">', 1)
    if b.startswith('<p><b>'):
        return b.replace('<p>', '<p class="ndr-callout">', 1)
    if b.startswith('<p><a href="https://t.me/'):
        return b.replace('<p>', '<p class="ndr-tg">', 1)
    if b.startswith('<p class="article-original">'):
        return b.replace('class="article-original"', 'class="ndr-orig"', 1)
    return b


# макет: первый экран + разворот до первой схемы и позиционирующего утверждения (блоки 0–12), мем — в обложке
spread = [restyle(b) for i, b in enumerate(blocks) if 0 < i <= 12 and i != 3]
full = [restyle(b) for i, b in enumerate(blocks) if i not in (0, 3)]  # T020: всё тело, кроме лида и мема (они в обложке)
lede = blocks[0].replace('<p>', '<p class="arx-lede">', 1)  # первый абзац («На связи…») — лид обложки
author = one(r'<section id="article-author" class="article-author"[^>]*>(.*?)</section>', s)
one(r'<img src="/assets/img/portrait-bench-600\.webp"[^>]*>', author)
# фото автора (T020, координатор 03.10): кадр с видимыми глазами вместо portrait-bench (тёмные очки, реестр 28.09);
# portrait-armchair-smile на сайте больше нигде не стоит, на странице кадр не повторяется; alt новый — по кадру
A_IMG = ('<img src="/assets/img/portrait-armchair-smile-1200.webp" srcset="/assets/img/portrait-armchair-smile-600.webp 600w, '
         '/assets/img/portrait-armchair-smile-1200.webp 1200w, /assets/img/portrait-armchair-smile-2400.webp 2400w" '
         'sizes="(max-width:760px) 90vw, (max-width:1500px) 41vw, 535px" width="1200" height="2133" loading="lazy" '
         'alt="Валентина Сухарева улыбается, сидя в кресле">')
a_kick = one(r'<p class="article-kicker">(.*?)</p>', author)
a_name = one(r'<h2 id="author-title">(.*?)</h2>', author)
a_bio = one(r'</h2><p>(.*?)</p>', author)
nxt = one(r'<section class="article-next"[^>]*>(.*?)</section>', s)
n_kick = one(r'<p class="article-kicker">(.*?)</p>', nxt)
n_h2 = one(r'<h2 id="next-title">(.*?)</h2>', nxt)
n_cta = one(r'<a class="article-cta" href="([^"]*)">(.*?) <span aria-hidden="true">→</span></a>', nxt)
n_links = re.findall(r'<a class="article-text-link" href="([^"]*)">(.*?)</a>', nxt)
assert len(n_links) == 2

kick_n = kick.replace('СТАТЬЯ', '<i>*</i> СТАТЬЯ', 1)
POZ = f'''<main id="main">
<article>
<div class="page-band nd-band">
<header class="arx" aria-labelledby="ar-title">
<div class="arx-top">{back.replace('class="article-back"', 'class="nd-back"')}
<p class="nd-kick">{kick_n}</p>
<h1 id="ar-title" class="arx-h1">{h1}</h1>
</div>
<div class="arx-grid">
<div class="arx-copy">
<p class="arx-sub">{sub}</p>
{lede}
<p class="arx-origin">{origin}</p>
</div>
<figure class="arx-meme">{meme_a.replace(' loading="lazy"', ' fetchpriority="high"')}</figure>
</div>
</header>
</div>
<div class="page-band nd-band">
<div class="ndr">
<aside class="ndr-rail"><p class="ndr-by">{byline.replace('<p>', '<b>', 1).replace('</p>', '</b>', 1)}</p></aside>
<div class="ndr-body">
@@BODY@@
</div>
</div>
</div>
</article>
<div class="page-band nd-band nw2-band">
<section class="nw2 rca rca--md" id="article-author" aria-labelledby="author-title">
<figure class="rca-ph rca-ph--chair">{A_IMG}</figure>
<div class="rca-copy">
<p class="rcd-kick"><i>*</i> {a_kick}</p>
<h2 id="author-title" class="rca-name">{a_name}</h2>
<div class="rca-plate"><p class="rca-bio">{a_bio}</p></div>
</div>
</section></div>
<div class="page-band nd-band nw2-band">
<section class="nw2 nw-cta ar-final" aria-labelledby="next-title">
<div class="nw-cta-panel">
<div class="nw-cta-copy"><p class="rcd-kick"><i>*</i> {n_kick}</p><h2 id="next-title">{n_h2}</h2>
<a class="nd-pay md-plate" href="{n_cta[0]}">{ARROW}<span class="nd-pay-t">{n_cta[1]}</span></a>
<p class="rcd-links">{' · '.join(f'<a href="{u}">{t}</a>' for u, t in n_links)}</p>
</div>
<figure class="nw-cta-photo"><img src="/assets/img/portrait-mic-600.webp" srcset="/assets/img/portrait-mic-600.webp 600w, /assets/img/portrait-mic-1200.webp 1200w" sizes="(max-width:700px) 100vw, 40vw" loading="lazy" alt="Валентина Сухарева, ведущая вебинара"></figure>
</div>
</section></div>
</main>'''
build(s, 'pozicionirovanie-hero.html', POZ.replace('@@BODY@@', chr(10).join(spread)), 'home nd nw-page ar-page',
      'Макет T019: /pozicionirovanie/ — обложка и читальный шаблон (spec 006)', ['/pozicionirovanie/style.css'])
build(s, '../../../pozicionirovanie/index.html', POZ.replace('@@BODY@@', chr(10).join(full)), 'home nd nw-page ar-page', None,
      ['/pozicionirovanie/style.css'], live=True)

# ---------- T023: реквизиты ----------
# Исходник — старая версия страницы из git (рабочую /rekvizity/ этот же скрипт переводит на новый шаблон, см. ниже).
# Поля и значения — полный набор, присланный владельцем 03.10.2026 (дословно, регистр и пунктуация сохранены);
# подзаголовки «Организация» / «Банк» и «Скопировать все реквизиты» — по постановке координатора.
import subprocess
s = subprocess.run(['git', 'show', '12fdc13:rekvizity/index.html'], capture_output=True, text=True, check=True).stdout
m = one(r'<main id="main" class="utility-main">(.*?)</main>', s)
r_back = one(r'<a class="utility-back"[^>]*>(.*?)</a>', m)
r_lab = one(r'<p class="utility-label">(.*?)</p>', m)
r_h1 = one(r'<h1>(.*?)</h1>', m)
CAPTION = 'Реквизиты счета'
GROUPS = [('Организация', [
    ('Название организации', 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ СУХАРЕВА ВАЛЕНТИНА АЛЕКСАНДРОВНА'),
    ('Юридический адрес организации', '650056, РОССИЯ, КЕМЕРОВСКАЯ ОБЛАСТЬ - КУЗБАСС, Г КЕМЕРОВО, УЛ ВОРОШИЛОВА, Д 5А, КВ 58'),
    ('ИНН', '421204839449'),
    ('ОГРН/ОГРНИП', '325420500045757')]),
  ('Банк', [
    ('Расчетный счет', '40802810600008254497'),
    ('Банк', 'АО «ТБанк»'),
    ('ИНН банка', '7710140679'),
    ('БИК банка', '044525974'),
    ('Корреспондентский счет банка', '30101810145250000974'),
    ('Юридический адрес банка', '127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26')])]
# старые 4 значения страницы обязаны совпасть с присланными (иначе — вопрос владельцу, а не молчаливая замена)
old = dict(re.findall(r'<div class="legal-row"><dt>(.*?)</dt><dd>(.*?)</dd></div>', m))
new = dict(GROUPS[0][1])
assert old['Название организации'] == new['Название организации'] and old['ИНН'] == new['ИНН'] and old['ОГРНИП'] == new['ОГРН/ОГРНИП']
assert old['Юридический адрес'] == new['Юридический адрес организации']
COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
n = 0
sheet = ''
for g, rows in GROUPS:
    sheet += f'<h2 class="svx-sub">{g}</h2><dl>'
    for t, d in rows:
        n += 1
        sheet += (f'<div><dt>{t}</dt><dd><span class="svx-val" id="rq-{n}">{d}</span>'
                  f'<button class="svx-copy" type="button" data-copy="rq-{n}" aria-label="Копировать: {t}" hidden>{COPY}</button></dd></div>')
    sheet += '</dl>'
REK = f'''<main id="main">
<div class="page-band nd-band">
<section class="svx svx--doc" aria-labelledby="sv-title">
<div class="svx-head">
<a class="nd-back" href="/">{r_back}</a>
<p class="nd-kick"><i>*</i> {r_lab}</p>
<h1 id="sv-title" class="svx-h1">{r_h1}</h1>
</div>
<div class="svx-bar"><p class="svx-cap">{CAPTION}</p><button class="svx-all" type="button" data-copy-all hidden>{COPY}<span>Скопировать все реквизиты</span></button></div>
<div class="svx-doc">{sheet}</div>
</section>
</div>
</main>'''
REK += '<!--copy-->'  # маркер: build() ставит copy.js перед </body>
build(s, 'rekvizity-svc.html', REK, 'home nd nw-page sv-page',
      'Макет T023: /rekvizity/ — служебный шаблон (spec 006)', ['/webinar/webinar.css', '/assets/css/utility.css'])
# рабочая страница: тот же <main>, мета/JSON-LD/хлебные крошки/скрипты исходника не трогаются (live=True)
build(s, '../../../rekvizity/index.html', REK, 'home nd nw-page sv-page', None, ['/webinar/webinar.css', '/assets/css/utility.css'], live=True)

# ---------- T023: 404 (В6: «На главную» и «Календарь встреч» → /#calendar) ----------
s = subprocess.run(['git', 'show', '26ec547:404.html'], capture_output=True, text=True, check=True).stdout
m = one(r'<main id="main" class="utility-main">(.*?)</main>', s)
e_code = one(r'<p class="error-code">(.*?)</p>', m)
e_h1 = one(r'<h1>(.*?)</h1>', m)
e_p = one(r'</h1><p>(.*?)</p>', m)
E404 = f'''<main id="main">
<div class="page-band nd-band">
<section class="svx svx--404" aria-labelledby="sv-title">
<p class="svx-code">{e_code}</p>
<div class="svx-head">
<h1 id="sv-title" class="svx-h1">{e_h1}</h1>
<p class="svx-note">{e_p}</p>
<div class="svx-acts">
<a class="nd-pay md-plate" href="/">{ARROW}<span class="nd-pay-t">На главную</span></a>
<a class="nw-btn" href="/#calendar">Календарь встреч <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a>
</div>
</div>
</section>
</div>
</main>'''
build(s, '404-svc.html', E404, 'home nd nw-page sv-page sv-404',
      'Макет T023: 404 — служебный шаблон (spec 006)', ['/webinar/webinar.css', '/assets/css/utility.css'])
# T025: рабочая 404 — тот же <main>, noindex и мета исходника сохраняются
build(s, '../../../404.html', E404, 'home nd nw-page sv-page sv-404', None, ['/webinar/webinar.css', '/assets/css/utility.css'], live=True)

# ---------- T024: юридические документы на служебном шаблоне .svx ----------
# Тексты документов не трогаются: <section class="document-section"> и <article class="offer-document"> переносятся
# как есть (проверка ниже — побайтно), меняется только обёртка. Оглавление оферты — тот же <nav>, обёрнутый в <details>
# (десктоп: всегда открыт, sticky слева; мобилка: свёрнут, раскрывается — assets/js/legal.js).
def legal(path):
    s = subprocess.run(['git', 'show', '26ec547:' + path], capture_output=True, text=True, check=True).stdout
    m = one(r'<main id="main" class="utility-main">(.*?)</main>', s)
    back = one(r'<a class="utility-back" href="/">(.*?)</a>', m)
    if 'offer-toc' in m:
        rev = one(r'(<p class="offer-revision">.*?</p>)', m)
        nav = one(r'(<nav class="offer-toc".*?</nav>)', m)
        art = one(r'(<article id="offer-document".*?</article>)', m)
        assert m == f'<a class="utility-back" href="/">{back}</a>' + rev + nav + art
        main = f'''<main id="main">
<div class="page-band nd-band">
<div class="svx svx--doc svx--legal svx--toc">
<aside class="svx-tocwrap"><details class="svx-toc" open><summary>Оглавление</summary>{nav}</details></aside>
<div class="svx-main">
<a class="nd-back" href="/">{back}</a>
{rev}
{art}
</div>
</div>
</div>
</main>'''
        keep = [nav, art, rev]
    else:
        lab = one(r'<p class="utility-label">(.*?)</p>', m)
        h1 = one(r'<h1>(.*?)</h1>', m)
        date = one(r'(<p class="legal-date">.*?</p>)', m)
        secs = m.split(date, 1)[1]
        assert m == f'<a class="utility-back" href="/">{back}</a><p class="utility-label">{lab}</p><h1>{h1}</h1>' + date + secs
        main = f'''<main id="main">
<div class="page-band nd-band">
<div class="svx svx--doc svx--legal">
<div class="svx-main">
<div class="svx-head">
<a class="nd-back" href="/">{back}</a>
<p class="nd-kick"><i>*</i> {lab}</p>
<h1>{h1}</h1>
{date}
</div>
{secs}
</div>
</div>
</div>
</main>'''
        keep = [secs, date]
    for k in keep:  # тексты документа перенесены побайтно
        assert k in main
    if 'offer-toc' in m:
        main += '<!--legal-->'
    build(s, '../../../' + path, main, 'home nd nw-page sv-page lg-page', None, ['/webinar/webinar.css', '/assets/css/utility.css'], live=True)


for path in ('legal/oferta/index.html', 'legal/privacy/index.html', 'legal/soglasie/index.html'):
    legal(path)
