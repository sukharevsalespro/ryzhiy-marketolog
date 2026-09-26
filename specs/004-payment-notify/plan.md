# План: уведомление о каждой оплате (Продамус → TG + MAX)

**Спека**: `specs/004-payment-notify/spec.md` | **Дата**: 2026-09-27

## Кратко
Второй entrypoint в том же коде: `yc/lead/pay.py` (handler) импортирует из `yc/lead/index.py` доставку TG/MAX и проверку гейта; подпись и разбор — порт из `/root/clarity-marathon/yc/webhook/index.py`. `deploy.py` деплоит один zip как две функции (`ryzhiy-lead` → `index.handler`, `ryzhiy-pay` → `pay.handler`). На BTC — новый nginx-location. Код Продамусу не нужен, кроме URL и ключа в ЛК.

## Почему так
- Отдельная функция, а не ветка в `ryzhiy-lead`: другой секрет и другой лимит; лид не зависит от вебхука и наоборот.
- Один каталог кода: TG-пиннинг и MAX-фолбэки не копируются (одна правка грабли — сразу в обоих).
- Без хранилища: Продамус повторяет только при не-200; дубль возможен лишь если мы доставили, а ответ потерялся. Защита — in-memory set `order_id` в тёплом инстансе + пометка по полю `attempt`. `ponytail:` потолок — холодный старт/параллельный инстанс; апгрейд — YDB serverless (только если дубли реально появятся).

## Файлы
| Файл | Что |
|---|---|
| `yc/lead/pay.py` | НОВЫЙ. `handler`: гейт → 405/403 → разбор тела (multipart/urlencoded/json, bracket-нотация) → `prodamus_sign` + `compare_digest` → фильтр success → дедуп → `_build_pay_message` (HTML для TG, plain для MAX) → `_send_telegram`/`_send_max` из `index` → 200/502. Лог без ПДн. Лимит тела 64 КБ. |
| `yc/test_pay.py` | НОВЫЙ. Без сети (моки TG/MAX): верная подпись→200+2 отправки; битая/нет→403; без ключа гейта→403; GET→405; повтор order_id→1 отправка; canceled→0 отправок; оба канала упали→502; products из 2 позиций; пустые поля→«—»; фиксированный вектор подписи (эталон посчитан katipa `prodamus_sign`); лог не содержит телефон/почту. |
| `yc/deploy.py` | Таблица функций (имя, entrypoint, env). Для `ryzhiy-pay`: TG_TOKEN, TG_CHAT_ID, MAX_TOKEN, MAX_CHAT_ID, INGRESS_SECRET, PRODAMUS_SECRET (`/root/.secrets/ryzhiy_prodamus.txt`). Запуск `deploy.py pay` / `deploy.py lead` — только по команде. Значения не печатать. |
| `yc/lead/index.py` | Только докстринг «вебхука тут нет» → ссылка на `pay.py`. Логику не трогать. |
| BTC `/etc/nginx/snippets/ryzhiy-public-location.conf` | + `location = /public/ryzhiy-pay`: `limit_except POST`, своя зона `ryzhiy_pay_public` (напр. 30 r/m, burst 20 — вебхуков мало, но повторы пачкой), `client_max_body_size 64k`, `proxy_pass` на функцию `ryzhiy-pay` `?`, include секрета гейта, `proxy_ssl_*` как у лида, без CORS. Зона — в `conf.d/ryzhiy-public-zone.conf`. `nginx -t` перед reload, бэкап файлов. |
| `/root/.secrets/ryzhiy_prodamus.txt` | Ключ из ЛК (600). Кладёт владелец. |
| БЗ `projects/ryzhiy-marketolog.md`, `docs/SECURITY-2026-09-14.md` | Раздел «Оплаты → группа»: схема, где ключ, как тестировать, грабли. |

## Технический контекст
- python312, stdlib-only, как `ryzhiy-lead`. YC SA-ключ `/root/.secrets/yc-sa-key.json`, каталог `b1gca5upee7s5m8bssk8`.
- Заголовок `Sign` nginx проксирует по умолчанию; в event YC — регистронезависимый поиск (`_get_header`). Фолбэк — поле `sign` в теле (как в katipa).
- IP-allowlist Продамуса не ставим: официального списка не нашёл, подпись — достаточная аутентификация.

## Проверка конституции
- Не угадывать: поле «имя» и поведение `demo_mode` на ручных ссылках не подтверждены → смотрим на первом тестовом вебхуке. ✅
- Прод только по «ок»: деплой функции, nginx reload, ввод URL в ЛК — отдельные шаги с аппрувом. ✅
- Фронт не трогаем — дизайн-скилы не нужны. ✅
