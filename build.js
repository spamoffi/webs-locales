#!/usr/bin/env node
// Genera webs estáticas de locales a partir de datos.json (sin dependencias).
// Uso: node build.js  ->  resultado en dist/
//
// - Si locales/ contiene UN local (caso normal en una rama local/<nombre>), su web va en la raíz de dist/.
// - Si contiene varios, cada uno va en dist/<carpeta>/ con un índice.
// - Si no contiene ninguno (rama main), se generan los ejemplos de ejemplos/ como escaparate.
const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;
const DIST = path.join(RAIZ, "dist");

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIAS_TXT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Cada sector ajusta el tipo de negocio que ve Google, los títulos y la llamada a la acción principal.
const SECTORES = {
  restaurante: { schema: "Restaurant", servicios: "Nuestra carta", cta: "Reservar mesa", msg: "Hola, quería reservar una mesa" },
  bar: { schema: "BarOrPub", servicios: "Nuestra carta", cta: "Reservar mesa", msg: "Hola, quería reservar una mesa" },
  cafeteria: { schema: "CafeOrCoffeeShop", servicios: "Nuestra carta", cta: "Hacer un pedido", msg: "Hola, quería hacer un pedido" },
  panaderia: { schema: "Bakery", servicios: "Nuestros productos", cta: "Hacer un encargo", msg: "Hola, quería hacer un encargo" },
  peluqueria: { schema: "HairSalon", servicios: "Servicios y precios", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  barberia: { schema: "HairSalon", servicios: "Servicios y precios", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  estetica: { schema: "BeautySalon", servicios: "Tratamientos y precios", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  unas: { schema: "NailSalon", servicios: "Servicios y precios", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  dentista: { schema: "Dentist", servicios: "Tratamientos", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  clinica: { schema: "MedicalClinic", servicios: "Especialidades", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  fisioterapia: { schema: "Physiotherapy", servicios: "Tratamientos", cta: "Pedir cita", msg: "Hola, quería pedir cita" },
  veterinario: { schema: "VeterinaryCare", servicios: "Servicios", cta: "Pedir cita", msg: "Hola, quería pedir cita para mi mascota" },
  gimnasio: { schema: "ExerciseGym", servicios: "Actividades y tarifas", cta: "Pedir información", msg: "Hola, quería información" },
  taller: { schema: "AutoRepair", servicios: "Servicios", cta: "Pedir presupuesto", msg: "Hola, quería pedir presupuesto" },
  reformas: { schema: "HomeAndConstructionBusiness", servicios: "Servicios", cta: "Pedir presupuesto", msg: "Hola, quería pedir presupuesto" },
  fontaneria: { schema: "Plumber", servicios: "Servicios", cta: "Pedir presupuesto", msg: "Hola, quería pedir presupuesto" },
  electricista: { schema: "Electrician", servicios: "Servicios", cta: "Pedir presupuesto", msg: "Hola, quería pedir presupuesto" },
  tienda: { schema: "Store", servicios: "Productos", cta: "Consultar", msg: "Hola, quería hacer una consulta" },
  inmobiliaria: { schema: "RealEstateAgent", servicios: "Servicios", cta: "Contactar", msg: "Hola, quería información" },
  generico: { schema: "LocalBusiness", servicios: "Qué ofrecemos", cta: "Contactar", msg: "Hola, quería información" },
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const soloDigitos = (s) => String(s || "").replace(/[^\d+]/g, "");
const esAbsoluta = (u) => /^https?:\/\//.test(u || "");

function estrellas(n) {
  const llenas = Math.round(Number(n) || 0);
  return "★".repeat(llenas) + "☆".repeat(Math.max(0, 5 - llenas));
}

function validar(d, slug) {
  const faltan = ["nombre", "direccion"].filter((k) => !d[k]);
  if (faltan.length) throw new Error(`[${slug}] faltan campos obligatorios: ${faltan.join(", ")}`);
  if (d.tipo && !SECTORES[d.tipo]) throw new Error(`[${slug}] tipo desconocido "${d.tipo}". Opciones: ${Object.keys(SECTORES).join(", ")}`);
  for (const dia of Object.keys(d.horario || {})) {
    if (!DIAS.includes(dia)) throw new Error(`[${slug}] día desconocido en horario: "${dia}" (usa ${DIAS.join(", ")})`);
    for (const tramo of d.horario[dia]) {
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(tramo)) throw new Error(`[${slug}] tramo inválido "${tramo}" (formato HH:MM-HH:MM)`);
    }
  }
}

// Servicios: lista simple [{nombre, detalle, precio}] o agrupada [{grupo, items: [...]}]
const gruposServicios = (lista = []) =>
  lista.some((s) => s.items) ? lista.map((g) => ({ grupo: g.grupo, items: g.items || [] })) : [{ grupo: "", items: lista }];

function schemas(d, sector, url) {
  const horas = [];
  DIAS.forEach((dia, i) => {
    for (const tramo of d.horario?.[dia] || []) {
      const [opens, closes] = tramo.split("-");
      horas.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIAS_SCHEMA[i], opens, closes });
    }
  });
  const imagenes = (d.fotos || []).map((f) => (esAbsoluta(f) ? f : url ? url + f : null)).filter(Boolean);
  const negocio = {
    "@context": "https://schema.org",
    "@type": sector.schema,
    name: d.nombre,
    description: d.descripcion || d.eslogan,
    url: url || undefined,
    image: imagenes.length ? imagenes : undefined,
    telephone: d.telefono || undefined,
    email: d.email || undefined,
    priceRange: d.rangoPrecio || undefined,
    servesCuisine: d.cocina || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: d.direccion,
      addressLocality: d.ciudad || undefined,
      postalCode: d.codigoPostal || undefined,
      addressCountry: d.pais || "ES",
    },
    geo: d.lat && d.lng ? { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lng } : undefined,
    areaServed: d.zonaServicio?.length ? d.zonaServicio : undefined,
    hasMap: d.googleMaps || undefined,
    openingHoursSpecification: horas.length ? horas : undefined,
    sameAs: Object.values(d.redes || {}).filter(Boolean),
  };
  if (d.valoracion && d.numResenas) {
    negocio.aggregateRating = { "@type": "AggregateRating", ratingValue: d.valoracion, reviewCount: d.numResenas, bestRating: 5 };
  }
  const salida = [negocio];
  if (d.preguntas?.length) {
    salida.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: d.preguntas.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
    });
  }
  return salida.map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, "\\u003c")}</script>`).join("\n");
}

function favicon(d, color) {
  const letra = esc((d.nombre.trim()[0] || "·").toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${letra}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function pagina(d, url) {
  const sector = SECTORES[d.tipo] || SECTORES.generico;
  const demo = d.demo !== false;
  const color = /^#[0-9a-f]{3,8}$/i.test(d.color || "") ? d.color : "#1f6f5c";
  const tel = soloDigitos(d.telefono);
  const wa = String(d.whatsapp || "").replace(/\D/g, "");
  const lugar = d.zona || d.ciudad || "";
  const comoLlegar = d.googleMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.nombre + ", " + d.direccion)}`;
  const mapaEmbed = `https://www.google.com/maps?q=${encodeURIComponent(d.nombre + ", " + d.direccion)}&output=embed`;

  // SEO: "Nombre | Categoría en Zona"
  const subtitulo = [d.categoria, lugar && `en ${lugar}`].filter(Boolean).join(" ");
  const titulo = d.tituloSeo || [d.nombre, subtitulo].filter(Boolean).join(" | ");
  const descMeta = d.metaDescripcion || [d.eslogan || d.categoria, lugar && `en ${lugar}`, d.direccion].filter(Boolean).join(". ").slice(0, 160);
  const ogImagen = (d.fotos || []).map((f) => (esAbsoluta(f) ? f : url ? url + f : null)).find(Boolean);

  // Contacto: acción principal según el sector (enlace de reservas > WhatsApp > teléfono)
  const ctaHref = d.enlaceReserva || (wa && `https://wa.me/${wa}?text=${encodeURIComponent(sector.msg)}`) || (tel && `tel:${tel}`);
  const ctaExterno = ctaHref && !ctaHref.startsWith("tel:");
  const cta = ctaHref
    ? `<a class="btn btn-main" href="${esc(ctaHref)}"${ctaExterno ? ' target="_blank" rel="noopener"' : ""}>${esc(d.textoBoton || sector.cta)}</a>`
    : "";
  const botones = [
    cta,
    tel && `<a class="btn" href="tel:${esc(tel)}">📞 Llamar</a>`,
    wa && d.enlaceReserva && `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">💬 WhatsApp</a>`,
    `<a class="btn" href="${esc(comoLlegar)}" target="_blank" rel="noopener">📍 Cómo llegar</a>`,
  ].filter(Boolean).join("\n      ");

  const valoracion = d.valoracion
    ? `<p class="rating"><span aria-hidden="true">${estrellas(d.valoracion)}</span> ${Number(d.valoracion).toFixed(1).replace(".", ",")}${d.numResenas ? ` · ${esc(d.numResenas)} reseñas en Google` : ""}</p>`
    : "";

  const servicios = (d.servicios || []).length
    ? `<section id="servicios"><h2>${esc(d.tituloServicios || sector.servicios)}</h2>${gruposServicios(d.servicios)
        .map(
          (g) =>
            `${g.grupo ? `<h3>${esc(g.grupo)}</h3>` : ""}<ul class="cards">${g.items
              .map(
                (s) =>
                  `<li><div class="fila"><strong>${esc(s.nombre)}</strong>${s.precio ? `<span class="precio">${esc(s.precio)}</span>` : ""}</div>${
                    s.detalle ? `<span>${esc(s.detalle)}</span>` : ""
                  }</li>`
              )
              .join("")}</ul>`
        )
        .join("")}</section>`
    : "";

  const zonaServicio = d.zonaServicio?.length
    ? `<section><h2>Zonas donde trabajamos</h2><p>${d.zonaServicio.map(esc).join(" · ")}</p></section>`
    : "";

  const fotos = (d.fotos || []).length
    ? `<section><h2>Fotos</h2><div class="fotos">${d.fotos
        .map((f, i) => `<img src="${esc(f)}" alt="${esc(`${d.nombre}${subtitulo ? " – " + subtitulo : ""} (foto ${i + 1})`)}" loading="lazy">`)
        .join("")}</div></section>`
    : "";

  const horario = d.horario
    ? `<section id="horario"><h2>Horario <span id="estado" class="estado"></span></h2><table>${DIAS.map(
        (dia, i) =>
          `<tr data-dia="${i}"><th>${DIAS_TXT[i]}</th><td>${
            (d.horario[dia] || []).length ? d.horario[dia].map((t) => esc(t.replace("-", " – "))).join("<br>") : "Cerrado"
          }</td></tr>`
      ).join("")}</table></section>`
    : "";

  const resenas = (d.resenas || []).length
    ? `<section><h2>Lo que dicen nuestros clientes</h2><div class="cards">${d.resenas
        .map(
          (r) =>
            `<blockquote><span class="stars" aria-label="${esc(r.estrellas)} de 5">${estrellas(r.estrellas)}</span><p>“${esc(r.texto)}”</p><cite>${esc(r.autor)}</cite></blockquote>`
        )
        .join("")}</div>${
        d.googleMaps ? `<p><a href="${esc(d.googleMaps)}" target="_blank" rel="noopener">Ver todas las reseñas en Google →</a></p>` : ""
      }</section>`
    : "";

  const preguntas = (d.preguntas || []).length
    ? `<section><h2>Preguntas frecuentes</h2>${d.preguntas
        .map((q) => `<details><summary>${esc(q.p)}</summary><p>${esc(q.r)}</p></details>`)
        .join("")}</section>`
    : "";

  const redes = Object.entries(d.redes || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a>`)
    .join(" · ");

  const barraMovil = ctaHref || tel
    ? `<nav class="barra" aria-label="Contacto rápido">${cta}${tel ? `<a class="btn" href="tel:${esc(tel)}">📞 Llamar</a>` : ""}</nav>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descMeta)}">
${demo ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}
${url ? `<link rel="canonical" href="${esc(url)}">` : ""}
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descMeta)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_ES">
${url ? `<meta property="og:url" content="${esc(url)}">` : ""}
${ogImagen ? `<meta property="og:image" content="${esc(ogImagen)}">` : ""}
<meta name="theme-color" content="${color}">
<link rel="icon" href="${favicon(d, color)}">
<link rel="preconnect" href="https://www.google.com">
${schemas(d, sector, url)}
<style>
  :root { --c: ${color}; --fg: #1d1d1f; --muted: #5f6368; --bg: #fff; --soft: #f6f5f3; --line: #e5e3df; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f1f1f1; --muted: #a8a8a8; --bg: #141414; --soft: #1f1f1f; --line: #2e2e2e; } }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font: 17px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); background: var(--bg); }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }
  header { background: var(--c); color: #fff; padding: 56px 0 44px; }
  header h1 { margin: 0 0 6px; font-size: clamp(2rem, 6vw, 3rem); line-height: 1.1; }
  header .sub { margin: 0; opacity: .9; font-size: 1.05rem; }
  header .eslogan { font-size: 1.15rem; margin: 14px 0 0; }
  .rating { margin: 10px 0 0; } .rating span { color: #ffd54a; letter-spacing: 1px; }
  .acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; background: #fff; color: var(--c); padding: 12px 18px; border-radius: 999px; font-weight: 600; text-decoration: none; border: 2px solid #fff; }
  .btn-main { background: #111; color: #fff; border-color: #111; }
  .btn:hover { filter: brightness(.95); }
  section { padding: 36px 0 8px; }
  h2 { font-size: 1.4rem; margin: 0 0 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h3 { font-size: 1.05rem; margin: 20px 0 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .cards { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .cards li, blockquote { background: var(--soft); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin: 0; }
  .cards li > span { display: block; color: var(--muted); font-size: .95rem; margin-top: 4px; }
  .fila { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .precio { font-weight: 700; white-space: nowrap; color: var(--c); }
  blockquote p { margin: 6px 0; } blockquote cite { color: var(--muted); font-style: normal; font-size: .9rem; }
  .stars { color: #e3a008; letter-spacing: 1px; }
  table { border-collapse: collapse; width: 100%; max-width: 480px; }
  th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-weight: 500; width: 40%; } tr.hoy { font-weight: 700; } tr.hoy th { color: var(--c); }
  .estado { font-size: .8rem; padding: 3px 10px; border-radius: 999px; font-weight: 600; }
  .estado.abierto { background: #d7f5dd; color: #11632a; } .estado.cerrado { background: #fde0e0; color: #8a1c1c; }
  .fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .fotos img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 10px; }
  details { border-bottom: 1px solid var(--line); padding: 12px 0; } summary { cursor: pointer; font-weight: 600; } details p { margin: 8px 0 0; color: var(--muted); }
  .mapa { width: 100%; height: 340px; border: 0; border-radius: 14px; background: var(--soft); }
  a { color: var(--c); }
  @media (prefers-color-scheme: dark) { main a, footer a { color: color-mix(in srgb, var(--c) 50%, white); } .precio, tr.hoy th { color: color-mix(in srgb, var(--c) 50%, white); } }
  footer { margin-top: 48px; padding: 24px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
  .barra { display: none; }
  @media (max-width: 640px) {
    .barra { display: flex; gap: 8px; position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: var(--bg); border-top: 1px solid var(--line); z-index: 10; }
    .barra .btn { flex: 1; padding: 12px 8px; } .barra .btn:not(.btn-main) { border-color: var(--c); }
    .barra .btn-main { background: var(--c); border-color: var(--c); }
    body { padding-bottom: 76px; }
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <h1>${esc(d.nombre)}</h1>
    ${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ""}
    ${d.eslogan ? `<p class="eslogan">${esc(d.eslogan)}</p>` : ""}
    ${valoracion}
    <div class="acciones">
      ${botones}
    </div>
  </div>
</header>
<main class="wrap">
  ${d.descripcion ? `<section><h2>Sobre ${esc(d.nombre)}</h2><p>${esc(d.descripcion)}</p></section>` : ""}
  ${servicios}
  ${zonaServicio}
  ${horario}
  ${fotos}
  ${resenas}
  ${preguntas}
  <section id="ubicacion">
    <h2>Dónde estamos</h2>
    <address style="font-style:normal"><p>${esc(d.direccion)}${d.codigoPostal || d.ciudad ? `, ${esc([d.codigoPostal, d.ciudad].filter(Boolean).join(" "))}` : ""}</p></address>
    <iframe class="mapa" src="${esc(mapaEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de ${esc(d.nombre)}"></iframe>
  </section>
</main>
<footer>
  <div class="wrap">
    <strong>${esc(d.nombre)}</strong> · ${esc(d.direccion)}${d.ciudad ? `, ${esc(d.ciudad)}` : ""}
    ${d.telefono ? `· <a href="tel:${esc(tel)}">${esc(d.telefono)}</a>` : ""}
    ${d.email ? `· <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : ""}
    ${redes ? `<br>${redes}` : ""}
  </div>
</footer>
${barraMovil}
<script>
(function () {
  var horario = ${JSON.stringify(DIAS.map((dia) => d.horario?.[dia] || []))};
  var tz = ${JSON.stringify(d.zonaHoraria || "Europe/Madrid")};
  try {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    var get = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    var dia = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(get("weekday"));
    var ahora = (+get("hour") % 24) * 60 + +get("minute");
    var min = function (h) { var a = h.split(":"); return +a[0] * 60 + +a[1]; };
    var ayer = (dia + 6) % 7;
    var dentro = function (t, hoy) {
      var r = t.split("-"), ini = min(r[0]), fin = min(r[1]);
      if (fin > ini) return hoy && ahora >= ini && ahora < fin;
      return hoy ? ahora >= ini : ahora < fin; // tramos que pasan de medianoche
    };
    var abierto = horario[dia].some(function (t) { return dentro(t, true); }) || horario[ayer].some(function (t) { return dentro(t, false); });
    var fila = document.querySelector('tr[data-dia="' + dia + '"]');
    if (fila) fila.classList.add("hoy");
    var e = document.getElementById("estado");
    if (e) { e.textContent = abierto ? "Abierto ahora" : "Cerrado ahora"; e.className = "estado " + (abierto ? "abierto" : "cerrado"); }
  } catch (err) {}
})();
</script>
</body>
</html>
`;
}

function indice(locales) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Webs de locales</title><meta name="robots" content="noindex">
<style>body{font:17px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px}li{margin:6px 0}</style></head>
<body><h1>Webs de locales</h1><ul>${locales
    .map((l) => `<li><a href="./${esc(l.slug)}/">${esc(l.nombre)}</a></li>`)
    .join("")}</ul></body></html>
`;
}

function copiarCarpeta(orig, dest) {
  for (const f of fs.readdirSync(orig, { withFileTypes: true })) {
    if (f.name === "datos.json") continue;
    const o = path.join(orig, f.name), t = path.join(dest, f.name);
    if (f.isDirectory()) { fs.mkdirSync(t, { recursive: true }); copiarCarpeta(o, t); }
    else fs.copyFileSync(o, t);
  }
}

function leerCarpetas(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((slug) => fs.existsSync(path.join(dir, slug, "datos.json")))
    .map((slug) => {
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Nombre de carpeta inválido "${slug}": usa minúsculas, números y guiones`);
      const d = JSON.parse(fs.readFileSync(path.join(dir, slug, "datos.json"), "utf8"));
      validar(d, slug);
      return { slug, dir: path.join(dir, slug), d };
    });
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  let lista = leerCarpetas(path.join(RAIZ, "locales"));
  const escaparate = lista.length === 0;
  if (escaparate) lista = leerCarpetas(path.join(RAIZ, "ejemplos")).map((l) => ({ ...l, d: { ...l.d, demo: true } }));

  const enRaiz = lista.length === 1 && !escaparate;
  for (const { slug, dir, d } of lista) {
    const salida = enRaiz ? DIST : path.join(DIST, slug);
    // La URL pública solo se conoce cuando el local tiene dominio propio (web definitiva).
    const url = d.dominio ? d.dominio.replace(/\/?$/, "/") : "";
    fs.mkdirSync(salida, { recursive: true });
    copiarCarpeta(dir, salida);
    fs.writeFileSync(path.join(salida, "index.html"), pagina(d, url));
    console.log(`✔ ${slug}${d.demo !== false ? " (demo, noindex)" : ""}`);
  }

  if (!enRaiz) fs.writeFileSync(path.join(DIST, "index.html"), indice(lista));

  // robots.txt, sitemap y cabeceras (Cloudflare Pages lee _headers)
  const unico = enRaiz ? lista[0].d : null;
  if (unico && unico.demo === false) {
    const url = unico.dominio ? unico.dominio.replace(/\/?$/, "/") : "";
    fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n${url ? `Sitemap: ${url}sitemap.xml\n` : ""}`);
    if (url) {
      fs.writeFileSync(
        path.join(DIST, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(url)}</loc></url></urlset>\n`
      );
    }
  } else {
    // Demo: se deja rastrear para que Google vea el noindex, pero nunca se indexa.
    fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nAllow: /\n");
    fs.writeFileSync(path.join(DIST, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  }

  console.log(`\n${lista.length} web(s) generadas en dist/${escaparate ? " (escaparate de ejemplos)" : ""}`);
}

main();
