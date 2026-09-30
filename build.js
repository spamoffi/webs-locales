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

// Imagen: "ruta.jpg" o { "src": "ruta.jpg", "alt": "texto" }
const foto = (x, altPorDefecto = "") => (!x ? null : typeof x === "string" ? { src: x, alt: altPorDefecto } : { src: x.src, alt: x.alt || altPorDefecto });

// Todas las imágenes que usa un local (para validar que existen y para Google)
function todasLasFotos(d) {
  const lista = [d.portada, d.imagenSobre, ...(d.fotos || [])];
  for (const s of d.servicios || []) {
    lista.push(s.imagen);
    for (const i of s.items || []) lista.push(i.imagen);
  }
  return lista.map((x) => foto(x)).filter(Boolean);
}

// Servicios: lista simple [{nombre, detalle, precio}] o agrupada [{grupo, items: [...]}]
const gruposServicios = (lista = []) =>
  lista.some((s) => s.items) ? lista.map((g) => ({ grupo: g.grupo, imagen: g.imagen, items: g.items || [] })) : [{ grupo: "", items: lista }];

function schemas(d, sector, url) {
  const horas = [];
  DIAS.forEach((dia, i) => {
    for (const tramo of d.horario?.[dia] || []) {
      const [opens, closes] = tramo.split("-");
      horas.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIAS_SCHEMA[i], opens, closes });
    }
  });
  const imagenes = [d.portada, d.imagenSobre, ...(d.fotos || [])]
    .map((x) => foto(x)?.src)
    .map((f) => (esAbsoluta(f) ? f : f && url ? url + f : null))
    .filter(Boolean);
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

// Iconos en línea (trazo = currentColor)
const ICONOS = {
  telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  estrella: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  correo: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
};
const icono = (n, clase = "ico") =>
  `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n]}</svg>`;

const DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// "Lun–Vie 09:15–20:00 · Sáb–Dom Cerrado"
function resumenHorario(h) {
  if (!h) return [];
  const txt = DIAS.map((dia) => ((h[dia] || []).length ? h[dia].map((t) => t.replace("-", "–")).join(" y ") : "Cerrado"));
  const grupos = [];
  txt.forEach((t, i) => {
    const g = grupos[grupos.length - 1];
    if (g && g.t === t) g.fin = i;
    else grupos.push({ ini: i, fin: i, t });
  });
  return grupos.map((g) => ({ dias: g.ini === g.fin ? DIAS_CORTO[g.ini] : `${DIAS_CORTO[g.ini]}–${DIAS_CORTO[g.fin]}`, horas: g.t }));
}

function pagina(d, url, prefijo = "") {
  const sector = SECTORES[d.tipo] || SECTORES.generico;
  const demo = d.demo === true; // solo los ejemplos de main son demos (noindex)
  const color = /^#[0-9a-f]{3,8}$/i.test(d.color || "") ? d.color : "#1f6f5c";
  const tel = soloDigitos(d.telefono);
  const wa = String(d.whatsapp || "").replace(/\D/g, "");
  const lugar = d.zona || d.ciudad || "";
  const comoLlegar = d.googleMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.nombre + ", " + d.direccion)}`;
  const mapaEmbed = `https://www.google.com/maps?q=${encodeURIComponent(d.nombre + ", " + d.direccion)}&output=embed`;
  const direccionCompleta = [d.direccion, [d.codigoPostal, d.ciudad].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  // SEO: "Nombre | Categoría en Zona"
  const subtitulo = [d.categoria, lugar && `en ${lugar}`].filter(Boolean).join(" ");
  const titulo = d.tituloSeo || [d.nombre, subtitulo].filter(Boolean).join(" | ");
  const descMeta = d.metaDescripcion || [d.eslogan || d.categoria, lugar && `en ${lugar}`, d.direccion].filter(Boolean).join(". ").slice(0, 160);
  const ogImagen = [d.portada, ...(d.fotos || [])]
    .map((x) => foto(x)?.src)
    .map((f) => (esAbsoluta(f) ? f : f && url ? url + f : null))
    .find(Boolean);
  const altBase = `${d.nombre}${subtitulo ? " – " + subtitulo : ""}`;
  const portada = foto(d.portada, altBase);
  const imagenSobre = foto(d.imagenSobre, altBase);
  const imgTag = (f, extra = "") => `<img src="${esc(f.src)}" alt="${esc(f.alt)}" loading="lazy" decoding="async"${extra}>`;

  // Contacto: acción principal según el sector (enlace de reservas > WhatsApp > teléfono)
  const ctaHref = d.enlaceReserva || (wa && `https://wa.me/${wa}?text=${encodeURIComponent(sector.msg)}`) || (tel && `tel:${tel}`);
  const ctaExterno = ctaHref && !ctaHref.startsWith("tel:");
  const ctaTexto = d.textoBoton || sector.cta;
  const ctaIcono = ctaHref && ctaHref.includes("wa.me") ? "chat" : ctaHref && ctaHref.startsWith("tel:") ? "telefono" : "calendario";
  const botonCta = (clase = "btn btn-primario") =>
    ctaHref ? `<a class="${clase}" href="${esc(ctaHref)}"${ctaExterno ? ' target="_blank" rel="noopener"' : ""}>${icono(ctaIcono)}${esc(ctaTexto)}</a>` : "";
  const botonTel = (clase = "btn btn-secundario") => (tel ? `<a class="${clase}" href="tel:${esc(tel)}">${icono("telefono")}${esc(d.telefono)}</a>` : "");

  const nota = d.valoracion ? Number(d.valoracion).toFixed(1).replace(".", ",") : "";
  const horarioResumen = resumenHorario(d.horario);
  const horarioAbierto = horarioResumen.find((g) => g.horas !== "Cerrado");
  const tituloServicios = d.tituloServicios || sector.servicios;
  const grupos = gruposServicios(d.servicios);
  const hayGrupos = grupos.some((g) => g.grupo);

  // Menú
  const menu = [
    grupos[0]?.items.length && ["#servicios", tituloServicios.length <= 14 ? tituloServicios : "Servicios"],
    d.descripcion && ["#sobre", "Sobre nosotros"],
    (d.resenas || []).length && ["#opiniones", "Opiniones"],
    ["#contacto", "Contacto"],
  ].filter(Boolean);

  // Datos clave bajo la portada
  const destacados = (d.destacados || [
    d.valoracion && { icono: "estrella", titulo: `${nota} en Google`, texto: d.numResenas ? `${d.numResenas} opiniones de clientes` : "Valoración de clientes" },
    horarioAbierto && { icono: "reloj", titulo: horarioAbierto.dias, texto: horarioAbierto.horas },
    ctaHref && { icono: ctaIcono, titulo: ctaTexto, texto: ctaIcono === "chat" ? "Por WhatsApp, sin esperas" : ctaIcono === "telefono" ? d.telefono : "Online" },
    { icono: "pin", titulo: d.ciudad || lugar || "Cómo llegar", texto: d.direccion },
  ]).filter(Boolean).slice(0, 4);

  const puntos = d.puntosFuertes || (hayGrupos ? grupos.map((g) => g.grupo) : []);

  const servicios = grupos[0]?.items.length
    ? `<section id="servicios" class="seccion alt"><div class="wrap">
    <header class="cabecera centro"><p class="antetitulo">${esc(tituloServicios)}</p><h2>${esc(d.tituloServicios2 || `${tituloServicios}${lugar ? ` en ${lugar}` : ""}`)}</h2>${
        d.introServicios ? `<p class="intro">${esc(d.introServicios)}</p>` : ""
      }</header>
    <div class="servicios${hayGrupos ? "" : ` planos${grupos[0].items.length % 3 === 0 || grupos[0].items.length % 2 === 1 ? "" : " pares"}`}">${
        hayGrupos
          ? grupos
              .map(
                (g) => `<article class="tarjeta servicio">${
                  g.imagen ? `<div class="servicio-img">${imgTag(foto(g.imagen, `${g.grupo} en ${d.nombre}`))}</div>` : ""
                }<div class="servicio-cuerpo"><h3>${esc(g.grupo)}</h3><ul class="lista-servicios">${g.items
                  .map(
                    (s) =>
                      `<li><div class="fila"><strong>${esc(s.nombre)}</strong>${s.precio ? `<span class="precio">${esc(s.precio)}</span>` : ""}</div>${
                        s.detalle ? `<p>${esc(s.detalle)}</p>` : ""
                      }</li>`
                  )
                  .join("")}</ul></div></article>`
              )
              .join("")
          : grupos[0].items
              .map(
                (s) => `<article class="tarjeta servicio">${s.imagen ? `<div class="servicio-img">${imgTag(foto(s.imagen, `${s.nombre} en ${d.nombre}`))}</div>` : ""}<div class="servicio-cuerpo"><div class="fila"><h3>${esc(
                  s.nombre
                )}</h3>${s.precio ? `<span class="precio">${esc(s.precio)}</span>` : ""}</div>${s.detalle ? `<p>${esc(s.detalle)}</p>` : ""}</div></article>`
              )
              .join("")
      }</div>
    ${ctaHref ? `<div class="centro mas">${botonCta()}</div>` : ""}
  </div></section>`
    : "";

  const sobre = d.descripcion
    ? `<section id="sobre" class="seccion"><div class="wrap sobre${imagenSobre ? "" : " sin-imagen"}">
    ${imagenSobre ? `<div class="sobre-img">${imgTag(imagenSobre)}</div>` : ""}
    <div class="sobre-texto">
      <p class="antetitulo">Sobre nosotros</p>
      <h2>${esc(d.tituloSobre || `Sobre ${d.nombre}`)}</h2>
      ${String(d.descripcion).split(/\n+/).map((p) => `<p class="intro">${esc(p)}</p>`).join("")}
      ${puntos.length ? `<ul class="checks">${puntos.map((p) => `<li>${icono("check")}${esc(p)}</li>`).join("")}</ul>` : ""}
    </div>
  </div></section>`
    : "";

  const resenas = (d.resenas || []).length
    ? `<section id="opiniones" class="seccion alt"><div class="wrap">
    <header class="cabecera centro"><p class="antetitulo">Opiniones</p><h2>Lo que dicen nuestros clientes</h2>${
        nota ? `<p class="intro">${icono("estrella", "ico estrella")} ${nota} de media${d.numResenas ? ` en ${esc(d.numResenas)} opiniones de Google` : ""}</p>` : ""
      }</header>
    <div class="resenas">${d.resenas
      .map(
        (r) =>
          `<figure class="tarjeta resena"><div class="estrellas" aria-label="${esc(r.estrellas)} de 5">${estrellas(r.estrellas)}</div><blockquote>“${esc(
            r.texto
          )}”</blockquote><figcaption><span class="avatar">${esc((r.autor || "?").trim()[0])}</span>${esc(r.autor)}</figcaption></figure>`
      )
      .join("")}</div>
    ${d.googleMaps ? `<p class="centro mas"><a class="enlace" href="${esc(d.googleMaps)}" target="_blank" rel="noopener">Ver todas las opiniones en Google ${icono("flecha")}</a></p>` : ""}
  </div></section>`
    : "";

  const galeria = (d.fotos || []).length
    ? `<section class="seccion"><div class="wrap">
    <header class="cabecera"><p class="antetitulo">Galería</p><h2>${esc(d.tituloGaleria || `Conoce ${d.nombre}`)}</h2></header>
    <div class="galeria" tabindex="0" aria-label="Galería de fotos">${d.fotos.map((f, i) => imgTag(foto(f, `${altBase} (foto ${i + 1})`))).join("")}</div>
  </div></section>`
    : "";

  const preguntas = (d.preguntas || []).length
    ? `<section id="preguntas" class="seccion alt"><div class="wrap faq">
    <div><p class="antetitulo">Preguntas frecuentes</p><h2>¿Tienes dudas?</h2><p class="intro">Aquí respondemos a lo que más nos preguntan. Si no encuentras lo que buscas, escríbenos o llámanos.</p>
      <div class="acciones">${botonCta()}${botonTel()}</div></div>
    <div class="acordeon">${d.preguntas.map((q, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(q.p)}</summary><p>${esc(q.r)}</p></details>`).join("")}</div>
  </div></section>`
    : "";

  const tablaHorario = d.horario
    ? `<table class="horario">${DIAS.map(
        (dia, i) =>
          `<tr data-dia="${i}"><th>${DIAS_TXT[i]}</th><td>${
            (d.horario[dia] || []).length ? d.horario[dia].map((t) => esc(t.replace("-", " – "))).join("<br>") : '<span class="cerrado">Cerrado</span>'
          }</td></tr>`
      ).join("")}</table>`
    : "";

  const contacto = `<section id="contacto" class="seccion"><div class="wrap">
    <header class="cabecera"><p class="antetitulo">Horario y contacto</p><h2>Dónde estamos</h2></header>
    <div class="contacto">
      <div class="tarjeta contacto-datos">
        ${d.horario ? `<div class="bloque"><h3>${icono("reloj")}Horario <span class="estado" data-estado></span></h3>${tablaHorario}</div>` : ""}
        <div class="bloque"><h3>${icono("pin")}Dirección</h3><address>${esc(direccionCompleta)}</address>
          <a class="enlace" href="${esc(comoLlegar)}" target="_blank" rel="noopener">Cómo llegar ${icono("flecha")}</a></div>
        ${d.zonaServicio?.length ? `<div class="bloque"><h3>${icono("pin")}Zonas donde trabajamos</h3><p>${d.zonaServicio.map(esc).join(" · ")}</p></div>` : ""}
        <div class="bloque acciones">${botonCta()}${botonTel()}${
    d.email ? `<a class="btn btn-secundario" href="mailto:${esc(d.email)}">${icono("correo")}${esc(d.email)}</a>` : ""
  }</div>
      </div>
      <iframe class="mapa" src="${esc(mapaEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de ${esc(d.nombre)}"></iframe>
    </div>
  </div></section>`;

  const banda = ctaHref
    ? `<section class="banda"><div class="wrap banda-dentro">
    <div><h2>${esc(d.textoBanda || `${ctaTexto} en ${d.nombre}`)}</h2><p>${esc(d.subtextoBanda || (ctaIcono === "chat" ? "Escríbenos por WhatsApp y te respondemos lo antes posible." : "Estaremos encantados de atenderte."))}</p></div>
    <div class="acciones">${botonCta("btn btn-claro")}${botonTel("btn btn-borde-claro")}</div>
  </div></section>`
    : "";

  const redes = Object.entries(d.redes || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(k[0].toUpperCase() + k.slice(1))}</a>`)
    .join("");

  const logo = `<span class="logo-marca" aria-hidden="true">${esc((d.nombre.trim()[0] || "·").toUpperCase())}</span>`;
  const barraMovil = ctaHref || tel ? `<nav class="barra" aria-label="Contacto rápido">${botonCta()}${botonTel()}</nav>` : "";
  const fuente = `${prefijo}recursos/fuentes/plus-jakarta-sans.woff2`;

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
<link rel="preload" href="${fuente}" as="font" type="font/woff2" crossorigin>
${portada ? `<link rel="preload" as="image" href="${esc(portada.src)}" fetchpriority="high">` : ""}
${schemas(d, sector, url)}
<style>
  @font-face { font-family: "Jakarta"; src: url("${fuente}") format("woff2"); font-weight: 200 800; font-display: swap; }
  :root {
    --c: ${color};
    --c-osc: color-mix(in srgb, var(--c) 72%, black);
    --c-suave: color-mix(in srgb, var(--c) 9%, white);
    --c-texto: var(--c);
    --fg: #15181d; --muted: #5d6470; --bg: #ffffff; --bg-alt: #f6f5f2; --linea: #e8e5df; --tarjeta: #ffffff;
    --sombra: 0 1px 2px rgba(16,24,40,.05), 0 18px 40px -18px rgba(16,24,40,.18);
    --radio: 22px;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #eef0f3; --muted: #a4abb6; --bg: #0f1114; --bg-alt: #15181c; --linea: #262a30; --tarjeta: #181b20;
      --c-suave: color-mix(in srgb, var(--c) 18%, #0f1114); --c-texto: color-mix(in srgb, var(--c) 50%, white);
      --sombra: 0 1px 2px rgba(0,0,0,.3), 0 18px 40px -18px rgba(0,0,0,.6);
      color-scheme: dark;
    }
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 84px; -webkit-text-size-adjust: 100%; }
  body { margin: 0; font: 400 17px/1.65 "Jakarta", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); background: var(--bg); -webkit-font-smoothing: antialiased; }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  h1, h2, h3 { line-height: 1.15; letter-spacing: -.02em; margin: 0; }
  h2 { font-size: clamp(1.75rem, 3.6vw, 2.6rem); font-weight: 750; }
  h3 { font-size: 1.2rem; font-weight: 700; }
  .wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }
  .ico { width: 1.15em; height: 1.15em; flex: none; }
  .antetitulo { margin: 0 0 12px; color: var(--c-texto); font-weight: 700; font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; }
  .intro { color: var(--muted); font-size: 1.08rem; margin: 16px 0 0; max-width: 62ch; }
  .centro { text-align: center; } .centro .intro { margin-inline: auto; }
  .mas { margin-top: 40px; }
  .seccion { padding: clamp(64px, 9vw, 112px) 0; }
  .seccion.alt { background: var(--bg-alt); }
  .cabecera { margin-bottom: clamp(32px, 5vw, 56px); }
  .tarjeta { background: var(--tarjeta); border: 1px solid var(--linea); border-radius: var(--radio); box-shadow: var(--sombra); }

  /* Botones */
  .acciones { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 22px; border-radius: 999px; font-weight: 650; font-size: 1rem; text-decoration: none; white-space: nowrap; border: 1.5px solid transparent; transition: transform .15s ease, background .15s ease, box-shadow .15s ease; }
  .btn:hover { transform: translateY(-1px); }
  .btn-primario { background: var(--c); color: #fff; box-shadow: 0 10px 24px -10px var(--c); }
  .btn-primario:hover { background: var(--c-osc); }
  .btn-secundario { background: var(--tarjeta); color: var(--fg); border-color: var(--linea); }
  .btn-secundario:hover { border-color: var(--c-texto); color: var(--c-texto); }
  .btn-claro { background: #fff; color: var(--c-osc); }
  .btn-borde-claro { color: #fff; border-color: rgba(255,255,255,.55); }
  .btn-borde-claro:hover { background: rgba(255,255,255,.12); }
  .enlace { display: inline-flex; align-items: center; gap: 6px; color: var(--c-texto); font-weight: 650; text-decoration: none; }
  .enlace:hover { text-decoration: underline; }

  /* Barra superior */
  .top { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: saturate(1.4) blur(14px); -webkit-backdrop-filter: saturate(1.4) blur(14px); border-bottom: 1px solid var(--linea); }
  .top .wrap { display: flex; align-items: center; gap: 24px; height: 72px; }
  .logo { display: flex; align-items: center; gap: 12px; text-decoration: none; font-weight: 750; font-size: 1.08rem; letter-spacing: -.01em; min-width: 0; }
  .logo span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .logo-marca { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: var(--c); color: #fff; font-weight: 800; flex: none; }
  .top nav { display: flex; gap: 28px; margin-left: auto; }
  .top nav a { text-decoration: none; color: var(--muted); font-weight: 550; font-size: .95rem; white-space: nowrap; }
  .top nav a:hover { color: var(--fg); }
  .top .btn { padding: 10px 18px; font-size: .95rem; }
  .top .tel { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-weight: 650; white-space: nowrap; }
  @media (max-width: 1180px) { .top .tel { display: none; } }

  /* Portada */
  .hero { position: relative; overflow: hidden; padding: clamp(40px, 7vw, 88px) 0 0; background:
      radial-gradient(900px 480px at 85% 0%, var(--c-suave), transparent 70%),
      radial-gradient(700px 420px at 0% 100%, color-mix(in srgb, var(--c-suave) 70%, transparent), transparent 70%); }
  .hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: clamp(32px, 6vw, 72px); align-items: center; }
  .pildora { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; background: var(--c-suave); color: var(--c-texto); font-weight: 650; font-size: .88rem; }
  .hero h1 { font-size: clamp(2.5rem, 6vw, 4.3rem); font-weight: 800; letter-spacing: -.035em; margin: 22px 0 0; }
  .hero .eslogan { font-size: clamp(1.1rem, 1.8vw, 1.3rem); color: var(--muted); margin: 20px 0 0; max-width: 34ch; }
  .hero .acciones { margin-top: 34px; }
  .confianza { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 28px; color: var(--muted); font-size: .95rem; }
  .confianza span { display: inline-flex; align-items: center; gap: 8px; }
  .confianza .estrella { color: #f5a524; fill: #f5a524; }
  .estado { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; font-weight: 650; padding: 3px 10px; border-radius: 999px; letter-spacing: 0; }
  .estado:empty { display: none; }
  .estado::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .estado.abierto { background: #dcf5e3; color: #12692f; } .estado.cerrado { background: #fde4e1; color: #9b2217; }
  .hero-grid.sin-foto { grid-template-columns: 1fr; }
  .hero-grid.sin-foto .eslogan { max-width: 52ch; }
  .hero-foto { position: relative; }
  .hero-foto img { width: 100%; aspect-ratio: 5 / 4.4; object-fit: cover; border-radius: 32px; box-shadow: var(--sombra); }
  .insignia { position: absolute; left: -22px; bottom: 28px; display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--tarjeta); border: 1px solid var(--linea); border-radius: 18px; box-shadow: var(--sombra); }
  .insignia strong { font-size: 1.6rem; font-weight: 800; letter-spacing: -.02em; }
  .insignia small { display: block; color: var(--muted); font-size: .82rem; line-height: 1.35; }
  .insignia .estrellas { color: #f5a524; letter-spacing: 1px; font-size: .95rem; }
  .datos { display: grid; grid-template-columns: repeat(${Math.max(destacados.length, 1)}, 1fr); margin-top: clamp(48px, 7vw, 80px); border-top: 1px solid var(--linea); }
  .dato { display: flex; gap: 14px; padding: 26px 22px 30px 0; }
  .dato + .dato { padding-left: 22px; border-left: 1px solid var(--linea); }
  .dato .ico { width: 42px; height: 42px; padding: 10px; border-radius: 12px; background: var(--c-suave); color: var(--c-texto); }
  .dato strong { display: block; font-weight: 700; line-height: 1.3; }
  .dato span { color: var(--muted); font-size: .92rem; line-height: 1.45; display: block; margin-top: 2px; }

  /* Sobre */
  .sobre { display: grid; grid-template-columns: .95fr 1.05fr; gap: clamp(32px, 6vw, 80px); align-items: center; }
  .sobre.sin-imagen { grid-template-columns: 1fr; }
  .sobre-img img { width: 100%; aspect-ratio: 1 / 1.05; object-fit: cover; border-radius: 28px; }
  .checks { list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
  .checks li { display: flex; align-items: center; gap: 10px; font-weight: 600; }
  .checks .ico { width: 26px; height: 26px; padding: 5px; border-radius: 50%; background: var(--c); color: #fff; stroke-width: 3; }

  /* Servicios */
  .servicios { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .servicios.planos { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .servicios.planos.pares { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .servicio { overflow: hidden; display: flex; flex-direction: column; }
  .servicio-img img { width: 100%; aspect-ratio: 16 / 8; object-fit: cover; }
  .servicio-cuerpo { padding: 26px 28px 28px; }
  .servicio h3 { margin-bottom: 6px; }
  .lista-servicios { list-style: none; margin: 0; padding: 0; }
  .lista-servicios li { padding: 14px 0; border-bottom: 1px solid var(--linea); }
  .lista-servicios li:last-child { border-bottom: 0; padding-bottom: 0; }
  .lista-servicios p, .servicios.planos p { margin: 4px 0 0; color: var(--muted); font-size: .95rem; line-height: 1.5; }
  .fila { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
  .precio { font-weight: 750; color: var(--c-texto); white-space: nowrap; }

  /* Opiniones */
  .resenas { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .resena { margin: 0; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
  .resena .estrellas { color: #f5a524; letter-spacing: 2px; }
  .resena blockquote { margin: 0; font-size: 1.05rem; flex: 1; }
  .resena figcaption { display: flex; align-items: center; gap: 12px; font-weight: 650; }
  .avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--c-suave); color: var(--c-texto); font-weight: 800; }
  .cabecera .intro .ico { vertical-align: -3px; }

  /* Galería (carrusel sin huecos) */
  .galeria { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - 48px) / 3.25); gap: 24px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 12px; scrollbar-width: thin; }
  .galeria img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radio); scroll-snap-align: start; }

  /* Preguntas */
  .faq { display: grid; grid-template-columns: .8fr 1.2fr; gap: clamp(32px, 6vw, 80px); align-items: start; }
  .faq .acciones { margin-top: 28px; }
  .acordeon details { background: var(--tarjeta); border: 1px solid var(--linea); border-radius: 16px; padding: 0 22px; margin-bottom: 12px; }
  .acordeon summary { cursor: pointer; list-style: none; font-weight: 650; padding: 20px 32px 20px 0; position: relative; }
  .acordeon summary::-webkit-details-marker { display: none; }
  .acordeon summary::after { content: "+"; position: absolute; right: 0; top: 50%; transform: translateY(-50%); font-size: 1.5rem; font-weight: 400; color: var(--c-texto); transition: transform .2s; }
  .acordeon details[open] summary::after { transform: translateY(-50%) rotate(45deg); }
  .acordeon details p { margin: 0 0 20px; color: var(--muted); }

  /* Contacto */
  .contacto { display: grid; grid-template-columns: .9fr 1.1fr; gap: 24px; align-items: stretch; }
  .contacto-datos { padding: 32px; display: flex; flex-direction: column; gap: 28px; }
  .bloque h3 { display: flex; align-items: center; gap: 10px; font-size: 1.05rem; margin-bottom: 12px; flex-wrap: wrap; }
  .bloque h3 .ico { color: var(--c-texto); }
  address { font-style: normal; margin-bottom: 8px; }
  .horario { border-collapse: collapse; width: 100%; font-size: .97rem; }
  .horario th, .horario td { text-align: left; padding: 8px 0; border-bottom: 1px dashed var(--linea); vertical-align: top; }
  .horario th { font-weight: 500; color: var(--muted); width: 45%; }
  .horario td { text-align: right; font-variant-numeric: tabular-nums; }
  .horario tr:last-child th, .horario tr:last-child td { border-bottom: 0; }
  .horario tr.hoy th, .horario tr.hoy td { color: var(--c-texto); font-weight: 750; }
  .cerrado { color: var(--muted); }
  .mapa { width: 100%; min-height: 420px; height: 100%; border: 0; border-radius: var(--radio); background: var(--bg-alt); box-shadow: var(--sombra); }

  /* Banda final */
  .banda { background: linear-gradient(135deg, var(--c), var(--c-osc)); color: #fff; padding: clamp(56px, 8vw, 88px) 0; }
  .banda-dentro { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
  .banda h2 { color: #fff; } .banda p { margin: 10px 0 0; opacity: .85; font-size: 1.08rem; }

  /* Pie */
  footer { background: #101215; color: #c5cad3; padding: 64px 0 32px; font-size: .95rem; }
  .pie { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 40px; }
  footer .logo { color: #fff; margin-bottom: 14px; }
  footer h4 { color: #fff; font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 14px; }
  footer p { margin: 0 0 8px; } footer a { color: #fff; text-decoration: none; } footer a:hover { text-decoration: underline; }
  .redes { display: flex; gap: 16px; margin-top: 16px; }
  .legal { margin-top: 48px; padding-top: 24px; border-top: 1px solid #23272d; color: #8a909b; font-size: .85rem; }

  .barra { display: none; }

  @media (max-width: 960px) {
    .top nav, .top .tel { display: none; }
    .top .btn { margin-left: auto; }
    .hero-grid, .sobre, .faq, .contacto { grid-template-columns: 1fr; }
    .hero-foto { max-width: 640px; }
    .insignia { left: 16px; bottom: 16px; }
    .datos { grid-template-columns: repeat(2, 1fr); }
    .dato:nth-child(3) { border-left: 0; padding-left: 0; }
    .dato:nth-child(n+3) { border-top: 1px solid var(--linea); }
    .servicios, .servicios.planos, .servicios.planos.pares { grid-template-columns: 1fr; }
    .galeria { grid-auto-columns: 72%; }
    .pie { grid-template-columns: 1fr 1fr; } .pie > :first-child { grid-column: 1 / -1; }
    .mapa { min-height: 320px; }
  }
  @media (max-width: 640px) {
    .wrap { padding: 0 18px; }
    .top .btn { display: none; }
    .datos { grid-template-columns: 1fr; }
    .dato, .dato + .dato { padding: 18px 0; border-left: 0; }
    .dato + .dato { border-top: 1px solid var(--linea); }
    .checks { grid-template-columns: 1fr; }
    .servicio-cuerpo, .contacto-datos { padding: 22px; }
    .galeria { grid-auto-columns: 84%; gap: 14px; }
    .pie { grid-template-columns: 1fr; }
    .hero .acciones .btn, .banda .btn, .faq .btn, .contacto .acciones .btn { flex: 1 1 100%; }
    .barra { display: flex; gap: 8px; position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--linea); }
    .barra .btn { flex: 1; padding: 13px 8px; font-size: clamp(.85rem, 3.9vw, 1rem); gap: 7px; }
    body { padding-bottom: 80px; }
  }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .btn { transition: none; } }
</style>
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="logo" href="#">${logo}<span>${esc(d.nombre)}</span></a>
    <nav aria-label="Secciones">${menu.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join("")}</nav>
    ${tel ? `<a class="tel" href="tel:${esc(tel)}">${icono("telefono")}${esc(d.telefono)}</a>` : ""}
    ${botonCta()}
  </div>
</header>
<main>
  <section class="hero">
    <div class="wrap">
      <div class="hero-grid${portada ? "" : " sin-foto"}">
        <div>
          ${subtitulo ? `<span class="pildora">${icono("pin")}${esc(subtitulo)}</span>` : ""}
          <h1>${esc(d.nombre)}</h1>
          ${d.eslogan ? `<p class="eslogan">${esc(d.eslogan)}</p>` : ""}
          <div class="acciones">${botonCta()}${botonTel()}</div>
          <div class="confianza">
            ${d.valoracion && !portada ? `<span>${icono("estrella", "ico estrella")}<strong>${nota}</strong>${d.numResenas ? ` · ${esc(d.numResenas)} opiniones en Google` : ""}</span>` : ""}
            ${d.horario ? `<span>${icono("reloj")}<span class="estado" data-estado></span><span data-proximo></span></span>` : ""}
          </div>
        </div>
        ${
          portada
            ? `<div class="hero-foto"><img src="${esc(portada.src)}" alt="${esc(portada.alt)}" fetchpriority="high" decoding="async">${
                d.valoracion
                  ? `<div class="insignia"><strong>${nota}</strong><div><div class="estrellas" aria-hidden="true">${estrellas(d.valoracion)}</div><small>${
                      d.numResenas ? `${esc(d.numResenas)} opiniones` : "Opiniones"
                    } en Google</small></div></div>`
                  : ""
              }</div>`
            : ""
        }
      </div>
      <div class="datos">${destacados
        .map((x) => `<div class="dato">${icono(x.icono || "check")}<div><strong>${esc(x.titulo)}</strong>${x.texto ? `<span>${esc(x.texto)}</span>` : ""}</div></div>`)
        .join("")}</div>
    </div>
  </section>
  ${servicios}
  ${sobre}
  ${resenas}
  ${galeria}
  ${preguntas}
  ${contacto}
  ${banda}
</main>
<footer>
  <div class="wrap">
    <div class="pie">
      <div>
        <a class="logo" href="#">${logo}<span>${esc(d.nombre)}</span></a>
        <p>${esc(subtitulo || d.categoria || "")}</p>
        ${redes ? `<div class="redes">${redes}</div>` : ""}
      </div>
      <div>
        <h4>Contacto</h4>
        <p>${esc(direccionCompleta)}</p>
        ${d.telefono ? `<p><a href="tel:${esc(tel)}">${esc(d.telefono)}</a></p>` : ""}
        ${d.email ? `<p><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></p>` : ""}
      </div>
      <div>
        <h4>Horario</h4>
        ${horarioResumen.map((g) => `<p>${esc(g.dias)}: ${esc(g.horas)}</p>`).join("")}
      </div>
    </div>
    <p class="legal">© ${new Date().getFullYear()} ${esc(d.nombre)}</p>
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
    var ayer = (dia + 6) % 7, cierre = null;
    horario[dia].forEach(function (t) {
      var r = t.split("-"), ini = min(r[0]), fin = min(r[1]);
      if (fin > ini ? ahora >= ini && ahora < fin : ahora >= ini) cierre = r[1];
    });
    horario[ayer].forEach(function (t) {
      var r = t.split("-"), ini = min(r[0]), fin = min(r[1]);
      if (fin <= ini && ahora < fin) cierre = r[1]; // tramos que pasan de medianoche
    });
    var proximo = "";
    if (cierre) proximo = "Hasta las " + cierre;
    else {
      var hoy = horario[dia].map(function (t) { return t.split("-")[0]; }).filter(function (h) { return min(h) > ahora; });
      if (hoy.length) proximo = "Abre a las " + hoy[0];
      else for (var k = 1; k <= 7; k++) {
        var s = horario[(dia + k) % 7];
        if (s.length) { proximo = "Abre " + (k === 1 ? "mañana" : ${JSON.stringify(DIAS_TXT.map((t) => t.toLowerCase()))}[(dia + k) % 7]) + " a las " + s[0].split("-")[0]; break; }
      }
    }
    document.querySelectorAll("[data-estado]").forEach(function (e) {
      e.textContent = cierre ? "Abierto ahora" : "Cerrado ahora"; e.className = "estado " + (cierre ? "abierto" : "cerrado");
    });
    document.querySelectorAll("[data-proximo]").forEach(function (e) { e.textContent = proximo; });
    var fila = document.querySelector('.horario tr[data-dia="' + dia + '"]');
    if (fila) fila.classList.add("hoy");
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
  // URL pública: dominio propio del local, o la de Cloudflare que pasa el workflow (SITE_URL)
  const base = (process.env.SITE_URL || "").replace(/\/?$/, "/").replace(/^\/$/, "");
  const urlDe = (slug, d) => (d.dominio ? d.dominio.replace(/\/?$/, "/") : base ? (enRaiz ? base : `${base}${slug}/`) : "");
  for (const { slug, dir, d } of lista) {
    for (const f of todasLasFotos(d)) {
      if (!esAbsoluta(f.src) && !fs.existsSync(path.join(dir, f.src))) throw new Error(`[${slug}] no existe la imagen "${f.src}"`);
    }
    const salida = enRaiz ? DIST : path.join(DIST, slug);
    const url = urlDe(slug, d);
    fs.mkdirSync(salida, { recursive: true });
    copiarCarpeta(dir, salida);
    fs.writeFileSync(path.join(salida, "index.html"), pagina(d, url, enRaiz ? "" : "../"));
    console.log(`✔ ${slug}${d.demo === true ? " (demo, noindex)" : ""}${url ? `  ${url}` : ""}`);
  }

  if (!enRaiz) fs.writeFileSync(path.join(DIST, "index.html"), indice(lista));

  // Recursos comunes (tipografía) en la raíz de la web
  const recursos = path.join(DIST, "recursos");
  fs.mkdirSync(recursos, { recursive: true });
  copiarCarpeta(path.join(RAIZ, "recursos"), recursos);

  // robots.txt, sitemap y cabeceras (Cloudflare Pages lee _headers)
  const unico = enRaiz ? lista[0].d : null;
  if (unico && unico.demo !== true) {
    const url = urlDe(lista[0].slug, unico);
    fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n${url ? `Sitemap: ${url}sitemap.xml\n` : ""}`);
    if (url) {
      fs.writeFileSync(
        path.join(DIST, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(url)}</loc></url></urlset>\n`
      );
    }
  } else {
    // Ejemplos (demo): se deja rastrear para que Google vea el noindex, pero nunca se indexa.
    fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nAllow: /\n");
    fs.writeFileSync(path.join(DIST, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
  }

  console.log(`\n${lista.length} web(s) generadas en dist/${escaparate ? " (escaparate de ejemplos)" : ""}`);
}

main();
