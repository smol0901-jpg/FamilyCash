/* ============================================================
   TaskControl Pro — Централизованное хранилище состояния
   ============================================================ */

const TC_State = (() => {
  const _state = {
    /* Аутентификация */
    currentUser: null,     // { id, email, full_name, role }
    session: null,

    /* Навигация */
    currentView: 'dashboard',
    currentSubtab: null,

    /* Кэш данных */
    tasks: [],
    projects: [],
    users: [],
    notifications: [],
    actionLog: [],
    financeOps: [],
    telegramTemplates: [],

    /* UI-флаги */
    realtimeStatus: 'disconnected', // connected | connecting | disconnected
    searchQuery: '',
    sortField: null,
    sortDir: 'asc',

    /* Активные фильтры задач */
    taskFilters: {
      status:   '',
      priority: '',
      search:   '',
    },
  };

  /* Подписчики на изменения */
  const _listeners = {};

  return {
    get(key) {
      return _state[key];
    },

    set(key, value) {
      const prev = _state[key];
      _state[key] = value;
      if (_listeners[key]) {
        _listeners[key].forEach(fn => fn(value, prev));
      }
    },

    /* Подписка на изменение конкретного поля */
    watch(key, fn) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(fn);
      return () => {
        _listeners[key] = _listeners[key].filter(f => f !== fn);
      };
    },

    /* Мутация объекта в state */
    merge(key, partial) {
      this.set(key, { ..._state[key], ...partial });
    },
  };
})();
