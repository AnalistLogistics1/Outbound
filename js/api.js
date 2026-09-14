// js/api.js

const SUPABASE_URL = "https://onlvwhmbytgrkqqfqpib.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubHZ3aG1ieXRncmtxcWZxcGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDg2MTIsImV4cCI6MjEwNDcyNDYxMn0.xycA65ZNrqGHHjiS4fLuDM89N6bj3Qi2B7wh-Y-xsh4";

// Usamos supabaseApp para evitar el choque con la librería global
const supabaseApp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function validateApiUrl_() {
  if (!SUPABASE_URL) {
    throw new Error("Configure las credenciales de Supabase en js/api.js");
  }
}

async function apiPost(action, payload = {}) {
  validateApiUrl_();
  
  try {
    switch (action) {
      
      // ==========================================
      // 1. MÓDULO DE LOGIN
      // ==========================================
      case 'validarUsuario':
      case 'login': {
        const usuarioInput = payload.usuario || payload.username;
        const claveInput = payload.password;

        const { data: userRow, error } = await supabaseApp
          .from('planilla')
          .select('*')
          .ilike('usuario', usuarioInput)
          .single();

        if (error || !userRow) {
          throw new Error('Usuario no encontrado.');
        }

        if (action === 'login' && String(userRow.password) !== String(claveInput)) {
          throw new Error('Contraseña incorrecta.');
        }

        const user = {
          usuario: userRow.usuario, 
          username: userRow.usuario,
          nombre: userRow.nombre,
          rol: userRow.rol || userRow.cargo || 'USUARIO',
          cargo: userRow.cargo || userRow.rol || 'USUARIO',
          area: userRow.area || '',
          foto: userRow.foto || '', 
          fotoWeb: userRow.foto || ''
        };

        if (action === 'validarUsuario') {
          return { found: true, user: user };
        }

        const token = 'token_' + Date.now();
        return {
          token: token, 
          user: user,
          session: { token: token, ...user, loginAt: new Date().toISOString() }
        };
      }

      case 'getSesion': {
        const token = payload.token;
        if (!token) throw new Error('Sesión inválida');
        return { session: true }; 
      }

      case 'logout': {
        return { closed: true };
      }


      // ==========================================
      // 2. MÓDULO TOMA DE LOTES
      // ==========================================
      case 'getLotesMeta': {
        const { data: clientesData, error: errC } = await supabaseApp.from('maestros_clientes').select('*');
        const { data: camposData, error: errF } = await supabaseApp.from('maestros_campos').select('*');
        
        if (errC || errF) throw new Error('Error cargando maestros de lotes.');

        let clientesUnicos = new Set();
        let config = {};
        let groups = {};

        ["PRIORIZADOS_1", "PRIORIZADOS_2", "PRIORIZADOS_3"].forEach(key => {
            groups[key] = { key: key, label: key.replace("_", " "), sheetName: `lotes_${key.toLowerCase()}`, clientes: [], campos: [], storageFields: [] };
        });

        clientesData.forEach(row => {
            const cliente = row.cliente;
            const grupo = row.grupo_key;
            clientesUnicos.add(cliente);
            if(groups[grupo]) {
                if(!groups[grupo].clientes.includes(cliente)) groups[grupo].clientes.push(cliente);
            }
            config[cliente] = { cliente: cliente, groupKey: grupo, sheetName: `lotes_${grupo.toLowerCase()}`, campos: [], storageFields: [] };
        });

        camposData.forEach(row => {
            const grupo = row.grupo_key;
            const campo = row.campo;
            if (groups[grupo]) {
                if(!groups[grupo].campos.includes(campo)) groups[grupo].campos.push(campo);
                if(!groups[grupo].storageFields.includes(campo)) groups[grupo].storageFields.push(campo);
            }
        });

        Object.keys(config).forEach(c => {
            let g = config[c].groupKey;
            config[c].campos = groups[g].campos;
            config[c].storageFields = groups[g].storageFields;
        });

        return {
            clientes: Array.from(clientesUnicos).sort(),
            config: config,
            groups: groups,
            serverNow: new Date().toISOString()
        };
      }

      case 'listLoteRecords': {
        const tablas = ['lotes_priorizados_1', 'lotes_priorizados_2', 'lotes_priorizados_3'];
        let todosLosRegistros = [];

        for (const tabla of tablas) {
            let query = supabaseApp.from(tabla).select('*');
            if (payload.cliente) query = query.ilike('cliente', `%${payload.cliente}%`);
            if (payload.estado) query = query.ilike('estado', `%${payload.estado}%`);
            if (payload.fecha) query = query.ilike('fecha_registro', `${payload.fecha}%`);

            const { data, error } = await query;
            if (!error && data) {
                const registrosFormateados = data.map(r => {
                    let datosExtra = {};
                    Object.keys(r).forEach(k => {
                        if (!['id_registro', 'fecha_registro', 'cliente', 'usuario_login', 'nombre_usuario', 'rol_usuario', 'estado', 'comentario', 'ultima_actualizacion'].includes(k)) {
                            datosExtra[k] = r[k] || "";
                        }
                    });

                    return {
                        id: r.id_registro,
                        fecha: r.fecha_registro,
                        cliente: r.cliente,
                        grupo: tabla.toUpperCase(),
                        groupKey: tabla.toUpperCase().replace("LOTES_", ""),
                        sheetName: tabla,
                        usuario: r.usuario_login,
                        nombre: r.nombre_usuario,
                        rol: r.rol_usuario,
                        estado: r.estado,
                        comentario: r.comentario,
                        actualizado: r.ultima_actualizacion,
                        datos: datosExtra,
                        campos: datosExtra
                    };
                });
                todosLosRegistros = todosLosRegistros.concat(registrosFormateados);
            }
        }
        return { rows: todosLosRegistros };
      }


      // ==========================================
      // 3. MÓDULO DE CHECKLISTS
      // ==========================================
      case 'getChecklistMeta': {
        throw new Error("Usar metadata local"); 
      }

      case 'exportChecklistData': {
        const { data: insumos } = await supabaseApp.from('checklist_insumos').select('*');
        const { data: areas } = await supabaseApp.from('checklist_area').select('*');

        const objToArray = (dataArray) => {
            if (!dataArray || dataArray.length === 0) return [];
            const headers = Object.keys(dataArray[0]);
            return [headers, ...dataArray.map(row => headers.map(h => row[h] || ""))];
        };

        return {
            insumos: objToArray(insumos),
            area: objToArray(areas)
        };
      }

      default:
        throw new Error('Acción no implementada todavía: ' + action);
    }
  } catch (err) {
    throw new Error(err.message || 'Error interno de la base de datos.');
  }
}

async function apiGet(params = {}) {
  throw new Error("apiGet ya no se usa con Supabase.");
}
