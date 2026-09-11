// js/api.js

// 1. CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://onlvwhmbytgrkqqfqpib.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubHZ3aG1ieXRncmtxcWZxcGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDg2MTIsImV4cCI6MjEwNDcyNDYxMn0.xycA65ZNrqGHHjiS4fLuDM89N6bj3Qi2B7wh-Y-xsh4";

// 2. Inicializamos el cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function validateApiUrl_() {
  if (!SUPABASE_URL) {
    throw new Error("Configure las credenciales de Supabase en js/api.js");
  }
}

// 3. Lógica de conexión a Supabase
async function apiPost(action, payload = {}) {
  validateApiUrl_();
  
  try {
    switch (action) {
      
      // --- LÓGICA DE LOGIN ---
      case 'validarUsuario':
      case 'login': {
        const usuarioInput = payload.usuario || payload.username;
        const claveInput = payload.password;

        // Buscamos al usuario en la tabla 'planilla'
        const { data: userRow, error } = await supabase
          .from('planilla')
          .select('*')
          .eq('usuario', usuarioInput)
          .single(); // Esperamos encontrar solo 1 registro

        if (error || !userRow) {
          throw new Error('Usuario no encontrado.');
        }

        // Si es acción de login (cuando el usuario hace clic en "Ingresar"), validamos la clave
        if (action === 'login' && userRow.password !== claveInput) {
          throw new Error('Contraseña incorrecta.');
        }

        // Construimos el objeto de usuario (para que login.js lo lea tal como lo hacía antes)
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

        // Si es solo validación (al salir del campo de texto)
        if (action === 'validarUsuario') {
          return { found: true, user: user };
        }

        // Si es login exitoso, devolvemos el token (tu auth.js ya se encarga de guardar esto)
        const token = 'token_' + Date.now();
        const session = {
          token: token,
          ...user,
          loginAt: new Date().toISOString()
        };

        return {
          token: token,
          user: user,
          session: session
        };
      }

      // --- MANTENER LA SESIÓN ---
      case 'getSesion': {
        const token = payload.token;
        if (!token) throw new Error('Sesión inválida');
        // Por ahora, asumimos que si hay token en el navegador (auth.js), la sesión es válida.
        return { session: true }; 
      }

      default:
        throw new Error('Acción no migrada todavía a Supabase: ' + action);
    }
  } catch (err) {
    throw new Error(err.message || 'Error interno de la base de datos.');
  }
}

// Ya no necesitamos la función apiGet porque Supabase usa su propia librería,
// pero la dejamos vacía por si algún otro archivo tuyo la intentaba llamar.
async function apiGet(params = {}) {
  throw new Error("apiGet ya no se usa con Supabase.");
}
