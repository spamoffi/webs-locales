# Webs de locales

Webs de una sola página para negocios de Google Maps. Sin servidor, sin base de datos, sin plugins: **no necesitan mantenimiento**. Se publican gratis en Cloudflare (Workers, solo archivos estáticos).

## Cómo se trabaja

- **`main`** solo tiene la plantilla (`build.js`) y los ejemplos (`ejemplos/`). Su web publicada es un escaparate con los ejemplos.
- **Cada local tiene su propia rama `local/<nombre>`**, creada desde `main`, con una única carpeta `locales/<nombre>/datos.json`.
- Cloudflare publica cada rama automáticamente en su propia dirección, que es el enlace de la web para el cliente:
  `local/peluqueria-marta` → `https://local-peluqueria-marta-webs-locales.<tu-subdominio>.workers.dev`
- **Las ramas `local/...` nunca se fusionan en `main`.** Si se abre una pull request de un local, sirve solo para revisarlo.

### Crear la web de un local

```bash
git checkout main && git pull
git checkout -b local/peluqueria-marta
mkdir -p locales/peluqueria-marta
cp ejemplos/peluqueria/datos.json locales/peluqueria-marta/   # el ejemplo más parecido
# editar locales/peluqueria-marta/datos.json
node build.js                                                  # comprobar que genera sin errores
git add -A && git commit -m "Web: Peluquería Marta" && git push -u origin local/peluqueria-marta
```

### Dominio propio

Cada web se publica ya finalizada e indexable en su dirección de Cloudflare (URL canónica, `robots.txt` y `sitemap.xml` incluidos). Si el cliente tiene dominio propio, se añade `"dominio": "https://sudominio.es"` a su `datos.json`.

Los ejemplos de `ejemplos/` llevan `"demo": true`, que marca la página como `noindex` para que Google no los indexe.

## Sectores (`"tipo"`)

El tipo cambia el tipo de negocio que ve Google (schema.org), el título de la sección de servicios y el botón principal:

| tipo | Google lo ve como | Botón principal |
|---|---|---|
| `restaurante`, `bar` | Restaurant, BarOrPub | Reservar mesa |
| `cafeteria` | CafeOrCoffeeShop | Hacer un pedido |
| `panaderia` | Bakery | Hacer un encargo |
| `peluqueria`, `barberia`, `estetica`, `unas` | HairSalon, BeautySalon, NailSalon | Pedir cita |
| `dentista`, `clinica`, `fisioterapia`, `veterinario` | Dentist, MedicalClinic, Physiotherapy, VeterinaryCare | Pedir cita |
| `gimnasio` | ExerciseGym | Pedir información |
| `taller`, `reformas`, `fontaneria`, `electricista` | AutoRepair, HomeAndConstructionBusiness, Plumber, Electrician | Pedir presupuesto |
| `tienda` | Store | Consultar |
| `inmobiliaria` | RealEstateAgent | Contactar |
| `generico` (por defecto) | LocalBusiness | Contactar |

El botón principal abre WhatsApp con un mensaje ya escrito ("Hola, quería pedir cita"). Si el local usa una web de reservas (Booksy, TheFork…), pon el enlace en `enlaceReserva` y el botón irá ahí.

## Campos de `datos.json`

| Campo | Para qué | Ejemplo |
|---|---|---|
| `nombre` * | | `"Estudio Marta Peluqueros"` |
| `direccion` * | calle y número | `"Calle de Fuencarral 150"` |
| `codigoPostal`, `ciudad` | dirección completa para Google | `"28010"`, `"Madrid"` |
| `zona` | barrio o ciudad para el SEO: "Peluquería **en Chamberí, Madrid**" | `"Chamberí, Madrid"` |
| `tipo` | sector (tabla de arriba) | `"peluqueria"` |
| `categoria` | cómo se describe el negocio | `"Peluquería"` |
| `eslogan` | frase bajo el nombre | |
| `descripcion` | párrafo "Sobre…" | |
| `color` | color de marca | `"#3d3a6b"` |
| `telefono` | botón Llamar | `"+34 611 111 111"` |
| `whatsapp` | solo números con prefijo | `"34611111111"` |
| `email` | | |
| `enlaceReserva` | web de reservas o citas | |
| `textoBoton`, `tituloServicios` | cambiar los textos que pone el sector | |
| `googleMaps` | enlace de "Compartir" de la ficha | |
| `lat`, `lng` | coordenadas (opcional, mejora el SEO local) | `40.43`, `-3.70` |
| `zonaHoraria` | para el "Abierto ahora" | `"Europe/Madrid"` |
| `rangoPrecio` | `"€"`, `"€€"`, `"€€€"` | |
| `cocina` | solo restaurantes | `"Mediterránea"` |
| `zonaServicio` | oficios que se desplazan | `["Madrid", "Alcobendas"]` |
| `valoracion`, `numResenas` | | `4.9`, `87` |
| `horario` | tramos `HH:MM-HH:MM`, día cerrado = `[]` | `"lunes": ["09:00-14:00", "17:00-20:00"]` |
| `servicios` | lista `{nombre, detalle, precio}` o grupos `{grupo, items: [...]}` | |
| `resenas` | `{autor, estrellas, texto}` copiadas de Google | |
| `preguntas` | preguntas frecuentes `{p, r}` (Google puede mostrarlas) | |
| `portada` | foto grande de cabecera (horizontal) | `"fotos/portada.jpg"` |
| `imagenSobre` | foto junto a "Sobre…" | `"fotos/equipo.jpg"` |
| `servicios[].imagen` | foto de cada grupo de servicios (o de cada servicio) | `"fotos/osteopatia.jpg"` |
| `fotos` | galería; la primera sale más grande | `["fotos/1.jpg", "fotos/2.jpg"]` |
| `redes` | `{instagram, facebook, tiktok…}` | |
| `tituloSeo`, `metaDescripcion` | forzar título o descripción de Google | |
| `demo` | `true` = ejemplo, no se indexa en Google (solo para `ejemplos/`) | |
| `dominio` | dominio definitivo | `"https://estudiomarta.es"` |

\* obligatorio. Los campos vacíos no se muestran.

Todas las imágenes aceptan `"ruta.jpg"` o `{ "src": "ruta.jpg", "alt": "descripción para Google" }`. Van dentro de la carpeta del local (`locales/<nombre>/fotos/`) y `build.js` avisa si falta alguna.

## Fotos

Cada web lleva fotos: portada, "Sobre…", una por grupo de servicios y galería (4–6).

1. **Del propio local** (Google Maps, Instagram, web): lo mejor, pero hay que conseguirlas a mano.
2. **De bancos de fotos libres**: el workflow **Buscar fotos** (pestaña Actions → Buscar fotos → Run workflow) descarga candidatas a la rama `fotos-candidatas`, en `<local>/<búsqueda>/`, con `creditos.json`. Se eligen las buenas, se copian a `locales/<nombre>/fotos/` con nombres descriptivos (`fisioterapia-catarroja.jpg`) y se apuntan en `locales/<nombre>/fotos/CREDITOS.md`.
   Por defecto busca en **Openverse** (sin clave), solo fotos CC0 de bancos fiables (StockSnap, Rawpixel, WordPress, Nappy): uso comercial y sin atribución obligatoria. Se evita Flickr porque hay cuentas que marcan como dominio público fotos ajenas. También admite Pixabay o Pexels si se añade el secreto `PIXABAY_API_KEY` o `PEXELS_API_KEY`.

## Probar en local

```bash
node build.js
npx serve dist
```

## Publicar con Cloudflare (una sola vez)

La publicación la hace GitHub Actions (`.github/workflows/publicar.yml`) con cada `git push`:
- `main` → web principal (escaparate de ejemplos).
- Cualquier otra rama → su propia URL de vista previa, que aparece en la pull request ("View deployment") y en el resumen de la ejecución en la pestaña **Actions**.

Configuración necesaria:
1. En Cloudflare, un token de API creado con la plantilla **"Edit Cloudflare Workers"**.
2. En GitHub, **Settings → Secrets and variables → Actions → New repository secret**, con el nombre `CLOUDFLARE_API_TOKEN`.
3. En el Worker `webs-locales` de Cloudflare, **Settings → Build → Disconnect** (las builds del panel no hacen falta).
