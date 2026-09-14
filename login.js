// login.js
(function () {
  "use strict";

  const el = {};
  let currentUser = null;
  let validateTimer = null;
  let validationSequence = 0;

  document.addEventListener("DOMContentLoaded", initLogin);

  function initLogin() {
    el.form = document.getElementById("loginForm");
    el.usuario = document.getElementById("usuario");
    el.password = document.getElementById("password");
    el.seccionPassword = document.getElementById("seccionPassword");

    el.estadoValidacion = document.getElementById("estadoValidacion");
    el.textoValidacion = document.getElementById("textoValidacion");

    el.vistaUsuario = document.getElementById("vistaUsuario");
    el.fotoUsuario = document.getElementById("fotoUsuario");
    el.nombreUsuario = document.getElementById("nombreUsuario");
    el.rolUsuario = document.getElementById("rolUsuario");

    el.customAlert = document.getElementById("customAlert");
    el.customAlertTitle = document.getElementById("customAlertTitle");
    el.customAlertMessage = document.getElementById("customAlertMessage");
    el.customAlertBtn = document.getElementById("customAlertBtn");

    if (!el.form || !el.usuario || !el.password) {
      console.error("No se encontraron los elementos principales del login.");
      return;
    }

    if (typeof window.apiPost !== "function") {
      showAlert("Error de configuración", "No se cargó correctamente js/api.js.");
      return;
    }

    if (typeof window.getToken === "function" && window.getToken()) {
      window.location.replace(getSafeMenuUrl());
      return;
    }

    resetLoginView();

    el.usuario.addEventListener("input", handleUsuarioInput);
    el.usuario.addEventListener("blur", function () {
      validateUser(false);
    });

    el.usuario.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && isHidden(el.seccionPassword)) {
        event.preventDefault();
        validateUser(true);
      }
    });

    el.form.addEventListener("submit", handleLoginSubmit);

    if (el.customAlertBtn) {
      el.customAlertBtn.addEventListener("click", hideAlert);
    }

    if (el.customAlert) {
      el.customAlert.addEventListener("click", function (event) {
        if (event.target === el.customAlert) {
          hideAlert();
        }
      });
    }
  }

  function getSafeMenuUrl() {
    if (typeof window.getMenuUrl === "function") {
      return window.getMenuUrl();
    }

    return "./Menu-Opciones/menu.html";
  }

  function show(element) {
    if (element) {
      element.classList.remove("oculto");
    }
  }

  function hide(element) {
    if (element) {
      element.classList.add("oculto");
    }
  }

  function isHidden(element) {
    return !element || element.classList.contains("oculto");
  }

  function showValidation(message) {
    if (el.textoValidacion) {
      el.textoValidacion.textContent = message;
    }

    show(el.estadoValidacion);
  }

  function hideValidation() {
    hide(el.estadoValidacion);
  }

  function resetLoginView() {
    currentUser = null;

    hideValidation();
    hide(el.vistaUsuario);
    hide(el.seccionPassword);

    if (el.password) {
      el.password.value = "";
    }

    if (el.fotoUsuario) {
      el.fotoUsuario.removeAttribute("src");
      el.fotoUsuario.style.display = "none";
    }

    if (el.nombreUsuario) {
      el.nombreUsuario.textContent = "Usuario detectado";
    }

    if (el.rolUsuario) {
      el.rolUsuario.textContent = "";
    }
  }

  function handleUsuarioInput() {
    clearTimeout(validateTimer);

    currentUser = null;
    hide(el.vistaUsuario);
    hide(el.seccionPassword);

    if (el.password) {
      el.password.value = "";
    }

    const usuario = el.usuario.value.trim();

    if (usuario.length < 2) {
      hideValidation();
      return;
    }

    showValidation("Validando usuario...");

    validateTimer = setTimeout(function () {
      validateUser(false);
    }, 500);
  }

  async function validateUser(showErrors) {
    clearTimeout(validateTimer);

    const usuario = el.usuario.value.trim();

    if (!usuario) {
      resetLoginView();
      return null;
    }

    const sequence = ++validationSequence;

    try {
      showValidation("Validando usuario...");

      const response = await window.apiPost("validarUsuario", {
        usuario
      });

      if (sequence !== validationSequence) {
        return null;
      }

      if (!response || !response.user) {
        throw new Error("Usuario no encontrado.");
      }

      currentUser = response.user;
      renderUser(currentUser);

      hideValidation();
      show(el.vistaUsuario);
      show(el.seccionPassword);

      setTimeout(function () {
        el.password.focus();
      }, 50);

      return currentUser;
    } catch (error) {
      if (sequence !== validationSequence) {
        return null;
      }

      currentUser = null;
      hide(el.vistaUsuario);
      hide(el.seccionPassword);
      showValidation("Usuario no encontrado.");

      if (showErrors) {
        showAlert("Usuario no encontrado", error.message || "Verifique el usuario ingresado.");
      }

      return null;
    }
  }

  function renderUser(user) {
    if (el.nombreUsuario) {
      el.nombreUsuario.textContent = user.nombre || user.usuario || "Usuario";
    }

    if (el.rolUsuario) {
      el.rolUsuario.textContent = user.cargo || user.rol || "USUARIO";
    }

    if (el.fotoUsuario) {
      const foto = user.fotoWeb || user.foto || "";

      if (foto) {
        el.fotoUsuario.src = foto;
        el.fotoUsuario.style.display = "";
      } else {
        el.fotoUsuario.removeAttribute("src");
        el.fotoUsuario.style.display = "none";
      }
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const usuario = el.usuario.value.trim();
    const password = el.password.value;

    if (!usuario) {
      showAlert("Usuario requerido", "Ingrese su usuario.");
      el.usuario.focus();
      return;
    }

    if (!currentUser || currentUser.usuario?.toLowerCase() !== usuario.toLowerCase()) {
      const validatedUser = await validateUser(true);

      if (!validatedUser) {
        return;
      }
    }

    if (!password) {
      showAlert("Contraseña requerida", "Ingrese su contraseña.");
      el.password.focus();
      return;
    }

    const submitButton = el.form.querySelector('button[type="submit"]');

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Ingresando...";
      }

      const response = await window.apiPost("login", {
        usuario,
        username: usuario,
        password
      });

      if (typeof window.saveSession !== "function") {
        throw new Error("No se cargó correctamente js/auth.js.");
      }

      window.saveSession(response);
      window.location.replace(getSafeMenuUrl());
    } catch (error) {
      showAlert("No se pudo iniciar sesión", error.message || "Verifique sus datos.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Ingresar";
      }
    }
  }

  function showAlert(title, message) {
    if (!el.customAlert) {
      window.alert(`${title}
${message}`);
      return;
    }

    if (el.customAlertTitle) {
      el.customAlertTitle.textContent = title || "Aviso";
    }

    if (el.customAlertMessage) {
      el.customAlertMessage.textContent = message || "";
    }

    show(el.customAlert);
  }

  function hideAlert() {
    hide(el.customAlert);
  }
})();
