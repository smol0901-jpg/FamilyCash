/* ============================================================
   TaskControl Pro — Финансы
   ============================================================ */

TC_Views = TC_Views || {};

TC_Views.finance = {
  _ops: [],
  _filters: {},

  async render(subtab = 0) {
    const types = [null, 'income', 'expense', null];
    this._filters = {};
    if (types[subtab]) this._filters.type = types[subtab];
    await this._renderShell(subtab);
    await this._load();
  },

  async refresh() { await this._load(); },

  async _renderShell(subtab) {
    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex flex-wrap gap-3 items-end" id="fin-filter-bar">
        <div>
          <label class="tc-label">Дата с</label>
          <input id="fin-date-from" type="date" class="tc-input text-sm" onchange="TC_Views.finance._load()">
        </div>
        <div>
          <label class="tc-label">Дата по</label>
          <input id="fin-date-to" type="date" class="tc-input text-sm" onchange="TC_Views.finance._load()">
        </div>
        <div>
          <label class="tc-label">Категория</label>
          <select id="fin-filter-cat" class="tc-select text-sm" onchange="TC_Views.finance._load()">
            <option value="">Все категории</option>
            ${[...FINANCE_CATEGORIES.income, ...FINANCE_CATEGORIES.expense].map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        ${TC_Auth.isManagerOrAbove() ? `<button class="tc-btn-primary text-sm ml-auto" onclick="TC_Views.finance.openAddModal()">
          <i data-lucide="plus" class="w-4 h-4 mr-1.5"></i>Добавить операцию
        </button>` : '<div class="ml-auto"></div>'}
      </div>

      <div class="tc-table-wrap">
        <table class="tc-table">
          <thead><tr>
            <th>Дата</th><th>Тип</th><th>Категория</th>
            <th>Задача</th><th>Сумма</th><th>Описание</th><th>Кто внёс</th>
            ${TC_Auth.isManagerOrAbove() ? '<th></th>' : ''}
          </tr></thead>
          <tbody id="fin-tbody">
            <tr><td colspan="8"><div class="tc-skeleton h-10 rounded m-2"></div></td></tr>
          </tbody>
        </table>
        <div class="tc-table-footer flex justify-between" id="fin-footer">
          <span>Загрузка...</span>
        </div>
      </div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },

  async _load() {
    const f = { ...this._filters };
    const from = document.getElementById('fin-date-from')?.value;
    const to   = document.getElementById('fin-date-to')?.value;
    const cat  = document.getElementById('fin-filter-cat')?.value;
    if (from) f.dateFrom = from;
    if (to)   f.dateTo   = to;
    if (cat)  f.category = cat;

    try {
      this._ops = await TC_API.getFinanceOps(f);
      this._renderRows();
    } catch (e) {
      TC_Toast.show('Ошибка загрузки финансов: ' + e.message, 'error');
    }
  },

  _renderRows() {
    const tbody  = document.getElementById('fin-tbody');
    const footer = document.getElementById('fin-footer');
    if (!tbody) return;

    if (!this._ops.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="tc-empty">
        <i data-lucide="banknote" class="tc-empty-icon"></i>
        <h3>Нет финансовых операций</h3>
        <p>Добавьте первую операцию, нажав кнопку выше</p>
      </div></td></tr>`;
      lucide.createIcons({ nodes: [tbody] });
      if (footer) footer.innerHTML = '<span>Записей: 0</span>';
      return;
    }

    const income  = this._ops.filter(f => f.type === 'income').reduce((s,f)  => s + +f.amount, 0);
    const expense = this._ops.filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);
    const balance = income - expense;
    const isAdmin = TC_Auth.isManagerOrAbove();

    tbody.innerHTML = this._ops.map(f => `<tr>
      <td class="tc-mono text-xs">${TC_Utils.formatDate(f.op_date)}</td>
      <td>${f.type === 'income'
        ? '<span class="text-success text-xs font-bold">ДОХОД</span>'
        : '<span class="text-danger text-xs font-bold">РАСХОД</span>'}</td>
      <td class="text-xs text-muted">${TC_Utils.esc(f.category)}</td>
      <td>${f.tasks ? `<span class="tc-task-id cursor-pointer hover:underline" onclick="TC_Views.tasks.openTaskModal('${f.task_id}')">${TC_Utils.esc(f.tasks.task_number)}</span>` : '<span class="text-muted text-xs">—</span>'}</td>
      <td class="tc-mono text-sm ${f.type === 'income' ? 'tc-finance-income' : 'tc-finance-expense'}">
        ${f.type === 'income' ? '+' : '−'}${TC_Utils.formatMoney(f.amount, false)} ₽
      </td>
      <td class="text-xs text-muted max-w-xs truncate">${TC_Utils.esc(f.description || '')}</td>
      <td class="text-xs text-muted">${TC_Utils.esc(f.profiles?.full_name || '—')}</td>
      ${isAdmin ? `<td onclick="event.stopPropagation()">
        <button class="tc-icon-btn text-danger" onclick="TC_Views.finance._delete('${f.id}')">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>` : ''}
    </tr>`).join('');

    lucide.createIcons({ nodes: [tbody] });

    if (footer) {
      const balCls = balance >= 0 ? 'text-success' : 'text-danger';
      footer.innerHTML = `
        <span>Записей: ${this._ops.length}</span>
        <span class="flex gap-6">
          <span>Доходы: <span class="tc-mono text-success">+${TC_Utils.formatMoney(income, false)} ₽</span></span>
          <span>Расходы: <span class="tc-mono text-danger">−${TC_Utils.formatMoney(expense, false)} ₽</span></span>
          <span>Сальдо: <span class="tc-mono ${balCls}">${TC_Utils.formatMoney(balance)}</span></span>
        </span>
      `;
    }
  },

  openAddModal() {
    const html = `
      ${TC_Modal.header('Добавить финансовую операцию')}
      <div class="tc-modal-body p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="tc-label">Тип *</label>
            <select id="gfin-type" class="tc-select w-full">
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </div>
          <div>
            <label class="tc-label">Сумма (₽) *</label>
            <input id="gfin-amount" type="number" min="0.01" step="0.01" class="tc-input w-full" placeholder="0">
          </div>
          <div>
            <label class="tc-label">Категория *</label>
            <select id="gfin-category" class="tc-select w-full">
              <optgroup label="Доходы">${FINANCE_CATEGORIES.income.map(c=>`<option value="${c}">${c}</option>`).join('')}</optgroup>
              <optgroup label="Расходы">${FINANCE_CATEGORIES.expense.map(c=>`<option value="${c}">${c}</option>`).join('')}</optgroup>
            </select>
          </div>
          <div>
            <label class="tc-label">Дата *</label>
            <input id="gfin-date" type="date" class="tc-input w-full" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="col-span-2">
            <label class="tc-label">Описание</label>
            <input id="gfin-desc" type="text" class="tc-input w-full" placeholder="Необязательно">
          </div>
        </div>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Отмена</button>
        <button class="tc-btn-primary" id="gfin-submit" onclick="TC_Views.finance._submit()">
          <span>Добавить</span><div class="tc-spinner-sm hidden ml-2"></div>
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '560px' });
  },

  async _submit() {
    const btn    = document.getElementById('gfin-submit');
    const amount = parseFloat(document.getElementById('gfin-amount')?.value);
    const cat    = document.getElementById('gfin-category')?.value;
    if (!amount || amount <= 0) { TC_Toast.show('Введите корректную сумму', 'warning'); return; }
    if (!cat)                   { TC_Toast.show('Выберите категорию', 'warning'); return; }

    TC_Utils.btnLoading(btn, true);
    try {
      await TC_API.addFinanceOp({
        type:        document.getElementById('gfin-type')?.value,
        amount,
        category:    cat,
        op_date:     document.getElementById('gfin-date')?.value,
        description: document.getElementById('gfin-desc')?.value.trim() || null,
      });
      TC_Toast.show('Операция добавлена', 'success');
      TC_Modal.close();
      await this._load();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _delete(id) {
    if (!confirm('Удалить операцию?')) return;
    try {
      await TC_API.deleteFinanceOp(id);
      TC_Toast.show('Операция удалена', 'success');
      await this._load();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },
};

/* ============================================================
   TaskControl Pro — Люди
   ============================================================ */

TC_Views.people = {
  async render(subtab = 0) {
    document.getElementById('main-content').innerHTML = `<div class="p-6"><div class="tc-skeleton h-64 rounded"></div></div>`;
    try {
      const people = await TC_API.getWorkload();
      const isContractor = subtab === 1;
      const filtered = isContractor
        ? people  // В реальном приложении — отдельная таблица подрядчиков
        : people;

      if (!filtered.length) {
        document.getElementById('main-content').innerHTML = `<div class="tc-empty mt-16">
          <i data-lucide="users" class="tc-empty-icon"></i>
          <h3>Нет участников</h3>
          <p>Добавьте пользователей через раздел Настройки</p>
        </div>`;
        lucide.createIcons({ nodes: [document.getElementById('main-content')] });
        return;
      }

      const rows = filtered.map(p => {
        let loadCls, loadLabel;
        if (p.active_tasks <= 2)     { loadCls = 'completed'; loadLabel = 'Нормальная'; }
        else if (p.active_tasks <= 5){ loadCls = 'review';    loadLabel = 'Высокая'; }
        else                          { loadCls = 'cancelled'; loadLabel = 'Перегрузка'; }

        return `<tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="tc-avatar">${TC_Utils.initials(p.full_name)}</div>
              <div>
                <div class="font-medium text-sm">${TC_Utils.esc(p.full_name)}</div>
                <div class="text-muted text-xs">${USER_ROLE[p.role]?.label || p.role}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="tc-status-badge ${p.is_active ? 'completed' : 'cancelled'}">
              ${p.is_active ? 'Активен' : 'Неактивен'}
            </span>
          </td>
          <td class="tc-mono text-sm">${p.active_tasks || 0}</td>
          <td class="tc-mono text-sm">${p.total_tasks || 0}</td>
          <td style="min-width:140px;">
            <div class="flex items-center gap-2">
              ${TC_Utils.progressBar(p.avg_progress || 0)}
              <span class="tc-mono text-xs text-muted">${p.avg_progress || 0}%</span>
            </div>
          </td>
          <td><span class="tc-status-badge ${loadCls}">${loadLabel}</span></td>
          <td class="tc-mono text-xs text-muted">${p.last_activity ? TC_Utils.timeRelative(p.last_activity) : '—'}</td>
        </tr>`;
      }).join('');

      document.getElementById('main-content').innerHTML = `
        <div class="tc-table-wrap">
          <table class="tc-table">
            <thead><tr>
              <th>Участник</th><th>Статус</th><th>Актив. задач</th>
              <th>Всего задач</th><th>Ср. прогресс</th><th>Загрузка</th><th>Посл. активность</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="tc-table-footer">Участников: ${filtered.length}</div>
        </div>
      `;
    } catch (e) {
      TC_Toast.show('Ошибка загрузки людей: ' + e.message, 'error');
    }
  },
};

/* ============================================================
   TaskControl Pro — Контроль
   ============================================================ */

TC_Views.control = {
  async render(subtab = 0) {
    const filters = [
      { overdue: true },
      { status: 'review' },
      { status: 'pending' },
    ];
    const titles = ['Просроченные задачи', 'На проверке', 'Ожидающие запуска'];
    const f = filters[subtab] || filters[0];

    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border">
        <span class="tc-section-title text-danger">${titles[subtab] || titles[0]}</span>
      </div>
      <div id="control-content"><div class="p-6"><div class="tc-skeleton h-48 rounded"></div></div></div>
    `;

    try {
      const tasks = await TC_API.getTasks(f);
      if (!tasks.length) {
        document.getElementById('control-content').innerHTML = `<div class="tc-empty mt-8">
          <i data-lucide="check-circle" class="tc-empty-icon" style="color:var(--success)"></i>
          <h3 style="color:var(--success)">Всё под контролем</h3>
          <p>В этой категории нет задач</p>
        </div>`;
        lucide.createIcons({ nodes: [document.getElementById('control-content')] });
        return;
      }

      const rows = tasks.map(t => {
        const overdue = TC_Utils.isOverdue(t);
        return `<tr onclick="TC_Views.tasks.openTaskModal('${t.id}')">
          <td><span class="tc-task-id">${TC_Utils.esc(t.task_number)}</span></td>
          <td>${TC_Utils.statusBadge(t.status)}</td>
          <td>${TC_Utils.priorityBadge(t.priority)}</td>
          <td class="font-medium text-sm">${TC_Utils.esc(t.title)}</td>
          <td class="tc-mono text-xs ${overdue ? 'text-danger font-bold' : 'text-muted'}">${TC_Utils.formatDateTime(t.deadline)}</td>
          <td class="text-muted text-xs">${TC_Utils.esc(t.created_by_name || '—')}</td>
          <td>
            <div class="flex items-center gap-2">
              ${TC_Utils.progressBar(t.progress || 0, overdue)}
              <span class="tc-mono text-xs text-muted">${t.progress || 0}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');

      document.getElementById('control-content').innerHTML = `
        <div class="tc-table-wrap">
          <table class="tc-table">
            <thead><tr><th>ID</th><th>Статус</th><th>Приоритет</th><th>Название</th><th>Дедлайн</th><th>Создал</th><th>Прогресс</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="tc-table-footer">Задач: ${tasks.length}</div>
        </div>
      `;
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },
  async refresh() { await this.render(TC_State.get('currentSubtab') || 0); },
};

/* ============================================================
   TaskControl Pro — Журнал
   ============================================================ */

TC_Views.journal = {
  _log: [],

  async render(subtab = 0) {
    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex flex-wrap gap-3 items-end">
        <div>
          <label class="tc-label">Дата с</label>
          <input id="log-date-from" type="date" class="tc-input text-sm" onchange="TC_Views.journal._load()">
        </div>
        <div>
          <label class="tc-label">Дата по</label>
          <input id="log-date-to" type="date" class="tc-input text-sm" onchange="TC_Views.journal._load()">
        </div>
        <div>
          <label class="tc-label">ID задачи</label>
          <input id="log-task-num" type="text" class="tc-input text-sm tc-mono" placeholder="TK-0001" oninput="TC_Views.journal._load()">
        </div>
        <div>
          <label class="tc-label">Тип события</label>
          <select id="log-action" class="tc-select text-sm" onchange="TC_Views.journal._load()">
            <option value="">Все события</option>
            ${Object.entries(LOG_ACTIONS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <button class="tc-btn-secondary text-sm ml-auto" onclick="TC_Views.journal._openReport()">
          <i data-lucide="file-text" class="w-4 h-4 mr-1.5"></i>Отчёт по задаче
        </button>
      </div>

      <div id="log-content"><div class="p-6"><div class="tc-skeleton h-48 rounded"></div></div></div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
    await this._load();
  },

  async _load() {
    const f = {};
    const from   = document.getElementById('log-date-from')?.value;
    const to     = document.getElementById('log-date-to')?.value;
    const taskN  = document.getElementById('log-task-num')?.value.trim();
    const action = document.getElementById('log-action')?.value;
    if (from)   f.dateFrom    = from;
    if (to)     f.dateTo      = to;
    if (taskN)  f.task_number = taskN;
    if (action) f.action      = action;

    try {
      this._log = await TC_API.getLog(f);
      this._renderRows();
    } catch (e) {
      TC_Toast.show('Ошибка загрузки журнала: ' + e.message, 'error');
    }
  },

  _renderRows() {
    const el = document.getElementById('log-content');
    if (!el) return;

    if (!this._log.length) {
      el.innerHTML = `<div class="tc-empty mt-8">
        <i data-lucide="scroll-text" class="tc-empty-icon"></i>
        <h3>Записей нет</h3><p>Журнал будет заполняться по мере работы с задачами</p>
      </div>`;
      lucide.createIcons({ nodes: [el] });
      return;
    }

    const rows = this._log.map(l => `<tr>
      <td class="tc-mono text-xs text-muted">${TC_Utils.formatDateTime(l.created_at)}</td>
      <td>
        ${l.task_number ? `<span class="tc-task-id cursor-pointer hover:underline" onclick="TC_Views.tasks.openTaskModal('${l.task_id}')">${TC_Utils.esc(l.task_number)}</span>` : '<span class="text-muted">—</span>'}
      </td>
      <td class="text-sm">${TC_Utils.esc(l.profiles?.full_name || '—')}</td>
      <td class="text-sm">${LOG_ACTIONS[l.action] || TC_Utils.esc(l.action)}</td>
      <td>
        ${l.details && Object.keys(l.details).length
          ? `<details class="cursor-pointer"><summary class="text-xs text-muted hover:text-heading">Детали</summary>
             <pre class="text-xs text-muted mt-1 font-mono bg-bg rounded p-2 max-w-xs overflow-auto">${JSON.stringify(l.details, null, 2)}</pre>
             </details>`
          : ''}
      </td>
    </tr>`).join('');

    el.innerHTML = `
      <div class="tc-table-wrap">
        <table class="tc-table">
          <thead><tr><th>Время</th><th>ID задачи</th><th>Пользователь</th><th>Событие</th><th>Детали</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tc-table-footer">Записей: ${this._log.length}</div>
      </div>
    `;
  },

  _openReport() {
    const html = `
      ${TC_Modal.header('Отчёт по задаче')}
      <div class="tc-modal-body p-6 space-y-4">
        <div>
          <label class="tc-label">ID задачи</label>
          <input id="report-task-num" type="text" class="tc-input w-full tc-mono" placeholder="TK-0001">
        </div>
        <div id="report-content"></div>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Закрыть</button>
        <button class="tc-btn-primary" onclick="TC_Views.journal._generateReport()">
          <i data-lucide="search" class="w-4 h-4 mr-1.5"></i>Сформировать
        </button>
        <button class="tc-btn-secondary no-print" onclick="window.print()">
          <i data-lucide="printer" class="w-4 h-4 mr-1.5"></i>Печать
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '700px' });
  },

  async _generateReport() {
    const num = document.getElementById('report-task-num')?.value.trim().toUpperCase();
    if (!num) { TC_Toast.show('Введите ID задачи', 'warning'); return; }

    const el = document.getElementById('report-content');
    if (!el) return;
    el.innerHTML = `<div class="flex justify-center py-8"><div class="tc-spinner"></div></div>`;

    try {
      const { data: tasks } = await supabase.from('tasks_full').select('*').ilike('task_number', num);
      if (!tasks?.length) {
        el.innerHTML = `<div class="text-danger text-sm">Задача ${num} не найдена</div>`;
        return;
      }
      const task = tasks[0];

      const [parts, checks, finOps, log] = await Promise.all([
        TC_API.getParticipants(task.id),
        TC_API.getCheckpoints(task.id),
        TC_API.getFinanceOps({ task_id: task.id }),
        TC_API.getLog({ task_id: task.id }),
      ]);

      const income  = finOps.filter(f => f.type === 'income').reduce((s,f) => s + +f.amount, 0);
      const expense = finOps.filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);
      const done    = checks.filter(c => c.is_completed).length;

      el.innerHTML = `
        <div class="space-y-4 text-sm">
          <div class="p-4 bg-bg border border-border rounded">
            <div class="font-bold text-base mb-2">${TC_Utils.esc(task.title)} <span class="tc-task-id">${task.task_number}</span></div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-muted">Статус:</span> ${TC_Utils.statusBadge(task.status)}</div>
              <div><span class="text-muted">Приоритет:</span> ${TC_Utils.priorityBadge(task.priority)}</div>
              <div><span class="text-muted">Дедлайн:</span> <span class="tc-mono">${TC_Utils.formatDateTime(task.deadline)}</span></div>
              <div><span class="text-muted">Прогресс:</span> <span class="tc-mono">${task.progress || 0}%</span></div>
            </div>
          </div>
          <div><div class="tc-section-title mb-2">Участники (${parts.length})</div>
            ${parts.map(p => `<div class="flex items-center gap-2 py-1 border-b border-border">
              <div class="tc-avatar">${TC_Utils.initials(p.profiles?.full_name || p.contractor_name || '?')}</div>
              <span class="text-sm">${TC_Utils.esc(p.profiles?.full_name || p.contractor_name || '—')}</span>
              <span class="text-muted text-xs ml-auto">${p.role}</span>
            </div>`).join('') || '<div class="text-muted text-xs">Нет участников</div>'}
          </div>
          <div><div class="tc-section-title mb-2">Чекпойнты (${done}/${checks.length})</div>
            ${checks.map(c => `<div class="flex items-center gap-2 py-1 text-xs">
              <span class="${c.is_completed ? 'text-success' : 'text-muted'}">${c.is_completed ? '✓' : '○'}</span>
              <span class="${c.is_completed ? 'line-through text-muted' : ''}">${TC_Utils.esc(c.title)}</span>
            </div>`).join('') || '<div class="text-muted text-xs">Нет чекпойнтов</div>'}
          </div>
          <div><div class="tc-section-title mb-2">Финансы</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-bg border border-border rounded p-3 text-center">
                <div class="tc-label">Бюджет</div>
                <div class="tc-mono text-sm">${TC_Utils.formatMoney(task.budget_planned, false)} ₽</div>
              </div>
              <div class="bg-bg border border-border rounded p-3 text-center">
                <div class="tc-label">Расходы</div>
                <div class="tc-mono text-sm text-danger">−${TC_Utils.formatMoney(expense, false)} ₽</div>
              </div>
              <div class="bg-bg border border-border rounded p-3 text-center">
                <div class="tc-label">Доходы</div>
                <div class="tc-mono text-sm text-success">+${TC_Utils.formatMoney(income, false)} ₽</div>
              </div>
            </div>
          </div>
          <div><div class="tc-section-title mb-2">Журнал событий (${log.length})</div>
            <div class="max-h-48 overflow-y-auto space-y-1">
              ${log.map(l => `<div class="flex gap-3 py-1.5 border-b border-border text-xs">
                <span class="tc-mono text-muted flex-shrink-0">${TC_Utils.formatDateTime(l.created_at)}</span>
                <span class="text-muted flex-shrink-0">${TC_Utils.esc(l.profiles?.full_name || '—')}</span>
                <span>${LOG_ACTIONS[l.action] || l.action}</span>
              </div>`).join('') || '<div class="text-muted text-xs">Журнал пуст</div>'}
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<div class="text-danger text-sm">Ошибка: ${TC_Utils.esc(e.message)}</div>`;
    }
  },
};

/* ============================================================
   TaskControl Pro — Отчёты
   ============================================================ */

TC_Views.reports = {
  async render(subtab = 0) {
    document.getElementById('main-content').innerHTML = `
      <div class="p-8 flex flex-col items-center gap-4">
        <i data-lucide="bar-chart-3" style="width:48px;height:48px;color:#2D3F5A;"></i>
        <h3 class="text-muted font-semibold">Раздел в разработке</h3>
        <p class="text-muted text-sm text-center max-w-xs">Подробные отчёты по задачам, людям и финансам появятся в следующей версии.<br>Пока используйте Журнал для детальной аналитики.</p>
        <button class="tc-btn-secondary text-sm" onclick="TC.router.navigate('journal')">
          <i data-lucide="scroll-text" class="w-4 h-4 mr-1.5"></i>Перейти в Журнал
        </button>
      </div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },
};

/* ============================================================
   TaskControl Pro — Telegram
   ============================================================ */

TC_Views.telegram = {
  async render(subtab = 0) {
    if (subtab === 0) await this._renderSettings();
    else if (subtab === 1) await this._renderTemplates();
    else await this._renderHistory();
  },

  async _renderSettings() {
    const user = TC_State.get('currentUser');
    document.getElementById('main-content').innerHTML = `
      <div class="p-6 max-w-xl space-y-6">
        <div class="tc-panel p-6 space-y-4">
          <div class="tc-section-title">Настройки Telegram-бота</div>
          <div>
            <label class="tc-label">Токен бота</label>
            <input id="tg-token" type="text" class="tc-input w-full tc-mono text-sm" placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ" value="${TC_Utils.esc(user?.telegram_bot_token || '')}">
            <p class="text-muted text-xs mt-1">Получить у @BotFather в Telegram</p>
          </div>
          <div>
            <label class="tc-label">ID чата / группы</label>
            <input id="tg-chats" type="text" class="tc-input w-full tc-mono text-sm" placeholder="-1001234567890, 987654321" value="${TC_Utils.esc(user?.telegram_chat_ids || '')}">
            <p class="text-muted text-xs mt-1">Несколько ID через запятую. Для групп: отрицательное число</p>
          </div>
          <div class="flex gap-3">
            <button class="tc-btn-primary text-sm" id="tg-save-btn" onclick="TC_Views.telegram._save()">
              <span>Сохранить</span><div class="tc-spinner-sm hidden ml-2"></div>
            </button>
            <button class="tc-btn-secondary text-sm" id="tg-test-btn" onclick="TC_Views.telegram._test()">
              <span>Тест подключения</span><div class="tc-spinner-sm hidden ml-2"></div>
            </button>
          </div>
          <div id="tg-test-result"></div>
        </div>

        <div class="tc-panel p-6">
          <div class="tc-section-title mb-3">Переменные в шаблонах</div>
          <div class="space-y-1 text-xs font-mono">
            ${[
              ['{task_number}', 'ID задачи (TK-0001)'],
              ['{title}',       'Название задачи'],
              ['{status}',      'Статус'],
              ['{priority}',    'Приоритет'],
              ['{deadline}',    'Дедлайн'],
              ['{progress}',    'Прогресс (%)'],
              ['{assigned_to}', 'Ответственный'],
              ['{created_by}',  'Создал'],
            ].map(([k,d]) => `<div class="flex gap-3 py-1 border-b border-border">
              <span class="text-accent w-32 flex-shrink-0">${k}</span>
              <span class="text-muted">${d}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async _save() {
    const btn   = document.getElementById('tg-save-btn');
    const token = document.getElementById('tg-token')?.value.trim();
    const chats = document.getElementById('tg-chats')?.value.trim();
    TC_Utils.btnLoading(btn, true);
    try {
      const uid = TC_State.get('currentUser')?.id;
      await TC_API.updateProfile(uid, { telegram_bot_token: token, telegram_chat_ids: chats });
      TC_State.merge('currentUser', { telegram_bot_token: token, telegram_chat_ids: chats });
      TC_Toast.show('Настройки Telegram сохранены', 'success');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _test() {
    const btn   = document.getElementById('tg-test-btn');
    const token = document.getElementById('tg-token')?.value.trim();
    const chats = document.getElementById('tg-chats')?.value.trim();
    const resEl = document.getElementById('tg-test-result');

    if (!token || !chats) {
      TC_Toast.show('Заполните токен и ID чата', 'warning');
      return;
    }

    TC_Utils.btnLoading(btn, true);
    if (resEl) resEl.innerHTML = '';

    try {
      const chatId = chats.split(',')[0].trim();
      const url    = `https://api.telegram.org/bot${token}/sendMessage`;
      const resp   = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '✅ TaskControl Pro: подключение работает!' }),
      });
      const data = await resp.json();
      if (data.ok) {
        if (resEl) resEl.innerHTML = `<div class="mt-3 p-3 bg-green-950 border border-green-800 text-green-400 rounded text-sm">Сообщение отправлено успешно</div>`;
        await TC_API.logTelegramSend({ message: 'Тест подключения', chat_id: chatId, status: 'sent' });
      } else {
        throw new Error(data.description || 'Ошибка Telegram API');
      }
    } catch (e) {
      if (resEl) resEl.innerHTML = `<div class="mt-3 p-3 bg-red-950 border border-red-800 text-red-400 rounded text-sm">Ошибка: ${TC_Utils.esc(e.message)}</div>`;
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _renderTemplates() {
    const templates = await TC_API.getTelegramTemplates();
    const rows = templates.map(t => `<tr>
      <td class="font-medium text-sm">${TC_Utils.esc(t.name)}</td>
      <td class="text-muted text-xs">${TG_TRIGGERS[t.trigger_event] || t.trigger_event}</td>
      <td class="text-xs text-muted tc-mono max-w-xs truncate">${TC_Utils.esc(t.template)}</td>
      <td>
        <span class="tc-status-badge ${t.is_active ? 'completed' : 'cancelled'} text-xs">${t.is_active ? 'Активен' : 'Выкл'}</span>
      </td>
      <td onclick="event.stopPropagation()" class="flex gap-1 items-center">
        <button class="tc-icon-btn" onclick="TC_Views.telegram._editTemplate(${JSON.stringify(t).replace(/"/g,'&quot;')})">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button class="tc-icon-btn text-danger" onclick="TC_Views.telegram._deleteTemplate('${t.id}')">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>`).join('');

    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex justify-end">
        <button class="tc-btn-primary text-sm" onclick="TC_Views.telegram._editTemplate(null)">
          <i data-lucide="plus" class="w-4 h-4 mr-1.5"></i>Создать шаблон
        </button>
      </div>
      ${templates.length ? `<div class="tc-table-wrap"><table class="tc-table">
        <thead><tr><th>Название</th><th>Триггер</th><th>Шаблон</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : `<div class="tc-empty mt-8">
        <i data-lucide="send" class="tc-empty-icon"></i>
        <h3>Нет шаблонов</h3>
        <p>Создайте шаблон для автоотправки уведомлений в Telegram</p>
      </div>`}
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },

  _editTemplate(tmpl) {
    const isEdit = !!tmpl;
    const v = k => tmpl ? TC_Utils.esc(tmpl[k] || '') : '';
    const html = `
      ${TC_Modal.header(isEdit ? 'Редактировать шаблон' : 'Создать шаблон')}
      <div class="tc-modal-body p-6 space-y-4">
        <div><label class="tc-label">Название *</label>
          <input id="tmpl-name" type="text" class="tc-input w-full" value="${v('name')}" placeholder="Задача просрочена"></div>
        <div><label class="tc-label">Триггер *</label>
          <select id="tmpl-trigger" class="tc-select w-full">
            ${Object.entries(TG_TRIGGERS).map(([k,l]) => `<option value="${k}" ${tmpl?.trigger_event===k?'selected':''}>${l}</option>`).join('')}
          </select></div>
        <div><label class="tc-label">Текст сообщения *</label>
          <textarea id="tmpl-text" class="tc-textarea w-full" rows="5" placeholder="Задача {task_number}: {title}\nСтатус: {status}\nДедлайн: {deadline}">${v('template')}</textarea></div>
        <div class="flex items-center gap-3">
          <input id="tmpl-active" type="checkbox" class="w-4 h-4" ${!isEdit || tmpl?.is_active ? 'checked' : ''}>
          <label class="text-sm text-muted">Активен</label>
        </div>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Отмена</button>
        <button class="tc-btn-primary" onclick="TC_Views.telegram._saveTemplate(${isEdit ? `'${tmpl.id}'` : 'null'})">
          <span>${isEdit ? 'Сохранить' : 'Создать'}</span><div class="tc-spinner-sm hidden ml-2"></div>
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '560px' });
  },

  async _saveTemplate(id) {
    const name    = document.getElementById('tmpl-name')?.value.trim();
    const trigger = document.getElementById('tmpl-trigger')?.value;
    const text    = document.getElementById('tmpl-text')?.value.trim();
    const active  = document.getElementById('tmpl-active')?.checked;
    if (!name || !text) { TC_Toast.show('Заполните название и текст', 'warning'); return; }
    try {
      await TC_API.saveTelegramTemplate({ id: id || undefined, name, trigger_event: trigger, template: text, is_active: active });
      TC_Toast.show('Шаблон сохранён', 'success');
      TC_Modal.close();
      await this._renderTemplates();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _deleteTemplate(id) {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await TC_API.deleteTelegramTemplate(id);
      TC_Toast.show('Шаблон удалён', 'success');
      await this._renderTemplates();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _renderHistory() {
    const history = await TC_API.getTelegramHistory();
    const rows = history.map(h => `<tr>
      <td class="tc-mono text-xs text-muted">${TC_Utils.formatDateTime(h.sent_at)}</td>
      <td>${h.tasks ? `<span class="tc-task-id">${TC_Utils.esc(h.tasks.task_number)}</span>` : '—'}</td>
      <td class="text-xs text-muted">${TC_Utils.esc(h.telegram_templates?.name || '—')}</td>
      <td class="text-xs text-muted tc-mono">${TC_Utils.esc(h.chat_id)}</td>
      <td><span class="tc-tg-status-${h.status} text-xs font-bold uppercase">${h.status}</span></td>
      ${h.error_msg ? `<td class="text-xs text-danger">${TC_Utils.esc(h.error_msg)}</td>` : '<td></td>'}
    </tr>`).join('');

    document.getElementById('main-content').innerHTML = history.length
      ? `<div class="tc-table-wrap"><table class="tc-table">
          <thead><tr><th>Время</th><th>Задача</th><th>Шаблон</th><th>Чат</th><th>Статус</th><th>Ошибка</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tc-table-footer">Записей: ${history.length}</div>
        </div>`
      : `<div class="tc-empty mt-8"><i data-lucide="send" class="tc-empty-icon"></i><h3>История пуста</h3></div>`;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },
};

/* ============================================================
   TaskControl Pro — Настройки
   ============================================================ */

TC_Views.settings = {
  async render(subtab = 0) {
    if (subtab === 0) await this._renderProfile();
    else if (subtab === 1) await this._renderUsers();
    else await this._renderSystem();
  },

  async _renderProfile() {
    const user = TC_State.get('currentUser');
    document.getElementById('main-content').innerHTML = `
      <div class="p-6 max-w-md space-y-6">
        <div class="tc-panel p-6 space-y-4">
          <div class="tc-section-title">Профиль</div>
          <div class="flex items-center gap-4 mb-4">
            <div class="tc-avatar" style="width:48px;height:48px;font-size:18px;">${TC_Utils.initials(user?.full_name || '?')}</div>
            <div>
              <div class="font-semibold">${TC_Utils.esc(user?.full_name || '')}</div>
              <div class="text-muted text-xs">${USER_ROLE[user?.role]?.label || user?.role}</div>
            </div>
          </div>
          <div><label class="tc-label">Полное имя</label>
            <input id="prof-name" type="text" class="tc-input w-full" value="${TC_Utils.esc(user?.full_name || '')}"></div>
          <button class="tc-btn-primary text-sm" id="prof-save-btn" onclick="TC_Views.settings._saveProfile()">
            <span>Сохранить</span><div class="tc-spinner-sm hidden ml-2"></div>
          </button>
        </div>
        <div class="tc-panel p-6 space-y-4">
          <div class="tc-section-title">Изменить пароль</div>
          <div><label class="tc-label">Новый пароль</label>
            <input id="prof-pass" type="password" class="tc-input w-full" placeholder="Минимум 8 символов"></div>
          <button class="tc-btn-secondary text-sm" id="prof-pass-btn" onclick="TC_Views.settings._changePassword()">
            <span>Изменить пароль</span><div class="tc-spinner-sm hidden ml-2"></div>
          </button>
        </div>
      </div>
    `;
  },

  async _saveProfile() {
    const btn  = document.getElementById('prof-save-btn');
    const name = document.getElementById('prof-name')?.value.trim();
    if (!name) { TC_Toast.show('Введите имя', 'warning'); return; }
    TC_Utils.btnLoading(btn, true);
    try {
      const uid  = TC_State.get('currentUser')?.id;
      await TC_API.updateProfile(uid, { full_name: name });
      TC_State.merge('currentUser', { full_name: name });
      TC.ui.renderUser();
      TC_Toast.show('Профиль обновлён', 'success');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _changePassword() {
    const btn  = document.getElementById('prof-pass-btn');
    const pass = document.getElementById('prof-pass')?.value;
    if (!pass || pass.length < 8) { TC_Toast.show('Пароль минимум 8 символов', 'warning'); return; }
    TC_Utils.btnLoading(btn, true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      TC_Toast.show('Пароль изменён', 'success');
      document.getElementById('prof-pass').value = '';
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _renderUsers() {
    if (!TC_Auth.isAdmin()) {
      document.getElementById('main-content').innerHTML = `<div class="tc-empty mt-16">
        <i data-lucide="lock" class="tc-empty-icon"></i>
        <h3>Доступ запрещён</h3><p>Только администратор может управлять пользователями</p>
      </div>`;
      lucide.createIcons({ nodes: [document.getElementById('main-content')] });
      return;
    }

    const users = await TC_API.getUsers();
    const rows = users.map(u => `<tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="tc-avatar">${TC_Utils.initials(u.full_name)}</div>
          <div>
            <div class="font-medium text-sm">${TC_Utils.esc(u.full_name)}</div>
            <div class="text-muted text-xs tc-mono">${TC_Utils.esc(u.id.slice(0,8))}…</div>
          </div>
        </div>
      </td>
      <td class="text-sm text-muted">${USER_ROLE[u.role]?.label || u.role}</td>
      <td><span class="tc-status-badge ${u.is_active ? 'completed' : 'cancelled'}">${u.is_active ? 'Активен' : 'Отключён'}</span></td>
      <td class="tc-mono text-xs text-muted">${TC_Utils.formatDate(u.created_at)}</td>
      <td onclick="event.stopPropagation()">
        <button class="tc-icon-btn" onclick="TC_Views.settings._toggleUser('${u.id}', ${!u.is_active})" title="${u.is_active ? 'Деактивировать' : 'Активировать'}">
          <i data-lucide="${u.is_active ? 'user-x' : 'user-check'}" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>`).join('');

    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex justify-end">
        <button class="tc-btn-primary text-sm" onclick="TC_Views.settings._inviteUser()">
          <i data-lucide="user-plus" class="w-4 h-4 mr-1.5"></i>Пригласить пользователя
        </button>
      </div>
      <div class="tc-table-wrap">
        <table class="tc-table">
          <thead><tr><th>Пользователь</th><th>Роль</th><th>Статус</th><th>Дата создания</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tc-table-footer">Пользователей: ${users.length}</div>
      </div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },

  _inviteUser() {
    const html = `
      ${TC_Modal.header('Пригласить пользователя')}
      <div class="tc-modal-body p-6 space-y-4">
        <div><label class="tc-label">Email *</label>
          <input id="inv-email" type="email" class="tc-input w-full" placeholder="user@company.com"></div>
        <div><label class="tc-label">Полное имя *</label>
          <input id="inv-name" type="text" class="tc-input w-full" placeholder="Иванов Иван Иванович"></div>
        <div><label class="tc-label">Роль</label>
          <select id="inv-role" class="tc-select w-full">
            ${Object.entries(USER_ROLE).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select></div>
        <p class="text-muted text-xs">Пользователь получит письмо для установки пароля</p>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Отмена</button>
        <button class="tc-btn-primary" id="inv-submit" onclick="TC_Views.settings._sendInvite()">
          <span>Отправить приглашение</span><div class="tc-spinner-sm hidden ml-2"></div>
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '480px' });
  },

  async _sendInvite() {
    const btn   = document.getElementById('inv-submit');
    const email = document.getElementById('inv-email')?.value.trim();
    const name  = document.getElementById('inv-name')?.value.trim();
    const role  = document.getElementById('inv-role')?.value;
    if (!email || !name) { TC_Toast.show('Заполните email и имя', 'warning'); return; }
    TC_Utils.btnLoading(btn, true);
    try {
      const { data, error } = await supabase.auth.admin
        ? supabase.auth.admin.inviteUserByEmail(email, { data: { full_name: name, role } })
        : supabase.auth.signUp({ email, password: TC_Utils.uuid().slice(0,12), options: { data: { full_name: name, role } } });
      if (error) throw error;
      TC_Toast.show(`Приглашение отправлено на ${email}`, 'success');
      TC_Modal.close();
      await this._renderUsers();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async _toggleUser(id, isActive) {
    try {
      await TC_API.updateProfile(id, { is_active: isActive });
      TC_Toast.show(`Пользователь ${isActive ? 'активирован' : 'деактивирован'}`, 'success');
      await this._renderUsers();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _renderSystem() {
    const realtimeStatus = TC_State.get('realtimeStatus');
    document.getElementById('main-content').innerHTML = `
      <div class="p-6 max-w-md space-y-4">
        <div class="tc-panel p-6 space-y-3">
          <div class="tc-section-title">Состояние системы</div>
          <div class="flex items-center justify-between py-2 border-b border-border">
            <span class="text-sm text-muted">Версия приложения</span>
            <span class="tc-mono text-sm">${APP_VERSION}</span>
          </div>
          <div class="flex items-center justify-between py-2 border-b border-border">
            <span class="text-sm text-muted">Realtime</span>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-success' : 'bg-danger'}"></div>
              <span class="text-sm">${realtimeStatus === 'connected' ? 'Подключено' : 'Отключено'}</span>
            </div>
          </div>
          <div class="flex items-center justify-between py-2 border-b border-border">
            <span class="text-sm text-muted">Supabase URL</span>
            <span class="tc-mono text-xs text-muted truncate max-w-48">${SUPABASE_URL !== 'YOUR_SUPABASE_URL' ? SUPABASE_URL.replace(/https?:\/\//, '').slice(0,30) + '…' : 'Не настроен'}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm text-muted">Пользователь</span>
            <span class="tc-mono text-xs text-muted">${TC_State.get('currentUser')?.id?.slice(0,8)}…</span>
          </div>
        </div>
      </div>
    `;
  },
};

/* ============================================================
   TaskControl Pro — Проекты (упрощённая версия)
   ============================================================ */

TC_Views.projects = {
  async render(subtab = 0) {
    const statusMap = [null, 'completed', 'archived'];
    const f = statusMap[subtab] ? { status: statusMap[subtab] } : {};

    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex justify-end">
        ${TC_Auth.isManagerOrAbove() ? `<button class="tc-btn-primary text-sm" onclick="TC_Views.projects._create()">
          <i data-lucide="plus" class="w-4 h-4 mr-1.5"></i>Создать проект
        </button>` : ''}
      </div>
      <div id="projects-content"><div class="p-6"><div class="tc-skeleton h-48 rounded"></div></div></div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });

    try {
      const { data: projects } = await supabase.from('projects')
        .select('*, profiles:created_by(full_name)')
        .order('created_at', { ascending: false });

      const list = (projects || []).filter(p => !statusMap[subtab] || p.status === statusMap[subtab]);

      const el = document.getElementById('projects-content');
      if (!list.length) {
        el.innerHTML = `<div class="tc-empty mt-8">
          <i data-lucide="folders" class="tc-empty-icon"></i>
          <h3>Проектов нет</h3><p>Создайте первый проект для группировки задач</p>
        </div>`;
        lucide.createIcons({ nodes: [el] });
        return;
      }

      const rows = list.map(p => `<tr onclick="TC.router.navigate('tasks')">
        <td class="font-medium text-sm">${TC_Utils.esc(p.name)}</td>
        <td>${TC_Utils.statusBadge(p.status)}</td>
        <td class="text-muted text-xs">${TC_Utils.esc(p.profiles?.full_name || '—')}</td>
        <td class="tc-mono text-sm">${TC_Utils.formatMoney(p.budget_planned, false)} ₽</td>
        <td class="tc-mono text-xs text-muted">${TC_Utils.formatDate(p.start_date)} — ${TC_Utils.formatDate(p.end_date)}</td>
        <td class="tc-mono text-xs text-muted">${TC_Utils.formatDate(p.created_at)}</td>
      </tr>`).join('');

      el.innerHTML = `<div class="tc-table-wrap"><table class="tc-table">
        <thead><tr><th>Название</th><th>Статус</th><th>Создал</th><th>Бюджет</th><th>Даты</th><th>Создан</th></tr></thead>
        <tbody>${rows}</tbody>
      </table><div class="tc-table-footer">Проектов: ${list.length}</div></div>`;
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  _create() {
    const html = `
      ${TC_Modal.header('Создать проект')}
      <div class="tc-modal-body p-6 space-y-4">
        <div><label class="tc-label">Название *</label>
          <input id="proj-name" type="text" class="tc-input w-full" placeholder="Название проекта"></div>
        <div><label class="tc-label">Описание</label>
          <textarea id="proj-desc" class="tc-textarea w-full"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="tc-label">Дата начала</label>
            <input id="proj-start" type="date" class="tc-input w-full"></div>
          <div><label class="tc-label">Дата окончания</label>
            <input id="proj-end" type="date" class="tc-input w-full"></div>
          <div><label class="tc-label">Плановый бюджет (₽)</label>
            <input id="proj-budget" type="number" min="0" class="tc-input w-full" placeholder="0"></div>
        </div>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Отмена</button>
        <button class="tc-btn-primary" id="proj-submit" onclick="TC_Views.projects._save()">
          <span>Создать</span><div class="tc-spinner-sm hidden ml-2"></div>
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '560px' });
  },

  async _save() {
    const btn  = document.getElementById('proj-submit');
    const name = document.getElementById('proj-name')?.value.trim();
    if (!name) { TC_Toast.show('Введите название', 'warning'); return; }
    TC_Utils.btnLoading(btn, true);
    try {
      await TC_API.createProject({
        name,
        description:    document.getElementById('proj-desc')?.value.trim() || null,
        start_date:     document.getElementById('proj-start')?.value || null,
        end_date:       document.getElementById('proj-end')?.value   || null,
        budget_planned: parseFloat(document.getElementById('proj-budget')?.value) || 0,
      });
      TC_Toast.show('Проект создан', 'success');
      TC_Modal.close();
      await this.render(0);
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },
};

/* ============================================================
   TaskControl Pro — Календарь (упрощённый)
   ============================================================ */

TC_Views.calendar = {
  async render(subtab = 0) {
    const now  = new Date();
    const year = now.getFullYear();
    const mon  = now.getMonth();

    document.getElementById('main-content').innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-semibold text-lg">${now.toLocaleString('ru-RU',{month:'long',year:'numeric'})}</h2>
          <span class="text-muted text-sm">Задачи с дедлайном в этом месяце</span>
        </div>
        <div id="calendar-grid" class="tc-skeleton h-64 rounded"></div>
      </div>
    `;

    try {
      const start = new Date(year, mon, 1);
      const end   = new Date(year, mon + 1, 0);
      const tasks = await TC_API.getTasks({});
      const deadlineTasks = tasks.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        return d >= start && d <= end;
      });

      const byDay = {};
      deadlineTasks.forEach(t => {
        const d = new Date(t.deadline).getDate();
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(t);
      });

      const firstDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
      const daysInMonth = end.getDate();

      let cells = '';
      // Пустые ячейки
      for (let i = 0; i < firstDay; i++) cells += '<div class="h-20 bg-sidebar border border-border rounded opacity-30"></div>';
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === now.getDate();
        const ts = byDay[d] || [];
        cells += `<div class="h-20 bg-panel border border-border rounded p-1.5 ${isToday ? 'border-accent' : ''}">
          <div class="text-xs font-mono ${isToday ? 'text-accent font-bold' : 'text-muted'} mb-1">${d}</div>
          ${ts.slice(0,2).map(t => `<div class="text-xs truncate py-0.5 px-1 rounded cursor-pointer hover:bg-white/5 ${TC_Utils.isOverdue(t) ? 'text-danger' : 'text-muted'}" onclick="TC_Views.tasks.openTaskModal('${t.id}')" title="${TC_Utils.esc(t.title)}">${TC_Utils.esc(t.title)}</div>`).join('')}
          ${ts.length > 2 ? `<div class="text-xs text-muted">+${ts.length-2}</div>` : ''}
        </div>`;
      }

      document.getElementById('calendar-grid').innerHTML = `
        <div class="grid grid-cols-7 gap-1 mb-1">
          ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="text-center text-xs text-muted font-semibold py-1">${d}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-1">${cells}</div>
      `;
    } catch (e) {
      TC_Toast.show('Ошибка загрузки календаря: ' + e.message, 'error');
    }
  },
};

/* ============================================================
   TaskControl Pro — Уведомления
   ============================================================ */

TC_Views.notifications = {
  async render(subtab = 0) {
    try {
      const notifs = await TC_API.getNotifications();
      const list = subtab === 1 ? notifs.filter(n => !n.is_read) : notifs;

      if (!list.length) {
        document.getElementById('main-content').innerHTML = `<div class="tc-empty mt-16">
          <i data-lucide="bell" class="tc-empty-icon"></i>
          <h3>Уведомлений нет</h3><p>Все актуальные события появятся здесь</p>
        </div>`;
        lucide.createIcons({ nodes: [document.getElementById('main-content')] });
        return;
      }

      const rows = list.map(n => `
        <div class="flex gap-4 p-4 border-b border-border hover:bg-white/5 cursor-pointer ${!n.is_read ? 'bg-blue-950/20' : ''}"
          onclick="TC_Views.notifications._read('${n.id}')">
          <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.is_read ? 'bg-border' : 'bg-accent'}"></div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm">${TC_Utils.esc(n.title)}</div>
            ${n.body ? `<div class="text-muted text-xs mt-0.5">${TC_Utils.esc(n.body)}</div>` : ''}
            <div class="text-muted text-xs tc-mono mt-1">${TC_Utils.timeRelative(n.created_at)}</div>
          </div>
        </div>
      `).join('');

      document.getElementById('main-content').innerHTML = `
        <div class="p-4 border-b border-border flex justify-end">
          <button class="tc-btn-secondary text-sm" onclick="TC_Views.notifications._readAll()">Прочитать все</button>
        </div>
        <div>${rows}</div>
      `;
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _read(id) {
    await TC_API.markNotifRead(id);
    await this.render(TC_State.get('currentSubtab') || 0);
    TC.ui.updateBadges();
  },

  async _readAll() {
    await TC_API.markAllNotifsRead();
    await this.render(TC_State.get('currentSubtab') || 0);
    TC.ui.updateBadges();
  },
};
