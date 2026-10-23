document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  const token = typeof window.getToken === "function" ? window.getToken() : null;
const user = typeof window.getUser === "function" ? window.getUser() : JSON.parse(localStorage.getItem("authUser") || "{}");
  // CORRECCIÓN: Leer estrictamente el rol para evitar que el cargo bloquee los permisos
  const userRole = (user?.rol || "USUARIO").toUpperCase();
  const puedeAprobar = userRole === "SUPERADMIN" || userRole === "APROBADOR";

  const btnRecepcionMain = document.getElementById("btnRecepcionMain");
  const btnDespachoMain = document.getElementById("btnDespachoMain");
  const modalRecepcion = document.getElementById("modalRecepcion");
  const modalDespacho = document.getElementById("modalDespacho");

  // Tabs y Vistas del Tracker
  const tabRecepcion = document.getElementById("tabRecepcion");
  const tabDespacho = document.getElementById("tabDespacho");
  const viewRecepcion = document.getElementById("viewRecepcion");
  const viewDespacho = document.getElementById("viewDespacho");
  const tablaTrackerRecepcion = document.getElementById("tablaTrackerRecepcion");
  const tablaTrackerDespacho = document.getElementById("tablaTrackerDespacho");

  const customLoader = document.getElementById("customLoader");
  const loaderTitle = document.getElementById("loaderTitle");
  const loaderDesc = document.getElementById("loaderDesc");
  const toast = document.getElementById("toast");
  
// Modal de Éxito
  const successModal = document.getElementById("successModal");
  const successMessage = document.getElementById("successMessage");
  const btnCerrarSuccess = document.getElementById("btnCerrarSuccess");

  // Modal de Confirmación
  const confirmModal = document.getElementById("confirmModal");
  const btnCancelarConfirm = document.getElementById("btnCancelarConfirm");
  const btnAceptarConfirm = document.getElementById("btnAceptarConfirm");

  let pedidosDespachoTemp = []; 

  // --- EVENTOS DE TABS ---
  if (tabRecepcion && tabDespacho) {
    tabRecepcion.addEventListener("click", () => {
      tabRecepcion.classList.add("active");
      tabDespacho.classList.remove("active");
      viewRecepcion.style.display = "block";
      viewDespacho.style.display = "none";
    });
    tabDespacho.addEventListener("click", () => {
      tabDespacho.classList.add("active");
      tabRecepcion.classList.remove("active");
      viewDespacho.style.display = "block";
      viewRecepcion.style.display = "none";
    });
  }

  // --- FUNCIONES UI ---
  function showToast(message, type = "ok") {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast is-show ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3500);
  }

  function toggleLoader(show, title = "Cargando...", desc = "Consultando base de datos...") {
    if (!customLoader) return;
    if (show) {
      if (loaderTitle) loaderTitle.textContent = title;
      if (loaderDesc) loaderDesc.textContent = desc;
      customLoader.classList.add("is-open");
      customLoader.setAttribute("aria-hidden", "false");
    } else {
      customLoader.classList.remove("is-open");
      customLoader.setAttribute("aria-hidden", "true");
    }
  }

  function showSuccessModal(message) {
    if (!successModal) return;
    if (successMessage) successMessage.textContent = message;
    successModal.classList.add("is-open");
    successModal.setAttribute("aria-hidden", "false");
  }

  if (btnCerrarSuccess) {
    btnCerrarSuccess.addEventListener("click", () => {
      successModal.classList.remove("is-open");
      successModal.setAttribute("aria-hidden", "true");
    });
  }

  function abrirModal(modal) {
    if (!modal) return;
    document.body.classList.add("modal-open");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function cerrarModal(modal) {
    if (!modal) return;
    document.body.classList.remove("modal-open");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

if (btnRecepcionMain) btnRecepcionMain.addEventListener("click", () => {
    modalRecepcion.querySelector("form").reset();
    
    // Ocultar caja de aprobación y habilitar campos
    const infoBox = modalRecepcion.querySelector(".aprobacion-info");
    if (infoBox) infoBox.style.display = "none";

    const inputs = modalRecepcion.querySelectorAll("input, textarea");
    inputs.forEach(inp => inp.disabled = false); 
    
    modalRecepcion.querySelector(".btn-primary").style.display = "block"; 
    abrirModal(modalRecepcion);
  });
  
  if (btnDespachoMain) btnDespachoMain.addEventListener("click", () => {
    pedidosDespachoTemp = [];
    renderSubTablaDespacho(); // Limpia la sub-tabla
    modalDespacho.querySelector("form").reset();
    
    // Ocultar caja de aprobación y habilitar campos
    const infoBox = modalDespacho.querySelector(".aprobacion-info");
    if (infoBox) infoBox.style.display = "none";

    const inputs = modalDespacho.querySelectorAll("input, textarea, select");
    inputs.forEach(inp => inp.disabled = false); 
    
    modalDespacho.querySelector(".btn-primary").style.display = "block"; 
    if (modalDespacho.querySelector(".btn-soft")) modalDespacho.querySelector(".btn-soft").style.display = "block";
    abrirModal(modalDespacho);
  });

  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => cerrarModal(e.target.closest(".modal-backdrop")));
  });

  // --- LÓGICA DESPACHO ---
  const btnAñadirPedido = modalDespacho?.querySelector(".btn-soft");
  const tbodyDespacho = modalDespacho?.querySelector("tbody");
  const inputCliente = modalDespacho?.querySelector("select");

if (btnAñadirPedido) {
    // Usamos (e) para prevenir recargas o dobles ejecuciones
    btnAñadirPedido.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const cliente = document.getElementById("despCliente").value;
      const pedido = document.getElementById("despPedido").value.trim();
      const oc = document.getElementById("despOC").value;
      const moneda = document.getElementById("despMoneda").value;
      const valor = document.getElementById("despValor").value;
      const fecha = document.getElementById("despFecha").value;
      const tipo = document.getElementById("despTipo").value;
      const comentarios = document.getElementById("despComentarios").value;

      if (!cliente || cliente === "Buscar Clientes") {
        return showToast("Seleccione un cliente válido.", "warning");
      }
      
      if (!pedido || pedido === "") {
        return showToast("Ingrese el número de pedido.", "warning");
      }

      pedidosDespachoTemp.push({
        tipo_solicitud: "DESPACHO",
        cliente: cliente,
        comentario: comentarios,
        detalles: {
          "Cliente": cliente,
          "Pedido": pedido,
          "OC": oc,
          "Valor Venta": valor ? `${moneda} ${valor}` : "",
          "Fecha despacho": fecha,
          "Tipo": tipo,
          "Comentarios": comentarios
        }
      });

      const inputCliente = document.getElementById("despCliente");
      if (inputCliente) inputCliente.disabled = true; 
      renderSubTablaDespacho();
      
      // Limpiar campos para el siguiente registro
      document.getElementById("despPedido").value = "";
      document.getElementById("despOC").value = "";
      document.getElementById("despValor").value = "";
      
      showToast("Pedido añadido a la bandeja.", "ok");
    });
  }

// Modificada para aceptar parámetro isReadOnly y ocultar la "X" en modo lectura
  function renderSubTablaDespacho(isReadOnly = false) {
    if (!tbodyDespacho) return;
    if (pedidosDespachoTemp.length === 0) {
      tbodyDespacho.innerHTML = `<tr><td colspan="6" class="empty">No hay pedidos añadidos</td></tr>`;
      return;
    }
    tbodyDespacho.innerHTML = pedidosDespachoTemp.map((p, i) => {
      const accionHtml = isReadOnly 
        ? `<td style="text-align:center; color:#64748b;">-</td>` 
        : `<td style="color:red; cursor:pointer; text-align:center; font-weight:bold;" onclick="eliminarDespachoTemp(${i})">X</td>`;
      
      return `
      <tr>
        <td>${p.detalles["Cliente"] || "-"}</td>
        <td>${p.detalles["Pedido"] || "-"}</td>
        <td>${p.detalles["OC"] || "-"}</td>
        <td>${p.detalles["Valor Venta"] || "-"}</td>
        <td>${p.detalles["Fecha despacho"] || "-"}</td>
        ${accionHtml}
      </tr>
    `}).join("");
  }

  window.eliminarDespachoTemp = (index) => {
    pedidosDespachoTemp.splice(index, 1);
    if(pedidosDespachoTemp.length === 0 && inputCliente) inputCliente.disabled = false;
    renderSubTablaDespacho();
  };

  // --- ENVÍO A BASE DE DATOS Y MODAL DE ÉXITO ---
  const btnSolicitarDespacho = modalDespacho?.querySelector(".btn-primary");
  if (btnSolicitarDespacho) {
    btnSolicitarDespacho.addEventListener("click", async () => {
      if (pedidosDespachoTemp.length === 0) return showToast("Añada al menos un pedido.", "warning");
      
      toggleLoader(true, "Registrando Pedidos", "Guardando solicitudes en base de datos...");
      try {
        await window.apiPost("savePedidoAdicional", pedidosDespachoTemp);
        cerrarModal(modalDespacho);
        showSuccessModal("Pedidos solicitados correctamente.");
        await cargarTracker();
      } catch (error) { 
        showToast("Error: " + error.message, "error"); 
      } finally {
        toggleLoader(false);
      }
    });
  }

  const btnSolicitarRecepcion = modalRecepcion?.querySelector(".btn-primary");
  if (btnSolicitarRecepcion) {
    btnSolicitarRecepcion.addEventListener("click", async () => {
      const inputs = modalRecepcion.querySelectorAll("input, textarea");
      const detalle = {};
      inputs.forEach(inp => {
        if(inp.previousElementSibling) detalle[inp.previousElementSibling.textContent.trim()] = inp.value;
      });

      toggleLoader(true, "Registrando Recepción", "Guardando solicitud en base de datos...");
      try {
        await window.apiPost("savePedidoAdicional", {
          tipo_solicitud: "RECEPCIÓN",
          cliente: "INTERNO",
          comentario: detalle["Comentarios"],
          detalles: detalle
        });
        cerrarModal(modalRecepcion);
        showSuccessModal("Recepción registrada correctamente.");
        await cargarTracker();
      } catch (error) { 
        showToast("Error: " + error.message, "error"); 
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- CARGAR CLIENTES Y RENDERIZAR TRACKER ---
  async function cargarClientes() {
    try {
      const meta = await window.apiPost("getLotesMeta", { token });
      if (meta.clientes && meta.clientes.length > 0 && inputCliente) {
        inputCliente.innerHTML = `<option value="">Buscar Clientes</option>` + 
          meta.clientes.map(c => `<option value="${c}">${c}</option>`).join("");
      }
    } catch (error) {
      console.warn("No se pudieron cargar los clientes:", error);
    }
  }

// --- ESTADO LOCAL PARA ACCIONES MASIVAS ---
  let idsSeleccionados = new Set();
  const contenedorAccionesMasivas = document.getElementById("contenedorAccionesMasivas");
  const btnAprobarSeleccionados = document.getElementById("btnAprobarSeleccionados");
  const btnRechazarSeleccionados = document.getElementById("btnRechazarSeleccionados");
  const countSeleccionados = document.getElementById("countSeleccionados");
  const countRechazados = document.getElementById("countRechazados");

  function actualizarBotonesAcciones() {
    if (!contenedorAccionesMasivas) return;
    if (idsSeleccionados.size > 0) {
      if (countSeleccionados) countSeleccionados.textContent = idsSeleccionados.size;
      if (countRechazados) countRechazados.textContent = idsSeleccionados.size;
      contenedorAccionesMasivas.style.display = "flex";
    } else {
      contenedorAccionesMasivas.style.display = "none";
    }
  }

// Se expone al contexto global para que los checkboxes del HTML puedan llamarla
  window.toggleCheckbox = (id, isChecked) => {
    if (isChecked) {
      idsSeleccionados.add(id);
    } else {
      idsSeleccionados.delete(id);
    }
    actualizarBotonesAcciones();
  };

  // --- CARGAR CLIENTES Y RENDERIZAR TRACKER ---
  async function cargarClientes() {
    try {
      const meta = await window.apiPost("getLotesMeta", { token });
      if (meta.clientes && meta.clientes.length > 0) {
        const inputCliente = modalDespacho?.querySelector("select");
        if(inputCliente) {
          inputCliente.innerHTML = `<option value="">Buscar Clientes</option>` + 
            meta.clientes.map(c => `<option value="${c}">${c}</option>`).join("");
        }
      }
    } catch (error) {
      console.warn("No se pudieron cargar los clientes:", error);
    }
  }

async function cargarTracker() {
    if (!tablaTrackerRecepcion || !tablaTrackerDespacho) return;
    
    // Limpiar selecciones previas al recargar
    idsSeleccionados.clear();
    actualizarBotonesAcciones(); // <-- CORRECCIÓN AL NUEVO NOMBRE DE LA FUNCIÓN

    try {
      const res = await window.apiPost("listPedidosAdicionales", { token });
      
      if (!res.rows || res.rows.length === 0) {
        tablaTrackerRecepcion.innerHTML = `<tr><td colspan="6" class="empty">No hay solicitudes registradas.</td></tr>`;
        tablaTrackerDespacho.innerHTML = `<tr><td colspan="9" class="empty">No hay solicitudes registradas.</td></tr>`;
        return;
      }

      const recepciones = res.rows.filter(r => r.tipo_solicitud === "RECEPCIÓN");
      const despachos = res.rows.filter(r => r.tipo_solicitud === "DESPACHO");

      // RENDERIZAR RECEPCIONES
      if (recepciones.length === 0) {
        tablaTrackerRecepcion.innerHTML = `<tr><td colspan="6" class="empty">No hay recepciones registradas.</td></tr>`;
      } else {
        tablaTrackerRecepcion.innerHTML = recepciones.map(r => {
          let badgeColor = r.estado === "PENDIENTE" ? "background:#fef08a; color:#854d0e;" :
                           r.estado === "APROBADO" ? "background:#bbf7d0; color:#166534;" : 
                           "background:#fecaca; color:#991b1b;";
                           
          let checkboxHtml = (puedeAprobar && r.estado === "PENDIENTE") 
            ? `<input type="checkbox" onchange="toggleCheckbox('${r.id_registro}', this.checked)" style="width:18px; height:18px; cursor:pointer; vertical-align: middle;">` : ``;

          return `
            <tr>
              <td><strong>${r.id_registro}</strong></td>
              <td>${r.fecha_registro}</td>
              <td>${r.usuario_solicitante}</td>
              <td><span class="badge" style="${badgeColor}">${r.estado}</span></td>
              <td>${r.comentario_general || ""}</td>
              <td style="text-align:center; white-space: nowrap;">
                <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Detalle" style="background:none; border:none; font-size:18px; cursor:pointer; vertical-align: middle;">👁️</button>
                <span style="margin-left: 8px; vertical-align: middle;">${checkboxHtml}</span>
              </td>
            </tr>
          `;
        }).join("");
      }

      // RENDERIZAR DESPACHOS
      if (despachos.length === 0) {
        tablaTrackerDespacho.innerHTML = `<tr><td colspan="9" class="empty">No hay despachos registrados.</td></tr>`;
      } else {
        tablaTrackerDespacho.innerHTML = despachos.map(r => {
          let badgeColor = r.estado === "PENDIENTE" ? "background:#fef08a; color:#854d0e;" :
                           r.estado === "APROBADO" ? "background:#bbf7d0; color:#166534;" : 
                           "background:#fecaca; color:#991b1b;";
                           
          let checkboxHtml = (puedeAprobar && r.estado === "PENDIENTE") 
            ? `<input type="checkbox" onchange="toggleCheckbox('${r.id_registro}', this.checked)" style="width:18px; height:18px; cursor:pointer; vertical-align: middle;">` : ``;

          const pedido = (r.detalles && r.detalles["Pedido"]) ? r.detalles["Pedido"] : "-";
          const oc = (r.detalles && r.detalles["OC"]) ? r.detalles["OC"] : "-";
          const valor = (r.detalles && r.detalles["Valor Venta"]) ? r.detalles["Valor Venta"] : "-";
          const fechaDespacho = r.fecha_registro;

          return `
            <tr>
              <td><strong>${r.id_registro}</strong></td>
              <td>${r.cliente}</td>
              <td>${pedido}</td>
              <td>${oc}</td>
              <td>${valor}</td>
              <td>${fechaDespacho}</td>
              <td>${r.usuario_solicitante}</td>
              <td><span class="badge" style="${badgeColor}">${r.estado}</span></td>
              <td style="text-align:center; white-space: nowrap;">
                <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Detalle" style="background:none; border:none; font-size:18px; cursor:pointer; vertical-align: middle;">👁️</button>
                <span style="margin-left: 8px; vertical-align: middle;">${checkboxHtml}</span>
              </td>
            </tr>
          `;
        }).join("");
      }
      
      window.trackerData = res.rows;
    } catch (error) {
      if (tablaTrackerRecepcion) tablaTrackerRecepcion.innerHTML = `<tr><td colspan="6" class="empty">Error al cargar datos.</td></tr>`;
      if (tablaTrackerDespacho) tablaTrackerDespacho.innerHTML = `<tr><td colspan="9" class="empty">Error al cargar datos.</td></tr>`;
    }
  }

// --- EJECUCIÓN DEL BOTÓN APROBAR MASIVO ---
  if (btnAprobarSeleccionados) {
    btnAprobarSeleccionados.addEventListener("click", async () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;

      toggleLoader(true, "Aprobando Pedidos", "Actualizando base de datos...");
      try {
        await window.apiPost("aprobarPedidosAdicionales", idsArray);
        showSuccessModal("Registros aprobados correctamente.");
        await cargarTracker(); 
      } catch (error) {
        showToast("Error: " + error.message, "error");
      } finally {
        toggleLoader(false);
      }
    });
  }

// --- EJECUCIÓN DEL BOTÓN RECHAZAR MASIVO ---
  if (btnRechazarSeleccionados) {
    btnRechazarSeleccionados.addEventListener("click", () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;

      // Mostrar modal personalizado en lugar de la alerta del navegador
      if (confirmModal) {
        confirmModal.classList.add("is-open");
        confirmModal.setAttribute("aria-hidden", "false");
      }
    });
  }

  // --- BOTONES DENTRO DEL MODAL DE CONFIRMACIÓN ---
  if (btnCancelarConfirm) {
    btnCancelarConfirm.addEventListener("click", () => {
      if (confirmModal) {
        confirmModal.classList.remove("is-open");
        confirmModal.setAttribute("aria-hidden", "true");
      }
    });
  }

  if (btnAceptarConfirm) {
    btnAceptarConfirm.addEventListener("click", async () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;

      // Ocultar modal de confirmación antes de cargar
      if (confirmModal) {
        confirmModal.classList.remove("is-open");
        confirmModal.setAttribute("aria-hidden", "true");
      }

      toggleLoader(true, "Rechazando Pedidos", "Actualizando base de datos...");
      try {
        await window.apiPost("rechazarPedidosAdicionales", idsArray);
        showSuccessModal("Registros rechazados correctamente.");
        await cargarTracker(); 
      } catch (error) {
        showToast("Error: " + error.message, "error");
      } finally {
        toggleLoader(false);
      }
    });
  }

  // Asegúrate de modificar también el cargarTracker() para que al final limpie las acciones
  // (Busca dentro de cargarTracker donde dice "idsSeleccionados.clear();") y cámbialo a:
  // idsSeleccionados.clear();
  // actualizarBotonesAcciones();

  window.verDetalle = (id) => {
    const registro = window.trackerData.find(r => r.id_registro === id);
    if (!registro) return;
    
    const modal = registro.tipo_solicitud === "DESPACHO" ? modalDespacho : modalRecepcion;
    abrirModal(modal);
    
    // Si es despacho, leemos por IDs para rellenar
    if (registro.tipo_solicitud === "DESPACHO") {
      document.getElementById("despCliente").value = registro.detalles["Cliente"] || "";
      document.getElementById("despPedido").value = registro.detalles["Pedido"] || "";
      document.getElementById("despOC").value = registro.detalles["OC"] || "";
      
      let valorCompleto = registro.detalles["Valor Venta"] || "";
      if (valorCompleto.includes(" ")) {
        let partes = valorCompleto.split(" ");
        document.getElementById("despMoneda").value = partes[0];
        document.getElementById("despValor").value = partes[1];
      } else {
        document.getElementById("despValor").value = valorCompleto;
      }
      
document.getElementById("despFecha").value = registro.detalles["Fecha despacho"] || "";
      document.getElementById("despTipo").value = registro.detalles["Tipo"] || "";
      document.getElementById("despComentarios").value = registro.detalles["Comentarios"] || "";
      
      // NUEVO: Llenar la sub-tabla inferior con el registro guardado en modo lectura
      pedidosDespachoTemp = [{
        detalles: registro.detalles
      }];
      renderSubTablaDespacho(true); 
      
    } else {
      // Recepción sigue siendo genérico por labels
      const inputs = modal.querySelectorAll("input, select, textarea");
      inputs.forEach(inp => {
        const label = inp.previousElementSibling ? inp.previousElementSibling.textContent.trim() : null;
        if (label && registro.detalles) inp.value = registro.detalles[label] || "";
      });
    }

    // Bloquear todos los inputs
    modal.querySelectorAll("input, select, textarea").forEach(inp => inp.disabled = true);
    
// Mostrar u Ocultar Datos de Aprobación / Rechazo
    const infoBox = modal.querySelector(".aprobacion-info");
    if (registro.estado === "APROBADO" || registro.estado === "RECHAZADO") {
      if (infoBox) {
        infoBox.style.display = "block";
        const isAprobado = registro.estado === "APROBADO";
        
        // Estilos dinámicos según estado (Verde / Rojo)
        infoBox.style.background = isAprobado ? "#f0fdf4" : "#fef2f2";
        infoBox.style.border = isAprobado ? "1px solid #bbf7d0" : "1px solid #fecaca";
        const textColor = isAprobado ? "#166534" : "#991b1b";
        infoBox.querySelectorAll("p").forEach(p => p.style.color = textColor);

        // Textos dinámicos según estado
        infoBox.querySelector(".lbl-titulo-fecha").textContent = isAprobado ? "Fecha Aprobación:" : "Fecha Rechazo:";
        infoBox.querySelector(".lbl-titulo-usuario").textContent = isAprobado ? "Aprobado por:" : "Rechazado por:";
        
        // Valores extraídos de la BD
        infoBox.querySelector(".lbl-fecha-accion").textContent = registro.fecha_aprobacion || "-";
        infoBox.querySelector(".lbl-usuario-accion").textContent = registro.aprobado_por || "-";
      }
    } else {
      if (infoBox) infoBox.style.display = "none";
    }
    
    modal.querySelector(".btn-primary").style.display = "none";
    if (modal.querySelector(".btn-soft")) modal.querySelector(".btn-soft").style.display = "none";
  };

  toggleLoader(true, "Iniciando", "Cargando registros...");
  Promise.all([cargarClientes(), cargarTracker()]).then(() => toggleLoader(false));
});