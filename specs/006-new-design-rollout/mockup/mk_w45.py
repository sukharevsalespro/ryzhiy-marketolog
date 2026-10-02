# Макеты T019 (статья /pozicionirovanie/) и T023 (служебная /rekvizity/ + 404), волны 4–5 spec 006.
# Собирает mockup/*.html из текущих страниц: шапка, подвал, мета — из исходника как есть; <main> — новый шаблон,
# тексты, ссылки, картинки и alt — вырезаются из исходника регулярками (не перепечатываются).
# usage: python3 specs/006-new-design-rollout/mockup/mk_w45.py   (из корня репо)
import re, pathlib
R = pathlib.Path('.')
M = 'specs/006-new-design-rollout/mockup/'
CSS = ('<link rel="stylesheet" href="/assets/css/home-blocks.css?v=3">'
       '<link rel="stylesheet" href="/assets/css/nd-pages.css?v=7">'
       '<link rel="stylesheet" href="/networking/nw-nd.css?v=1">'
       '<link rel="stylesheet" href="/assets/css/nd-read.css?v=1">')
ARROW = '<span class="nd-pay-c"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>'
ZOOM = '<span class="ndr-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8 8M10 5H5v14h14v-5"/></svg></span>'


def one(pat, s, flags=re.S):
    m = re.findall(pat, s, flags)
    assert len(m) == 1, (pat, len(m))
    return m[0]


def build(src, out, main, body, title, drop_css):
    h = (R / src).read_text()
    for c in drop_css:
        h, n = re.subn(r'<link[^>]*' + re.escape(c) + r'[^>]*>\n?', '', h)
        assert n == 1, c
    h = h.replace('<script src="/assets/js/theme.js?v=1"></script>', CSS + '<script src="/assets/js/theme.js?v=1"></script>', 1)
    h = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', h, 1)
    h = re.sub(r'<meta name="robots"[^>]*>', '', h)
    h = h.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>', 1)
    h = re.sub(r'<body[^>]*>', f'<body class="{body}">', h, 1)
    h = re.sub(r'<main id="main"[^>]*>.*?</main>', lambda m: main, h, 1, flags=re.S)
    h = re.sub(r'<script src="/(assets/js/main\.js|webinar/motion\.js|assets/js/metrika\.js)[^"]*" defer></script>', '', h)
    h = re.sub(r'<noscript>.*?</noscript>', '', h, flags=re.S)
    if '<!--copy-->' in h:  # «Копировать» на реквизитах: внешний скрипт (CSP script-src 'self')
        h = h.replace('<!--copy-->', '').replace('</body>', '<script src="/assets/js/copy.js?v=1" defer></script>\n</body>', 1)
    assert h.count('<h1') == 1 and 'nd-read.css' in h and 'theme.js' in h
    (R / M / out).write_text(h)
    print(out, len(h))


# фото финала — кадр вебинара, на который ведёт CTA; alt — как у этого кадра на /zapis-lichnyj-brend/
# ---------- T019: статья ----------
s = (R / 'pozicionirovanie/index.html').read_text()
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
lede = blocks[0].replace('<p>', '<p class="arx-lede">', 1)  # первый абзац («На связи…») — лид обложки
author = one(r'<section id="article-author" class="article-author"[^>]*>(.*?)</section>', s)
a_img = one(r'<img src="/assets/img/portrait-bench-600\.webp"[^>]*>', author)
a_alt = one(r'alt="([^"]*)"', a_img)
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
{chr(10).join(spread)}
</div>
</div>
</div>
</article>
<div class="page-band nd-band nw2-band">
<section class="nw2 rca rca--md" id="article-author" aria-labelledby="author-title">
<figure class="rca-ph"><img src="/assets/img/portrait-bench-1200.webp" srcset="/assets/img/portrait-bench-600.webp 600w, /assets/img/portrait-bench-1200.webp 1200w, /assets/img/portrait-bench-2400.webp 2400w" sizes="(max-width:760px) 90vw, (max-width:1500px) 41vw, 535px" width="1200" height="1801" loading="lazy" alt="{a_alt}"></figure>
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
build('pozicionirovanie/index.html', 'pozicionirovanie-hero.html', POZ, 'home nd nw-page ar-page',
      'Макет T019: /pozicionirovanie/ — обложка и читальный шаблон (spec 006)', ['/pozicionirovanie/style.css'])

# ---------- T023: реквизиты ----------
s = (R / 'rekvizity/index.html').read_text()
m = one(r'<main id="main" class="utility-main">(.*?)</main>', s)
r_back = one(r'<a class="utility-back"[^>]*>(.*?)</a>', m)
r_lab = one(r'<p class="utility-label">(.*?)</p>', m)
r_h1 = one(r'<h1>(.*?)</h1>', m)
rows = re.findall(r'<div class="legal-row"><dt>(.*?)</dt><dd>(.*?)</dd></div>', m)
assert len(rows) == 4
COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
dl = ''.join(f'<div><dt>{t}</dt><dd><span class="svx-val" id="rq-{i}">{d}</span>'
             f'<button class="svx-copy" type="button" data-copy="rq-{i}" aria-label="Копировать: {t}" hidden>{COPY}</button></dd></div>'
             for i, (t, d) in enumerate(rows, 1))
REK = f'''<main id="main">
<div class="page-band nd-band">
<section class="svx svx--doc" aria-labelledby="sv-title">
<div class="svx-head">
<a class="nd-back" href="/">{r_back}</a>
<p class="nd-kick"><i>*</i> {r_lab}</p>
<h1 id="sv-title" class="svx-h1">{r_h1}</h1>
</div>
<dl class="svx-doc">{dl}</dl>
</section>
</div>
</main>'''
REK += '<!--copy-->'  # маркер: build() ставит copy.js перед </body>
build('rekvizity/index.html', 'rekvizity-svc.html', REK, 'home nd nw-page sv-page',
      'Макет T023: /rekvizity/ — служебный шаблон (spec 006)', ['/webinar/webinar.css', '/assets/css/utility.css'])

# ---------- T023: 404 (В6: «На главную» и «Календарь встреч» → /#calendar) ----------
s = (R / '404.html').read_text()
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
build('404.html', '404-svc.html', E404, 'home nd nw-page sv-page sv-404',
      'Макет T023: 404 — служебный шаблон (spec 006)', ['/webinar/webinar.css', '/assets/css/utility.css'])
