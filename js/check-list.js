document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const token = getToken();

  let currentType = "INSUMOS";

  const DEFAULT_META = {
    paises: [
      "EEUU",
      "COLOMBIA",
      "COSTA RICA",
      "CHILE",
      "ECUADOR",
      "PANAMA",
      "BRASIL",
      "MEXICO",
      "ARGENTINA"
    ],
    responsables: [
      "Juan Antonio Espinoza",
      "Jose Luis Perez"
    ],
    ubicaciones: [
      "FRENTE DE RAMPA 1",
      "FRENTE DE RAMPA 12",
      "STAGE MEDICO"
    ],
    insumos: [
      {
        key: "STRETCH_FILM",
        label: "STRECH FILM",
        pregunta: "¿El stretch film se encuentra en buen estado?"
      },
      {
        key: "ZUNCHOS",
        label: "ZUNCHOS",
        pregunta: "¿Los zunchos se encuentran en buen estado?"
      },
      {
        key: "PALLETS",
        label: "PALLETS",
        pregunta: "¿Los pallets se encuentran en condiciones adecuadas para su uso?"
      },
      {
        key: "GRAPAS",
        label: "GRAPAS",
        pregunta: "¿Las grapas se encuentran en buen estado?"
      },
      {
        key: "ESQUINEROS",
        label: "ESQUINEROS",
        pregunta: "¿Los esquineros se encuentran en buen estado?"
      }
    ],
    area: [
      {
        key: "PREGUNTA_1",
        label: "1",
        pregunta: "¿El área de alistamiento para exportación está claramente delimitada e identificada?"
      },
      {
        key: "PREGUNTA_2",
        label: "2",
        pregunta: "¿El área está libre de materiales, equipos y productos ajenos a la operación de exportación?"
      },
      {
        key: "PREGUNTA_3",
        label: "3",
        pregunta: "¿El área se encuentra limpia y ordenada?"
      },
      {
        key: "PREGUNTA_4",
        label: "4",
        pregunta: "¿Los insumos requeridos para el alistamiento de exportación están disponibles?"
      },
      {
        key: "PREGUNTA_5",
        label: "5",
        pregunta: "¿Las condiciones del área permiten realizar el alistamiento de manera segura y conforme a los procedimientos establecidos?"
      }
    ]
  };

  let meta = JSON.parse(JSON.stringify(DEFAULT_META));

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
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingText = document.getElementById("loadingText");
  const loadingCard = document.getElementById("loadingCard");

function formatNow() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "")
      .replace(/'/g, "&#039;");
  }

  function setMessage(message, type = "") {
    if (!formMessage) return;

    formMessage.textContent = message || "";
    formMessage.className = `form-message${type ? " " + type : ""}`;
  }

  function fillSelect(select, items, placeholder) {
    if (!select) return;

    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;

    (items || []).forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  function setFechaActual() {
    if (fechaChecklist) {
      fechaChecklist.value = formatNow();
    }
  }

  async function callApi(action, payload = {}) {
    if (!token) {
      throw new Error("No se encontró token de sesión.");
    }

    if (typeof apiPost !== "function") {
      throw new Error("No se encontró apiPost. Revise que js/api.js cargue antes de check-list.js.");
    }

    return await apiPost(action, {
      token,
      ...payload
    });
  }

  function mergeMetaFromApi(data) {
    data = data || {};

    meta = {
      paises: Array.isArray(data.paises) && data.paises.length
        ? data.paises
        : DEFAULT_META.paises,

      responsables: Array.isArray(data.responsables) && data.responsables.length
        ? data.responsables
        : DEFAULT_META.responsables,

      ubicaciones: Array.isArray(data.ubicaciones) && data.ubicaciones.length
        ? data.ubicaciones
        : DEFAULT_META.ubicaciones,

      insumos: Array.isArray(data.insumos) && data.insumos.length
        ? data.insumos
        : DEFAULT_META.insumos,

      area: Array.isArray(data.area) && data.area.length
        ? data.area
        : DEFAULT_META.area
    };
  }

function renderQuestions() {
  if (!questionsContainer) return;

  questionsContainer.innerHTML = "";

  const isInsumos = currentType === "INSUMOS";
  const items = isInsumos ? meta.insumos : meta.area;

  if (sectionTitle) {
    sectionTitle.textContent = isInsumos
      ? "VERIFICACIÓN DEL ESTADO Y DISPONIBILIDAD DE LOS INSUMOS"
      : "VERIFICAR LA ZONA DE PREPARACIÓN PARA EL ALISTAMIENTO DE MERCADERÍA DE EXPORTACIÓN";
  }

  document.querySelectorAll(".field-area-only").forEach((el) => {
    el.classList.toggle("hidden", isInsumos);
  });

  items.forEach((item, index) => {
    const key = item.key;
    const label = isInsumos ? item.label : String(index + 1);
    const yesLabel = isInsumos ? "CONFORME" : "SI";
    const noLabel = isInsumos ? "NO CONFORME" : "NO";

    const card = document.createElement("div");
    card.className = "question-card";

    card.innerHTML = `
      <div class="question-left">
        <div class="question-badge">${escapeHtml(label)}</div>
        <div class="question-text">${escapeHtml(item.pregunta)}</div>
      </div>

      <div class="question-options">
        <label class="radio-option">
          <input type="radio" name="${escapeHtml(key)}" value="${escapeHtml(yesLabel)}">
          <span>${escapeHtml(yesLabel)}</span>
        </label>

        <label class="radio-option">
          <input type="radio" name="${escapeHtml(key)}" value="${escapeHtml(noLabel)}">
          <span>${escapeHtml(noLabel)}</span>
        </label>
      </div>

      <div class="comment-box">
        <input type="text" data-comment="${escapeHtml(key)}" maxlength="150" placeholder="Comentario">
      </div>
    `;

    questionsContainer.appendChild(card);
  });

  // Fuera del forEach: limpia el borde rojo al escribir en el comentario
  document.querySelectorAll("[data-comment]").forEach((input) => {
    input.addEventListener("input", () => {
      input.style.borderColor = "";
    });
  });
}

  function resetForm() {
    setFechaActual();

    if (nExpo) nExpo.value = "";
    if (ubicacion) ubicacion.value = "";
    if (pais) pais.value = "";
    if (responsable) responsable.value = "";

    document.querySelectorAll("input[type='radio']").forEach((input) => {
      input.checked = false;
    });

    document.querySelectorAll("[data-comment]").forEach((input) => {
      input.value = "";
    });

    setMessage("");
  }

function collectResponses() {
  const respuestas = {};
  const items = currentType === "INSUMOS" ? meta.insumos : meta.area;

  const negativo = currentType === "INSUMOS" ? "NO CONFORME" : "NO";

  for (const item of items) {
    const selected = document.querySelector(`input[name="${item.key}"]:checked`);
    const comment = document.querySelector(`[data-comment="${item.key}"]`);
    const comentarioValor = comment ? comment.value.trim() : "";

    if (!selected) {
      throw new Error(`Debe responder: ${item.pregunta}`);
    }

    // Comentario obligatorio si la respuesta es negativa
    if (selected.value === negativo && !comentarioValor) {
      if (comment) {
        comment.focus();
        comment.style.borderColor = "#b91c1c";
      }
      throw new Error(`Debe ingresar un comentario en: ${item.label || item.pregunta}`);
    }

    respuestas[item.key] = currentType === "INSUMOS"
      ? {
          estado: selected.value,
          comentario: comentarioValor
        }
      : {
          respuesta: selected.value,
          comentario: comentarioValor
        };
  }

  return respuestas;
}


  function validateForm() {
    const expoValue = nExpo ? nExpo.value.trim() : "";

    if (!/^\d{3}$/.test(expoValue)) {
      throw new Error("El N° de Expo debe tener exactamente 3 dígitos.");
    }

    if (!pais || !pais.value) {
      throw new Error("Debe seleccionar un país.");
    }

    if (!responsable || !responsable.value) {
      throw new Error("Debe seleccionar un responsable.");
    }

    if (currentType === "AREA" && (!ubicacion || !ubicacion.value)) {
      throw new Error("Debe seleccionar una ubicación.");
    }
  }

  function setInitialLocalData() {
    setFechaActual();

    fillSelect(pais, DEFAULT_META.paises, "Seleccione país");
    fillSelect(responsable, DEFAULT_META.responsables, "Seleccione responsable");
    fillSelect(ubicacion, DEFAULT_META.ubicaciones, "Seleccione ubicación");

    renderQuestions();
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => {
        item.classList.remove("active");
      });

      tab.classList.add("active");
      currentType = tab.dataset.type || "INSUMOS";

      resetForm();
      renderQuestions();
    });
  });

  if (nExpo) {
    nExpo.addEventListener("input", () => {
      nExpo.value = nExpo.value.replace(/\D/g, "").slice(0, 3);
    });
  }

  if (limpiarBtn) {
    limpiarBtn.addEventListener("click", resetForm);
  }

  if (volverBtn) {
    volverBtn.addEventListener("click", () => {
      window.location.href = typeof getMenuUrl === "function"
        ? getMenuUrl()
        : "./Menu-Opciones/menu.html";
    });
  }

if (checkForm) {
  checkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setMessage("");
      validateForm();

      const payload = {
        tipo: currentType,
        fechaChecklist: fechaChecklist ? fechaChecklist.value : formatNow(),
        nExpo: nExpo.value.trim(),
        pais: pais.value,
        responsable: responsable.value,
        ubicacion: ubicacion ? ubicacion.value : "",
        respuestas: collectResponses()
      };

      if (guardarBtn) {
        guardarBtn.disabled = true;
        guardarBtn.textContent = "Guardando...";
      }

showLoading("Guardando registro...");

const result = await callApi("createChecklistRecord", payload);

// Mostrar éxito dentro del overlay
if (loadingText) loadingText.textContent = `✓ Registro guardado. ID: ${result.id || ""}`;
if (loadingCard) loadingCard.classList.add("success");

resetForm();
renderQuestions();

// Esperar y cerrar
await new Promise((resolve) => setTimeout(resolve, 1800));

hideLoading();
setMessage("Registro guardado correctamente. Puede iniciar un nuevo registro.", "success");

    } catch (error) {
      hideLoading();
      console.error("Error guardando Check List:", error);
      setMessage(error.message || "No se pudo guardar el registro.", "error");
    } finally {
      if (guardarBtn) {
        guardarBtn.disabled = false;
        guardarBtn.textContent = "Guardar registro";
      }
    }
  });
}

function showLoading(message) {
  if (loadingText) loadingText.textContent = message || "Guardando registro...";
  if (loadingCard) loadingCard.classList.remove("success");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
}

function showSuccess(message) {
  if (loadingText) loadingText.textContent = message || "Registro guardado correctamente.";
  if (loadingCard) loadingCard.classList.add("success");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.add("hidden");
  if (loadingCard) loadingCard.classList.remove("success");
}


  async function init() {
    setInitialLocalData();

    setInterval(() => {
      setFechaActual();
    }, 1000);

    try {
      const data = await callApi("getChecklistMeta");

      mergeMetaFromApi(data);

      fillSelect(pais, meta.paises, "Seleccione país");
      fillSelect(responsable, meta.responsables, "Seleccione responsable");
      fillSelect(ubicacion, meta.ubicaciones, "Seleccione ubicación");

      renderQuestions();
      setMessage("");

      console.log("Check List cargado correctamente.");

    } catch (error) {
      console.warn("No se pudo cargar metadata desde Apps Script. Se usan valores locales.", error);
      setMessage("Se cargaron valores locales. Si no permite guardar, revise Apps Script.", "error");
    }
  }

  await init();
});
