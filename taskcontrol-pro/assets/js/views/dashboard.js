/* ============================================================
   TaskControl Pro — Дашборд
   ============================================================ */

TC_Views = TC_Views || {};

TC_Views.dashboard = {
  async render(subtab = 0) {
    const subtabs = ['overview','metrics','finance'];
    const key = subtabs[subtab] || 'overview';
    if (key === 'overview') await this._renderOverview();
    else if (key === 'metrics') await this._renderMetrics();
    else await this._renderFinanceDash();
  },

  async refresh() { await this.render(TC_State.get('currentSubtab') || 0); },
  async refreshFinance() { if ((TC_State.get('currentSubtab') || 0) === 2) await this._renderFinanceDash(); },

  /* ── ОБЗОР ─────────────────────────────────────────────── */
  async _renderOverview() {
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="p-6 space-y-6">
      <div id="metrics-row" class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        ${[0,1,2,3,4,5].map(() => `<div class="tc-metric-card tc-skeleton h-24"></div>`).join('')}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="tc-chart-wrap"><div class="tc-chart-title">Статусы задач</div><div style="height:220px;position:relative;"><canvas id="chart-status"></canvas></div></div>
        <div class="tc-chart-wrap"><div class="tc-chart-title">Выполнение по неделям</div><div style="height:220px;position:relative;"><canvas id="chart-weekly"></canvas></div></div>
      </div>
      <div id="workload-section" class="tc-panel">
        <div class="p-4 border-b border-border tc-section-header" style="margin:0;">
          <span class="tc-section-title">Загрузка участников</span>
        </div>
        <div class="tc-skeleton h-40"></div>
      </div>
    </div>`;

    try {
      const [metrics, statusStats, weekData, workload] = await Promise.all([
        TC_API.getDashboardMetrics(),
        TC_API.getTaskStatusStats(),
        TC_API.getWeeklyCompletion(),
        TC_API.getWorkload(),
      ]);

      this._renderMetricsRow(metrics);
      TC_Charts.renderStatusChart('chart-status', statusStats);
      TC_Charts.renderWeeklyChart('chart-weekly', weekData);
      this._renderWorkload(workload);
    } catch (e) {
      console.error('[Dashboard]', e);
      TC_Toast.show('Ошибка загрузки дашборда', 'error');
    }
  },

  _renderMetricsRow(m) {
    const el = document.getElementById('metrics-row');
    if (!el || !m) return;

    const balSign = m.balance >= 0 ? 'success' : 'danger';
    const balText = TC_Utils.formatMoney(m.balance);
    const overdueColor = m.overdue > 0 ? 'color:#EF4444' : '';

    el.innerHTML = `
      ${this._metricCard('Задач сегодня', `${m.today.done}/${m.today.total}`, 'Выполнено / Всего', 'calendar-check', 'accent')}
      ${this._metricCard('Задач на неделе', `${m.week.done}/${m.week.total}`, 'Выполнено / План', 'list-checks', 'success')}
      ${this._metricCard('Просрочено', m.overdue, 'Требуют внимания', 'alert-triangle', 'danger', overdueColor)}
      ${this._metricCard('В работе', m.inProgress, 'Активных задач', 'activity', 'accent')}
      ${this._metricCard('Баланс (месяц)', balText, 'Доходы − Расходы', 'banknote', balSign)}
      ${this._metricCard('Участников', `${m.people.active}/${m.people.total}`, 'В работе / Всего', 'users', 'accent')}
    `;
    lucide.createIcons({ nodes: [el] });
  },

  _metricCard(label, value, sub, icon, color, style = '') {
    return `
      <div class="tc-metric-card ${color}" style="cursor:default;">
        <i data-lucide="${icon}" class="tc-metric-icon"></i>
        <div class="tc-metric-value" style="${style}">${TC_Utils.esc(String(value))}</div>
        <div class="tc-metric-label">${label}</div>
        <div class="text-xs mt-1" style="color:#374151;">${sub}</div>
      </div>
    `;
  },

  _renderWorkload(people) {
    const el = document.getElementById('workload-section');
    if (!el) return;

    if (!people.length) {
      el.innerHTML = `<div class="tc-empty"><h3>Нет данных об участниках</h3></div>`;
      return;
    }

    const rows = people.map(p => {
      let loadCls, loadLabel;
      if (p.active_tasks <= 2)      { loadCls = 'tc-workload-low';    loadLabel = 'Нормальная'; }
      else if (p.active_tasks <= 5) { loadCls = 'tc-workload-medium'; loadLabel = 'Высокая'; }
      else                           { loadCls = 'tc-workload-high';   loadLabel = 'Перегрузка'; }

      const last = p.last_activity ? TC_Utils.timeRelative(p.last_activity) : '—';

      return `<tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="tc-avatar">${TC_Utils.initials(p.full_name)}</div>
            <div>
              <div class="font-medium text-sm">${TC_Utils.esc(p.full_name)}</div>
              <div class="text-muted text-xs">${USER_ROLE[p.role]?.label || p.role}</div>
            </div>
          </div>
        </td>
        <td class="tc-mono text-sm">${p.active_tasks}</td>
        <td style="min-width:120px;">
          <div class="flex items-center gap-2">
            ${TC_Utils.progressBar(p.avg_progress || 0)}
            <span class="tc-mono text-xs text-muted">${p.avg_progress || 0}%</span>
          </div>
        </td>
        <td><span class="tc-status-badge ${loadCls === 'tc-workload-low' ? 'completed' : loadCls === 'tc-workload-medium' ? 'review' : 'cancelled'} text-xs px-2">${loadLabel}</span></td>
        <td class="text-muted text-xs tc-mono">${last}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="p-4 border-b border-border flex items-center justify-between">
        <span class="tc-section-title">Загрузка участников</span>
        <button class="tc-btn-secondary text-xs" onclick="TC.router.navigate('people')">Подробнее</button>
      </div>
      <div class="tc-table-wrap">
        <table class="tc-table">
          <thead><tr>
            <th>Участник</th><th>Актив. задач</th><th>Прогресс</th><th>Загрузка</th><th>Посл. активность</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  /* ── МЕТРИКИ ────────────────────────────────────────────── */
  async _renderMetrics() {
    document.getElementById('main-content').innerHTML = `
      <div class="p-6 space-y-6">
        <div class="tc-chart-wrap"><div class="tc-chart-title">Динамика баланса (30 дней)</div><div style="height:260px;position:relative;"><canvas id="chart-balance"></canvas></div></div>
        <div class="tc-chart-wrap"><div class="tc-chart-title">Доходы и расходы по неделям</div><div style="height:240px;position:relative;"><canvas id="chart-income-expense"></canvas></div></div>
      </div>
    `;
    try {
      const [trend, weekFin] = await Promise.all([TC_API.getBalanceTrend(30), TC_API.getWeeklyFinance()]);
      TC_Charts.renderBalanceTrend('chart-balance', trend);
      TC_Charts.renderIncomeExpenseChart('chart-income-expense', weekFin);
    } catch (e) {
      TC_Toast.show('Ошибка загрузки метрик', 'error');
    }
  },

  /* ── ФИНАНСОВЫЙ ДАШБОРД ─────────────────────────────────── */
  async _renderFinanceDash() {
    document.getElementById('main-content').innerHTML = `
      <div class="p-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div id="fin-income-card"  class="tc-metric-card success tc-skeleton h-20"></div>
          <div id="fin-expense-card" class="tc-metric-card danger tc-skeleton h-20"></div>
          <div id="fin-balance-card" class="tc-metric-card accent tc-skeleton h-20"></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div class="lg:col-span-3 tc-panel">
            <div class="p-4 border-b border-border"><span class="tc-section-title">Последние операции</span></div>
            <div id="fin-ops-table"></div>
          </div>
          <div class="lg:col-span-2 tc-chart-wrap">
            <div class="tc-chart-title">Тренд баланса</div>
            <div style="height:260px;position:relative;"><canvas id="chart-balance-fin"></canvas></div>
          </div>
        </div>
      </div>
    `;
    try {
      const [ops, trend] = await Promise.all([TC_API.getFinanceOps({ limit: 10 }), TC_API.getBalanceTrend(30)]);
      const income  = ops.filter(f => f.type === 'income').reduce((s,f)  => s + +f.amount, 0);
      const expense = ops.filter(f => f.type === 'expense').reduce((s,f) => s + +f.amount, 0);
      const balance = income - expense;

      document.getElementById('fin-income-card').outerHTML = this._metricCard('Доходы (период)', TC_Utils.formatMoney(income, false) + ' ₽', 'Все операции', 'trending-up', 'success');
      document.getElementById('fin-expense-card').outerHTML = this._metricCard('Расходы (период)', TC_Utils.formatMoney(expense, false) + ' ₽', 'Все операции', 'trending-down', 'danger');
      document.getElementById('fin-balance-card').outerHTML = this._metricCard('Сальдо', TC_Utils.formatMoney(balance), 'Доходы − Расходы', 'activity', balance >= 0 ? 'success' : 'danger');

      lucide.createIcons({ nodes: [document.getElementById('main-content')] });
      TC_Charts.renderBalanceTrend('chart-balance-fin', trend);

      const table = document.getElementById('fin-ops-table');
      if (table) {
        if (!ops.length) {
          table.innerHTML = `<div class="tc-empty"><h3>Нет операций</h3><p>Добавьте первую финансовую операцию</p><button class="tc-btn-primary mt-3 text-sm" onclick="TC.router.navigate('finance')">Финансы</button></div>`;
        } else {
          table.innerHTML = `<div class="tc-table-wrap"><table class="tc-table">
            <thead><tr><th>Дата</th><th>Тип</th><th>Категория</th><th>Сумма</th></tr></thead>
            <tbody>${ops.slice(0,8).map(f => `<tr>
              <td class="tc-mono text-xs">${TC_Utils.formatDate(f.op_date)}</td>
              <td>${f.type === 'income' ? '<span class="text-success text-xs font-bold">ДОХОД</span>' : '<span class="text-danger text-xs font-bold">РАСХОД</span>'}</td>
              <td class="text-muted text-xs">${TC_Utils.esc(f.category)}</td>
              <td class="tc-mono text-sm ${f.type === 'income' ? 'text-success' : 'text-danger'}">${f.type === 'income' ? '+' : '−'}${TC_Utils.formatMoney(f.amount, false)} ₽</td>
            </tr>`).join('')}</tbody>
          </table></div>`;
        }
      }
    } catch (e) {
      TC_Toast.show('Ошибка загрузки финансов', 'error');
    }
  },
};
