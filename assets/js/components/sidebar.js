/* ============================================================
   TaskControl Pro — Боковая панель
   ============================================================ */

const TC_Sidebar = {
  setActive(view) {
    document.querySelectorAll('.tc-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    /* Показать "Админ" только для admin */
    const adminLink = document.getElementById('nav-admin');
    if (adminLink) {
      adminLink.classList.toggle('hidden', !TC_Auth.isAdmin());
    }
  },

  updateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? '99+' : count;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  },
};
