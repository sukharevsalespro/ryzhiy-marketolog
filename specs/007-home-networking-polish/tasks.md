# Задачи 007

**Вход**: `spec.md`. Браузер — только NVR (`/tmp/f007-*`), сайт отдаётся из скрипта на NVR. Скилы: refero-design, superpowers:brainstorming, frontend-design, ui-ux-pro-max, design-taste-frontend, better-layout/typography/ui/accessibility/writing, copywriting, cro, microinteractions, impeccable, interface-review, break, webapp-testing, superpowers:verification-before-completion.

- [x] **T001** Снимок «до»: главная 390/360/320/1440 × обе темы (координаты H1, подзаголовка, кнопки), секция форматов 1440/390, /networking/ 1440/390.
- [x] **T002** [С1] Карточки «Стратегическая консультация» и «Личное сопровождение» в `index.html` + `formats.css` (половина ширины сетки, на ≤560 во всю ширину), кнопки TG/MAX (`data-msg`, `data-msg-text`, `data-goal="messenger_contacts"`), иконки `reviews/3d-konsult.webp`, `reviews/3d-soprovozhdenie.webp`.
- [x] **T003** [С2] Замер первого экрана; правка только если кнопка вне первого экрана. Итог 03.10: кнопка «Выбрать мероприятие» уже в первом экране (низ кнопки 387/844, 369/740, 372/568 — и в светлой, и в тёмной), правка не делалась.
- [x] **T004** [С3] Отзывы на /networking/ (цитаты дословно + «Оригинал переписки» в `#shot`), стили в `nw-nd.css`.
- [x] **T005** [С3] FAQ на /networking/ разметкой `.nb-faq` главной + JSON-LD `FAQPage`.
- [x] **T006** Приёмка: check-parity, клики TG/MAX/цели, консоль, скролл 320–1440, аудит капса, CMP-кропы до/после в натуральном размере.

**Найдено вне объёма (не правил):** /networking/ на 768 — горизонтальный скролл 809 px от корешка билета `.nw-t-stub` в блоке «Даты» (3 колонки в ~223 px); было и до 007 (тот же замер на `6966dc8`).
