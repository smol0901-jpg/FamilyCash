/* ============================================================
   TaskControl Pro — Глобальный поиск
   ============================================================ */

const TC_Search = {
  handle: TC_Utils.debounce(async function(query) {
    query = query.trim();
    if (!query || query.length < 2) return;

    /* Если текущий view — задачи, фильтруем прямо в таблице */
    if (TC_State.get('currentView') === 'tasks') {
      const taskSearch = document.getElementById('task-search');
      if (taskSearch) {
        taskSearch.value = query;
        await TC_Views.tasks._onSearch(query);
      }
      return;
    }

    /* Иначе переходим на задачи с поиском */
    await TC.router.navigate('tasks');
    const taskSearch = document.getElementById('task-search');
    if (taskSearch) {
      taskSearch.value = query;
      await TC_Views.tasks._onSearch(query);
    }
  }, 400),
};
