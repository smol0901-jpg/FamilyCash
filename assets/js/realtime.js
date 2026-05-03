/* ============================================================
   TaskControl Pro — Realtime подписки Supabase
   ============================================================ */

const TC_Realtime = {
  _channels: [],

  subscribeAll() {
    this._setStatus('connecting');

    const tables = ['tasks','task_checkpoints','task_participants','financial_operations','action_log','notifications'];
    tables.forEach(table => {
      const ch = supabase.channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
          this._handle(table, payload);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') this._setStatus('connected');
          if (status === 'CHANNEL_ERROR') this._setStatus('disconnected');
        });
      this._channels.push(ch);
    });
  },

  unsubscribeAll() {
    this._channels.forEach(ch => supabase.removeChannel(ch));
    this._channels = [];
    this._setStatus('disconnected');
  },

  _setStatus(s) {
    TC_State.set('realtimeStatus', s);
    const el = document.getElementById('realtime-indicator');
    if (!el) return;
    el.className = 'w-2 h-2 rounded-full';
    el.classList.add(s);
  },

  _handle(table, payload) {
    const view = TC_State.get('currentView');

    if (table === 'tasks') {
      if (view === 'dashboard') TC_Views.dashboard.refresh();
      if (view === 'tasks')     TC_Views.tasks.refresh();
      if (view === 'control')   TC_Views.control.refresh();
    }
    if (table === 'financial_operations') {
      if (view === 'finance')   TC_Views.finance.refresh();
      if (view === 'dashboard') TC_Views.dashboard.refreshFinance();
    }
    if (table === 'notifications') {
      TC.ui.updateBadges();
    }
    if (table === 'task_checkpoints' || table === 'task_participants') {
      /* Если открыта модалка задачи — обновить */
      TC_Modal.refreshIfOpen();
    }

    /* Toast для изменений от других пользователей */
    const uid = TC_State.get('currentUser')?.id;
    if (payload.new?.updated_by && payload.new.updated_by !== uid) {
      if (table === 'tasks' && payload.eventType === 'UPDATE') {
        TC_Toast.show(`Задача ${payload.new.task_number || ''} обновлена`, 'info', 3000);
      }
    }
  },
};
