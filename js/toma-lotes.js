document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const token = getToken();

  const LOTES_STATIC_EXPORT_HEADERS = [
    "ID_REGISTRO",
    "FECHA_REGISTRO",
    "CLIENTE",
    "USUARIO_LOGIN",
    "NOMBRE_USUARIO",
    "ROL_USUARIO",
    "ESTADO",
    "COMENTARIO",
    "ULTIMA_ACTUALIZACION"
  ];

  const state = {
    user: null,
    meta: { clientes: [], config: {}, groups: {} },
    records: []
  };

  const usuarioActivo = document.getElementById("usuarioActivo");
  const rolActivo = document.getElementById("rolActivo");
  const filtroCliente = document.getElementById("filtroCliente");
  const filtroEstado = document.getElementById("filtroEstado");
  const filtroFecha = document.getElementById("filtroFecha");
  const btnBuscar = document.getElementById("btnBuscar");
  const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
  const btnDescargarExcel = document.getElementById("btnDescargarExcel");
  const btnActualizarRegistros = document.getElementById("btnActualizarRegistros");
  const btnNuevoRegistro = document.getElementById("btnNuevoRegistro");
  const modalRegistro = document.getElementById("modalRegistro");
  const btnCerrarModal = document.getElementById("btnCerrarModal");
  const btnCancelarRegistro = document.getElementById("btnCancelarRegistro");
  const formRegistro = document.getElementById("formRegistro");
  const clienteRegistro = document.getElementById("clienteRegistro");
  const camposDinamicos = document.getElementById("camposDinamicos");
  const comentarioRegistro = document.getElementById("comentarioRegistro");
  const btnGuardarRegistro = document.getElementById("btnGuardarRegistro");
  const tablaRegistros = document.getElementById("tablaRegistros");
  const statTotal = document.getElementById("statTotal");
  const statClientes = document.getElementById("statClientes");
  const statActualizado = document.getElementById("statActualizado");
  const toast = document.getElementById("toast");
  const pageLoader = document.getElementById("pageLoader");
  const pageLoaderText = document.getElementById("pageLoaderText");
  const scannerModal = document.getElementById("scannerModal");
  const scannerMessage = document.getElementById("scannerMessage");
  const btnCerrarScanner = document.getElementById("btnCerrarScanner");
  const btnCancelarScanner = document.getElementById("btnCancelarScanner");
  const scanVideo = document.getElementById("scanVideo");

  let activeScanInput = null;
  let scannerRunning = false;
  let scanLocked = false;
  let scannerStream = null;
  let barcodeDetector = null;
  let scanRafId = null;
  let editingId = null;

  function addClick(el, handler) {
    if (el) el.addEventListener("click", handler);
  }

  function withTimeout(promise, ms = 20000, label = "Operación") {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} excedió el tiempo de espera.`)), ms)
      )
    ]);
  }

  function apiPostTimed(action, payload, ms = 20000) {
    return withTimeout(apiPost(action, payload), ms, action);
  }

  function parseJsonSafe(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getStoredUserRobust() {
    return (
      parseJsonSafe(localStorage.getItem("authUser")) ||
      parseJsonSafe(sessionStorage.getItem("authUser")) ||
      parseJsonSafe(localStorage.getItem("ct_user")) ||
      getUser() ||
      null
    );
  }

  function setUserUI(user) {
    state.user = user || {};
    const nombre =
      state.user.nombre || state.user.name || state.user.username || state.user.usuario || "Usuario";
    const rol = state.user.cargo || state.user.rol || state.user.perfil || "USUARIO";
    if (usuarioActivo) usuarioActivo.textContent = nombre;
    if (rolActivo) rolActivo.textContent = String(rol).toUpperCase();
  }

  async function loadSessionUser() {
    const storedUser = getStoredUserRobust();
    setUserUI(storedUser);
    try {
      const res = await apiPostTimed("getSesion", { token }, 8000);
      const userFromApi = res.user || res.session || null;
      if (userFromApi) {
        localStorage.setItem("authUser", JSON.stringify(userFromApi));
        sessionStorage.setItem("authUser", JSON.stringify(userFromApi));
        localStorage.setItem("ct_user", JSON.stringify(userFromApi));
        setUserUI(userFromApi);
      }
    } catch (error) {
      console.warn("No se pudo refrescar la sesión:", error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function normalizeScanFieldName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }

  function isScannableField(fieldName) {
    const name = normalizeScanFieldName(fieldName);
    if (!name) return false;
    if (
      name.includes("CANT") ||
      name.includes("CANTIDAD") ||
      name === "FECHA" ||
      name === "USUARIO" ||
      name === "COMENTARIO"
    ) {
      return false;
    }
    return (
      name === "SKU" ||
      name === "PEDIDO" ||
      name.includes("LOTE")
    );
  }

  function formatLocalNow() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  function showToast(message, type = "ok") {
    if (!toast) {
      alert(message);
      return;
    }
    toast.textContent = message;
    toast.className = `toast is-show ${type}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.className = "toast";
    }, 3500);
  }

  function showPageLoader(message = "Cargando registros...") {
    if (!pageLoader) return;
    if (pageLoaderText) pageLoaderText.textContent = message;
    pageLoader.classList.add("is-open");
    pageLoader.setAttribute("aria-hidden", "false");
  }

  function hidePageLoader() {
    if (!pageLoader) return;
    pageLoader.classList.remove("is-open");
    pageLoader.setAttribute("aria-hidden", "true");
  }

  function setScannerMessage(message) {
    if (scannerMessage) scannerMessage.textContent = message;
  }

  function playScanBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.warn("No se pudo reproducir sonido:", error);
    }
  }
  async function openBarcodeScanner(inputElement) {
    if (!inputElement) {
      showToast("No se encontró el campo destino para escanear.", "error");
      return;
    }

    if (!("BarcodeDetector" in window)) {
      showToast("Este navegador no soporta escaneo nativo. Use Chrome actualizado en Android.", "error");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("El navegador no permite acceso a la cámara.", "error");
      return;
    }

    if (!scannerModal || !scanVideo) {
      showToast("No se encontró el modal de escaneo.", "error");
      return;
    }

    activeScanInput = inputElement;
    scanLocked = false;

    document.body.classList.add("scanner-open");
    scannerModal.classList.add("is-open");
    scannerModal.setAttribute("aria-hidden", "false");

    const scannerBox = scannerModal.querySelector(".scanner-modal");
    scannerBox?.classList.remove("is-captured");
    document.getElementById("scannerFrame")?.classList.remove("is-captured");

    setScannerMessage("Solicitando acceso a la cámara...");

    try {
      const formats = [
        "code_128",
        "code_39",
        "code_93",
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "itf",
        "codabar"
      ];

      let usableFormats = formats;

      if (typeof BarcodeDetector.getSupportedFormats === "function") {
        const supported = await BarcodeDetector.getSupportedFormats();
        const filtered = formats.filter((f) => supported.includes(f));
        if (filtered.length) {
          usableFormats = filtered;
        }
      }

      barcodeDetector = new BarcodeDetector({ formats: usableFormats });

      scannerStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      scanVideo.srcObject = scannerStream;
      await scanVideo.play();

      try {
        const track = scannerStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = [];

        if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
          advanced.push({ focusMode: "continuous" });
        }

        if (advanced.length) {
          await track.applyConstraints({ advanced });
        }
      } catch (e) {
        console.warn("No se pudo aplicar enfoque continuo:", e);
      }

      scannerRunning = true;
      setScannerMessage("Centre el código dentro del recuadro.");
      scanLoop();
    } catch (error) {
      console.error("Error iniciando cámara:", error);
      await stopBarcodeScanner();
      showToast(
        error && error.message
          ? `No se pudo iniciar la cámara: ${error.message}`
          : "No se pudo iniciar la cámara. Revise permisos.",
        "error"
      );
    }
  }

function pickCodeInsideFrame(codes) {
  const vw = scanVideo.videoWidth || 0;
  const vh = scanVideo.videoHeight || 0;

  if (!vw || !vh) {
    return codes[0] || null;
  }

  // Zona central que coincide aprox. con el recuadro visual (88% ancho, 34% alto)
  const zoneLeft = vw * 0.06;
  const zoneRight = vw * 0.94;
  const zoneTop = vh * 0.33;
  const zoneBottom = vh * 0.67;

  for (const code of codes) {
    const box = code.boundingBox;
    if (!box) continue;

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (cx >= zoneLeft && cx <= zoneRight && cy >= zoneTop && cy <= zoneBottom) {
      return code;
    }
  }

  return null;
}


async function scanLoop() {
  if (!scannerRunning || scanLocked || !barcodeDetector || !scanVideo) {
    return;
  }

  try {
    if (scanVideo.readyState >= 2) {
      const codes = await barcodeDetector.detect(scanVideo);

      if (codes && codes.length) {
        const valid = pickCodeInsideFrame(codes);

        if (valid) {
          const value = String(valid.rawValue || "").trim();
          if (value) {
            onBarcodeDetected(value);
            return;
          }
        } else {
          setScannerMessage("Acerque el código al recuadro central.");
        }
      }
    }
  } catch (error) {
    console.warn("Lectura en curso:", error);
  }

  scanRafId = requestAnimationFrame(scanLoop);
}


  function onBarcodeDetected(value) {
    if (scanLocked) return;
    scanLocked = true;

    if (activeScanInput) {
      activeScanInput.value = value;
      activeScanInput.dispatchEvent(new Event("input", { bubbles: true }));
      activeScanInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const scannerBox = scannerModal.querySelector(".scanner-modal");
    scannerBox?.classList.add("is-captured");
    document.getElementById("scannerFrame")?.classList.add("is-captured");

    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    playScanBeep();
    setScannerMessage("Código capturado correctamente.");

    window.setTimeout(() => {
      showToast("Código escaneado correctamente.", "ok");
      stopBarcodeScanner();
    }, 250);
  }

  async function stopBarcodeScanner() {
    scannerRunning = false;
    scanLocked = false;

    if (scanRafId) {
      cancelAnimationFrame(scanRafId);
      scanRafId = null;
    }

    if (scanVideo) {
      try {
        scanVideo.pause();
      } catch (e) {}
      scanVideo.srcObject = null;
    }

    if (scannerStream) {
      scannerStream.getTracks().forEach((track) => track.stop());
      scannerStream = null;
    }

    barcodeDetector = null;
    activeScanInput = null;

    if (scannerModal) {
      scannerModal.classList.remove("is-open");
      scannerModal.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("scanner-open");
  }

  function setButtonLoading(button, loadingText, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = loadingText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function setButtonHtmlLoading(button, loadingHtml, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalHtml = button.innerHTML;
      button.innerHTML = loadingHtml;
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalHtml || button.innerHTML;
      button.disabled = false;
    }
  }

  function fillSelect(select, clientes, firstLabel) {
    if (!select) return;
    select.innerHTML = `<option value="">${firstLabel}</option>`;
    clientes.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente;
      option.textContent = cliente;
      select.appendChild(option);
    });
  }

  async function loadMeta() {
    const meta = await apiPostTimed("getLotesMeta", { token }, 12000);
    state.meta = {
      clientes: meta.clientes || [],
      config: meta.config || {},
      groups: meta.groups || {}
    };
    fillSelect(filtroCliente, state.meta.clientes, "Todos los clientes");
    fillSelect(clienteRegistro, state.meta.clientes, "Seleccione cliente");
  }

  async function loadRecords(message = "Cargando registros...") {
    showPageLoader(message);
    try {
      if (tablaRegistros) {
        tablaRegistros.innerHTML = `
          <tr>
            <td colspan="8" class="empty">Cargando registros...</td>
          </tr>
        `;
      }

      const res = await apiPostTimed("listLoteRecords", {
        token,
        cliente: filtroCliente ? filtroCliente.value : "",
        estado: filtroEstado ? filtroEstado.value : "",
        fecha: formatDateFilterForApi(filtroFecha ? filtroFecha.value : "")

      }, 20000);

      renderRecords(res.rows || []);
    } finally {
      hidePageLoader();
    }
  }

  function updateStats() {
    const clientesUnicos = new Set(
      state.records.map((item) => item.cliente).filter(Boolean)
    );
    if (statTotal) statTotal.textContent = String(state.records.length);
    if (statClientes) statClientes.textContent = String(clientesUnicos.size);
    if (statActualizado) {
      statActualizado.textContent = new Date().toLocaleTimeString("es-PE");
    }
  }

function parseRecordDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  // Formato: 2026-08-14 11:52:35 o 2026-08-14 11:52
  let match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (match) {
    const [, y, m, d, h = "0", mi = "0", s = "0"] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    ).getTime();
  }

  // Formato: 14/08/2026 11:52:35 o 14/08/2026 11:52
  match = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (match) {
    const [, d, m, y, h = "0", mi = "0", s = "0"] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    ).getTime();
  }

  return 0;
}
function formatDateFilterForApi(value) {
  const raw = String(value || "").trim();

  // Convierte 2026-08-14 a 14/08/2026
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }

  return raw;
}


  function sortRecordsByDateDesc(rows) {
    return [...rows].sort((a, b) => {
      const dateDiff = parseRecordDate(b.fecha) - parseRecordDate(a.fecha);
      if (dateDiff !== 0) return dateDiff;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

function renderRecords(rows) {
  state.records = Array.isArray(rows) ? sortRecordsByDateDesc(rows) : [];

  if (!tablaRegistros) return;

  if (!state.records.length) {
    tablaRegistros.innerHTML = `
      <tr>
        <td colspan="8" class="empty">No se encontraron registros.</td>
      </tr>
    `;
    updateStats();
    return;
  }

  tablaRegistros.innerHTML = state.records
    .map((item) => {
      return `
        <tr>
          <td><strong>${escapeHtml(item.id)}</strong></td>
          <td>${escapeHtml(item.fecha)}</td>
          <td>${escapeHtml(item.cliente)}</td>
          <td>${escapeHtml(item.grupo || item.groupKey || "")}</td>
          <td>${escapeHtml(item.nombre || item.usuario)}</td>
          <td><span class="badge">${escapeHtml(item.estado)}</span></td>
          <td>${escapeHtml(item.comentario || "")}</td>
          <td>
            <button type="button" class="edit-btn" data-id="${escapeHtml(item.id)}" title="Editar registro">
              ✏️
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  updateStats();
}


  function resetModalScroll() {
    if (!modalRegistro) return;
    modalRegistro.scrollTop = 0;
    const modalBody = modalRegistro.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
  }

function buildEditFields(campos) {
  const entries = Object.entries(campos || {});

  if (!entries.length) {
    return `<div class="hint">Este registro no tiene campos editables.</div>`;
  }

  return entries
    .map(([campo, valor], index) => {
      const campoNorm = normalize(campo);
      const id = `edit_campo_${index}`;
      const isFecha = campoNorm === "FECHA";
      const isUsuario = campoNorm === "USUARIO";

      return `
        <div class="field">
          <label for="${id}">${escapeHtml(campo)}</label>
          <input
            type="text"
            id="${id}"
            class="lote-field"
            data-name="${escapeHtml(campo)}"
            value="${escapeHtml(valor)}"
            ${isFecha || isUsuario ? "readonly" : ""}
          />
        </div>
      `;
    })
    .join("");
}

async function openEditModal(id) {
  if (!id) return;

  try {
    showPageLoader("Cargando registro...");
    const rec = await apiPostTimed("getLoteRecord", { token, id }, 15000);
    hidePageLoader();

    editingId = rec.id;

    formRegistro.reset();

    // Cliente fijo (no editable)
    fillSelect(clienteRegistro, [rec.cliente], rec.cliente);
    clienteRegistro.value = rec.cliente;
    clienteRegistro.disabled = true;

    camposDinamicos.innerHTML = buildEditFields(rec.campos || rec.datos || {});
    if (comentarioRegistro) comentarioRegistro.value = rec.comentario || "";

    const title = modalRegistro.querySelector(".modal-head h2");
    if (title) title.textContent = `Editar ${rec.id}`;

    if (btnGuardarRegistro) btnGuardarRegistro.textContent = "Guardar cambios";

    document.body.classList.add("modal-open");
    modalRegistro.classList.add("is-open");
    modalRegistro.setAttribute("aria-hidden", "false");
    setTimeout(resetModalScroll, 50);
  } catch (error) {
    hidePageLoader();
    console.error("Error abriendo edición:", error);
    showToast(error.message || "No se pudo cargar el registro.", "error");
  }
}


function openModal() {
  if (!formRegistro || !camposDinamicos || !modalRegistro) return;

  editingId = null;

  if (clienteRegistro) {
    clienteRegistro.disabled = false;
    fillSelect(clienteRegistro, state.meta.clientes, "Seleccione cliente");
  }

  formRegistro.reset();

  const title = modalRegistro.querySelector(".modal-head h2");
  if (title) title.textContent = "Toma de Lotes";
  if (btnGuardarRegistro) btnGuardarRegistro.textContent = "Guardar Registro";

  camposDinamicos.innerHTML = `
    <div class="hint">
      Seleccione un cliente para cargar los campos correspondientes.
    </div>
  `;

  document.body.classList.add("modal-open");
  modalRegistro.classList.add("is-open");
  modalRegistro.setAttribute("aria-hidden", "false");

  setTimeout(resetModalScroll, 50);
}


function closeModal() {
  if (!modalRegistro) return;

  modalRegistro.classList.remove("is-open");
  modalRegistro.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  editingId = null;

  if (clienteRegistro) {
    clienteRegistro.disabled = false;
  }
}


  function renderDynamicFields(cliente) {
    if (!camposDinamicos) return;

    const config = state.meta.config[cliente];

    if (!cliente || !config) {
      camposDinamicos.innerHTML = `
        <div class="hint">Seleccione un cliente para cargar los campos correspondientes.</div>
      `;
      return;
    }

    const campos = Array.isArray(config.campos) ? config.campos : [];

    if (!campos.length) {
      camposDinamicos.innerHTML = `
        <div class="hint">Este cliente no tiene campos configurados.</div>
      `;
      return;
    }

    camposDinamicos.innerHTML = campos
      .filter((campo) => normalize(campo) !== "CLIENTE")
      .map((campo, index) => {
        const campoNorm = normalize(campo);
        const id = `campo_${index}`;
        const isFecha = campoNorm === "FECHA";
        const isUsuario = campoNorm === "USUARIO";
        const isComentario = campoNorm === "COMENTARIO";
        const canScan = isScannableField(campo);

        if (isComentario) {
          return `
            <div class="field field-full">
              <label for="${id}">${escapeHtml(campo)}</label>
              <textarea
                id="${id}"
                class="lote-field"
                data-name="${escapeHtml(campo)}"
                rows="3"
                placeholder="Ingrese ${escapeHtml(campo)}"
              ></textarea>
            </div>
          `;
        }

        return `
          <div class="field">
            <label for="${id}">${escapeHtml(campo)}</label>

            <div class="${canScan ? "scan-input-wrap" : ""}">
              <input
                type="text"
                id="${id}"
                class="lote-field"
                data-name="${escapeHtml(campo)}"
                value="${
                  isFecha
                    ? formatLocalNow()
                    : isUsuario
                      ? escapeHtml(state.user?.usuario || state.user?.username || "")
                      : ""
                }"
                placeholder="Ingrese ${escapeHtml(campo)}"
                ${isFecha || isUsuario ? "readonly" : ""}
              />

              ${
                canScan
                  ? `<button type="button" class="scan-btn" data-target="${id}">Escanear</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    updateAutoFields();
    setTimeout(resetModalScroll, 50);
  }

  function updateAutoFields() {
    const fields = document.querySelectorAll(".lote-field");
    fields.forEach((field) => {
      const name = normalize(field.dataset.name);
      if (name === "FECHA") {
        field.value = formatLocalNow();
      }
      if (name === "USUARIO") {
        field.value = state.user?.usuario || state.user?.username || "";
      }
    });
  }

  function collectFields() {
    updateAutoFields();
    const campos = {};
    const fields = document.querySelectorAll(".lote-field");
    fields.forEach((field) => {
      const name = field.dataset.name;
      campos[name] = field.value.trim();
    });
    return campos;
  }

async function saveRecord(event) {
  event.preventDefault();

  // MODO EDICIÓN
  if (editingId) {
    const campos = collectFields();

    try {
      setButtonLoading(btnGuardarRegistro, "Guardando...", true);

      await apiPostTimed("updateLoteRecord", {
        token,
        id: editingId,
        campos,
        comentario: comentarioRegistro ? comentarioRegistro.value.trim() : ""
      }, 20000);

      showToast(`Registro ${editingId} actualizado correctamente.`, "ok");

      closeModal();
      await loadRecords("Actualizando registros...");
    } catch (error) {
      console.error("Error actualizando registro:", error);
      showToast(error.message || "No se pudo actualizar el registro.", "error");
    } finally {
      setButtonLoading(btnGuardarRegistro, "Guardar cambios", false);
    }

    return;
  }

  // MODO NUEVO
  const cliente = clienteRegistro ? clienteRegistro.value : "";

  if (!cliente) {
    showToast("Seleccione un cliente.", "error");
    return;
  }

  const campos = collectFields();

  try {
    setButtonLoading(btnGuardarRegistro, "Guardando...", true);

    const res = await apiPostTimed("createLoteRecord", {
      token,
      cliente,
      campos,
      comentario: comentarioRegistro ? comentarioRegistro.value.trim() : ""
    }, 20000);

    showToast(`Registro ${res.id} guardado correctamente en ${res.sheetName}.`, "ok");

    closeModal();
    await loadRecords("Actualizando registros...");
  } catch (error) {
    console.error("Error guardando registro:", error);
    showToast(error.message || "No se pudo guardar el registro.", "error");
  } finally {
    setButtonLoading(btnGuardarRegistro, "Guardar Registro", false);
  }
}


  function safeSheetName(name) {
    return String(name || "Hoja")
      .replace(/[\/?*[\]:]/g, "_")
      .slice(0, 31);
  }

  function getOrderedGroupsForExport() {
    const groups = state.meta.groups || {};
    return [
      groups.PRIORIZADOS_1,
      groups.PRIORIZADOS_2,
      groups.PRIORIZADOS_3
    ].filter(Boolean);
  }

  function normalizeExportKey(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function buildNormalizedDatosMap(datos) {
    const map = {};
    Object.keys(datos || {}).forEach((key) => {
      map[normalizeExportKey(key)] = datos[key];
    });
    return map;
  }

  function getDatoValue(datosMap, header) {
    const key = normalizeExportKey(header);
    return datosMap[key] ?? "";
  }

  function buildExcelRow(item, dynamicHeaders) {
    const datos = item.datos || item.campos || {};
    const datosMap = buildNormalizedDatosMap(datos);
    return [
      item.id || "",
      item.fecha || "",
      item.cliente || "",
      item.usuario || "",
      item.nombre || "",
      item.rol || "",
      item.estado || "",
      item.comentario || "",
      item.actualizado || "",
      ...dynamicHeaders.map((header) => getDatoValue(datosMap, header))
    ];
  }

function applyWorksheetWidths(ws, headers) {
  ws["!cols"] = headers.map((header) => {
    const width = Math.max(12, String(header).length + 2);
    return { wch: Math.min(width, 30) };
  });
}


function applyAutoFilter(ws, headers, rowCount) {
  if (!headers.length) return;
  const lastColLetter = XLSX.utils.encode_col(headers.length - 1);
  const lastRowNumber = Math.max(1, rowCount);
  ws["!autofilter"] = {
    ref: `A1:${lastColLetter}${lastRowNumber}`
  };
}


  function downloadExcelWorkbook() {
    if (typeof XLSX === "undefined") {
      showToast("No se encontró xlsx.full.min.js.", "error");
      return;
    }

    const groups = getOrderedGroupsForExport();

    if (!groups.length) {
      showToast("No existe configuración de grupos para exportar.", "error");
      return;
    }

    const wb = XLSX.utils.book_new();

    groups.forEach((group) => {
      const dynamicHeaders = group.storageFields || [];
      const headers = [...LOTES_STATIC_EXPORT_HEADERS, ...dynamicHeaders];

      const groupRows = state.records.filter((item) => {
        return item.groupKey === group.key || item.sheetName === group.sheetName;
      });

      const aoa = [
        headers,
        ...groupRows.map((item) => buildExcelRow(item, dynamicHeaders))
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      applyWorksheetWidths(ws, headers);
      applyAutoFilter(ws, headers, aoa.length);

      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(group.sheetName || group.label));
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    XLSX.writeFile(wb, `Toma_Lotes_${stamp}.xlsx`, { compression: true });
  }

  addClick(btnNuevoRegistro, openModal);
  addClick(btnCerrarModal, closeModal);
  addClick(btnCancelarRegistro, closeModal);
  addClick(btnDescargarExcel, downloadExcelWorkbook);
  addClick(btnCerrarScanner, stopBarcodeScanner);
  addClick(btnCancelarScanner, stopBarcodeScanner);

  addClick(btnActualizarRegistros, async () => {
    try {
      setButtonHtmlLoading(
        btnActualizarRegistros,
        `<span class="refresh-icon spin">↻</span><span>Actualizando...</span>`,
        true
      );
      await loadRecords("Actualizando...");
      showToast("Registros actualizados correctamente.", "ok");
    } catch (error) {
      console.error("Error actualizando registros:", error);
      showToast(error.message || "No se pudieron actualizar los registros.", "error");
    } finally {
      setButtonHtmlLoading(btnActualizarRegistros, "", false);
    }
  });

  document.addEventListener("click", (event) => {
    const scanButton = event.target.closest(".scan-btn");
    if (!scanButton) return;
    const targetId = scanButton.dataset.target;
    const input = document.getElementById(targetId);
    openBarcodeScanner(input);
  });

  if (modalRegistro) {
    modalRegistro.addEventListener("click", (event) => {
      if (event.target === modalRegistro) {
        event.preventDefault();
      }
    });
document.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-btn");
  if (!editButton) return;

  const id = editButton.dataset.id;
  openEditModal(id);
});

  }

  if (clienteRegistro) {
    clienteRegistro.addEventListener("change", () => {
      renderDynamicFields(clienteRegistro.value);
    });
  }

  if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
      try {
        setButtonLoading(btnBuscar, "Buscando...", true);
        await loadRecords("Buscando registros...");
      } catch (error) {
        console.error("Error buscando registros:", error);
        showToast(error.message || "No se pudo cargar la información.", "error");
      } finally {
        setButtonLoading(btnBuscar, "Buscar", false);
      }
    });
  }

  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener("click", async () => {
      if (filtroCliente) filtroCliente.value = "";
      if (filtroEstado) filtroEstado.value = "";
      if (filtroFecha) filtroFecha.value = "";
      try {
        await loadRecords("Cargando registros...");
      } catch (error) {
        console.error("Error limpiando filtros:", error);
        showToast(error.message || "No se pudo limpiar la búsqueda.", "error");
      }
    });
  }

  if (formRegistro) {
    formRegistro.addEventListener("submit", saveRecord);
  }

  setInterval(() => {
    if (modalRegistro && modalRegistro.classList.contains("is-open")) {
      updateAutoFields();
    }
  }, 1000);

  try {
    showPageLoader("Cargando registros...");
    await loadSessionUser();
    await loadMeta();
    await loadRecords("Cargando registros...");
  } catch (error) {
    console.error("Error inicializando Toma de Lotes:", error);
    showToast(error.message || "No se pudo inicializar Toma de Lotes.", "error");

    if (tablaRegistros) {
      tablaRegistros.innerHTML = `
        <tr>
          <td colspan="8" class="empty">
            No se pudo cargar la información inicial.
          </td>
        </tr>
      `;
    }
  } finally {
    hidePageLoader();
  }
});

