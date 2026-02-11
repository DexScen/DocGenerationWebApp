(function initModalScrollLock() {
  let openCount = 0;

  function lock() {
    openCount += 1;
    document.documentElement.classList.add("is-dialog-open");
  }

  function unlock() {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) {
      document.documentElement.classList.remove("is-dialog-open");
    }
  }

  window.ModalScroll = {
    lock,
    unlock,
  };
})();

(function initRouterModule() {
  const ROUTES = ["home", "orgs", "checks", "verification-areas", "settings", "employees", "admin"];

  let isInitialized = false;

  function getRouterDomRefs() {
    return {
      pageTitle: document.getElementById("pageTitle"),
      pageSubtitle: document.getElementById("pageSubtitle"),
      navItems: Array.from(document.querySelectorAll(".nav__item")),
      pages: Array.from(document.querySelectorAll("[data-page]")),
    };
  }

  function normalizeRoute(rawRoute) {
    const route = String(rawRoute || "")
      .replace(/^#/, "")
      .replace(/^\//, "")
      .split("?")[0]
      .trim();

    return ROUTES.includes(route) ? route : "";
  }

  function getRouteFromLocation() {
    const hashRoute = normalizeRoute(location.hash);
    if (hashRoute) return hashRoute;

    const pathRoute = normalizeRoute(location.pathname);
    if (pathRoute) return pathRoute;

    return "checks";
  }

  function setActiveRoute(route) {
    const { pageTitle, pageSubtitle, navItems, pages } = getRouterDomRefs();

    if (!pages.length) {
      return;
    }

    const isLoggedIn = window.AuthState?.isLoggedIn?.() ?? false;
    const isAdmin = window.AuthState?.isAdmin?.() ?? false;
    let nextRoute = route;

    if (!isLoggedIn) {
      nextRoute = "checks";
    }

    if ((nextRoute === "admin" || nextRoute === "employees") && !isAdmin) {
      nextRoute = "checks";
    }

    pages.forEach((p) => (p.hidden = p.getAttribute("data-page") !== nextRoute));


    navItems.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-route") === nextRoute);
    });


    const map = {
      home: { t: "Главная", s: "Быстрые действия" },
      orgs: { t: "Организации", s: "Список и карточки (в следующем шаге)" },
      checks: { t: "Проверки", s: "Список проверок" },
      "verification-areas": { t: "Области проверки", s: "" },
      settings: { t: "Настройки", s: "Параметры приложения" },
      employees: { t: "Сотрудники", s: "Справочник сотрудников" },
      admin: { t: "Админ-панель", s: "" },
    };

    if (pageTitle && map[nextRoute]) {
      pageTitle.textContent = map[nextRoute].t;
    }
    if (pageSubtitle && map[nextRoute]) {
      pageSubtitle.textContent = map[nextRoute].s;
    }
  }

  function syncRoute() {
    const route = getRouteFromLocation();

    if (location.hash !== `#/${route}`) {
      location.hash = `#/${route}`;
      return;
    }

    setActiveRoute(route);
  }

  function bindRouterHandlers() {
    if (isInitialized) return;
    isInitialized = true;

    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("auth:changed", syncRoute);

    const checksShortcutBtn = document.getElementById("btnChecks");
    if (checksShortcutBtn) {
      checksShortcutBtn.addEventListener("click", () => {
        location.hash = "#/checks";
      });
    }
  }

  function init() {
    bindRouterHandlers();

    if (!location.hash && !normalizeRoute(location.pathname)) {
      location.hash = "#/checks";
    }

    syncRoute();
  }

  window.AppRouter = {
    init,
    syncRoute,
  };
  init();
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
    window.ModalScroll?.unlock?.();
  }

  function openDialog(message, dialogTitle) {
    if (body) body.textContent = message ?? "";
    if (title) title.textContent = dialogTitle || "Сообщение";
    backdrop.hidden = false;
    window.ModalScroll?.lock?.();
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
  const employeesNavItem = document.querySelector('.nav__item[data-route="employees"]');

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
  const adminTabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
  const adminPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));

  const addEmployeeBtn = document.getElementById("adminAddEmployeeBtn");
  const employeeNameInput = document.getElementById("adminEmployeeName");
  const employeeListEl = document.getElementById("adminEmployeeList");
  const employeesListViewEl = document.getElementById("employeesList");

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
  let employees = [];

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

  async function loadEmployees() {
    try {
      const list = await window.Api.request("/employees");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      console.warn("Не удалось загрузить сотрудников", error);
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Нет доступа к списку сотрудников.", "Админ-панель");
      }
      return [];
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
    if (employeesNavItem) {
      employeesNavItem.hidden = !authState.isLoggedIn || !isAdmin;
    }
    if (!isAdmin && location.hash.includes("/admin")) {
      location.hash = "#/checks";
    }
    if (!isAdmin && location.hash.includes("/employees")) {
      location.hash = "#/checks";
    }

    setAuthLockState(!authState.isLoggedIn);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: authState.user }));
  }

  function setAdminTab(tabName) {
    adminPanels.forEach((panel) => {
      panel.hidden = panel.getAttribute("data-admin-panel") !== tabName;
    });
    adminTabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-admin-tab") === tabName;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
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
    window.ModalScroll?.lock?.();
    if (authLoginInput) authLoginInput.focus();
    setAuthStatus("");
  }

  function closeAuthModal() {
    if (!authBackdrop) return;
    if (authState.isAuthLocked && !authState.isLoggedIn) return;
    authBackdrop.hidden = true;
    window.ModalScroll?.unlock?.();
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

  async function handleAddEmployee() {
    const name = (employeeNameInput?.value || "").trim();
    if (!name) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Заполните ФИО сотрудника.", "Сотрудники");
      } else {
        alert("Заполните ФИО сотрудника.");
      }
      return;
    }

    try {
      await window.Api.request("/employees", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await refreshEmployees();
    } catch (error) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog(error.message || "Ошибка сохранения сотрудника.", "Сотрудники");
      }
      return;
    }

    if (employeeNameInput) employeeNameInput.value = "";
  }

  async function handleDeleteEmployee(id) {
    try {
      await window.Api.request(`/employees/${id}`, { method: "DELETE" });
      await refreshEmployees();
    } catch (error) {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog(error.message || "Ошибка удаления сотрудника.", "Сотрудники");
      }
    }
  }

  if (authBtn) authBtn.addEventListener("click", handleAuthClick);
  if (addUserBtn) addUserBtn.addEventListener("click", handleAddUser);
  if (assignRoleBtn) assignRoleBtn.addEventListener("click", handleAssignRole);
  if (addEmployeeBtn) addEmployeeBtn.addEventListener("click", handleAddEmployee);

  adminTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setAdminTab(tab.getAttribute("data-admin-tab"));
    });
  });

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
        await refreshEmployees();
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

  async function refreshEmployees() {
    employees = await loadEmployees();
    renderEmployees();
    window.dispatchEvent(new CustomEvent("employees:updated", { detail: employees }));
  }

  function renderEmployeesList(listElement, options = {}) {
    if (!listElement) return;
    listElement.innerHTML = "";

    if (!employees.length) {
      const empty = document.createElement("div");
      empty.className = "list__empty";
      empty.textContent = "Сотрудники пока не добавлены.";
      listElement.appendChild(empty);
      return;
    }

    employees.forEach((employeeItem) => {
      const row = document.createElement("div");
      row.className = "list__row";

      const text = document.createElement("div");
      text.textContent = employeeItem.name;

      row.appendChild(text);

      if (options.withActions) {
        const del = document.createElement("button");
        del.className = "btn";
        del.type = "button";
        del.textContent = "Удалить";
        del.addEventListener("click", () => handleDeleteEmployee(employeeItem.id));
        row.appendChild(del);
      }

      listElement.appendChild(row);
    });
  }

  function renderEmployees() {
    renderEmployeesList(employeeListEl, { withActions: true });
    renderEmployeesList(employeesListViewEl, { withActions: false });
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
      await refreshEmployees();
    } else {
      openAuthModal();
    }

    if (adminTabs.length) {
      setAdminTab("users");
    }
  }

  initAuth();

  window.AuthState = {
    getUser: () => authState.user,
    isAdmin: () => authState.user?.role === "admin",
    isLoggedIn: () => authState.isLoggedIn,
  };

  window.EmployeesStore = {
    getEmployees: () => employees.slice(),
    refresh: refreshEmployees,
  };
})();
