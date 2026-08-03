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
    usuario: user?.username || user?.usuario || "",
    cargo: user?.rol || user?.cargo || "USUARIO",
    nombre: user?.nombre || user?.username || "Usuario"
  };
}

function saveSession(session) {
  const normalizedUser = normalizeAuthUser(session.user || {});

  localStorage.setItem(STORAGE_KEYS.token, session.token || "");
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalizedUser));

  localStorage.setItem("authUser", JSON.stringify(normalizedUser));
  sessionStorage.setItem("authUser", JSON.stringify(normalizedUser));
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || "";
}

function getUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  return raw ? JSON.parse(raw) : null;
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
    if (token) {
      await apiPost("logout", { token });
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
