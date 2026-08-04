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
    meta: {
      clientes: [],
      config: {},
      groups: {}
    },
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
const scannerVideo = document.getElementById("scannerVideo");
const scannerMessage = document.getElementById("scannerMessage");
const scannerGuide = document.getElementById("scannerGuide");

const SCAN_REQUIRED_MATCHES = 5;
const SCAN_MIN_STABLE_MS = 800;

let lastScanValue = "";
let scanMatchCount = 0;
let scanFirstSeenAt = 0;

const btnCerrarScanner = document.getElementById("btnCerrarScanner");
const btnCancelarScanner = document.getElementById("btnCancelarScanner");

let activeScanInput = null;
let scannerStream = null;
let scannerDetector = null;
let scannerAnimationId = null;
let scannerRunning = false;


  function addClick(element, handler) {
    if (element) {
      element.addEventListener("click", handler);
    }
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
      state.user.nombre ||
      state.user.name ||
      state.user.username ||
      state.user.usuario ||
      "Usuario";

    const rol =
      state.user.cargo ||
      state.user.rol ||
      state.user.perfil ||
      "USUARIO";

    if (usuarioActivo) {
      usuarioActivo.textContent = nombre;
    }

    if (rolActivo) {
      rolActivo.textContent = String(rol).toUpperCase();
    }
  }

  async function loadSessionUser() {
    const storedUser = getStoredUserRobust();
    setUserUI(storedUser);

    try {
      const res = await apiPost("getSesion", { token });
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
    name === "CLIENTE_GB" ||
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

function setScannerMessage(message) {
  if (scannerMessage) {
    scannerMessage.textContent = message;
  }
}

async function createBarcodeDetector() {
  if (!("BarcodeDetector" in window)) {
    throw new Error("Este navegador no soporta escaneo nativo de códigos de barras.");
  }

  const preferredFormats = [
    "code_128",
    "code_39",
    "code_93",
    "ean_13",
    "ean_8",
    "upc_a",
    "upc_e",
    "itf",
    "qr_code"
  ];

  try {
    if (typeof BarcodeDetector.getSupportedFormats === "function") {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = preferredFormats.filter((format) => supported.includes(format));

      if (formats.length) {
        return new BarcodeDetector({ formats });
      }
    }
  } catch (error) {
    console.warn("No se pudieron obtener formatos soportados:", error);
  }

  return new BarcodeDetector();
}

function resetScanStability() {
  lastScanValue = "";
  scanMatchCount = 0;
  scanFirstSeenAt = 0;
}

function isBarcodeInsideGuide(code) {
  if (!code || !code.boundingBox || !scannerVideo) return true;

  const videoWidth = scannerVideo.videoWidth || 0;
  const videoHeight = scannerVideo.videoHeight || 0;

  if (!videoWidth || !videoHeight) return true;

  const box = code.boundingBox;

  const centerX = (box.x + box.width / 2) / videoWidth;
  const centerY = (box.y + box.height / 2) / videoHeight;

  const guideLeft = 0.11;
  const guideRight = 0.89;
  const guideTop = 0.34;
  const guideBottom = 0.66;

  return (
    centerX >= guideLeft &&
    centerX <= guideRight &&
    centerY >= guideTop &&
    centerY <= guideBottom
  );
}

function shouldAcceptStableScan(value) {
  const now = Date.now();

  if (!value) {
    resetScanStability();
    return false;
  }

  if (value !== lastScanValue) {
    lastScanValue = value;
    scanMatchCount = 1;
    scanFirstSeenAt = now;
    return false;
  }

  scanMatchCount++;

  const stableTime = now - scanFirstSeenAt;

  return (
    scanMatchCount >= SCAN_REQUIRED_MATCHES &&
    stableTime >= SCAN_MIN_STABLE_MS
  );
}


async function openBarcodeScanner(inputElement) {
  if (!inputElement) {
    showToast("No se encontró el campo destino para escanear.", "error");
    return;
  }

  activeScanInput = inputElement;
  resetScanStability();

  try {
    document.body.classList.add("scanner-open");

    scannerModal.classList.add("is-open");
    scannerModal.setAttribute("aria-hidden", "false");

    setScannerMessage("Solicitando acceso a la cámara...");

    scannerDetector = await createBarcodeDetector();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("El navegador no permite acceso a cámara.");
    }

    scannerStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    scannerVideo.srcObject = scannerStream;

    await scannerVideo.play();

    scannerRunning = true;
    setScannerMessage("Apunte la cámara al código de barras.");
    scanFrame();

  } catch (error) {
    console.error("Error iniciando scanner:", error);
    stopBarcodeScanner();
    showToast(error.message || "No se pudo iniciar la cámara.", "error");
  }
}

async function scanFrame() {
  if (!scannerRunning || !scannerDetector || !scannerVideo) return;

  try {
    if (scannerVideo.readyState >= 2) {
      const codes = await scannerDetector.detect(scannerVideo);

      if (codes && codes.length > 0) {
        const centeredCodes = codes.filter((code) => {
          return code.rawValue && isBarcodeInsideGuide(code);
        });

        if (codes.length > 1 && centeredCodes.length !== 1) {
          resetScanStability();
          setScannerMessage("Hay varios códigos visibles. Centre solo uno dentro del recuadro.");
          scannerAnimationId = requestAnimationFrame(scanFrame);
          return;
        }

        if (!centeredCodes.length) {
          resetScanStability();
          setScannerMessage("Centre el código dentro del recuadro verde.");
          scannerAnimationId = requestAnimationFrame(scanFrame);
          return;
        }

        const code = centeredCodes[0];
        const value = String(code.rawValue || "").trim();

        if (shouldAcceptStableScan(value)) {
          if (activeScanInput) {
            activeScanInput.value = value;
            activeScanInput.dispatchEvent(new Event("input", { bubbles: true }));
            activeScanInput.dispatchEvent(new Event("change", { bubbles: true }));

            showToast("Código escaneado correctamente.", "ok");
            stopBarcodeScanner();
            return;
          }
        } else {
          setScannerMessage("Mantenga el código centrado y estable...");
        }
      } else {
        resetScanStability();
        setScannerMessage("Apunte la cámara al código de barras.");
      }
    }
  } catch (error) {
    console.warn("Intento de lectura sin resultado:", error);
  }

  scannerAnimationId = requestAnimationFrame(scanFrame);
}


function stopBarcodeScanner() {
  scannerRunning = false;

  if (scannerAnimationId) {
    cancelAnimationFrame(scannerAnimationId);
    scannerAnimationId = null;
  }

  if (scannerVideo) {
    scannerVideo.pause();
    scannerVideo.srcObject = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  scannerDetector = null;
  activeScanInput = null;
  resetScanStability();

  if (scannerModal) {
    scannerModal.classList.remove("is-open");
    scannerModal.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("scanner-open");
}


  function showPageLoader(message = "Cargando registros...") {
    if (!pageLoader) return;

    if (pageLoaderText) {
      pageLoaderText.textContent = message;
    }

    pageLoader.classList.add("is-open");
    pageLoader.setAttribute("aria-hidden", "false");
  }

  function hidePageLoader() {
    if (!pageLoader) return;

    pageLoader.classList.remove("is-open");
    pageLoader.setAttribute("aria-hidden", "true");
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
    const meta = await apiPost("getLotesMeta", { token });

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

      const res = await apiPost("listLoteRecords", {
        token,
        cliente: filtroCliente ? filtroCliente.value : "",
        estado: filtroEstado ? filtroEstado.value : "",
        fecha: filtroFecha ? filtroFecha.value : ""
      });

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

  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);

  if (match) {
    const [, y, m, d, h, mi, s] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    ).getTime();
  }

  match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);

  if (match) {
    const [, d, m, y, h, mi, s] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    ).getTime();
  }

  const fallback = Date.parse(raw);
  return Number.isNaN(fallback) ? 0 : fallback;
}

function sortRecordsByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const dateDiff = parseRecordDate(b.fecha) - parseRecordDate(a.fecha);

    if (dateDiff !== 0) {
      return dateDiff;
    }

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
            <td>${escapeHtml(item.sheetName || "")}</td>
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
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  }

  function openModal() {
    if (!formRegistro || !camposDinamicos || !modalRegistro) return;

    formRegistro.reset();

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

const canScan = isScannableField(campo);

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

    const cliente = clienteRegistro ? clienteRegistro.value : "";

    if (!cliente) {
      showToast("Seleccione un cliente.", "error");
      return;
    }

    const campos = collectFields();

    try {
      setButtonLoading(btnGuardarRegistro, "Guardando...", true);

      const res = await apiPost("createLoteRecord", {
        token,
        cliente,
        campos,
        comentario: comentarioRegistro ? comentarioRegistro.value.trim() : ""
      });

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
      .replace(/[\\/?*[\]:]/g, "_")
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


  function downloadExcelWorkbook() {
    if (typeof XLSX === "undefined") {
      showToast("No se encontró xlsx.full.min.js. Verifique que esté cargado antes de toma-lotes.js.", "error");
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

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        safeSheetName(group.sheetName || group.label)
      );
    });

    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, "");

    XLSX.writeFile(wb, `Toma_Lotes_${stamp}.xlsx`, {
      compression: true
    });
  }

addClick(btnNuevoRegistro, openModal);
addClick(btnCerrarModal, closeModal);
addClick(btnCancelarRegistro, closeModal);
addClick(btnDescargarExcel, downloadExcelWorkbook);

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


  addClick(btnCerrarScanner, stopBarcodeScanner);
addClick(btnCancelarScanner, stopBarcodeScanner);

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

    hidePageLoader();
  }
});
