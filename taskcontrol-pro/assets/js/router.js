/* ============================================================
   TaskControl Pro — Роутер
   ============================================================ */

const TC_Router = {

  SUBTABS: {
    dashboard:     ['Обзор','Метрики','Финансовый'],
    tasks:         ['Все','Мои','Делегированные','Срочные','Просроченные'],
    projects:      ['Активные','Завершённые','Архив'],
    calendar:      ['День','Неделя','Месяц'],
    people:        ['Сотрудники','Подрядчики'],
    finance:       ['Все операции','Доходы','Расходы','По задачам'],
    control:       ['Просроченные','На проверке','Ожидающие'],
    reports:       ['По задачам','По людям','По финансам','Сводный'],
    notifications: ['Все','Непрочитанные'],
    telegram:      ['Настройки','Шаблоны','История'],
    journal:       ['Все действия','По задаче','По пользователю'],
    settings:      ['Профиль','Пользователи','Система'],
    admin:         ['Пользователи','Роли','Журнал','База данных'],
  },

  async navigate(view, subtab = null) {
    if (!TC_State.get('currentUser')) return;

    TC_Modal.close();
    TC_Charts.destroyAll();

    TC_State.set('currentView', view);
    TC_State.set('currentSubtab', subtab || 0);

    TC_Sidebar.setActive(view);
    this._renderSubtabs(view, subtab || 0);
    this._updateBreadcrumb(view);

    /* Навигация к соответствующему view */
    const viewMap = {
      dashboard:     TC_Views.dashboard,
      tasks:         TC_Views.tasks,
      projects:      TC_Views.projects,
      calendar:      TC_Views.calendar,
      people:        TC_Views.people,
      finance:       TC_Views.finance,
      control:       TC_Views.control,
      reports:       TC_Views.reports,
      notifications: TC_Views.notifications,
      telegram:      TC_Views.telegram,
      journal:       TC_Views.journal,
      settings:      TC_Views.settings,
      admin:         TC_Views.settings, // тот же модуль, другая вкладка
    };

    const viewModule = viewMap[view];
    if (viewModule?.render) {
      const content = document.getElementById('main-content');
      if (content) {
        content.innerHTML = `<div class="flex items-center justify-center py-24"><div class="tc-spinner"></div></div>`;
      }
      try {
        await viewModule.render(subtab || 0);
      } catch (e) {
        console.error(`[TC] View ${view} error:`, e);
        TC_Toast.show(`Ошибка загрузки раздела: ${e.message}`, 'error');
      }
    }
  },

  _renderSubtabs(view, activeIdx) {
    const bar   = document.getElementById('subtab-bar');
    const tabs  = this.SUBTABS[view] || [];
    if (!bar) return;

    if (!tabs.length) {
      bar.innerHTML = '';
      bar.style.display = 'none';
      return;
    }

    bar.style.display = '';
    bar.innerHTML = tabs.map((t, i) =>
      `<button class="tc-subtab ${i === activeIdx ? 'active' : ''}"
        onclick="TC.router.navigate('${view}', ${i})">${t}</button>`
    ).join('');
  },

  _updateBreadcrumb(view) {
    const labels = {
      dashboard: 'Дашборд', tasks: 'Задачи', projects: 'Проекты',
      calendar: 'Календарь', people: 'Люди', finance: 'Финансы',
      control: 'Контроль', reports: 'Отчёты', notifications: 'Уведомления',
      telegram: 'Telegram', journal: 'Журнал', settings: 'Настройки', admin: 'Администрирование',
    };
    const el = document.getElementById('breadcrumb-current');
    if (el) el.textContent = labels[view] || view;
  },
};
