// js/api.js
(function () {
  "use strict";

  const SUPABASE_URL = "https://onlvwhmbytgrkqqfqpib.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubHZ3aG1ieXRncmtxcWZxcGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDg2MTIsImV4cCI6MjEwNDcyNDYxMn0.xycA65ZNrqGHHjiS4fLuDM89N6bj3Qi2B7wh-Y-xsh4";

  let supabaseApp = null;

  const LOTES_TABLES = [
    { table: "LOTES_PRIORIZADOS_1", groupKey: "PRIORIZADOS_1" },
    { table: "LOTES_PRIORIZADOS_2", groupKey: "PRIORIZADOS_2" },
    { table: "LOTES_PRIORIZADOS_3", groupKey: "PRIORIZADOS_3" }
  ];

  const BASE_LOTE_FIELDS = new Set([
    "id",
    "id_registro",
    "fecha_registro",
    "cliente",
    "usuario_login",
    "nombre_usuario",
    "rol_usuario",
    "estado",
    "comentario",
    "ultima_actualizacion"
  ]);

  function validateApiUrl_() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Configure las credenciales de Supabase en js/api.js");
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("La librería de Supabase no está cargada o está cargando después de js/api.js");
    }
  }

  function getSupabaseClient() {
    validateApiUrl_();
    if (!supabaseApp) {
      supabaseApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseApp;
  }

  function textValue(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalizeGroupKey(value) {
    return textValue(value).toUpperCase();
  }

  function getNextDate(dateText) {
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  // Genera fecha local (Perú) para guardar en BD
  function formatLocalNowApi() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
  }

  function parseDateForSort(dateStr) {
    const raw = String(dateStr || "").trim();
    if (!raw) return 0;
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(raw).getTime();
    match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const [, d, m, y, h = "0", mi = "0", s = "0"] = match;
      return new Date(y, m - 1, d, h, mi, s).getTime();
    }
    return 0;
  }

  function formatColumnName(name) {
    return String(name).trim().toLowerCase().replace(/\s+/g, '_');
  }

  function formatLoteRecord(row, table, groupKey) {
    const datosExtra = {};
    Object.keys(row).forEach((key) => {
      if (!BASE_LOTE_FIELDS.has(key)) {
        datosExtra[key] = row[key] || "";
      }
    });

    return {
      id: row.id_registro || row.id || "",
      fecha: row.fecha_registro || "",
      cliente: row.cliente || "",
      grupo: groupKey,
      groupKey: groupKey,
      sheetName: table,
      usuario: row.usuario_login || "",
      nombre: row.nombre_usuario || "",
      rol: row.rol_usuario || "",
      estado: row.estado || "",
      comentario: row.comentario || "",
      actualizado: row.ultima_actualizacion || "",
      datos: datosExtra,
      campos: datosExtra
    };
  }

  async function getNextLoteId(db, tableName) {
    const { data, error } = await db
      .from(tableName)
      .select('id_registro')
      .order('id_registro', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    let nextNum = 1;
    if (data && data.id_registro) {
      const match = data.id_registro.match(/LOT-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return 'LOT-' + String(nextNum).padStart(6, '0');
  }

  // ==========================================
  // MOTOR DE CORREOS Y NOTIFICACIONES (EMAILJS)
  // ==========================================
  
  async function obtenerCorreosNotificacion(db, solicitanteRef, aprobadorRef = null, incluirGerencia = false) {
    let correosDestino = [];

    const { data: planilla, error } = await db.from("PLANILLA").select("*");
    if (error || !planilla) {
      console.warn("No se pudo consultar PLANILLA para correos:", error);
      return "";
    }

    const norm = (val) => String(val || "").trim().toUpperCase();
    const solKey = norm(solicitanteRef);
    const aprKey = norm(aprobadorRef);

    planilla.forEach((fila) => {
      const correo = String(fila.correo || (String(fila.email || "").includes("@") ? fila.email : "")).trim();
      if (!correo) return;

      const emailFila = norm(fila.email);
      const nombreFila = norm(fila.nombre);
      const rolFila = norm(fila.rol);
      const cargoFila = norm(fila.cargo);

      // 1. Coincide con el Solicitante (por usuario/email o por nombre completo)
      const esSolicitante = solKey && (emailFila === solKey || nombreFila === solKey);

      // 2. Coincide con el Aprobador que ejecuta la acción (por usuario/email o por nombre completo)
      const esAprobadorActual = aprKey && (emailFila === aprKey || nombreFila === aprKey);

      // 3. Pertenece al grupo de Aprobadores o Superadmin
      const esRolAprobador = ["APROBADOR", "SUPERADMIN"].includes(rolFila) || ["APROBADOR", "SUPERADMIN"].includes(cargoFila);

      // 4. Pertenece al rol GERENCIA cuando la operación requiere involucrar a Gerencia
      const esRolGerencia = incluirGerencia && (rolFila === "GERENCIA" || cargoFila === "GERENCIA");

      if ((esSolicitante || esAprobadorActual || esRolAprobador || esRolGerencia) && !correosDestino.includes(correo)) {
        correosDestino.push(correo);
      }
    });

    console.log("Destinatarios de notificación:", correosDestino);
    return correosDestino.join(", ");
  }

  function generarHtmlCorreo(titulo, colorCabecera, mensajeIntro, detalles, mensajeFooter) {
    // Reducimos el padding de 12px a 7px para hacer la tabla más tabulada e igual a la imagen de referencia
    const filasTabla = Object.entries(detalles).map(([llave, valor]) => `
      <tr>
        <td width="35%" valign="middle" style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; font-size: 13px;">${llave}</td>
        <td width="65%" valign="middle" style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">${valor}</td>
      </tr>
    `).join("");

    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; padding: 20px 10px;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; border-collapse: separate; overflow: hidden;">
              <!-- Cabecera -->
              <tr>
                <td style="background-color: ${colorCabecera}; padding: 16px; text-align: center;">
                  <h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold;">${titulo}</h2>
                </td>
              </tr>
              <!-- Cuerpo -->
              <tr>
                <td style="padding: 24px;">
                  <p style="color: #334155; font-weight: bold; margin: 0 0 10px 0; font-size: 14px;">Estimado(a),</p>
                  <p style="color: #475569; margin: 0 0 16px 0; font-size: 13px; line-height: 1.5;">${mensajeIntro}</p>
                  
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 20px; border-top: 1px solid #e2e8f0;">
                    <tbody>
                      ${filasTabla}
                    </tbody>
                  </table>
                  
                  <div style="border-left: 4px solid ${colorCabecera}; padding-left: 12px; margin-bottom: 16px;">
                    <p style="color: #475569; margin: 0; font-size: 12px;">${mensajeFooter}</p>
                  </div>
                  
                  <p style="color: #475569; margin: 0; font-size: 13px;">Muchas gracias / Saludos.</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; font-size: 10px; margin: 0;">Notificación automática enviada desde el Sistema Logístico.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  async function enviarAlertaCorreo(destinatarios, asunto, html) {
    if (!window.emailjs) {
      console.warn("EmailJS no está cargado.");
      return;
    }

    if (!destinatarios || String(destinatarios).trim() === "") {
      console.warn("No hay destinatarios de correo.");
      return;
    }

    const SERVICE_ID = "service_o76dodr";
    const TEMPLATE_ID = "template_89p9pmu";

    const templateParams = {
      to_email: destinatarios,
      subject: asunto,
      message_html: html
    };

    try {
      // EmailJS lee la Public Key directamente desde la inicialización en el HTML
      const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
      console.log("Correo enviado exitosamente:", response.status, response.text);
    } catch (error) {
      console.error("Error enviando correo con EmailJS:", error);
      const detalle = error?.text || error?.message || "Error desconocido";
      console.error("Detalle EmailJS:", detalle);
    }
  }

  async function apiPost(action, payload = {}) {
    const db = getSupabaseClient();

    try {
      switch (action) {
        // ==========================================
        // 1. MÓDULO DE LOGIN
        // ==========================================
        case "validarUsuario":
        case "login": {
          const usuarioInput = textValue(payload.usuario || payload.username);
          const claveInput = payload.password || "";

          if (!usuarioInput) throw new Error("Ingrese un usuario.");

          const { data: userRow, error } = await db
            .from("PLANILLA") 
            .select("*")
            .ilike("email", usuarioInput) 
            .limit(1)
            .maybeSingle();

          if (error) throw new Error(error.message || "Error consultando el usuario.");
          if (!userRow) throw new Error("Usuario no encontrado.");
          if (action === "login" && String(userRow.clave) !== String(claveInput)) {
            throw new Error("Usuario o Clave incorrecta");
          }

          const user = {
            usuario: userRow.email || "",
            username: userRow.email || "",
            nombre: userRow.nombre || userRow.email || "Usuario", 
            rol: userRow.rol || "USUARIO", 
            cargo: userRow.cargo || "USUARIO",
            area: userRow.area || "",
            foto: userRow.foto || "",
            fotoWeb: userRow.foto || ""
          };

          if (action === "validarUsuario") return { ok: true, found: true, user };

          const token = "token_" + Date.now();
          return {
            ok: true,
            authenticated: true,
            token,
            user,
            session: { token, ...user, loginAt: new Date().toISOString() }
          };
        }

        case "getSesion": {
          if (!payload.token) throw new Error("Sesión inválida");
          return { ok: true, session: true };
        }

        case "logout": {
          return { ok: true, closed: true };
        }

        // ==========================================
        // 2. MÓDULO TOMA DE LOTES
        // ==========================================
        case "getLotesMeta": {
          const { data: clientesData, error: errClientes } = await db.from("maestros_clientes").select("*");
          const { data: camposData, error: errCampos } = await db.from("maestros_campos").select("*");

          if (errClientes || errCampos) throw new Error("Error cargando maestros de lotes.");

          const clientesUnicos = new Set();
          const config = {};
          const groups = {};

          ["PRIORIZADOS_1", "PRIORIZADOS_2", "PRIORIZADOS_3"].forEach((key) => {
            groups[key] = {
              key,
              label: key.replace(/_/g, " "),
              sheetName: `LOTES_${key.toUpperCase()}`,
              clientes: [], campos: [], storageFields: []
            };
          });

          (clientesData || []).forEach((row) => {
            const cliente = textValue(row.cliente);
            const grupo = normalizeGroupKey(row.grupo_key);
            if (!cliente || !groups[grupo]) return;

            clientesUnicos.add(cliente);
            if (!groups[grupo].clientes.includes(cliente)) groups[grupo].clientes.push(cliente);

            config[cliente] = {
              cliente, groupKey: grupo, sheetName: `LOTES_${grupo.toUpperCase()}`,
              campos: [], storageFields: []
            };
          });

          (camposData || []).forEach((row) => {
            const grupo = normalizeGroupKey(row.grupo_key);
            const campo = textValue(row.campo);
            if (!campo || !groups[grupo]) return;

            if (!groups[grupo].campos.includes(campo)) groups[grupo].campos.push(campo);
            if (!groups[grupo].storageFields.includes(campo)) groups[grupo].storageFields.push(campo);
          });

          Object.keys(config).forEach((cliente) => {
            const groupKey = config[cliente].groupKey;
            config[cliente].campos = groups[groupKey].campos;
            config[cliente].storageFields = groups[groupKey].storageFields;
          });

          return { ok: true, clientes: Array.from(clientesUnicos).sort(), config, groups, serverNow: new Date().toISOString() };
        }

        case "listLoteRecords": {
          let rows = [];
          for (const item of LOTES_TABLES) {
            let query = db.from(item.table).select("*");
            if (payload.cliente) query = query.ilike("cliente", `%${payload.cliente}%`);
            if (payload.estado) query = query.ilike("estado", `%${payload.estado}%`);
            if (payload.fecha) {
              const fechaBuscada = String(payload.fecha).trim();
              query = query.ilike("fecha_registro", `${fechaBuscada}%`);
            }
            const { data, error } = await query;
            if (error) { console.warn(`Error consultando ${item.table}:`, error.message); continue; }
            const formattedRows = (data || []).map((row) => formatLoteRecord(row, item.table, item.groupKey));
            rows = rows.concat(formattedRows);
          }
          rows.sort((a, b) => parseDateForSort(b.fecha) - parseDateForSort(a.fecha));
          return { ok: true, rows };
        }

        case "createLoteRecord": {
          const { cliente, campos, comentario } = payload;
          if (!cliente) throw new Error("Debe seleccionar un cliente.");

          const { data: cData, error: cErr } = await db.from("maestros_clientes").select("grupo_key").eq("cliente", cliente).maybeSingle();
          if (cErr || !cData) throw new Error("Cliente no encontrado en maestros.");
          
          const grupoKey = normalizeGroupKey(cData.grupo_key);
          const tableName = `LOTES_${grupoKey}`;

          const newId = await getNextLoteId(db, tableName);
          const nowStr = formatLocalNowApi();
          const user = JSON.parse(localStorage.getItem("authUser") || "{}");

          const insertData = {
            id_registro: newId,
            fecha_registro: nowStr,
            cliente: cliente,
            usuario_login: user.email || user.usuario || "",
            nombre_usuario: user.nombre || "Usuario",
            rol_usuario: user.cargo || user.rol || "USUARIO",
            estado: "REGISTRADO",
            comentario: comentario || "",
            ultima_actualizacion: nowStr
          };

          if (campos) {
            Object.keys(campos).forEach(k => {
              const colName = formatColumnName(k);
              if (['fecha', 'usuario', 'cliente', 'comentario', 'estado'].includes(colName)) return; 
              insertData[colName] = campos[k];
            });
          }

          const { error: insErr } = await db.from(tableName).insert([insertData]);
          if (insErr) throw new Error(insErr.message);

          return { ok: true, id: newId, fecha: nowStr, cliente, grupo: grupoKey, sheetName: tableName, estado: "REGISTRADO" };
        }

        case "getLoteRecord": {
          const { id } = payload;
          if (!id) throw new Error("ID de registro obligatorio.");

          let foundData = null;
          let foundTable = null;
          let foundGroup = null;

          for (const t of LOTES_TABLES) {
            const { data } = await db.from(t.table).select("*").eq("id_registro", id).maybeSingle();
            if (data) {
              foundData = data;
              foundTable = t.table;
              foundGroup = t.groupKey;
              break;
            }
          }

          if (!foundData) throw new Error("Registro no encontrado.");
          return { ok: true, ...formatLoteRecord(foundData, foundTable, foundGroup) };
        }

        case "updateLoteRecord": {
          const { id, campos, comentario, estado } = payload;
          if (!id) throw new Error("ID de registro obligatorio.");

          let foundTable = null;
          for (const t of LOTES_TABLES) {
            const { data } = await db.from(t.table).select("id_registro").eq("id_registro", id).maybeSingle();
            if (data) { foundTable = t.table; break; }
          }
          if (!foundTable) throw new Error("Registro no encontrado para actualizar.");

          const nowStr = formatLocalNowApi();
          const updateData = { ultima_actualizacion: nowStr };
          
          if (comentario !== undefined) updateData.comentario = comentario;
          if (estado !== undefined) updateData.estado = estado;

          if (campos) {
            Object.keys(campos).forEach(k => {
              const colName = formatColumnName(k);
              if (['fecha', 'usuario', 'cliente', 'comentario', 'estado'].includes(colName)) return; 
              updateData[colName] = campos[k];
            });
          }

          const { error: upErr } = await db.from(foundTable).update(updateData).eq("id_registro", id);
          if (upErr) throw new Error(upErr.message);

          return { ok: true, id, sheetName: foundTable, actualizado: nowStr };
        }

        // ==========================================
        // 3. MÓDULO DE CHECKLISTS
        // ==========================================
        case "createChecklistRecord": {
          const { tipo, fechaChecklist, nExpo, pais, responsable, ubicacion, respuestas } = payload;
          
          const tableName = tipo === "INSUMOS" ? "CHECKLIST_INSUMOS" : "CHECKLIST_AREA";

          const { data: lastRecord } = await db
            .from(tableName)
            .select("id_checklist")
            .order("id_checklist", { ascending: false })
            .limit(1)
            .maybeSingle();

          let nextNum = 1;
          if (lastRecord && lastRecord.id_checklist) {
            const match = lastRecord.id_checklist.match(/CHK-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }
          
          const newId = "CHK-" + String(nextNum).padStart(6, '0');

          const user = JSON.parse(localStorage.getItem("authUser") || "{}");
          const nowStr = formatLocalNowApi();

          const insertData = {
            id_checklist: newId,
            fecha_registro: nowStr,
            tipo_checklist: tipo,
            fecha_checklist: fechaChecklist,
            n_expo: parseInt(nExpo, 10) || null,
            pais: pais,
            responsable: responsable,
            usuario_login: user.email || user.usuario || "",
            nombre_usuario: user.nombre || "Usuario",
            rol_usuario: user.cargo || user.rol || "USUARIO",
            estado: "REGISTRADO",
            ultima_actualizacion: nowStr
          };

          if (tipo === "AREA") {
            insertData.ubicacion = ubicacion;
          }

          if (respuestas) {
            Object.keys(respuestas).forEach(key => {
              const colName = key.toLowerCase();
              const ans = respuestas[key];
              
              if (tipo === "INSUMOS") {
                insertData[`${colName}_estado`] = ans.estado || "";
              } else {
                insertData[`${colName}_respuesta`] = ans.respuesta || "";
              }
              insertData[`${colName}_comentario`] = ans.comentario ? ans.comentario : null; 
            });
          }

          const { error: insErr } = await db.from(tableName).insert([insertData]);
          if (insErr) throw new Error(insErr.message);

          return { ok: true, id: newId };
        }

        case "getChecklistMeta": {
          return { ok: true, message: "Usando metadata local" };
        }

        case "exportChecklistData": {
          const { data: insumos, error: errInsumos } = await db.from("CHECKLIST_INSUMOS").select("*");
          const { data: areas, error: errAreas } = await db.from("CHECKLIST_AREA").select("*");
          if (errInsumos || errAreas) throw new Error("Error exportando información de checklist.");

          const objToArray = function (dataArray) {
            if (!dataArray || dataArray.length === 0) return [];
            const headers = Object.keys(dataArray[0]);
            return [headers, ...dataArray.map((row) => headers.map((header) => row[header] || ""))];
          };

          return { ok: true, insumos: objToArray(insumos), area: objToArray(areas) };
        }

        // ==========================================
        // 4. MÓDULO PEDIDOS ADICIONALES
        // ==========================================
        case "savePedidoAdicional": {
          const pedidos = Array.isArray(payload) ? payload : [payload];
          const user = JSON.parse(localStorage.getItem("authUser") || "{}");
          const nowStr = formatLocalNowApi();
          
          const insertData = pedidos.map((p, index) => {
            const num = String(Date.now() + index).slice(-6);
            return {
              id_registro: `REQ-${num}`,
              tipo_solicitud: p.tipo_solicitud,
              fecha_registro: nowStr,
              cliente: p.cliente || "INTERNO",
              usuario_solicitante: user.nombre || user.email || "Usuario",
              estado: "PENDIENTE",
              comentario_general: p.comentario || "",
              detalles: p.detalles || {},
              ultima_actualizacion: nowStr
            };
          });

          const { error } = await db.from("pedidos_adicionales").insert(insertData);
          if (error) throw new Error(error.message);

          // ENVIAR ALERTA DE CREACIÓN (AMARILLO)
          const correos = await obtenerCorreosNotificacion(db, user.usuario || user.nombre);
          
          if (correos.length > 0) {
            for (const p of insertData) {
              const detallesHtml = {
                "ID Registro": p.id_registro,
                "Tipo Solicitud": p.tipo_solicitud,
              };

              // Validamos dinámicamente si es Recepción o Despacho
              if (p.tipo_solicitud === "RECEPCIÓN") {
                detallesHtml["COSTO"] = p.detalles["Costos"] || "-";
              } else {
                detallesHtml["Cliente / Destino"] = p.cliente;
              }

              detallesHtml["Responsable"] = p.usuario_solicitante;
              detallesHtml["Fecha"] = p.fecha_registro;

              const html = generarHtmlCorreo(
                "Solicitud Pendiente", 
                "#eab308", 
                "El equipo está trabajando en su solicitud activamente. A continuación, los detalles de la solicitud:", 
                detallesHtml, 
                "La solicitud se encuentra en estado PENDIENTE de aprobación."
              );
              // Se inserta dinámicamente el tipo de solicitud entre comillas
              await enviarAlertaCorreo(correos, `Nueva Solicitud "${p.tipo_solicitud}" Creada [${p.id_registro}]`, html);
            }
          }

          return { ok: true, count: insertData.length };
        }

        case "listPedidosAdicionales": {
          const { data, error } = await db.from("pedidos_adicionales").select("*");
          if (error) throw new Error(error.message);
          const rows = (data || []).sort((a, b) => parseDateForSort(b.fecha_registro) - parseDateForSort(a.fecha_registro));
          return { ok: true, rows };
        }

        // ==========================================
        // 5. APROBACIÓN DE PEDIDOS (NUEVO)
        // ==========================================
        case "aprobarPedidosAdicionales": {
          if (!Array.isArray(payload) || payload.length === 0) {
            throw new Error("Debe seleccionar al menos un registro para aprobar.");
          }
          
          const user = JSON.parse(localStorage.getItem("authUser") || "{}");
          const aprobador = user.nombre || user.email || "Usuario";
          const nowStr = formatLocalNowApi();
          
          const { error } = await db
            .from("pedidos_adicionales")
            .update({ 
              estado: "APROBADO", 
              ultima_actualizacion: nowStr,
              fecha_aprobacion: nowStr,
              aprobado_por: aprobador
            })
            .in("id_registro", payload);

          if (error) throw new Error(error.message);

          // ENVIAR ALERTA DE APROBACIÓN (VERDE)
          const { data: pedidosAprobados } = await db.from("pedidos_adicionales").select("*").in("id_registro", payload);
          if (pedidosAprobados) {
            for (const p of pedidosAprobados) {
              const correos = await obtenerCorreosNotificacion(db, p.usuario_solicitante, aprobador);
              const detallesHtml = {
                "ID Registro": p.id_registro,
                "Tipo Solicitud": p.tipo_solicitud,
                "Estatus": "Aprobado",
                "Aprobado por": aprobador,
                "Fecha Aprobación": nowStr
              };
              const html = generarHtmlCorreo(
                "Solicitud Aprobada", 
                "#22c55e", 
                `Nos complace informarle que su solicitud <b>${p.id_registro}</b> ha sido <b>aprobado exitosamente</b>.`, 
                detallesHtml, 
                "La solicitud ha sido aprobado en el sistema."
              );
              await enviarAlertaCorreo(correos, `[EXTERNAL] Solicitud "${p.tipo_solicitud}" Aprobada [${p.id_registro}]`, html);
            }
          }

          return { ok: true, count: payload.length };
        }

        // ==========================================
        // 5.1 APROBACIÓN DE DESPACHOS DE URGENCIA (FLETE Y GERENCIA)
        // ==========================================
        case "aprobarUrgenciaDespacho": {
          const { id_registro, modo, costo_flete, porcentaje_flete, comentario_urgencia } = payload;
          if (!id_registro) throw new Error("ID de registro obligatorio.");

          const { data: pedido, error: errGet } = await db
            .from("pedidos_adicionales")
            .select("*")
            .eq("id_registro", id_registro)
            .maybeSingle();

          if (errGet || !pedido) throw new Error("No se encontró el pedido seleccionado.");

          const user = JSON.parse(localStorage.getItem("authUser") || "{}");
          const aprobador = user.nombre || user.email || "Usuario";
          const nowStr = formatLocalNowApi();
          const detallesActualizados = { ...(pedido.detalles || {}) };

          if (modo === "APROBACION_FINAL_GERENCIA") {
            detallesActualizados["Aprobado Gerencia Por"] = aprobador;
            detallesActualizados["Fecha Aprobacion Gerencia"] = nowStr;

            const { error: errUp } = await db
              .from("pedidos_adicionales")
              .update({
                estado: "APROBADO",
                ultima_actualizacion: nowStr,
                fecha_aprobacion: nowStr,
                aprobado_por: `${detallesActualizados["Evaluado Aprobador 1"] || ""} / Gerencia: ${aprobador}`.replace(/^ \/ /, ""),
                detalles: detallesActualizados
              })
              .eq("id_registro", id_registro);

            if (errUp) throw new Error(errUp.message);

            const correos = await obtenerCorreosNotificacion(db, pedido.usuario_solicitante, aprobador, true);
            const detallesHtml = {
              "ID Registro": pedido.id_registro,
              "Tipo Solicitud": `${pedido.tipo_solicitud} (URGENCIA)`,
              "Cliente / Destino": pedido.cliente,
              "Valor Total": detallesActualizados["Valor Total"] || detallesActualizados["Valor Venta"] || "-",
              "Costo Flete": detallesActualizados["Costo Flete"] || "-",
              "Costo / Valor Venta": detallesActualizados["Porcentaje Flete"] || "-",
              "Sustento": detallesActualizados["Comentario Urgencia"] || "-",
              "Aprobado en 2da Instancia por": `${aprobador} (GERENCIA)`,
              "Fecha Aprobación": nowStr
            };
            const html = generarHtmlCorreo(
              "Solicitud Aprobada por Gerencia",
              "#22c55e",
              `Nos complace informarle que la solicitud de urgencia <b>${pedido.id_registro}</b> ha sido <b>aprobada en 2da instancia por Gerencia</b>.`,
              detallesHtml,
              "La solicitud ha sido aprobada en el sistema."
            );
            await enviarAlertaCorreo(correos, `[EXTERNAL] Solicitud "${pedido.tipo_solicitud}" Aprobada [${pedido.id_registro}]`, html);
            return { ok: true };
          }

          // Guardar datos registrados por Aprobador 1
          detallesActualizados["Costo Flete"] = costo_flete;
          detallesActualizados["Porcentaje Flete"] = porcentaje_flete;
          if (comentario_urgencia) {
            detallesActualizados["Comentario Urgencia"] = comentario_urgencia;
          }

          // Caso A: >= 2% (Rojo) derivado a 2da Aprobación por Gerencia
          if (modo === "PENDIENTE_GERENCIA") {
            detallesActualizados["Evaluado Aprobador 1"] = aprobador;
            detallesActualizados["Fecha Evaluacion 1"] = nowStr;

            const { error: errUp } = await db
              .from("pedidos_adicionales")
              .update({
                estado: "PENDIENTE GERENCIA",
                ultima_actualizacion: nowStr,
                fecha_aprobacion: nowStr,
                aprobado_por: aprobador,
                detalles: detallesActualizados
              })
              .eq("id_registro", id_registro);

            if (errUp) throw new Error(errUp.message);

            // Enviar correo a GERENCIA e involucrados con el formato de solicitud pendiente de aprobación
            const correos = await obtenerCorreosNotificacion(db, pedido.usuario_solicitante, aprobador, true);
            const detallesHtml = {
              "ID Registro": pedido.id_registro,
              "Tipo Solicitud": `${pedido.tipo_solicitud} - URGENCIA`,
              "Cliente / Destino": pedido.cliente,
              "Pedido / OC": `${detallesActualizados["Pedido"] || "-"} / ${detallesActualizados["OC"] || "-"}`,
              "Valor Total": detallesActualizados["Valor Total"] || detallesActualizados["Valor Venta"] || "-",
              "Costo Flete": costo_flete,
              "Costo / Valor Venta": `<span style="color:#ef4444; font-weight:bold;">${porcentaje_flete} (&gt;= 2%)</span>`,
              "Comentario Aprobador 1": comentario_urgencia,
              "Evaluado por": aprobador,
              "Solicitante": pedido.usuario_solicitante,
              "Fecha": nowStr
            };
            const html = generarHtmlCorreo(
              "Solicitud Pendiente - 2da Aprobación Gerencia",
              "#eab308",
              "La siguiente solicitud de Despacho por Urgencia supera el 2% de relación Costo Flete / Valor Venta y requiere <b>segunda aprobación por parte de Gerencia</b>:",
              detallesHtml,
              "La solicitud se encuentra en estado PENDIENTE GERENCIA en el Sistema Logístico."
            );
            await enviarAlertaCorreo(correos, `Segunda Aprobación Gerencia Requerida "${pedido.tipo_solicitud}" [${pedido.id_registro}]`, html);
            return { ok: true };
          }

          // Caso B: Aprobación Directa (< 2% en Verde o >= 2% en Rojo por Coordinación Interna Aprobador 1 y 2)
          const esCoordinacion = modo === "COORDINACION_INTERNA";
          detallesActualizados["Modo Aprobacion Urgencia"] = esCoordinacion ? "Coordinación Interna (Aprobador 1 y 2)" : "Regular (< 2%)";

          const { error: errUp } = await db
            .from("pedidos_adicionales")
            .update({
              estado: "APROBADO",
              ultima_actualizacion: nowStr,
              fecha_aprobacion: nowStr,
              aprobado_por: aprobador,
              detalles: detallesActualizados
            })
            .eq("id_registro", id_registro);

          if (errUp) throw new Error(errUp.message);

          // Si es por coordinación interna (>= 2%), incluye obligatoriamente a GERENCIA en el correo
          const correos = await obtenerCorreosNotificacion(db, pedido.usuario_solicitante, aprobador, esCoordinacion);
          const detallesHtml = {
            "ID Registro": pedido.id_registro,
            "Tipo Solicitud": `${pedido.tipo_solicitud} - URGENCIA`,
            "Cliente / Destino": pedido.cliente,
            "Valor Total": detallesActualizados["Valor Total"] || detallesActualizados["Valor Venta"] || "-",
            "Costo Flete": costo_flete,
            "Costo / Valor Venta": esCoordinacion
              ? `<span style="color:#ef4444; font-weight:bold;">${porcentaje_flete} (Aprobado por Coordinación Interna)</span>`
              : `<span style="color:#16a34a; font-weight:bold;">${porcentaje_flete} (&lt; 2%)</span>`,
            "Estatus": "Aprobado",
            "Aprobado por": aprobador,
            "Fecha Aprobación": nowStr
          };
          if (esCoordinacion && comentario_urgencia) {
            detallesHtml["Comentario Coordinación"] = comentario_urgencia;
          }

          const html = generarHtmlCorreo(
            "Solicitud Aprobada",
            "#22c55e",
            `Nos complace informarle que su solicitud <b>${pedido.id_registro}</b> ha sido <b>aprobado exitosamente</b>.`,
            detallesHtml,
            "La solicitud ha sido aprobado en el sistema."
          );
          await enviarAlertaCorreo(correos, `[EXTERNAL] Solicitud "${pedido.tipo_solicitud}" Aprobada [${pedido.id_registro}]`, html);
          return { ok: true };
        }

        // ==========================================
        // 6. RECHAZO DE PEDIDOS (NUEVO)
        // ==========================================
        case "rechazarPedidosAdicionales": {
          const idsToReject = payload.ids || payload;
          const comentarioRechazo = payload.comentario || "";

          if (!Array.isArray(idsToReject) || idsToReject.length === 0) {
            throw new Error("Debe seleccionar al menos un registro para rechazar.");
          }
          
          const user = JSON.parse(localStorage.getItem("authUser") || "{}");
          const aprobador = user.nombre || user.email || "Usuario";
          const nowStr = formatLocalNowApi();
          
          const { error } = await db
            .from("pedidos_adicionales")
            .update({ 
              estado: "RECHAZADO", 
              ultima_actualizacion: nowStr,
              fecha_aprobacion: nowStr, 
              aprobado_por: aprobador,
              comentario_rechazo: comentarioRechazo
            })
            .in("id_registro", idsToReject);

          if (error) throw new Error(error.message);

          // ENVIAR ALERTA DE RECHAZO (ROJO CLARO)
          const { data: pedidosRechazados } = await db.from("pedidos_adicionales").select("*").in("id_registro", idsToReject);
          if (pedidosRechazados) {
            for (const p of pedidosRechazados) {
              const correos = await obtenerCorreosNotificacion(db, p.usuario_solicitante, aprobador);
              const detallesHtml = {
                "ID Registro": p.id_registro,
                "Tipo Solicitud": p.tipo_solicitud,
                "Estatus": "Rechazado",
                "Motivo": `<span style="color:#ef4444; font-weight:bold;">${comentarioRechazo}</span>`,
                "Rechazado por": aprobador,
                "Fecha Rechazo": nowStr
              };
              const html = generarHtmlCorreo(
                "Solicitud Rechazada", 
                "#ef4444", 
                `Le informamos que su solicitud <b>${p.id_registro}</b> ha sido revisado por el equipo y se ha determinado su <b>rechazo</b>.`, 
                detallesHtml, 
                "Si requiere más información sobre los motivos de esta decisión, por favor póngase en contacto con el equipo de operaciones."
              );
              await enviarAlertaCorreo(correos, `[EXTERNAL] Solicitud "${p.tipo_solicitud}" Rechazada [${p.id_registro}]`, html);
            }
          }

          return { ok: true, count: idsToReject.length };
        }

        default:
          throw new Error(`Acción no implementada todavía: ${action}`);
      }
    } catch (err) {
      console.error("Error en apiPost:", err);
      return { ok: false, message: err.message || "Error interno de la base de datos." };
    }
  }

  async function apiGet() {
    throw new Error("apiGet ya no se usa con Supabase.");
  }

  window.apiPost = apiPost;
  window.apiGet = apiGet;
})();