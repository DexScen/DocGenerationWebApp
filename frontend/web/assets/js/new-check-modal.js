// web/assets/js/new-check-modal.js

(function initNewCheckModal(){
  const backdrop = document.getElementById("checkModalBackdrop");
  const closeBtn = document.getElementById("checkModalClose");
  const cancelBtn = document.getElementById("checkModalCancel");
  const form = document.getElementById("checkForm");

  
  const openBtn = document.getElementById("btnNewCheck");

  if (!backdrop) return;

  function openModal(){
    backdrop.hidden = false;
    backdrop.style.zIndex = "1000";
    document.documentElement.classList.add("is-dialog-open");
  }

  function closeModal(){
    backdrop.hidden = true;
    backdrop.style.removeProperty("z-index");
    document.documentElement.classList.remove("is-dialog-open");
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


  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const orgName = form.elements["orgName"]?.value?.trim();
      if (!orgName) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog("Заполните поле «Наименование».");
        } else {
          alert("Заполните поле «Наименование».");
        }
        return;
      }

      const line = normalizeLine(buildCheckLine(form));
      if (!line) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog("Заполните данные проверки.");
        } else {
          alert("Заполните данные проверки.");
        }
        return;
      }

      try {
        const response = await fetch("http://localhost:8080/inspections", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=UTF-8"
          },
          body: line
        });

        if (!response.ok) {
          throw new Error("Не удалось сохранить проверку.");
        }
      } catch (error) {
        if (window.AppDialog?.openDialog) {
          window.AppDialog.openDialog("Не удалось отправить данные на сервер.");
        } else {
          alert("Не удалось отправить данные на сервер.");
        }
        return;
      }

      closeModal();
    });
  }

  window.NewCheckModal = { open: openModal, close: closeModal };

  function bringPeopleModalToFront() {
    const peopleBackdrop = document.getElementById("peopleModalBackdrop");
    if (peopleBackdrop) {
      peopleBackdrop.style.zIndex = "1100";
    }
  }


  const authorizedInput = document.getElementById("authorizedPeople");
  const signaturesInput = document.getElementById("signaturesPeople");
  const authorizedBtn = document.getElementById("authorizedPickBtn");
  const signaturesBtn = document.getElementById("signaturesPickBtn");

  function getFieldValue(formRef, name) {
    const field = formRef.elements[name];
    if (!field) return "";
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      return (field.value || "").trim();
    }
    return "";
  }

  function buildCheckLine(formRef) {
    const fields = [
      { name: "ogrn", label: "ОГРН" },
      { name: "orgForm", label: "Форма организации" },
      { name: "orgName", label: "Наименование" },
      { name: "orgShortName", label: "Сокращенное наименование" },
      { name: "index", label: "Индекс" },
      { name: "district", label: "Район" },
      { name: "city", label: "Населенный пункт" },
      { name: "street", label: "Улица" },
      { name: "house", label: "Дом" },
      { name: "bossRole", label: "Должность руководителя" },
      { name: "bossNamePatronymic", label: "Имя Отчество" },
      { name: "bossLastName", label: "Фамилия" },
      { name: "bossLastNameTo", label: "Фамилия (кому)" },
      { name: "checkFormType", label: "Форма проверки" },
      { name: "mzOrderNo", label: "№ приказа МЗЧО" },
      { name: "mzOrderDate", label: "Дата приказа МЗЧО" },
      { name: "checkNo", label: "№ проверки" },
      { name: "startDate", label: "Начало проверки" },
      { name: "endDate", label: "Окончание проверки" },
      { name: "days", label: "Дней" },
      { name: "letterNoLeft", label: "№ приказа, письма (левая часть)" },
      { name: "letterNoRight", label: "№ приказа, письма (правая часть)" },
      { name: "letterDate", label: "Дата приказа, письма" },
      { name: "addressNoIndex", label: "Адрес без индекса" },
      { name: "representative", label: "Представитель" },
      { name: "inspectors", label: "Уполномоченные" },
      { name: "signs", label: "Подписи" }
    ];

    const parts = fields
      .map((field) => {
        const value = getFieldValue(formRef, field.name);
        if (!value) return "";
        return `${field.label}: ${value}`;
      })
      .filter(Boolean);

    return parts.join(" | ");
  }

  function normalizeLine(value) {
    return (value || "").replace(/\s+/g, " ").trim();
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

})();
