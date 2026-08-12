document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const user = getUser();
  let currentType = "INSUMOS";
  let meta = null;

  const fechaChecklist = document.getElementById("fechaChecklist");
  const nExpo = document.getElementById("nExpo");
  const ubicacion = document.getElementById("ubicacion");
  const pais = document.getElementById("pais");
  const responsable = document.getElementById("responsable");
  const questionsContainer = document.getElementById("questionsContainer");
  const sectionTitle = document.getElementById("sectionTitle");
  const formMessage = document.getElementById("formMessage");
  const checkForm = document.getElementById("checkForm");
  const guardarBtn = document.getElementById("guardarBtn");
  const limpiarBtn = document.getElementById("limpiarBtn");
  const volverBtn = document.getElementById("volverBtn");

  function getToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  }

  async function callApi(action, payload = {}) {
    if (typeof apiPost === "function") {
      return apiPost(action, {
        ...payload,
        token: getToken()
      });
    }

    throw new Error("No se encontró apiPost en js/api.js. Comparte ese archivo para adaptarlo.");
  }

  function setMessage(text, type = "") {
    formMessage.textContent = text || "";
    formMessage.className = `form-message ${type}`;
  }

  function fillSelect(select, items, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>`;

    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  function renderQuestions() {
    questionsContainer.innerHTML = "";

    const isInsumos = currentType === "INSUMOS";
    const items = isInsumos ? meta.insumos : meta.area;

    sectionTitle.textContent = isInsumos
      ? "Verificación del estado y disponibilidad de los insumos de embalaje para exportación"
      : "Verificar la zona de preparación para el alistamiento de mercadería de exportación";

    document.querySelectorAll(".field-area-only").forEach(el => {
      el.classList.toggle("hidden", isInsumos);
    });

    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "question-card";

      const key = item.key;
      const label = isInsumos ? item.label : String(index + 1);
      const yesLabel = isInsumos ? "CONFORME" : "SI";
      const noLabel = isInsumos ? "NO CONFORME" : "NO";

      card.innerHTML = `
        <div class="question-left">
          <div class="question-badge">${label}</div>
          <div class="question-text">${item.pregunta}</div>
        </div>

        <div class="question-options">
          <label class="radio-option">
            <input type="radio" name="${key}" value="${yesLabel}">
            <span>${yesLabel}</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="${key}" value="${noLabel}">
            <span>${noLabel}</span>
          </label>
        </div>

        <div class="comment-box">
          <input type="text" data-comment="${key}" maxlength="150" placeholder="Comentario">
        </div>
      `;

      questionsContainer.appendChild(card);
    });
  }

  function resetForm() {
    nExpo.value = "";
    ubicacion.value = "";
    pais.value = "";
    responsable.value = "";
    setMessage("");

    document.querySelectorAll("input[type='radio']").forEach(input => {
      input.checked = false;
    });

    document.querySelectorAll("[data-comment]").forEach(input => {
      input.value = "";
    });
  }

  function collectResponses() {
    const respuestas = {};
    const items = currentType === "INSUMOS" ? meta.insumos : meta.area;

    for (const item of items) {
      const selected = document.querySelector(`input[name="${item.key}"]:checked`);
      const comment = document.querySelector(`[data-comment="${item.key}"]`);

      if (!selected) {
        throw new Error(`Debe responder: ${item.pregunta}`);
      }

      respuestas[item.key] = currentType === "INSUMOS"
        ? {
            estado: selected.value,
            comentario: comment ? comment.value.trim() : ""
          }
        : {
            respuesta: selected.value,
            comentario: comment ? comment.value.trim() : ""
          };
    }

    return respuestas;
  }

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      currentType = tab.dataset.type;
      resetForm();
      renderQuestions();
    });
  });

  limpiarBtn.addEventListener("click", resetForm);

  volverBtn.addEventListener("click", () => {
    window.location.href = "./Menu-Opciones/menu.html";
  });

  checkForm.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      setMessage("");

      const expoValue = nExpo.value.trim();

      if (!/^\d{3}$/.test(expoValue)) {
        throw new Error("El N° de Expo debe tener exactamente 3 dígitos.");
      }

      if (!pais.value) {
        throw new Error("Seleccione un país.");
      }

      if (!responsable.value) {
        throw new Error("Seleccione un responsable.");
      }

      if (currentType === "AREA" && !ubicacion.value) {
        throw new Error("Seleccione una ubicación.");
      }

      const payload = {
        tipo: currentType,
        nExpo: expoValue,
        pais: pais.value,
        responsable: responsable.value,
        ubicacion: ubicacion.value,
        respuestas: collectResponses()
      };

      guardarBtn.disabled = true;
      guardarBtn.textContent = "Guardando...";

      const res = await callApi("createChecklistRecord", payload);
      const data = res.data || res;

      setMessage(`Registro guardado correctamente. ID: ${data.id}`, "success");
      resetForm();

    } catch (error) {
      setMessage(error.message || "No se pudo guardar el registro.", "error");
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = "Guardar registro";
    }
  });

  try {
    const res = await callApi("getChecklistMeta");
    meta = res.data || res;

    fechaChecklist.value = meta.serverNow || "";
    fillSelect(pais, meta.paises || [], "Seleccione país");
    fillSelect(responsable, meta.responsables || [], "Seleccione responsable");
    fillSelect(ubicacion, meta.ubicaciones || [], "Seleccione ubicación");

    renderQuestions();

  } catch (error) {
    setMessage(error.message || "No se pudo cargar el módulo Check List.", "error");
  }
});
