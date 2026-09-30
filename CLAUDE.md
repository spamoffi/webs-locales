# Webs de locales — pautas del proyecto

1. Webs **sin mantenimiento**: HTML estático generado por `build.js` (Node, sin dependencias). Nada de servidores, bases de datos ni librerías externas.
2. Cada web debe estar **optimizada para su local**: elegir el `tipo` de sector correcto, textos pensados para búsquedas locales ("<categoría> en <zona>"), servicios con precios, preguntas frecuentes útiles, contacto directo (WhatsApp con mensaje prellenado, teléfono, cómo llegar).
3. **Una rama por local**: `local/<nombre>` creada desde `main`, con una única carpeta `locales/<nombre>/`. `main` solo tiene la plantilla y `ejemplos/`.
4. Las webs son **demos** para enseñar al cliente: `"demo": true` (noindex). Solo se pone `false` cuando el cliente la contrata y tiene dominio.
5. Hosting: Cloudflare Workers (estático, configurado en `wrangler.jsonc`) publica cada rama en `https://<rama-con-guiones>-webs-locales.<subdominio>.workers.dev`. Las ramas `local/...` nunca se fusionan en `main`.

Antes de subir una demo: `node build.js` sin errores y revisar la web a 390px y 1280px, en modo claro y oscuro.
Las mejoras de la plantilla se hacen en `main`. Los datos de un local, solo en su rama.
El README tiene la lista completa de campos de `datos.json`.
