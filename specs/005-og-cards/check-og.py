"""Проверка превью ссылок: полный OG/Twitter-набор в <head> каждой страницы + картинка 200, JPEG 1200×630, ≤300 КБ.

Запуск из корня репо: python3 specs/005-og-cards/check-og.py
Поднимает локальный http.server, картинки берёт по пути из og:image (домен отрезается).
"""
import functools, http.server, re, struct, subprocess, sys, threading, urllib.request
from html.parser import HTMLParser
from urllib.parse import urlsplit

SITE = 'https://xn----8sbjhcmhkkgzbpg6a9j.xn--p1ai'
REQ = ['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description', 'og:image',
       'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt',
       'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']
MAX_JPEG = 300 * 1024


class Head(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.done = False; self.dup = []
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == 'meta' and not self.done:
            k = a.get('property') or a.get('name')
            if k and k.startswith(('og:', 'twitter:')):
                if k in self.meta: self.dup.append(k)
                self.meta[k] = a.get('content', '')
    def handle_endtag(self, tag):
        if tag == 'head': self.done = True


def jpeg_size(b):
    i = 2
    while i < len(b):
        if b[i] != 0xFF: return None
        m, ln = b[i + 1], struct.unpack('>H', b[i + 2:i + 4])[0]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', b[i + 5:i + 9]); return w, h
        i += 2 + ln


def check_page(path, base):
    p = Head(); p.feed(open(path, encoding='utf-8').read()); m = p.meta; err = []
    err += [f'нет {k}' for k in REQ if not m.get(k)]
    err += [f'дубль {k}' for k in p.dup]
    if m.get('og:locale') != 'ru_RU': err.append('og:locale не ru_RU')
    if m.get('twitter:card') != 'summary_large_image': err.append('twitter:card не summary_large_image')
    if len(m.get('og:description', '')) > 160: err.append(f"og:description {len(m['og:description'])} > 160")
    for k in ('og:url', 'og:image', 'og:image:secure_url', 'twitter:image'):
        if not m.get(k, '').startswith(SITE + '/'): err.append(f'{k} не абсолютный https-URL сайта')
    if (m.get('og:image:width'), m.get('og:image:height')) != ('1200', '630'): err.append('og:image:width/height не 1200×630')
    if not (m.get('og:image') == m.get('og:image:secure_url') == m.get('twitter:image')): err.append('og:image/secure_url/twitter:image различаются')
    img = m.get('og:image', '')
    if img:
        u = urlsplit(img)
        try:
            r = urllib.request.urlopen(base + u.path + ('?' + u.query if u.query else ''))
            b = r.read()
            if r.status != 200: err.append(f'картинка {r.status}')
            if jpeg_size(b) != (1200, 630): err.append(f'картинка {jpeg_size(b)} вместо 1200×630')
            if len(b) > MAX_JPEG: err.append(f'картинка {len(b)//1024} КБ > 300')
            if m.get('og:image:type') != 'image/jpeg': err.append('og:image:type не image/jpeg')
        except Exception as e:
            err.append(f'картинка не отдаётся: {e}')
    return m, err


def main():
    pages = sorted(f for f in subprocess.check_output(['git', 'ls-files', '*.html'], text=True).split())
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory='.')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_port}'
    bad = 0
    for path in pages:
        m, err = check_page(path, base)
        bad += bool(err)
        print(('OK  ' if not err else 'FAIL'), path, '|', m.get('og:title', '—'), '|', m.get('og:image', '—').rsplit('/', 1)[-1])
        for e in err: print('      -', e)
    srv.shutdown()
    print(f'\nстраниц: {len(pages)}, с ошибками: {bad}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
