document.addEventListener("DOMContentLoaded", () => {
  const usuarioInput = document.getElementById("usuario");
  const vistaUsuario = document.getElementById("vistaUsuario");
  const fotoUsuario = document.getElementById("fotoUsuario");
  const nombreUsuario = document.getElementById("nombreUsuario");
  const rolUsuario = document.getElementById("rolUsuario");
  const estadoValidacion = document.getElementById("estadoValidacion");
  const textoValidacion = document.getElementById("textoValidacion");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");
  const seccionPassword = document.getElementById("seccionPassword");
  const btnIngresar = loginForm.querySelector("button[type='submit']");
  const customAlert = document.getElementById("customAlert");
  const customAlertTitle = document.getElementById("customAlertTitle");
  const customAlertMessage = document.getElementById("customAlertMessage");
  const customAlertBtn = document.getElementById("customAlertBtn");

  const FOTO_PLACEHOLDER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="16" fill="#e2e8f0"/>
        <circle cx="60" cy="42" r="22" fill="#94a3b8"/>
        <path d="M22 101c7-18 22-28 38-28s31 10 38 28" fill="#94a3b8"/>
      </svg>
    `);

  if (getToken()) {
    window.location.replace(getMenuUrl());
    return;
  }

  function mostrarAlertaBonita(mensaje, titulo = "Aviso") {
    customAlertTitle.textContent = titulo;
    customAlertMessage.textContent = mensaje;
    customAlert.classList.remove("oculto");
  }

  function cerrarAlertaBonita() {
    customAlert.classList.add("oculto");
  }

  function mostrarSpinner(texto) {
    textoValidacion.textContent = texto || "Validando usuario...";
    estadoValidacion.classList.remove("oculto");
  }

  function ocultarSpinner() {
    estadoValidacion.classList.add("oculto");
  }

  function ocultarPassword() {
    seccionPassword.classList.add("oculto");
    passwordInput.value = "";
  }

  function mostrarPassword() {
    seccionPassword.classList.remove("oculto");
    setTimeout(() => passwordInput.focus(), 80);
  }

  function resetVista() {
    vistaUsuario.classList.add("oculto");
    vistaUsuario.classList.remove("error-usuario");
    nombreUsuario.textContent = "Usuario detectado";
    rolUsuario.textContent = "";
    fotoUsuario.src = "";
    fotoUsuario.style.display = "none";
    ocultarSpinner();
    ocultarPassword();
  }

  function cargarFotoRobusta(user) {
    return new Promise((resolve) => {
      const fuentes = [
        user?.fotoDataUrl,
        user?.fotoWeb,
        user?.foto
      ]
        .map((v) => String(v || "").trim())
        .filter(Boolean);

      if (!fuentes.length) {
        fotoUsuario.src = FOTO_PLACEHOLDER;
        fotoUsuario.style.display = "block";
        resolve();
        return;
      }

      let index = 0;

      function intentar(src) {
        fotoUsuario.onload = () => {
          fotoUsuario.style.display = "block";
          resolve();
        };

        fotoUsuario.onerror = () => {
          index++;

          if (index < fuentes.length) {
            intentar(fuentes[index]);
          } else {
            fotoUsuario.src = FOTO_PLACEHOLDER;
            fotoUsuario.style.display = "block";
            resolve();
          }
        };

        fotoUsuario.src = src;
      }

      intentar(fuentes[index]);
    });
  }

  function setBotonLoading(loading) {
    btnIngresar.disabled = loading;
    btnIngresar.textContent = loading ? "Ingresando..." : "Ingresar";
    btnIngresar.classList.toggle("btn-cargando", loading);
  }

  customAlertBtn?.addEventListener("click", cerrarAlertaBonita);

  customAlert?.addEventListener("click", (e) => {
    if (e.target === customAlert) {
      cerrarAlertaBonita();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !customAlert.classList.contains("oculto")) {
      cerrarAlertaBonita();
    }
  });

  usuarioInput.addEventListener("input", () => {
    const usuario = usuarioInput.value.trim();

    if (!usuario) {
      resetVista();
      return;
    }

    ocultarPassword();
  });

  usuarioInput.addEventListener("blur", async () => {
    const usuario = usuarioInput.value.trim();

    if (!usuario) {
      resetVista();
      return;
    }

    mostrarSpinner("Buscando usuario...");

    try {
      const result = await apiPost("validarUsuario", {
        usuario
      });

      ocultarSpinner();

      if (!result.found || !result.user) {
        vistaUsuario.classList.remove("oculto");
        vistaUsuario.classList.add("error-usuario");
        fotoUsuario.src = FOTO_PLACEHOLDER;
        fotoUsuario.style.display = "block";
        nombreUsuario.textContent = "Usuario no encontrado";
        rolUsuario.textContent = "Verifique el usuario ingresado";
        ocultarPassword();
        return;
      }

      const user = result.user;

      vistaUsuario.classList.remove("oculto");
      vistaUsuario.classList.remove("error-usuario");

      nombreUsuario.textContent = user.nombre || user.usuario || usuario;
      rolUsuario.textContent = user.cargo || user.rol || "Usuario";

      await cargarFotoRobusta(user);
      mostrarPassword();

    } catch (error) {
      console.error("Error validando usuario:", error);

      ocultarSpinner();

      vistaUsuario.classList.remove("oculto");
      vistaUsuario.classList.add("error-usuario");

      fotoUsuario.src = FOTO_PLACEHOLDER;
      fotoUsuario.style.display = "block";

      nombreUsuario.textContent = "Usuario no encontrado";
      rolUsuario.textContent = error.message || "Verifique el usuario ingresado";

      ocultarPassword();
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = usuarioInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      mostrarAlertaBonita("Ingrese usuario y contraseña.", "Campos requeridos");
      return;
    }

    if (seccionPassword.classList.contains("oculto")) {
      mostrarAlertaBonita("Primero valide el usuario saliendo del campo.", "Validación");
      return;
    }

    setBotonLoading(true);

    try {
      const data = await apiPost("login", {
        username,
        password
      });

      saveSession(data);
      window.location.replace(getMenuUrl());

    } catch (error) {
      console.error("Error login:", error);

      mostrarAlertaBonita(
        error.message || "No se pudo iniciar sesión.",
        "Acceso denegado"
      );

      passwordInput.focus();
      passwordInput.select();

    } finally {
      setBotonLoading(false);
    }
  });
});
