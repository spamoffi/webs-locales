#!/usr/bin/env node
// Genera una web estática por cada carpeta en locales/ (sin dependencias).
// Uso: node build.js  ->  resultado en dist/
const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;
const LOCALES = path.join(RAIZ, "locales");
const DIST = path.join(RAIZ, "dist");

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIAS_TXT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const soloDigitos = (s) => String(s || "").replace(/[^\d+]/g, "");

function estrellas(n) {
  const llenas = Math.round(Number(n) || 0);
  return "★".repeat(llenas) + "☆".repeat(Math.max(0, 5 - llenas));
}

function validar(d, slug) {
  const faltan = ["nombre", "direccion"].filter((k) => !d[k]);
  if (faltan.length) throw new Error(`[${slug}] faltan campos obligatorios: ${faltan.join(", ")}`);
  for (const dia of Object.keys(d.horario || {})) {
    if (!DIAS.includes(dia)) throw new Error(`[${slug}] día desconocido en horario: "${dia}" (usa ${DIAS.join(", ")})`);
    for (const tramo of d.horario[dia]) {
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(tramo)) throw new Error(`[${slug}] tramo inválido "${tramo}" (formato HH:MM-HH:MM)`);
    }
  }
}

function schemaLocal(d, url) {
  const horas = [];
  DIAS.forEach((dia, i) => {
    for (const tramo of d.horario?.[dia] || []) {
      const [opens, closes] = tramo.split("-");
      horas.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIAS_SCHEMA[i], opens, closes });
    }
  });
  const s = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: d.nombre,
    description: d.descripcion || d.eslogan,
    address: d.direccion,
    telephone: d.telefono || undefined,
    email: d.email || undefined,
    url: url || undefined,
    hasMap: d.googleMaps || undefined,
    openingHoursSpecification: horas.length ? horas : undefined,
    sameAs: Object.values(d.redes || {}).filter(Boolean),
  };
  if (d.valoracion && d.numResenas) {
    s.aggregateRating = { "@type": "AggregateRating", ratingValue: d.valoracion, reviewCount: d.numResenas };
  }
  return JSON.stringify(s).replace(/</g, "\\u003c");
}

function pagina(d, url) {
  const color = /^#[0-9a-f]{3,8}$/i.test(d.color || "") ? d.color : "#1f6f5c";
  const tel = soloDigitos(d.telefono);
  const wa = String(d.whatsapp || "").replace(/\D/g, "");
  const comoLlegar = d.googleMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.nombre + ", " + d.direccion)}`;
  const mapaEmbed = `https://www.google.com/maps?q=${encodeURIComponent(d.nombre + ", " + d.direccion)}&output=embed`;
  const titulo = `${d.nombre}${d.categoria ? " · " + d.categoria : ""}`;
  const descMeta = d.eslogan || d.descripcion || d.direccion;

  const botones = [
    tel && `<a class="btn" href="tel:${esc(tel)}">📞 Llamar</a>`,
    wa && `<a class="btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">💬 WhatsApp</a>`,
    `<a class="btn" href="${esc(comoLlegar)}" target="_blank" rel="noopener">📍 Cómo llegar</a>`,
  ].filter(Boolean).join("\n        ");

  const valoracion = d.valoracion
    ? `<p class="rating"><span aria-hidden="true">${estrellas(d.valoracion)}</span> ${esc(d.valoracion)}${d.numResenas ? ` · ${esc(d.numResenas)} reseñas en Google` : ""}</p>`
    : "";

  const servicios = (d.servicios || []).length
    ? `<section><h2>Qué ofrecemos</h2><ul class="cards">${d.servicios
        .map((s) => `<li><strong>${esc(s.nombre)}</strong>${s.detalle ? `<span>${esc(s.detalle)}</span>` : ""}</li>`)
        .join("")}</ul></section>`
    : "";

  const fotos = (d.fotos || []).length
    ? `<section><h2>Fotos</h2><div class="fotos">${d.fotos
        .map((f) => `<img src="${esc(f)}" alt="${esc(d.nombre)}" loading="lazy">`)
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

  const redes = Object.entries(d.redes || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a>`)
    .join(" · ");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descMeta)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descMeta)}">
<meta property="og:type" content="website">
${d.fotos?.[0] ? `<meta property="og:image" content="${esc(d.fotos[0])}">` : ""}
<meta name="theme-color" content="${color}">
<script type="application/ld+json">${schemaLocal(d, url)}</script>
<style>
  :root { --c: ${color}; --fg: #1d1d1f; --muted: #5f6368; --bg: #fff; --soft: #f6f5f3; --line: #e5e3df; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f1f1f1; --muted: #a8a8a8; --bg: #141414; --soft: #1f1f1f; --line: #2e2e2e; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 17px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); background: var(--bg); }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 16px; }
  header { background: var(--c); color: #fff; padding: 56px 0 44px; }
  header h1 { margin: 0 0 4px; font-size: clamp(2rem, 6vw, 3rem); line-height: 1.1; }
  header .cat { margin: 0; opacity: .85; text-transform: uppercase; letter-spacing: .06em; font-size: .85rem; }
  header .eslogan { font-size: 1.15rem; margin: 14px 0 0; }
  .rating { margin: 10px 0 0; } .rating span { color: #ffd54a; letter-spacing: 1px; }
  .acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .btn { background: #fff; color: var(--c); padding: 12px 18px; border-radius: 999px; font-weight: 600; text-decoration: none; }
  .btn:hover { filter: brightness(.95); }
  section { padding: 36px 0 8px; }
  h2 { font-size: 1.4rem; margin: 0 0 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .cards { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .cards li, blockquote { background: var(--soft); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin: 0; }
  .cards li span { display: block; color: var(--muted); font-size: .95rem; margin-top: 4px; }
  blockquote p { margin: 6px 0; } blockquote cite { color: var(--muted); font-style: normal; font-size: .9rem; }
  .stars { color: #e3a008; letter-spacing: 1px; }
  table { border-collapse: collapse; width: 100%; max-width: 480px; }
  th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid var(--line); }
  th { font-weight: 500; width: 40%; } tr.hoy { font-weight: 700; } tr.hoy th { color: var(--c); }
  .estado { font-size: .8rem; padding: 3px 10px; border-radius: 999px; font-weight: 600; }
  .estado.abierto { background: #d7f5dd; color: #11632a; } .estado.cerrado { background: #fde0e0; color: #8a1c1c; }
  .fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .fotos img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 10px; }
  .mapa { width: 100%; height: 340px; border: 0; border-radius: 14px; }
  a { color: var(--c); }
  @media (prefers-color-scheme: dark) { a { color: color-mix(in srgb, var(--c) 55%, white); } }
  footer { margin-top: 48px; padding: 24px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
</style>
</head>
<body>
<header>
  <div class="wrap">
    ${d.categoria ? `<p class="cat">${esc(d.categoria)}</p>` : ""}
    <h1>${esc(d.nombre)}</h1>
    ${d.eslogan ? `<p class="eslogan">${esc(d.eslogan)}</p>` : ""}
    ${valoracion}
    <div class="acciones">
        ${botones}
    </div>
  </div>
</header>
<main class="wrap">
  ${d.descripcion ? `<section><h2>Sobre nosotros</h2><p>${esc(d.descripcion)}</p></section>` : ""}
  ${servicios}
  ${horario}
  ${fotos}
  ${resenas}
  <section>
    <h2>Dónde estamos</h2>
    <p>${esc(d.direccion)}</p>
    <iframe class="mapa" src="${esc(mapaEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de ${esc(d.nombre)}"></iframe>
  </section>
</main>
<footer>
  <div class="wrap">
    <strong>${esc(d.nombre)}</strong> · ${esc(d.direccion)}
    ${d.telefono ? `· <a href="tel:${esc(tel)}">${esc(d.telefono)}</a>` : ""}
    ${d.email ? `· <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>` : ""}
    ${redes ? `<br>${redes}` : ""}
  </div>
</footer>
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
    var abierto = horario[dia].some(function (t) {
      var r = t.split("-"), ini = min(r[0]), fin = min(r[1]);
      return fin > ini ? ahora >= ini && ahora < fin : ahora >= ini || ahora < fin;
    });
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

function main() {
  const base = (process.env.SITE_URL || "").replace(/\/$/, "");
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  const hechos = [];
  for (const slug of fs.readdirSync(LOCALES).sort()) {
    const archivo = path.join(LOCALES, slug, "datos.json");
    if (!fs.existsSync(archivo)) continue;
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Nombre de carpeta inválido "${slug}": usa minúsculas, números y guiones`);
    const d = JSON.parse(fs.readFileSync(archivo, "utf8"));
    validar(d, slug);
    const salida = path.join(DIST, slug);
    fs.mkdirSync(salida, { recursive: true });
    copiarCarpeta(path.join(LOCALES, slug), salida);
    fs.writeFileSync(path.join(salida, "index.html"), pagina(d, base && `${base}/${slug}/`));
    hechos.push({ slug, nombre: d.nombre });
    console.log(`✔ ${slug}`);
  }
  fs.writeFileSync(path.join(DIST, "index.html"), indice(hechos));
  console.log(`\n${hechos.length} web(s) generadas en dist/`);
}

main();
