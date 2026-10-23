document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  const token = typeof window.getToken === "function" ? window.getToken() : null;
  const user = typeof window.getUser === "function" ? window.getUser() : JSON.parse(localStorage.getItem("authUser") || "{}");
  const userRole = (user?.rol || "USUARIO").toUpperCase();
  const puedeAprobar = userRole === "SUPERADMIN" || userRole === "APROBADOR";

  const btnRecepcionMain = document.getElementById("btnRecepcionMain");
  const btnDespachoMain = document.getElementById("btnDespachoMain");
  const modalRecepcion = document.getElementById("modalRecepcion");
  const modalDespacho = document.getElementById("modalDespacho");

  // Tabs y Vistas
  const tabRecepcion = document.getElementById("tabRecepcion");
  const tabDespacho = document.getElementById("tabDespacho");
  const viewRecepcion = document.getElementById("viewRecepcion");
  const viewDespacho = document.getElementById("viewDespacho");
  const tablaTrackerRecepcion = document.getElementById("tablaTrackerRecepcion");
  const tablaTrackerDespacho = document.getElementById("tablaTrackerDespacho");

  // Filtros y Búsqueda
  let tabActivo = "RECEPCION";
  let estadoFiltroActivo = "TODOS";
  const botonesFiltroEstado = document.querySelectorAll(".btn-estado");
  const filtroFechaGlobal = document.getElementById("filtroFechaGlobal");
  const filtroTextoGlobal = document.getElementById("filtroTextoGlobal");
  const lblBuscarGlobal = document.getElementById("lblBuscarGlobal");
  const btnLimpiarGlobal = document.getElementById("btnLimpiarGlobal");

  const customLoader = document.getElementById("customLoader");
  const loaderTitle = document.getElementById("loaderTitle");
  const loaderDesc = document.getElementById("loaderDesc");
  const toast = document.getElementById("toast");
  
  const successModal = document.getElementById("successModal");
  const successMessage = document.getElementById("successMessage");
  const btnCerrarSuccess = document.getElementById("btnCerrarSuccess");

  const confirmModal = document.getElementById("confirmModal");
  const btnCancelarConfirm = document.getElementById("btnCancelarConfirm");
  const btnAceptarConfirm = document.getElementById("btnAceptarConfirm");

  let pedidosDespachoTemp = []; 
  let idsSeleccionados = new Set();
  const contenedorAccionesMasivas = document.getElementById("contenedorAccionesMasivas");
  const btnAprobarSeleccionados = document.getElementById("btnAprobarSeleccionados");
  const btnRechazarSeleccionados = document.getElementById("btnRechazarSeleccionados");
  const countSeleccionados = document.getElementById("countSeleccionados");
  const countRechazados = document.getElementById("countRechazados");

  // --- EVENTOS DE TABS ---
  if (tabRecepcion && tabDespacho) {
    tabRecepcion.addEventListener("click", () => {
      tabActivo = "RECEPCION";
      tabRecepcion.classList.add("active");
      tabDespacho.classList.remove("active");
      viewRecepcion.style.display = "block";
      viewDespacho.style.display = "none";
      if(lblBuscarGlobal) lblBuscarGlobal.textContent = "Buscar en Recepción (ID, Costo)";
      idsSeleccionados.clear();
      actualizarBotonesAcciones();
      actualizarContadores();
      renderizarTablas();
    });
    tabDespacho.addEventListener("click", () => {
      tabActivo = "DESPACHO";
      tabDespacho.classList.add("active");
      tabRecepcion.classList.remove("active");
      viewDespacho.style.display = "block";
      viewRecepcion.style.display = "none";
      if(lblBuscarGlobal) lblBuscarGlobal.textContent = "Buscar en Despacho (ID, Cliente, Pedido, OC)";
      idsSeleccionados.clear();
      actualizarBotonesAcciones();
      actualizarContadores();
      renderizarTablas();
    });
  }

  // --- EVENTOS DE FILTROS ---
  botonesFiltroEstado.forEach(btn => {
    btn.addEventListener("click", (e) => {
      botonesFiltroEstado.forEach(b => b.style.border = "1px solid transparent");
      const current = e.currentTarget;
      current.style.border = "1px solid #0f4c81"; // Borde para el seleccionado
      estadoFiltroActivo = current.dataset.estado;
      renderizarTablas();
    });
  });

  if (filtroTextoGlobal) filtroTextoGlobal.addEventListener("input", renderizarTablas);
  if (filtroFechaGlobal) filtroFechaGlobal.addEventListener("change", renderizarTablas);

  if (btnLimpiarGlobal) {
    btnLimpiarGlobal.addEventListener("click", () => {
      if(filtroFechaGlobal) filtroFechaGlobal.value = "";
      if(filtroTextoGlobal) filtroTextoGlobal.value = "";
      estadoFiltroActivo = "TODOS";
      botonesFiltroEstado.forEach(b => b.style.border = "1px solid transparent");
      const btnTodos = document.querySelector('.btn-estado[data-estado="TODOS"]');
      if(btnTodos) btnTodos.style.border = "1px solid #0f4c81";
      renderizarTablas();
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

  // --- APERTURA DE NUEVAS SOLICITUDES ---
  if (btnRecepcionMain) btnRecepcionMain.addEventListener("click", () => {
    modalRecepcion.querySelector("form").reset();
    const infoBox = modalRecepcion.querySelector(".aprobacion-info");
    if (infoBox) infoBox.style.display = "none";
    modalRecepcion.querySelectorAll("input, textarea").forEach(inp => inp.disabled = false); 
    modalRecepcion.querySelector(".btn-primary").style.display = "block"; 
    abrirModal(modalRecepcion);
  });
  
  if (btnDespachoMain) btnDespachoMain.addEventListener("click", () => {
    pedidosDespachoTemp = [];
    renderSubTablaDespacho(); 
    modalDespacho.querySelector("form").reset();
    const infoBox = modalDespacho.querySelector(".aprobacion-info");
    if (infoBox) infoBox.style.display = "none";
    modalDespacho.querySelectorAll("input, textarea, select").forEach(inp => inp.disabled = false); 
    modalDespacho.querySelector(".btn-primary").style.display = "block"; 
    if (modalDespacho.querySelector(".btn-soft")) modalDespacho.querySelector(".btn-soft").style.display = "block";
    abrirModal(modalDespacho);
  });

  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => cerrarModal(e.target.closest(".modal-backdrop")));
  });

  // --- LÓGICA DESPACHO (AÑADIR) ---
  const btnAñadirPedido = modalDespacho?.querySelector(".btn-soft");
  const tbodyDespacho = modalDespacho?.querySelector("tbody");
  const inputCliente = modalDespacho?.querySelector("select");

  if (btnAñadirPedido) {
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

      if (!cliente || cliente === "Buscar Clientes") return showToast("Seleccione un cliente válido.", "warning");
      if (!pedido || pedido === "") return showToast("Ingrese el número de pedido.", "warning");

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

      if (inputCliente) inputCliente.disabled = true; 
      renderSubTablaDespacho();
      
      document.getElementById("despPedido").value = "";
      document.getElementById("despOC").value = "";
      document.getElementById("despValor").value = "";
      
      showToast("Pedido añadido a la bandeja.", "ok");
    });
  }

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

  // --- GUARDAR A BASE DE DATOS ---
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
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { toggleLoader(false); }
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
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { toggleLoader(false); }
    });
  }

  // --- ACTUALIZAR CONTADORES ---
  function actualizarContadores() {
    if (!window.trackerData) return;
    
    // Filtrar los datos según la pestaña activa (Recepción o Despacho)
    const tipoFiltro = tabActivo === "RECEPCION" ? "RECEPCIÓN" : "DESPACHO";
    const dataTab = window.trackerData.filter(r => r.tipo_solicitud === tipoFiltro);
    
    const countTotal = dataTab.length;
    const countPendientes = dataTab.filter(r => r.estado === "PENDIENTE").length;
    const countAprobados = dataTab.filter(r => r.estado === "APROBADO").length;
    const countRechazados = dataTab.filter(r => r.estado === "RECHAZADO").length;

    if (document.getElementById("countTodos")) document.getElementById("countTodos").textContent = countTotal;
    if (document.getElementById("countPendientes")) document.getElementById("countPendientes").textContent = countPendientes;
    if (document.getElementById("countAprobados")) document.getElementById("countAprobados").textContent = countAprobados;
    if (document.getElementById("countRechazadosGlobal")) document.getElementById("countRechazadosGlobal").textContent = countRechazados;
  }

  // --- CARGAR Y RENDERIZAR TRACKER (CON FILTROS Y OCULTAMIENTO) ---
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

  window.toggleCheckbox = (id, isChecked) => {
    if (isChecked) idsSeleccionados.add(id);
    else idsSeleccionados.delete(id);
    actualizarBotonesAcciones();
  };

  async function cargarTracker() {
    if (!tablaTrackerRecepcion || !tablaTrackerDespacho) return;
    idsSeleccionados.clear();
    actualizarBotonesAcciones();

    try {
      const res = await window.apiPost("listPedidosAdicionales", { token });
      window.trackerData = res.rows || [];
      actualizarContadores();
      renderizarTablas();
      ajustarColumnasAprobador();
    } catch (error) {
      if (tablaTrackerRecepcion) tablaTrackerRecepcion.innerHTML = `<tr><td colspan="8" class="empty">Error al cargar datos.</td></tr>`;
      if (tablaTrackerDespacho) tablaTrackerDespacho.innerHTML = `<tr><td colspan="10" class="empty">Error al cargar datos.</td></tr>`;
    }
  }

  function ajustarColumnasAprobador() {
    if (!puedeAprobar) {
      document.querySelectorAll(".col-accion-aprobador").forEach(el => el.style.display = "none");
    }
  }

  function renderizarTablas() {
    if (!window.trackerData) return;

    let dataFiltrada = window.trackerData;

    // Filtro por Estado
    if (estadoFiltroActivo !== "TODOS") {
      dataFiltrada = dataFiltrada.filter(r => r.estado === estadoFiltroActivo);
    }

    // Filtro por Fecha
    const fechaVal = filtroFechaGlobal?.value;
    if (fechaVal) {
      const fechaFormat = fechaVal.replace(/-/g, "-");
      dataFiltrada = dataFiltrada.filter(r => r.fecha_registro && (r.fecha_registro.startsWith(fechaFormat) || r.fecha_registro.includes(fechaFormat)));
    }

    // Filtro por Texto General (Búsqueda en tiempo real)
    const textoVal = filtroTextoGlobal?.value.toLowerCase().trim();
    if (textoVal) {
      dataFiltrada = dataFiltrada.filter(r => {
        if (r.tipo_solicitud === "RECEPCIÓN") {
          const id = r.id_registro ? r.id_registro.toLowerCase() : "";
          const costo = (r.detalles && r.detalles["Costos"]) ? String(r.detalles["Costos"]).toLowerCase() : "";
          return id.includes(textoVal) || costo.includes(textoVal);
        } else {
          const id = r.id_registro ? r.id_registro.toLowerCase() : "";
          const cliente = r.cliente ? r.cliente.toLowerCase() : "";
          const pedido = (r.detalles && r.detalles["Pedido"]) ? String(r.detalles["Pedido"]).toLowerCase() : "";
          const oc = (r.detalles && r.detalles["OC"]) ? String(r.detalles["OC"]).toLowerCase() : "";
          return id.includes(textoVal) || cliente.includes(textoVal) || pedido.includes(textoVal) || oc.includes(textoVal);
        }
      });
    }

    const recepciones = dataFiltrada.filter(r => r.tipo_solicitud === "RECEPCIÓN");
    const despachos = dataFiltrada.filter(r => r.tipo_solicitud === "DESPACHO");

    // HTML RECEPCIÓN
    if (recepciones.length === 0) {
      tablaTrackerRecepcion.innerHTML = `<tr><td colspan="8" class="empty">No hay recepciones.</td></tr>`;
    } else {
      tablaTrackerRecepcion.innerHTML = recepciones.map(r => {
        let badgeColor = r.estado === "PENDIENTE" ? "background:#fef08a; color:#854d0e;" :
                         r.estado === "APROBADO" ? "background:#bbf7d0; color:#166534;" : "background:#fecaca; color:#991b1b;";
        
        let checkboxHtml = (r.estado === "PENDIENTE") ? `<input type="checkbox" onchange="toggleCheckbox('${r.id_registro}', this.checked)" style="width:18px; height:18px; cursor:pointer;">` : `-`;
        const costo = (r.detalles && r.detalles["Costos"]) ? r.detalles["Costos"] : "-";

        return `
          <tr>
            <td><strong>${r.id_registro}</strong></td>
            <td>${r.fecha_registro}</td>
            <td>${r.usuario_solicitante}</td>
            <td>${costo}</td>
            <td><span class="badge" style="${badgeColor}">${r.estado}</span></td>
            <td>${r.comentario_general || ""}</td>
            <td style="text-align:center;">
              <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Detalle" style="background:none; border:none; font-size:18px; cursor:pointer;">👁️</button>
            </td>
            <td style="text-align:center;" class="col-accion-aprobador">${checkboxHtml}</td>
          </tr>
        `;
      }).join("");
    }

    // HTML DESPACHO
    if (despachos.length === 0) {
      tablaTrackerDespacho.innerHTML = `<tr><td colspan="10" class="empty">No hay despachos.</td></tr>`;
    } else {
      tablaTrackerDespacho.innerHTML = despachos.map(r => {
        let badgeColor = r.estado === "PENDIENTE" ? "background:#fef08a; color:#854d0e;" :
                         r.estado === "APROBADO" ? "background:#bbf7d0; color:#166534;" : "background:#fecaca; color:#991b1b;";
        
        let checkboxHtml = (r.estado === "PENDIENTE") ? `<input type="checkbox" onchange="toggleCheckbox('${r.id_registro}', this.checked)" style="width:18px; height:18px; cursor:pointer;">` : `-`;
        
        const pedido = (r.detalles && r.detalles["Pedido"]) ? r.detalles["Pedido"] : "-";
        const oc = (r.detalles && r.detalles["OC"]) ? r.detalles["OC"] : "-";
        const valor = (r.detalles && r.detalles["Valor Venta"]) ? r.detalles["Valor Venta"] : "-";

        return `
          <tr>
            <td><strong>${r.id_registro}</strong></td>
            <td>${r.fecha_registro}</td>
            <td>${r.cliente}</td>
            <td>${pedido}</td>
            <td>${oc}</td>
            <td>${valor}</td>
            <td>${r.usuario_solicitante}</td>
            <td><span class="badge" style="${badgeColor}">${r.estado}</span></td>
            <td style="text-align:center;">
              <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Detalle" style="background:none; border:none; font-size:18px; cursor:pointer;">👁️</button>
            </td>
            <td style="text-align:center;" class="col-accion-aprobador">${checkboxHtml}</td>
          </tr>
        `;
      }).join("");
    }
    
    // Volvemos a llamar para asegurar que las columnas nuevas oculten la Acción si es "Solicitante"
    ajustarColumnasAprobador();
  }

  // --- BOTONES DE APROBAR Y RECHAZAR ---
  if (btnAprobarSeleccionados) {
    btnAprobarSeleccionados.addEventListener("click", async () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;
      toggleLoader(true, "Aprobando Pedidos", "Actualizando base de datos...");
      try {
        await window.apiPost("aprobarPedidosAdicionales", idsArray);
        showSuccessModal("Registros aprobados correctamente.");
        await cargarTracker(); 
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { toggleLoader(false); }
    });
  }

  if (btnRechazarSeleccionados) {
    btnRechazarSeleccionados.addEventListener("click", () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;
      if (confirmModal) {
        confirmModal.classList.add("is-open");
        confirmModal.setAttribute("aria-hidden", "false");
      }
    });
  }

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
      if (confirmModal) {
        confirmModal.classList.remove("is-open");
        confirmModal.setAttribute("aria-hidden", "true");
      }
      toggleLoader(true, "Rechazando Pedidos", "Actualizando base de datos...");
      try {
        await window.apiPost("rechazarPedidosAdicionales", idsArray);
        showSuccessModal("Registros rechazados correctamente.");
        await cargarTracker(); 
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { toggleLoader(false); }
    });
  }

  // --- VISUALIZAR DETALLE (MODO LECTURA) ---
  window.verDetalle = (id) => {
    const registro = window.trackerData.find(r => r.id_registro === id);
    if (!registro) return;
    
    const modal = registro.tipo_solicitud === "DESPACHO" ? modalDespacho : modalRecepcion;
    abrirModal(modal);
    
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
      
      pedidosDespachoTemp = [{ detalles: registro.detalles }];
      renderSubTablaDespacho(true); 
    } else {
      const inputs = modal.querySelectorAll("input, select, textarea");
      inputs.forEach(inp => {
        const label = inp.previousElementSibling ? inp.previousElementSibling.textContent.trim() : null;
        if (label && registro.detalles) inp.value = registro.detalles[label] || "";
      });
    }

    modal.querySelectorAll("input, select, textarea").forEach(inp => inp.disabled = true);
    
    // Colores e información de auditoría para Aprobado/Rechazado
    const infoBox = modal.querySelector(".aprobacion-info");
    if (registro.estado === "APROBADO" || registro.estado === "RECHAZADO") {
      if (infoBox) {
        infoBox.style.display = "block";
        const isAprobado = registro.estado === "APROBADO";
        infoBox.style.background = isAprobado ? "#f0fdf4" : "#fef2f2";
        infoBox.style.border = isAprobado ? "1px solid #bbf7d0" : "1px solid #fecaca";
        const textColor = isAprobado ? "#166534" : "#991b1b";
        infoBox.querySelectorAll("p").forEach(p => p.style.color = textColor);
        infoBox.querySelector(".lbl-titulo-fecha").textContent = isAprobado ? "Fecha Aprobación:" : "Fecha Rechazo:";
        infoBox.querySelector(".lbl-titulo-usuario").textContent = isAprobado ? "Aprobado por:" : "Rechazado por:";
        infoBox.querySelector(".lbl-fecha-accion").textContent = registro.fecha_aprobacion || "-";
        infoBox.querySelector(".lbl-usuario-accion").textContent = registro.aprobado_por || "-";
      }
    } else {
      if (infoBox) infoBox.style.display = "none";
    }
    
    modal.querySelector(".btn-primary").style.display = "none";
    if (modal.querySelector(".btn-soft")) modal.querySelector(".btn-soft").style.display = "none";
  };

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
    } catch (error) { console.warn("No se pudieron cargar los clientes:", error); }
  }

  toggleLoader(true, "Iniciando", "Cargando registros...");
  Promise.all([cargarClientes(), cargarTracker()]).then(() => toggleLoader(false));
});