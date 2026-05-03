/* ============================================================
   TaskControl Pro — Управление задачами
   ============================================================ */

TC_Views = TC_Views || {};

TC_Views.tasks = {
  _tasks: [],
  _sort: { field: 'created_at', dir: 'desc' },
  _filters: {},

  async render(subtab = 0) {
    const subtabs = [null,'mine','delegated','urgent','overdue'];
    const sub = subtabs[subtab] || null;

    const uid = TC_State.get('currentUser')?.id;
    this._filters = {};

    if (sub === 'mine')      this._filters.assigned_to = uid;
    if (sub === 'delegated') this._filters.created_by  = uid;
    if (sub === 'urgent')    this._filters.priority    = 'critical';
    if (sub === 'overdue')   this._filters.overdue     = true;

    await this._renderShell();
    await this._loadAndRender();
  },

  async refresh() {
    await this._loadAndRender();
  },

  async _renderShell() {
    document.getElementById('main-content').innerHTML = `
      <div class="p-4 border-b border-border flex flex-wrap items-center gap-3" id="task-filter-bar">
        <div class="relative flex-1 min-w-48">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"></i>
          <input id="task-search" type="text" placeholder="Поиск по названию, ID..." class="tc-input pl-9 w-full text-sm"
            oninput="TC_Views.tasks._onSearch(this.value)">
        </div>
        <select id="task-filter-status" class="tc-select text-sm" onchange="TC_Views.tasks._onFilter()">
          <option value="">Все статусы</option>
          ${Object.entries(TASK_STATUS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </select>
        <select id="task-filter-priority" class="tc-select text-sm" onchange="TC_Views.tasks._onFilter()">
          <option value="">Все приоритеты</option>
          ${Object.entries(TASK_PRIORITY).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </select>
      </div>

      <div class="tc-table-wrap">
        <table class="tc-table" id="tasks-table">
          <thead><tr>
            <th style="width:110px;" onclick="TC_Views.tasks._sort('task_number')">ID <i data-lucide="arrow-up-down" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i></th>
            <th style="width:100px;">Статус</th>
            <th style="width:100px;" onclick="TC_Views.tasks._sort('priority')">Приоритет</th>
            <th onclick="TC_Views.tasks._sort('title')">Название</th>
            <th style="width:100px;">Участники</th>
            <th style="width:130px;" onclick="TC_Views.tasks._sort('deadline')">Дедлайн</th>
            <th style="width:120px;" onclick="TC_Views.tasks._sort('progress')">Прогресс</th>
            <th style="width:70px;" class="no-sort"></th>
          </tr></thead>
          <tbody id="tasks-tbody">
            ${[0,1,2,3,4,5].map(() => `<tr><td colspan="8"><div class="tc-skeleton h-10 rounded"></div></td></tr>`).join('')}
          </tbody>
        </table>
        <div class="tc-table-footer" id="tasks-footer">Загрузка...</div>
      </div>
    `;
    lucide.createIcons({ nodes: [document.getElementById('main-content')] });
  },

  async _loadAndRender() {
    try {
      const f = { ...this._filters };
      const search = document.getElementById('task-search')?.value;
      const status = document.getElementById('task-filter-status')?.value;
      const priority = document.getElementById('task-filter-priority')?.value;
      if (search)   f.search   = search;
      if (status)   f.status   = status;
      if (priority) f.priority = priority;

      this._tasks = await TC_API.getTasks(f);
      this._renderRows();
    } catch (e) {
      TC_Toast.show('Ошибка загрузки задач: ' + e.message, 'error');
    }
  },

  _renderRows() {
    const tbody  = document.getElementById('tasks-tbody');
    const footer = document.getElementById('tasks-footer');
    if (!tbody) return;

    const tasks = this._getSorted();

    if (!tasks.length) {
      tbody.innerHTML = `<tr><td colspan="8">
        <div class="tc-empty">
          <i data-lucide="inbox" class="tc-empty-icon"></i>
          <h3>Задач нет</h3>
          <p>Создайте первую задачу, нажав кнопку выше</p>
          <button class="tc-btn-primary mt-3 text-sm" onclick="TC_Views.tasks.openCreateModal()">
            <i data-lucide="plus" class="w-4 h-4 mr-1.5"></i>Создать задачу
          </button>
        </div>
      </td></tr>`;
      lucide.createIcons({ nodes: [tbody] });
      if (footer) footer.textContent = 'Задач: 0';
      return;
    }

    const now = new Date();
    tbody.innerHTML = tasks.map(t => {
      const overdue = TC_Utils.isOverdue(t);
      const ddl = t.deadline
        ? `<span class="${overdue ? 'text-danger' : 'text-muted'} text-xs tc-mono">${TC_Utils.formatDateTime(t.deadline)}</span>`
        : '<span class="text-muted text-xs">—</span>';

      return `<tr onclick="TC_Views.tasks.openTaskModal('${t.id}')" oncontextmenu="TC_Views.tasks._ctxMenu(event,'${t.id}')">
        <td><span class="tc-task-id">${TC_Utils.esc(t.task_number)}</span></td>
        <td>${TC_Utils.statusBadge(t.status)}</td>
        <td>${TC_Utils.priorityBadge(t.priority)}</td>
        <td>
          <div class="font-medium text-sm leading-5">${TC_Utils.esc(t.title)}</div>
          ${t.project_name ? `<div class="text-xs text-muted mt-0.5">${TC_Utils.esc(t.project_name)}</div>` : ''}
        </td>
        <td>${TC_Utils.avatarGroup(t._participants || [], 3)}</td>
        <td>${ddl}</td>
        <td>
          <div class="flex items-center gap-2">
            ${TC_Utils.progressBar(t.progress || 0, overdue)}
            <span class="tc-mono text-xs text-muted">${t.progress || 0}%</span>
          </div>
        </td>
        <td onclick="event.stopPropagation()">
          <div class="flex items-center gap-1">
            <button class="tc-icon-btn" title="Открыть" onclick="TC_Views.tasks.openTaskModal('${t.id}')">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <button class="tc-icon-btn" title="Редактировать" onclick="TC_Views.tasks.openEditModal('${t.id}')">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    lucide.createIcons({ nodes: [tbody] });

    /* Участники — подгрузить отдельно для каждой задачи */
    this._loadParticipantsForTable(tasks);

    if (footer) {
      const done = tasks.filter(t => t.status === 'completed').length;
      footer.textContent = `Задач: ${tasks.length} | Завершено: ${done} | В работе: ${tasks.filter(t=>t.status==='in_progress').length}`;
    }
  },

  async _loadParticipantsForTable(tasks) {
    /* Параллельная загрузка участников */
    const ids = tasks.map(t => t.id);
    if (!ids.length) return;
    try {
      const { data } = await supabase
        .from('task_participants')
        .select('task_id, user_id, contractor_name, profiles:user_id(full_name)')
        .in('task_id', ids)
        .neq('status', 'removed');

      const byTask = {};
      (data || []).forEach(p => {
        if (!byTask[p.task_id]) byTask[p.task_id] = [];
        byTask[p.task_id].push({
          full_name: p.profiles?.full_name || p.contractor_name || '?',
        });
      });

      /* Обновить ячейки участников */
      tasks.forEach(t => {
        const row = document.querySelector(`tr[onclick*="${t.id}"]`);
        if (!row) return;
        const cell = row.cells[4];
        if (cell) cell.innerHTML = TC_Utils.avatarGroup(byTask[t.id] || [], 3);
      });
    } catch (e) {
      console.error('[TC] participants load error:', e.message);
    }
  },

  _getSorted() {
    const { field, dir } = this._sort;
    const tasks = [...this._tasks];
    if (!field) return tasks;
    tasks.sort((a, b) => {
      let va = a[field], vb = b[field];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
    return tasks;
  },

  _sort(field) {
    if (this._sort.field === field) {
      this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sort = { field, dir: 'asc' };
    }
    this._renderRows();
  },

  _onSearch: TC_Utils.debounce(async function(v) {
    TC_Views.tasks._filters.search = v;
    await TC_Views.tasks._loadAndRender();
  }, 350),

  async _onFilter() {
    await this._loadAndRender();
  },

  /* ── КОНТЕКСТНОЕ МЕНЮ ──────────────────────────────────── */
  _ctxMenu(e, taskId) {
    e.preventDefault();
    const task = this._tasks.find(t => t.id === taskId);
    if (!task) return;

    const menu = document.getElementById('context-menu');
    menu.innerHTML = `
      <div class="tc-ctx-item" onclick="TC_Views.tasks.openTaskModal('${taskId}')">
        <i data-lucide="eye" class="w-4 h-4"></i> Открыть
      </div>
      <div class="tc-ctx-item" onclick="TC_Views.tasks.openEditModal('${taskId}')">
        <i data-lucide="pencil" class="w-4 h-4"></i> Редактировать
      </div>
      <div class="tc-ctx-item" onclick="TC_Views.tasks._quickStatus('${taskId}','in_progress')">
        <i data-lucide="play" class="w-4 h-4"></i> Взять в работу
      </div>
      <div class="tc-ctx-item" onclick="TC_Views.tasks._quickStatus('${taskId}','completed')">
        <i data-lucide="check" class="w-4 h-4"></i> Завершить
      </div>
      <div class="tc-ctx-sep"></div>
      ${TC_Auth.isManagerOrAbove() ? `<div class="tc-ctx-item danger" onclick="TC_Views.tasks._confirmDelete('${taskId}')">
        <i data-lucide="trash-2" class="w-4 h-4"></i> Удалить
      </div>` : ''}
    `;
    menu.style.left = `${Math.min(e.pageX, window.innerWidth - 200)}px`;
    menu.style.top  = `${Math.min(e.pageY, window.innerHeight - 200)}px`;
    menu.classList.remove('hidden');
    lucide.createIcons({ nodes: [menu] });

    const close = () => { menu.classList.add('hidden'); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 10);
  },

  async _quickStatus(taskId, status) {
    try {
      const task = this._tasks.find(t => t.id === taskId);
      await TC_API.updateTask(taskId, {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      });
      await TC_API.logAction(taskId, task?.task_number, 'status_changed', {
        old: task?.status, new: status,
      });
      TC_Toast.show(`Статус изменён на: ${TASK_STATUS[status].label}`, 'success');
      await this._loadAndRender();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _confirmDelete(taskId) {
    const task = this._tasks.find(t => t.id === taskId);
    if (!confirm(`Удалить задачу ${task?.task_number}?\n\nЭто действие необратимо.`)) return;
    try {
      await TC_API.deleteTask(taskId);
      TC_Toast.show('Задача удалена', 'success');
      await this._loadAndRender();
    } catch (e) {
      TC_Toast.show('Ошибка удаления: ' + e.message, 'error');
    }
  },

  /* ── ОТКРЫТИЕ ЗАДАЧИ (ДЕТАЛЬНАЯ МОДАЛКА) ──────────────── */
  async openTaskModal(taskId, tab = 'info') {
    TC_Modal._currentTaskId = taskId;
    TC_Modal._currentTab    = tab;
    TC_Modal.open(TC_Modal.loading(), { maxWidth: '860px' });

    try {
      const [task, participants, checkpoints, finOps, log] = await Promise.all([
        TC_API.getTask(taskId),
        TC_API.getParticipants(taskId),
        TC_API.getCheckpoints(taskId),
        TC_API.getFinanceOps({ task_id: taskId }),
        TC_API.getLog({ task_id: taskId, limit: 30 }),
      ]);

      const tabList = [
        { key: 'info',         label: 'Информация' },
        { key: 'participants', label: `Участники (${participants.length})` },
        { key: 'checkpoints',  label: `Чекпойнты (${checkpoints.filter(c=>c.is_completed).length}/${checkpoints.length})` },
        { key: 'finance',      label: 'Финансы' },
        { key: 'log',          label: 'Журнал' },
      ];

      const tabsHtml = tabList.map(t =>
        `<button class="tc-modal-tab ${t.key === tab ? 'active' : ''}"
          onclick="TC_Views.tasks.openTaskModal('${taskId}','${t.key}')">${t.label}</button>`
      ).join('');

      const overdue = TC_Utils.isOverdue(task);
      let bodyHtml = '';

      if (tab === 'info')         bodyHtml = this._tabInfo(task, overdue);
      if (tab === 'participants') bodyHtml = this._tabParticipants(task, participants);
      if (tab === 'checkpoints')  bodyHtml = this._tabCheckpoints(task, checkpoints);
      if (tab === 'finance')      bodyHtml = this._tabFinance(task, finOps);
      if (tab === 'log')          bodyHtml = this._tabLog(log);

      const html = `
        ${TC_Modal.header(task.title, task.task_number)}
        <div class="tc-modal-tabs">${tabsHtml}</div>
        <div class="tc-modal-body p-6">${bodyHtml}</div>
        <div class="tc-modal-footer">
          <button class="tc-btn-secondary" onclick="TC_Modal.close()">Закрыть</button>
          ${TC_Auth.can('edit') ? `<button class="tc-btn-primary" onclick="TC_Views.tasks.openEditModal('${taskId}')">
            <i data-lucide="pencil" class="w-4 h-4 mr-1.5"></i>Редактировать
          </button>` : ''}
        </div>
      `;

      TC_Modal.open(html, { maxWidth: '860px' });
      TC_Modal._currentTaskId = taskId;
      TC_Modal._currentTab    = tab;
    } catch (e) {
      TC_Toast.show('Ошибка загрузки задачи: ' + e.message, 'error');
      TC_Modal.close();
    }
  },

  _tabInfo(t, overdue) {
    return `
      <div class="grid grid-cols-2 gap-x-8 gap-y-4">
        <div class="col-span-2">
          <div class="tc-label">Описание</div>
          <p class="text-sm text-muted leading-relaxed">${t.description ? TC_Utils.esc(t.description) : '<em>Нет описания</em>'}</p>
        </div>
        <div>
          <div class="tc-label">Статус</div>
          ${TC_Utils.statusBadge(t.status)}
        </div>
        <div>
          <div class="tc-label">Приоритет</div>
          ${TC_Utils.priorityBadge(t.priority)}
        </div>
        <div>
          <div class="tc-label">Тип</div>
          <span class="text-sm">${TASK_TYPE[t.task_type] || t.task_type}</span>
        </div>
        <div>
          <div class="tc-label">Важность</div>
          <span class="tc-mono text-sm">${t.importance || 5}/10</span>
        </div>
        <div>
          <div class="tc-label">Дедлайн</div>
          <span class="tc-mono text-sm ${overdue ? 'text-danger' : ''}">${TC_Utils.formatDateTime(t.deadline)}</span>
          ${overdue ? '<span class="text-danger text-xs ml-2">просрочено</span>' : ''}
        </div>
        <div>
          <div class="tc-label">Прогресс</div>
          <div class="flex items-center gap-3 mt-1">
            ${TC_Utils.progressBar(t.progress || 0, overdue)}
            <span class="tc-mono text-sm">${t.progress || 0}%</span>
          </div>
        </div>
        <div>
          <div class="tc-label">Создал</div>
          <span class="text-sm">${TC_Utils.esc(t.created_by_name || '—')}</span>
        </div>
        <div>
          <div class="tc-label">Проект</div>
          <span class="text-sm">${TC_Utils.esc(t.project_name || '—')}</span>
        </div>
        <div>
          <div class="tc-label">Создана</div>
          <span class="tc-mono text-xs text-muted">${TC_Utils.formatDateTime(t.created_at)}</span>
        </div>
        <div>
          <div class="tc-label">Обновлена</div>
          <span class="tc-mono text-xs text-muted">${TC_Utils.formatDateTime(t.updated_at)}</span>
        </div>
      </div>
    `;
  },

  _tabParticipants(task, parts) {
    const rows = parts.length ? parts.map(p => {
      const name = p.profiles?.full_name || p.contractor_name || '—';
      const contact = p.contractor_contact ? `<div class="text-xs text-muted">${TC_Utils.esc(p.contractor_contact)}</div>` : '';
      return `<tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="tc-avatar">${TC_Utils.initials(name)}</div>
            <div><div class="font-medium text-sm">${TC_Utils.esc(name)}</div>${contact}</div>
          </div>
        </td>
        <td class="text-sm text-muted">${{executor:'Исполнитель',reviewer:'Проверяющий',observer:'Наблюдатель',contractor:'Подрядчик'}[p.role]||p.role}</td>
        <td>${TC_Utils.statusBadge(p.status === 'completed' ? 'completed' : p.status === 'removed' ? 'cancelled' : 'in_progress')}</td>
        <td>
          <div class="flex items-center gap-2">
            ${TC_Utils.progressBar(p.progress || 0)}
            <span class="tc-mono text-xs">${p.progress||0}%</span>
          </div>
        </td>
        ${TC_Auth.can('edit') ? `<td onclick="event.stopPropagation()">
          <button class="tc-icon-btn text-danger" onclick="TC_Views.tasks._removeParticipant('${p.id}','${task.id}')">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </td>` : '<td></td>'}
      </tr>`;
    }).join('') : `<tr><td colspan="5"><div class="tc-empty" style="padding:24px;"><h3>Нет участников</h3></div></td></tr>`;

    const addBtn = TC_Auth.can('edit') ? `
      <button class="tc-btn-secondary text-sm" onclick="TC_Views.tasks._addParticipantForm('${task.id}')">
        <i data-lucide="user-plus" class="w-4 h-4 mr-1.5"></i>Добавить участника
      </button>` : '';

    return `
      <div class="flex justify-end mb-4">${addBtn}</div>
      <div id="add-participant-form"></div>
      <table class="tc-table">
        <thead><tr><th>Участник</th><th>Роль</th><th>Статус</th><th>Прогресс</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  },

  _tabCheckpoints(task, checks) {
    const total = checks.length;
    const done  = checks.filter(c => c.is_completed).length;

    const items = checks.length ? checks.map(c => `
      <div class="flex items-start gap-3 py-3 border-b border-border last:border-0">
        <button class="tc-checkbox mt-0.5 ${c.is_completed ? 'checked' : ''}"
          onclick="TC_Views.tasks._toggleCheckpoint('${c.id}', ${!c.is_completed}, '${task.id}')">
          ${c.is_completed ? '<i data-lucide="check" style="width:10px;height:10px;color:white;"></i>' : ''}
        </button>
        <div class="flex-1 min-w-0">
          <div class="text-sm ${c.is_completed ? 'line-through text-muted' : ''}">${TC_Utils.esc(c.title)}</div>
          ${c.deadline ? `<div class="text-xs text-muted tc-mono mt-0.5">${TC_Utils.formatDate(c.deadline)}</div>` : ''}
          ${c.is_completed && c.profiles?.full_name ? `<div class="text-xs text-muted">Выполнил: ${TC_Utils.esc(c.profiles.full_name)} · ${TC_Utils.timeRelative(c.completed_at)}</div>` : ''}
        </div>
        ${TC_Auth.can('edit') ? `
        <button class="tc-icon-btn text-danger" onclick="TC_Views.tasks._deleteCheckpoint('${c.id}', '${task.id}')">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>` : ''}
      </div>
    `).join('') : `<div class="tc-empty" style="padding:24px;"><h3>Нет чекпойнтов</h3><p>Добавьте промежуточные результаты</p></div>`;

    const addForm = TC_Auth.can('edit') ? `
      <div class="mt-4 flex gap-2" id="checkpoint-add-row">
        <input id="new-checkpoint-title" type="text" class="tc-input flex-1 text-sm" placeholder="Название чекпойнта...">
        <button class="tc-btn-primary text-sm" onclick="TC_Views.tasks._addCheckpoint('${task.id}')">
          <i data-lucide="plus" class="w-4 h-4"></i>
        </button>
      </div>` : '';

    return `
      <div class="mb-4 flex items-center justify-between">
        <div class="tc-section-title">Выполнено: ${done}/${total}</div>
        ${total ? `<div class="flex items-center gap-2 w-48">${TC_Utils.progressBar(total ? Math.round(done/total*100) : 0)}<span class="tc-mono text-xs text-muted">${total ? Math.round(done/total*100) : 0}%</span></div>` : ''}
      </div>
      <div id="checkpoints-list">${items}</div>
      ${addForm}
    `;
  },

  _tabFinance(task, ops) {
    const income  = ops.filter(f => f.type === 'income').reduce((s,f)  => s + +f.amount, 0);
    const expense = ops.filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);

    const rows = ops.length ? ops.map(f => `<tr>
      <td class="tc-mono text-xs">${TC_Utils.formatDate(f.op_date)}</td>
      <td>${f.type === 'income' ? '<span class="text-success text-xs font-bold">ДОХОД</span>' : '<span class="text-danger text-xs font-bold">РАСХОД</span>'}</td>
      <td class="text-xs text-muted">${TC_Utils.esc(f.category)}</td>
      <td class="tc-mono text-sm ${f.type === 'income' ? 'text-success' : 'text-danger'}">${f.type === 'income' ? '+' : '−'}${TC_Utils.formatMoney(f.amount, false)} ₽</td>
      <td class="text-xs text-muted">${TC_Utils.esc(f.description || '')}</td>
    </tr>`).join('') : `<tr><td colspan="5"><div class="tc-empty" style="padding:16px;"><h3>Нет финансовых операций</h3></div></td></tr>`;

    const addForm = TC_Auth.isManagerOrAbove() ? `
      <div class="mt-4 p-4 bg-bg border border-border rounded space-y-3" id="fin-add-form">
        <div class="tc-section-title">Добавить операцию</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="tc-label">Тип</label>
            <select id="fin-type" class="tc-select w-full text-sm">
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </div>
          <div>
            <label class="tc-label">Сумма (₽)</label>
            <input id="fin-amount" type="number" min="0.01" step="0.01" class="tc-input w-full text-sm" placeholder="0">
          </div>
          <div>
            <label class="tc-label">Категория</label>
            <select id="fin-category" class="tc-select w-full text-sm">
              <optgroup label="Доходы">${FINANCE_CATEGORIES.income.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>
              <optgroup label="Расходы">${FINANCE_CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>
            </select>
          </div>
          <div>
            <label class="tc-label">Дата</label>
            <input id="fin-date" type="date" class="tc-input w-full text-sm" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="col-span-2">
            <label class="tc-label">Описание</label>
            <input id="fin-desc" type="text" class="tc-input w-full text-sm" placeholder="Необязательно">
          </div>
        </div>
        <button class="tc-btn-primary text-sm" onclick="TC_Views.tasks._addFinanceOp('${task.id}', '${task.task_number}')">
          Добавить операцию
        </button>
      </div>` : '';

    return `
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="tc-panel p-4 text-center">
          <div class="tc-label mb-1">Плановый бюджет</div>
          <div class="tc-mono text-sm">${TC_Utils.formatMoney(task.budget_planned, false)} ₽</div>
        </div>
        <div class="tc-panel p-4 text-center">
          <div class="tc-label mb-1">Расходы</div>
          <div class="tc-mono text-sm text-danger">−${TC_Utils.formatMoney(expense, false)} ₽</div>
        </div>
        <div class="tc-panel p-4 text-center">
          <div class="tc-label mb-1">Доходы</div>
          <div class="tc-mono text-sm text-success">+${TC_Utils.formatMoney(income, false)} ₽</div>
        </div>
      </div>
      <table class="tc-table mb-4">
        <thead><tr><th>Дата</th><th>Тип</th><th>Категория</th><th>Сумма</th><th>Описание</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${addForm}
    `;
  },

  _tabLog(log) {
    if (!log.length) return `<div class="tc-empty"><h3>Журнал пуст</h3></div>`;
    return `<div class="space-y-0">
      ${log.map(l => `
        <div class="flex gap-4 py-3 border-b border-border last:border-0">
          <div class="tc-avatar flex-shrink-0">${TC_Utils.initials(l.profiles?.full_name || '?')}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-medium">${TC_Utils.esc(l.profiles?.full_name || '—')}</span>
              <span class="tc-mono text-xs text-muted flex-shrink-0">${TC_Utils.formatDateTime(l.created_at)}</span>
            </div>
            <div class="text-sm text-muted">${LOG_ACTIONS[l.action] || TC_Utils.esc(l.action)}</div>
            ${l.details && Object.keys(l.details).length ? `<div class="mt-1 text-xs text-muted font-mono bg-bg rounded px-2 py-1 inline-block">${JSON.stringify(l.details)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  },

  /* ── Inline-действия в модалке ──────────────────────────── */

  async _toggleCheckpoint(id, isCompleted, taskId) {
    try {
      await TC_API.toggleCheckpoint(id, isCompleted);
      const task = this._tasks.find(t => t.id === taskId);
      await TC_API.logAction(taskId, task?.task_number, 'checkpoint_completed', { is_completed: isCompleted });
      await this.openTaskModal(taskId, 'checkpoints');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _addCheckpoint(taskId) {
    const input = document.getElementById('new-checkpoint-title');
    const title = input?.value.trim();
    if (!title) { TC_Toast.show('Введите название чекпойнта', 'warning'); return; }
    try {
      const task = this._tasks.find(t => t.id === taskId);
      await TC_API.addCheckpoint({ task_id: taskId, title });
      await TC_API.logAction(taskId, task?.task_number, 'checkpoint_added', { title });
      await this.openTaskModal(taskId, 'checkpoints');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _deleteCheckpoint(id, taskId) {
    if (!confirm('Удалить чекпойнт?')) return;
    try {
      await TC_API.deleteCheckpoint(id);
      await this.openTaskModal(taskId, 'checkpoints');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _removeParticipant(participantId, taskId) {
    if (!confirm('Удалить участника?')) return;
    try {
      const task = this._tasks.find(t => t.id === taskId);
      await TC_API.removeParticipant(participantId);
      await TC_API.logAction(taskId, task?.task_number, 'participant_removed');
      await this.openTaskModal(taskId, 'participants');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _addParticipantForm(taskId) {
    const users = TC_State.get('users') || await TC_API.getUsers();
    TC_State.set('users', users);
    const form = document.getElementById('add-participant-form');
    if (!form) return;
    form.innerHTML = `
      <div class="p-4 mb-4 bg-bg border border-border rounded space-y-3">
        <div class="tc-section-title">Добавить участника</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="tc-label">Пользователь</label>
            <select id="part-user-id" class="tc-select w-full text-sm">
              <option value="">— выбрать пользователя —</option>
              ${users.map(u => `<option value="${u.id}">${TC_Utils.esc(u.full_name)}</option>`).join('')}
              <option value="contractor">— внешний подрядчик —</option>
            </select>
          </div>
          <div>
            <label class="tc-label">Роль</label>
            <select id="part-role" class="tc-select w-full text-sm">
              <option value="executor">Исполнитель</option>
              <option value="reviewer">Проверяющий</option>
              <option value="observer">Наблюдатель</option>
              <option value="contractor">Подрядчик</option>
            </select>
          </div>
        </div>
        <div id="contractor-fields" class="hidden grid grid-cols-2 gap-3">
          <div>
            <label class="tc-label">Имя подрядчика</label>
            <input id="part-cname" type="text" class="tc-input w-full text-sm" placeholder="ООО Ромашка">
          </div>
          <div>
            <label class="tc-label">Контакт</label>
            <input id="part-ccontact" type="text" class="tc-input w-full text-sm" placeholder="+7 999 123-45-67">
          </div>
        </div>
        <div class="flex gap-2">
          <button class="tc-btn-primary text-sm" onclick="TC_Views.tasks._saveParticipant('${taskId}')">Добавить</button>
          <button class="tc-btn-secondary text-sm" onclick="document.getElementById('add-participant-form').innerHTML=''">Отмена</button>
        </div>
      </div>
    `;
    document.getElementById('part-user-id')?.addEventListener('change', e => {
      const cf = document.getElementById('contractor-fields');
      cf?.classList.toggle('hidden', e.target.value !== 'contractor');
    });
  },

  async _saveParticipant(taskId) {
    const userId  = document.getElementById('part-user-id')?.value;
    const role    = document.getElementById('part-role')?.value;
    const cname   = document.getElementById('part-cname')?.value.trim();
    const contact = document.getElementById('part-ccontact')?.value.trim();

    const payload = { task_id: taskId, role };
    if (userId && userId !== 'contractor') {
      payload.user_id = userId;
    } else if (cname) {
      payload.contractor_name    = cname;
      payload.contractor_contact = contact;
    } else {
      TC_Toast.show('Выберите пользователя или введите имя подрядчика', 'warning');
      return;
    }

    try {
      const task = this._tasks.find(t => t.id === taskId);
      await TC_API.addParticipant(payload);
      await TC_API.logAction(taskId, task?.task_number, 'participant_added', { role });
      TC_Toast.show('Участник добавлен', 'success');
      await this.openTaskModal(taskId, 'participants');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  async _addFinanceOp(taskId, taskNumber) {
    const type     = document.getElementById('fin-type')?.value;
    const amount   = parseFloat(document.getElementById('fin-amount')?.value);
    const category = document.getElementById('fin-category')?.value;
    const date     = document.getElementById('fin-date')?.value;
    const desc     = document.getElementById('fin-desc')?.value.trim();

    if (!amount || amount <= 0) { TC_Toast.show('Введите корректную сумму', 'warning'); return; }
    if (!category)              { TC_Toast.show('Выберите категорию', 'warning'); return; }

    try {
      await TC_API.addFinanceOp({ task_id: taskId, type, amount, category, op_date: date, description: desc });
      await TC_API.logAction(taskId, taskNumber, type === 'income' ? 'income_added' : 'expense_added', { amount, category });
      TC_Toast.show(`${type === 'income' ? 'Доход' : 'Расход'} добавлен`, 'success');
      await this.openTaskModal(taskId, 'finance');
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    }
  },

  /* ── ФОРМА СОЗДАНИЯ / РЕДАКТИРОВАНИЯ ──────────────────── */
  async openCreateModal() {
    this._openFormModal(null);
  },

  async openEditModal(taskId) {
    const task = this._tasks.find(t => t.id === taskId) || await TC_API.getTask(taskId);
    this._openFormModal(task);
  },

  async _openFormModal(task) {
    const isEdit   = !!task;
    const projects = TC_State.get('projects') || await TC_API.getProjects();
    TC_State.set('projects', projects);
    const users = TC_State.get('users') || await TC_API.getUsers();
    TC_State.set('users', users);

    const v = k => task ? TC_Utils.esc(task[k] || '') : '';
    const sel = (k, val) => task?.[k] === val ? 'selected' : '';
    const deadline = task?.deadline ? new Date(task.deadline).toISOString().slice(0,16) : '';

    const html = `
      ${TC_Modal.header(isEdit ? `Редактировать: ${task.task_number}` : 'Создать задачу')}
      <div class="tc-modal-body p-6 space-y-5">
        <div>
          <label class="tc-label">Название *</label>
          <input id="form-title" type="text" class="tc-input w-full" value="${v('title')}" placeholder="Название задачи">
        </div>
        <div>
          <label class="tc-label">Описание</label>
          <textarea id="form-desc" class="tc-textarea w-full">${v('description')}</textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="tc-label">Статус</label>
            <select id="form-status" class="tc-select w-full">
              ${Object.entries(TASK_STATUS).map(([k,v2]) => `<option value="${k}" ${sel('status',k)}>${v2.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tc-label">Приоритет</label>
            <select id="form-priority" class="tc-select w-full">
              ${Object.entries(TASK_PRIORITY).map(([k,v2]) => `<option value="${k}" ${sel('priority',k)}>${v2.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tc-label">Тип задачи</label>
            <select id="form-type" class="tc-select w-full">
              ${Object.entries(TASK_TYPE).map(([k,l]) => `<option value="${k}" ${sel('task_type',k)}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tc-label">Важность (1-10)</label>
            <input id="form-importance" type="number" min="1" max="10" class="tc-input w-full" value="${task?.importance || 5}">
          </div>
          <div>
            <label class="tc-label">Дедлайн</label>
            <input id="form-deadline" type="datetime-local" class="tc-input w-full" value="${deadline}">
          </div>
          <div>
            <label class="tc-label">Проект</label>
            <select id="form-project" class="tc-select w-full">
              <option value="">— без проекта —</option>
              ${projects.map(p => `<option value="${p.id}" ${task?.project_id === p.id ? 'selected' : ''}>${TC_Utils.esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tc-label">Ответственный</label>
            <select id="form-assigned" class="tc-select w-full">
              <option value="">— не назначен —</option>
              ${users.map(u => `<option value="${u.id}" ${task?.assigned_to === u.id ? 'selected' : ''}>${TC_Utils.esc(u.full_name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="tc-label">Плановый бюджет (₽)</label>
            <input id="form-budget" type="number" min="0" class="tc-input w-full" value="${task?.budget_planned || ''}">
          </div>
        </div>
      </div>
      <div class="tc-modal-footer">
        <button class="tc-btn-secondary" onclick="TC_Modal.close()">Отмена</button>
        <button class="tc-btn-primary" id="form-submit-btn"
          onclick="TC_Views.tasks._submitForm(${isEdit ? `'${task.id}'` : 'null'})">
          <span>${isEdit ? 'Сохранить' : 'Создать задачу'}</span>
          <div class="tc-spinner-sm hidden ml-2"></div>
        </button>
      </div>
    `;
    TC_Modal.open(html, { maxWidth: '680px' });
  },

  async _submitForm(taskId) {
    const btn = document.getElementById('form-submit-btn');
    const title = document.getElementById('form-title')?.value.trim();
    if (!title) { TC_Toast.show('Введите название задачи', 'warning'); return; }

    TC_Utils.btnLoading(btn, true);
    const payload = {
      title,
      description:    document.getElementById('form-desc')?.value.trim() || null,
      status:         document.getElementById('form-status')?.value,
      priority:       document.getElementById('form-priority')?.value,
      task_type:      document.getElementById('form-type')?.value,
      importance:     parseInt(document.getElementById('form-importance')?.value) || 5,
      deadline:       document.getElementById('form-deadline')?.value || null,
      project_id:     document.getElementById('form-project')?.value  || null,
      assigned_to:    document.getElementById('form-assigned')?.value || null,
      budget_planned: parseFloat(document.getElementById('form-budget')?.value) || 0,
    };

    try {
      if (taskId) {
        const old = this._tasks.find(t => t.id === taskId);
        await TC_API.updateTask(taskId, payload);
        await TC_API.logAction(taskId, old?.task_number, 'task_updated', {
          old_status: old?.status, new_status: payload.status,
          old_priority: old?.priority, new_priority: payload.priority,
        });
        TC_Toast.show('Задача обновлена', 'success');
      } else {
        const created = await TC_API.createTask(payload);
        await TC_API.logAction(created.id, created.task_number, 'task_created', { title });
        TC_Toast.show(`Задача ${created.task_number} создана`, 'success');
      }
      TC_Modal.close();
      await this._loadAndRender();
    } catch (e) {
      TC_Toast.show('Ошибка: ' + e.message, 'error');
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },
};
