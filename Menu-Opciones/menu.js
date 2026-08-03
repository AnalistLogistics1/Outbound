document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const user = getUser();

  const heroLeft = document.getElementById("heroLeft");
  const heroRight = document.getElementById("heroRight");
  const heroScene = document.getElementById("heroScene");
  const heroSceneMini = document.getElementById("heroSceneMini");
  const heroShift = document.getElementById("heroShift");
  const mensajeBienvenida = document.getElementById("mensajeBienvenida");
  const mensajeDescripcion = document.getElementById("mensajeDescripcion");
  const heroPerfil = document.getElementById("heroPerfil");
  const heroTotalApps = document.getElementById("heroTotalApps");
  const heroFechaCorta = document.getElementById("heroFechaCorta");
  const heroFechaLarga = document.getElementById("heroFechaLarga");
  const heroHora = document.getElementById("heroHora");
  const heroSaludo = document.getElementById("heroSaludo");
  const appsGrid = document.getElementById("appsGrid");

  function resolveAsset(path) {
    return new URL(path, window.location.href).href;
  }

  function createThumb(label, color1, color2, subtitle) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${color1}"/>
            <stop offset="100%" stop-color="${color2}"/>
          </linearGradient>
        </defs>
        <rect width="600" height="600" rx="48" fill="url(#g)"/>
        <circle cx="470" cy="130" r="90" fill="rgba(255,255,255,0.14)"/>
        <circle cx="130" cy="480" r="120" fill="rgba(255,255,255,0.10)"/>
        <text x="60" y="230" fill="#ffffff" font-family="Segoe UI, Arial" font-size="120" font-weight="700">${label}</text>
        <text x="60" y="320" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Arial" font-size="34">${subtitle}</text>
      </svg>
    `;

    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  const apps = [
    {
      title: "Toma de Lotes",
      desc: "Registro y seguimiento logístico de lotes por cliente.",
      pill: "Módulo activo",
      accent: "accent-blue",
      image: resolveAsset("../img/toma-lotes.jpg"),
      fallback: createThumb("TL", "#0f4c81", "#38bdf8", "Toma de lotes"),
      icon: "TL",
      url: "../toma-lotes.html"
    }
  ];

  mensajeBienvenida.textContent = `Hola, ${user?.nombre || user?.username || user?.usuario || "Usuario"}.`;
  mensajeDescripcion.textContent = "Seleccione el módulo que desea utilizar hoy.";
  heroPerfil.textContent = (user?.rol || user?.cargo || "USUARIO").toUpperCase();
  heroTotalApps.textContent = `${apps.length} módulo${apps.length === 1 ? "" : "s"}`;

  function renderApps() {
    appsGrid.innerHTML = "";

    apps.forEach((app) => {
      const card = document.createElement("article");
      card.className = `app-card ${app.accent}${app.url === "#" ? " is-disabled" : ""}`;

      card.innerHTML = `
        <div class="app-media">
          <img src="${app.image}" alt="${app.title}">
          <div class="app-media-overlay"></div>
        </div>

        <div class="app-card-body">
          <span class="app-pill">${app.pill}</span>
          <h3>${app.title}</h3>
          <p>${app.desc}</p>

          <div class="app-card-bottom">
            <span>${app.url === "#" ? "Disponible pronto" : "Ingresar"}</span>
            <span>→</span>
          </div>
        </div>
      `;

      const img = card.querySelector("img");

      img.addEventListener("load", () => {
        console.log("Imagen cargada:", app.image);
      });

      img.addEventListener("error", () => {
        console.warn("No se pudo cargar la imagen, se usará fallback:", app.image);
        img.src = app.fallback;
      });

      if (app.url !== "#") {
        card.addEventListener("click", () => {
          window.location.href = app.url;
        });
      }

      appsGrid.appendChild(card);
    });
  }

  function updateClock() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    let theme = "theme-dia";
    let icon = "☀️";
    let saludo = "Buenos días";

    if (hour >= 18) {
      theme = "theme-noche";
      icon = "🌙";
      saludo = "Buenas noches";
    } else if (hour >= 12) {
      theme = "theme-tarde";
      icon = "🌤️";
      saludo = "Buenas tardes";
    }

    heroLeft.className = `hero-left ${theme}`;
    heroRight.className = `hero-right ${theme}`;
    heroScene.textContent = icon;
    heroSceneMini.textContent = icon;
    heroShift.textContent = saludo;
    heroSaludo.textContent = `${saludo}, bienvenido al sistema`;

    const dias = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado"
    ];

    const meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre"
    ];

    heroFechaCorta.textContent = dias[now.getDay()];
    heroFechaLarga.textContent = `${String(now.getDate()).padStart(2, "0")} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
    heroHora.textContent = now.toLocaleTimeString("es-PE");

    const hourDeg = ((hour % 12) + minute / 60) * 30;
    const minuteDeg = (minute + second / 60) * 6;
    const secondDeg = second * 6;

    const hourHand = document.getElementById("hourHand");
    const minuteHand = document.getElementById("minuteHand");
    const secondHand = document.getElementById("secondHand");

    if (hourHand) {
      hourHand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
    }

    if (minuteHand) {
      minuteHand.style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
    }

    if (secondHand) {
      secondHand.style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
    }
  }

  renderApps();
  updateClock();
  setInterval(updateClock, 1000);
});
