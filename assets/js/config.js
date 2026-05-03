/* ============================================================
   TaskControl Pro — Конфигурация
   Замените YOUR_SUPABASE_URL и YOUR_SUPABASE_ANON_KEY
   на реальные значения из Settings → API вашего проекта Supabase
   ============================================================ */

const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const APP_VERSION = '1.0.0';

/* Статусы задач */
const TASK_STATUS = {
  pending:     { label: 'Не начата',    cls: 'pending' },
  in_progress: { label: 'В работе',     cls: 'in_progress' },
  review:      { label: 'На проверке',  cls: 'review' },
  completed:   { label: 'Завершена',    cls: 'completed' },
  cancelled:   { label: 'Отменена',     cls: 'cancelled' },
};

/* Приоритеты задач */
const TASK_PRIORITY = {
  low:      { label: 'Низкий',    cls: 'low' },
  medium:   { label: 'Средний',   cls: 'medium' },
  high:     { label: 'Высокий',   cls: 'high' },
  critical: { label: 'Критичный', cls: 'critical' },
};

/* Типы задач */
const TASK_TYPE = {
  personal:    'Личная',
  team:        'Командная',
  contractor:  'С подрядчиком',
  financial:   'Финансовая',
};

/* Роли пользователей */
const USER_ROLE = {
  admin:    { label: 'Администратор', can: ['all'] },
  manager:  { label: 'Менеджер',      can: ['create','edit','delete','finance'] },
  user:     { label: 'Пользователь',  can: ['create','edit'] },
  observer: { label: 'Наблюдатель',   can: [] },
};

/* Категории финансовых операций */
const FINANCE_CATEGORIES = {
  income: [
    'Оплата клиента', 'Аванс', 'Возврат', 'Прочий доход'
  ],
  expense: [
    'Закупка материалов', 'Услуги подрядчика', 'Зарплата',
    'Аренда', 'Оборудование', 'Реклама', 'Прочий расход'
  ],
};

/* Telegram-триггеры */
const TG_TRIGGERS = {
  status_changed:      'При изменении статуса',
  task_completed:      'При завершении задачи',
  task_overdue:        'При просрочке',
  checkpoint_completed:'При выполнении чекпойнта',
  daily_report:        'Ежедневный отчёт',
  finance_added:       'При добавлении финоперации',
};

/* Типы журнальных событий */
const LOG_ACTIONS = {
  task_created:        'Задача создана',
  task_updated:        'Задача изменена',
  status_changed:      'Статус изменён',
  priority_changed:    'Приоритет изменён',
  deadline_changed:    'Дедлайн изменён',
  participant_added:   'Участник добавлен',
  participant_removed: 'Участник удалён',
  checkpoint_added:    'Чекпойнт добавлен',
  checkpoint_completed:'Чекпойнт выполнен',
  expense_added:       'Расход добавлен',
  income_added:        'Доход добавлен',
  task_completed:      'Задача завершена',
  comment_added:       'Комментарий добавлен',
};

/* Инициализация Supabase */
let supabase;
try {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('[TC] Supabase не настроен. Заполните config.js');
    supabase = null;
  } else {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
} catch (e) {
  console.error('[TC] Ошибка инициализации Supabase:', e);
  supabase = null;
}
