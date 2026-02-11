(function initVerificationAreasPage() {
  const tableBody = document.getElementById("verificationAreasTableBody");

  if (!tableBody) {
    return;
  }

  const STORAGE_KEY = "verification-areas-v1";
  const TEMPLATE_TAG_OPTIONS = ["общая часть", "недостатки", "нарушения"];

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeArea(area) {
    return {
      id: area?.id || createId(),
      level1: area?.level1 || "",
      level2: Array.isArray(area?.level2)
        ? area.level2.map((item) => ({
            id: item?.id || createId(),
            name: item?.name || "",
            level3: Array.isArray(item?.level3)
              ? item.level3.map((nameOrItem) => ({
                  id: nameOrItem?.id || createId(),
                  name: typeof nameOrItem === "string" ? nameOrItem : nameOrItem?.name || "",
                }))
              : [],
          }))
        : [],
      templates: Array.isArray(area?.templates)
        ? area.templates.map((template) => ({
            id: template?.id || createId(),
            name: typeof template === "string" ? template : template?.name || "",
            tags: normalizeTemplateTags(template),
          }))
        : [],
    };
  }

  function normalizeTemplateTags(template) {
    const sourceTags = Array.isArray(template?.tags)
      ? template.tags
      : template?.tag
        ? [template.tag]
        : [];
    const selectedTag = sourceTags
      .map((tag) => String(tag || "").trim().toLowerCase())
      .find((tag) => TEMPLATE_TAG_OPTIONS.includes(tag));
    return selectedTag ? [selectedTag] : [];
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeArea) : [];
    } catch (_error) {
      return [];
    }
  }

  let verificationAreas = [];

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(verificationAreas));
  }

  async function loadVerificationAreas() {
    try {
      const data = await window.Api.request("/verification-areas");
      const items = Array.isArray(data?.items) ? data.items.map(normalizeArea) : [];
      verificationAreas = items;
      saveToLocalStorage();
      return;
    } catch (_error) {
      verificationAreas = loadFromLocalStorage();
    }
  }

  async function persistVerificationAreas() {
    saveToLocalStorage();

    try {
      await window.Api.request("/verification-areas", {
        method: "PUT",
        body: JSON.stringify({ items: verificationAreas }),
      });
    } catch (error) {
      window.AppDialog?.openDialog?.(error?.message || "Не удалось сохранить области проверки");
    }
  }

  const nameModalBackdrop = document.getElementById("verificationAreaNameBackdrop");
  const nameModalTitle = document.getElementById("verificationAreaNameTitle");
  const nameModalLabel = document.getElementById("verificationAreaNameLabel");
  const nameModalInput = document.getElementById("verificationAreaNameInput");
  const nameModalForm = document.getElementById("verificationAreaNameForm");
  const nameModalClose = document.getElementById("verificationAreaNameClose");
  const nameModalCancel = document.getElementById("verificationAreaNameCancel");
  const templateModalBackdrop = document.getElementById("verificationAreaTemplateBackdrop");
  const templateModalTitle = document.getElementById("verificationAreaTemplateTitle");
  const templateModalForm = document.getElementById("verificationAreaTemplateForm");
  const templateModalInput = document.getElementById("verificationAreaTemplateInput");
  const templateModalTags = document.getElementById("verificationAreaTemplateTags");
  const templateModalSubmit = document.getElementById("verificationAreaTemplateSubmit");
  const templateModalClose = document.getElementById("verificationAreaTemplateClose");
  const templateModalCancel = document.getElementById("verificationAreaTemplateCancel");

  function askName(title, defaultValue = "") {
    if (!nameModalBackdrop || !nameModalInput || !nameModalForm) {
      const value = window.prompt(title, defaultValue);
      if (value === null) {
        return Promise.resolve(null);
      }

      const normalized = String(value).trim();
      return Promise.resolve(normalized || null);
    }

    return new Promise((resolve) => {
      let isFinished = false;

      const cleanup = () => {
        nameModalBackdrop.hidden = true;
        nameModalForm.removeEventListener("submit", onSubmit);
        nameModalClose?.removeEventListener("click", onCancel);
        nameModalCancel?.removeEventListener("click", onCancel);
        nameModalBackdrop.removeEventListener("click", onBackdropClick);
        window.removeEventListener("keydown", onKeyDown);
        window.ModalScroll?.unlock?.();
      };

      const finish = (value) => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        cleanup();
        resolve(value);
      };

      const onSubmit = (event) => {
        event.preventDefault();
        const normalized = String(nameModalInput.value || "").trim();
        finish(normalized || null);
      };

      const onCancel = () => finish(null);

      const onBackdropClick = (event) => {
        if (event.target === nameModalBackdrop) {
          finish(null);
        }
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          finish(null);
        }
      };

      if (nameModalTitle) {
        nameModalTitle.textContent = title || "Добавить значение";
      }
      if (nameModalLabel) {
        nameModalLabel.textContent = title || "Название";
      }

      nameModalInput.value = defaultValue || "";
      nameModalBackdrop.hidden = false;
      window.ModalScroll?.lock?.();

      nameModalForm.addEventListener("submit", onSubmit);
      nameModalClose?.addEventListener("click", onCancel);
      nameModalCancel?.addEventListener("click", onCancel);
      nameModalBackdrop.addEventListener("click", onBackdropClick);
      window.addEventListener("keydown", onKeyDown);

      requestAnimationFrame(() => {
        nameModalInput.focus();
        nameModalInput.select();
      });
    });
  }

  function askTemplate(initialTemplate = null) {
    if (!templateModalBackdrop || !templateModalForm || !templateModalInput || !templateModalTags) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      let isFinished = false;
      let selectedTag = getTemplateTag(initialTemplate);

      const setSelectedTag = (tag) => {
        selectedTag = tag;
        Array.from(templateModalTags.children).forEach((button) => {
          button.classList.toggle("is-active", button.dataset.tag === selectedTag);
        });
      };

      const cleanup = () => {
        templateModalBackdrop.hidden = true;
        templateModalForm.removeEventListener("submit", onSubmit);
        templateModalClose?.removeEventListener("click", onCancel);
        templateModalCancel?.removeEventListener("click", onCancel);
        templateModalBackdrop.removeEventListener("click", onBackdropClick);
        window.removeEventListener("keydown", onKeyDown);
        window.ModalScroll?.unlock?.();
      };

      const finish = (value) => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        cleanup();
        resolve(value);
      };

      const onSubmit = (event) => {
        event.preventDefault();
        const name = String(templateModalInput.value || "").trim();
        if (!name || !selectedTag) {
          window.AppDialog?.openDialog?.("Укажите название шаблона и выберите один тэг");
          return;
        }
        finish({ name, tags: [selectedTag] });
      };

      const onCancel = () => finish(null);

      const onBackdropClick = (event) => {
        if (event.target === templateModalBackdrop) {
          finish(null);
        }
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          finish(null);
        }
      };

      if (templateModalTitle) {
        templateModalTitle.textContent = initialTemplate ? "Изменить шаблон" : "Добавить шаблон";
      }
      if (templateModalSubmit) {
        templateModalSubmit.textContent = initialTemplate ? "Сохранить" : "Добавить";
      }

      templateModalInput.value = initialTemplate?.name || "";
      templateModalTags.innerHTML = "";

      TEMPLATE_TAG_OPTIONS.forEach((tagName) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "verification-areas-table__tag-button";
        button.dataset.tag = tagName;
        button.textContent = tagName;
        button.addEventListener("click", () => setSelectedTag(tagName));
        templateModalTags.appendChild(button);
      });

      setSelectedTag(selectedTag);

      templateModalBackdrop.hidden = false;
      window.ModalScroll?.lock?.();

      templateModalForm.addEventListener("submit", onSubmit);
      templateModalClose?.addEventListener("click", onCancel);
      templateModalCancel?.addEventListener("click", onCancel);
      templateModalBackdrop.addEventListener("click", onBackdropClick);
      window.addEventListener("keydown", onKeyDown);

      requestAnimationFrame(() => {
        templateModalInput.focus();
        templateModalInput.select();
      });
    });
  }

  function findArea(areaId) {
    return verificationAreas.find((item) => item.id === areaId) || null;
  }

  function findLevel2(area, level2Id) {
    if (!area) {
      return null;
    }

    return area.level2.find((item) => item.id === level2Id) || null;
  }

  function buildRows(area) {
    const level2Nodes = Array.isArray(area.level2) ? area.level2 : [];
    const templates = Array.isArray(area.templates) ? area.templates.filter((template) => template?.name) : [];

    const level23Rows = [];

    level2Nodes.forEach((level2Item) => {
      const level3Nodes = Array.isArray(level2Item.level3) && level2Item.level3.length > 0 ? level2Item.level3 : [{ id: null, name: "" }];
      level3Nodes.forEach((level3Item, index) => {
        level23Rows.push({
          level2Id: level2Item.id,
          level2Name: level2Item.name || "",
          level3Id: level3Item.id,
          level3Name: level3Item.name || "",
          level2RowStart: index === 0,
          level2Rowspan: level3Nodes.length,
        });
      });
    });

    if (level23Rows.length === 0) {
      level23Rows.push({
        level2Id: null,
        level2Name: "",
        level3Id: null,
        level3Name: "",
        level2RowStart: true,
        level2Rowspan: 1,
      });
    }

    const totalRows = Math.max(level23Rows.length, templates.length, 1);

    for (let index = level23Rows.length; index < totalRows; index += 1) {
      level23Rows.push({
        level2Id: null,
        level2Name: "",
        level3Id: null,
        level3Name: "",
        level2RowStart: false,
        level2Rowspan: 0,
      });
    }

    const result = [];

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
      const rowData = level23Rows[rowIndex] || {
        level2Id: null,
        level2Name: "",
        level3Id: null,
        level3Name: "",
        level2RowStart: false,
        level2Rowspan: 0,
      };

      result.push({
        areaId: area.id,
        level1Name: area.level1 || "",
        level1RowStart: rowIndex === 0,
        level1Rowspan: totalRows,
        level2Id: rowData.level2Id,
        level2Name: rowData.level2Name,
        level3Id: rowData.level3Id,
        level3Name: rowData.level3Name,
        level2RowStart: rowData.level2RowStart,
        level2Rowspan: rowData.level2Rowspan,
      });
    }

    return result;
  }

  function createActionButton(label, onClick, modifier = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `verification-areas-table__btn ${modifier}`.trim();
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function createCellContent(text, actions = []) {
    const wrap = document.createElement("div");
    wrap.className = "verification-areas-table__cell-content";

    const textEl = document.createElement("div");
    textEl.className = "verification-areas-table__cell-text";
    textEl.textContent = text || "—";

    const actionsEl = document.createElement("div");
    actionsEl.className = "verification-areas-table__cell-actions";
    actions.forEach((button) => actionsEl.appendChild(button));

    wrap.appendChild(textEl);
    wrap.appendChild(actionsEl);
    return wrap;
  }

  function getTemplateTag(template) {
    return Array.isArray(template?.tags) && template.tags.length > 0 ? template.tags[0] : "";
  }

  function renderTemplatesCell(area) {
    const cell = document.createElement("td");
    cell.className = "verification-areas-table__lvl4";

    const list = document.createElement("div");
    list.className = "verification-areas-table__templates";

    area.templates.forEach((template) => {
      const item = document.createElement("div");
      item.className = "verification-areas-table__template-item";

      const content = createCellContent(template.name, [
        createActionButton("Ред.", async () => {
          const nextTemplate = await askTemplate(template);
          if (!nextTemplate) {
            return;
          }

          template.name = nextTemplate.name;
          template.tags = nextTemplate.tags;
          await persistVerificationAreas();
          renderTable();
        }),
        createActionButton(
          "Удалить",
          async () => {
            area.templates = area.templates.filter((entry) => entry.id !== template.id);
            await persistVerificationAreas();
            renderTable();
          },
          "verification-areas-table__btn--danger"
        ),
      ]);

      item.appendChild(content);

      const selectedTag = getTemplateTag(template);
      if (selectedTag) {
        const tag = document.createElement("span");
        tag.className = "badge verification-areas-table__tag";
        tag.textContent = selectedTag;
        item.appendChild(tag);
      }

      list.appendChild(item);
    });

    const addTemplateWrap = document.createElement("div");
    addTemplateWrap.className = "verification-areas-table__template-item";

    addTemplateWrap.appendChild(
      createActionButton("+ Добавить шаблон", async () => {
        const nextTemplate = await askTemplate(null);
        if (!nextTemplate) {
          return;
        }

        area.templates.push({ id: createId(), name: nextTemplate.name, tags: nextTemplate.tags });
        await persistVerificationAreas();
        renderTable();
      })
    );

    list.appendChild(addTemplateWrap);

    cell.appendChild(list);
    return cell;
  }

  function renderEmptyState() {
    tableBody.innerHTML = "";

    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "verification-areas-table__empty";

    td.appendChild(
      createActionButton("+ Добавить уровень 1", async () => {
        const level1Name = await askName("Введите название уровня 1");
        if (!level1Name) {
          return;
        }

        verificationAreas.push({ id: createId(), level1: level1Name, level2: [], templates: [] });
        await persistVerificationAreas();
        renderTable();
      })
    );

    tr.appendChild(td);
    tableBody.appendChild(tr);
  }

  function renderTable() {
    if (!verificationAreas.length) {
      renderEmptyState();
      return;
    }

    const rows = verificationAreas.flatMap(buildRows);

    tableBody.innerHTML = "";

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const area = findArea(row.areaId);

      if (row.level1RowStart) {
        const level1Cell = document.createElement("td");
        level1Cell.className = "verification-areas-table__lvl1";
        level1Cell.rowSpan = row.level1Rowspan;

        level1Cell.appendChild(
          createCellContent(row.level1Name, [
            createActionButton("Ред.", async () => {
              if (!area) return;
              const nextName = await askName("Изменить уровень 1", area.level1);
              if (!nextName) return;
              area.level1 = nextName;
              await persistVerificationAreas();
              renderTable();
            }),
            createActionButton("+ Уровень 2", async () => {
              const level2Name = await askName("Введите название уровня 2");
              if (!level2Name || !area) {
                return;
              }

              area.level2.push({ id: createId(), name: level2Name, level3: [] });
              await persistVerificationAreas();
              renderTable();
            }),
            createActionButton(
              "Удалить",
              async () => {
                const index = verificationAreas.findIndex((item) => item.id === row.areaId);
                if (index < 0) {
                  return;
                }

                verificationAreas.splice(index, 1);
                await persistVerificationAreas();
                renderTable();
              },
              "verification-areas-table__btn--danger"
            ),
          ])
        );

        tr.appendChild(level1Cell);
      }

      if (row.level2RowStart) {
        const level2Cell = document.createElement("td");
        level2Cell.className = "verification-areas-table__lvl2";
        level2Cell.rowSpan = row.level2Rowspan;

        if (row.level2Id && area) {
          level2Cell.appendChild(
            createCellContent(row.level2Name, [
              createActionButton("Ред.", async () => {
                const level2 = findLevel2(area, row.level2Id);
                if (!level2) return;
                const nextName = await askName("Изменить уровень 2", level2.name);
                if (!nextName) return;
                level2.name = nextName;
                await persistVerificationAreas();
                renderTable();
              }),
              createActionButton("+ Уровень 3", async () => {
                const level3Name = await askName("Введите название уровня 3");
                const level2 = findLevel2(area, row.level2Id);
                if (!level3Name || !level2) {
                  return;
                }

                level2.level3.push({ id: createId(), name: level3Name });
                await persistVerificationAreas();
                renderTable();
              }),
              createActionButton(
                "Удалить",
                async () => {
                  area.level2 = area.level2.filter((entry) => entry.id !== row.level2Id);
                  await persistVerificationAreas();
                  renderTable();
                },
                "verification-areas-table__btn--danger"
              ),
            ])
          );
        } else {
          level2Cell.appendChild(document.createTextNode("—"));
        }

        tr.appendChild(level2Cell);
      }

      const level3Cell = document.createElement("td");
      level3Cell.className = "verification-areas-table__lvl3";

      if (row.level3Id && area && row.level2Id) {
        level3Cell.appendChild(
          createCellContent(row.level3Name, [
            createActionButton("Ред.", async () => {
              const level2 = findLevel2(area, row.level2Id);
              if (!level2) return;
              const level3 = level2.level3.find((entry) => entry.id === row.level3Id);
              if (!level3) return;
              const nextName = await askName("Изменить уровень 3", level3.name);
              if (!nextName) return;
              level3.name = nextName;
              await persistVerificationAreas();
              renderTable();
            }),
            createActionButton(
              "Удалить",
              async () => {
                const level2 = findLevel2(area, row.level2Id);
                if (!level2) {
                  return;
                }

                level2.level3 = level2.level3.filter((entry) => entry.id !== row.level3Id);
                await persistVerificationAreas();
                renderTable();
              },
              "verification-areas-table__btn--danger"
            ),
          ])
        );
      } else {
        level3Cell.textContent = "—";
      }

      tr.appendChild(level3Cell);

      if (row.level1RowStart && area) {
        const level4Cell = renderTemplatesCell(area);
        level4Cell.rowSpan = row.level1Rowspan;
        tr.appendChild(level4Cell);
      }

      tableBody.appendChild(tr);
    });

    const addRow = document.createElement("tr");
    const addCell = document.createElement("td");
    addCell.colSpan = 4;
    addCell.className = "verification-areas-table__empty";
    addCell.appendChild(
      createActionButton("+ Добавить уровень 1", async () => {
        const level1Name = await askName("Введите название уровня 1");
        if (!level1Name) {
          return;
        }

        verificationAreas.push({ id: createId(), level1: level1Name, level2: [], templates: [] });
        await persistVerificationAreas();
        renderTable();
      })
    );
    addRow.appendChild(addCell);
    tableBody.appendChild(addRow);
  }

  (async () => {
    await loadVerificationAreas();
    renderTable();
  })();
})();
