// web/assets/js/checks.js

(function initChecksStore() {
  const STORAGE_KEY = "checksCache";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Не удалось прочитать кэш проверок", error);
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function getById(id) {
    return load().find((item) => item.id === id) || null;
  }

  function upsert(item) {
    const list = load();
    const idx = list.findIndex((entry) => entry.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    save(list);
    return list;
  }

  function remove(id) {
    const list = load().filter((item) => item.id !== id);
    save(list);
    return list;
  }

  window.ChecksStore = {
    load,
    save,
    getById,
    upsert,
    remove,
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
      });

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn--ghost";
      editBtn.type = "button";
      editBtn.textContent = "Изменить";
      editBtn.addEventListener("click", () => {
        if (window.NewCheckModal?.open) {
          window.NewCheckModal.open({ mode: "edit", data: item });
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn--ghost";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", () => {
        const ok = window.confirm("Удалить проверку?");
        if (!ok) return;
        window.ChecksStore?.remove?.(item.id);
        window.dispatchEvent(new CustomEvent("checks:updated"));
      });

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "btn btn--ghost";
      downloadBtn.type = "button";
      downloadBtn.textContent = "Скачать";
      downloadBtn.addEventListener("click", () => {
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

  window.addEventListener("checks:updated", renderList);
  renderList();
})();
