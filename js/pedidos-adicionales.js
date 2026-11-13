document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  const token = typeof window.getToken === "function" ? window.getToken() : null;
  const user = typeof window.getUser === "function" ? window.getUser() : JSON.parse(localStorage.getItem("authUser") || "{}");
  const userRole = (user?.rol || "USUARIO").toUpperCase();
  const puedeAprobar = ["SUPERADMIN", "APROBADOR", "GERENCIA", "ADMIN"].includes(userRole);

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

  const warningModal = document.getElementById("warningModal");
  const warningMessage = document.getElementById("warningMessage");
  const btnCerrarWarning = document.getElementById("btnCerrarWarning");
  let warningModalCallback = null;

  function showWarningModal(message, onAccept = null) {
    warningModalCallback = typeof onAccept === "function" ? onAccept : null;
    if (!warningModal) {
      alert(message);
      if (warningModalCallback) warningModalCallback();
      return;
    }
    if (warningMessage) warningMessage.textContent = message;
    warningModal.classList.add("is-open");
    warningModal.setAttribute("aria-hidden", "false");
  }

  if (btnCerrarWarning) {
    btnCerrarWarning.addEventListener("click", () => {
      warningModal.classList.remove("is-open");
      warningModal.setAttribute("aria-hidden", "true");
      if (warningModalCallback) {
        const cb = warningModalCallback;
        warningModalCallback = null;
        cb();
      }
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

  // --- RESTRICCIÓN DE FECHAS (Mínimo Hoy) ---
  const today = new Date();
  const minDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Bloquear fechas pasadas en Modal Despacho
  const inputFechaDespacho = document.getElementById("despFecha");
  if (inputFechaDespacho) inputFechaDespacho.setAttribute("min", minDateStr);
  
  // Bloquear fechas pasadas en Modal Recepción (busca el primer input de tipo date)
  if (modalRecepcion) {
    const inputFechaRecepcion = modalRecepcion.querySelector('input[type="date"]');
    if (inputFechaRecepcion) inputFechaRecepcion.setAttribute("min", minDateStr);
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
    // Primero mostramos la ventana emergente informativa y al dar clic en Aceptar abrimos el modal de Despacho
    showWarningModal(
      "Las solicitudes de 24H son válidos para aquellos clientes que cumplen con la categorización de K.A., A+, A y sean registrados antes de las 11am.",
      () => {
        pedidosDespachoTemp = [];
        renderSubTablaDespacho(); 
        modalDespacho.querySelector("form").reset();
        const infoBox = modalDespacho.querySelector(".aprobacion-info");
        if (infoBox) infoBox.style.display = "none";
        const secAprob = document.getElementById("seccionDatosAprobador");
        if (secAprob) secAprob.style.display = "none";
        const btnUrg = document.getElementById("btnConfirmarAprobUrgencia");
        if (btnUrg) btnUrg.style.display = "none";
        modalDespacho.querySelectorAll("input, textarea, select").forEach(inp => inp.disabled = false); 
        modalDespacho.querySelector(".btn-primary").style.display = "block"; 
        if (modalDespacho.querySelector(".btn-soft")) modalDespacho.querySelector(".btn-soft").style.display = "block";
        abrirModal(modalDespacho);
      }
    );
  });

  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => cerrarModal(e.target.closest(".modal-backdrop")));
  });

  // --- FUNCIONES AUXILIARES PARA CÁLCULO DE VALOR TOTAL ---
  function parseMonto(val) {
    if (val === null || val === undefined) return 0;
    let s = String(val).replace(/[^\d.,]/g, "").trim();
    if (!s) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
    const num = parseFloat(s);
    return Number.isNaN(num) ? 0 : num;
  }

  function extraerMoneda(val) {
    const str = String(val || "").trim();
    if (str.startsWith("$")) return "$";
    if (str.startsWith("S/")) return "S/";
    return "$";
  }

  function formatearMonto(num) {
    const n = Number(num) || 0;
    if (Number.isInteger(n)) {
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    const partes = n.toFixed(2).split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return partes[1] === "00" ? partes[0] : `${partes[0]},${partes[1]}`;
  }

  function obtenerInfoValorRegistro(r) {
    if (!r || !r.detalles) return { texto: "-", numero: 0, moneda: "$" };
    const items = Array.isArray(r.detalles.items) ? r.detalles.items : [];
    if (items.length > 1) {
      const moneda = extraerMoneda(items[0]["Valor Venta"] || r.detalles["Valor Venta"]);
      const suma = items.reduce((acc, it) => acc + parseMonto(it["Valor Venta"]), 0);
      return {
        texto: suma > 0 ? `${moneda} ${formatearMonto(suma)}` : (r.detalles["Valor Total"] || r.detalles["Valor Venta"] || "-"),
        numero: suma,
        moneda
      };
    }
    const rawValor = r.detalles["Valor Total"] || r.detalles["Valor Venta"] || "-";
    return {
      texto: rawValor,
      numero: parseMonto(rawValor),
      moneda: extraerMoneda(rawValor)
    };
  }

  // --- LÓGICA DESPACHO (AÑADIR) ---
  const btnAñadirPedido = modalDespacho?.querySelector(".btn-soft");
  const tbodyDespacho = modalDespacho?.querySelector("tbody");
  const inputCliente = document.getElementById("despCliente");
  const inputTipo = document.getElementById("despTipo");

  if (btnAñadirPedido) {
    btnAñadirPedido.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const tipo = document.getElementById("despTipo").value;
      const cliente = document.getElementById("despCliente").value;
      const pedido = document.getElementById("despPedido").value.trim();
      const oc = document.getElementById("despOC").value.trim();
      const moneda = document.getElementById("despMoneda").value;
      const valor = document.getElementById("despValor").value;
      const fecha = document.getElementById("despFecha").value;
      const m3Raw = document.getElementById("despM3") ? document.getElementById("despM3").value.trim() : "";
      const comentarios = document.getElementById("despComentarios").value.trim();

      if (!tipo || tipo === "") return showToast("Seleccione un tipo de despacho.", "warning");
      if (!cliente || cliente === "Buscar Clientes") return showToast("Seleccione un cliente válido.", "warning");
      
      // Validación estricta de 6 caracteres numéricos
      const esNumero6Digitos = /^\d{6}$/.test(pedido);
      if (!esNumero6Digitos) {
        return showToast("El campo Pedido debe contener exactamente 6 números.", "warning");
      }

      // Validación de M3 como número entero positivo
      if (!m3Raw || !/^\d+$/.test(m3Raw) || parseInt(m3Raw, 10) <= 0) {
        return showToast("Ingrese un valor entero mayor a 0 en el campo M3.", "warning");
      }
      const m3Numero = parseInt(m3Raw, 10);

      if (comentarios.length > 150) {
        return showToast("El comentario no puede superar los 150 caracteres.", "warning");
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
          "M3": m3Numero,
          "Comentarios": comentarios
        }
      });

      if (inputCliente) inputCliente.disabled = true;
      if (inputTipo) inputTipo.disabled = true;
      renderSubTablaDespacho();
      
      document.getElementById("despPedido").value = "";
      document.getElementById("despOC").value = "";
      document.getElementById("despValor").value = "";
      if (document.getElementById("despM3")) document.getElementById("despM3").value = "";
      
      showToast("Pedido añadido a la bandeja.", "ok");
    });
  }

  function renderSubTablaDespacho(isReadOnly = false) {
    if (!tbodyDespacho) return;
    if (pedidosDespachoTemp.length === 0) {
      tbodyDespacho.innerHTML = `<tr><td colspan="7" class="empty" style="text-align: center; padding: 15px;">No hay pedidos añadidos</td></tr>`;
      return;
    }

    let sumaTotalM3 = 0;

    const filasHtml = pedidosDespachoTemp.map((p, i) => {
      const accionHtml = isReadOnly 
        ? `<td style="width: 10%; text-align:center; color:#64748b; padding: 10px 4px; box-sizing: border-box;">-</td>` 
        : `<td style="width: 10%; color:red; cursor:pointer; text-align:center; font-weight:bold; padding: 10px 4px; box-sizing: border-box;" onclick="eliminarDespachoTemp(${i})">X</td>`;
      
      // Lógica para formatear la fecha de AAAA-MM-DD a DD/MM/AAAA
      let fechaOriginal = p.detalles["Fecha despacho"] || "-";
      let fechaFormateada = fechaOriginal;
      if (fechaOriginal.includes("-")) {
        const partes = fechaOriginal.split("-");
        if (partes.length === 3) {
          fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }

      const m3Val = parseInt(p.detalles["M3"], 10) || 0;
      sumaTotalM3 += m3Val;

      return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="width: 18%; padding: 10px 4px; text-align: left; color: #334155; box-sizing: border-box; word-break: break-all;">${p.detalles["Cliente"] || "-"}</td>
        <td style="width: 13%; padding: 10px 4px; text-align: left; color: #334155; box-sizing: border-box; word-break: break-all;">${p.detalles["Pedido"] || "-"}</td>
        <td style="width: 20%; padding: 10px 4px; text-align: left; color: #334155; box-sizing: border-box; word-break: break-all;">${p.detalles["OC"] || "-"}</td>
        <td style="width: 14%; padding: 10px 4px; text-align: left; color: #334155; box-sizing: border-box; word-break: break-all;">${p.detalles["Valor Venta"] || "-"}</td>
        <td style="width: 15%; padding: 10px 4px; text-align: left; color: #334155; box-sizing: border-box;">${fechaFormateada}</td>
        <td style="width: 10%; padding: 10px 4px; text-align: center; color: #334155; font-weight: bold; box-sizing: border-box;">${m3Val > 0 ? m3Val : "-"}</td>
        ${accionHtml}
      </tr>
    `}).join("");

    // Fila resumen inferior con la suma total de M3
    const filaTotalHtml = `
      <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: bold;">
        <td colspan="5" style="padding: 10px 8px; text-align: right; color: #0f172a;">TOTAL M3:</td>
        <td style="width: 10%; padding: 10px 4px; text-align: center; color: #0f4c81; font-size: 13px;">${sumaTotalM3}</td>
        <td style="width: 10%; padding: 10px 4px;"></td>
      </tr>
    `;

    tbodyDespacho.innerHTML = filasHtml + filaTotalHtml;
  }

  window.eliminarDespachoTemp = (index) => {
    pedidosDespachoTemp.splice(index, 1);
    if (pedidosDespachoTemp.length === 0) {
      if (inputCliente) inputCliente.disabled = false;
      if (inputTipo) inputTipo.disabled = false;
    }
    renderSubTablaDespacho();
  };

  // --- GUARDAR A BASE DE DATOS ---
  async function procesarGuardadoDespacho(registroConsolidado) {
    toggleLoader(true, "Registrando Pedidos", "Guardando solicitud en base de datos...");
    try {
      await window.apiPost("savePedidoAdicional", [registroConsolidado]);
      cerrarModal(modalDespacho);
      showSuccessModal("Pedidos solicitados correctamente.");
      await cargarTracker();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    } finally {
      toggleLoader(false);
    }
  }

  const btnSolicitarDespacho = modalDespacho?.querySelector(".btn-primary");
  if (btnSolicitarDespacho) {
    btnSolicitarDespacho.addEventListener("click", async () => {
      if (pedidosDespachoTemp.length === 0) return showToast("Añada al menos un pedido.", "warning");

      // Validar que para el mismo cliente con "Despacho 24 H" la suma de M3 no supere 2 M3
      const totalM3Despacho24H = pedidosDespachoTemp
        .filter(p => p.detalles["Tipo"] === "Despacho 24 H")
        .reduce((acc, p) => acc + (parseInt(p.detalles["M3"], 10) || 0), 0);

      if (totalM3Despacho24H > 2) {
        return showWarningModal(`Para "Despacho 24 H" el cliente no puede superar los 2 M3 en total (Suma actual: ${totalM3Despacho24H} M3).`);
      }

      const esMultiple = pedidosDespachoTemp.length > 1;
      const primerItem = pedidosDespachoTemp[0];
      const sumaTotalM3 = pedidosDespachoTemp.reduce((acc, p) => acc + (parseInt(p.detalles["M3"], 10) || 0), 0);
      const monedaConsolidada = extraerMoneda(primerItem.detalles["Valor Venta"]);
      const sumaTotalValorNum = pedidosDespachoTemp.reduce((acc, p) => acc + parseMonto(p.detalles["Valor Venta"]), 0);
      const valorFinalTexto = esMultiple
        ? (sumaTotalValorNum > 0 ? `${monedaConsolidada} ${formatearMonto(sumaTotalValorNum)}` : (primerItem.detalles["Valor Venta"] || "-"))
        : (primerItem.detalles["Valor Venta"] || "-");

      const comentarioActual = document.getElementById("despComentarios")?.value.trim() || primerItem.comentario || "";
      const cumpleHorario = new Date().getHours() < 11;

      const itemsGuardados = pedidosDespachoTemp.map(p => ({
        ...p.detalles,
        "Comentarios": comentarioActual || p.detalles["Comentarios"] || ""
      }));

      // Si hay más de 1 fila agregada, consolidamos en una sola línea con "VARIOS" y la suma total de valor
      const registroConsolidado = {
        tipo_solicitud: "DESPACHO",
        cliente: primerItem.cliente,
        comentario: comentarioActual,
        detalles: {
          "Cliente": primerItem.cliente,
          "Pedido": esMultiple ? "VARIOS" : (primerItem.detalles["Pedido"] || "-"),
          "OC": esMultiple ? "VARIOS" : (primerItem.detalles["OC"] || "-"),
          "Valor Venta": valorFinalTexto,
          "Valor Total": valorFinalTexto,
          "Valor Total Numerico": sumaTotalValorNum,
          "Fecha despacho": primerItem.detalles["Fecha despacho"] || "",
          "Tipo": primerItem.detalles["Tipo"] || "-",
          "M3": sumaTotalM3,
          "Volumen Total": sumaTotalM3,
          "Regla": cumpleHorario ? "CUMPLE" : "NO_CUMPLE",
          "Comentarios": comentarioActual,
          "items": itemsGuardados
        }
      };

      // Si el registro se realiza después de las 11:00 am, mostrar ventana informativa y al dar Aceptar proceder
      if (!cumpleHorario) {
        showWarningModal(
          "No se está respetando la regla establecida del mensaje informativo inicial a nivel de horario (antes de las 11am). Al darle Aceptar, el registro procederá.",
          () => {
            procesarGuardadoDespacho(registroConsolidado);
          }
        );
        return;
      }

      await procesarGuardadoDespacho(registroConsolidado);
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

      const comentariosRec = (detalle["Comentarios"] || "").trim();
      if (comentariosRec.length > 150) {
        return showToast("El comentario no puede superar los 150 caracteres.", "warning");
      }

      toggleLoader(true, "Registrando Recepción", "Guardando solicitud en base de datos...");
      try {
        await window.apiPost("savePedidoAdicional", {
          tipo_solicitud: "RECEPCIÓN",
          cliente: "INTERNO",
          comentario: comentariosRec,
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
    
    const tipoFiltro = tabActivo === "RECEPCION" ? "RECEPCIÓN" : "DESPACHO";
    const dataTab = window.trackerData.filter(r => r.tipo_solicitud === tipoFiltro);
    
    const countTotal = dataTab.length;
    const countPendientes = dataTab.filter(r => r.estado === "PENDIENTE" || r.estado === "PENDIENTE GERENCIA").length;
    const countAprobados = dataTab.filter(r => r.estado === "APROBADO").length;
    const countRechazados = dataTab.filter(r => r.estado === "RECHAZADO").length;

    // Actualiza textos
    if (document.getElementById("countTodos")) document.getElementById("countTodos").textContent = countTotal;
    if (document.getElementById("countPendientes")) document.getElementById("countPendientes").textContent = countPendientes;
    if (document.getElementById("countAprobados")) document.getElementById("countAprobados").textContent = countAprobados;
    if (document.getElementById("countRechazadosGlobal")) document.getElementById("countRechazadosGlobal").textContent = countRechazados;

    // Ocultar dinámicamente si están en 0
    const btnTodos = document.querySelector('.btn-estado[data-estado="TODOS"]');
    const btnPendiente = document.querySelector('.btn-estado[data-estado="PENDIENTE"]');
    const btnAprobado = document.querySelector('.btn-estado[data-estado="APROBADO"]');
    const btnRechazado = document.querySelector('.btn-estado[data-estado="RECHAZADO"]');

    if (btnTodos) btnTodos.style.display = countTotal > 0 ? "flex" : "none";
    if (btnPendiente) btnPendiente.style.display = countPendientes > 0 ? "flex" : "none";
    if (btnAprobado) btnAprobado.style.display = countAprobados > 0 ? "flex" : "none";
    if (btnRechazado) btnRechazado.style.display = countRechazados > 0 ? "flex" : "none";
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

  function parseFechaCronologica(fechaStr) {
    const raw = String(fechaStr || "").trim();
    if (!raw) return 0;
    // Soporta formato DD/MM/AAAA HH:mm:ss
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const [, d, m, y, h = "0", mi = "0", s = "0"] = match;
      return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
    }
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  async function cargarTracker() {
    if (!tablaTrackerRecepcion || !tablaTrackerDespacho) return;
    idsSeleccionados.clear();
    actualizarBotonesAcciones();

    try {
      const res = await window.apiPost("listPedidosAdicionales", { token });
      const rows = res.rows || [];
      // Ordenar cronológicamente desde la fecha más reciente hasta la más antigua
      rows.sort((a, b) => parseFechaCronologica(b.fecha_registro) - parseFechaCronologica(a.fecha_registro));
      window.trackerData = rows;
      actualizarContadores();
      renderizarTablas();
      ajustarColumnasAprobador();
    } catch (error) {
      if (tablaTrackerRecepcion) tablaTrackerRecepcion.innerHTML = `<tr><td colspan="8" class="empty">Error al cargar datos.</td></tr>`;
      if (tablaTrackerDespacho) tablaTrackerDespacho.innerHTML = `<tr><td colspan="13" class="empty">Error al cargar datos.</td></tr>`;
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
      if (estadoFiltroActivo === "PENDIENTE") {
        dataFiltrada = dataFiltrada.filter(r => r.estado === "PENDIENTE" || r.estado === "PENDIENTE GERENCIA");
      } else {
        dataFiltrada = dataFiltrada.filter(r => r.estado === estadoFiltroActivo);
      }
    }

    // Filtro por Fecha
    const fechaVal = filtroFechaGlobal?.value;
    if (fechaVal) {
      const partes = fechaVal.split("-");
      const fechaFormatDDMMYYYY = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fechaVal;
      dataFiltrada = dataFiltrada.filter(r => r.fecha_registro && (r.fecha_registro.startsWith(fechaFormatDDMMYYYY) || r.fecha_registro.includes(fechaVal)));
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
      tablaTrackerDespacho.innerHTML = `<tr><td colspan="13" class="empty" style="text-align: center;">No hay despachos.</td></tr>`;
    } else {
      tablaTrackerDespacho.innerHTML = despachos.map(r => {
        let badgeColor = "background:#fecaca; color:#991b1b;";
        if (r.estado === "PENDIENTE") badgeColor = "background:#fef08a; color:#854d0e;";
        else if (r.estado === "PENDIENTE GERENCIA") badgeColor = "background:#fed7aa; color:#9a3412;";
        else if (r.estado === "APROBADO") badgeColor = "background:#bbf7d0; color:#166534;";
        
        const esSeleccionable = r.estado === "PENDIENTE" || (r.estado === "PENDIENTE GERENCIA" && ["GERENCIA", "SUPERADMIN"].includes(userRole));
        let checkboxHtml = esSeleccionable
          ? `<input type="checkbox" onchange="toggleCheckbox('${r.id_registro}', this.checked)" style="width:18px; height:18px; cursor:pointer;">`
          : `-`;
        
        const pedido = (r.detalles && r.detalles["Pedido"]) ? r.detalles["Pedido"] : "-";
        const oc = (r.detalles && r.detalles["OC"]) ? r.detalles["OC"] : "-";
        const volumenTotal = (r.detalles && (r.detalles["Volumen Total"] !== undefined || r.detalles["M3"] !== undefined))
          ? (r.detalles["Volumen Total"] ?? r.detalles["M3"])
          : "-";
        const tipoDespacho = (r.detalles && r.detalles["Tipo"]) ? r.detalles["Tipo"] : "-";
        const infoValor = obtenerInfoValorRegistro(r);

        // Evaluar si el registro fue antes de las 11:00 AM (Check verde) o después de las 11:00 AM (Equis roja)
        let cumpleRegla = true;
        if (r.detalles && r.detalles["Regla"]) {
          cumpleRegla = r.detalles["Regla"] === "CUMPLE";
        } else if (r.fecha_registro) {
          const matchHora = String(r.fecha_registro).match(/\s+(\d{1,2}):(\d{2})/);
          if (matchHora) {
            cumpleRegla = parseInt(matchHora[1], 10) < 11;
          }
        }
        const reglaHtml = cumpleRegla
          ? `<span title="Registrado antes de las 11:00 AM" style="font-size: 16px;">✅</span>`
          : `<span title="Registrado después de las 11:00 AM" style="font-size: 16px;">❌</span>`;

        return `
          <tr>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;"><strong>${r.id_registro}</strong></td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${r.fecha_registro}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${r.cliente}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${pedido}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${oc}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px; font-weight: bold;">${volumenTotal}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${tipoDespacho}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${reglaHtml}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px; font-weight: bold;">${infoValor.texto}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">${r.usuario_solicitante}</td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;"><span class="badge" style="${badgeColor}">${r.estado}</span></td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;">
              <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Detalle" style="background:none; border:none; font-size:18px; cursor:pointer;">👁️</button>
            </td>
            <td style="white-space: nowrap; text-align: center; vertical-align: middle; padding: 10px 8px;" class="col-accion-aprobador">${checkboxHtml}</td>
          </tr>
        `;
      }).join("");
    }
    
    // Volvemos a llamar para asegurar que las columnas nuevas oculten la Acción si es "Solicitante"
    ajustarColumnasAprobador();
  }

  // --- LÓGICA DE CALCULADORA Y APROBACIÓN DE URGENCIA ---
  let registroUrgenciaActual = null;
  const aprobMonedaFlete = document.getElementById("aprobMonedaFlete");
  const aprobCostoFlete = document.getElementById("aprobCostoFlete");
  const aprobPorcentajeFlete = document.getElementById("aprobPorcentajeFlete");
  const contenedorFleteRojo = document.getElementById("contenedorFleteRojo");
  const aprobModoRojo = document.getElementById("aprobModoRojo");
  const aprobComentarioUrgencia = document.getElementById("aprobComentarioUrgencia");
  const btnConfirmarAprobUrgencia = document.getElementById("btnConfirmarAprobUrgencia");

  function actualizarCalculoFleteUrgencia(esSoloLectura = false) {
    if (!registroUrgenciaActual || !aprobPorcentajeFlete) return { pct: 0, esRojo: false };
    const infoValor = obtenerInfoValorRegistro(registroUrgenciaActual);
    const valorTotalNum = infoValor.numero;
    const costoFleteNum = parseMonto(aprobCostoFlete?.value);

    if (costoFleteNum <= 0 || valorTotalNum <= 0) {
      aprobPorcentajeFlete.value = "0.00%";
      aprobPorcentajeFlete.style.background = "#f1f5f9";
      aprobPorcentajeFlete.style.color = "#475569";
      aprobPorcentajeFlete.style.borderColor = "#cbd5e1";
      if (!esSoloLectura && contenedorFleteRojo) contenedorFleteRojo.style.display = "none";
      return { pct: 0, esRojo: false };
    }

    // Cálculo en porcentaje para el indicador "Costo /valor venta <2%"
    const pct = (costoFleteNum / valorTotalNum) * 100;
    const esRojo = pct >= 2;
    aprobPorcentajeFlete.value = `${pct.toFixed(2)}%`;

    if (esRojo) {
      // Pintar en ROJO si es mayor o igual al 2%
      aprobPorcentajeFlete.style.background = "#fee2e2";
      aprobPorcentajeFlete.style.color = "#991b1b";
      aprobPorcentajeFlete.style.borderColor = "#ef4444";
      if (contenedorFleteRojo) contenedorFleteRojo.style.display = "block";
    } else {
      // Pintar en VERDE si es menor al 2%
      aprobPorcentajeFlete.style.background = "#dcfce7";
      aprobPorcentajeFlete.style.color = "#166534";
      aprobPorcentajeFlete.style.borderColor = "#22c55e";
      if (!esSoloLectura && contenedorFleteRojo) contenedorFleteRojo.style.display = "none";
    }

    return { pct, esRojo };
  }

  if (aprobCostoFlete) {
    aprobCostoFlete.addEventListener("input", () => actualizarCalculoFleteUrgencia(false));
  }

  if (btnConfirmarAprobUrgencia) {
    btnConfirmarAprobUrgencia.addEventListener("click", async () => {
      if (!registroUrgenciaActual) return;

      // Caso 1: Segunda aprobación final por parte de GERENCIA
      if (registroUrgenciaActual.estado === "PENDIENTE GERENCIA") {
        toggleLoader(true, "Aprobando Solicitud", "Registrando 2da aprobación de Gerencia...");
        try {
          const res = await window.apiPost("aprobarUrgenciaDespacho", {
            id_registro: registroUrgenciaActual.id_registro,
            modo: "APROBACION_FINAL_GERENCIA"
          });
          if (!res.ok) throw new Error(res.message);
          cerrarModal(modalDespacho);
          showSuccessModal("Solicitud aprobada exitosamente por Gerencia.");
          await cargarTracker();
        } catch (err) {
          showToast("Error: " + err.message, "error");
        } finally {
          toggleLoader(false);
        }
        return;
      }

      // Caso 2: Primera evaluación por el Aprobador
      const costoVal = parseMonto(aprobCostoFlete?.value);
      if (!costoVal || costoVal <= 0) {
        return showWarningModal("Debe ingresar un monto mayor a 0 en el campo COSTO FLETE.");
      }

      const { pct, esRojo } = actualizarCalculoFleteUrgencia(false);
      const monedaFlete = aprobMonedaFlete?.value || "S/";
      const costoFleteTexto = `${monedaFlete} ${formatearMonto(costoVal)}`;
      const porcentajeTexto = `${pct.toFixed(2)}%`;

      let modoEnvio = "DIRECTO_VERDE";
      let comentarioUrg = "";

      if (esRojo) {
        modoEnvio = aprobModoRojo?.value || "PENDIENTE_GERENCIA";
        comentarioUrg = aprobComentarioUrgencia?.value.trim() || "";
        if (comentarioUrg.length < 5) {
          return showWarningModal("Para costos mayores o iguales al 2% (en rojo), es obligatorio ingresar un comentario de sustento (mínimo 5 caracteres).");
        }
      }

      toggleLoader(true, "Procesando Aprobación", "Actualizando registro y enviando notificaciones...");
      try {
        const res = await window.apiPost("aprobarUrgenciaDespacho", {
          id_registro: registroUrgenciaActual.id_registro,
          modo: modoEnvio,
          costo_flete: costoFleteTexto,
          porcentaje_flete: porcentajeTexto,
          comentario_urgencia: comentarioUrg
        });
        if (!res.ok) throw new Error(res.message);
        cerrarModal(modalDespacho);
        if (modoEnvio === "PENDIENTE_GERENCIA") {
          showSuccessModal("Solicitud derivada a Gerencia para 2da aprobación.");
        } else {
          showSuccessModal("Solicitud de urgencia aprobada correctamente.");
        }
        await cargarTracker();
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- BOTONES DE APROBAR Y RECHAZAR ---
  if (btnAprobarSeleccionados) {
    btnAprobarSeleccionados.addEventListener("click", async () => {
      const idsArray = Array.from(idsSeleccionados);
      if (idsArray.length === 0) return;

      const registrosSeleccionados = idsArray
        .map(id => window.trackerData.find(r => r.id_registro === id))
        .filter(Boolean);

      // Si hay algún despacho de tipo "Urgencia" o en estado "PENDIENTE GERENCIA", abrir la interfaz de detalle ("Ojo") con DATOS APROBADOR
      const urgenciaSeleccionada = registrosSeleccionados.find(
        r => r.tipo_solicitud === "DESPACHO" && (r.detalles?.["Tipo"] === "Urgencia" || r.estado === "PENDIENTE GERENCIA")
      );

      if (urgenciaSeleccionada) {
        if (idsArray.length > 1) {
          return showWarningModal("Los despachos de tipo 'Urgencia' requieren evaluación de Costo Flete individual. Seleccione solo un registro de Urgencia para aprobar.");
        }
        window.verDetalle(urgenciaSeleccionada.id_registro, true);
        return;
      }

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
        const txtComentario = document.getElementById("txtComentarioRechazo");
        if (txtComentario) txtComentario.value = ""; // Limpiar campo al abrir
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

      const txtComentario = document.getElementById("txtComentarioRechazo");
      const comentario = txtComentario ? txtComentario.value.trim() : "";
      
      // Validación estricta
      if (comentario.length < 5 || comentario.length > 100) {
        return showToast("El comentario de cancelación debe tener entre 5 y 100 caracteres.", "warning");
      }

      if (confirmModal) {
        confirmModal.classList.remove("is-open");
        confirmModal.setAttribute("aria-hidden", "true");
      }
      toggleLoader(true, "Rechazando Pedidos", "Actualizando base de datos...");
      try {
        await window.apiPost("rechazarPedidosAdicionales", { ids: idsArray, comentario: comentario });
        showSuccessModal("Registros rechazados correctamente.");
        await cargarTracker(); 
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { toggleLoader(false); }
    });
  }

  // --- VISUALIZAR DETALLE (MODO LECTURA O MODO APROBACIÓN URGENCIA) ---
  window.verDetalle = (id, modoAprobacion = false) => {
    const registro = window.trackerData.find(r => r.id_registro === id);
    if (!registro) return;
    
    const modal = registro.tipo_solicitud === "DESPACHO" ? modalDespacho : modalRecepcion;
    abrirModal(modal);
    
    if (registro.tipo_solicitud === "DESPACHO") {
      registroUrgenciaActual = registro;
      const infoValor = obtenerInfoValorRegistro(registro);

      document.getElementById("despTipo").value = registro.detalles["Tipo"] || "";
      document.getElementById("despCliente").value = registro.detalles["Cliente"] || registro.cliente || "";
      document.getElementById("despPedido").value = registro.detalles["Pedido"] || "";
      document.getElementById("despOC").value = registro.detalles["OC"] || "";

      let valorCompleto = infoValor.texto !== "-" ? infoValor.texto : (registro.detalles["Valor Venta"] || "");
      if (valorCompleto.includes(" ")) {
        let partes = valorCompleto.split(" ");
        document.getElementById("despMoneda").value = partes[0];
        document.getElementById("despValor").value = partes[1];
      } else {
        document.getElementById("despValor").value = valorCompleto;
      }

      document.getElementById("despFecha").value = registro.detalles["Fecha despacho"] || "";
      if (document.getElementById("despM3")) {
        document.getElementById("despM3").value = registro.detalles["Volumen Total"] ?? registro.detalles["M3"] ?? "";
      }
      document.getElementById("despComentarios").value = registro.detalles["Comentarios"] || registro.comentario_general || "";
      
      // Si el registro tiene múltiples ítems ("VARIOS") o uno solo guardado en items, los mostramos todos tal como en el registro
      if (Array.isArray(registro.detalles?.items) && registro.detalles.items.length > 0) {
        pedidosDespachoTemp = registro.detalles.items.map(item => ({ detalles: item }));
      } else {
        pedidosDespachoTemp = [{ detalles: registro.detalles }];
      }
      renderSubTablaDespacho(true);
    } else {
      const inputs = modal.querySelectorAll("input, select, textarea");
      inputs.forEach(inp => {
        const label = inp.previousElementSibling ? inp.previousElementSibling.textContent.trim() : null;
        if (label && registro.detalles) inp.value = registro.detalles[label] || "";
      });
    }

    modal.querySelectorAll("input, select, textarea").forEach(inp => inp.disabled = true);

    // Configurar apartado DATOS APROBADOR si es Despacho de Urgencia
    const secAprob = document.getElementById("seccionDatosAprobador");
    const wrapModoRojo = document.getElementById("wrapModoAprobacionRojo");
    if (btnConfirmarAprobUrgencia) btnConfirmarAprobUrgencia.style.display = "none";

    if (registro.tipo_solicitud === "DESPACHO" && secAprob) {
      const esUrgencia = registro.detalles?.["Tipo"] === "Urgencia";
      const tieneCostoGuardado = Boolean(registro.detalles?.["Costo Flete"]);
      const puedeEvaluarUrgencia = puedeAprobar && esUrgencia && (registro.estado === "PENDIENTE" || (registro.estado === "PENDIENTE GERENCIA" && ["GERENCIA", "SUPERADMIN"].includes(userRole)));

      if (esUrgencia && (modoAprobacion || puedeEvaluarUrgencia || tieneCostoGuardado)) {
        secAprob.style.display = "block";

        // Cargar valores previos si ya fueron registrados por Aprobador 1
        if (tieneCostoGuardado) {
          const partesFlete = String(registro.detalles["Costo Flete"]).split(" ");
          if (partesFlete.length === 2) {
            if (aprobMonedaFlete) aprobMonedaFlete.value = partesFlete[0];
            if (aprobCostoFlete) aprobCostoFlete.value = partesFlete[1];
          }
          if (aprobComentarioUrgencia) {
            aprobComentarioUrgencia.value = registro.detalles["Comentario Urgencia"] || "";
          }
          actualizarCalculoFleteUrgencia(true);
        } else {
          if (aprobMonedaFlete) aprobMonedaFlete.value = obtenerInfoValorRegistro(registro).moneda;
          if (aprobCostoFlete) aprobCostoFlete.value = "";
          if (aprobPorcentajeFlete) {
            aprobPorcentajeFlete.value = "0.00%";
            aprobPorcentajeFlete.style.background = "#f1f5f9";
            aprobPorcentajeFlete.style.color = "#475569";
            aprobPorcentajeFlete.style.borderColor = "#cbd5e1";
          }
          if (contenedorFleteRojo) contenedorFleteRojo.style.display = "none";
          if (aprobComentarioUrgencia) aprobComentarioUrgencia.value = "";
        }

        // Habilitar edición para Aprobador 1 cuando está PENDIENTE
        if (puedeAprobar && registro.estado === "PENDIENTE") {
          if (aprobMonedaFlete) aprobMonedaFlete.disabled = false;
          if (aprobCostoFlete) aprobCostoFlete.disabled = false;
          if (aprobModoRojo) aprobModoRojo.disabled = false;
          if (aprobComentarioUrgencia) aprobComentarioUrgencia.disabled = false;
          if (wrapModoRojo) wrapModoRojo.style.display = "block";
          if (btnConfirmarAprobUrgencia) {
            btnConfirmarAprobUrgencia.textContent = "Aceptar";
            btnConfirmarAprobUrgencia.style.display = "inline-block";
          }
        } else if (["GERENCIA", "SUPERADMIN"].includes(userRole) && registro.estado === "PENDIENTE GERENCIA") {
          // Modo 2da Aprobación por Gerencia
          if (wrapModoRojo) wrapModoRojo.style.display = "none";
          if (btnConfirmarAprobUrgencia) {
            btnConfirmarAprobUrgencia.textContent = "Aceptar (Aprobar Gerencia)";
            btnConfirmarAprobUrgencia.style.display = "inline-block";
          }
        }
      } else {
        secAprob.style.display = "none";
      }
    }
    
    // Colores e información de auditoría para Aprobado/Rechazado/Pendiente Gerencia
    const infoBox = modal.querySelector(".aprobacion-info");
    if (registro.estado === "APROBADO" || registro.estado === "RECHAZADO" || registro.estado === "PENDIENTE GERENCIA") {
      if (infoBox) {
        infoBox.style.display = "block";
        const isAprobado = registro.estado === "APROBADO";
        const isPendGerencia = registro.estado === "PENDIENTE GERENCIA";
        infoBox.style.background = isAprobado ? "#f0fdf4" : (isPendGerencia ? "#fff7ed" : "#fef2f2");
        infoBox.style.border = isAprobado ? "1px solid #bbf7d0" : (isPendGerencia ? "1px solid #fed7aa" : "1px solid #fecaca");
        const textColor = isAprobado ? "#166534" : (isPendGerencia ? "#9a3412" : "#991b1b");
        infoBox.querySelectorAll("p").forEach(p => p.style.color = textColor);
        
        infoBox.querySelector(".lbl-titulo-fecha").textContent = isAprobado ? "Fecha Aprobación:" : (isPendGerencia ? "Fecha Evaluación 1:" : "Fecha Rechazo:");
        infoBox.querySelector(".lbl-titulo-usuario").textContent = isAprobado ? "Aprobado por:" : (isPendGerencia ? "Evaluado por:" : "Rechazado por:");
        infoBox.querySelector(".lbl-fecha-accion").textContent = registro.fecha_aprobacion || "-";
        infoBox.querySelector(".lbl-usuario-accion").textContent = registro.aprobado_por || "-";

        // Mostrar comentario si fue rechazado o si tiene sustento de urgencia
        const filaMotivo = infoBox.querySelector(".fila-comentario-rechazo");
        if (!isAprobado && filaMotivo && (registro.comentario_rechazo || registro.detalles?.["Comentario Urgencia"])) {
          filaMotivo.style.display = "block";
          infoBox.querySelector(".lbl-comentario-accion").textContent = registro.comentario_rechazo || registro.detalles?.["Comentario Urgencia"] || "Sin comentario";
        } else if (filaMotivo) {
          filaMotivo.style.display = "none";
        }
      }
    } else {
      if (infoBox) infoBox.style.display = "none";
    }
    
    modal.querySelector(".btn-primary").style.display = "none";
    if (modal.querySelector(".btn-soft")) modal.querySelector(".btn-soft").style.display = "none";
  };

  async function cargarClientes() {
    const listaClientes = [
      "3MWF DISTRIBUCIONES S.A.C",
      "5M DISTRIBUCIONES S.R.L.",
      "AD ARQ & FILMS SAC",
      "AGP PERU S.A.C.",
      "ALOCEN REPRESENTACIONES S.A.C.",
      "ALPAYANA S.A. SOBREANDES",
      "AUTO DISTRIBUCION S.A.C.",
      "BELOW TRADE S.A.C.",
      "CARP & ASOCIADOS S.R.L.",
      "CASA/LOGISTICA ANTEZANA SAC",
      "CASIMIRES NABILA S.A.C.",
      "CHEMTRADE S.A.C.",
      "CODELPA PERU S.A.C.",
      "COMERCIALIZADORA MERCASA SAC",
      "COMISIONISTAS LINCE S.A.C",
      "COMPA#IA MINERA ANTAMINA S.A.",
      "COMPA#IA MINERA CHUNGAR SAC",
      "CONSTRUCCION Y ADMINISTRACION",
      "COROIMPORT S.A.C.",
      "CORPORACION ACEROS AREQUIPA S.",
      "CORPORACION AMBIENTAL ALANCO",
      "CORPORACION PRIMAX S.A.",
      "CORPORACION VEGA S.A.C.",
      "COSALCO PERU S.A.C.",
      "CPPQ S.A.",
      "CSE DEL PERU S.A.C.",
      "DARYZA S.A.C.",
      "DE RAMPER S.A.C.",
      "DELIVERY HERO DMART PERU S.A.C",
      "DIMERC PERU S.A.C.",
      "DINET S.A.",
      "DISLAC S.R.L.",
      "DISTRIBUCIONES PRIMOS S.A.C.",
      "DISTRIBUID. COMERCIAL ALVAREZ",
      "DISTRIBUIDORA JIMENEZ E IRIART",
      "DROGUERIA SAN MARTIN S.A.C.",
      "EMUSA PERU S.A.C.",
      "ENEL DISTRIBUCION PERU S.A.A.",
      "EXANCO S.A.C.",
      "EXPLOSIVOS DEL SUR S.A.",
      "EXSA S.A.",
      "FAMESA EXPLOSIVOS S.A.C.",
      "FARMIVENT S.A.C.",
      "FAVO S.A.C.",
      "FERRETERIA Y MATERIALES DE CONSTRUCCIÓN S.R.L. – FEMACO",
      "FRESHMART S.A.C.",
      "G.W.YICHANG & CIA S.A.",
      "GESA CENTRO S.A.C.",
      "HUEMURA SAC",
      "IMPORT.FERRETERA BONIFAZ S.A.C",
      "INGETRAFIC S.R.L.",
      "JIMENEZ NORTE S.A",
      "LAIVE S.A.",
      "LAMICENTER S.A.C.",
      "LANCERO S.A.C.",
      "LLV PERU SAC",
      "LUCKY S.A.C.",
      "M. ELECTRO S.A.",
      "MINERA AURIFERA RETAMAS S.A.",
      "MINERA YANACOCHA S.R.L.",
      "MONDELEZ PERU S.A.",
      "MORAN DISTRIBUCIONES S.A.",
      "NESTLE PERU S.A.",
      "OXIDOS DE PASCO S.A.C.",
      "PERUFARMA S.A.",
      "PERUPLAST S.A.",
      "PLUSPETROL PERU CORPORATION S.A.",
      "PROCTER & GAMBLE PERU S.R.L.",
      "PRODUCTOS ALIMENTOS GOLOSINAS S.A.C.",
      "PRODUCTOS INDUSTRIALES ARTI SA",
      "PROMOTORES ELECTRICOS S A",
      "PROSAC S.A.",
      "QSI PERU S.A.",
      "QUIMIGRAF PERU SAC",
      "RASH PERU S.A.C.",
      "RINTI S.A",
      "ROAD SERVICE PERU S.A.C",
      "RODPAZ S.A.C.",
      "SEKUR PERU S.A.",
      "SIGELEC S.A.C.",
      "SOCIEDAD MINERA CERRO",
      "SOL NACIENTE DEL NORTE DISTRIB",
      "SOLTRAK S.A.",
      "SONEPAR PERU S.A.C.",
      "SR3 S.A.C.",
      "TAI LOY S.A.",
      "TECNOLOGIA DE MATERIALES S.A.",
      "TECNOLOGIA INDUSTRIAL",
      "TECSUR S.A.",
      "TELEFONICA DEL PERU S.A.A.",
      "VELAX S.A.",
      "VENDTECH S.A.C.",
      "ZARPE DEL PERU S.A.C."
    ];

    const inputCliente = document.getElementById("despCliente") || modalDespacho?.querySelector("select");
    if (inputCliente) {
      inputCliente.innerHTML = `<option value="">Seleccione Cliente</option>` + 
        listaClientes.map(c => `<option value="${c}">${c}</option>`).join("");
    }
  }

  toggleLoader(true, "Iniciando", "Cargando registros...");
  Promise.all([cargarClientes(), cargarTracker()]).then(() => toggleLoader(false));
});