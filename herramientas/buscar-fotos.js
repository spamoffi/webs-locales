#!/usr/bin/env node
// Busca fotos en Pexels (licencia libre, uso comercial, sin atribución obligatoria) y descarga candidatas.
// Uso: PEXELS_API_KEY=... node herramientas/buscar-fotos.js <carpeta-salida> "<búsqueda 1>; <búsqueda 2>" [cantidad] [orientacion]
// orientacion: landscape | portrait | square
const fs = require("fs");
const path = require("path");

const [salida, busquedas, cantidad = "6", orientacion = "landscape"] = process.argv.slice(2);
const clave = process.env.PEXELS_API_KEY;
if (!salida || !busquedas) throw new Error("Uso: buscar-fotos.js <carpeta-salida> \"búsqueda 1; búsqueda 2\" [cantidad] [orientacion]");
if (!clave) throw new Error("Falta PEXELS_API_KEY");

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  for (const q of busquedas.split(";").map((s) => s.trim()).filter(Boolean)) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${cantidad}&orientation=${orientacion}`;
    const r = await fetch(url, { headers: { Authorization: clave } });
    if (!r.ok) throw new Error(`Pexels respondió ${r.status} para "${q}": ${await r.text()}`);
    const { photos = [] } = await r.json();
    const dir = path.join(salida, slug(q));
    fs.mkdirSync(dir, { recursive: true });
    const creditos = [];
    for (const [i, p] of photos.entries()) {
      const archivo = `${String(i + 1).padStart(2, "0")}-pexels-${p.id}.jpg`;
      const img = await fetch(`${p.src.original}?auto=compress&cs=tinysrgb&w=1600&fit=max`);
      if (!img.ok) { console.log(`  ✘ ${archivo} (${img.status})`); continue; }
      fs.writeFileSync(path.join(dir, archivo), Buffer.from(await img.arrayBuffer()));
      creditos.push({ archivo, id: p.id, autor: p.photographer, url: p.url, alt: p.alt, ancho: p.width, alto: p.height });
      console.log(`  ✔ ${archivo}  ${p.alt || ""}`);
    }
    fs.writeFileSync(path.join(dir, "creditos.json"), JSON.stringify({ busqueda: q, orientacion, fotos: creditos }, null, 2));
    console.log(`"${q}": ${creditos.length} fotos en ${dir}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
