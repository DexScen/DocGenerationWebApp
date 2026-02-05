(function () {
  const ROUTES = ["home", "orgs", "checks", "settings", "admin"];

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  const navItems = Array.from(document.querySelectorAll(".nav__item"));
  const pages = Array.from(document.querySelectorAll("[data-page]"));

  document.getElementById("btnChecks").addEventListener("click", () => {
    location.hash = "#/checks";
  });

  function getRouteFromHash() {
    const h = (location.hash || "#/home").replace("#/", "");
    const route = h.split("?")[0].trim();
    return ROUTES.includes(route) ? route : "home";
  }

  function setActiveRoute(route) {
    const isLoggedIn = window.AuthState?.isLoggedIn?.() ?? false;
    const isAdmin = window.AuthState?.isAdmin?.() ?? false;
    let nextRoute = route;

    if (!isLoggedIn) {
      nextRoute = "home";
    }

    if (nextRoute === "admin" && !isAdmin) {
      nextRoute = "home";
    }

    pages.forEach((p) => (p.hidden = p.getAttribute("data-page") !== nextRoute));


    navItems.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-route") === nextRoute);
    });


    const map = {
      home: { t: "Главная", s: "Быстрые действия" },
      orgs: { t: "Организации", s: "Список и карточки (в следующем шаге)" },
      checks: { t: "Проверки", s: "Список проверок" },
      settings: { t: "Настройки", s: "Параметры приложения" },
      admin: { t: "Админ-панель", s: "Управление пользователями (заглушка)" },
    };

    pageTitle.textContent = map[nextRoute].t;
    pageSubtitle.textContent = map[nextRoute].s;
  }

  function syncRoute() {
    setActiveRoute(getRouteFromHash());
  }

  window.addEventListener("hashchange", syncRoute);
  window.addEventListener("auth:changed", syncRoute);


  if (!location.hash) location.hash = "#/home";
  syncRoute();
})();

(function initDialog() {
  const backdrop = document.getElementById("dialogBackdrop");
  const btnClose = document.getElementById("dialogClose");
  const btnOk = document.getElementById("dialogOk");
  const body = document.getElementById("dialogBody");
  const title = document.getElementById("dialogTitle");

  if (!backdrop) return;

  function closeDialog() {
    backdrop.hidden = true;

    if (body) body.textContent = "";
    if (title) title.textContent = "Сообщение";
    document.documentElement.classList.remove("is-dialog-open");
  }

  function openDialog(message, dialogTitle) {
    if (body) body.textContent = message ?? "";
    if (title) title.textContent = dialogTitle || "Сообщение";
    backdrop.hidden = false;
    document.documentElement.classList.add("is-dialog-open");
  }


  closeDialog();


  if (btnClose) btnClose.addEventListener("click", closeDialog);
  if (btnOk) btnOk.addEventListener("click", closeDialog);


  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeDialog();
  });


  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeDialog();
  });


  window.AppDialog = { openDialog, closeDialog };
})();

(function initAuthAndAdmin() {
  const authBtn = document.getElementById("btnAuth");
  const userChip = document.getElementById("userChip");
  const userNameEl = document.getElementById("userName");
  const adminNavItem = document.querySelector('.nav__item[data-route="admin"]');

  const authBackdrop = document.getElementById("authModalBackdrop");
  const authCloseBtn = document.getElementById("authModalClose");
  const authCancelBtn = document.getElementById("authModalCancel");
  const authForm = document.getElementById("authForm");
  const authLoginInput = document.getElementById("authLogin");
  const authPasswordInput = document.getElementById("authPassword");
  const authStatusEl = document.getElementById("authStatus");

  const addUserBtn = document.getElementById("adminAddUserBtn");
  const userNameInput = document.getElementById("adminUserName");
  const userLoginInput = document.getElementById("adminUserLogin");
  const userPasswordInput = document.getElementById("adminUserPassword");
  const userRoleInput = document.getElementById("adminUserRole");
  const userListEl = document.getElementById("adminUserList");
  const userSelectEl = document.getElementById("adminUserSelect");
  const roleSelectEl = document.getElementById("adminRoleSelect");
  const assignRoleBtn = document.getElementById("adminAssignRoleBtn");

  const authState = {
    isLoggedIn: false,
    user: null,
    isAuthLocked: true,
  };

  const AUTH_STORAGE_KEY = "authSession";
  const USERS_STORAGE_KEY = "usersCache";

  const defaultUsers = [
    { id: 1, name: "Иванов Иван Иванович", login: "admin", password: "admin123", role: "admin" },
    { id: 2, name: "Петрова Анна Сергеевна", login: "petrova", password: "user123", role: "user" },
  ];

  const ROLE_LABELS = {
    admin: "Администратор",
    user: "Пользователь",
    no_access: "Нет прав",
  };

  function normalizeRole(role) {
    if (role === "admin") return "admin";
    if (role === "no_access") return "no_access";
    return "user";
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((entry) => ({
          ...entry,
          role: normalizeRole(entry.role),
        }));
      }
    } catch (error) {
      console.warn("Не удалось загрузить пользователей", error);
    }
    return [...defaultUsers];
  }

  function saveUsers(list) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
  }

  let users = loadUsers();

  function loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.id) return null;
      const user = users.find((entry) => entry.id === parsed.id);
      if (!user) return null;
      if (user.role === "no_access") return null;
      return { id: user.id, name: user.name, login: user.login, role: user.role };
    } catch (error) {
      console.warn("Не удалось восстановить сессию", error);
      return null;
    }
  }

  function saveSession(user) {
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: user.id }));
  }

  function setAuthLockState(isLocked) {
    authState.isAuthLocked = isLocked;
    document.documentElement.classList.toggle("is-auth-required", isLocked);
    if (authCloseBtn) authCloseBtn.hidden = isLocked;
    if (authCancelBtn) authCancelBtn.hidden = isLocked;
  }

  function renderAuth() {
    if (!authBtn || !userChip || !userNameEl) return;
    if (authState.isLoggedIn && authState.user) {
      authBtn.textContent = "Выход";
      userChip.hidden = false;
      userNameEl.textContent = authState.user.name;
    } else {
      authBtn.textContent = "Вход";
      userChip.hidden = true;
      userNameEl.textContent = "—";
    }

    const isAdmin = authState.user?.role === "admin";
    if (adminNavItem) {
      adminNavItem.hidden = !authState.isLoggedIn || !isAdmin;
    }
    if (!isAdmin && location.hash.includes("/admin")) {
      location.hash = "#/home";
    }

    setAuthLockState(!authState.isLoggedIn);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: authState.user }));
  }

  function setAuthStatus(message) {
    if (!authStatusEl) return;
    authStatusEl.textContent = message || "";
    authStatusEl.hidden = !message;
  }

  function renderUsers() {
    if (!userListEl || !userSelectEl) return;
    userListEl.innerHTML = "";
    userSelectEl.innerHTML = "";

    if (!users.length) {
      const empty = document.createElement("div");
      empty.className = "list__empty";
      empty.textContent = "Пользователей пока нет.";
      userListEl.appendChild(empty);
      return;
    }

    users.forEach((user) => {
      const row = document.createElement("div");
      row.className = "list__row";

      const text = document.createElement("div");
      text.textContent = `${user.name} (${user.login}) • пароль: ${user.password}`;

      const role = document.createElement("div");
      role.className = "badge";
      role.textContent = ROLE_LABELS[user.role] || user.role;

      const actions = document.createElement("div");
      actions.className = "list__actions";
      actions.appendChild(role);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn--ghost";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Удалить";
      deleteBtn.dataset.userId = String(user.id);
      if (authState.user?.id === user.id) {
        deleteBtn.disabled = true;
        deleteBtn.title = "Нельзя удалить текущего пользователя";
      }
      deleteBtn.addEventListener("click", () => {
        if (authState.user?.id === user.id) return;
        if (window.confirm(`Удалить пользователя «${user.name}»?`)) {
          users = users.filter((entry) => entry.id !== user.id);
          saveUsers(users);
          renderUsers();
        }
      });

      actions.appendChild(deleteBtn);

      row.appendChild(text);
      row.appendChild(actions);
      userListEl.appendChild(row);

      const option = document.createElement("option");
      option.value = String(user.id);
      option.textContent = `${user.name} • ${user.login}`;
      userSelectEl.appendChild(option);
    });
  }

  function openAuthModal() {
    if (!authBackdrop) return;
    authBackdrop.hidden = false;
    document.documentElement.classList.add("is-dialog-open");
    if (authLoginInput) authLoginInput.focus();
    setAuthStatus("");
  }

  function closeAuthModal() {
    if (!authBackdrop) return;
    if (authState.isAuthLocked && !authState.isLoggedIn) return;
    authBackdrop.hidden = true;
    document.documentElement.classList.remove("is-dialog-open");
    if (authForm) authForm.reset();
    setAuthStatus("");
  }

  function handleAuthClick() {
    if (!authState.isLoggedIn) {
      openAuthModal();
      return;
    }

    authState.isLoggedIn = false;
    authState.user = null;
    saveSession(null);
    renderAuth();
  }

  function handleAddUser() {
    const name = (userNameInput?.value || "").trim();
    const login = (userLoginInput?.value || "").trim();
    const password = (userPasswordInput?.value || "").trim();
    const role = (userRoleInput?.value || "user").trim();
    if (!name || !login || !password) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Заполните ФИО, логин и пароль пользователя.", "Добавление пользователя");
      } else {
        alert("Заполните ФИО, логин и пароль пользователя.");
      }
      return;
    }

    users = [
      ...users,
      {
        id: Date.now(),
        name,
        login,
        password,
        role: normalizeRole(role),
      },
    ];
    saveUsers(users);

    userNameInput.value = "";
    userLoginInput.value = "";
    userPasswordInput.value = "";
    if (userRoleInput) userRoleInput.value = "user";
    renderUsers();
  }

  function handleAssignRole() {
    if (!userSelectEl || !roleSelectEl) return;
    const userId = Number(userSelectEl.value);
    const role = roleSelectEl.value;
    const user = users.find((entry) => entry.id === userId);
    if (!user) return;
    user.role = normalizeRole(role);
    saveUsers(users);
    renderUsers();

    if (window.AppDialog?.openDialog) {
      window.AppDialog.openDialog("Права обновлены (заглушка).", "Админ-панель");
    }
  }

  if (authBtn) authBtn.addEventListener("click", handleAuthClick);
  if (addUserBtn) addUserBtn.addEventListener("click", handleAddUser);
  if (assignRoleBtn) assignRoleBtn.addEventListener("click", handleAssignRole);

  if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);
  if (authCancelBtn) authCancelBtn.addEventListener("click", closeAuthModal);
  if (authBackdrop) {
    authBackdrop.addEventListener("click", (e) => {
      if (e.target === authBackdrop) closeAuthModal();
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const login = (authLoginInput?.value || "").trim();
      const password = (authPasswordInput?.value || "").trim();
      const user = users.find((entry) => entry.login === login && entry.password === password);
      if (!user) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog("Неверный логин или пароль.", "Вход");
        } else {
          alert("Неверный логин или пароль.");
        }
        setAuthStatus("");
        return;
      }
      if (user.role === "no_access") {
        setAuthStatus("Вы зарегистрированы в системе, но у вас нет прав для работы с ней.");
        if (authPasswordInput) authPasswordInput.value = "";
        return;
      }
      authState.isLoggedIn = true;
      authState.user = { id: user.id, name: user.name, login: user.login, role: user.role };
      saveSession(authState.user);
      closeAuthModal();
      renderAuth();
    });
  }

  const storedSession = loadSession();
  if (storedSession) {
    authState.isLoggedIn = true;
    authState.user = storedSession;
  }

  renderAuth();
  renderUsers();
  if (!authState.isLoggedIn) {
    openAuthModal();
  }

  window.AuthState = {
    getUser: () => authState.user,
    isAdmin: () => authState.user?.role === "admin",
    isLoggedIn: () => authState.isLoggedIn,
  };
})();
