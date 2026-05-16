# TaskControl Pro (FamilyCash)

Универсальная система управления задачами, проектами и финансами для бизнеса любого масштаба.

---

## Описание

**TaskControl Pro** — бесплатный веб-инструмент для управления рабочими процессами. Подходит для малого, среднего и крупного бизнеса, а также для фрилансеров и партнёров.

Возможности:
- Задачи с назначением ответственных, приоритетами и статусами
- Проекты с бюджетированием и планированием
- Финансовый учёт (доходы и расходы) с привязкой к задачам
- Участники: сотрудники и внешние подрядчики
- Чекпойнты с автоматическим расчётом прогресса
- Telegram-уведомления с настраиваемыми шаблонами
- Журнал действий и история изменений
- Realtime-обновления для всех пользователей

---

## Для кого подходит

- Малый бизнес
- Средний бизнес
- Крупный бизнес (управляющее звено)
- Фрилансеры
- Партнёры и команды

---

## Технологии

- **Frontend**: Vanilla JavaScript (ES6+), Tailwind CSS, Chart.js
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Хостинг**: Netlify

---

## Быстрый старт

### 1. Supabase

1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект
3. В SQL Editor выполните `sql/schema.sql`
4. Скопируйте Project URL и anon key в настройках API

### 2. Настройка приложения

Отредактируйте `assets/js/config.js`:

```javascript
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Первый администратор

1. Supabase → Authentication → Add user
2. В SQL Editor выполните:

```sql
UPDATE profiles
SET role = 'admin', full_name = 'Ваше Имя'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

### 4. Деплой

Загрузите папку на Netlify через drag & drop или подключите GitHub-репозиторий.

---

## Структура базы данных

- `organizations` — организации
- `profiles` — пользователи
- `projects` — проекты
- `tasks` — задачи
- `financial_operations` — финансовые операции
- `task_checkpoints` — чекпойнты
- `task_participants` — участники задач
- `action_log` — журнал действий
- `telegram_templates` — шаблоны уведомлений

---

## Лицензия

MIT