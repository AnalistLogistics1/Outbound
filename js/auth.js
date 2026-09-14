// js/auth.js
(function () {
  "use strict";

  const STORAGE_KEYS = {
    token: "ct_token",
    user: "ct_user"
  };

  function getProjectContext() {
    const path = window.location.pathname.toLowerCase();
    const inMenuFolder = path.includes("/menu-opciones/");

    return {
      inMenuFolder,
      indexUrl: inMenuFolder ? "../index.html" : "./index.html",
      menuUrl: inMenuFolder ? "./menu.html" : "./Menu-Opciones/menu.html"
    };
  }

  function getIndexUrl() {
    return getProjectContext().indexUrl;
  }

  function getMenuUrl() {
    return getProjectContext().menuUrl;
  }

  function normalizeAuthUser(user) {
    return {
      ...user,
      usuario: user?.usuario || user?.username || "",
      username: user?.username || user?.usuario || "",
      cargo: user?.cargo || user?.rol || "USUARIO",
      rol: user?.rol || user?.cargo || "USUARIO",
      nombre: user?.nombre || user?.username || user?.usuario || "Usuario",
      area: user?.area || "",
      foto: user?.foto || "",
      fotoWeb: user?.fotoWeb || user?.foto || ""
    };
  }

  function saveSession(session) {
    const token = session?.token || session?.session?.token || "";
    const normalizedUser = normalizeAuthUser(session?.user || session?.session || {});

    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizedUser));

    localStorage.setItem("authUser", JSON.stringify(normalizedUser));
    sessionStorage.setItem("authUser", JSON.stringify(normalizedUser));
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || "";
  }

  function getUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.user);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("No se pudo leer el usuario guardado:", error);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authUser");
  }

  async function logout() {
    const token = getToken();

    try {
      if (token && typeof window.apiPost === "function") {
        await window.apiPost("logout", { token });
      }
    } catch (error) {
      console.error("No se pudo cerrar sesión en servidor:", error);
    } finally {
      clearSession();
      window.location.replace(getIndexUrl());
    }
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.replace(getIndexUrl());
    }
  }

  window.getProjectContext = getProjectContext;
  window.getIndexUrl = getIndexUrl;
  window.getMenuUrl = getMenuUrl;
  window.normalizeAuthUser = normalizeAuthUser;
  window.saveSession = saveSession;
  window.getToken = getToken;
  window.getUser = getUser;
  window.clearSession = clearSession;
  window.logout = logout;
  window.requireAuth = requireAuth;

  // --- AÑADIR ESTO AL FINAL DE AUTH.JS ---
  
  function convertirLinkDrive(url) {
    if (typeof url !== "string" || !url) return "";
    const urlLimpia = url.trim();
    const driveRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = urlLimpia.match(driveRegex);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return urlLimpia;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user) return;

    // 1. Actualizar textos de la cabecera (Nombre y Cargo)
    // Busca cualquier elemento HTML que contenga el nombre anterior y lo actualiza
    const headerNameElems = document.querySelectorAll('.header-user-name, .user-name'); 
    const headerRoleElems = document.querySelectorAll('.header-user-role, .user-role'); 
    
    headerNameElems.forEach(el => el.textContent = user.nombre || "Usuario");
    headerRoleElems.forEach(el => el.textContent = (user.cargo || user.rol || "USUARIO").toUpperCase());

    // 2. Reemplazar el círculo "CC" con la foto real del usuario
    // Suponiendo que el círculo del avatar tiene una clase como .avatar o .user-avatar
    const avatarContainers = document.querySelectorAll('.avatar, .user-avatar, .header-avatar');
    
    const fotoUrl = convertirLinkDrive(user.fotoWeb || user.foto);
    
    if (fotoUrl && avatarContainers.length > 0) {
      avatarContainers.forEach(container => {
        // Vaciamos el "CC"
        container.textContent = ""; 
        // Creamos la imagen
        const img = document.createElement("img");
        img.src = fotoUrl;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.borderRadius = "50%";
        img.style.objectFit = "cover";
        
        container.appendChild(img);
      });
    }
  });
})();
