/* ============================================================
   TaskControl Pro — Модальное окно
   ============================================================ */

const TC_Modal = {
  _currentTaskId: null,
  _currentTab: 'info',

  open(html, opts = {}) {
    const overlay   = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    if (!overlay || !container) return;

    container.innerHTML = html;
    container.style.maxWidth = opts.maxWidth || '760px';
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    /* Переинициализировать иконки */
    lucide.createIcons({ nodes: [container] });

    /* Фокус на первый инпут */
    setTimeout(() => container.querySelector('input')?.focus(), 50);
  },

  close() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    document.getElementById('modal-container').innerHTML = '';
    this._currentTaskId = null;
  },

  handleOverlayClick(e) {
    if (e.target === document.getElementById('modal-overlay')) {
      this.close();
    }
  },

  /* Обновить модалку если она открыта для этой задачи */
  refreshIfOpen() {
    if (!this._currentTaskId) return;
    TC_Views.tasks.openTaskModal(this._currentTaskId, this._currentTab);
  },

  /* Шаблон: стандартная шапка */
  header(title, subtitle = '') {
    return `
      <div class="tc-modal-header">
        <div>
          <h2 class="text-heading font-semibold text-base">${TC_Utils.esc(title)}</h2>
          ${subtitle ? `<p class="text-muted text-xs mt-0.5 font-mono">${TC_Utils.esc(subtitle)}</p>` : ''}
        </div>
        <button class="tc-icon-btn" onclick="TC_Modal.close()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
    `;
  },

  /* Спиннер внутри модалки */
  loading() {
    return `
      ${this.header('Загрузка...')}
      <div class="tc-modal-body p-12 flex items-center justify-center">
        <div class="tc-spinner"></div>
      </div>
    `;
  },
};
