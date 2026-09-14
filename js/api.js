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

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
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

          if (!usuarioInput) {
            throw new Error("Ingrese un usuario.");
          }

          const { data: userRow, error } = await db
            .from("PLANILLA") 
            .select("*")
            .ilike("email", usuarioInput) 
            .limit(1)
            .maybeSingle();

          if (error) {
            throw new Error(error.message || "Error consultando el usuario.");
          }

          if (!userRow) {
            throw new Error("Usuario no encontrado.");
          }

          if (action === "login" && String(userRow.clave) !== String(claveInput)) {
            throw new Error("Contraseña incorrecta.");
          }

          // AQUI ESTÁ EL CAMBIO PRINCIPAL: Mapeo exacto con tus columnas
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

          if (action === "validarUsuario") {
            return {
              found: true,
              user
            };
          }

          const token = "token_" + Date.now();

          return {
            token,
            user,
            session: {
              token,
              ...user,
              loginAt: new Date().toISOString()
            }
          };
        }

        case "getSesion": {
          const token = payload.token;

          if (!token) {
            throw new Error("Sesión inválida");
          }

          return {
            session: true
          };
        }

        case "logout": {
          return {
            closed: true
          };
        }

        // ==========================================
        // 2. MÓDULO TOMA DE LOTES
        // ==========================================
        case "getLotesMeta": {
          const { data: clientesData, error: errClientes } = await db
            .from("maestros_clientes")
            .select("*");

          const { data: camposData, error: errCampos } = await db
            .from("maestros_campos")
            .select("*");

          if (errClientes || errCampos) {
            throw new Error("Error cargando maestros de lotes.");
          }

          const clientesUnicos = new Set();
          const config = {};
          const groups = {};

          ["PRIORIZADOS_1", "PRIORIZADOS_2", "PRIORIZADOS_3"].forEach((key) => {
            groups[key] = {
              key,
              label: key.replace(/_/g, " "),
              sheetName: `lotes_${key.toLowerCase()}`,
              clientes: [],
              campos: [],
              storageFields: []
            };
          });

          (clientesData || []).forEach((row) => {
            const cliente = textValue(row.cliente);
            const grupo = normalizeGroupKey(row.grupo_key);

            if (!cliente || !groups[grupo]) {
              return;
            }

            clientesUnicos.add(cliente);

            if (!groups[grupo].clientes.includes(cliente)) {
              groups[grupo].clientes.push(cliente);
            }

            config[cliente] = {
              cliente,
              groupKey: grupo,
              sheetName: `lotes_${grupo.toLowerCase()}`,
              campos: [],
              storageFields: []
            };
          });

          (camposData || []).forEach((row) => {
            const grupo = normalizeGroupKey(row.grupo_key);
            const campo = textValue(row.campo);

            if (!campo || !groups[grupo]) {
              return;
            }

            if (!groups[grupo].campos.includes(campo)) {
              groups[grupo].campos.push(campo);
            }

            if (!groups[grupo].storageFields.includes(campo)) {
              groups[grupo].storageFields.push(campo);
            }
          });

          Object.keys(config).forEach((cliente) => {
            const groupKey = config[cliente].groupKey;

            config[cliente].campos = groups[groupKey].campos;
            config[cliente].storageFields = groups[groupKey].storageFields;
          });

          return {
            clientes: Array.from(clientesUnicos).sort(),
            config,
            groups,
            serverNow: new Date().toISOString()
          };
        }

        case "listLoteRecords": {
          let rows = [];

          for (const item of LOTES_TABLES) {
            let query = db.from(item.table).select("*");

            if (payload.cliente) {
              query = query.ilike("cliente", `%${payload.cliente}%`);
            }

            if (payload.estado) {
              query = query.ilike("estado", `%${payload.estado}%`);
            }

            if (payload.fecha) {
              const fecha = String(payload.fecha).slice(0, 10);
              const fechaSiguiente = getNextDate(fecha);

              if (fechaSiguiente) {
                query = query
                  .gte("fecha_registro", fecha)
                  .lt("fecha_registro", fechaSiguiente);
              }
            }

            const { data, error } = await query;

            if (error) {
              console.warn(`Error consultando ${item.table}:`, error.message);
              continue;
            }

            const formattedRows = (data || []).map((row) =>
              formatLoteRecord(row, item.table, item.groupKey)
            );

            rows = rows.concat(formattedRows);
          }

          return {
            rows
          };
        }

        // ==========================================
        // 3. MÓDULO DE CHECKLISTS
        // ==========================================
        case "getChecklistMeta": {
          throw new Error("Usar metadata local");
        }

        case "exportChecklistData": {
          const { data: insumos, error: errInsumos } = await db
            .from("checklist_insumos")
            .select("*");

          const { data: areas, error: errAreas } = await db
            .from("checklist_area")
            .select("*");

          if (errInsumos || errAreas) {
            throw new Error("Error exportando información de checklist.");
          }

          const objToArray = function (dataArray) {
            if (!dataArray || dataArray.length === 0) {
              return [];
            }

            const headers = Object.keys(dataArray[0]);

            return [
              headers,
              ...dataArray.map((row) => headers.map((header) => row[header] || ""))
            ];
          };

          return {
            insumos: objToArray(insumos),
            area: objToArray(areas)
          };
        }

        default:
          throw new Error("Acción no implementada todavía: " + action);
      }
    } catch (err) {
      throw new Error(err.message || "Error interno de la base de datos.");
    }
  }

  async function apiGet() {
    throw new Error("apiGet ya no se usa con Supabase.");
  }

  window.apiPost = apiPost;
  window.apiGet = apiGet;
})();
