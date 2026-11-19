// js/discrepancia-labeling.js
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  // =========================================================================
  // 0. ESTADO GLOBAL Y REFERENCIAS DEL DOM
  // =========================================================================
  let listaPriorizados = [];
  let setMedicosSinRS = new Set();
  let listaMedicosSinRsRows = [];
  let hojaRegistros = [];
  let hojaDB = [];
  let fotosHojaActual = [];
  let pestanaActiva = "Registros";

  // Contexto de captura / edición de flecha roja
  let targetSkuContext = null; // { hojaNombre, itemNro, sku }
  let fotoEditandoContext = null; // { id, hoja_nombre, item_nro, sku, foto_url }
  let flechasDibujadas = []; // [{ x1, y1, x2, y2 }]
  let trazoActual = null;
  let dibujandoFlecha = false;

  const inputExcelOrigen = document.getElementById("inputExcelOrigen");
  const btnGenerarNroReporte = document.getElementById("btnGenerarNroReporte");
  const btnGenerarPlantillas = document.getElementById("btnGenerarPlantillas");
  const btnExportarExcelHoja = document.getElementById("btnExportarExcelHoja");
  const btnExportarPdfHorizontal = document.getElementById("btnExportarPdfHorizontal");
  const btnResetearProceso = document.getElementById("btnResetearProceso");
  const chkMostrarHojasOcultas = document.getElementById("chkMostrarHojasOcultas");
  const estadoProceso = document.getElementById("m3mEstadoProceso");
  const tbodyRegistros = document.getElementById("tbodyRegistros");
  const dynamicTabsContainer = document.getElementById("m3mDynamicTabs");

  const inputCamaraSku = document.getElementById("inputCamaraSku");
  const inputGaleriaSku = document.getElementById("inputGaleriaSku");
  const modalCapturaSku = document.getElementById("modalCapturaSku");
  const modalEditorFlecha = document.getElementById("modalEditorFlecha");
  const canvasEditor = document.getElementById("canvasEditorFlecha");
  const ctxEditor = canvasEditor.getContext("2d");

  // Ventana emergente de estado (Cargando / Completado / Error / Confirmación con Logo)
  const modalEstadoProceso = document.getElementById("modalEstadoProceso");
  const statusCardBox = document.getElementById("statusCardBox");
  const statusSpinner = document.getElementById("statusSpinner");
  const statusCheckIcon = document.getElementById("statusCheckIcon");
  const statusTitulo = document.getElementById("statusTitulo");
  const statusMensaje = document.getElementById("statusMensaje");
  const btnCerrarEstadoProceso = document.getElementById("btnCerrarEstadoProceso");
  const btnCancelarConfirmacion = document.getElementById("btnCancelarConfirmacion");
  const btnConfirmarAccion = document.getElementById("btnConfirmarAccion");
  let resolverConfirmacionActual = null;

  function ocultarBotonesEstado() {
    if (btnCerrarEstadoProceso) btnCerrarEstadoProceso.style.display = "none";
    if (btnCancelarConfirmacion) btnCancelarConfirmacion.style.display = "none";
    if (btnConfirmarAccion) btnConfirmarAccion.style.display = "none";
  }

  function mostrarCargando(
    titulo = "Cargando...",
    mensaje = "Procesando información, por favor espere."
  ) {
    if (!modalEstadoProceso) return;
    resolverConfirmacionActual = null;
    ocultarBotonesEstado();
    statusCardBox.className = "m3m-status-card";
    statusSpinner.style.display = "block";
    statusCheckIcon.style.display = "none";
    statusTitulo.textContent = titulo;
    statusMensaje.textContent = mensaje;
    modalEstadoProceso.style.display = "flex";
  }

  function mostrarCompletado(
    titulo = "Completado",
    mensaje = "El proceso se completó correctamente."
  ) {
    if (!modalEstadoProceso) return;
    resolverConfirmacionActual = null;
    ocultarBotonesEstado();
    statusCardBox.className = "m3m-status-card is-done";
    statusSpinner.style.display = "none";
    statusCheckIcon.style.display = "flex";
    statusCheckIcon.textContent = "✓";
    statusCheckIcon.style.background = "#dcfce7";
    statusCheckIcon.style.color = "#15803d";
    if (btnCerrarEstadoProceso) btnCerrarEstadoProceso.style.display = "inline-block";
    statusTitulo.textContent = titulo;
    statusMensaje.textContent = mensaje;
    modalEstadoProceso.style.display = "flex";
  }

  function mostrarErrorEstado(
    titulo = "Atención",
    mensaje = "Ocurrió un inconveniente durante el proceso."
  ) {
    if (!modalEstadoProceso) return;
    resolverConfirmacionActual = null;
    ocultarBotonesEstado();
    statusCardBox.className = "m3m-status-card is-error";
    statusSpinner.style.display = "none";
    statusCheckIcon.style.display = "flex";
    statusCheckIcon.textContent = "!";
    statusCheckIcon.style.background = "#fee2e2";
    statusCheckIcon.style.color = "#b91c1c";
    if (btnCerrarEstadoProceso) btnCerrarEstadoProceso.style.display = "inline-block";
    statusTitulo.textContent = titulo;
    statusMensaje.textContent = mensaje;
    modalEstadoProceso.style.display = "flex";
  }

  function mostrarConfirmacionConLogo(
    titulo = "Confirmar acción",
    mensaje = "¿Desea continuar?",
    textoConfirmar = "Confirmar"
  ) {
    return new Promise((resolve) => {
      if (!modalEstadoProceso || !btnConfirmarAccion || !btnCancelarConfirmacion) {
        resolve(false);
        return;
      }
      resolverConfirmacionActual = resolve;
      ocultarBotonesEstado();
      statusCardBox.className = "m3m-status-card is-error";
      statusSpinner.style.display = "none";
      statusCheckIcon.style.display = "flex";
      statusCheckIcon.textContent = "?";
      statusCheckIcon.style.background = "#fef3c7";
      statusCheckIcon.style.color = "#b45309";
      statusTitulo.textContent = titulo;
      statusMensaje.textContent = mensaje;
      btnConfirmarAccion.textContent = textoConfirmar;
      btnCancelarConfirmacion.style.display = "inline-block";
      btnConfirmarAccion.style.display = "inline-block";
      modalEstadoProceso.style.display = "flex";
    });
  }

  if (btnCerrarEstadoProceso) {
    btnCerrarEstadoProceso.addEventListener("click", () => {
      modalEstadoProceso.style.display = "none";
    });
  }

  if (btnCancelarConfirmacion) {
    btnCancelarConfirmacion.addEventListener("click", () => {
      modalEstadoProceso.style.display = "none";
      if (resolverConfirmacionActual) {
        const fn = resolverConfirmacionActual;
        resolverConfirmacionActual = null;
        fn(false);
      }
    });
  }

  if (btnConfirmarAccion) {
    btnConfirmarAccion.addEventListener("click", () => {
      modalEstadoProceso.style.display = "none";
      if (resolverConfirmacionActual) {
        const fn = resolverConfirmacionActual;
        resolverConfirmacionActual = null;
        fn(true);
      }
    });
  }

  function fechaHoyDDMMYYYY() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function normalizarFechaExcel(val, separador = "/") {
    const str = String(val || "").trim();
    if (!str || str === "-") return str;
    let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      return `${m[1].padStart(2, "0")}${separador}${m[2].padStart(
        2,
        "0"
      )}${separador}${m[3]}`;
    }
    m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
      return `${m[3].padStart(2, "0")}${separador}${m[2].padStart(
        2,
        "0"
      )}${separador}${m[1]}`;
    }
    return str;
  }

  // =========================================================================
  // 1. NAVEGACIÓN DE PESTAÑAS Y HOJAS BASE
  // =========================================================================
  function actualizarVisibilidadHojasBase() {
    const visible = Boolean(chkMostrarHojasOcultas && chkMostrarHojasOcultas.checked);
    document.querySelectorAll(".m3m-tab-yellow").forEach((tab) => {
      tab.classList.toggle("is-hidden-sheet", !visible);
    });
  }

  if (chkMostrarHojasOcultas) {
    chkMostrarHojasOcultas.addEventListener("change", () => {
      actualizarVisibilidadHojasBase();
      if (chkMostrarHojasOcultas.checked) {
        const barraTabs = document.getElementById("m3mTabsBar");
        if (barraTabs) barraTabs.scrollLeft = 0;
      }
    });
  }

  async function activarPestana(targetName) {
    pestanaActiva = targetName;
    document.querySelectorAll(".m3m-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.target === targetName);
    });
    document.querySelectorAll(".m3m-sheet-pane").forEach((p) => {
      p.classList.remove("active");
    });

    if (targetName === "Registros") {
      document.getElementById("pane-Registros").classList.add("active");
    } else if (targetName === "DB") {
      document.getElementById("pane-DB").classList.add("active");
    } else if (targetName === "MEDICOS SIN RS") {
      document.getElementById("pane-MEDICOS").classList.add("active");
    } else if (targetName === "PRIORIZADOS") {
      document.getElementById("pane-PRIORIZADOS").classList.add("active");
    } else if (targetName === "Plantilla Discrepancia") {
      renderizarVistaPlantilla(null);
      document.getElementById("pane-PlantillaVista").classList.add("active");
    } else {
      await cargarFotosDeHoja(targetName);
      renderizarVistaPlantilla(targetName);
      document.getElementById("pane-PlantillaVista").classList.add("active");
    }
  }

  document.querySelectorAll("#m3mTabsBar > .m3m-tab").forEach((btn) => {
    btn.addEventListener("click", () => activarPestana(btn.dataset.target));
  });

  // =========================================================================
  // 2. CARGA DE MAESTROS DESDE SUPABASE
  // =========================================================================
  async function cargarMaestrosDesdeSupabase() {
    try {
      const res = await window.apiPost("getMaestrosLabeling");
      if (res.ok) {
        listaPriorizados = res.priorizados || [];
        listaMedicosSinRsRows = res.medicosSinRs || [];
        setMedicosSinRS = new Set(
          listaMedicosSinRsRows.map((m) => String(m.sku || "").trim().toUpperCase())
        );
        renderizarHojasMaestras();
      }
    } catch (err) {
      console.warn("Error cargando maestros:", err);
    }
  }

  const getSetPriorizados = () =>
    new Set(listaPriorizados.map((x) => String(x.id_3m || "").trim().toUpperCase()));

  // =========================================================================
  // 3. BOTÓN 1: IMPORTAR DISCREPANCIA (Hoja1 -> Registros + Clasificar)
  // =========================================================================
  inputExcelOrigen.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    inputExcelOrigen.value = "";
    if (!file) return;

    try {
      mostrarCargando("Cargando...", "Leyendo archivo Excel y validando 'Hoja1'.");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: "array",
        cellText: true,
        cellDates: false
      });
      const wsOrigen = wb.Sheets["Hoja1"];
      if (!wsOrigen) {
        return mostrarErrorEstado(
          "Hoja no encontrada",
          "El archivo seleccionado no contiene una hoja llamada 'Hoja1'."
        );
      }

      const matriz = XLSX.utils.sheet_to_json(wsOrigen, {
        header: 1,
        raw: false,
        defval: ""
      });
      if (matriz.length <= 1) {
        return mostrarErrorEstado(
          "Sin registros",
          "No hay registros para copiar en la 'Hoja1'."
        );
      }

      const setPrio = getSetPriorizados();
      const filasMapeadas = [];

      for (let r = 1; r < matriz.length; r++) {
        const row = matriz[r];
        const colA = String(row[0] ?? "").trim();
        if (!colA) continue;

        const loteTextoVisible = String(row[6] ?? "").trim();
        const skuValor = String(row[7] ?? "").trim();
        const clasificacionP = setMedicosSinRS.has(skuValor.toUpperCase())
          ? "MEDICO SIN RS"
          : "NO MEDICO";

        filasMapeadas.push({
          fila_excel: r + 1,
          col_a_nro: colA,
          col_b_area: String(row[1] ?? "").trim(),
          col_c_fecha: normalizarFechaExcel(row[2], "/"),
          col_d_traspaso: String(row[4] ?? "").trim(),
          col_e_embarque: String(row[5] ?? "").trim(),
          col_f_lote: loteTextoVisible,
          col_g_sku: skuValor,
          col_h_descripcion: String(row[8] ?? "").trim(),
          col_i_um: String(row[9] ?? "").trim(),
          col_j_stock: String(row[10] ?? "").trim(),
          col_k_vencimiento: normalizarFechaExcel(row[11], "/"),
          col_l_cod_discrepancia: String(row[13] ?? "").trim(),
          col_m_desc_problema: String(row[14] ?? "").trim(),
          col_p_tipo_medico: clasificacionP,
          col_q_nro_reporte: "",
          es_priorizado: setPrio.has(skuValor.toUpperCase()),
          plantilla_generada: false
        });
      }

      mostrarCargando(
        "Cargando...",
        "Importando registros y clasificando en Columna P."
      );
      const res = await window.apiPost("importarRegistrosLabeling", {
        filas: filasMapeadas
      });
      if (!res.ok) throw new Error(res.message);

      await cargarEstadoDesdeSupabase();
      await activarPestana("Registros");
      mostrarCompletado(
        "Importación Completada",
        `Se importaron ${filasMapeadas.length} filas y se clasificó la Columna P correctamente.`
      );
    } catch (err) {
      mostrarErrorEstado("Error al importar", err.message);
    }
  });

  // =========================================================================
  // 4. BOTÓN 2: GENERAR NRO REPORTE
  // =========================================================================
  btnGenerarNroReporte.addEventListener("click", async () => {
    if (hojaRegistros.length === 0) {
      return mostrarErrorEstado(
        "Sin datos",
        "No hay datos en la hoja 'Registros'. Primero importe un archivo Excel."
      );
    }

    for (const reg of hojaRegistros) {
      if (String(reg.col_e_embarque || "").trim() !== "") {
        const tipoP = String(reg.col_p_tipo_medico || "").trim().toUpperCase();
        if (tipoP !== "NO MEDICO" && tipoP !== "MEDICO SIN RS") {
          return mostrarErrorEstado(
            "Validación Detenida",
            `Error en la fila ${reg.fila_excel}.\nEl valor en la columna P es: '${tipoP}'.\nSolo se permite 'NO MEDICO' o 'MEDICO SIN RS'.`
          );
        }
      }
    }

    try {
      mostrarCargando(
        "Cargando...",
        "Calculando correlativos y actualizando la base de datos."
      );

      const filasDB_B = hojaDB.filter((d) => d.tipo_columna === "B");
      const filasDB_C = hojaDB.filter((d) => d.tipo_columna === "C");

      let maxNoMedico =
        filasDB_B.length > 0
          ? parseInt(String(filasDB_B[filasDB_B.length - 1].valor_reporte).slice(0, 4), 10) || 0
          : 0;
      let maxMedico =
        filasDB_C.length > 0
          ? parseInt(String(filasDB_C[filasDB_C.length - 1].valor_reporte).slice(0, 4), 10) || 0
          : 0;

      const dictAsignados = new Map();
      const nuevosDB = [];
      const actualizacionesRegistros = [];
      let duplicados = 0;
      let nuevosB = 0;
      let nuevosC = 0;

      for (const reg of hojaRegistros) {
        const claveE = String(reg.col_e_embarque || "").trim();
        if (!claveE) continue;

        const tipoP = String(reg.col_p_tipo_medico || "").trim().toUpperCase();
        const colDestino = tipoP === "NO MEDICO" ? "B" : "C";
        let reporteAsignado = "";

        if (dictAsignados.has(claveE)) {
          reporteAsignado = dictAsignados.get(claveE);
          duplicados++;
        } else {
          const listaBusqueda = colDestino === "B" ? filasDB_B : filasDB_C;
          const sufijoBuscado = (` COSTO ${claveE}`).toUpperCase();
          const encontrado = listaBusqueda.find((item) =>
            String(item.valor_reporte || "").toUpperCase().endsWith(sufijoBuscado)
          );

          if (encontrado) {
            reporteAsignado = encontrado.valor_reporte;
            dictAsignados.set(claveE, reporteAsignado);
            duplicados++;
          } else {
            let nroFormateado = "";
            let corrNum = 0;
            if (colDestino === "B") {
              maxNoMedico++;
              corrNum = maxNoMedico;
              nroFormateado = String(maxNoMedico).padStart(4, "0");
            } else {
              maxMedico++;
              corrNum = maxMedico;
              nroFormateado = String(maxMedico).padStart(4, "0");
            }

            const fechaFormateada = normalizarFechaExcel(reg.col_c_fecha, "-");
            reporteAsignado = `${nroFormateado}_${fechaFormateada} COSTO ${claveE}`;
            dictAsignados.set(claveE, reporteAsignado);

            nuevosDB.push({
              tipo_columna: colDestino,
              correlativo: corrNum,
              valor_reporte: reporteAsignado,
              reemplazado_1111: false
            });

            if (colDestino === "B") nuevosB++;
            else nuevosC++;
          }
        }

        reg.col_q_nro_reporte = reporteAsignado;
        actualizacionesRegistros.push({
          id: reg.id,
          col_p_tipo_medico: tipoP,
          col_q_nro_reporte: reporteAsignado
        });
      }

      const res = await window.apiPost("guardarCorrelativosLabeling", {
        actualizacionesRegistros,
        nuevosDB
      });
      if (!res.ok) throw new Error(res.message);

      await cargarEstadoDesdeSupabase();
      mostrarCompletado(
        "N° Reportes Generados",
        `Nuevos NO MEDICO: ${nuevosB}\nNuevos MEDICO SIN RS: ${nuevosC}\nDuplicados agrupados: ${duplicados}`
      );
    } catch (err) {
      mostrarErrorEstado("Error al generar N° Reporte", err.message);
    }
  });

  // =========================================================================
  // 5. BOTÓN 3: GENERAR PLANTILLAS Y ACTUALIZAR DB A COSTO 1111
  // =========================================================================
  btnGenerarPlantillas.addEventListener("click", async () => {
    if (hojaRegistros.length === 0) {
      return mostrarErrorEstado("Sin datos", "No hay registros cargados.");
    }

    for (const r of hojaRegistros) {
      if (String(r.col_e_embarque || "").trim() !== "") {
        if (
          !String(r.col_p_tipo_medico || "").trim() ||
          !String(r.col_q_nro_reporte || "").trim()
        ) {
          return mostrarErrorEstado(
            "Datos Incompletos",
            `La FILA ${r.fila_excel} no tiene dato en la columna P (Tipo) o en la columna Q (Nro de Reporte).`
          );
        }
      }
    }

    try {
      mostrarCargando(
        "Cargando...",
        "Generando hojas de reporte y actualizando códigos en DB."
      );

      const clavesUnicas = [];
      const prefijosHojas = [];
      hojaRegistros.forEach((r) => {
        const clave = String(r.col_e_embarque || "").trim();
        if (clave && !clavesUnicas.includes(clave)) {
          clavesUnicas.push(clave);
          prefijosHojas.push(
            clave.replace(/\//g, "-").slice(0, 31).trim().slice(0, 4)
          );
        }
      });

      const res = await window.apiPost("confirmarPlantillasYActualizarDB", {
        prefijosHojas
      });
      if (!res.ok) throw new Error(res.message);

      await cargarEstadoDesdeSupabase();
      if (clavesUnicas.length > 0) {
        await activarPestana(clavesUnicas[0].replace(/\//g, "-").slice(0, 31));
      }
      mostrarCompletado(
        "Reporte Generado",
        `Se generaron ${clavesUnicas.length} hojas y se actualizaron ${res.reemplazos} códigos en DB a COSTO 1111.`
      );
    } catch (err) {
      mostrarErrorEstado("Error al generar reporte", err.message);
    }
  });

  // =========================================================================
  // 6. CAPTURA DE FOTO POR SKU (CÁMARA NATIVA iOS/ANDROID + COMPRESIÓN KB)
  // =========================================================================
  function abrirModalCapturaSku(hojaNombre, itemNro, sku) {
    targetSkuContext = { hojaNombre, itemNro, sku };
    document.getElementById(
      "modalCapturaTitulo"
    ).textContent = `ITEM #${itemNro} | SKU ${sku}`;
    modalCapturaSku.style.display = "flex";
  }

  document
    .getElementById("btnCerrarModalCaptura")
    .addEventListener("click", () => {
      modalCapturaSku.style.display = "none";
    });

  document.getElementById("btnAbrirCamaraNativa").addEventListener("click", () => {
    modalCapturaSku.style.display = "none";
    inputCamaraSku.click();
  });

  document.getElementById("btnAbrirGaleriaSku").addEventListener("click", () => {
    modalCapturaSku.style.display = "none";
    inputGaleriaSku.click();
  });

  async function comprimirImagenEnKb(fileOrBlob, maxAncho = 900, calidad = 0.72) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width;
        let h = img.height;
        if (w > maxAncho) {
          h = Math.round((h * maxAncho) / w);
          w = maxAncho;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo comprimir la imagen."));
            resolve({ blob, imgElement: img });
          },
          "image/jpeg",
          calidad
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Formato de imagen no válido."));
      };
      img.src = url;
    });
  }

  async function manejarArchivosSku(fileList) {
    if (!fileList || fileList.length === 0 || !targetSkuContext) return;
    const { hojaNombre, itemNro, sku } = targetSkuContext;

    try {
      mostrarCargando(
        "Cargando...",
        `Comprimiendo y guardando foto del ITEM #${itemNro} (SKU ${sku})...`
      );

      let ultimaFotoGuardada = null;
      for (const file of Array.from(fileList)) {
        const { blob } = await comprimirImagenEnKb(file);
        ultimaFotoGuardada = await subirFotoComprimidaASupabase(
          blob,
          hojaNombre,
          itemNro,
          sku,
          null
        );
      }

      inputCamaraSku.value = "";
      inputGaleriaSku.value = "";
      await cargarFotosDeHoja(hojaNombre);
      renderizarVistaPlantilla(hojaNombre);

      mostrarCompletado(
        "Foto Guardada",
        `Fotografía registrada para el ITEM #${itemNro} (SKU ${sku}).`
      );

      if (fileList.length === 1 && ultimaFotoGuardada) {
        const deseaFlecha = await mostrarConfirmacionConLogo(
          "Flecha Roja",
          "¿Deseas agregar una flecha roja señalando alguna parte de esta foto ahora?",
          "Agregar Flecha"
        );
        if (deseaFlecha) {
          abrirEditorFlecha(ultimaFotoGuardada);
        }
      }
    } catch (err) {
      mostrarErrorEstado("Error al guardar foto", err.message);
    }
  }

  inputCamaraSku.addEventListener("change", (e) =>
    manejarArchivosSku(e.target.files)
  );
  inputGaleriaSku.addEventListener("change", (e) =>
    manejarArchivosSku(e.target.files)
  );

  async function subirFotoComprimidaASupabase(
    blob,
    hojaNombre,
    itemNro,
    sku,
    existingId
  ) {
    const db = window.getSupabaseClient();
    const hojaSlug = hojaNombre.replace(/[^a-zA-Z0-9_-]/g, "_");
    const skuSlug = String(sku).replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${hojaSlug}_ITEM${itemNro}_${skuSlug}_${Date.now()}.jpg`;

    const { error: upErr } = await db.storage
      .from("fotos-labeling-hojas")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

    if (upErr) throw new Error("Error subiendo foto: " + upErr.message);

    const { data: pubData } = db.storage
      .from("fotos-labeling-hojas")
      .getPublicUrl(fileName);

    const res = await window.apiPost("saveLabelingFoto", {
      id: existingId,
      hoja_nombre: hojaNombre,
      item_nro: itemNro,
      sku,
      foto_path: fileName,
      foto_url: pubData.publicUrl
    });

    if (!res.ok) throw new Error(res.message);
    return (
      res.foto || {
        id: existingId,
        hoja_nombre: hojaNombre,
        item_nro: itemNro,
        sku,
        foto_path: fileName,
        foto_url: pubData.publicUrl
      }
    );
  }

  // =========================================================================
  // 7. EDITOR DE FLECHA ROJA (DURANTE LA FOTO O POSTERIOR)
  // =========================================================================
  function abrirEditorFlecha(fotoObj) {
    fotoEditandoContext = fotoObj;
    flechasDibujadas = [];
    trazoActual = null;
    document.getElementById(
      "modalFlechaTitulo"
    ).textContent = `Flecha Roja — ITEM #${fotoObj.item_nro} | SKU ${fotoObj.sku}`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = 600;
      const escala = img.width > maxW ? maxW / img.width : 1;
      canvasEditor.width = Math.round(img.width * escala);
      canvasEditor.height = Math.round(img.height * escala);
      canvasEditor._imgBase = img;
      redibujarCanvasFlechas();
      modalEditorFlecha.style.display = "flex";
    };
    img.src = fotoObj.foto_url;
  }

  function dibujarFlechaRoja(ctx, x1, y1, x2, y2) {
    const headLen = Math.max(14, Math.hypot(x2 - x1, y2 - y1) * 0.22);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.fillStyle = "#dc2626";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function redibujarCanvasFlechas() {
    if (!canvasEditor._imgBase) return;
    ctxEditor.clearRect(0, 0, canvasEditor.width, canvasEditor.height);
    ctxEditor.drawImage(
      canvasEditor._imgBase,
      0,
      0,
      canvasEditor.width,
      canvasEditor.height
    );

    flechasDibujadas.forEach((f) =>
      dibujarFlechaRoja(ctxEditor, f.x1, f.y1, f.x2, f.y2)
    );
    if (trazoActual) {
      dibujarFlechaRoja(
        ctxEditor,
        trazoActual.x1,
        trazoActual.y1,
        trazoActual.x2,
        trazoActual.y2
      );
    }
  }

  function obtenerCoordsCanvas(e) {
    const rect = canvasEditor.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvasEditor.width,
      y: ((clientY - rect.top) / rect.height) * canvasEditor.height
    };
  }

  canvasEditor.addEventListener("pointerdown", (e) => {
    dibujandoFlecha = true;
    const pt = obtenerCoordsCanvas(e);
    trazoActual = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
  });

  canvasEditor.addEventListener("pointermove", (e) => {
    if (!dibujandoFlecha || !trazoActual) return;
    const pt = obtenerCoordsCanvas(e);
    trazoActual.x2 = pt.x;
    trazoActual.y2 = pt.y;
    redibujarCanvasFlechas();
  });

  window.addEventListener("pointerup", () => {
    if (dibujandoFlecha && trazoActual) {
      if (
        Math.hypot(trazoActual.x2 - trazoActual.x1, trazoActual.y2 - trazoActual.y1) > 8
      ) {
        flechasDibujadas.push(trazoActual);
      }
      trazoActual = null;
      dibujandoFlecha = false;
      redibujarCanvasFlechas();
    }
  });

  document.getElementById("btnDeshacerFlecha").addEventListener("click", () => {
    flechasDibujadas.pop();
    redibujarCanvasFlechas();
  });

  document.getElementById("btnLimpiarFlechas").addEventListener("click", () => {
    flechasDibujadas = [];
    redibujarCanvasFlechas();
  });

  document
    .getElementById("btnCerrarEditorFlecha")
    .addEventListener("click", () => {
      modalEditorFlecha.style.display = "none";
    });

  document
    .getElementById("btnGuardarFotoEditada")
    .addEventListener("click", async () => {
      if (!fotoEditandoContext) return;
      try {
        modalEditorFlecha.style.display = "none";
        mostrarCargando("Cargando...", "Guardando imagen con flecha roja...");

        canvasEditor.toBlob(
          async (blob) => {
            try {
              const comprimida = await comprimirImagenEnKb(blob);
              await subirFotoComprimidaASupabase(
                comprimida.blob,
                fotoEditandoContext.hoja_nombre,
                fotoEditandoContext.item_nro,
                fotoEditandoContext.sku,
                fotoEditandoContext.id
              );
              await cargarFotosDeHoja(fotoEditandoContext.hoja_nombre);
              renderizarVistaPlantilla(fotoEditandoContext.hoja_nombre);
              mostrarCompletado(
                "Foto Actualizada",
                `La foto del ITEM #${fotoEditandoContext.item_nro} se guardó con la flecha roja.`
              );
            } catch (errInner) {
              mostrarErrorEstado("Error al guardar foto", errInner.message);
            }
          },
          "image/jpeg",
          0.75
        );
      } catch (err) {
        mostrarErrorEstado("Error al guardar foto", err.message);
      }
    });

  // =========================================================================
  // 8. CARPETA .ZIP CON UN EXCEL (.XLSX) POR HOJA Y UN PDF HORIZONTAL POR HOJA
  // =========================================================================
  async function construirWorkbookHoja3M(nombreHoja, filasHoja, fotosHoja) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(nombreHoja.slice(0, 31), {
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      },
      headerFooter: {
        oddFooter:
          "&LREPORTE DE DISCREPANCIAS NIVEL 2 ANDINA - 3M&CPágina &P de &N&R&D"
      }
    });

    const thinBorder = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };

    sheet.columns = [
      { width: 8 },  // A
      { width: 16 }, // B: Embarque
      { width: 15 }, // C: SKU
      { width: 36 }, // D: Descripción
      { width: 9 },  // E: UM
      { width: 11 }, // F: Cantidad
      { width: 14 }, // G: Lote
      { width: 15 }, // H: Fecha Vencimiento
      { width: 12 }, // I: Traspaso
      { width: 14 }, // J: Codigo de Discrepancia
      { width: 18 }, // K: Descripción del problema
      { width: 18 }  // L: Descripción del problema
    ];

    sheet.mergeCells("B2:B5");
    sheet.mergeCells("C2:G5");
    sheet.getCell("B2").value = "3M";
    sheet.getCell("B2").font = {
      name: "Arial Black",
      size: 26,
      bold: true,
      color: { argb: "FFE60000" }
    };
    sheet.getCell("B2").alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell("C2").value = "REPORTE DE DISCREPANCIAS NIVEL 2 ANDINA";
    sheet.getCell("C2").font = { name: "Calibri", size: 15, bold: true };
    sheet.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };

    const metaRows = [
      [2, "Código:", "3MLATAM-AND-RFO-854014"],
      [3, "Revisión:", "1"],
      [4, "Fecha de vigencia:", "4/10/2022"],
      [5, "Fecha de sustitución:", "Nuevo"]
    ];
    metaRows.forEach(([rNum, lbl, val]) => {
      sheet.getCell(rNum, 10).value = lbl;
      sheet.getCell(rNum, 10).font = { bold: true, size: 10 };
      sheet.getCell(rNum, 10).alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells(`K${rNum}:L${rNum}`);
      sheet.getCell(rNum, 11).value = val;
      sheet.getCell(rNum, 11).font = { bold: true, size: 10 };
      sheet.getCell(rNum, 11).alignment = { horizontal: "center", vertical: "middle" };
    });

    for (let r = 2; r <= 5; r++) {
      for (let c = 2; c <= 12; c++) {
        sheet.getCell(r, c).border = thinBorder;
      }
    }

    sheet.getCell("C7").value = "PROCESO:";
    sheet.getCell("C7").font = { bold: true, size: 10 };
    sheet.getCell("C7").alignment = { horizontal: "center", vertical: "middle" };
    sheet.mergeCells("D7:E7");
    sheet.getCell("D7").value = "LABORATORIO/LABELING";
    sheet.getCell("D7").font = { bold: true, size: 10 };
    sheet.getCell("D7").alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell("C8").value = "SITE:";
    sheet.getCell("C8").font = { bold: true, size: 10 };
    sheet.getCell("C8").alignment = { horizontal: "center", vertical: "middle" };
    sheet.mergeCells("D8:E8");
    sheet.getCell("D8").value = "CHILCA";
    sheet.getCell("D8").font = { bold: true, size: 10 };
    sheet.getCell("D8").alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell("J7").value = "Número de reporte";
    sheet.getCell("J7").font = { bold: true, size: 10 };
    sheet.getCell("J7").alignment = { horizontal: "center", vertical: "middle" };
    sheet.mergeCells("K7:L7");
    sheet.getCell("K7").value = filasHoja[0]?.col_q_nro_reporte || "";
    sheet.getCell("K7").font = { bold: true, size: 10 };
    sheet.getCell("K7").alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };

    sheet.getCell("J8").value = "Fecha";
    sheet.getCell("J8").font = { bold: true, size: 10 };
    sheet.getCell("J8").alignment = { horizontal: "center", vertical: "middle" };
    sheet.mergeCells("K8:L8");
    sheet.getCell("K8").value = fechaHoyDDMMYYYY();
    sheet.getCell("K8").font = { bold: true, size: 10 };
    sheet.getCell("K8").alignment = { horizontal: "center", vertical: "middle" };

    [7, 8].forEach((r) => {
      [3, 4, 5, 10, 11, 12].forEach((c) => {
        sheet.getCell(r, c).border = thinBorder;
      });
    });

    const filaCab = 10;
    const headers10 = [
      [2, "Embarque"],
      [3, "SKU"],
      [4, "Descripción"],
      [5, "UM"],
      [6, "Cantidad"],
      [7, "Lote"],
      [8, "Fecha Vencimiento"],
      [9, "Traspaso"],
      [10, "Codigo de Discrepancia"]
    ];
    headers10.forEach(([colIdx, titulo]) => {
      const cell = sheet.getCell(filaCab, colIdx);
      cell.value = titulo;
      cell.font = { bold: true, size: 10 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
      cell.border = thinBorder;
    });
    sheet.mergeCells(`K${filaCab}:L${filaCab}`);
    sheet.getCell(`K${filaCab}`).value = "Descripción del problema";
    sheet.getCell(`K${filaCab}`).font = { bold: true, size: 10 };
    sheet.getCell(`K${filaCab}`).alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    sheet.getCell(filaCab, 11).border = thinBorder;
    sheet.getCell(filaCab, 12).border = thinBorder;
    sheet.getRow(filaCab).height = 24;

    const setPrio = getSetPriorizados();
    let currentRow = 11;
    filasHoja.forEach((reg) => {
      const rowObj = sheet.getRow(currentRow);
      rowObj.height = 22;

      const vals = [
        [2, reg.col_e_embarque],
        [3, reg.col_g_sku],
        [4, reg.col_h_descripcion],
        [5, reg.col_i_um],
        [6, reg.col_j_stock],
        [7, String(reg.col_f_lote || "")],
        [8, reg.col_k_vencimiento],
        [9, reg.col_d_traspaso],
        [10, reg.col_l_cod_discrepancia]
      ];

      vals.forEach(([colIdx, v]) => {
        const cell = sheet.getCell(currentRow, colIdx);
        cell.value = v;
        cell.font = { size: 9 };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true
        };
        cell.border = thinBorder;

        if (colIdx === 7) {
          cell.numFmt = "@";
        }
        if (
          colIdx === 3 &&
          setPrio.has(String(reg.col_g_sku || "").trim().toUpperCase())
        ) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" }
          };
          cell.font = { size: 9, bold: true };
        }
      });

      sheet.mergeCells(`K${currentRow}:L${currentRow}`);
      const descCell = sheet.getCell(`K${currentRow}`);
      descCell.value = reg.col_m_desc_problema;
      descCell.font = { size: 9 };
      descCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
      sheet.getCell(currentRow, 11).border = thinBorder;
      sheet.getCell(currentRow, 12).border = thinBorder;

      currentRow++;
    });

    if (fotosHoja.length > 0) {
      const fotoRowBase = currentRow + 2;
      const colsPorFila = 4;

      for (let i = 0; i < fotosHoja.length; i++) {
        const fObj = fotosHoja[i];
        const colSlot = i % colsPorFila;
        const filaSlot = fotoRowBase + Math.floor(i / colsPorFila) * 9;
        const colExcelZero = 1 + colSlot * 3;

        sheet.getCell(filaSlot, colExcelZero + 1).value = `ITEM #${fObj.item_nro} - SKU ${fObj.sku}`;
        sheet.getCell(filaSlot, colExcelZero + 1).font = { bold: true, size: 9 };

        try {
          const resp = await fetch(fObj.foto_url);
          const buf = await resp.arrayBuffer();
          const imgId = workbook.addImage({ buffer: buf, extension: "jpeg" });
          sheet.addImage(imgId, {
            tl: { col: colExcelZero, row: filaSlot },
            ext: { width: 175, height: 130 }
          });
        } catch (e) {
          console.warn("Error incrustando foto en Excel:", e);
        }
      }
    }

    return workbook.xlsx.writeBuffer();
  }

  btnExportarExcelHoja.addEventListener("click", async () => {
    const hojasGeneradas = obtenerNombresHojasGeneradas();
    if (hojasGeneradas.length === 0) {
      return mostrarErrorEstado(
        "Atención",
        "Primero genere las hojas con 'Generar Reporte'."
      );
    }

    try {
      mostrarCargando(
        "Cargando...",
        `Generando ${hojasGeneradas.length} archivo(s) Excel en formato 3M y empaquetando carpeta ZIP...`
      );

      const zip = new JSZip();
      const resFotos = await window.apiPost("listLabelingFotos");
      const todasFotos = resFotos.ok ? resFotos.fotos : [];

      for (const nombreHoja of hojasGeneradas) {
        const filasHoja = hojaRegistros.filter(
          (r) =>
            String(r.col_e_embarque || "")
              .trim()
              .replace(/\//g, "-")
              .slice(0, 31) === nombreHoja
        );
        const fotosHoja = todasFotos.filter((f) => f.hoja_nombre === nombreHoja);
        const bufferExcel = await construirWorkbookHoja3M(
          nombreHoja,
          filasHoja,
          fotosHoja
        );
        zip.file(`${nombreHoja}.xlsx`, bufferExcel);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Reportes_Excel_Labeling_${new Date()
        .toISOString()
        .slice(0, 10)}.zip`;
      link.click();

      mostrarCompletado(
        "Carpeta Excel Descargada",
        `Se generó el archivo ZIP con ${hojasGeneradas.length} Excel(s) individual(es) por hoja.`
      );
    } catch (err) {
      mostrarErrorEstado("Error al generar carpeta Excel", err.message);
    }
  });

  btnExportarPdfHorizontal.addEventListener("click", async () => {
    const hojasGeneradas = obtenerNombresHojasGeneradas();
    if (hojasGeneradas.length === 0) {
      return mostrarErrorEstado(
        "Atención",
        "Primero genere las hojas con 'Generar Reporte'."
      );
    }

    const pestanaPrevia = pestanaActiva;
    const canvasDoc = document.getElementById("m3mDocCanvas");
    const { jsPDF } = window.jspdf;

    try {
      mostrarCargando(
        "Cargando...",
        `Generando ${hojasGeneradas.length} PDF(s) en horizontal y empaquetando carpeta ZIP...`
      );

      const zip = new JSZip();
      canvasDoc.classList.add("is-export-mode");

      for (const nombreHoja of hojasGeneradas) {
        await activarPestana(nombreHoja);
        await new Promise((r) => setTimeout(r, 140));

        const canvasShot = await html2canvas(canvasDoc, {
          scale: 2,
          useCORS: true
        });

        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4"
        });
        const pageW = pdf.internal.pageSize.getWidth() - 16;
        const pageH = pdf.internal.pageSize.getHeight() - 16;
        const imgData = canvasShot.toDataURL("image/jpeg", 0.9);
        const ratio = Math.min(
          pageW / canvasShot.width,
          pageH / canvasShot.height
        );
        const w = canvasShot.width * ratio;
        const h = canvasShot.height * ratio;

        pdf.addImage(imgData, "JPEG", 8, 8, w, h);
        const pdfArrayBuffer = pdf.output("arraybuffer");
        zip.file(`${nombreHoja}.pdf`, pdfArrayBuffer);
      }

      canvasDoc.classList.remove("is-export-mode");
      await activarPestana(pestanaPrevia);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Reportes_PDF_Horizontal_Labeling_${new Date()
        .toISOString()
        .slice(0, 10)}.zip`;
      link.click();

      mostrarCompletado(
        "Carpeta PDF Descargada",
        `Se generó el archivo ZIP con ${hojasGeneradas.length} PDF(s) horizontales por hoja.`
      );
    } catch (err) {
      canvasDoc.classList.remove("is-export-mode");
      mostrarErrorEstado("Error al generar carpeta PDF", err.message);
    }
  });

  // =========================================================================
  // 9. RESETEO Y LIMPIEZA DEL STORAGE (PLAN FREE SUPABASE)
  // =========================================================================
  btnResetearProceso.addEventListener("click", async () => {
    const ok = await mostrarConfirmacionConLogo(
      "Resetear Proceso",
      "¿Desea RESETEAR el proceso y ELIMINAR todas las fotos del Storage de Supabase para liberar espacio en el plan Free?",
      "Resetear"
    );
    if (!ok) return;

    try {
      mostrarCargando(
        "Cargando...",
        "Reseteando proceso y eliminando fotos del Storage..."
      );
      const res = await window.apiPost("resetProcesoYStorageLabeling");
      if (!res.ok) throw new Error(res.message);

      fotosHojaActual = [];
      await cargarEstadoDesdeSupabase();
      await activarPestana("Registros");
      mostrarCompletado(
        "Proceso Reseteado",
        `Se limpiaron los registros y se eliminaron ${res.deletedFotos} foto(s) del Storage.`
      );
    } catch (err) {
      mostrarErrorEstado("Error al resetear", err.message);
    }
  });

  // =========================================================================
  // 10. RENDERIZADO DE REGISTROS, PLANTILLA (CON ITEM + SKU) Y FOTOS
  // =========================================================================
  function obtenerNombresHojasGeneradas() {
    const tienePlantillas = hojaRegistros.some((r) => r.plantilla_generada);
    if (!tienePlantillas) return [];
    const nombres = [];
    hojaRegistros.forEach((r) => {
      const clave = String(r.col_e_embarque || "").trim();
      if (!clave) return;
      const limpio = clave.replace(/\//g, "-").slice(0, 31);
      if (!nombres.includes(limpio)) nombres.push(limpio);
    });
    return nombres;
  }

  async function cargarFotosDeHoja(hojaNombre) {
    const res = await window.apiPost("listLabelingFotos", {
      hoja_nombre: hojaNombre
    });
    fotosHojaActual = res.ok ? res.fotos || [] : [];
  }

  async function cargarEstadoDesdeSupabase() {
    const res = await window.apiPost("getMacroLabelingState");
    if (!res.ok) return;

    hojaRegistros = res.registros || [];
    hojaDB = res.dbRows || [];

    renderizarHojaRegistros();
    renderizarHojaDB();
    renderizarHojasMaestras();
    renderizarPestanasPlantillas();
    actualizarVisibilidadHojasBase();

    estadoProceso.textContent =
      hojaRegistros.length === 0
        ? "Sin registros"
        : `✅ ${hojaRegistros.length} filas`;
  }

  function renderizarHojaRegistros() {
    if (hojaRegistros.length === 0) {
      tbodyRegistros.innerHTML = `<tr><td colspan="18" class="m3m-empty">Sin datos importados.</td></tr>`;
      return;
    }
    tbodyRegistros.innerHTML = "";
    const setPrio = getSetPriorizados();
    hojaRegistros.forEach((r) => {
      const tr = document.createElement("tr");
      const esPrio = setPrio.has(String(r.col_g_sku || "").trim().toUpperCase());
      tr.innerHTML = `
        <td><b>${r.fila_excel}</b></td>
        <td>${r.col_a_nro}</td>
        <td>${r.col_b_area}</td>
        <td>${r.col_c_fecha}</td>
        <td>${r.col_d_traspaso}</td>
        <td><b>${r.col_e_embarque}</b></td>
        <td class="m3m-lote-cell">${r.col_f_lote}</td>
        <td class="${esPrio ? "m3m-sku-prio" : ""}">${r.col_g_sku}</td>
        <td>${r.col_h_descripcion}</td>
        <td>${r.col_i_um}</td>
        <td>${r.col_j_stock}</td>
        <td>${r.col_k_vencimiento}</td>
        <td><b>${r.col_l_cod_discrepancia}</b></td>
        <td>${r.col_m_desc_problema}</td>
        <td></td>
        <td></td>
        <td>
          <select class="m3m-select-tipo" data-id="${r.id}">
            <option value="NO MEDICO" ${
              r.col_p_tipo_medico === "NO MEDICO" ? "selected" : ""
            }>NO MEDICO</option>
            <option value="MEDICO SIN RS" ${
              r.col_p_tipo_medico === "MEDICO SIN RS" ? "selected" : ""
            }>MEDICO SIN RS</option>
          </select>
        </td>
        <td><b>${r.col_q_nro_reporte || ""}</b></td>
      `;
      tr.querySelector(".m3m-select-tipo").addEventListener("change", (e) => {
        r.col_p_tipo_medico = e.target.value;
      });
      tbodyRegistros.appendChild(tr);
    });
  }

  function renderizarPestanasPlantillas() {
    dynamicTabsContainer.innerHTML = "";
    const nombresHojas = obtenerNombresHojasGeneradas();
    nombresHojas.forEach((nombreLimpio) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "m3m-tab m3m-tab-celeste" +
        (pestanaActiva === nombreLimpio ? " active" : "");
      btn.dataset.target = nombreLimpio;
      btn.textContent = nombreLimpio;
      btn.addEventListener("click", () => activarPestana(nombreLimpio));
      dynamicTabsContainer.appendChild(btn);
    });
  }

  function renderizarVistaPlantilla(nombreHoja) {
    const celdaB7 = document.getElementById("tplCeldaB7");
    const celdaL7 = document.getElementById("tplCeldaL7");
    const celdaL8 = document.getElementById("tplCeldaL8");
    const tplBody = document.getElementById("tplTablaBody");
    const lblNombre = document.getElementById("tplNombreHojaActual");
    const fotosGrid = document.getElementById("tplFotosGrid");
    const setPrio = getSetPriorizados();

    if (!nombreHoja) {
      celdaB7.textContent = "";
      celdaL7.textContent = "";
      celdaL8.textContent = fechaHoyDDMMYYYY();
      lblNombre.textContent = "Plantilla Discrepancia (Base)";
      tplBody.innerHTML = `<tr><td colspan="12" style="padding:14px; color:#64748b;">Plantilla base 3M</td></tr>`;
      fotosGrid.innerHTML = "";
      return;
    }

    lblNombre.textContent = nombreHoja;
    const filas = hojaRegistros.filter(
      (r) =>
        String(r.col_e_embarque || "")
          .trim()
          .replace(/\//g, "-")
          .slice(0, 31) === nombreHoja
    );
    if (filas.length === 0) return;

    celdaL7.textContent = filas[0].col_q_nro_reporte || "";
    celdaL8.textContent = fechaHoyDDMMYYYY();
    celdaB7.textContent = filas[0].col_p_tipo_medico || "";

    tplBody.innerHTML = "";
    filas.forEach((reg, idx) => {
      const itemNro = idx + 1;
      const esPrio = setPrio.has(String(reg.col_g_sku || "").trim().toUpperCase());
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="m3m-item-cell">${itemNro}</td>
        <td>${reg.col_e_embarque}</td>
        <td>
          <button type="button" class="m3m-sku-btn ${
            esPrio ? "m3m-sku-prio" : ""
          }" title="Tomar o agregar foto para ITEM #${itemNro}">
            <span class="m3m-sku-cam-icon">📷</span> <span>${reg.col_g_sku}</span>
          </button>
        </td>
        <td>${reg.col_h_descripcion}</td>
        <td>${reg.col_i_um}</td>
        <td>${reg.col_j_stock}</td>
        <td class="m3m-lote-cell">${reg.col_f_lote}</td>
        <td>${reg.col_k_vencimiento}</td>
        <td>${reg.col_d_traspaso}</td>
        <td>${reg.col_l_cod_discrepancia}</td>
        <td colspan="2">${reg.col_m_desc_problema}</td>
      `;

      tr.querySelector(".m3m-sku-btn").addEventListener("click", () => {
        abrirModalCapturaSku(nombreHoja, itemNro, reg.col_g_sku);
      });

      tplBody.appendChild(tr);
    });

    fotosGrid.innerHTML = "";
    fotosHojaActual.forEach((fObj) => {
      const card = document.createElement("div");
      card.className = "m3m-photo-card";
      card.innerHTML = `
        <div class="m3m-photo-item-banner">
          <span>ITEM #${fObj.item_nro}</span>
          <span>SKU: ${fObj.sku}</span>
        </div>
        <div class="m3m-photo-img-wrap">
          <img src="${fObj.foto_url}" alt="ITEM ${fObj.item_nro} - ${fObj.sku}">
        </div>
        <div class="m3m-photo-actions">
          <button type="button" class="m3m-btn-edit-photo">🏹 Editar</button>
          <button type="button" class="m3m-btn-del-photo">✕</button>
        </div>
      `;

      card
        .querySelector(".m3m-btn-edit-photo")
        .addEventListener("click", () => abrirEditorFlecha(fObj));

      card
        .querySelector(".m3m-btn-del-photo")
        .addEventListener("click", async () => {
          const confirmado = await mostrarConfirmacionConLogo(
            "Eliminar Fotografía",
            `¿Desea eliminar la foto del ITEM #${fObj.item_nro} (SKU ${fObj.sku})?`,
            "Eliminar"
          );
          if (!confirmado) return;

          try {
            mostrarCargando("Cargando...", "Eliminando fotografía...");
            await window.apiPost("deleteLabelingFoto", { id: fObj.id });
            await cargarFotosDeHoja(nombreHoja);
            renderizarVistaPlantilla(nombreHoja);
            mostrarCompletado(
              "Foto Eliminada",
              `Se eliminó la fotografía del ITEM #${fObj.item_nro}.`
            );
          } catch (err) {
            mostrarErrorEstado("Error al eliminar foto", err.message);
          }
        });

      fotosGrid.appendChild(card);
    });
  }

  function renderizarHojaDB() {
    const tbodyDB = document.getElementById("tbodyDB");
    const colB = hojaDB.filter((x) => x.tipo_columna === "B");
    const colC = hojaDB.filter((x) => x.tipo_columna === "C");
    const maxLen = Math.max(colB.length, colC.length, 1);

    tbodyDB.innerHTML = "";
    for (let i = 0; i < maxLen; i++) {
      const itemB = colB[i];
      const itemC = colC[i];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td></td>
        <td class="${itemB?.reemplazado_1111 ? "m3m-db-replaced" : ""}">${
        itemB ? itemB.valor_reporte : ""
      }</td>
        <td>${itemC ? itemC.valor_reporte : ""}</td>
      `;
      tbodyDB.appendChild(tr);
    }
  }

  function renderizarHojasMaestras() {
    const tbodyMed = document.getElementById("tbodyMedicos");
    if (tbodyMed) {
      tbodyMed.innerHTML = listaMedicosSinRsRows
        .map(
          (m) =>
            `<tr><td><b>${m.sku}</b></td><td>${m.descripcion}</td><td>${m.um}</td></tr>`
        )
        .join("");
    }
    const tbodyPrio = document.getElementById("tbodyPriorizados");
    if (tbodyPrio) {
      tbodyPrio.innerHTML = listaPriorizados
        .map(
          (p) =>
            `<tr><td><b>${p.id_3m}</b></td><td>${p.description}</td><td>${p.pmunit}</td><td>${p.observacion}</td></tr>`
        )
        .join("");
    }
  }

  cargarMaestrosDesdeSupabase().then(() => cargarEstadoDesdeSupabase());
});