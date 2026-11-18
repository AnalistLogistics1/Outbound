// js/discrepancia-labeling.js
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.requireAuth === "function") window.requireAuth();

  let registros = [];
  let registroSeleccionado = null;
  // Fotos en el modal actual: [{ url, path, blob, sizeKb, isNew }]
  let fotosEnEdicion = [];

  const tablaBody = document.getElementById("dlTablaBody");
  const contadorRegistros = document.getElementById("dlContadorRegistros");
  const inputBuscar = document.getElementById("dlInputBuscar");

  // Elementos del panel de detalle derecho
  const detTituloFecha = document.getElementById("detTituloFecha");
  const detImagenPrincipal = document.getElementById("detImagenPrincipal");
  const detSinFoto = document.getElementById("detSinFoto");
  const detMiniaturas = document.getElementById("detMiniaturas");
  const detFechaHora = document.getElementById("detFechaHora");
  const detSku = document.getElementById("detSku");
  const detBodega = document.getElementById("detBodega");
  const detUsuario = document.getElementById("detUsuario");
  const btnEditarActual = document.getElementById("btnEditarActual");
  const btnEliminarFila = document.getElementById("btnEliminarFila");
  const btnBorrarTodo = document.getElementById("btnBorrarTodo");

  // Elementos del Modal
  const modalForm = document.getElementById("dlModalForm");
  const modalTitulo = document.getElementById("modalTitulo");
  const formDiscrepancia = document.getElementById("formDiscrepancia");
  const inputIdRegistro = document.getElementById("inputIdRegistro");
  const inputFechaHora = document.getElementById("inputFechaHora");
  const inputSku = document.getElementById("inputSku");
  const inputBodega = document.getElementById("inputBodega");
  const inputCamaraNativa = document.getElementById("inputCamaraNativa");
  const inputGaleriaMultiple = document.getElementById("inputGaleriaMultiple");
  const previewFotosContainer = document.getElementById("previewFotosContainer");
  const btnGuardarRegistro = document.getElementById("btnGuardarRegistro");

  function obtenerFechaHoraActual() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  }

  // =====================================================
  // 1. COMPRESIÓN Y COMPATIBILIDAD NATIVA iOS / ANDROID
  // =====================================================
  async function comprimirFotoNativa(file, maxAncho = 800, calidad = 0.72) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.width;
        let height = img.height;

        if (width > maxAncho) {
          height = Math.round((height * maxAncho) / width);
          width = maxAncho;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Fondo blanco por seguridad en transparencias iOS
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo comprimir la imagen."));
            resolve({
              blob,
              previewUrl: URL.createObjectURL(blob),
              sizeKb: Math.round(blob.size / 1024)
            });
          },
          "image/jpeg",
          calidad
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Formato de imagen no soportado."));
      };

      img.src = objectUrl;
    });
  }

  async function procesarArchivosSeleccionados(fileList) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      try {
        const comprimida = await comprimirFotoNativa(file);
        fotosEnEdicion.push({
          url: comprimida.previewUrl,
          path: null,
          blob: comprimida.blob,
          sizeKb: comprimida.sizeKb,
          isNew: true
        });
      } catch (err) {
        alert("Error procesando foto: " + err.message);
      }
    }
    renderizarPreviewsModal();
  }

  inputCamaraNativa.addEventListener("change", async (e) => {
    await procesarArchivosSeleccionados(e.target.files);
    inputCamaraNativa.value = ""; // Permitir tomar otra foto seguida en iOS/Android
  });

  inputGaleriaMultiple.addEventListener("change", async (e) => {
    await procesarArchivosSeleccionados(e.target.files);
    inputGaleriaMultiple.value = "";
  });

  function renderizarPreviewsModal() {
    previewFotosContainer.innerHTML = "";
    fotosEnEdicion.forEach((foto, idx) => {
      const card = document.createElement("div");
      card.className = "dl-preview-card";
      card.innerHTML = `
        <img src="${foto.url}" alt="Foto ${idx + 1}">
        <button type="button" class="dl-preview-remove" data-idx="${idx}">✕</button>
        <span class="dl-preview-size">${foto.sizeKb ? foto.sizeKb + " KB" : "Guardada"}</span>
      `;
      card.querySelector(".dl-preview-remove").addEventListener("click", () => {
        fotosEnEdicion.splice(idx, 1);
        renderizarPreviewsModal();
      });
      previewFotosContainer.appendChild(card);
    });
  }

  // =====================================================
  // 2. CARGA Y RENDERIZADO DE TABLA Y VISOR DE DETALLE
  // =====================================================
  async function cargarRegistros() {
    const res = await window.apiPost("listDiscrepancias");
    if (!res.ok) {
      tablaBody.innerHTML = `<tr><td colspan="6" class="dl-empty-msg">Error: ${res.message}</td></tr>`;
      return;
    }
    registros = res.rows || [];
    contadorRegistros.textContent = `${registros.length} registro${registros.length === 1 ? "" : "s"} activo${registros.length === 1 ? "" : "s"}`;
    renderizarTabla();

    if (registros.length > 0) {
      seleccionarRegistro(registros[0]);
    } else {
      limpiarPanelDetalle();
    }
  }

  function renderizarTabla() {
    const filtro = (inputBuscar.value || "").trim().toLowerCase();
    const filtrados = registros.filter((r) => {
      return (
        String(r.sku || "").toLowerCase().includes(filtro) ||
        String(r.bodega || "").toLowerCase().includes(filtro) ||
        String(r.fecha_hora || "").toLowerCase().includes(filtro)
      );
    });

    if (filtrados.length === 0) {
      tablaBody.innerHTML = `<tr><td colspan="6" class="dl-empty-msg">Sin registros de discrepancias.</td></tr>`;
      return;
    }

    tablaBody.innerHTML = "";
    filtrados.forEach((item) => {
      const fotos = Array.isArray(item.fotos) ? item.fotos : [];
      const img1 = fotos[0] ? `<img src="${fotos[0].url}" class="dl-thumb-cell" alt="Img1">` : "—";
      const img2 = fotos[1] ? `<img src="${fotos[1].url}" class="dl-thumb-cell" alt="Img2">` : "—";
      const extra = fotos.length > 2 ? `<span class="dl-badge-more">+${fotos.length - 2}</span>` : "";

      const tr = document.createElement("tr");
      if (registroSeleccionado && registroSeleccionado.id_registro === item.id_registro) {
        tr.classList.add("is-selected");
      }

      tr.innerHTML = `
        <td>${item.fecha_hora}</td>
        <td><strong>${item.sku}</strong></td>
        <td>${item.bodega}</td>
        <td>${img1}</td>
        <td>${img2}</td>
        <td>${extra}</td>
      `;

      tr.addEventListener("click", () => seleccionarRegistro(item));
      tablaBody.appendChild(tr);
    });
  }

  function seleccionarRegistro(item) {
    registroSeleccionado = item;
    renderizarTabla();

    detTituloFecha.textContent = item.fecha_hora;
    detFechaHora.textContent = item.fecha_hora;
    detSku.textContent = item.sku;
    detBodega.textContent = item.bodega;
    detUsuario.textContent = item.nombre_usuario || "Usuario";
    btnEditarActual.disabled = false;
    btnEliminarFila.disabled = false;

    const fotos = Array.isArray(item.fotos) ? item.fotos : [];
    detMiniaturas.innerHTML = "";

    if (fotos.length === 0) {
      detImagenPrincipal.style.display = "none";
      detSinFoto.style.display = "block";
      detSinFoto.textContent = "Este registro no tiene fotografías adjuntas.";
      return;
    }

    detSinFoto.style.display = "none";
    detImagenPrincipal.style.display = "block";
    detImagenPrincipal.src = fotos[0].url;

    fotos.forEach((f, idx) => {
      const thumb = document.createElement("img");
      thumb.src = f.url;
      if (idx === 0) thumb.classList.add("active");
      thumb.addEventListener("click", () => {
        detImagenPrincipal.src = f.url;
        detMiniaturas.querySelectorAll("img").forEach((el) => el.classList.remove("active"));
        thumb.classList.add("active");
      });
      detMiniaturas.appendChild(thumb);
    });
  }

  function limpiarPanelDetalle() {
    registroSeleccionado = null;
    detTituloFecha.textContent = "Seleccione un registro";
    detFechaHora.textContent = "—";
    detSku.textContent = "—";
    detBodega.textContent = "—";
    detUsuario.textContent = "—";
    detImagenPrincipal.style.display = "none";
    detSinFoto.style.display = "block";
    detSinFoto.textContent = "Seleccione una fila para ver sus fotos";
    detMiniaturas.innerHTML = "";
    btnEditarActual.disabled = true;
    btnEliminarFila.disabled = true;
  }

  inputBuscar.addEventListener("input", renderizarTabla);

// =====================================================
  // 3. GUARDAR REGISTRO Y SUBIR FOTOS COMPRIMIDAS A STORAGE
  // =====================================================
  document.getElementById("btnNuevoRegistro").addEventListener("click", () => {
    modalTitulo.textContent = "Añadir Registro Labeling";
    inputIdRegistro.value = "";
    inputFechaHora.value = obtenerFechaHoraActual();
    inputSku.value = "";
    inputBodega.value = "";
    fotosEnEdicion = [];
    renderizarPreviewsModal();
    modalForm.style.display = "flex";
    inputSku.focus();
  });

  btnEditarActual.addEventListener("click", () => {
    if (!registroSeleccionado) return;
    modalTitulo.textContent = `Editar Registro (${registroSeleccionado.sku})`;
    inputIdRegistro.value = registroSeleccionado.id_registro;
    inputFechaHora.value = registroSeleccionado.fecha_hora;
    inputSku.value = registroSeleccionado.sku;
    inputBodega.value = registroSeleccionado.bodega;
    fotosEnEdicion = (registroSeleccionado.fotos || []).map((f) => ({
      url: f.url,
      path: f.path,
      isNew: false
    }));
    renderizarPreviewsModal();
    modalForm.style.display = "flex";
  });

  function cerrarModal() {
    modalForm.style.display = "none";
  }

  document.getElementById("btnCerrarModal").addEventListener("click", cerrarModal);
  document.getElementById("btnCancelarModal").addEventListener("click", cerrarModal);

  formDiscrepancia.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (fotosEnEdicion.length === 0) {
      alert("Debe tomar o adjuntar al menos 1 fotografía.");
      return;
    }

    btnGuardarRegistro.disabled = true;
    btnGuardarRegistro.textContent = "Subiendo fotos...";

    try {
      const db = window.getSupabaseClient();
      const skuLimpio = inputSku.value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
      const fotosFinales = [];

      for (let i = 0; i < fotosEnEdicion.length; i++) {
        const itemFoto = fotosEnEdicion[i];
        if (!itemFoto.isNew) {
          fotosFinales.push({ url: itemFoto.url, path: itemFoto.path });
          continue;
        }

        const fileName = `${Date.now()}_${skuLimpio}_Imagen${i + 1}.jpg`;
        const { error: upErr } = await db.storage
          .from("fotos-labeling")
          .upload(fileName, itemFoto.blob, { contentType: "image/jpeg", upsert: true });

        if (upErr) throw new Error("Error subiendo foto a Storage: " + upErr.message);

        const { data: pubUrlData } = db.storage.from("fotos-labeling").getPublicUrl(fileName);
        fotosFinales.push({
          path: fileName,
          url: pubUrlData.publicUrl
        });
      }

      const res = await window.apiPost("saveDiscrepancia", {
        id_registro: inputIdRegistro.value || null,
        fecha_hora: inputFechaHora.value,
        sku: inputSku.value.trim(),
        bodega: inputBodega.value.trim(),
        fotos: fotosFinales
      });

      if (!res.ok) throw new Error(res.message);

      cerrarModal();
      await cargarRegistros();
    } catch (err) {
      alert(err.message);
    } finally {
      btnGuardarRegistro.disabled = false;
      btnGuardarRegistro.textContent = "Guardar Registro";
    }
  });

  // =====================================================
  // 4. AUTOELIMINACIÓN (FILA INDIVIDUAL Y "BORRAR TODO")
  // =====================================================
  btnEliminarFila.addEventListener("click", async () => {
    if (!registroSeleccionado) return;
    if (!confirm(`¿Eliminar el SKU ${registroSeleccionado.sku} y sus fotos de Supabase Storage?`)) return;

    const res = await window.apiPost("deleteDiscrepanciaRow", {
      id_registro: registroSeleccionado.id_registro
    });
    if (!res.ok) return alert(res.message);
    await cargarRegistros();
  });

  btnBorrarTodo.addEventListener("click", async () => {
    if (registros.length === 0) return alert("No hay registros para borrar.");
    const confirmar = confirm(
      `¿Está seguro de BORRAR TODOS los ${registros.length} registros y vaciar todas las imágenes del Storage de Supabase para liberar el plan Free?`
    );
    if (!confirmar) return;

    btnBorrarTodo.disabled = true;
    const res = await window.apiPost("clearAllDiscrepancias");
    btnBorrarTodo.disabled = false;

    if (!res.ok) return alert("Error al borrar todo: " + res.message);
    alert(`Limpieza completada. Se eliminaron los registros y ${res.deletedImages} fotos del Storage.`);
    await cargarRegistros();
  });

  // =====================================================
  // 5. DESCARGA 1: EXCEL (.XLSX) CON FOTOS MEDIANAS Y PIE DE PÁGINA
  // =====================================================
  document.getElementById("btnDescargarExcel").addEventListener("click", async () => {
    if (registros.length === 0) return alert("No hay datos para exportar.");

    const btn = document.getElementById("btnDescargarExcel");
    const txtOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Generando Excel...";

    try {
      const maxFotos = Math.max(2, ...registros.map((r) => (r.fotos ? r.fotos.length : 0)));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("LABELING", {
        pageSetup: {
          paperSize: 9, // A4
          orientation: "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0
        },
        headerFooter: {
          oddFooter: "&LSMART LOGISTICS SOLUTIONS - DISCREPANCIA LABELING&CPágina &P de &N&R&D"
        }
      });

      const cols = [
        { header: "Fecha Hora", key: "fecha_hora", width: 22 },
        { header: "SKU", key: "sku", width: 16 },
        { header: "Bodega", key: "bodega", width: 18 }
      ];

      for (let c = 1; c <= maxFotos; c++) {
        cols.push({ header: `Imagen${c}`, key: `img_${c}`, width: 22 });
      }
      sheet.columns = cols;

      // Estilo de cabecera
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1B7F4C" }
      };
      sheet.getRow(1).height = 24;

      for (let i = 0; i < registros.length; i++) {
        const item = registros[i];
        const rowIndex = i + 2;
        const row = sheet.addRow({
          fecha_hora: item.fecha_hora,
          sku: item.sku,
          bodega: item.bodega
        });

        // Alto fijo mediano (92 puntos) igual al de tu macro VBA
        row.height = 92;
        row.alignment = { vertical: "middle", horizontal: "center" };

        const fotos = Array.isArray(item.fotos) ? item.fotos : [];
        for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
          if (!fotos[fIdx]?.url) continue;
          const resp = await fetch(fotos[fIdx].url);
          const buffer = await resp.arrayBuffer();

          const imgId = workbook.addImage({
            buffer: buffer,
            extension: "jpeg"
          });

          // Incrusta en tamaño mediano uniforme (145x110 px = ~110x85 pt) dentro de su celda
          sheet.addImage(imgId, {
            tl: { col: 3 + fIdx + 0.08, row: rowIndex - 1 + 0.06 },
            ext: { width: 145, height: 110 },
            editAs: "oneCell"
          });
        }
      }

      const bufferOut = await workbook.xlsx.writeBuffer();
      const blob = new Blob([bufferOut], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Discrepancia_Labeling_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
    } catch (err) {
      alert("Error generando Excel: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = txtOriginal;
    }
  });

  // =====================================================
  // 6. DESCARGA 2: PAQUETE .ZIP (DETALLE CSV + FOTOS) PARA TU MACRO EXCEL
  // =====================================================
  document.getElementById("btnDescargarZipMacro").addEventListener("click", async () => {
    if (registros.length === 0) return alert("No hay datos para exportar a la macro.");

    const btn = document.getElementById("btnDescargarZipMacro");
    const txtOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Empaquetando ZIP...";

    try {
      const zip = new JSZip();
      const carpetaFotos = zip.folder("LABELING_Images");
      const maxFotos = Math.max(2, ...registros.map((r) => (r.fotos ? r.fotos.length : 0)));

      const cabeceras = ["Fecha Hora", "SKU", "Bodega"];
      for (let c = 1; c <= maxFotos; c++) cabeceras.push(`Imagen${c}`);
      const filasCsv = [cabeceras.join(",")];

      for (let i = 0; i < registros.length; i++) {
        const item = registros[i];
        const fotos = Array.isArray(item.fotos) ? item.fotos : [];
        const rutasLocales = [];

        for (let fIdx = 0; fIdx < maxFotos; fIdx++) {
          if (fotos[fIdx]?.url) {
            const nombreArchivo = `Fila${i + 1}_${item.sku}_Imagen${fIdx + 1}.jpg`;
            const resp = await fetch(fotos[fIdx].url);
            const blobFoto = await resp.blob();
            carpetaFotos.file(nombreArchivo, blobFoto);
            rutasLocales.push(`LABELING_Images/${nombreArchivo}`);
          } else {
            rutasLocales.push("");
          }
        }

        const linea = [
          `"${item.fecha_hora}"`,
          `"${item.sku}"`,
          `"${item.bodega}"`,
          ...rutasLocales.map((r) => `"${r}"`)
        ];
        filasCsv.push(linea.join(","));
      }

      // Agregar BOM UTF-8 para que Excel abra tildes y eñes sin errores
      zip.file("detalle_labeling.csv", "\uFEFF" + filasCsv.join("\r\n"));

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `Paquete_Macro_Labeling_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
    } catch (err) {
      alert("Error generando ZIP para Macro: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = txtOriginal;
    }
  });

  cargarRegistros();
});