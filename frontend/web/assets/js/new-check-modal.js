// web/assets/js/new-check-modal.js

(function initNewCheckModal(){
  const backdrop = document.getElementById("checkModalBackdrop");
  const closeBtn = document.getElementById("checkModalClose");
  const cancelBtn = document.getElementById("checkModalCancel");
  const form = document.getElementById("checkForm");
  const openBtn = document.getElementById("btnNewCheck");
  const titleEl = document.getElementById("checkModalTitle");
  const postalSameCheckbox = document.getElementById("postalSame");
  const bossRoleInput = form?.elements?.["bossRole"] || null;
  const bossRoleDatalist = document.getElementById("bossRoleOptions");
  let createdByValue = "";

  if (!backdrop) return;

  function lockScroll() {
    if (window.ModalScroll?.lock) {
      window.ModalScroll.lock();
    } else {
      document.documentElement.classList.add("is-dialog-open");
    }
  }

  function unlockScroll() {
    if (window.ModalScroll?.unlock) {
      window.ModalScroll.unlock();
    } else {
      document.documentElement.classList.remove("is-dialog-open");
    }
  }

  function openModal(options = {}){
    const { mode = "create", data = null } = options || {};
    if (!getAuthenticatedUser()) {
      if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Войдите в систему, чтобы создать или редактировать проверку.", "Доступ");
      else alert("Войдите в систему, чтобы создать или редактировать проверку.");
      return;
    }
    backdrop.hidden = false;
    backdrop.style.zIndex = "1000";
    lockScroll();
    if (mode === "edit" && data) {
      fillForm(data);
      updateCreatorField(data.created_by);
      form.dataset.editId = String(data.id);
      if (titleEl) titleEl.textContent = "Изменить проверку";
    } else {
      resetForm();
      updateCreatorField();
      delete form.dataset.editId;
      if (titleEl) titleEl.textContent = "Новая проверка";
    }
  }

  function closeModal(){
    backdrop.hidden = true;
    backdrop.style.removeProperty("z-index");
    unlockScroll();
  }

  closeModal();

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeModal();
  });

  // ===== Modal =====
  const authorizedInput = document.getElementById("authorizedPeople");
  const signaturesInput = document.getElementById("signaturesPeople");
  const authorizedBtn = document.getElementById("authorizedPickBtn");
  const signaturesBtn = document.getElementById("signaturesPickBtn");

  function bringPeopleModalToFront() {
    const peopleBackdrop = document.getElementById("peopleModalBackdrop");
    if (peopleBackdrop) {
      peopleBackdrop.style.zIndex = "1100";
    }
  }

  function parseListFromField(el){
    if (!el) return [];
    const text = (el.value || "").trim();
    if (!text) return [];
    return text.split(",").map(s => s.trim()).filter(Boolean);
  }

  function writeListToField(el, list){
    if (!el) return;
    el.value = list.join(", ");
  }

  function formatListValue(value) {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value || "";
  }

  function parseListFromName(formRef, name) {
    if (!formRef) return [];
    const field = formRef.elements[name];
    if (!field) return [];
    return parseListFromField(field);
  }

  if (authorizedBtn) {
    authorizedBtn.addEventListener("click", () => {
      if (!window.PeopleModal?.open) return;
      bringPeopleModalToFront();
      window.PeopleModal.open({
        title: "Уполномоченные на проведение проверки",
        initial: parseListFromField(authorizedInput),
        onApply: (list) => writeListToField(authorizedInput, list)
      });
    });
  }

  if (signaturesBtn) {
    signaturesBtn.addEventListener("click", () => {
      if (!window.PeopleModal?.open) return;
      bringPeopleModalToFront();
      window.PeopleModal.open({
        title: "Подписи уполномоченных в акте",
        initial: parseListFromField(signaturesInput),
        onApply: (list) => writeListToField(signaturesInput, list)
      });
    });
  }

  // ===== JSON =====
  function getFieldValue(formRef, name) {
    const field = formRef.elements[name];
    if (!field) return "";
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      return (field.value || "").trim();
    }
    return "";
  }

  function setFieldValue(formRef, name, value) {
    const field = formRef.elements[name];
    if (!field) return;
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value ?? "";
    }
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    if (authorizedInput) authorizedInput.value = "";
    if (signaturesInput) signaturesInput.value = "";
    if (postalSameCheckbox) {
      postalSameCheckbox.checked = false;
      setPostalSameState(false);
    }
  }

  function normalizeSpace(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  const bossRoleStorageKey = "bossRoleOptionsExtra";
  const bossRoleDefaults = bossRoleDatalist
    ? Array.from(bossRoleDatalist.options).map((option) => option.value).filter(Boolean)
    : [];

  function loadBossRoleExtras() {
    if (!window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(bossRoleStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveBossRoleExtras(list) {
    if (!window.localStorage) return;
    window.localStorage.setItem(bossRoleStorageKey, JSON.stringify(list));
  }

  function collectBossRoleValues() {
    if (!bossRoleDatalist) return [];
    return Array.from(bossRoleDatalist.options).map((option) => option.value).filter(Boolean);
  }

  function appendBossRoleOption(value) {
    if (!bossRoleDatalist) return;
    const option = document.createElement("option");
    option.value = value;
    bossRoleDatalist.appendChild(option);
  }

  function syncBossRoleExtras() {
    const existing = new Set(bossRoleDefaults.map((item) => item.toLowerCase()));
    const extras = loadBossRoleExtras().filter(Boolean).filter((value) => {
      const normalized = normalizeSpace(value);
      if (!normalized) return false;
      const key = normalized.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    extras.forEach((value) => appendBossRoleOption(value));
    if (extras.length) saveBossRoleExtras(extras);
  }

  function ensureBossRoleOption(rawValue) {
    const normalized = normalizeSpace(rawValue);
    if (!normalized) return;
    const existing = new Set(collectBossRoleValues().map((value) => value.toLowerCase()));
    if (existing.has(normalized.toLowerCase())) return;
    const extras = loadBossRoleExtras();
    extras.push(normalized);
    saveBossRoleExtras(extras);
    appendBossRoleOption(normalized);
  }

  async function fetchOrganizationByOgrn(ogrn) {
    if (!window.Api?.request) {
      throw new Error("Не настроен клиент API.");
    }
    return await window.Api.request("/dadata/organization", {
      method: "POST",
      body: JSON.stringify({ ogrn })
    });
  }

  async function handleOgrnAutofill(rawValue) {
    const ogrnValue = normalizeSpace(rawValue);
    if (!/^\d{13}$/.test(ogrnValue)) return;
    try {
      const data = await fetchOrganizationByOgrn(ogrnValue);
      if (!data) return;
      setFieldValue(form, "orgName", data.name ?? "");
      setFieldValue(form, "orgShortName", data.shortName ?? "");
      setFieldValue(form, "legal_adress", data.legalAddress ?? "");
      setFieldValue(form, "bossRole", data.bossRole ?? "");
      setFieldValue(form, "bossNamePatronymic", data.bossNamePatronymic ?? "");
      setFieldValue(form, "bossLastName", data.bossLastName ?? "");
    } catch (error) {
      console.warn("Не удалось получить данные по ОГРН", error);
      if (window.AppDialog?.openDialog) {
        window.AppDialog.openDialog("Не удалось получить данные по ОГРН. Проверьте номер и попробуйте снова.");
      }
    }
  }

  function parseDateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function calculateDays(startValue, endValue) {
    const start = parseDateValue(startValue);
    const end = parseDateValue(endValue);
    if (!start || !end) return "";
    if (end < start) return "";
    const msInDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((end - start) / msInDay);
    return String(diff + 1);
  }

  function updateDaysField() {
    if (!form) return;
    const startValue = getFieldValue(form, "startDate");
    const endValue = getFieldValue(form, "endDate");
    const daysValue = calculateDays(startValue, endValue);
    setFieldValue(form, "days", daysValue);
  }

  function setPostalSameState(isChecked) {
    if (!form) return;
    const postalField = form.elements["email"];
    const legalField = form.elements["legal_adress"];
    if (!(postalField instanceof HTMLInputElement) || !(legalField instanceof HTMLInputElement)) return;
    postalField.readOnly = Boolean(isChecked);
    if (isChecked) {
      postalField.value = legalField.value;
    }
  }

  function fillForm(data) {
    if (!form || !data) return;
    setFieldValue(form, "ogrn", data.organization?.ogrn);
    setFieldValue(form, "orgName", data.organization?.name);
    setFieldValue(form, "orgShortName", data.organization?.shortName);
    setFieldValue(form, "legal_adress", data.organization?.address?.legalAddress);
    setFieldValue(form, "email", data.organization?.address?.postalAddress);
    setFieldValue(form, "bossRole", data.head?.role);
    setFieldValue(form, "bossNamePatronymic", data.head?.namePatronymic);
    setFieldValue(form, "bossLastName", data.head?.lastName);
    setFieldValue(form, "bossLastNameTo", data.head?.lastNameTo);
    setFieldValue(form, "checkFormType", data.inspection?.formType);
    setFieldValue(form, "mzOrderNo", data.inspection?.mzOrder?.number);
    setFieldValue(form, "mzOrderDate", data.inspection?.mzOrder?.date);
    setFieldValue(form, "checkNo", data.inspection?.number);
    setFieldValue(form, "startDate", data.inspection?.period?.startDate);
    setFieldValue(form, "endDate", data.inspection?.period?.endDate);
    setFieldValue(form, "days", data.inspection?.period?.days);
    setFieldValue(form, "letterNoLeft", data.inspection?.letter?.numberLeft);
    setFieldValue(form, "letterNoRight", data.inspection?.letter?.numberRight);
    setFieldValue(form, "letterDate", data.inspection?.letter?.date);
    setFieldValue(form, "addressNoIndex", formatListValue(data.inspection?.addressNoIndex));
    setFieldValue(form, "representative", formatListValue(data.inspection?.representative));
    if (authorizedInput) {
      authorizedInput.value = (data.inspection?.inspectors || []).join(", ");
    }
    if (signaturesInput) {
      signaturesInput.value = (data.inspection?.signatures || []).join(", ");
    }
    if (postalSameCheckbox) {
      const legalValue = getFieldValue(form, "legal_adress");
      const postalValue = getFieldValue(form, "email");
      postalSameCheckbox.checked = Boolean(legalValue && legalValue === postalValue);
      setPostalSameState(postalSameCheckbox.checked);
    }
    updateDaysField();
  }

  function getAuthenticatedUser() {
    return window.AuthState?.getUser?.() || null;
  }

  function updateCreatorField(value) {
    const userName = value || getAuthenticatedUser()?.name || "";
    createdByValue = userName;
  }

  function buildInspectionPayload(formRef) {
    return {
      created_by: normalizeSpace(createdByValue),
      organization: {
        ogrn: normalizeSpace(getFieldValue(formRef, "ogrn")),
        name: normalizeSpace(getFieldValue(formRef, "orgName")),
        shortName: normalizeSpace(getFieldValue(formRef, "orgShortName")),
        address: {
          legalAddress: normalizeSpace(getFieldValue(formRef, "legal_adress")),
          postalAddress: normalizeSpace(getFieldValue(formRef, "email"))
        }
      },

      head: {
        role: normalizeSpace(getFieldValue(formRef, "bossRole")),
        namePatronymic: normalizeSpace(getFieldValue(formRef, "bossNamePatronymic")),
        lastName: normalizeSpace(getFieldValue(formRef, "bossLastName")),
        lastNameTo: normalizeSpace(getFieldValue(formRef, "bossLastNameTo"))
      },

      inspection: {
        formType: normalizeSpace(getFieldValue(formRef, "checkFormType")),
        mzOrder: {
          number: normalizeSpace(getFieldValue(formRef, "mzOrderNo")),
          date: normalizeSpace(getFieldValue(formRef, "mzOrderDate"))
        },
        number: normalizeSpace(getFieldValue(formRef, "checkNo")),
        period: {
          startDate: normalizeSpace(getFieldValue(formRef, "startDate")),
          endDate: normalizeSpace(getFieldValue(formRef, "endDate")),
          days: normalizeSpace(getFieldValue(formRef, "days"))
        },
        letter: {
          numberLeft: normalizeSpace(getFieldValue(formRef, "letterNoLeft")),
          numberRight: normalizeSpace(getFieldValue(formRef, "letterNoRight")),
          date: normalizeSpace(getFieldValue(formRef, "letterDate"))
        },
        addressNoIndex: parseListFromName(formRef, "addressNoIndex"),
        representative: parseListFromName(formRef, "representative"),

        inspectors: parseListFromField(authorizedInput),
        signatures: parseListFromField(signaturesInput)
      }
    };
  }

  function hasDigits(value) {
    return /\d/.test(value || "");
  }

  function ensureNoDigits(value, label) {
    if (!value) return null;
    if (hasDigits(value)) {
      return `Поле «${label}» не должно содержать цифры.`;
    }
    return null;
  }

  function validateDates() {
    const startValue = getFieldValue(form, "startDate");
    const endValue = getFieldValue(form, "endDate");
    const start = parseDateValue(startValue);
    const end = parseDateValue(endValue);
    if ((startValue && !start) || (endValue && !end)) {
      return "Проверьте корректность дат проверки.";
    }
    if (start && end && end < start) {
      return "Дата окончания проверки не может быть раньше даты начала.";
    }
    return null;
  }

  function isUniqueCheckNumber(numberValue, currentId) {
    if (!numberValue) return true;
    const normalized = normalizeSpace(numberValue);
    const list = window.ChecksStore?.load?.() || [];
    return !list.some((item) => {
      if (currentId && item?.id === currentId) return false;
      return normalizeSpace(item?.inspection?.number) === normalized;
    });
  }

  function hasAnyInspectionData(payload) {
    const i = payload.inspection;
    return (
      i.formType || i.mzOrder.number || i.mzOrder.date || i.number ||
      i.period.startDate || i.period.endDate || i.period.days ||
      i.letter.numberLeft || i.letter.numberRight || i.letter.date ||
      (i.addressNoIndex && i.addressNoIndex.length) ||
      (i.representative && i.representative.length) ||
      (i.inspectors && i.inspectors.length) ||
      (i.signatures && i.signatures.length)
    );
  }

  // ===== Submit =====
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!getAuthenticatedUser()) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Войдите в систему, чтобы создать или редактировать проверку.", "Доступ");
        else alert("Войдите в систему, чтобы создать или редактировать проверку.");
        return;
      }

      const orgName = getFieldValue(form, "orgName");
      if (!orgName) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Заполните поле «Наименование».");
        else alert("Заполните поле «Наименование».");
        return;
      }

      const ogrnValue = getFieldValue(form, "ogrn");
      if (ogrnValue && !/^\d{13}$/.test(ogrnValue)) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("ОГРН должен содержать 13 цифр.");
        else alert("ОГРН должен содержать 13 цифр.");
        return;
      }

      const fioErrors = [
        ensureNoDigits(getFieldValue(form, "bossNamePatronymic"), "Имя Отчество"),
        ensureNoDigits(getFieldValue(form, "bossLastName"), "Фамилия"),
        ensureNoDigits(getFieldValue(form, "bossLastNameTo"), "Фамилия (кому?)"),
        ensureNoDigits(getFieldValue(form, "representative"), "Представитель (ФИО, должность)")
      ].filter(Boolean);
      if (fioErrors.length) {
        const message = fioErrors[0];
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog(message);
        else alert(message);
        return;
      }

      const dateError = validateDates();
      if (dateError) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog(dateError);
        else alert(dateError);
        return;
      }

      const payload = buildInspectionPayload(form);
      if (!hasAnyInspectionData(payload)) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Заполните данные проверки.");
        else alert("Заполните данные проверки.");
        return;
      }

      const existingId = form.dataset.editId ? Number(form.dataset.editId) : null;
      if (!isUniqueCheckNumber(payload.inspection?.number, existingId)) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Номер проверки должен быть уникальным.");
        else alert("Номер проверки должен быть уникальным.");
        return;
      }
      try {
        if (existingId) {
          await window.ChecksStore?.update?.(existingId, payload);
        } else {
          await window.ChecksStore?.create?.(payload);
        }
        window.dispatchEvent(new CustomEvent("checks:updated"));
      } catch (error) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog(error.message || "Ошибка сохранения проверки.", "Проверки");
        }
        return;
      }

      closeModal();
    });
  }

  if (postalSameCheckbox && form) {
    postalSameCheckbox.addEventListener("change", () => {
      setPostalSameState(postalSameCheckbox.checked);
    });
    const legalField = form.elements["legal_adress"];
    if (legalField instanceof HTMLInputElement) {
      legalField.addEventListener("input", () => {
        if (postalSameCheckbox.checked) {
          setPostalSameState(true);
        }
      });
    }
  }

  if (form) {
    const startField = form.elements["startDate"];
    const endField = form.elements["endDate"];
    if (startField instanceof HTMLInputElement) {
      startField.addEventListener("change", updateDaysField);
      startField.addEventListener("input", updateDaysField);
    }
    if (endField instanceof HTMLInputElement) {
      endField.addEventListener("change", updateDaysField);
      endField.addEventListener("input", updateDaysField);
    }
  }

  if (form) {
    const ogrnField = form.elements["ogrn"];
    if (ogrnField instanceof HTMLInputElement) {
      ogrnField.addEventListener("blur", () => {
        handleOgrnAutofill(ogrnField.value);
      });
    }
  }

  if (bossRoleInput && bossRoleDatalist) {
    syncBossRoleExtras();
    let bossRoleFocusValue = "";

    bossRoleInput.addEventListener("focus", () => {
      const currentValue = normalizeSpace(bossRoleInput.value);
      if (!currentValue) return;
      bossRoleFocusValue = currentValue;
      bossRoleInput.value = "";
      bossRoleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    bossRoleInput.addEventListener("blur", () => {
      const currentValue = normalizeSpace(bossRoleInput.value);
      if (!currentValue && bossRoleFocusValue) {
        bossRoleInput.value = bossRoleFocusValue;
      }
      ensureBossRoleOption(bossRoleInput.value);
      bossRoleFocusValue = "";
    });

    bossRoleInput.addEventListener("change", () => {
      ensureBossRoleOption(bossRoleInput.value);
    });
  }

  window.addEventListener("auth:changed", (event) => {
    updateCreatorField(event.detail?.name);
  });

  window.NewCheckModal = { open: openModal, close: closeModal };

})();
