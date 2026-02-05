// web/assets/js/new-check-modal.js

(function initNewCheckModal(){
  const backdrop = document.getElementById("checkModalBackdrop");
  const closeBtn = document.getElementById("checkModalClose");
  const cancelBtn = document.getElementById("checkModalCancel");
  const form = document.getElementById("checkForm");
  const openBtn = document.getElementById("btnNewCheck");
  const titleEl = document.getElementById("checkModalTitle");
  let createdByValue = "";

  if (!backdrop) return;

  function openModal(options = {}){
    const { mode = "create", data = null } = options || {};
    if (!getAuthenticatedUser()) {
      if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Войдите в систему, чтобы создать или редактировать проверку.", "Доступ");
      else alert("Войдите в систему, чтобы создать или редактировать проверку.");
      return;
    }
    backdrop.hidden = false;
    backdrop.style.zIndex = "1000";
    document.documentElement.classList.add("is-dialog-open");
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
    document.documentElement.classList.remove("is-dialog-open");
  }

  // чтобы не открывалось сразу при загрузке
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

  // ===== People modal wiring =====
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

  // ===== Helpers for JSON building =====
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
  }

  function normalizeSpace(s) {
    return (s || "").replace(/\s+/g, " ").trim();
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
    setFieldValue(form, "addressNoIndex", data.inspection?.addressNoIndex);
    setFieldValue(form, "representative", data.inspection?.representative);
    if (authorizedInput) {
      authorizedInput.value = (data.inspection?.inspectors || []).join(", ");
    }
    if (signaturesInput) {
      signaturesInput.value = (data.inspection?.signatures || []).join(", ");
    }
  }

  function getAuthenticatedUser() {
    return window.AuthState?.getUser?.() || null;
  }

  function updateCreatorField(value) {
    const userName = value || getAuthenticatedUser()?.name || "";
    createdByValue = userName;
  }

  function buildInspectionPayload(formRef) {
    // здесь ты можешь потом поменять структуру под бэкенд как угодно
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
        addressNoIndex: normalizeSpace(getFieldValue(formRef, "addressNoIndex")),
        representative: normalizeSpace(getFieldValue(formRef, "representative")),

        // ВАЖНО: массивы (а не строка)
        inspectors: parseListFromField(authorizedInput),
        signatures: parseListFromField(signaturesInput)
      }
    };
  }

  function hasAnyInspectionData(payload) {
    // Простая проверка "заполнено ли что-то кроме названия"
    // можешь ужесточить потом.
    const i = payload.inspection;
    return (
      i.formType || i.mzOrder.number || i.mzOrder.date || i.number ||
      i.period.startDate || i.period.endDate || i.period.days ||
      i.letter.numberLeft || i.letter.numberRight || i.letter.date ||
      i.addressNoIndex || i.representative || (i.inspectors && i.inspectors.length) || (i.signatures && i.signatures.length)
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

      const payload = buildInspectionPayload(form);

      if (!hasAnyInspectionData(payload)) {
        if (window.AppDialog?.openDialog) window.AppDialog.openDialog("Заполните данные проверки.");
        else alert("Заполните данные проверки.");
        return;
      }

      const existingId = form.dataset.editId ? Number(form.dataset.editId) : null;
      const existing = existingId ? window.ChecksStore?.getById?.(existingId) : null;
      const authenticatedUser = getAuthenticatedUser();
      const entry = {
        id: existing?.id ?? Date.now(),
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: existing ? new Date().toISOString() : null,
        updated_by: existing ? (authenticatedUser?.name || existing?.created_by || "—") : null,
        ...payload,
      };

      window.ChecksStore?.upsert?.(entry);
      window.dispatchEvent(new CustomEvent("checks:updated"));

      closeModal();
    });
  }

  window.addEventListener("auth:changed", (event) => {
    updateCreatorField(event.detail?.name);
  });

  window.NewCheckModal = { open: openModal, close: closeModal };

})();
