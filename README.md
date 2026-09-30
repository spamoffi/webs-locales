# Webs de locales

Webs de una sola página para negocios de Google Maps. Sin servidor, sin base de datos, sin plugins: **no necesitan mantenimiento**. Se publican gratis en GitHub Pages.

## Cómo añadir un local

1. Copia la carpeta `locales/ejemplo-cafeteria` y renómbrala (minúsculas y guiones, ej. `locales/peluqueria-marta`). Ese nombre será la URL.
2. Edita `datos.json` con la información del local (casi toda sale de su ficha de Google Maps).
3. Si tiene fotos, ponlas en la misma carpeta (ej. `fotos/1.jpg`) y añádelas a `"fotos": ["fotos/1.jpg"]`.
4. Sube los cambios a `main`. GitHub genera y publica la web sola.

La web quedará en `https://<usuario>.github.io/webs-locales/<nombre-carpeta>/`.

## Campos de `datos.json`

| Campo | Obligatorio | Ejemplo |
|---|---|---|
| `nombre` | sí | `"Cafetería El Rincón"` |
| `direccion` | sí | `"Calle Mayor 12, 28013 Madrid"` |
| `categoria` | | `"Cafetería y desayunos"` |
| `eslogan` | | frase corta bajo el nombre |
| `descripcion` | | párrafo "Sobre nosotros" |
| `color` | | color principal, `"#8a4b2a"` |
| `telefono` | | `"+34 600 000 000"` (activa el botón Llamar) |
| `whatsapp` | | solo números con prefijo, `"34600000000"` |
| `email` | | |
| `googleMaps` | | enlace de "Compartir" de la ficha de Google Maps |
| `zonaHoraria` | | `"Europe/Madrid"` (para el "Abierto ahora") |
| `valoracion`, `numResenas` | | `4.7`, `213` |
| `horario` | | `"lunes": ["09:00-14:00", "17:00-20:00"]`, día cerrado = `[]` |
| `servicios` | | lista de `{ "nombre", "detalle" }` |
| `resenas` | | lista de `{ "autor", "estrellas", "texto" }` copiadas de Google |
| `fotos` | | rutas o URLs de imágenes |
| `redes` | | `{ "instagram": "https://...", "facebook": "https://..." }` |

Los campos vacíos simplemente no se muestran.

## Probar en local

```bash
node build.js
npx serve dist   # o abre dist/<local>/index.html en el navegador
```

## Activar la publicación (una sola vez)

En GitHub: **Settings → Pages → Source: GitHub Actions**.
