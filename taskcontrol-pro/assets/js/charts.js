/* ============================================================
   TaskControl Pro — Диаграммы (Chart.js)
   ============================================================ */

const TC_Charts = {
  _instances: {},

  _defaults: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94A3B8',
          font: { family: 'Manrope', size: 12 },
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#111827',
        borderColor: '#1E293B',
        borderWidth: 1,
        titleColor: '#E2E8F0',
        bodyColor: '#94A3B8',
        titleFont: { family: 'Manrope', weight: '600' },
        bodyFont:  { family: 'JetBrains Mono', size: 12 },
        padding: 10,
        callbacks: {},
      },
    },
    scales: {},
  },

  _gridColor: 'rgba(30,41,59,0.8)',
  _tickColor: '#4B5563',

  /* Уничтожить существующий экземпляр перед пересозданием */
  _destroy(id) {
    if (this._instances[id]) {
      this._instances[id].destroy();
      delete this._instances[id];
    }
  },

  /* ── Круговая диаграмма статусов ── */
  renderStatusChart(canvasId, stats) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const data = [
      stats.completed   || 0,
      stats.in_progress || 0,
      stats.review      || 0,
      stats.pending     || 0,
      stats.cancelled   || 0,
    ];
    if (data.every(v => v === 0)) {
      canvas.parentElement.innerHTML = this._emptyChart('Нет задач');
      return;
    }

    this._instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Завершена','В работе','Проверка','Не начата','Отменена'],
        datasets: [{
          data,
          backgroundColor: ['#10B981','#3B82F6','#F59E0B','#4B5563','#EF4444'],
          borderWidth: 2,
          borderColor: '#111827',
          hoverBorderWidth: 0,
        }],
      },
      options: {
        ...this._defaults,
        cutout: '68%',
        plugins: {
          ...this._defaults.plugins,
          legend: {
            ...this._defaults.plugins.legend,
            position: 'right',
          },
          tooltip: {
            ...this._defaults.plugins.tooltip,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} задач`,
            },
          },
        },
      },
    });
  },

  /* ── Столбчатая: план vs факт по неделям ── */
  renderWeeklyChart(canvasId, weekData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this._instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weekData.map(w => w.label),
        datasets: [
          {
            label: 'План',
            data: weekData.map(w => w.plan),
            backgroundColor: 'rgba(59,130,246,0.3)',
            borderColor: '#3B82F6',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Факт',
            data: weekData.map(w => w.fact),
            backgroundColor: 'rgba(16,185,129,0.4)',
            borderColor: '#10B981',
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...this._defaults,
        scales: {
          x: { ticks: { color: this._tickColor, font: { family: 'Manrope', size: 11 } }, grid: { color: this._gridColor } },
          y: {
            ticks: { color: this._tickColor, font: { family: 'JetBrains Mono', size: 11 }, stepSize: 1 },
            grid: { color: this._gridColor },
            beginAtZero: true,
          },
        },
        plugins: { ...this._defaults.plugins },
      },
    });
  },

  /* ── Линейная: баланс нарастающим итогом ── */
  renderBalanceTrend(canvasId, trendData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const allZero = trendData.every(d => d.balance === 0);
    if (allZero) {
      canvas.parentElement.innerHTML = this._emptyChart('Нет финансовых данных');
      return;
    }

    this._instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: trendData.map(d => {
          const dt = new Date(d.date);
          return `${dt.getDate()}.${String(dt.getMonth()+1).padStart(2,'0')}`;
        }),
        datasets: [{
          label: 'Баланс',
          data: trendData.map(d => d.balance),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        ...this._defaults,
        scales: {
          x: {
            ticks: { color: this._tickColor, font: { family: 'Manrope', size: 10 }, maxTicksLimit: 10 },
            grid: { color: this._gridColor },
          },
          y: {
            ticks: {
              color: this._tickColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => TC_Utils.formatMoney(v, false),
            },
            grid: { color: this._gridColor },
          },
        },
        plugins: {
          ...this._defaults.plugins,
          tooltip: {
            ...this._defaults.plugins.tooltip,
            callbacks: {
              label: ctx => ` ${TC_Utils.formatMoney(ctx.parsed.y)}`,
            },
          },
          legend: { display: false },
        },
      },
    });
  },

  /* ── Столбчатая: доходы vs расходы по неделям ── */
  renderIncomeExpenseChart(canvasId, weekData) {
    this._destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this._instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weekData.map(w => w.label),
        datasets: [
          {
            label: 'Доходы',
            data: weekData.map(w => w.income),
            backgroundColor: 'rgba(16,185,129,0.4)',
            borderColor: '#10B981',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Расходы',
            data: weekData.map(w => w.expense),
            backgroundColor: 'rgba(239,68,68,0.3)',
            borderColor: '#EF4444',
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...this._defaults,
        scales: {
          x: { ticks: { color: this._tickColor, font: { family: 'Manrope', size: 11 } }, grid: { color: this._gridColor } },
          y: {
            ticks: {
              color: this._tickColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: v => TC_Utils.formatMoney(v, false),
            },
            grid: { color: this._gridColor },
            beginAtZero: true,
          },
        },
        plugins: { ...this._defaults.plugins },
      },
    });
  },

  _emptyChart(msg) {
    return `<div class="tc-empty" style="padding:32px 0;">
      <p class="text-muted text-sm">${msg}</p>
    </div>`;
  },

  /* Уничтожить все при смене вкладки */
  destroyAll() {
    Object.keys(this._instances).forEach(id => this._destroy(id));
  },
};
