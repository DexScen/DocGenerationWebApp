(function () {
  const ROUTES = ["home", "orgs", "checks", "settings"];

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  const navItems = Array.from(document.querySelectorAll(".nav__item"));
  const pages = Array.from(document.querySelectorAll("[data-page]"));

  document.getElementById("btnChecks").addEventListener("click", () => {
    location.hash = "#/checks";
  });

  document.getElementById("btnHelp").addEventListener("click", () => {
    if (window.AppDialog?.openDialog) {
      window.AppDialog.openDialog("Пока пусто", "Справка");
    } else {
      alert("Шаг 1: навигация + главная. Дальше добавим страницы и формы.");
    }
  });

  function getRouteFromHash() {
    const h = (location.hash || "#/home").replace("#/", "");
    const route = h.split("?")[0].trim();
    return ROUTES.includes(route) ? route : "home";
  }

  function setActiveRoute(route) {
    pages.forEach((p) => (p.hidden = p.getAttribute("data-page") !== route));


    navItems.forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });


    const map = {
      home: { t: "Главная", s: "Быстрые действия" },
      orgs: { t: "Организации", s: "Список и карточки (в следующем шаге)" },
      checks: { t: "Проверки", s: "Список проверок (в следующем шаге)" },
      settings: { t: "Настройки", s: "Параметры приложения" },
    };

    pageTitle.textContent = map[route].t;
    pageSubtitle.textContent = map[route].s;
  }

  window.addEventListener("hashchange", () => {
    setActiveRoute(getRouteFromHash());
  });


  if (!location.hash) location.hash = "#/home";
  setActiveRoute(getRouteFromHash());
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
