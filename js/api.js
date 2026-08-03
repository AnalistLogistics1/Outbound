const API_URL = "https://script.google.com/macros/s/AKfycbzotAO9fQyjdOvXBNGUn3KmeF4oV9y20ocy22G_gsMv65Cj6om_x8bg64uWLUIQuiw6lg/exec";

function validateApiUrl_() {
  if (!API_URL || API_URL.includes("PEGAR_URL_WEBAPP_AQUI")) {
    throw new Error("Configure la constante API_URL en js/api.js");
  }
}

async function parseJsonResponse_(response) {
  let json;
  try {
    json = await response.json();
  } catch (error) {
    throw new Error("Respuesta no válida del servidor.");
  }

  if (!json.ok) {
    throw new Error(json.message || "Error de API");
  }

  return Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json;
}

async function apiPost(action, payload = {}) {
  validateApiUrl_();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...payload
    }),
    cache: "no-store",
    redirect: "follow"
  });

  return await parseJsonResponse_(response);
}

async function apiGet(params = {}) {
  validateApiUrl_();

  const url = new URL(API_URL);
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.set(key, params[key]);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });

  return await parseJsonResponse_(response);
}
