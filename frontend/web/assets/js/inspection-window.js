(function () {
  const backdrop = document.getElementById("inspectionBackdrop");
  if (!backdrop) return;

  const closeBtn = document.getElementById("inspectionClose");
  const clearBtn = document.getElementById("inspectionClearFields");
  const saveBtn = document.getElementById("inspectionSave");
  const statusText = document.getElementById("inspectionStatus");
  const areasTreeEl = document.getElementById("inspectionAreasTree");
  const areasCountEl = document.getElementById("inspectionAreasCount");
  const scrollAreaEl = document.getElementById("inspectionScrollArea");

  const STORAGE_KEY = "pp687_form";
  const VERIFICATION_AREAS_KEY = "verification-areas-v1";
  const VERIFICATION_SELECTIONS_KEY = "verification-areas-selection-v1";

  const FIELDS = ["p4_result", "p4_violation", "p4_reco", "p4_fix_info", "p5_result", "p5_violation", "p5_reco"];

  let verificationAreas = [];
  let areaSelections = {};
  let statusTimer = null;
  let draggedLevel1Id = null;

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeArea(area) {
    const level2Source = Array.isArray(area?.level2)
      ? area.level2
      : Array.isArray(area?.items)
        ? area.items
        : [];

    return {
      id: area?.id || createId(),
      level1: area?.level1 || "",
      level2: level2Source
        .map((item) => {
          if (typeof item === "string") {
            return {
              id: createId(),
              name: item,
              level3: [],
            };
          }

          return {
            id: item?.id || createId(),
            name: item?.name || item?.title || "",
            level3: Array.isArray(item?.level3)
              ? item.level3.map((nameOrItem) => ({
                  id: nameOrItem?.id || createId(),
                  name: typeof nameOrItem === "string" ? nameOrItem : nameOrItem?.name || nameOrItem?.title || "",
                }))
              : [],
          };
        })
        .filter((item) => item.name || item.level3.length > 0),
    };
  }

  function extractAreasFromResponse(response) {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.items)) {
      return response.items;
    }

    if (Array.isArray(response?.data?.items)) {
      return response.data.items;
    }

    return [];
  }

  function setStatus(text) {
    if (statusText) statusText.textContent = text;
  }

  function ensureAreaSelection(area) {
    const areaId = area?.id;
    if (!areaId) return null;

    if (!areaSelections[areaId]) {
      areaSelections[areaId] = {
        included: true,
        level2: {},
      };
    }

    const areaSelection = areaSelections[areaId];
    if (!areaSelection.level2 || typeof areaSelection.level2 !== "object") {
      areaSelection.level2 = {};
    }

    const level2Items = Array.isArray(area?.level2) ? area.level2 : [];
    level2Items.forEach((level2Item) => {
      const level2Id = level2Item?.id;
      if (!level2Id) return;
      if (!areaSelection.level2[level2Id]) {
        areaSelection.level2[level2Id] = {
          included: true,
          level3: {},
        };
      }
      const level2Selection = areaSelection.level2[level2Id];
      if (!level2Selection.level3 || typeof level2Selection.level3 !== "object") {
        level2Selection.level3 = {};
      }

      const level3Items = Array.isArray(level2Item?.level3) ? level2Item.level3 : [];
      level3Items.forEach((level3Item) => {
        const level3Id = level3Item?.id;
        if (!level3Id) return;
        if (typeof level2Selection.level3[level3Id] !== "boolean") {
          level2Selection.level3[level3Id] = true;
        }
      });
    });

    return areaSelection;
  }

  function saveAreaSelections() {
    localStorage.setItem(VERIFICATION_SELECTIONS_KEY, JSON.stringify(areaSelections));
  }

  function loadAreaSelections() {
    try {
      const raw = localStorage.getItem(VERIFICATION_SELECTIONS_KEY);
      if (!raw) {
        areaSelections = {};
        return;
      }
      const parsed = JSON.parse(raw);
      areaSelections = parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить выбранные области", error);
      areaSelections = {};
    }
  }

  function loadForm() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      FIELDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || data[id] == null) return;
        if (el.type === "checkbox") {
          el.checked = Boolean(data[id]);
          return;
        }
        el.value = data[id];
      });
    } catch (error) {
      console.warn("Не удалось загрузить черновик", error);
    }
  }

  function saveForm() {
    const data = {};
    FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) {
        data[id] = "";
        return;
      }
      data[id] = el.type === "checkbox" ? Boolean(el.checked) : el.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setStatus("Сохранено локально");
    flashButton(saveBtn);
  }

  function clearForm() {
    FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    localStorage.removeItem(STORAGE_KEY);
    setStatus("Поля очищены, черновик удалён");
  }

  function flashButton(btn) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = "ГОТОВО";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
    }, 650);
  }

  function loadAreasFromLocalStorage() {
    try {
      const raw = localStorage.getItem(VERIFICATION_AREAS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.map(normalizeArea) : [];
    } catch (error) {
      console.warn("Не удалось загрузить области проверки", error);
      return [];
    }
  }

  async function loadVerificationAreas() {
    const localItems = loadAreasFromLocalStorage();

    try {
      const response = await window.Api.request("/verification-areas");
      const serverItems = extractAreasFromResponse(response).map(normalizeArea);

      if (serverItems.length) {
        verificationAreas = serverItems;
        localStorage.setItem(VERIFICATION_AREAS_KEY, JSON.stringify(serverItems));
        return;
      }

      verificationAreas = localItems;
    } catch (_error) {
      verificationAreas = localItems;
    }
  }

  function saveAreasOrder() {
    localStorage.setItem(VERIFICATION_AREAS_KEY, JSON.stringify(verificationAreas));
  }

  function plural(n, forms) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  function updateCount() {
    if (!areasCountEl) return;
    const count = verificationAreas.reduce((sum, area) => {
      const areaSelection = ensureAreaSelection(area);
      if (!areaSelection?.included || !Array.isArray(area?.level2)) return sum;

      return (
        sum +
        area.level2.reduce((acc, level2Item) => {
          const level2Selection = areaSelection.level2?.[level2Item?.id];
          if (!level2Selection?.included) return acc;
          if (!Array.isArray(level2Item?.level3) || !level2Item.level3.length) return acc + 1;

          const level3Count = level2Item.level3.reduce((level3Acc, level3Item) => {
            const level3Included = level2Selection.level3?.[level3Item?.id] !== false;
            return level3Acc + (level3Included ? 1 : 0);
          }, 0);

          return acc + level3Count;
        }, 0)
      );
    }, 0);
    areasCountEl.textContent = `${count} ${plural(count, ["пункт", "пункта", "пунктов"])}`;
  }

  function buildCheckbox(label, checked, onChange) {
    const wrapper = document.createElement("label");
    wrapper.className = "inspection-window__area-check";
    wrapper.addEventListener("click", (event) => event.stopPropagation());

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", onChange);

    const text = document.createElement("span");
    text.className = "inspection-window__area-label-text";
    text.textContent = label;

    wrapper.append(input, text);
    return wrapper;
  }

  function createDragHandle() {
    const drag = document.createElement("button");
    drag.className = "inspection-window__drag-handle";
    drag.type = "button";
    drag.title = "Перетащите для изменения порядка";
    drag.textContent = "⋮⋮";
    return drag;
  }

  function createGoToButton(onClick) {
    const button = document.createElement("button");
    button.className = "inspection-window__goto-btn";
    button.type = "button";
    button.title = "Перейти";
    button.setAttribute("aria-label", "Перейти");
    button.textContent = "↗";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick?.();
    });
    return button;
  }

  function goToInspectionSection() {
    const target = document.querySelector(".inspection-window__group");
    if (!target) return;

    if (scrollAreaEl) {
      const top = target.offsetTop - 8;
      scrollAreaEl.scrollTo({ top: top < 0 ? 0 : top, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function moveAreaBefore(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = verificationAreas.findIndex((area) => area?.id === sourceId);
    const targetIndex = verificationAreas.findIndex((area) => area?.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = verificationAreas.splice(sourceIndex, 1);
    const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    verificationAreas.splice(insertIndex, 0, moved);
    saveAreasOrder();
    renderAreasTree();
  }

  function renderAreasTree() {
    if (!areasTreeEl) return;
    areasTreeEl.innerHTML = "";

    if (!verificationAreas.length) {
      const empty = document.createElement("div");
      empty.className = "inspection-window__areas-empty";
      empty.textContent = "Области проверки не заполнены.";
      areasTreeEl.appendChild(empty);
      updateCount();
      return;
    }

    verificationAreas.forEach((area, level1Index) => {
      const areaSelection = ensureAreaSelection(area);
      const level1 = document.createElement("details");
      level1.className = "inspection-window__area-level inspection-window__area-level--l1";
      level1.open = true;
      level1.draggable = true;
      level1.dataset.areaId = area?.id || "";

      level1.addEventListener("dragstart", () => {
        draggedLevel1Id = area?.id || null;
        level1.classList.add("is-dragging");
      });
      level1.addEventListener("dragend", () => {
        draggedLevel1Id = null;
        level1.classList.remove("is-dragging");
      });
      level1.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (draggedLevel1Id && draggedLevel1Id !== area?.id) {
          level1.classList.add("is-drop-target");
        }
      });
      level1.addEventListener("dragleave", () => {
        level1.classList.remove("is-drop-target");
      });
      level1.addEventListener("drop", (event) => {
        event.preventDefault();
        level1.classList.remove("is-drop-target");
        moveAreaBefore(draggedLevel1Id, area?.id);
      });

      const level1Summary = document.createElement("summary");

      const level1TitleRow = document.createElement("div");
      level1TitleRow.className = "inspection-window__area-row inspection-window__area-row--l1";

      level1TitleRow.appendChild(createDragHandle());
      level1TitleRow.appendChild(
        buildCheckbox(`${level1Index + 1}. ${area?.level1 || "Уровень 1 без названия"}`, areaSelection?.included !== false, (event) => {
          areaSelection.included = event.target.checked;
          saveAreaSelections();
          updateCount();
        })
      );
      level1TitleRow.appendChild(createGoToButton(goToInspectionSection));

      level1Summary.appendChild(level1TitleRow);
      level1.appendChild(level1Summary);

      const level2Container = document.createElement("div");
      level2Container.className = "inspection-window__area-children";

      const level2Items = Array.isArray(area?.level2) ? area.level2 : [];

      level2Items.forEach((level2Item, level2Index) => {
        const level2 = document.createElement("details");
        level2.className = "inspection-window__area-level inspection-window__area-level--l2";

        const level2Summary = document.createElement("summary");

        const level2Selection = areaSelection.level2[level2Item?.id] || {
          included: true,
          level3: {},
        };

        const level2Row = document.createElement("div");
        level2Row.className = "inspection-window__area-row inspection-window__area-row--l2";
        level2Row.appendChild(
          buildCheckbox(`${level1Index + 1}.${level2Index + 1} ${level2Item?.name || "Уровень 2 без названия"}`, level2Selection.included !== false, (event) => {
            level2Selection.included = event.target.checked;
            saveAreaSelections();
            updateCount();
          })
        );
        level2Row.appendChild(createGoToButton(goToInspectionSection));
        level2Summary.appendChild(level2Row);
        level2.appendChild(level2Summary);

        const level3List = document.createElement("ul");
        level3List.className = "inspection-window__area-level3-list";

        const level3Items = Array.isArray(level2Item?.level3) ? level2Item.level3 : [];
        level3Items.forEach((level3Item, level3Index) => {
          const li = document.createElement("li");
          const row = document.createElement("div");
          row.className = "inspection-window__area-row inspection-window__area-row--l3";
          const level3Id = level3Item?.id;
          const isIncluded = level2Selection.level3?.[level3Id] !== false;
          row.appendChild(
            buildCheckbox(level3Item?.name || "Уровень 3 без названия", isIncluded, (event) => {
              if (!level2Selection.level3 || typeof level2Selection.level3 !== "object") {
                level2Selection.level3 = {};
              }
              level2Selection.level3[level3Id] = event.target.checked;
              saveAreaSelections();
              updateCount();
            })
          );
          const labelText = row.querySelector(".inspection-window__area-label-text");
          if (labelText) {
            labelText.textContent = `${level1Index + 1}.${level2Index + 1}.${level3Index + 1} ${labelText.textContent}`;
          }
          row.appendChild(createGoToButton(goToInspectionSection));
          li.appendChild(row);
          level3List.appendChild(li);
        });

        if (!level3Items.length) {
          const li = document.createElement("li");
          li.className = "inspection-window__area-empty-li";
          li.textContent = "Нет пунктов уровня 3";
          level3List.appendChild(li);
        }

        level2.appendChild(level3List);
        level2Container.appendChild(level2);
      });

      if (!level2Items.length) {
        const empty = document.createElement("div");
        empty.className = "inspection-window__area-empty-li";
        empty.textContent = "Нет пунктов уровня 2";
        level2Container.appendChild(empty);
      }

      level1.appendChild(level2Container);
      areasTreeEl.appendChild(level1);
    });

    updateCount();
  }

  function handleFieldInput(event) {
    if (!FIELDS.includes(event.target?.id)) return;
    setStatus("Есть несохранённые изменения…");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => setStatus("Черновик хранится локально (localStorage)"), 900);
  }

  async function refreshAreasTree() {
    await loadVerificationAreas();
    loadAreaSelections();
    verificationAreas.forEach(ensureAreaSelection);
    saveAreaSelections();
    renderAreasTree();
  }

  async function open() {
    await refreshAreasTree();
    backdrop.hidden = false;
    if (window.ModalScroll?.lock) {
      window.ModalScroll.lock();
    } else {
      document.documentElement.classList.add("is-dialog-open");
    }
  }

  function close() {
    backdrop.hidden = true;
    if (window.ModalScroll?.unlock) {
      window.ModalScroll.unlock();
    } else {
      document.documentElement.classList.remove("is-dialog-open");
    }
  }

  saveBtn?.addEventListener("click", saveForm);
  clearBtn?.addEventListener("click", () => {
    if (confirm("Очистить все поля и удалить локальный черновик?")) clearForm();
  });

  closeBtn?.addEventListener("click", () => {
    if (confirm("Закрыть окно? Несохранённые изменения могут быть потеряны.")) {
      close();
    }
  });

  document.addEventListener("input", handleFieldInput);

  (async function init() {
    loadForm();
    await refreshAreasTree();
  })();

  window.InspectionWindow = { open, close };
})();
