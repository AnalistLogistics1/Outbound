document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  const token = typeof window.getToken === "function" ? window.getToken() : null;
  const user = typeof window.getUser === "function" ? window.getUser() : JSON.parse(localStorage.getItem("authUser") || "{}");
  const userRole = (user?.cargo || user?.rol || "USUARIO").toUpperCase();
  const puedeAprobar = userRole === "SUPERADMIN" || userRole === "APROBADOR";

  const btnRecepcionMain = document.getElementById("btnRecepcionMain");
  const btnDespachoMain = document.getElementById("btnDespachoMain");
  const modalRecepcion = document.getElementById("modalRecepcion");
  const modalDespacho = document.getElementById("modalDespacho");
  const tablaTracker = document.getElementById("tablaTracker");

  // Elementos de Carga y Notificación
  const customLoader = document.getElementById("customLoader");
  const loaderTitle = document.getElementById("loaderTitle");
  const loaderDesc = document.getElementById("loaderDesc");
  const toast = document.getElementById("toast");

  let pedidosDespachoTemp = []; 

  // --- FUNCIONES UI (TOAST Y LOADER) ---
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

  // --- CONTROL DE MODALES ---
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
    modalRecepcion.querySelector(".btn-primary").style.display = "block"; // Restaurar botón
    abrirModal(modalRecepcion);
  });
  
  if (btnDespachoMain) btnDespachoMain.addEventListener("click", () => {
    pedidosDespachoTemp = [];
    renderSubTablaDespacho();
    modalDespacho.querySelector("form").reset();
    modalDespacho.querySelector("select").disabled = false; 
    modalDespacho.querySelector(".btn-primary").style.display = "block"; // Restaurar botón
    if (modalDespacho.querySelector(".btn-soft")) modalDespacho.querySelector(".btn-soft").style.display = "block";
    abrirModal(modalDespacho);
  });

  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => cerrarModal(e.target.closest(".modal-backdrop")));
  });

  // --- LÓGICA DESPACHO (ACUMULACIÓN) ---
  const btnAñadirPedido = modalDespacho?.querySelector(".btn-soft");
  const tbodyDespacho = modalDespacho?.querySelector("tbody");
  const inputCliente = modalDespacho?.querySelector("select");

  if (btnAñadirPedido) {
    btnAñadirPedido.addEventListener("click", () => {
      const form = modalDespacho.querySelector("form");
      const inputs = form.querySelectorAll("input, select, textarea");
      const detalle = {};
      inputs.forEach(inp => {
        if(inp.previousElementSibling) detalle[inp.previousElementSibling.textContent.trim()] = inp.value;
      });

      if (!detalle["Cliente"] || detalle["Cliente"] === "Buscar Clientes") {
        return showToast("Seleccione un cliente válido.", "warning");
      }

      pedidosDespachoTemp.push({
        tipo_solicitud: "DESPACHO",
        cliente: detalle["Cliente"],
        comentario: detalle["Comentarios"],
        detalles: detalle
      });

      inputCliente.disabled = true; 
      renderSubTablaDespacho();
      
      // Limpiar campos excepto cliente y comentarios
      inputs.forEach(inp => {
        if(inp.tagName !== "SELECT" && inp.tagName !== "TEXTAREA") inp.value = "";
      });
      showToast("Pedido añadido a la bandeja.", "ok");
    });
  }

  function renderSubTablaDespacho() {
    if (!tbodyDespacho) return;
    if (pedidosDespachoTemp.length === 0) {
      tbodyDespacho.innerHTML = `<tr><td colspan="6" class="empty">No hay pedidos añadidos</td></tr>`;
      return;
    }
    tbodyDespacho.innerHTML = pedidosDespachoTemp.map((p, i) => `
      <tr>
        <td>${p.detalles["Cliente"]}</td>
        <td>${p.detalles["Pedido"] || "-"}</td>
        <td>${p.detalles["OC"] || "-"}</td>
        <td>${p.detalles["Valor Venta"] || "-"}</td>
        <td>${p.detalles["Fecha despacho"] || "-"}</td>
        <td style="color:red; cursor:pointer; text-align:center; font-weight:bold;" onclick="eliminarDespachoTemp(${i})">X</td>
      </tr>
    `).join("");
  }

  window.eliminarDespachoTemp = (index) => {
    pedidosDespachoTemp.splice(index, 1);
    if(pedidosDespachoTemp.length === 0) inputCliente.disabled = false;
    renderSubTablaDespacho();
  };

  // --- ENVÍO A BASE DE DATOS ---
  const btnSolicitarDespacho = modalDespacho?.querySelector(".btn-primary");
  if (btnSolicitarDespacho) {
    btnSolicitarDespacho.addEventListener("click", async () => {
      if (pedidosDespachoTemp.length === 0) return showToast("Añada al menos un pedido.", "warning");
      
      toggleLoader(true, "Registrando Pedidos", "Guardando solicitudes en base de datos...");
      try {
        await window.apiPost("savePedidoAdicional", pedidosDespachoTemp);
        cerrarModal(modalDespacho);
        showToast("Pedidos solicitados correctamente.", "ok");
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
        showToast("Recepción registrada correctamente.", "ok");
        await cargarTracker();
      } catch (error) { 
        showToast("Error: " + error.message, "error"); 
      } finally {
        toggleLoader(false);
      }
    });
  }

  // --- RENDERIZAR TRACKER GLOBAL ---
  async function cargarTracker() {
    if (!tablaTracker) return;
    try {
      const res = await window.apiPost("listPedidosAdicionales", { token });
      if (!res.rows || res.rows.length === 0) {
        tablaTracker.innerHTML = `<tr><td colspan="8" class="empty">No hay solicitudes registradas.</td></tr>`;
        return;
      }

      tablaTracker.innerHTML = res.rows.map(r => {
        let badgeColor = r.estado === "PENDIENTE" ? "background:#fef08a; color:#854d0e;" :
                         r.estado === "APROBADO" ? "background:#bbf7d0; color:#166534;" : 
                         "background:#fecaca; color:#991b1b;";
                         
        let checkboxHtml = (puedeAprobar && r.estado === "PENDIENTE") 
          ? `<input type="checkbox" style="width:18px; height:18px; cursor:pointer;">` 
          : `-`;

        return `
          <tr>
            <td><strong>${r.id_registro}</strong></td>
            <td>${r.tipo_solicitud}</td>
            <td>${r.fecha_registro.split(" ")[0]}</td>
            <td>${r.usuario_solicitante}</td>
            <td><span class="badge" style="${badgeColor}">${r.estado}</span></td>
            <td>${r.comentario_general || ""}</td>
            <td style="text-align:center;">
              <button class="btn-eye" onclick="verDetalle('${r.id_registro}')" title="Ver detalle" style="background:none; border:none; font-size:18px; cursor:pointer;">👁️</button>
            </td>
            <td style="text-align:center;">${checkboxHtml}</td>
          </tr>
        `;
      }).join("");
      
      window.trackerData = res.rows;
    } catch (error) {
      tablaTracker.innerHTML = `<tr><td colspan="8" class="empty">Error al cargar datos.</td></tr>`;
    }
  }

  // Visualizar Detalle en Modal (Modo Lectura)
  window.verDetalle = (id) => {
    const registro = window.trackerData.find(r => r.id_registro === id);
    if (!registro) return;
    
    const modal = registro.tipo_solicitud === "DESPACHO" ? modalDespacho : modalRecepcion;
    abrirModal(modal);
    
    const inputs = modal.querySelectorAll("input, select, textarea");
    inputs.forEach(inp => {
      const label = inp.previousElementSibling ? inp.previousElementSibling.textContent.trim() : null;
      if (label) {
        inp.value = registro.detalles[label] || "";
        inp.disabled = true;
      }
    });
    
    modal.querySelector(".btn-primary").style.display = "none";
    if (modal.querySelector(".btn-soft")) modal.querySelector(".btn-soft").style.display = "none";
  };

  toggleLoader(true, "Iniciando", "Cargando registros...");
  cargarTracker().then(() => toggleLoader(false));
});