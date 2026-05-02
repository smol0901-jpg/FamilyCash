/* ============================================================
   TaskControl Pro — Аутентификация
   ============================================================ */

const TC_Auth = {

  async init() {
    if (!supabase) {
      TC.ui.showScreen('error');
      document.getElementById('error-message').textContent =
        'Supabase не настроен. Откройте assets/js/config.js и заполните SUPABASE_URL и SUPABASE_ANON_KEY.';
      return false;
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[TC] getSession error:', error.message);
      TC.ui.showScreen('auth');
      return false;
    }

    if (session) {
      await this._onSession(session);
      return true;
    }

    TC.ui.showScreen('auth');
    this._bindKeyboard();
    return false;
  },

  async login() {
    const email    = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const btn      = document.getElementById('auth-submit');
    const errEl    = document.getElementById('auth-error');

    if (!email || !password) {
      this._showError('Введите email и пароль');
      return;
    }

    TC_Utils.btnLoading(btn, true);
    errEl?.classList.add('hidden');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await this._onSession(data.session);
    } catch (e) {
      this._showError(this._mapError(e.message));
    } finally {
      TC_Utils.btnLoading(btn, false);
    }
  },

  async logout() {
    try {
      TC_Realtime.unsubscribeAll();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[TC] logout error:', e.message);
    }
    TC_State.set('currentUser', null);
    TC_State.set('session', null);
    TC.ui.showScreen('auth');
    document.getElementById('auth-email').value    = '';
    document.getElementById('auth-password').value = '';
  },

  async forgotPassword() {
    const email = document.getElementById('auth-email')?.value.trim();
    if (!email) {
      this._showError('Введите email для сброса пароля');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      TC_Toast.show(`Письмо отправлено на ${email}`, 'success');
    } catch (e) {
      this._showError(this._mapError(e.message));
    }
  },

  async _onSession(session) {
    TC_State.set('session', session);

    /* Загружаем профиль */
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        /* Профиль может не существовать если триггер не сработал */
        const fallback = {
          id:        session.user.id,
          full_name: session.user.email.split('@')[0],
          role:      'user',
          is_active: true,
        };
        TC_State.set('currentUser', fallback);
      } else {
        TC_State.set('currentUser', profile);
      }
    } catch (e) {
      console.error('[TC] profile load error:', e.message);
    }

    /* Обновление токена */
    supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') {
        await this.logout();
      }
      if (event === 'TOKEN_REFRESHED' && sess) {
        TC_State.set('session', sess);
      }
    });

    TC.ui.showScreen('app');
    TC.ui.renderUser();
    TC_Realtime.subscribeAll();
    await TC.router.navigate('dashboard');
    TC.ui.updateBadges();
  },

  _showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  _mapError(msg) {
    const map = {
      'Invalid login credentials': 'Неверный email или пароль',
      'Email not confirmed':       'Email не подтверждён',
      'Too many requests':         'Слишком много попыток. Подождите.',
      'User not found':            'Пользователь не найден',
    };
    for (const [k, v] of Object.entries(map)) {
      if (msg.includes(k)) return v;
    }
    return msg;
  },

  _bindKeyboard() {
    const handler = e => {
      if (e.key === 'Enter') TC_Auth.login();
    };
    document.getElementById('auth-email')?.addEventListener('keydown', handler);
    document.getElementById('auth-password')?.addEventListener('keydown', handler);
  },

  /* Проверка прав */
  can(action) {
    const user = TC_State.get('currentUser');
    if (!user) return false;
    if (user.role === 'admin') return true;
    const perms = USER_ROLE[user.role]?.can || [];
    return perms.includes(action) || perms.includes('all');
  },

  isAdmin() {
    return TC_State.get('currentUser')?.role === 'admin';
  },

  isManagerOrAbove() {
    return ['admin','manager'].includes(TC_State.get('currentUser')?.role);
  },
};
