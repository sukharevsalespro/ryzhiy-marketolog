"""Переписывает OG/Twitter-блок в <head> всех страниц рыжий-маркетолог.рф (разовый скрипт)."""
import html, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = 'https://xn----8sbjhcmhkkgzbpg6a9j.xn--p1ai'
V = '?v=20260930'
HOME_IMG = ('og-home.jpg' + V, 'Рыжий маркетолог. Валентина Сухарева — наставник по личному бренду, 20+ лет в маркетинге, онлайн.')

P = {
 'index.html': dict(url='/', t='Рыжий маркетолог — Валентина Сухарева',
   d='Наставник по личному бренду и продвижению экспертов. Работает онлайн по всей России, база — Сочи. Опыт в маркетинге более 20 лет.',
   img=HOME_IMG),
 'master-gruppa-lichnyj-brend/index.html': dict(url='/master-gruppa-lichnyj-brend/', t='Личный бренд за 4 недели — мастер-группа',
   d='Мастер-группа до 5 человек, старт 5 октября. Позиционирование, смыслы и контент без выгорания. Онлайн, 12 500 ₽, можно оплатить долями.',
   img=('og-master-gruppa.jpg' + V, 'Личный бренд за 4 недели. Мастер-группа до 5 человек, старт 5 октября, 12 500 ₽. Валентина Сухарева.')),
 'otzyvy/index.html': dict(url='/otzyvy/', t='Отзывы о работе с Валентиной Сухаревой',
   d='15 живых переписок с клиентками: мастермайнды, обучение, консультации, игра «Путь гениальности». Оригинал — под каждым отзывом, без правок.',
   img=('og-otzyvy.jpg' + V, 'Отзывы своими словами: 15 переписок с клиентками. Валентина Сухарева.')),
 'raspakovka-lichnosti/index.html': dict(url='/raspakovka-lichnosti/', t='Распаковка личности эксперта',
   d='Игра «Путь гениальности»: за 2–4 часа находим вашу уникальность и собираем позиционирование в одно предложение. В группе 5 000 ₽, лично 10 000 ₽.',
   img=('og-raspakovka.jpg' + V, 'Распаковка личности. Игра «Путь гениальности», в группе 5 000 ₽, лично 10 000 ₽. Валентина Сухарева.')),
 'razvitie-lichnogo-brenda/index.html': dict(url='/razvitie-lichnogo-brenda/', t='Развитие личного бренда с наставником',
   d='Смыслы, продукт, контент и путь клиента. Консультация 10 000 ₽, мастер-группа 12 500 ₽, сопровождение 30 000 ₽. Онлайн по всей России.',
   img=('og-razvitie.jpg' + V, 'Развитие личного бренда с наставником, онлайн, от 10 000 ₽. Валентина Сухарева.')),
 'networking/index.html': dict(url='/networking/', t='Онлайн-нетворкинг «Полезные знакомства»',
   d='15–20 участников из разных ниш и регионов. 8 октября 10:00–12:00, 10 ноября и 11 декабря 12:00–14:00 МСК, Контур.Толк. Тарифы от 990 ₽.',
   img=('og-networking.jpg' + V, 'Онлайн-нетворкинг «Полезные знакомства»: 8 октября, 10 ноября, 11 декабря, от 990 ₽. Валентина Сухарева говорит по телефону.')),
 'pozicionirovanie/index.html': dict(url='/pozicionirovanie/', type='article', t='Как найти своё позиционирование',
   d='Больше подписчиков и клиентов: статья Валентины Сухаревой о позиционировании, уникальности и отличиях от конкурентов. Вопросы и пример из практики.',
   img=('og-pozicionirovanie.jpg', 'Как найти своё позиционирование. Больше подписчиков и клиентов. Валентина Сухарева.')),
 'zapis-lichnyj-brend/index.html': dict(url='/zapis-lichnyj-brend/', t='Как развить личный бренд — вебинар в записи',
   d='Практический вебинар Валентины Сухаревой: позиционирование, маркетинг доверия и контент без выгорания. Доступ сразу после оплаты, 800 ₽.',
   img=('og-zapis-lichnyj-brend.jpg' + V, 'Как развить личный бренд. Вебинар в записи, доступ сразу, 800 ₽. Валентина Сухарева.')),
 'zapis-marketing-doveriya/index.html': dict(url='/zapis-marketing-doveriya/', t='Маркетинг доверия — вебинар в записи',
   d='Почему у вас не покупают, 9 факторов доверия, деньги в вашей базе и нейросети в контенте. Запись эфира Валентины Сухаревой, доступ после оплаты, 888 ₽.',
   img=('og-marketing-doveriya.jpg?v=20260930b', 'Маркетинг доверия. Вебинар в записи, доступ после оплаты, 888 ₽. Валентина Сухарева.')),
 # /webinar/ — редирект; мессенджеры не исполняют meta refresh/JS, поэтому превью берут отсюда
 'webinar/index.html': dict(url='/zapis-lichnyj-brend/', t='Как развить личный бренд — вебинар в записи',
   d='Практический вебинар Валентины Сухаревой: позиционирование, маркетинг доверия и контент без выгорания. Доступ сразу после оплаты, 800 ₽.',
   img=('og-zapis-lichnyj-brend.jpg' + V, 'Как развить личный бренд. Вебинар в записи, доступ сразу, 800 ₽. Валентина Сухарева.')),
 'rekvizity/index.html': dict(url='/rekvizity/', t='Реквизиты — Рыжий маркетолог',
   d='Реквизиты ИП Сухаревой Валентины Александровны: ИНН 421204839449, ОГРНИП 325420500045757.', img=HOME_IMG),
 'legal/oferta/index.html': dict(url='/legal/oferta/', t='Публичная оферта — Рыжий маркетолог',
   d='Публичная оферта ИП Сухаревой Валентины Александровны. Полный текст действующей редакции от 11 сентября 2026 года.', img=HOME_IMG),
 'legal/privacy/index.html': dict(url='/legal/privacy/', t='Политика обработки персональных данных',
   d='Политика в отношении обработки персональных данных сайта Рыжий маркетолог. Оператор — ИП Сухарева Валентина Александровна.', img=HOME_IMG),
 'legal/soglasie/index.html': dict(url='/legal/soglasie/', t='Согласие на обработку персональных данных',
   d='Согласие на обработку персональных данных при отправке обращения на сайте Рыжий маркетолог.', img=HOME_IMG),
 '404.html': dict(url='/404.html', t='Страница не найдена — Рыжий маркетолог',
   d='Вернитесь на главную сайта Рыжий маркетолог или откройте страницу вебинара.', img=HOME_IMG),
}

OLD = re.compile(r'[ \t]*<meta\b[^>]*\b(?:property|name)="(?:og:|twitter:|vk:)[^"]*"[^>]*>\n?')
CANON = re.compile(r'<link\b[^>]*rel="canonical"[^>]*>\n?')


def nb(s):
    # неразрывные пробелы в суммах: «10 000 ₽» не рвётся в превью
    return re.sub(r'(?<=\d) (?=\d{3}\b|₽)', '\u00a0', s)


def block(p):
    e = lambda s: html.escape(nb(s), quote=True)
    img = f"{SITE}/assets/img/{p['img'][0]}"
    rows = [
        ('property', 'og:type', p.get('type', 'website')),
        ('property', 'og:site_name', 'Рыжий маркетолог'),
        ('property', 'og:locale', 'ru_RU'),
        ('property', 'og:url', SITE + p['url']),
        ('property', 'og:title', p['t']),
        ('property', 'og:description', p['d']),
        ('property', 'og:image', img),
        ('property', 'og:image:secure_url', img),
        ('property', 'og:image:type', 'image/jpeg'),
        ('property', 'og:image:width', '1200'),
        ('property', 'og:image:height', '630'),
        ('property', 'og:image:alt', p['img'][1]),
        ('name', 'twitter:card', 'summary_large_image'),
        ('name', 'twitter:title', p['t']),
        ('name', 'twitter:description', p['d']),
        ('name', 'twitter:image', img),
        ('name', 'twitter:image:alt', p['img'][1]),
    ]
    return ''.join(f'<meta {a}="{k}" content="{e(v)}">\n' for a, k, v in rows)


for rel, p in P.items():
    assert len(p['d']) <= 160, (rel, len(p['d']))
    f = ROOT / rel
    s = f.read_text()
    head, sep, body = s.partition('</head>')
    head = OLD.sub('', head)
    m = CANON.search(head)
    if not m:
        sys.exit(f'{rel}: нет canonical')
    head = head[:m.end()] + ('' if m.group(0).endswith('\n') else '\n') + block(p) + head[m.end():]
    f.write_text(head + sep + body)
    print('ok', rel)
