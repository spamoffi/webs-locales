# Webs de locales

Webs de una sola página para negocios de Google Maps. Sin servidor, sin base de datos, sin plugins: **no necesitan mantenimiento**. Se publican gratis en Cloudflare (Workers, solo archivos estáticos).

## Cómo se trabaja

- **`main`** solo tiene la plantilla (`build.js`) y los ejemplos (`ejemplos/`). Su web publicada es un escaparate con los ejemplos.
- **Cada local tiene su propia rama `local/<nombre>`**, creada desde `main`, con una única carpeta `locales/<nombre>/datos.json`.
- Cloudflare publica cada rama automáticamente en su propia dirección, que es el enlace de la demo para el cliente:
  `local/peluqueria-marta` → `https://local-peluqueria-marta-webs-locales.<tu-subdominio>.workers.dev`
- **Las ramas `local/...` nunca se fusionan en `main`.** Si se abre una pull request de una demo, sirve solo para revisarla.

### Crear la demo de un local

```bash
git checkout main && git pull
git checkout -b local/peluqueria-marta
mkdir -p locales/peluqueria-marta
cp ejemplos/peluqueria/datos.json locales/peluqueria-marta/   # el ejemplo más parecido
# editar locales/peluqueria-marta/datos.json
node build.js                                                  # comprobar que genera sin errores
git add -A && git commit -m "Demo: Peluquería Marta" && git push -u origin local/peluqueria-marta
```

### Pasar una demo a web definitiva

En su `datos.json`: `"demo": false` y `"dominio": "https://sudominio.es"`. Así la web se indexa en Google y se generan `robots.txt`, `sitemap.xml` y la URL canónica.

## Demos y Google

Mientras `"demo"` no sea `false`, la web lleva `noindex` (en la página y en la cabecera `X-Robots-Tag`), así que **Google no la indexa**. Todo el SEO (títulos, descripción, datos estructurados) ya va preparado para cuando sea definitiva.

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
| `fotos` | rutas dentro de la carpeta del local o URLs | `["fotos/1.jpg"]` |
| `redes` | `{instagram, facebook, tiktok…}` | |
| `tituloSeo`, `metaDescripcion` | forzar título o descripción de Google | |
| `demo` | `false` = web definitiva e indexable | |
| `dominio` | dominio definitivo | `"https://estudiomarta.es"` |

\* obligatorio. Los campos vacíos no se muestran.

## Probar en local

```bash
node build.js
npx serve dist
```

## Publicar con Cloudflare (una sola vez)

El repo ya incluye `wrangler.jsonc`, que le dice a Cloudflare cómo generar y publicar la web.

1. En https://dash.cloudflare.com: **Workers & Pages → Create → Import a repository** y elige este repositorio.
2. Rama de producción: `main`. Comando de deploy: `npx wrangler deploy` (el que viene por defecto). El build ya lo hace `wrangler.jsonc`.
3. En **Settings → Build → Branch control**, activa **Builds for non-production branches**.

Desde entonces, cada `git push` a una rama publica o actualiza su demo sola. La dirección de cada rama aparece en la pestaña **Deployments** del Worker y en la pull request de GitHub.
