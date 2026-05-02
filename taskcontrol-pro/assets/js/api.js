/* ============================================================
   TaskControl Pro — API-слой (все запросы к Supabase)
   ============================================================ */

const TC_API = {

  /* ── ЗАДАЧИ ────────────────────────────────────────────── */

  async getTasks(filters = {}) {
    let q = supabase
      .from('tasks_full')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status)   q = q.eq('status', filters.status);
    if (filters.priority) q = q.eq('priority', filters.priority);
    if (filters.project_id) q = q.eq('project_id', filters.project_id);
    if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
    if (filters.created_by)  q = q.eq('created_by', filters.created_by);
    if (filters.overdue) {
      q = q.lt('deadline', new Date().toISOString())
           .not('status', 'in', '("completed","cancelled")');
    }
    if (filters.today) {
      const start = new Date(); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      q = q.gte('deadline', start.toISOString()).lte('deadline', end.toISOString());
    }
    if (filters.week) {
      const start = new Date(); start.setHours(0,0,0,0);
      const end   = new Date(start); end.setDate(end.getDate() + 7);
      q = q.gte('deadline', start.toISOString()).lte('deadline', end.toISOString());
    }
    if (filters.search) {
      q = q.or(`title.ilike.%${filters.search}%,task_number.ilike.%${filters.search}%`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getTask(id) {
    const { data, error } = await supabase
      .from('tasks_full')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createTask(payload) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...payload, created_by: TC_State.get('currentUser').id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTask(id, payload) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  /* ── УЧАСТНИКИ ЗАДАЧ ───────────────────────────────────── */

  async getParticipants(taskId) {
    const { data, error } = await supabase
      .from('task_participants')
      .select('*, profiles:user_id(full_name, role)')
      .eq('task_id', taskId)
      .neq('status', 'removed')
      .order('added_at');
    if (error) throw error;
    return data || [];
  },

  async addParticipant(payload) {
    const { data, error } = await supabase
      .from('task_participants')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeParticipant(id) {
    const { error } = await supabase
      .from('task_participants')
      .update({ status: 'removed' })
      .eq('id', id);
    if (error) throw error;
  },

  async updateParticipant(id, payload) {
    const { data, error } = await supabase
      .from('task_participants')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ── ЧЕКПОЙНТЫ ─────────────────────────────────────────── */

  async getCheckpoints(taskId) {
    const { data, error } = await supabase
      .from('task_checkpoints')
      .select('*, profiles:completed_by(full_name)')
      .eq('task_id', taskId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  async addCheckpoint(payload) {
    const { data, error } = await supabase
      .from('task_checkpoints')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleCheckpoint(id, isCompleted) {
    const { data, error } = await supabase
      .from('task_checkpoints')
      .update({
        is_completed: isCompleted,
        completed_by: isCompleted ? TC_State.get('currentUser').id : null,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCheckpoint(id) {
    const { error } = await supabase.from('task_checkpoints').delete().eq('id', id);
    if (error) throw error;
  },

  /* ── ФИНАНСЫ ────────────────────────────────────────────── */

  async getFinanceOps(filters = {}) {
    let q = supabase
      .from('financial_operations')
      .select('*, tasks(task_number, title), profiles:created_by(full_name)')
      .order('op_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.type)    q = q.eq('type', filters.type);
    if (filters.task_id) q = q.eq('task_id', filters.task_id);
    if (filters.dateFrom) q = q.gte('op_date', filters.dateFrom);
    if (filters.dateTo)   q = q.lte('op_date', filters.dateTo);
    if (filters.category) q = q.eq('category', filters.category);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async addFinanceOp(payload) {
    const { data, error } = await supabase
      .from('financial_operations')
      .insert({ ...payload, created_by: TC_State.get('currentUser').id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteFinanceOp(id) {
    const { error } = await supabase.from('financial_operations').delete().eq('id', id);
    if (error) throw error;
  },

  /* ── ЖУРНАЛ ────────────────────────────────────────────── */

  async getLog(filters = {}) {
    let q = supabase
      .from('action_log')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(filters.limit || 200);

    if (filters.task_id)     q = q.eq('task_id', filters.task_id);
    if (filters.task_number) q = q.ilike('task_number', `%${filters.task_number}%`);
    if (filters.user_id)     q = q.eq('user_id', filters.user_id);
    if (filters.action)      q = q.eq('action', filters.action);
    if (filters.dateFrom)    q = q.gte('created_at', filters.dateFrom);
    if (filters.dateTo)      q = q.lte('created_at', filters.dateTo);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async logAction(taskId, taskNumber, action, details = {}, timeSpent = null) {
    try {
      await supabase.from('action_log').insert({
        task_id:     taskId || null,
        task_number: taskNumber || null,
        user_id:     TC_State.get('currentUser')?.id,
        action,
        details,
        time_spent:  timeSpent,
      });
    } catch (e) {
      console.error('[TC] logAction error:', e.message);
    }
  },

  /* ── ПОЛЬЗОВАТЕЛИ ──────────────────────────────────────── */

  async getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  async getWorkload() {
    const { data, error } = await supabase
      .from('people_workload')
      .select('*')
      .order('active_tasks', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateProfile(id, payload) {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ── ПРОЕКТЫ ────────────────────────────────────────────── */

  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, profiles:created_by(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createProject(payload) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...payload, created_by: TC_State.get('currentUser').id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProject(id, payload) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /* ── УВЕДОМЛЕНИЯ ────────────────────────────────────────── */

  async getNotifications() {
    const uid = TC_State.get('currentUser')?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async markNotifRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllNotifsRead() {
    const uid = TC_State.get('currentUser')?.id;
    if (!uid) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', uid)
      .eq('is_read', false);
  },

  /* ── TELEGRAM ────────────────────────────────────────────── */

  async getTelegramTemplates() {
    const uid = TC_State.get('currentUser')?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('telegram_templates')
      .select('*')
      .eq('user_id', uid)
      .order('created_at');
    if (error) throw error;
    return data || [];
  },

  async saveTelegramTemplate(payload) {
    const uid = TC_State.get('currentUser')?.id;
    const obj = { ...payload, user_id: uid };
    let result;
    if (payload.id) {
      const { id, ...rest } = obj;
      result = await supabase.from('telegram_templates').update(rest).eq('id', id).select().single();
    } else {
      result = await supabase.from('telegram_templates').insert(obj).select().single();
    }
    if (result.error) throw result.error;
    return result.data;
  },

  async deleteTelegramTemplate(id) {
    const { error } = await supabase.from('telegram_templates').delete().eq('id', id);
    if (error) throw error;
  },

  async getTelegramHistory() {
    const uid = TC_State.get('currentUser')?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('telegram_history')
      .select('*, tasks(task_number, title), telegram_templates(name)')
      .eq('user_id', uid)
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async logTelegramSend(payload) {
    const uid = TC_State.get('currentUser')?.id;
    const { error } = await supabase
      .from('telegram_history')
      .insert({ ...payload, user_id: uid });
    if (error) console.error('[TC] Telegram log error:', error.message);
  },

  /* ── ДАШБОРД-АГРЕГАТЫ ───────────────────────────────────── */

  async getDashboardMetrics() {
    const uid = TC_State.get('currentUser')?.id;
    if (!uid) return null;

    const now   = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);
    const weekEnd    = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [today, week, overdue, inProgress, finance, workload] = await Promise.all([
      /* Задачи сегодня */
      supabase.from('tasks').select('id, status', { count: 'exact' })
        .gte('deadline', todayStart.toISOString())
        .lte('deadline', todayEnd.toISOString()),

      /* Задачи на неделе */
      supabase.from('tasks').select('id, status', { count: 'exact' })
        .gte('deadline', todayStart.toISOString())
        .lte('deadline', weekEnd.toISOString()),

      /* Просроченные */
      supabase.from('tasks').select('id', { count: 'exact' })
        .lt('deadline', now.toISOString())
        .not('status', 'in', '("completed","cancelled")'),

      /* В работе */
      supabase.from('tasks').select('id', { count: 'exact' })
        .eq('status', 'in_progress'),

      /* Финансы за месяц */
      supabase.from('financial_operations').select('type, amount')
        .gte('op_date', monthStart.toISOString().slice(0,10))
        .lte('op_date', monthEnd.toISOString().slice(0,10)),

      /* Загрузка участников */
      supabase.from('people_workload').select('id, active_tasks, is_active'),
    ]);

    const todayAll  = today.data || [];
    const todayDone = todayAll.filter(t => t.status === 'completed').length;
    const weekAll   = week.data || [];
    const weekDone  = weekAll.filter(t => t.status === 'completed').length;

    const finData   = finance.data || [];
    const income    = finData.filter(f => f.type === 'income').reduce((s,f) => s + +f.amount, 0);
    const expense   = finData.filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);

    const wl         = workload.data || [];
    const wlActive   = wl.filter(u => u.active_tasks > 0).length;
    const wlTotal    = wl.filter(u => u.is_active).length;

    return {
      today:      { done: todayDone, total: today.count || todayAll.length },
      week:       { done: weekDone,  total: week.count  || weekAll.length },
      overdue:    overdue.count || 0,
      inProgress: inProgress.count || 0,
      balance:    income - expense,
      income,
      expense,
      people:     { active: wlActive, total: wlTotal },
    };
  },

  /* Статистика задач по статусам */
  async getTaskStatusStats() {
    const { data, error } = await supabase
      .from('tasks')
      .select('status');
    if (error) throw error;
    const counts = { pending: 0, in_progress: 0, review: 0, completed: 0, cancelled: 0 };
    (data || []).forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
    return counts;
  },

  /* Баланс нарастающим итогом за N дней */
  async getBalanceTrend(days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const { data, error } = await supabase
      .from('financial_operations')
      .select('type, amount, op_date')
      .gte('op_date', from.toISOString().slice(0,10))
      .order('op_date');
    if (error) throw error;

    const byDay = {};
    (data || []).forEach(f => {
      const d = f.op_date;
      if (!byDay[d]) byDay[d] = 0;
      byDay[d] += f.type === 'income' ? +f.amount : -(+f.amount);
    });

    let running = 0;
    const result = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      running += byDay[key] || 0;
      result.push({ date: key, balance: running });
    }
    return result;
  },

  /* Выполнение задач по неделям (8 нед.) */
  async getWeeklyCompletion() {
    const result = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - w * 7); start.setHours(0,0,0,0);
      const end   = new Date(start); end.setDate(end.getDate() + 7);
      const { data } = await supabase
        .from('tasks')
        .select('status')
        .gte('deadline', start.toISOString())
        .lt('deadline', end.toISOString());
      const all  = (data || []).length;
      const done = (data || []).filter(t => t.status === 'completed').length;
      result.push({ label: `Нед. ${8 - w}`, plan: all, fact: done });
    }
    return result;
  },

  /* Финансы по неделям (4 нед.) */
  async getWeeklyFinance() {
    const result = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date(); start.setDate(start.getDate() - w * 7); start.setHours(0,0,0,0);
      const end   = new Date(start); end.setDate(end.getDate() + 7);
      const { data } = await supabase
        .from('financial_operations')
        .select('type, amount')
        .gte('op_date', start.toISOString().slice(0,10))
        .lt('op_date', end.toISOString().slice(0,10));
      const income  = (data || []).filter(f => f.type === 'income').reduce((s,f) => s + +f.amount, 0);
      const expense = (data || []).filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);
      result.push({ label: `Нед. ${4 - w}`, income, expense });
    }
    return result;
  },
};
