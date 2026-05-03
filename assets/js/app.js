/* ============================================================
   TaskControl Pro — Главный модуль приложения
   Точка входа: TC.init() вызывается при загрузке страницы
   ============================================================ */

/* Объявляем пустой контейнер для views до загрузки файлов */
const TC_Views = TC_Views || {};

const TC = {

  /* ── Ссылки на модули (для удобства вызова из HTML) ── */
  auth:    null,
  router:  null,
  ui:      null,
  search:  null,
  tasks:   null,

  /* ── Инициализация при загрузке страницы ── */
  async init() {
    /* Привязываем глобальные модули */
    TC.auth   = TC_Auth;
    TC.router = TC_Router;
    TC.search = TC_Search;
    TC.tasks  = TC_Views.tasks;

    /* UI-утилиты */
    TC.ui = {

      showScreen(name) {
        const screens = ['loading','error','auth','app'];
        screens.forEach(s => {
          const el = document.getElementById(`screen-${s}`);
          if (!el) return;
          el.classList.toggle('hidden', s !== name);
          /* Flex/block для app */
          if (s === 'app') {
            el.style.display = s === name ? 'flex' : 'none';
          }
        });
      },

      renderUser() {
        const user = TC_State.get('currentUser');
        if (!user) return;
        const avatarEl = document.getElementById('sidebar-avatar');
        const nameEl   = document.getElementById('sidebar-name');
        const roleEl   = document.getElementById('sidebar-role');
        if (avatarEl) avatarEl.textContent = TC_Utils.initials(user.full_name);
        if (nameEl)   nameEl.textContent   = user.full_name;
        if (roleEl)   roleEl.textContent   = USER_ROLE[user.role]?.label || user.role;

        /* Показать/скрыть Admin */
        const adminLink = document.getElementById('nav-admin');
        if (adminLink) adminLink.classList.toggle('hidden', !TC_Auth.isAdmin());
      },

      async updateBadges() {
        try {
          /* Просроченные задачи */
          const { count: overdueCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .lt('deadline', new Date().toISOString())
            .not('status', 'in', '("completed","cancelled")');

          TC_Sidebar.updateBadge('nav-badge-overdue', overdueCount || 0);

          /* Непрочитанные уведомления */
          const uid = TC_State.get('currentUser')?.id;
          if (uid) {
            const { count: notifCount } = await supabase
              .from('notifications')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('is_read', false);

            TC_Sidebar.updateBadge('nav-badge-notif', notifCount || 0);
            const topEl = document.getElementById('topbar-notif-count');
            if (topEl) {
              topEl.textContent = notifCount || 0;
              topEl.classList.toggle('hidden', !notifCount);
            }
          }
        } catch (e) {
          /* Не критично — просто не обновляем бейджи */
        }
      },

      toggleSidebar() {
        const sidebar  = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar) return;
        sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('visible');
      },
    };

    /* Инициализируем иконки */
    lucide.createIcons();

    /* Навигация по кликам в сайдбаре */
    document.querySelectorAll('.tc-nav-item[data-view]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        TC.router.navigate(el.dataset.view);
        /* Закрыть мобильный сайдбар */
        if (window.innerWidth < 768) TC.ui.toggleSidebar();
      });
    });

    /* Закрытие контекстного меню */
    document.addEventListener('click', () => {
      document.getElementById('context-menu')?.classList.add('hidden');
    });

    /* Закрытие модалки по Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') TC_Modal.close();
    });

    /* Запуск аутентификации */
    TC.ui.showScreen('loading');
    await TC_Auth.init();
  },
};

/* ── Запуск после загрузки DOM ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', TC.init.bind(TC));
} else {
  TC.init();
}
