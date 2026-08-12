document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const token = getToken();
  const user = getUser();

  let currentType = "INSUMOS";

  let meta = {
    serverNow: "",
    paises: [],
    responsables: [],
    ubicaciones: [],
    insumos: [],
    area: []
  };

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """)
      .replace(/'/g, "&#039;");
  }

  async function callApi(action, payload = {}) {
    if (!token) {
      throw new Error("No se encontró token de sesión.");
    }

    if (typeof apiPost !== "function") {
      throw new Error("No se encontró apiPost. Verifique que js/api.js cargue antes de check-list.js.");
    }

    return await apiPost(action, {
      ...payload,
      token
    });
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

  function setButtonLoading(isLoading) {
    if (!guardarBtn) return;

    guardarBtn.disabled = isLoading;
    guardarBtn.textContent = isLoading ? "Guardando..." : "Guardar registro";
  }

  function renderQuestions() {
    if (!questionsContainer) return;

    questionsContainer.innerHTML = "";

    const isInsumos = currentType === "INSUMOS";
    const items = isInsumos ? meta.insumos || [] : meta.area || [];

    if (sectionTitle) {
      sectionTitle.textContent = isInsumos
        ? "Verificación del estado y disponibilidad de los insumos de embalaje para exportación"
        : "Verificar la zona de preparación para el alistamiento de mercadería de exportación";
    }

    document.querySelectorAll(".field-area-only").forEach((el) => {
      el.classList.toggle("hidden", isInsumos);
    });

    if (!items.length) {
      questionsContainer.innerHTML = `
        <div class="question-card">
          <div class="question-left">
            <div class="question-text">
              No se encontraron preguntas configuradas para este Check List.
            </div>
          </div>
        </div>
      `;
      return;
    }

    items.forEach((item, index) => {
      const key = String(item.key || "").trim();

      if (!key) return;

      const label = isInsumos
        ? String(item.label || key)
        : `PREGUNTA ${index + 1}`;

      const pregunta = String(item.pregunta || "").trim();

      const yesLabel = isInsumos ? "CONFORME" : "SI";
      const noLabel = isInsumos ? "NO CONFORME" : "NO";

      const card = document.createElement("div");
      card.className = "question-card";

      card.innerHTML = `
        <div class="question-left">
          <div class="question-badge">${escapeHtml(label)}</div>
          <div class="question-text">${escapeHtml(pregunta)}</div>
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
          <input
            type="text"
            data-comment="${escapeHtml(key)}"
            maxlength="150"
            placeholder="Comentario"
          >
        </div>
      `;

      questionsContainer.appendChild(card);
    });
  }

  function resetForm() {
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
    const items = currentType === "INSUMOS" ? meta.insumos || [] : meta.area || [];

    for (const item of items) {
      const key = String(item.key || "").trim();

      if (!key) continue;

      const radios = Array.from(document.getElementsByName(key));
      const selected = radios.find((radio) => radio.checked);
      const commentInput = document.querySelector(`[data-comment="${key}"]`);

      if (!selected) {
        throw new Error(`Debe responder: ${item.pregunta || key}`);
      }

      if (currentType === "INSUMOS") {
        respuestas[key] = {
          estado: selected.value,
          comentario: commentInput ? commentInput.value.trim() : ""
        };
      } else {
        respuestas[key] = {
          respuesta: selected.value,
          comentario: commentInput ? commentInput.value.trim() : ""
        };
      }
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
      if (typeof getMenuUrl === "function") {
        window.location.href = getMenuUrl();
      } else {
        window.location.href = "./Menu-Opciones/menu.html";
      }
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
          nExpo: nExpo.value.trim(),
          pais: pais.value,
          responsable: responsable.value,
          ubicacion: ubicacion ? ubicacion.value : "",
          respuestas: collectResponses()
        };

        setButtonLoading(true);

        const result = await callApi("createChecklistRecord", payload);

        setMessage(
          `Registro guardado correctamente. ID: ${result.id || ""}`,
          "success"
        );

        resetForm();

      } catch (error) {
        console.error("Error guardando Check List:", error);
        setMessage(error.message || "No se pudo guardar el registro.", "error");
      } finally {
        setButtonLoading(false);
      }
    });
  }

  async function init() {
    try {
      setMessage("Cargando Check List...");

      const data = await callApi("getChecklistMeta");

      meta = {
        serverNow: data.serverNow || "",
        paises: data.paises || [],
        responsables: data.responsables || [],
        ubicaciones: data.ubicaciones || [],
        insumos: data.insumos || [],
        area: data.area || []
      };

      if (fechaChecklist) {
        fechaChecklist.value = meta.serverNow || "";
      }

      fillSelect(pais, meta.paises, "Seleccione país");
      fillSelect(responsable, meta.responsables, "Seleccione responsable");
      fillSelect(ubicacion, meta.ubicaciones, "Seleccione ubicación");

      renderQuestions();
      setMessage("");

      console.log("Check List iniciado correctamente para:", user?.usuario || user?.nombre || "Usuario");

    } catch (error) {
      console.error("Error inicializando Check List:", error);
      setMessage(error.message || "No se pudo cargar el módulo Check List.", "error");
    }
  }

  await init();
});
