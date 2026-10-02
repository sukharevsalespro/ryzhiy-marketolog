# T016–T017 (волна 3): собрать /zapis-lichnyj-brend/ и /zapis-marketing-doveriya/ в новом дизайне.
# Источник — исходные страницы из git (коммит SRC_REV): шапка, подвал, мета, JSON-LD, тексты и ссылки оплаты берутся оттуда
# дословно (фрагменты вырезаются регулярками, не перепечатываются). Первый экран — из макетов T015 (mockup/zapis-*-hero.html).
# usage (из корня репо): python3 specs/006-new-design-rollout/mockup/mk_zapis_pages.py
import re, subprocess, pathlib
SRC_REV = '5465f8f'   # new-design до волны 3
R = pathlib.Path('.')
ARROW = '<span class="nd-pay-c"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>'

def src(path): return subprocess.run(['git', 'show', f'{SRC_REV}:{path}'], capture_output=True, text=True, check=True).stdout
def one(pat, s, flags=re.S):
    m = re.findall(pat, s, flags); assert len(m) == 1, (pat, len(m)); return m[0]
def clean(s):  # снять атрибуты анимации старого дизайна (webinar/motion.js) — текст не трогаем
    return re.sub(r'\s(data-motion|data-delay)="[^"]*"', '', s)
def hero(mock):
    h = (R / f'specs/006-new-design-rollout/mockup/{mock}').read_text()
    return one(r'(<div class="page-band nd-band">\n<section class="lpx rcx.*?</section>\n</div>)', h)
def pay(a_html, label_html):  # та же ссылка оплаты (href/target/rel как в исходнике), вид — кнопка nd-pay
    href = one(r'href="([^"]+)"', a_html); attrs = ' '.join(re.findall(r'\s((?:target|rel)="[^"]*")', a_html))
    return f'<a class="nd-pay md-plate" href="{href}" {attrs}>{ARROW}<span class="nd-pay-t">{label_html}</span></a>'

# ---------------- /zapis-lichnyj-brend/ ----------------
def lb():
    s = src('zapis-lichnyj-brend/index.html')
    why = one(r'<section class="w-why".*?</section>', s)
    why_h2 = one(r'<h2 id="why-title">(.*?)</h2>', why)
    why_ps = re.findall(r'<p>(.*?)</p>', one(r'<div class="lead-copy"[^>]*>(.*?)</div>', why)); assert len(why_ps) == 2
    fact_n = one(r'<p class="fact-number"[^>]*><span>(.*?)</span> <span>(.*?)</span></p>', why)
    fact_t = one(r'<p class="fact-text"[^>]*>(.*?)</p>', why)
    prog = one(r'<section class="w-program".*?</section>', s)
    prog_h2 = one(r'<h2 id="program-title">(.*?)</h2>', prog)
    jump = clean(one(r'(<a class="text-link" href="#participation">.*?</a>)', prog)).replace('class="text-link"', 'class="rcd-jump"')
    items = re.findall(r'<li[^>]*><h3>(.*?)</h3><p>(.*?)</p></li>', prog); assert len(items) == 6
    mid = one(r'<section class="mid-booking".*?</section>', s)
    mid_kick = one(r'<p class="kicker">(.*?)</p>', mid.split('offer-purchase')[0])
    mid_h2 = one(r'<h2 id="offer-title">(.*?)</h2>', mid)
    mid_dl = one(r'<dl class="offer-details">(.*?)</dl>', mid)
    mid_cost_k = one(r'<div class="offer-cost"><p class="kicker">(.*?)</p>', mid)
    mid_price = one(r'<p class="mid-price"[^>]*>(.*?)</p>', mid)
    mid_a = one(r'(<a class="pay".*?</a>)', mid); mid_lab = one(r'<a class="pay"[^>]*><span>(.*?)</span>', mid)
    oferta = one(r'<p class="offer-note">(<a href="/legal/oferta/">.*?</a>)</p>', mid)
    pnote = one(r'<p class="payment-note">(.*?)</p>', mid)
    au = one(r'<section class="w-author".*?</section>', s)
    au_kick = one(r'<p class="kicker">(.*?)</p>', au); au_h2 = one(r'<h2 id="author-title">(.*?)</h2>', au)
    au_img = clean(one(r'(<img class="author-photo".*?>)', au)).replace(' class="author-photo"', '')
    au_brand = one(r'<p class="author-brand">(.*?)</p>', au)
    au_p = one(r'</p><p>(Наставник.*?)</p>', au)
    au_exp_n, au_exp_t = one(r'<div class="author-experience"><p>(.*?)</p><span>(.*?)</span></div>', au)
    au_paths = re.findall(r'<p class="author-path">(.*?)</p>', au); assert len(au_paths) == 2
    fin = one(r'<section class="w-final".*?</section>', s)
    fin_h2 = one(r'<h2 id="final-title">(.*?)</h2>', fin)
    fin_p = one(r'<div class="final-copy"[^>]*>.*?</h2><p>(.*?)</p>', fin)
    fin_kick = one(r'<div class="final-ticket"[^>]*><p class="kicker">(.*?)</p>', fin)
    fin_date = one(r'<p class="ticket-date">(.*?)</p>', fin); fin_acc = one(r'</p><p>(Доступ[^<]*)</p>', fin)
    fin_price = one(r'<p class="ticket-price"[^>]*>(.*?)</p>', fin)
    fin_a = one(r'(<a class="pay".*?</a>)', fin); fin_lab = one(r'<a class="pay"[^>]*><span>(.*?)</span>', fin)

    cards = ''.join(f'<li><h3>{h}</h3><p>{p}</p></li>' for h, p in items)
    dl = re.sub(r'<div><dt>', '<div><dt>', mid_dl)
    main = f'''<main id="main">
{hero('zapis-lb-hero.html')}

<div class="page-band nd-band nw2-band">
<section class="nw2 lpd-what" aria-labelledby="why-title">
<div class="nw-head"><h2 id="why-title">{why_h2}</h2><span class="nw-rule" aria-hidden="true"></span></div>
<div class="nw2-format">
<p class="nw-big rcd-big" aria-label="Факт о личном бренде"><b>{fact_n[0]}</b><span>{fact_n[1]} {fact_t}</span></p>
<div class="nw2-format-copy"><p class="lpd-lead">{why_ps[0]}</p><p class="nw-format-text">{why_ps[1]}</p></div>
</div>
</section></div>

<div class="page-band nd-band nw2-band nw2-band--alt">
<section class="nw2" id="program" aria-labelledby="program-title">
<div class="nw-head"><h2 id="program-title">{prog_h2}</h2><span class="nw-rule" aria-hidden="true"></span>{jump}</div>
<ul class="rcd-prog rcd-prog--3">{cards}</ul>
</section></div>

<div class="page-band nd-band nd-band--graphite">
<section class="nw2 rcd-buy" id="participation" aria-labelledby="offer-title">
<div><p class="rcd-kick"><i>*</i> {mid_kick}</p><h2 id="offer-title" class="rcd-h2">{mid_h2}</h2><dl class="nw-facts">{dl}</dl></div>
<div class="rcx-tk">
<div class="rcx-tk-top"><p class="rcx-tk-what"><b><i class="rcx-rec" aria-hidden="true"></i>{mid_cost_k}</b></p><p class="rcx-price">{mid_price}</p></div>
{pay(mid_a, mid_lab)}
<p class="rcx-tk-note">{oferta}<span>{pnote}</span></p>
</div>
</section></div>

<div class="page-band nd-band nw2-band">
<section class="nw2 rca" aria-labelledby="author-title">
<figure class="rca-ph">{au_img}</figure>
<div class="rca-copy">
<p class="rcd-kick"><i>*</i> {au_kick}</p>
<h2 id="author-title" class="rca-name">{au_h2}</h2>
<p class="rca-brand">{au_brand}</p>
<div class="rca-plate"><p class="rca-years"><b>{au_exp_n}</b><span>{au_exp_t}</span></p><p class="rca-bio">{au_p}</p></div>
<p class="rca-path">{au_paths[0]}</p>
<p class="rcd-links">{au_paths[1]}</p>
</div>
</section></div>

<div class="page-band nd-band nw2-band">
<section class="nw2 nw-cta rcd-final" id="registration" aria-labelledby="final-title">
<div class="nw-cta-panel">
<div class="nw-cta-copy"><h2 id="final-title">{fin_h2}</h2><p class="nw-cta-text">{fin_p}</p>
<div class="rcx-tk">
<div class="rcx-tk-top"><p class="rcx-tk-what"><span class="rcd-tk-kick">{fin_kick}</span><b><i class="rcx-rec" aria-hidden="true"></i>{fin_date}</b><span>{fin_acc}</span></p><p class="rcx-price">{fin_price}</p></div>
{pay(fin_a, fin_lab)}
<p class="rcx-tk-note">{oferta}<span>{pnote}</span></p>
</div></div>
<figure class="nw-cta-photo rcd-ph--chin"><img src="/assets/img/portrait-cafe-chin-600.webp" srcset="/assets/img/portrait-cafe-chin-600.webp 600w, /assets/img/portrait-cafe-chin-1200.webp 1200w" sizes="(max-width:1100px) 100vw, 40vw" width="600" height="1067" loading="lazy" alt="Валентина Сухарева улыбается за столиком в кафе, подперев подбородок руками"></figure>
</div>
</section></div>
</main>'''
    return s, main

# ---------------- /zapis-marketing-doveriya/ ----------------
def md():
    s = src('zapis-marketing-doveriya/index.html')
    intro = one(r'<section class="record-intro"><p>(.*?)</p></section>', s)
    prog = one(r'<section class="record-program">(.*?)</section>', s)
    prog_h2 = one(r'<h2>(.*?)</h2>', prog)
    items = re.findall(r'<li><span aria-hidden="true" class="record-number">(.*?)</span><p>(.*?)</p></li>', prog); assert len(items) == 4
    bonus = one(r'<section class="record-bonus"><p>(.*?)</p></section>', s)
    au = one(r'<section class="record-author">(.*?)</section>', s)
    au_img = one(r'(<img .*?/>)', au); au_cap = one(r'<figcaption>(.*?)</figcaption>', au)
    au_kick = one(r'<p class="record-label">(.*?)</p>', au); au_h2 = one(r'<h2>(.*?)</h2>', au)
    au_ps = re.findall(r'<p>(.*?)</p>', au); assert len(au_ps) == 2
    fin = one(r'<section class="record-final">(.*?)</section>', s)
    fin_kick = one(r'<p class="record-label">(.*?)</p>', fin); fin_h2 = one(r'<h2>(.*?)</h2>', fin)
    fin_acc = one(r'</h2><p>(.*?)</p>', fin)
    fin_a = one(r'(<a class="pay".*?</a>)', fin); fin_lab = one(r'<a class="pay"[^>]*>(.*?) <span aria-hidden="true" class="arrow">', fin)
    oferta = one(r'(<a class="record-terms" href="/legal/oferta/">.*?</a>)', fin).replace(' class="record-terms"', '')

    cards = ''.join(f'<li><b class="rcd-n" aria-hidden="true">{n}</b><p>{p}</p></li>' for n, p in items)
    main = f'''<main id="main">
{hero('zapis-md-hero.html')}

<div class="page-band nd-band nw2-band nw2-band--alt">
<section class="nw2" id="program" aria-labelledby="program-title">
<p class="rcd-lead rcd-intro">{intro}</p>
<div class="nw-head"><h2 id="program-title">{prog_h2}</h2><span class="nw-rule" aria-hidden="true"></span></div>
<ol class="rcd-prog rcd-prog--num">{cards}</ol>
<p class="lpd-punch rcd-bonus">{bonus}</p>
</section></div>

<div class="page-band nd-band nw2-band">
<section class="nw2 rca rca--md" aria-labelledby="author-title">
<figure class="rca-ph">{au_img}<figcaption>{au_cap}</figcaption></figure>
<div class="rca-copy">
<p class="rcd-kick"><i>*</i> {au_kick}</p>
<h2 id="author-title" class="rca-name">{au_h2}</h2>
<div class="rca-plate"><p class="rca-bio">{au_ps[0]}</p></div>
<p class="rcd-links">{au_ps[1]}</p>
</div>
</section></div>

<div class="page-band nd-band nw2-band">
<section class="nw2 nw-cta rcd-final" aria-labelledby="final-title">
<div class="nw-cta-panel">
<div class="nw-cta-copy"><p class="rcd-kick"><i>*</i> {fin_kick}</p><h2 id="final-title">{fin_h2}</h2>
<div class="rcx-tk">
<div class="rcx-tk-top"><p class="rcx-tk-what"><b><i class="rcx-rec" aria-hidden="true"></i>{fin_acc}</b></p><p class="rcx-price">888 ₽</p></div>
{pay(fin_a, fin_lab)}
<p class="rcx-tk-note">{oferta}</p>
</div></div>
<figure class="nw-cta-photo rcd-ph--ny"><img src="/assets/img/portrait-newyear-600.webp" srcset="/assets/img/portrait-newyear-600.webp 600w, /assets/img/portrait-newyear-1200.webp 1200w" sizes="(max-width:1100px) 100vw, 40vw" width="600" height="600" loading="lazy" alt="Валентина Сухарева в чёрном жакете, портрет крупным планом"></figure>
</div>
</section></div>
</main>'''
    return s, main

CSS = ('<link rel="stylesheet" href="/assets/css/home-blocks.css?v=3">\n<link rel="stylesheet" href="/assets/css/nd-pages.css?v=7">\n'
       '<link rel="stylesheet" href="/networking/nw-nd.css?v=1">\n')
def build(path, s, main):
    h = s
    h = re.sub(r'<link[^>]*(webinar/webinar\.css|zapis-marketing-doveriya/style\.css)[^>]*>\n?', '', h)
    n0 = h.count('<script src="/assets/js/theme.js?v=1"></script>'); assert n0 == 1
    h = h.replace('<script src="/assets/js/theme.js?v=1"></script>', CSS + '<script src="/assets/js/theme.js?v=1"></script>')
    h = re.sub(r'<body[^>]*>', '<body class="home nd nw-page lpd rc-page">', h, 1)
    h = re.sub(r'<main id="main">.*?</main>', lambda m: main, h, 1, flags=re.S)
    h = h.replace('<script src="/webinar/motion.js" defer></script>', '')
    assert h.count('<h1') == 1 and 'metrika.js' in h and 'nd-pages.css?v=7' in h
    (R / path).write_text(h); print(path, len(h))

build('zapis-lichnyj-brend/index.html', *lb())
build('zapis-marketing-doveriya/index.html', *md())
