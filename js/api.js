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
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  // Convierte "LOTE 11" a "lote_11" para que coincida con la columna en Supabase
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

  // Helper para generar el ID (LOT-XXXXXX)
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
            throw new Error("Contraseña incorrecta.");
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
              const fecha = String(payload.fecha).slice(0, 10);
              const fechaSiguiente = getNextDate(fecha);
              if (fechaSiguiente) query = query.gte("fecha_registro", fecha).lt("fecha_registro", fechaSiguiente);
            }
            const { data, error } = await query;
            if (error) { console.warn(`Error consultando ${item.table}:`, error.message); continue; }
            const formattedRows = (data || []).map((row) => formatLoteRecord(row, item.table, item.groupKey));
            rows = rows.concat(formattedRows);
          }
          rows.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
          return { ok: true, rows };
        }

// --- NUEVAS FUNCIONES PARA CREAR Y EDITAR REGISTROS ---

        case "createLoteRecord": {
          const { cliente, campos, comentario } = payload;
          if (!cliente) throw new Error("Debe seleccionar un cliente.");

          // Saber en qué tabla va
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

          // Filtramos los campos dinámicos para no intentar insertar columnas que ya manejamos (fecha, usuario, etc.)
          if (campos) {
            Object.keys(campos).forEach(k => {
              const colName = formatColumnName(k);
              if (['fecha', 'usuario', 'cliente', 'comentario', 'estado'].includes(colName)) return; // Ignorar
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

          // Filtramos igual que en la creación
          if (campos) {
            Object.keys(campos).forEach(k => {
              const colName = formatColumnName(k);
              if (['fecha', 'usuario', 'cliente', 'comentario', 'estado'].includes(colName)) return; // Ignorar
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
        case "getChecklistMeta": {
          throw new Error("Usar metadata local");
        }

        case "exportChecklistData": {
          const { data: insumos, error: errInsumos } = await db.from("checklist_insumos").select("*");
          const { data: areas, error: errAreas } = await db.from("checklist_area").select("*");
          if (errInsumos || errAreas) throw new Error("Error exportando información de checklist.");

          const objToArray = function (dataArray) {
            if (!dataArray || dataArray.length === 0) return [];
            const headers = Object.keys(dataArray[0]);
            return [headers, ...dataArray.map((row) => headers.map((header) => row[header] || ""))];
          };

          return { ok: true, insumos: objToArray(insumos), area: objToArray(areas) };
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
