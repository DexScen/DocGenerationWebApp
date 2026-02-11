(function initPeopleModal(){
  const backdrop = document.getElementById("peopleModalBackdrop");
  if (!backdrop) return;

  const titleEl = document.getElementById("peopleModalTitle");
  const closeBtn = document.getElementById("peopleModalClose");
  const cancelBtn = document.getElementById("peopleCancelBtn");
  const applyBtn = document.getElementById("peopleApplyBtn");
  const editBtn = document.getElementById("peopleEditBtn");

  const listEl = document.getElementById("peopleCheckboxList");

  let selected = new Set();
  let onApply = null;

  function getEmployeeNames() {
    const store = window.EmployeesStore;
    const list = store?.getEmployees?.() || [];
    return list
      .map((employee) => (typeof employee === "string" ? employee : employee?.name))
      .filter(Boolean);
  }

  function renderSelection(){
    listEl.innerHTML = "";

    const employees = getEmployeeNames();

    if (!employees.length){
      const empty = document.createElement("div");
      empty.className = "list__empty";
      empty.textContent = "Сотрудники пока не добавлены.";
      listEl.appendChild(empty);
      return;
    }

    employees.forEach((fio) => {
      const row = document.createElement("label");
      row.className = "list__row list__row--check";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(fio);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selected.add(fio);
        } else {
          selected.delete(fio);
        }
      });

      const text = document.createElement("div");
      text.textContent = fio;

      row.appendChild(checkbox);
      row.appendChild(text);
      listEl.appendChild(row);
    });
  }

  function refreshEmployeesList() {
    const store = window.EmployeesStore;
    if (store?.refresh) {
      store.refresh().then(renderSelection).catch(renderSelection);
      return;
    }
    renderSelection();
  }

  function openModal(opts){
    // opts: { title, initial: string[], onApply: (list)=>void }
    titleEl.textContent = opts?.title || "Выбор уполномоченных";
    onApply = typeof opts?.onApply === "function" ? opts.onApply : null;
    selected = new Set(Array.isArray(opts?.initial) ? opts.initial : []);
    refreshEmployeesList();

    backdrop.hidden = false;
    backdrop.style.zIndex = "1100";
    if (window.ModalScroll?.lock) {
      window.ModalScroll.lock();
    } else {
      document.documentElement.classList.add("is-dialog-open");
    }
  }

  function closeModal(){
    backdrop.hidden = true;
    backdrop.style.removeProperty("z-index");
    if (window.ModalScroll?.unlock) {
      window.ModalScroll.unlock();
    } else {
      document.documentElement.classList.remove("is-dialog-open");
    }
    onApply = null;
  }

  applyBtn.addEventListener("click", () => {
    if (onApply) {
      const employees = getEmployeeNames();
      const list = employees.filter((fio) => selected.has(fio));
      onApply(list);
    }
    closeModal();
  });

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      closeModal();
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Список сотрудников редактируется в разделе «Сотрудники».", "Сотрудники");
      }
      location.hash = "#/employees";
    });
  }

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!backdrop.hidden) closeModal();
    }
  });

  window.addEventListener("employees:updated", () => {
    if (!backdrop.hidden) {
      renderSelection();
    }
  });

  window.PeopleModal = { open: openModal, close: closeModal };
})();
