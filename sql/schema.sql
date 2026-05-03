-- ============================================================
-- TaskControl Pro — Полная схема базы данных
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- 1. ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin','manager','user','observer')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  telegram_bot_token  TEXT,
  telegram_chat_ids   TEXT,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Автоматически создавать профиль при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2. ПРОЕКТЫ
-- ============================================================
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','completed','archived')),
  budget_planned  NUMERIC(14,2) DEFAULT 0,
  budget_actual   NUMERIC(14,2) DEFAULT 0,
  start_date  DATE,
  end_date    DATE,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. ЗАДАЧИ
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS task_number_seq START 1;

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number     TEXT UNIQUE NOT NULL
                    DEFAULT 'TK-' || LPAD(nextval('task_number_seq')::TEXT, 4, '0'),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','review','completed','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),
  importance      INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  task_type       TEXT NOT NULL DEFAULT 'personal'
                    CHECK (task_type IN ('personal','team','contractor','financial')),
  deadline        TIMESTAMPTZ,
  budget_planned  NUMERIC(14,2) DEFAULT 0,
  budget_actual   NUMERIC(14,2) DEFAULT 0,
  income          NUMERIC(14,2) DEFAULT 0,
  progress        INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  assigned_to     UUID REFERENCES profiles(id),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_tasks_status    ON tasks(status);
CREATE INDEX idx_tasks_priority  ON tasks(priority);
CREATE INDEX idx_tasks_deadline  ON tasks(deadline);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);

-- 4. УЧАСТНИКИ ЗАДАЧ
-- ============================================================
CREATE TABLE task_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- Для внешних подрядчиков (не в системе)
  contractor_name     TEXT,
  contractor_contact  TEXT,
  contractor_rate     NUMERIC(10,2),
  role        TEXT NOT NULL DEFAULT 'executor'
                CHECK (role IN ('executor','reviewer','observer','contractor')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','removed')),
  progress    INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  notes       TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_participant_identity
    CHECK (user_id IS NOT NULL OR contractor_name IS NOT NULL)
);

CREATE INDEX idx_task_participants_task ON task_participants(task_id);
CREATE INDEX idx_task_participants_user ON task_participants(user_id);

-- 5. ЧЕКПОЙНТЫ (промежуточные результаты)
-- ============================================================
CREATE TABLE task_checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER DEFAULT 0,
  deadline      TIMESTAMPTZ,
  completed_by  UUID REFERENCES profiles(id),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkpoints_task ON task_checkpoints(task_id);

-- Автообновление прогресса задачи при изменении чекпойнта
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_count   INTEGER;
  done_count    INTEGER;
  new_progress  INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = true)
  INTO total_count, done_count
  FROM task_checkpoints
  WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);

  IF total_count > 0 THEN
    new_progress := ROUND((done_count::NUMERIC / total_count) * 100);
    UPDATE tasks SET progress = new_progress
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkpoints_update_progress
  AFTER INSERT OR UPDATE OR DELETE ON task_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_task_progress();

-- 6. ФИНАНСОВЫЕ ОПЕРАЦИИ
-- ============================================================
CREATE TABLE financial_operations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  category    TEXT NOT NULL,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  op_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_task    ON financial_operations(task_id);
CREATE INDEX idx_finance_date    ON financial_operations(op_date);
CREATE INDEX idx_finance_type    ON financial_operations(type);

-- Автообновление бюджета задачи
CREATE OR REPLACE FUNCTION sync_task_budget()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_task_id UUID;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  IF v_task_id IS NULL THEN RETURN NEW; END IF;

  UPDATE tasks SET
    budget_actual = COALESCE((
      SELECT SUM(amount) FROM financial_operations
      WHERE task_id = v_task_id AND type = 'expense'
    ), 0),
    income = COALESCE((
      SELECT SUM(amount) FROM financial_operations
      WHERE task_id = v_task_id AND type = 'income'
    ), 0)
  WHERE id = v_task_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_sync_budget
  AFTER INSERT OR UPDATE OR DELETE ON financial_operations
  FOR EACH ROW EXECUTE FUNCTION sync_task_budget();

-- 7. ЖУРНАЛ ДЕЙСТВИЙ
-- ============================================================
CREATE TABLE action_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_number TEXT,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  time_spent  INTERVAL,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_log_task    ON action_log(task_id);
CREATE INDEX idx_log_user    ON action_log(user_id);
CREATE INDEX idx_log_created ON action_log(created_at DESC);
CREATE INDEX idx_log_tnumber ON action_log(task_number);

-- 8. УВЕДОМЛЕНИЯ
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user   ON notifications(user_id, is_read);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- 9. TELEGRAM ШАБЛОНЫ
-- ============================================================
CREATE TABLE telegram_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger_event TEXT NOT NULL
    CHECK (trigger_event IN (
      'status_changed','task_completed','task_overdue',
      'checkpoint_completed','daily_report','finance_added'
    )),
  template    TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ИСТОРИЯ TELEGRAM ОТПРАВКИ
-- ============================================================
CREATE TABLE telegram_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  template_id UUID REFERENCES telegram_templates(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  chat_id     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent','failed','pending')),
  error_msg   TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checkpoints     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_history     ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция: роль текущего пользователя
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES: все видят всех (для отображения имен), изменять только свои
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid() OR current_user_role() = 'admin');
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- PROJECTS: admin/manager CRUD, остальные read-only
CREATE POLICY projects_select ON projects FOR SELECT USING (true);
CREATE POLICY projects_all    ON projects FOR ALL
  USING (current_user_role() IN ('admin','manager'))
  WITH CHECK (current_user_role() IN ('admin','manager'));

-- TASKS: все видят, создают admin/manager/user, обновляют участники
CREATE POLICY tasks_select ON tasks FOR SELECT USING (true);
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (current_user_role() IN ('admin','manager','user'));
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR current_user_role() IN ('admin','manager')
    OR EXISTS (SELECT 1 FROM task_participants WHERE task_id = id AND user_id = auth.uid())
  );
CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (current_user_role() IN ('admin','manager'));

-- TASK_PARTICIPANTS
CREATE POLICY tp_select ON task_participants FOR SELECT USING (true);
CREATE POLICY tp_all    ON task_participants FOR ALL
  USING (current_user_role() IN ('admin','manager','user'))
  WITH CHECK (current_user_role() IN ('admin','manager','user'));

-- TASK_CHECKPOINTS
CREATE POLICY chk_select ON task_checkpoints FOR SELECT USING (true);
CREATE POLICY chk_all    ON task_checkpoints FOR ALL
  USING (current_user_role() IN ('admin','manager','user'))
  WITH CHECK (current_user_role() IN ('admin','manager','user'));

-- FINANCIAL_OPERATIONS
CREATE POLICY fin_select ON financial_operations FOR SELECT USING (true);
CREATE POLICY fin_all    ON financial_operations FOR ALL
  USING (current_user_role() IN ('admin','manager'))
  WITH CHECK (current_user_role() IN ('admin','manager'));

-- ACTION_LOG: все видят (для отчетов), пишет только система
CREATE POLICY log_select ON action_log FOR SELECT USING (true);
CREATE POLICY log_insert ON action_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- NOTIFICATIONS
CREATE POLICY notif_select ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notif_update ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY notif_insert ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- TELEGRAM_TEMPLATES
CREATE POLICY tg_tmpl_all ON telegram_templates FOR ALL USING (user_id = auth.uid());

-- TELEGRAM_HISTORY
CREATE POLICY tg_hist_select ON telegram_history FOR SELECT
  USING (user_id = auth.uid() OR current_user_role() = 'admin');
CREATE POLICY tg_hist_insert ON telegram_history FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- СПРАВОЧНЫЕ ДАННЫЕ (SEED)
-- ============================================================

-- Категории финансовых операций (для фронта)
-- Доходы: 'Оплата клиента', 'Аванс', 'Возврат', 'Прочий доход'
-- Расходы: 'Закупка материалов', 'Услуги подрядчика', 'Зарплата', 'Аренда', 'Оборудование', 'Реклама', 'Прочий расход'

-- ============================================================
-- ПОЛЕЗНЫЕ ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ============================================================

CREATE OR REPLACE VIEW tasks_full AS
SELECT
  t.*,
  p.full_name AS created_by_name,
  a.full_name AS assigned_to_name,
  pr.name     AS project_name,
  (SELECT COUNT(*) FROM task_checkpoints c WHERE c.task_id = t.id)              AS total_checkpoints,
  (SELECT COUNT(*) FROM task_checkpoints c WHERE c.task_id = t.id AND c.is_completed) AS done_checkpoints,
  (SELECT COUNT(*) FROM task_participants tp WHERE tp.task_id = t.id AND tp.status = 'active') AS participant_count
FROM tasks t
LEFT JOIN profiles p  ON p.id = t.created_by
LEFT JOIN profiles a  ON a.id = t.assigned_to
LEFT JOIN projects pr ON pr.id = t.project_id;

-- Финансовая сводка по месяцам
CREATE OR REPLACE VIEW finance_monthly AS
SELECT
  DATE_TRUNC('month', op_date) AS month,
  type,
  SUM(amount) AS total
FROM financial_operations
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Загрузка участников
CREATE OR REPLACE VIEW people_workload AS
SELECT
  p.id,
  p.full_name,
  p.role,
  p.is_active,
  COUNT(tp.id) FILTER (WHERE t.status = 'in_progress') AS active_tasks,
  COUNT(tp.id) FILTER (WHERE t.status NOT IN ('completed','cancelled')) AS total_tasks,
  COALESCE(
    AVG(t.progress) FILTER (WHERE t.status = 'in_progress'), 0
  )::INTEGER AS avg_progress,
  MAX(al.created_at) AS last_activity
FROM profiles p
LEFT JOIN task_participants tp ON tp.user_id = p.id AND tp.status = 'active'
LEFT JOIN tasks t ON t.id = tp.task_id
LEFT JOIN action_log al ON al.user_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.full_name, p.role, p.is_active;

-- ============================================================
-- КОНЕЦ СХЕМЫ
-- После выполнения: Settings → API → скопировать URL и anon key
-- ============================================================
