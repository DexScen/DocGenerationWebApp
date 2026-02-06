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

(function initApi() {
  async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.message || "Ошибка запроса";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  window.Api = { request };
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

  let users = [];

  async function loadUsers() {
    try {
      const list = await window.Api.request("/users");
      return Array.isArray(list) ? list.map((entry) => ({ ...entry, role: normalizeRole(entry.role) })) : [];
    } catch (error) {
      console.warn("Не удалось загрузить пользователей", error);
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Нет доступа к списку пользователей.", "Админ-панель");
      }
      return [];
    }
  }

  async function loadSession() {
    try {
      return await window.Api.request("/auth/me");
    } catch (error) {
      return null;
    }
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
      deleteBtn.addEventListener("click", async () => {
        if (authState.user?.id === user.id) return;
        if (!window.confirm(`Удалить пользователя «${user.name}»?`)) return;
        try {
          await window.Api.request(`/users/${user.id}`, { method: "DELETE" });
          await refreshUsers();
        } catch (error) {
          if (window.AppDialog?.openDialog) {
            window.AppDialog.openDialog(error.message || "Ошибка удаления пользователя.", "Админ-панель");
          }
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

  async function handleAuthClick() {
    if (!authState.isLoggedIn) {
      openAuthModal();
      return;
    }

    authState.isLoggedIn = false;
    authState.user = null;
    try {
      await window.Api.request("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Не удалось завершить сессию", error);
    }
    renderAuth();
  }

  async function handleAddUser() {
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

    try {
      await window.Api.request("/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          login,
          password,
          role: normalizeRole(role),
        }),
      });
      await refreshUsers();
    } catch (error) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog(error.message || "Ошибка сохранения пользователя.", "Админ-панель");
      }
      return;
    }

    userNameInput.value = "";
    userLoginInput.value = "";
    userPasswordInput.value = "";
    if (userRoleInput) userRoleInput.value = "user";
  }

  async function handleAssignRole() {
    if (!userSelectEl || !roleSelectEl) return;
    const userId = Number(userSelectEl.value);
    const role = roleSelectEl.value;
    try {
      await window.Api.request(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: normalizeRole(role) }),
      });
      await refreshUsers();
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Права обновлены.", "Админ-панель");
      }
    } catch (error) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog(error.message || "Ошибка обновления прав.", "Админ-панель");
      }
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
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const login = (authLoginInput?.value || "").trim();
      const password = (authPasswordInput?.value || "").trim();
      try {
        const response = await window.Api.request("/auth/login", {
          method: "POST",
          body: JSON.stringify({ login, password }),
        });
        authState.isLoggedIn = true;
        authState.user = response.user;
        closeAuthModal();
        renderAuth();
        await refreshUsers();
      } catch (error) {
        if (error.status === 403) {
          setAuthStatus("Вы зарегистрированы в системе, но у вас нет прав для работы с ней.");
          if (authPasswordInput) authPasswordInput.value = "";
          return;
        }
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog(error.message || "Неверный логин или пароль.", "Вход");
        } else {
          alert(error.message || "Неверный логин или пароль.");
        }
        setAuthStatus("");
      }
    });
  }

  async function refreshUsers() {
    users = await loadUsers();
    renderUsers();
  }

  async function initAuth() {
    const storedSession = await loadSession();
    if (storedSession) {
      authState.isLoggedIn = true;
      authState.user = storedSession;
    }
    renderAuth();
    if (authState.isLoggedIn) {
      await refreshUsers();
    } else {
      openAuthModal();
    }
  }

  initAuth();

  window.AuthState = {
    getUser: () => authState.user,
    isAdmin: () => authState.user?.role === "admin",
    isLoggedIn: () => authState.isLoggedIn,
  };
})();
