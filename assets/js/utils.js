/* ============================================================
   TaskControl Pro — Утилиты и хелперы
   ============================================================ */

const TC_Utils = {

  /* Форматирование числа: 1234567 → "1 234 567 ₽" */
  formatMoney(n, sign = true) {
    if (n == null || isNaN(n)) return sign ? '0 ₽' : '0';
    const abs = Math.abs(parseFloat(n));
    const formatted = abs.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    if (!sign) return formatted;
    const prefix = n < 0 ? '−' : n > 0 ? '+' : '';
    return `${prefix}${formatted} ₽`;
  },

  /* Форматирование просто числа */
  formatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return parseFloat(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  },

  /* ДД.ММ.ГГГГ */
  formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  /* ДД.ММ.ГГГГ ЧЧ:ММ */
  formatDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  /* Относительное время: "2 часа назад", "через 3 дня" */
  timeRelative(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const diff = dt - Date.now(); // ms
    const abs  = Math.abs(diff);
    const mins  = Math.floor(abs / 60000);
    const hours = Math.floor(abs / 3600000);
    const days  = Math.floor(abs / 86400000);

    let str;
    if (mins < 1)       str = 'только что';
    else if (mins < 60) str = `${mins} мин`;
    else if (hours < 24) str = `${hours} ч`;
    else if (days < 30)  str = `${days} д`;
    else                 str = this.formatDate(d);

    if (diff < 0 && mins >= 1) str = str + ' назад';
    else if (diff > 0 && mins >= 1) str = 'через ' + str;
    return str;
  },

  /* Просрочена ли задача */
  isOverdue(task) {
    if (!task.deadline) return false;
    if (['completed','cancelled'].includes(task.status)) return false;
    return new Date(task.deadline) < new Date();
  },

  /* Инициалы из имени */
  initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  },

  /* Экранирование HTML */
  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /* Рендер HTML статус-бейджа */
  statusBadge(status) {
    const s = TASK_STATUS[status] || { label: status, cls: 'pending' };
    return `<span class="tc-status-badge ${s.cls}">
      <span class="tc-status-dot ${s.cls}"></span>${s.label}
    </span>`;
  },

  /* Рендер HTML приоритет-бейджа */
  priorityBadge(priority) {
    const p = TASK_PRIORITY[priority] || { label: priority, cls: 'low' };
    return `<span class="tc-priority ${p.cls}">${p.label}</span>`;
  },

  /* Рендер группы аватаров */
  avatarGroup(participants, max = 3) {
    if (!participants || !participants.length) return '<span class="text-muted text-xs">—</span>';
    const shown  = participants.slice(0, max);
    const hidden = participants.length - shown.length;
    let html = '<div class="tc-avatar-group">';
    shown.forEach(p => {
      const name = p.full_name || p.contractor_name || '?';
      html += `<div class="tc-avatar" title="${TC_Utils.esc(name)}">${TC_Utils.initials(name)}</div>`;
    });
    if (hidden > 0) {
      html += `<div class="tc-avatar more">+${hidden}</div>`;
    }
    html += '</div>';
    return html;
  },

  /* Прогресс-бар */
  progressBar(pct, overdue = false) {
    const cls = pct >= 100 ? 'complete' : overdue ? 'overdue' : '';
    return `<div class="tc-progress-bar">
      <div class="tc-progress-fill ${cls}" style="width:${pct}%"></div>
    </div>`;
  },

  /* Дебаунс */
  debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /* Генерация UUID (браузерный) */
  uuid() {
    return crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  },

  /* Показать/скрыть спиннер на кнопке */
  btnLoading(btn, loading) {
    if (!btn) return;
    const spin = btn.querySelector('.tc-spinner-sm');
    if (loading) {
      btn.disabled = true;
      if (spin) spin.classList.remove('hidden');
    } else {
      btn.disabled = false;
      if (spin) spin.classList.add('hidden');
    }
  },

  /* Клонировать объект (простой) */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /* Безопасный запрос к Supabase с обработкой ошибки */
  async sbQuery(fn) {
    try {
      const result = await fn();
      if (result.error) throw result.error;
      return result.data;
    } catch (e) {
      console.error('[TC] Supabase error:', e.message);
      TC_Toast.show(e.message || 'Ошибка базы данных', 'error');
      return null;
    }
  },
};
