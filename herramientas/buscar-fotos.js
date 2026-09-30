#!/usr/bin/env node
// Busca fotos libres y descarga candidatas redimensionadas (1600 px de ancho máx.).
// Uso: node herramientas/buscar-fotos.js <carpeta-salida> "<búsqueda 1>; <búsqueda 2>" [cantidad] [orientacion] [fuente]
//   orientacion: landscape | portrait | square
//   fuente: openverse (por defecto, sin clave; solo dominio público CC0/PDM)
//           pixabay (PIXABAY_API_KEY) | pexels (PEXELS_API_KEY)
// Si "sharp" está instalado se redimensiona y comprime; si no, se guarda tal cual.
const fs = require("fs");
const path = require("path");

const [salida, busquedas, cantidad = "8", orientacion = "landscape", fuente = "openverse"] = process.argv.slice(2);
if (!salida || !busquedas) throw new Error('Uso: buscar-fotos.js <carpeta-salida> "búsqueda 1; búsqueda 2" [cantidad] [orientacion] [fuente]');
const n = Math.min(Number(cantidad) || 8, 20);

let sharp = null;
try { sharp = require("sharp"); } catch {}

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function json(url, headers = {}) {
  const r = await fetch(url, { headers: { "User-Agent": "webs-locales/1.0", ...headers } });
  if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// Cada fuente devuelve [{ id, url, autor, pagina, licencia, alt, ancho, alto }]
const FUENTES = {
  async openverse(q) {
    const aspecto = { landscape: "wide", portrait: "tall", square: "square" }[orientacion] || "wide";
    // Openverse busca por título y etiquetas: si con todos los filtros hay pocas fotos, se relajan.
    const base = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&category=photograph&page_size=20`;
    let results = [];
    for (const filtros of [`&aspect_ratio=${aspecto}&size=large`, `&aspect_ratio=${aspecto}`, ""]) {
      const vistos = new Set(results.map((r) => r.id));
      results = results.concat(((await json(base + filtros)).results || []).filter((r) => !vistos.has(r.id)));
      if (results.length >= n) break;
    }
    // Descartar fotos pequeñas o muy verticales si se pidió horizontal
    results = results.filter((r) => !r.width || (r.width >= 1000 && (orientacion !== "landscape" || r.width >= r.height)));
    return results.slice(0, n).map((p) => ({
      id: `${p.source}-${p.id.slice(0, 8)}`, url: p.url, autor: p.creator || "desconocido", pagina: p.foreign_landing_url,
      licencia: `${p.license.toUpperCase()} (${p.source})`, alt: p.title || "", ancho: p.width, alto: p.height,
    }));
  },
  async pixabay(q) {
    const clave = process.env.PIXABAY_API_KEY;
    if (!clave) throw new Error("Falta PIXABAY_API_KEY");
    const o = { landscape: "horizontal", portrait: "vertical" }[orientacion] || "all";
    const { hits = [] } = await json(`https://pixabay.com/api/?key=${clave}&q=${encodeURIComponent(q)}&image_type=photo&orientation=${o}&per_page=${Math.max(n, 3)}&safesearch=true`);
    return hits.slice(0, n).map((p) => ({
      id: `pixabay-${p.id}`, url: p.largeImageURL, autor: p.user, pagina: p.pageURL, licencia: "Pixabay License",
      alt: p.tags, ancho: p.imageWidth, alto: p.imageHeight,
    }));
  },
  async pexels(q) {
    const clave = process.env.PEXELS_API_KEY;
    if (!clave) throw new Error("Falta PEXELS_API_KEY");
    const { photos = [] } = await json(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=${orientacion}`, { Authorization: clave });
    return photos.map((p) => ({
      id: `pexels-${p.id}`, url: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600&fit=max`, autor: p.photographer, pagina: p.url,
      licencia: "Pexels License", alt: p.alt, ancho: p.width, alto: p.height,
    }));
  },
};

async function guardar(url, destino) {
  const r = await fetch(url, { headers: { "User-Agent": "webs-locales/1.0" }, redirect: "follow" });
  if (!r.ok) throw new Error(`descarga ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (sharp) {
    await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(destino);
  } else {
    fs.writeFileSync(destino, buf);
  }
}

async function main() {
  const buscar = FUENTES[fuente];
  if (!buscar) throw new Error(`Fuente desconocida "${fuente}". Opciones: ${Object.keys(FUENTES).join(", ")}`);
  if (!sharp) console.log("(sharp no instalado: las fotos se guardan sin redimensionar)");
  for (const q of busquedas.split(";").map((s) => s.trim()).filter(Boolean)) {
    const fotos = await buscar(q);
    const dir = path.join(salida, slug(q));
    fs.mkdirSync(dir, { recursive: true });
    const creditos = [];
    for (const [i, p] of fotos.entries()) {
      const archivo = `${String(i + 1).padStart(2, "0")}-${p.id}.jpg`;
      try {
        await guardar(p.url, path.join(dir, archivo));
        creditos.push({ archivo, ...p });
        console.log(`  ✔ ${archivo}  ${p.alt}`);
      } catch (e) {
        console.log(`  ✘ ${archivo}: ${e.message}`);
      }
    }
    fs.writeFileSync(path.join(dir, "creditos.json"), JSON.stringify({ busqueda: q, fuente, orientacion, fotos: creditos }, null, 2));
    console.log(`"${q}" (${fuente}): ${creditos.length} fotos en ${dir}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
