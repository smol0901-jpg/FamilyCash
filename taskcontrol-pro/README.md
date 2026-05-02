# TaskControl Pro v1.0

Система управления задачами, людьми и финансами.
Деплой: Netlify (drag & drop или GitHub). БД: Supabase (PostgreSQL + Realtime).

---

## Быстрый старт

### Шаг 1 — Supabase

1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект (запомните пароль БД)
3. Подождите ~2 минуты пока проект поднимается
4. Перейдите в **SQL Editor** → **New query**
5. Вставьте содержимое файла `sql/schema.sql` и нажмите **RUN**
6. Перейдите в **Settings → API**
7. Скопируйте:
   - **Project URL** → это ваш `SUPABASE_URL`
   - **anon public** → это ваш `SUPABASE_ANON_KEY`

### Шаг 2 — Настройка приложения

Откройте файл `assets/js/config.js` и замените:

```javascript
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';      // → вставьте URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // → вставьте ключ
```

### Шаг 3 — Создать первого пользователя (администратора)

1. В Supabase → **Authentication → Users → Add user**
2. Введите email и пароль
3. В **SQL Editor** выполните:

```sql
UPDATE profiles
SET role = 'admin', full_name = 'Ваше Имя'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

### Шаг 4 — Деплой на Netlify

**Способ А: Drag & Drop (проще)**
1. Зайдите на https://netlify.com
2. Нажмите **Add new site → Deploy manually**
3. Перетащите **всю папку** `taskcontrol-pro` в зону загрузки
4. Готово — получите URL вида `https://xxx.netlify.app`

**Способ Б: Через GitHub (для обновлений)**
1. Создайте репозиторий на GitHub, загрузите папку
2. Netlify → **Add new site → Import from Git**
3. Выберите репозиторий → **Deploy**

### Шаг 5 — Проверка

1. Откройте URL сайта
2. Войдите с email/паролем из Шага 3
3. Создайте первую задачу

---

## Функциональность

| Модуль | Описание |
|--------|----------|
| Дашборд | 6 метрик, 4 диаграммы, загрузка участников |
| Задачи | CRUD, фильтры, сортировка, контекстное меню |
| Участники | Сотрудники + внешние подрядчики в задаче |
| Чекпойнты | Промежуточные результаты с автопрогрессом |
| Финансы | Доходы/расходы с привязкой к задачам |
| Журнал | Полная хронология + отчёт по задаче + печать |
| Telegram | Настройка бота, шаблоны, история отправки |
| Realtime | Мгновенные обновления у всех пользователей |
| Роли | admin / manager / user / observer |

---

## Структура файлов

```
taskcontrol-pro/
├── index.html                  — SPA-оболочка
├── netlify.toml                — конфигурация Netlify
├── sql/
│   └── schema.sql              — полная схема БД (запустить в Supabase)
└── assets/
    ├── css/
    │   └── main.css            — все стили
    └── js/
        ├── config.js           — ключи Supabase
        ├── state.js            — хранилище состояния
        ├── utils.js            — утилиты и форматирование
        ├── api.js              — все запросы к Supabase
        ├── auth.js             — аутентификация
        ├── realtime.js         — Supabase Realtime
        ├── charts.js           — Chart.js диаграммы
        ├── router.js           — SPA-роутер
        ├── search.js           — глобальный поиск
        ├── app.js              — точка входа
        ├── components/
        │   ├── modal.js        — модальные окна
        │   ├── toast.js        — уведомления
        │   └── sidebar.js      — боковая панель
        └── views/
            ├── dashboard.js    — дашборд
            ├── tasks.js        — задачи (главный модуль)
            ├── finance.js      — финансы + люди + контроль + журнал + telegram + настройки + проекты + календарь + уведомления
            └── ...
```

---

## Роли пользователей

| Роль | Создавать задачи | Редактировать | Финансы | Пользователи |
|------|:---:|:---:|:---:|:---:|
| admin    | ✓ | ✓ | ✓ | ✓ |
| manager  | ✓ | ✓ | ✓ | — |
| user     | ✓ | свои | — | — |
| observer | — | — | — | — |

---

## Технический стек

- **Frontend**: Vanilla JS (ES6+), Tailwind CSS, Chart.js, Lucide Icons
- **Шрифты**: Manrope (UI) + JetBrains Mono (данные)
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + RLS)
- **Хостинг**: Netlify (статический, бесплатный тариф)
- **БД**: 10 таблиц, Row Level Security, триггеры автообновления

---

## Поддержка

При проблемах проверьте:
1. Правильно ли вставлены `SUPABASE_URL` и `SUPABASE_ANON_KEY` в `config.js`
2. Выполнен ли `schema.sql` в Supabase SQL Editor без ошибок
3. Включена ли Realtime для таблиц в Supabase → Database → Replication
