// web/assets/js/checks.js

(function initChecksStore() {
  const state = {
    items: [],
    loaded: false,
  };

  function load() {
    return state.items;
  }

  async function refresh() {
    try {
      const data = await window.Api.request("/inspections");
      state.items = Array.isArray(data?.items) ? data.items : [];
      state.loaded = true;
      return state.items;
    } catch (error) {
      console.warn("Не удалось загрузить проверки", error);
      state.items = [];
      state.loaded = true;
      return state.items;
    }
  }

  function clear() {
    state.items = [];
    state.loaded = true;
    return state.items;
  }

  function getById(id) {
    return load().find((item) => item.id === id) || null;
  }

  async function create(payload) {
    const item = await window.Api.request("/inspections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.items = [item, ...state.items];
    return item;
  }

  async function update(id, payload) {
    const item = await window.Api.request(`/inspections/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const idx = state.items.findIndex((entry) => entry.id === id);
    if (idx >= 0) {
      state.items[idx] = item;
    } else {
      state.items.unshift(item);
    }
    return item;
  }

  async function remove(id) {
    await window.Api.request(`/inspections/${id}`, { method: "DELETE" });
    state.items = state.items.filter((item) => item.id !== id);
    return state.items;
  }

  window.ChecksStore = {
    load,
    getById,
    refresh,
    create,
    update,
    remove,
    clear,
  };
})();

(function initChecksList() {
  const listEl = document.getElementById("checksList");
  const emptyEl = document.getElementById("checksEmpty");
  const addBtn = document.getElementById("btnNewCheckFromList");
  const downloadBackdrop = document.getElementById("downloadModalBackdrop");
  const downloadCloseBtn = document.getElementById("downloadModalClose");
  const searchInput = document.getElementById("checksSearch");
  const formTypeInput = document.getElementById("checksFormTypeFilter");
  const orderNoInput = document.getElementById("checksOrderNoFilter");
  const orderDateInput = document.getElementById("checksOrderDateFilter");
  const addressInput = document.getElementById("checksAddressFilter");
  const createdByInput = document.getElementById("checksCreatedByFilter");
  const updatedByInput = document.getElementById("checksUpdatedByFilter");
  const periodFromInput = document.getElementById("checksPeriodFrom");
  const periodToInput = document.getElementById("checksPeriodTo");
  const createdFromInput = document.getElementById("checksCreatedFrom");
  const createdToInput = document.getElementById("checksCreatedTo");
  const updatedFromInput = document.getElementById("checksUpdatedFrom");
  const updatedToInput = document.getElementById("checksUpdatedTo");
  const sortFieldSelect = document.getElementById("checksSortField");
  const sortDirectionSelect = document.getElementById("checksSortDirection");
  const resetFiltersBtn = document.getElementById("checksResetFilters");

  if (!listEl) return;

  // #TODO(BACKEND): протокол блокировок (locking) для проверок.
  //   1) Acquire lock:
  //      POST /inspections/{id}/lock
  //      body: { "mode": "view" | "edit", "ttl_seconds": 60 }
  //      response 200: { "lock_id": "...", "expires_at": "...", "owner": { "id": "...", "name": "..." }, "mode": "edit" }
  //      response 409: { "locked": true, "owner": { "id": "...", "name": "..." }, "expires_at": "...", "mode": "edit" }
  //   2) Heartbeat:
  //      POST /inspections/{id}/lock/heartbeat
  //      headers/body: { "lock_id": "..." }
  //      response 200: { "expires_at": "..." }
  //      response 410/409: lock потерян/перехвачен -> закрыть форму или read-only
  //   3) Release lock:
  //      DELETE /inspections/{id}/lock
  //      headers/body: { "lock_id": "..." }
  //      вызывать при закрытии модала/уходе со страницы/успешном сохранении
  //   4) Status list:
  //      GET /inspections?include_lock_state=true
  //      response содержит lock_state: { locked: bool, mode, owner_name, expires_at }
  //      UI: disable кнопок / бейдж "Занято"
  //   5) Правила режимов:
  //      mode=edit эксклюзивный (никто другой не может view/edit).
  //      mode=view: вариант A) шарится между view; вариант B) эксклюзивен как edit (выбрать на backend и отразить в UI).
  //      update/delete/download без валидного lock_id -> 409/423 с сообщением причины.

  function openDownloadModal() {
    if (!downloadBackdrop) return;
    downloadBackdrop.hidden = false;
    document.documentElement.classList.add("is-dialog-open");
  }

  function closeDownloadModal() {
    if (!downloadBackdrop) return;
    downloadBackdrop.hidden = true;
    document.documentElement.classList.remove("is-dialog-open");
  }

  if (downloadCloseBtn) {
    downloadCloseBtn.addEventListener("click", closeDownloadModal);
  }

  function formatCheckTitle(item) {
    const number = item?.inspection?.number ? `№${item.inspection.number}` : "Без номера";
    const orgName = item?.organization?.shortName || "Без сокращенного наименования";
    return `${number} • ${orgName}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU");
  }

  function normalizeText(value) {
    return (value || "").toString().toLowerCase().trim();
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isWithinRange(dateValue, fromValue, toValue) {
    if (!fromValue && !toValue) return true;
    if (!dateValue) return false;
    if (fromValue && dateValue < fromValue) return false;
    if (toValue && dateValue > toValue) return false;
    return true;
  }

  function isPeriodMatch(periodStart, periodEnd, filterFrom, filterTo) {
    if (!filterFrom && !filterTo) return true;
    if (!periodStart && !periodEnd) return false;
    const start = periodStart || periodEnd;
    const end = periodEnd || periodStart;
    if (!start || !end) return false;
    if (filterFrom && filterTo) {
      return start <= filterTo && end >= filterFrom;
    }
    if (filterFrom) {
      return start <= filterFrom && end >= filterFrom;
    }
    return start <= filterTo && end >= filterTo;
  }

  function isMatchText(value, query) {
    if (!query) return true;
    return normalizeText(value).includes(query);
  }

  function collectSearchText(item) {
    const parts = [
      item?.inspection?.number,
      item?.inspection?.formType,
      item?.inspection?.mzOrder?.number,
      item?.inspection?.mzOrder?.date,
      item?.inspection?.period?.startDate,
      item?.inspection?.period?.endDate,
      item?.organization?.name,
      item?.organization?.shortName,
      item?.organization?.address?.legalAddress,
      item?.created_by,
      item?.updated_by,
    ];
    return normalizeText(parts.filter(Boolean).join(" "));
  }

  function getFilters() {
    return {
      search: normalizeText(searchInput?.value),
      formType: normalizeText(formTypeInput?.value),
      orderNo: normalizeText(orderNoInput?.value),
      orderDate: parseDate(orderDateInput?.value),
      address: normalizeText(addressInput?.value),
      createdBy: normalizeText(createdByInput?.value),
      updatedBy: normalizeText(updatedByInput?.value),
      periodFrom: parseDate(periodFromInput?.value),
      periodTo: parseDate(periodToInput?.value),
      createdFrom: parseDate(createdFromInput?.value),
      createdTo: parseDate(createdToInput?.value),
      updatedFrom: parseDate(updatedFromInput?.value),
      updatedTo: parseDate(updatedToInput?.value),
      sortField: sortFieldSelect?.value || "created_at",
      sortDirection: sortDirectionSelect?.value || "desc",
    };
  }

  function hasActiveFilters(filters) {
    const {
      search,
      formType,
      orderNo,
      orderDate,
      address,
      createdBy,
      updatedBy,
      periodFrom,
      periodTo,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
    } = filters;
    return Boolean(
      search ||
        formType ||
        orderNo ||
        orderDate ||
        address ||
        createdBy ||
        updatedBy ||
        periodFrom ||
        periodTo ||
        createdFrom ||
        createdTo ||
        updatedFrom ||
        updatedTo
    );
  }

  function filterChecks(list) {
    const filters = getFilters();
    return list.filter((item) => {
      const searchText = collectSearchText(item);
      if (filters.search && !searchText.includes(filters.search)) return false;
      if (!isMatchText(item?.inspection?.formType, filters.formType)) return false;
      if (!isMatchText(item?.inspection?.mzOrder?.number, filters.orderNo)) return false;
      if (filters.orderDate) {
        const orderDate = parseDate(item?.inspection?.mzOrder?.date);
        if (!orderDate || orderDate.getTime() !== filters.orderDate.getTime()) return false;
      }
      if (!isMatchText(item?.organization?.address?.legalAddress, filters.address)) return false;
      if (!isMatchText(item?.created_by, filters.createdBy)) return false;
      if (!isMatchText(item?.updated_by, filters.updatedBy)) return false;

      const periodStart = parseDate(item?.inspection?.period?.startDate);
      const periodEnd = parseDate(item?.inspection?.period?.endDate);
      if (!isPeriodMatch(periodStart, periodEnd, filters.periodFrom, filters.periodTo)) return false;

      const createdAt = parseDate(item?.created_at);
      if (!isWithinRange(createdAt, filters.createdFrom, filters.createdTo)) return false;
      const updatedAt = parseDate(item?.updated_at);
      if (!isWithinRange(updatedAt, filters.updatedFrom, filters.updatedTo)) return false;

      return true;
    });
  }

  function getSortValue(item, field) {
    switch (field) {
      case "updated_at":
        return parseDate(item?.updated_at)?.getTime() || 0;
      case "period_start":
        return parseDate(item?.inspection?.period?.startDate)?.getTime() || 0;
      case "period_end":
        return parseDate(item?.inspection?.period?.endDate)?.getTime() || 0;
      case "number":
        return normalizeText(item?.inspection?.number);
      case "org_name":
        return normalizeText(item?.organization?.shortName || item?.organization?.name);
      case "form_type":
        return normalizeText(item?.inspection?.formType);
      case "created_at":
      default:
        return parseDate(item?.created_at)?.getTime() || 0;
    }
  }

  function sortChecks(list) {
    const { sortField, sortDirection } = getFilters();
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const valueA = getSortValue(a, sortField);
      const valueB = getSortValue(b, sortField);
      if (typeof valueA === "string" && typeof valueB === "string") {
        return valueA.localeCompare(valueB, "ru") * multiplier;
      }
      return (valueA - valueB) * multiplier;
    });
  }

  function getMetaRows(item) {
    const formType = item?.inspection?.formType || "—";
    const orderNo = item?.inspection?.mzOrder?.number || "";
    const orderDate = item?.inspection?.mzOrder?.date || "";
    const orderText = orderNo || orderDate ? `№${orderNo || "—"} от ${orderDate || "—"}` : "—";
    const address = item?.organization?.address?.legalAddress || "—";
    const periodStart = item?.inspection?.period?.startDate || "";
    const periodEnd = item?.inspection?.period?.endDate || "";
    const createdAt = item?.created_at ? formatDate(item.created_at) : "—";
    const createdBy = item?.created_by || "—";
    const updatedAt = item?.updated_at ? formatDate(item.updated_at) : "—";
    const updatedBy = item?.updated_by || "—";
    return [
      { label: "Форма проверки", value: formType },
      { label: "Приказ", value: orderText },
      { label: "Адрес", value: address },
      { label: "Дата начала", value: periodStart ? formatDate(periodStart) : "—" },
      { label: "Дата окончания", value: periodEnd ? formatDate(periodEnd) : "—" },
      { label: "Дата создания проверки", value: createdAt },
      { label: "Создал(а)", value: createdBy },
      { label: "Дата изменения проверки", value: updatedAt },
      { label: "Изменил(а)", value: updatedBy },
    ];
  }

  function createMetaRow(label, value) {
    const row = document.createElement("div");
    row.className = "check-meta__row";

    const labelEl = document.createElement("span");
    labelEl.className = "check-meta__label";
    labelEl.textContent = `${label}:`;

    const valueEl = document.createElement("span");
    valueEl.className = "check-meta__value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  function renderMeta(metaEl, item) {
    metaEl.textContent = "";
    getMetaRows(item).forEach(({ label, value }) => {
      metaEl.appendChild(createMetaRow(label, value));
    });
  }

  function renderList() {
    // #TODO(BACKEND): точка интеграции загрузки списка проверок с сервера с учетом фильтров/сортировки/пагинации.
    //   endpoint: GET /inspections?include_lock_state=true&search=...&form_type=...&order_no=...&order_date=...&address=...&created_by=...&updated_by=...&period_from=...&period_to=...&created_from=...&created_to=...&updated_from=...&updated_to=...&sort=created_at&direction=desc&page=1&page_size=20
    //   headers: { "Authorization": "Bearer <token>" }
    //   response 200: { "items": [...], "total": 123, "page": 1, "page_size": 20 }
    //   response items include: { ..., "lock_state": { "locked": true, "mode": "edit", "owner_name": "...", "expires_at": "..." } }
    //   where: renderList() before reading ChecksStore / on filters change
    //   auth: требуется токен/куки
    //   errors: 401/403 -> "Нет доступа"; 500 -> "Ошибка загрузки".
    const checks = window.ChecksStore?.load?.() ?? [];
    const filteredChecks = sortChecks(filterChecks(checks));
    listEl.innerHTML = "";

    if (emptyEl) {
      const filters = getFilters();
      const hasFilters = hasActiveFilters(filters);
      emptyEl.hidden = filteredChecks.length > 0;
      emptyEl.textContent = filteredChecks.length > 0
        ? ""
        : hasFilters
          ? "Ничего не найдено по выбранным фильтрам."
          : "Проверок пока нет.";
    }

    if (!filteredChecks.length) {
      return;
    }

    filteredChecks.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list__row list__row--check-item";

      const summary = document.createElement("div");
      summary.className = "check-summary";

      const title = document.createElement("div");
      title.className = "check-title";
      title.textContent = formatCheckTitle(item);

      const meta = document.createElement("div");
      meta.className = "check-meta";
      renderMeta(meta, item);

      summary.appendChild(title);
      summary.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "list__actions";

      const openBtn = document.createElement("button");
      openBtn.className = "btn btn--ghost";
      openBtn.type = "button";
      openBtn.textContent = "Открыть";
      openBtn.addEventListener("click", () => {
        // #TODO(BACKEND): блокировка проверки при открытии просмотра (locking: acquire).
        //   endpoint: POST /inspections/{id}/lock
        //   request: { "mode": "view", "ttl_seconds": 60 }
        //   response 200: { "lock_id": "...", "expires_at": "...", "owner": { "id": "...", "name": "..." }, "mode": "view" }
        //   response 409: { "locked": true, "owner": { "id": "...", "name": "..." }, "expires_at": "...", "mode": "edit" }
        //   where: openBtn click handler (before showing details dialog)
        //   auth: требуется токен/куки
        //   errors: 401/403 -> показать "Нет доступа"; 409 -> "Проверка занята пользователем ..."; 423 -> "Нет блокировки"; 500 -> "Ошибка блокировки".
        //   local: хранить lock_id/expires_at (например, в state или data-атрибутах строки).
        //   heartbeat: POST /inspections/{id}/lock/heartbeat каждые ~30s или onVisibilityChange; 410/409 -> перевести UI в read-only/закрыть.
        const message = [
          `Организация: ${item?.organization?.name || "—"}`,
          `ОГРН: ${item?.organization?.ogrn || "—"}`,
          `Форма проверки: ${item?.inspection?.formType || "—"}`,
          `Создал: ${item?.created_by || "—"}`,
        ].join("\n");
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog(message, "Проверка");
        } else {
          alert(message);
        }
        // #TODO(BACKEND): release lock при закрытии окна просмотра.
        //   endpoint: DELETE /inspections/{id}/lock
        //   headers/body: { "lock_id": "..." }
        //   where: on dialog close (AppDialog.closeDialog hook)
        //   auth: требуется токен/куки
        //   errors: 401 -> игнорировать; 410 -> lock уже потерян.
      });

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn--ghost";
      editBtn.type = "button";
      editBtn.textContent = "Изменить";
      editBtn.addEventListener("click", () => {
        // #TODO(BACKEND): блокировка проверки при открытии редактирования (locking: acquire).
        //   endpoint: POST /inspections/{id}/lock
        //   request: { "mode": "edit", "ttl_seconds": 60 }
        //   response 200: { "lock_id": "...", "expires_at": "...", "owner": { "id": "...", "name": "..." }, "mode": "edit" }
        //   response 409: { "locked": true, "owner": { "id": "...", "name": "..." }, "expires_at": "...", "mode": "edit" }
        //   where: editBtn click handler (before opening NewCheckModal)
        //   auth: требуется токен/куки
        //   errors: 401/403 -> показать "Нет доступа"; 409 -> показать "Проверка занята"; 423 -> "Нет блокировки"; 500 -> "Ошибка блокировки".
        //   local: сохранить lock_id/expires_at в form dataset для последующего update/delete/download.
        //   heartbeat: POST /inspections/{id}/lock/heartbeat таймер + onVisibilityChange.
        if (window.NewCheckModal?.open) {
          window.NewCheckModal.open({ mode: "edit", data: item });
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn--ghost";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", async () => {
        const ok = window.confirm("Удалить проверку?");
        if (!ok) return;
        try {
          await window.ChecksStore?.remove?.(item.id);
          window.dispatchEvent(new CustomEvent("checks:updated"));
        } catch (error) {
          if (window.AppDialog?.openDialog) {
            window.AppDialog.openDialog(error.message || "Ошибка удаления проверки.", "Проверки");
          }
        }
      });

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "btn btn--ghost";
      downloadBtn.type = "button";
      downloadBtn.textContent = "Скачать";
      downloadBtn.addEventListener("click", () => {
        // #TODO(BACKEND): скачивание документа должно требовать lock_id (если включен режим блокировок).
        //   endpoint: GET /inspections/{id}/export/docx?template=act
        //   headers: { "Authorization": "Bearer <token>", "X-Lock-Id": "<lock_id>" }
        //   response 200: binary/docx
        //   where: downloadBtn click handler -> openDownloadModal()
        //   auth: требуется токен/куки
        //   errors: 401/403 -> "Нет доступа"; 409/423 -> "Нет валидной блокировки"; 500 -> "Ошибка генерации файла".
        openDownloadModal();
      });

      actions.appendChild(openBtn);
      actions.appendChild(editBtn);
      actions.appendChild(downloadBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(summary);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (window.NewCheckModal?.open) {
        window.NewCheckModal.open({ mode: "create" });
      }
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      const inputs = [
        searchInput,
        formTypeInput,
        orderNoInput,
        orderDateInput,
        addressInput,
        createdByInput,
        updatedByInput,
        periodFromInput,
        periodToInput,
        createdFromInput,
        createdToInput,
        updatedFromInput,
        updatedToInput,
      ];
      inputs.forEach((input) => {
        if (input) input.value = "";
      });
      if (sortFieldSelect) sortFieldSelect.value = "created_at";
      if (sortDirectionSelect) sortDirectionSelect.value = "desc";
      renderList();
    });
  }

  [
    searchInput,
    formTypeInput,
    orderNoInput,
    orderDateInput,
    addressInput,
    createdByInput,
    updatedByInput,
    periodFromInput,
    periodToInput,
    createdFromInput,
    createdToInput,
    updatedFromInput,
    updatedToInput,
    sortFieldSelect,
    sortDirectionSelect,
  ].forEach((input) => {
    if (!input) return;
    const eventName = input.tagName === "SELECT" || input.type === "date" ? "change" : "input";
    input.addEventListener(eventName, renderList);
  });

  async function handleAuthChange() {
    if (window.AuthState?.isLoggedIn?.()) {
      if (window.ChecksStore?.refresh) {
        await window.ChecksStore.refresh();
      }
    } else {
      window.ChecksStore?.clear?.();
    }
    window.dispatchEvent(new CustomEvent("checks:updated"));
  }

  window.addEventListener("checks:updated", renderList);
  window.addEventListener("auth:changed", () => {
    handleAuthChange().catch((error) => {
      console.warn("Не удалось обновить проверки после смены авторизации", error);
    });
  });
  renderList();
  if (window.ChecksStore?.refresh) {
    window.ChecksStore.refresh().then(() => {
      window.dispatchEvent(new CustomEvent("checks:updated"));
    });
  }
})();
