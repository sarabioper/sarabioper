# Sarabi Ops

Операционная программа Sarabi Travel: прилёты и вылеты дня из Excel KAPAK, живые статусы рейсов в AYT, машины, экран гида и автопроверка ошибок.

## Как устроено

- `public/index.html` — сама программа (собирается из `src/` командой `npm run build`).
- `netlify/functions/days.mjs` — общее хранилище дня: загруженный список, номера машин, отметки «встретил».
- `netlify/functions/flights.mjs` — отдаёт сохранённые статусы рейсов, квота API не тратится.
- `netlify/functions/poll-flights.mjs` — каждые 10 минут решает, пора ли спросить статусы у API рейсов.

## Настройки в Netlify (Site configuration → Environment variables)

| Имя | Что это | Обязательно |
|---|---|---|
| `OPS_PASSWORD` | Пароль для входа в программу | да |
| `AVIATIONSTACK_KEY` | Ключ Aviationstack | один из двух ключей |
| `AIRLABS_KEY` | Ключ AirLabs | один из двух ключей |
| `AVS_HOURS` | Часы запросов к Aviationstack, по умолчанию `8,13,18` (90 запросов в месяц) | нет |
| `AIRLABS_EVERY_MIN` | Как часто спрашивать AirLabs, по умолчанию `20` минут | нет |

Если заданы оба ключа, основной — AirLabs, а Aviationstack включается, когда AirLabs недоступен.
