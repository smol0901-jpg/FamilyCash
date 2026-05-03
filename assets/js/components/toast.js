/* ============================================================
   TaskControl Pro — Toast-уведомления
   ============================================================ */

const TC_Toast = {
  show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    const colorMap = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };

    const el = document.createElement('div');
    el.className = `tc-toast ${type}`;
    el.innerHTML = `
      <i data-lucide="${iconMap[type] || 'info'}" style="width:16px;height:16px;color:${colorMap[type]};flex-shrink:0;margin-top:1px;"></i>
      <span style="flex:1;color:#E2E8F0;font-size:13px;">${TC_Utils.esc(message)}</span>
      <button onclick="this.closest('.tc-toast').remove()" style="color:#4B5563;flex-shrink:0;">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;
    container.appendChild(el);
    lucide.createIcons({ nodes: [el] });

    if (duration > 0) {
      setTimeout(() => {
        el.style.animation = 'toast-out 0.25s ease forwards';
        setTimeout(() => el.remove(), 250);
      }, duration);
    }
  },
};
