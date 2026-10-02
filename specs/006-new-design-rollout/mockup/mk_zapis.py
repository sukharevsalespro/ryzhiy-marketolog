# Макет T015 (волна 3): первый экран записей вебинаров. Собирает mockup/zapis-*-hero.html из текущих страниц:
# шапка/подвал/мета — из исходника как есть, <main> — новый первый экран (тексты, цены, ссылки оплаты — дословно с исходника).
# usage: python3 specs/006-new-design-rollout/mockup/mk_zapis.py   (из корня репо)
import re, pathlib
R = pathlib.Path('.')
CSS = ('<link rel="stylesheet" href="/assets/css/home-blocks.css?v=3">'
       '<link rel="stylesheet" href="/assets/css/nd-pages.css?v=6">')
DISK = ('<span class="rcx-disk" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>'
        '<i><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></i></span>')
ARROW = '<span class="nd-pay-c"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>'

LB = f'''<main id="main">
<div class="page-band nd-band">
<section class="lpx rcx rcx--lb" aria-labelledby="webinar-title">
<picture class="lpx-ph">
<source media="(max-width:700px), (max-aspect-ratio:5/4)" srcset="/assets/img/portrait-mic-600.webp 600w, /assets/img/portrait-mic-1200.webp 1200w" sizes="(max-width:560px) 100vw, 560px">
<img src="/assets/img/zb-wide-1080.webp" srcset="/assets/img/zb-wide-1080.webp 4314w, /assets/img/zb-wide-1440.webp 5752w, /assets/img/zb-wide-2048.webp 8180w" sizes="(max-height:900px) 3600px, (max-height:1200px) 4800px, 6000px" fetchpriority="high" alt="Валентина Сухарева, ведущая вебинара">
</picture>
<div class="lpx-in">
<div class="rcx-col">
<a class="nd-back" href="/">← На главную</a>
<p class="nd-kick" data-rise style="--d:0"><i>*</i> ПРАКТИЧЕСКИЙ ВЕБИНАР</p>
<h1 id="webinar-title" class="nd-h1 rcx-h1" data-rise style="--d:1"><span class="rcx-h1-s">КАК РАЗВИТЬ И<br> УСОВЕРШЕНСТВОВАТЬ</span> <span class="rcx-h1-m">ВАШ ЛИЧНЫЙ<br> БРЕНД</span></h1>
<p class="nd-lead" data-rise style="--d:2">от идеи до реализации —<br> без выгораний</p>
<div class="rcx-tk" data-rise style="--d:3">
<div class="rcx-tk-top"><p class="rcx-tk-what"><b><i class="rcx-rec" aria-hidden="true"></i>Запись вебинара</b><span>Доступ сразу после оплаты</span></p><p class="rcx-price">800 ₽</p></div>
<a class="nd-pay md-plate" href="https://payform.ru/g9cC0N3/" target="_blank" rel="noopener noreferrer">{ARROW}<span class="nd-pay-t">Оплатить доступ — 800 ₽</span></a>
<p class="rcx-tk-note"><a href="/legal/oferta/">Условия публичной оферты</a><span>Оплата через Продамус</span></p>
</div>
</div>
<div class="rcx-bar" role="img" aria-label="Формула личного бренда: Смыслы × Позиционирование × Якоря × Дисциплина × Легенда">{DISK}
<ol class="rcx-track" aria-hidden="true"><li><span>Смыслы <b>×</b></span></li><li><span>Позиционирование <b>×</b></span></li><li><span>Якоря <b>×</b></span></li><li><span>Дисциплина <b>×</b></span></li><li><span>Легенда</span></li></ol>
</div>
</div>
</section>
</div>
</main>'''

MD = f'''<main id="main">
<div class="page-band nd-band">
<section class="lpx rcx rcx--md" aria-labelledby="md-title">
<div class="lpx-in">
<div class="rcx-col">
<a class="nd-back" href="/">← На главную</a>
<p class="nd-kick" data-rise style="--d:0"><i>*</i> ВЕБИНАР В ЗАПИСИ</p>
<h1 id="md-title" class="nd-h1 rcx-h1 rcx-h1--md" data-rise style="--d:1"><span>Маркетинг Доверия:</span> <small>как привлекать клиентов в новых реалиях</small></h1>
<p class="nd-lead" data-rise style="--d:2">мощный практический онлайн-эфир, доступен в записи.</p>
<div class="rcx-tk" data-rise style="--d:3">
<div class="rcx-tk-top"><p class="rcx-tk-what"><b><i class="rcx-rec" aria-hidden="true"></i>Доступ после оплаты</b></p><p class="rcx-price">888 ₽</p></div>
<a class="nd-pay md-plate" href="https://payform.ru/e0cjdjM" rel="noopener noreferrer" target="_blank">{ARROW}<span class="nd-pay-t">Купить доступ — 888 ₽</span></a>
<p class="rcx-tk-note"><a href="/legal/oferta/">Условия публичной оферты</a></p>
</div>
</div>
<figure class="rcx-poster"><a aria-label="Открыть афишу вебинара крупно" href="/assets/img/poster-doveriya-1200.webp" rel="noopener noreferrer" target="_blank"><img alt="Афиша прошедшего вебинара «Маркетинг доверия» с двумя ведущими" fetchpriority="high" height="2133" width="1200" sizes="(max-width:1100px) 34vw, 760px" src="/assets/img/poster-doveriya-1200.webp" srcset="/assets/img/poster-doveriya-600.webp 600w, /assets/img/poster-doveriya-1200.webp 1200w"></a><figcaption>Афиша прошедшего эфира <a href="/assets/img/poster-doveriya-1200.webp" rel="noopener noreferrer" target="_blank">Открыть крупно →</a></figcaption></figure>
<div class="rcx-bar" role="img" aria-label="Что внутри: две главные причины, скрытая золотая жила, 9 факторов доверия, ИИ в помощь">{DISK}
<div><p class="rcx-cap">Что внутри</p><ol class="rcx-track" aria-hidden="true"><li><span>Две главные причины</span></li><li><span>Скрытая золотая жила</span></li><li><span>9 факторов доверия</span></li><li><span>ИИ в помощь</span></li></ol></div>
</div>
</div>
</section>
</div>
</main>'''

def build(src, out, main, title):
    h = (R / src).read_text()
    h = re.sub(r'<link[^>]*(webinar/webinar\.css|zapis-marketing-doveriya/style\.css)[^>]*>\n?', '', h)
    h = h.replace('<script src="/assets/js/theme.js?v=1"></script>', CSS + '<script src="/assets/js/theme.js?v=1"></script>', 1)
    h = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', h, 1)
    h = re.sub(r'<meta name="robots"[^>]*>', '', h)
    h = h.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>', 1)
    h = re.sub(r'<body[^>]*>', '<body class="home nd rc-page">', h, 1)
    h = re.sub(r'<main id="main">.*?</main>', lambda m: main, h, 1, flags=re.S)
    h = re.sub(r'<script src="/(assets/js/main\.js|webinar/motion\.js|assets/js/metrika\.js)[^"]*" defer></script>', '', h)
    h = re.sub(r'<noscript>.*?</noscript>', '', h, flags=re.S)
    assert h.count('<h1') == 1 and 'theme.js' in h and 'nd-pages.css' in h
    (R / out).write_text(h); print(out, len(h))

build('zapis-lichnyj-brend/index.html', 'specs/006-new-design-rollout/mockup/zapis-lb-hero.html', LB, 'Макет T015: /zapis-lichnyj-brend/ — первый экран (spec 006)')
build('zapis-marketing-doveriya/index.html', 'specs/006-new-design-rollout/mockup/zapis-md-hero.html', MD, 'Макет T015: /zapis-marketing-doveriya/ — первый экран (spec 006)')
