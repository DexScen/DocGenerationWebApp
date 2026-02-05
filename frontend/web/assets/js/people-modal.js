// web/assets/js/people-modal.js

(function initPeopleModal(){
  const backdrop = document.getElementById("peopleModalBackdrop");
  const manageBackdrop = document.getElementById("peopleManageBackdrop");
  if (!backdrop || !manageBackdrop) return;

  const titleEl = document.getElementById("peopleModalTitle");
  const closeBtn = document.getElementById("peopleModalClose");
  const cancelBtn = document.getElementById("peopleCancelBtn");
  const applyBtn = document.getElementById("peopleApplyBtn");
  const editBtn = document.getElementById("peopleEditBtn");

  const manageCloseBtn = document.getElementById("peopleManageClose");
  const manageCancelBtn = document.getElementById("peopleManageCancelBtn");

  const nameInput = document.getElementById("peopleNameInput");
  const addBtn = document.getElementById("peopleAddBtn");
  const listEl = document.getElementById("peopleCheckboxList");
  const manageListEl = document.getElementById("peopleManageList");

  const peopleStore = [];
  let selected = new Set();
  let onApply = null;

  function savePersonStub(fio) {
    console.log(`[stub] save person to db: ${fio}`);
  }

  function normalizeFio(s){
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function addToStore(fio){
    if (!fio || peopleStore.includes(fio)) return;
    peopleStore.push(fio);
    savePersonStub(fio);
  }

  function ensurePeople(list){
    (list || []).forEach(addToStore);
  }

  function renderSelection(){
    listEl.innerHTML = "";

    if (!peopleStore.length){
      const empty = document.createElement("div");
      empty.className = "list__empty";
      empty.textContent = "Пока никого нет. Нажми «Изменить», чтобы добавить.";
      listEl.appendChild(empty);
      return;
    }

    peopleStore.forEach((fio) => {
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

  function renderManage(){
    manageListEl.innerHTML = "";

    if (!peopleStore.length){
      const empty = document.createElement("div");
      empty.className = "list__empty";
      empty.textContent = "Пока никого нет. Добавь ФИО выше.";
      manageListEl.appendChild(empty);
      return;
    }

    peopleStore.forEach((fio, idx) => {
      const row = document.createElement("div");
      row.className = "list__row";

      const text = document.createElement("div");
      text.textContent = fio;

      const del = document.createElement("button");
      del.className = "btn";
      del.type = "button";
      del.textContent = "Убрать";
      del.addEventListener("click", () => {
        peopleStore.splice(idx, 1);
        selected.delete(fio);
        renderManage();
        renderSelection();
      });

      row.appendChild(text);
      row.appendChild(del);
      manageListEl.appendChild(row);
    });
  }

  function openModal(opts){
    // opts: { title, initial: string[], onApply: (list)=>void }
    titleEl.textContent = opts?.title || "Выбор уполномоченных";
    onApply = typeof opts?.onApply === "function" ? opts.onApply : null;
    selected = new Set(Array.isArray(opts?.initial) ? opts.initial : []);
    ensurePeople(Array.from(selected));

    renderSelection();

    backdrop.hidden = false;
    backdrop.style.zIndex = "1100";
    document.documentElement.classList.add("is-dialog-open");
  }

  function closeModal(){
    backdrop.hidden = true;
    backdrop.style.removeProperty("z-index");
    document.documentElement.classList.remove("is-dialog-open");
    onApply = null;
  }

  function openManage(){
    renderManage();
    manageBackdrop.hidden = false;
    manageBackdrop.style.zIndex = "1200";
    document.documentElement.classList.add("is-dialog-open");
    setTimeout(() => nameInput.focus(), 0);
  }

  function closeManage(){
    manageBackdrop.hidden = true;
    manageBackdrop.style.removeProperty("z-index");
    document.documentElement.classList.remove("is-dialog-open");
  }

  function addPerson(){
    const fio = normalizeFio(nameInput.value);
    if (!fio) return;

    addToStore(fio);
    nameInput.value = "";
    nameInput.focus();
    renderManage();
    renderSelection();
  }

  addBtn.addEventListener("click", addPerson);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPerson();
    }
  });

  applyBtn.addEventListener("click", () => {
    if (onApply) {
      const list = peopleStore.filter((fio) => selected.has(fio));
      onApply(list);
    }
    closeModal();
  });

  editBtn.addEventListener("click", openManage);

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  manageCloseBtn.addEventListener("click", closeManage);
  manageCancelBtn.addEventListener("click", closeManage);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  manageBackdrop.addEventListener("click", (e) => {
    if (e.target === manageBackdrop) closeManage();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!manageBackdrop.hidden) closeManage();
      else if (!backdrop.hidden) closeModal();
    }
  });

  window.PeopleModal = { open: openModal, close: closeModal };
})();
