(function initChecksStore() {
  const state = {
    items: [],
    loaded: false,
    total: 0,
    page: 1,
    pageSize: 10,
    filters: { year: null, ogrn: "" },
  };

  function load() {
    return state.items;
  }

  async function refresh() {
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("page_size", String(state.pageSize));
      if (state.filters.year) {
        params.set("year", String(state.filters.year));
      }
      if (state.filters.ogrn) {
        params.set("ogrn", state.filters.ogrn);
      }
      const data = await window.Api.request(`/inspections?${params.toString()}`);
      state.items = Array.isArray(data?.items) ? data.items : [];
      state.total = Number.isFinite(data?.total) ? data.total : state.items.length;
      state.page = Number.isFinite(data?.page) ? data.page : state.page;
      state.pageSize = Number.isFinite(data?.page_size) ? data.page_size : state.pageSize;
      state.loaded = true;
      return state.items;
    } catch (error) {
      console.warn("Не удалось загрузить проверки", error);
      state.items = [];
      state.total = 0;
      state.loaded = true;
      return state.items;
    }
  }

  function clear() {
    state.items = [];
    state.total = 0;
    state.page = 1;
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
    getMeta() {
      return {
        total: state.total,
        page: state.page,
        pageSize: state.pageSize,
        loaded: state.loaded,
      };
    },
    setPage(page) {
      state.page = page;
    },
    setPageSize(pageSize) {
      state.pageSize = pageSize;
    },
    setFilters(filters) {
      state.filters = { ...state.filters, ...filters };
    },
  };
})();

(function initChecksList() {
  const listEl = document.getElementById("checksList");
  const emptyEl = document.getElementById("checksEmpty");
  const addBtn = document.getElementById("btnNewCheckFromList");
  const downloadBackdrop = document.getElementById("downloadModalBackdrop");
  const downloadCloseBtn = document.getElementById("downloadModalClose");
  const downloadDocxBtn = document.getElementById("downloadDocxBtn");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  const downloadHint = document.getElementById("downloadModalHint");
  const yearInput = document.getElementById("checksYearFilter");
  const ogrnInput = document.getElementById("checksOgrnFilter");
  const paginationTopEl = document.getElementById("checksPaginationTop");
  const paginationBottomEl = document.getElementById("checksPaginationBottom");
  const pageSizeSelect = document.getElementById("checksPageSizeSelect");
  const pageSizeCustomInput = document.getElementById("checksPageSizeCustom");

  if (!listEl) return;

  let selectedInspection = null;

  function openDownloadModal(item) {
    if (!downloadBackdrop) return;
    selectedInspection = item ?? null;
    if (downloadDocxBtn) {
      if (selectedInspection?.id) {
        downloadDocxBtn.dataset.inspectionId = String(selectedInspection.id);
      } else {
        delete downloadDocxBtn.dataset.inspectionId;
      }
    }
    if (downloadHint) {
      downloadHint.textContent = selectedInspection
        ? `Формируем документ по проверке: ${formatCheckTitle(selectedInspection)}`
        : "Выберите формат документа.";
    }
    downloadBackdrop.hidden = false;
    if (window.ModalScroll?.lock) {
      window.ModalScroll.lock();
    } else {
      document.documentElement.classList.add("is-dialog-open");
    }
  }

  function closeDownloadModal() {
    if (!downloadBackdrop) return;
    downloadBackdrop.hidden = true;
    if (window.ModalScroll?.unlock) {
      window.ModalScroll.unlock();
    } else {
      document.documentElement.classList.remove("is-dialog-open");
    }
  }

  if (downloadCloseBtn) {
    downloadCloseBtn.addEventListener("click", closeDownloadModal);
  }

  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", () => {
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Экспорт в PDF пока недоступен.", "Скачать");
      }
    });
  }

  function getFilenameFromDisposition(value) {
    if (!value) return "";
    const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) {
      return decodeURIComponent(utfMatch[1]);
    }
    const simpleMatch = value.match(/filename="?([^\";]+)"?/i);
    return simpleMatch ? simpleMatch[1] : "";
  }

  function getInspectionId(item) {
    const rawId = item?.id ?? downloadDocxBtn?.dataset?.inspectionId;
    const parsed = Number(rawId);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  async function downloadInspectionDocx(item) {
    const inspectionId = getInspectionId(item);
    if (!inspectionId) {
      throw new Error("Не выбрана проверка для выгрузки документа.");
    }
    const response = await fetch(`/api/inspections/${inspectionId}/export/docx`, {
      credentials: "include",
    });

    if (!response.ok) {
      let message = "Не удалось сформировать документ.";
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json().catch(() => null);
        if (data?.message) message = data.message;
      } else {
        const text = await response.text().catch(() => "");
        if (text) message = text;
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const headerName = response.headers.get("content-disposition");
    const fallbackName = `inspection-${inspectionId}.docx`;
    const filename = getFilenameFromDisposition(headerName) || fallbackName;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (downloadDocxBtn) {
    downloadDocxBtn.addEventListener("click", async () => {
      if (!selectedInspection) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog("Выберите проверку для выгрузки документа.", "Скачать");
        }
        return;
      }
      downloadDocxBtn.disabled = true;
      try {
        await downloadInspectionDocx(selectedInspection);
        closeDownloadModal();
      } catch (error) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog(error.message || "Ошибка выгрузки документа.", "Скачать");
        }
      } finally {
        downloadDocxBtn.disabled = false;
      }
    });
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

  function normalizeDigits(value) {
    return (value || "").toString().replace(/\D/g, "");
  }

  function parseYear(value) {
    const trimmed = (value || "").toString().trim();
    if (!trimmed) return null;
    const year = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(year)) return null;
    return year;
  }


  function getFilters() {
    return {
      year: parseYear(yearInput?.value),
      ogrn: normalizeDigits(ogrnInput?.value),
    };
  }

  function hasActiveFilters(filters) {
    const { year, ogrn } = filters;
    return Boolean(year || ogrn);
  }

  function getMetaRows(item) {
    const formType = item?.inspection?.formType || "—";
    const periodStart = item?.inspection?.period?.startDate || "";
    const periodEnd = item?.inspection?.period?.endDate || "";
    const periodText = periodStart || periodEnd
      ? `${periodStart ? formatDate(periodStart) : "—"} — ${periodEnd ? formatDate(periodEnd) : "—"}`
      : "—";
    const representatives = Array.isArray(item?.inspection?.representative)
      ? item.inspection.representative.join(", ") || "—"
      : item?.inspection?.representative || "—";
    const inspectors = Array.isArray(item?.inspection?.inspectors)
      ? item.inspection.inspectors.join(", ") || "—"
      : item?.inspection?.inspectors || "—";
    return [
      { label: "Форма проверки", value: formType },
      { label: "Период проверки", value: periodText },
      { label: "Представители", value: representatives },
      { label: "Проверяющие", value: inspectors },
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
    listEl.innerHTML = "";

    if (emptyEl) {
      const filters = getFilters();
      const hasFilters = hasActiveFilters(filters);
      emptyEl.hidden = checks.length > 0;
      emptyEl.textContent = checks.length > 0
        ? ""
        : hasFilters
          ? "Ничего не найдено по выбранным фильтрам."
          : "Проверок пока нет.";
    }

    if (!checks.length) {
      return;
    }

    checks.forEach((item) => {
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
        if (window.InspectionWindow?.open) {
          window.InspectionWindow.open(item);
          return;
        }
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
        openDownloadModal(item);
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

  function getPaginationMeta() {
    const meta = window.ChecksStore?.getMeta?.() ?? {};
    const pageSize = meta.pageSize || 10;
    const total = meta.total || 0;
    const totalPages = total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const page = Math.min(meta.page || 1, totalPages);
    return { ...meta, page, pageSize, total, totalPages };
  }

  function syncPageSizeControls(pageSize) {
    if (!pageSizeSelect) return;
    const presetValues = ["5", "10", "25", "50", "100"];
    if (presetValues.includes(String(pageSize))) {
      pageSizeSelect.value = String(pageSize);
      if (pageSizeCustomInput) pageSizeCustomInput.value = "";
    } else {
      pageSizeSelect.value = "custom";
      if (pageSizeCustomInput) pageSizeCustomInput.value = String(pageSize);
    }
  }

  function renderPagination() {
    const meta = getPaginationMeta();
    const show = meta.total > 0;
    [paginationTopEl, paginationBottomEl].forEach((container) => {
      if (!container) return;
      container.hidden = !show;
      if (!show) return;
      const summaryEl = container.querySelector("[data-pagination-summary]");
      if (summaryEl) {
        summaryEl.textContent = `Всего: ${meta.total} • Страница ${meta.page} из ${meta.totalPages}`;
      }
      const pageInput = container.querySelector("[data-page-input]");
      if (pageInput) {
        pageInput.value = String(meta.page);
        pageInput.max = String(meta.totalPages);
      }
      const totalEl = container.querySelector("[data-page-total]");
      if (totalEl) totalEl.textContent = `из ${meta.totalPages}`;
      const prevBtn = container.querySelector('[data-page-action="prev"]');
      const nextBtn = container.querySelector('[data-page-action="next"]');
      if (prevBtn) prevBtn.disabled = meta.page <= 1;
      if (nextBtn) nextBtn.disabled = meta.page >= meta.totalPages;
    });
    syncPageSizeControls(meta.pageSize);
  }

  async function refreshList(options = {}) {
    const filters = getFilters();
    window.ChecksStore?.setFilters?.(filters);
    if (typeof options.page === "number") {
      window.ChecksStore?.setPage?.(options.page);
    }
    if (typeof options.pageSize === "number") {
      window.ChecksStore?.setPageSize?.(options.pageSize);
    }
    if (window.ChecksStore?.refresh) {
      await window.ChecksStore.refresh();
      const meta = getPaginationMeta();
      if (meta.total > 0 && meta.page > meta.totalPages) {
        window.ChecksStore?.setPage?.(meta.totalPages);
        await window.ChecksStore.refresh();
      }
    }
    renderList();
    renderPagination();
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (window.NewCheckModal?.open) {
        window.NewCheckModal.open({ mode: "create" });
      }
    });
  }

  [yearInput, ogrnInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => refreshList({ page: 1 }));
    input.addEventListener("change", () => refreshList({ page: 1 }));
  });

  async function handleAuthChange() {
    if (window.AuthState?.isLoggedIn?.()) {
      await refreshList({ page: 1 });
    } else {
      window.ChecksStore?.clear?.();
      renderList();
      renderPagination();
    }
  }

  window.addEventListener("checks:updated", () => {
    refreshList().catch((error) => {
      console.warn("Не удалось обновить проверки", error);
    });
  });
  [paginationTopEl, paginationBottomEl].forEach((container) => {
    if (!container) return;
    container.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-page-action]");
      if (!btn) return;
      const action = btn.dataset.pageAction;
      const meta = getPaginationMeta();
      if (action === "prev") {
        refreshList({ page: Math.max(1, meta.page - 1) });
      }
      if (action === "next") {
        refreshList({ page: Math.min(meta.totalPages, meta.page + 1) });
      }
    });
    const pageInput = container.querySelector("[data-page-input]");
    if (pageInput) {
      pageInput.addEventListener("change", () => {
        const value = Number.parseInt(pageInput.value, 10);
        if (!Number.isFinite(value) || value <= 0) return;
        refreshList({ page: value });
      });
      pageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          pageInput.blur();
        }
      });
    }
  });

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      if (pageSizeSelect.value === "custom") {
        pageSizeCustomInput?.focus();
        const value = Number.parseInt(pageSizeCustomInput?.value, 10);
        if (Number.isFinite(value) && value > 0) {
          refreshList({ page: 1, pageSize: value });
        }
        return;
      }
      const value = Number.parseInt(pageSizeSelect.value, 10);
      if (!Number.isFinite(value) || value <= 0) return;
      refreshList({ page: 1, pageSize: value });
    });
  }

  if (pageSizeCustomInput) {
    pageSizeCustomInput.addEventListener("change", () => {
      const value = Number.parseInt(pageSizeCustomInput.value, 10);
      if (!Number.isFinite(value) || value <= 0) return;
      if (pageSizeSelect) pageSizeSelect.value = "custom";
      refreshList({ page: 1, pageSize: value });
    });
  }
  window.addEventListener("auth:changed", () => {
    handleAuthChange().catch((error) => {
      console.warn("Не удалось обновить проверки после смены авторизации", error);
    });
  });
  renderList();
  renderPagination();
  refreshList().catch((error) => {
    console.warn("Не удалось загрузить проверки", error);
  });
})();
