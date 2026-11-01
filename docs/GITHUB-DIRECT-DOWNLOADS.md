# Fuentes GitHub: descargas dentro de IconAtlas

La sección `#/sources` permite visualizar y descargar archivos SVG, PNG, WebP, AVIF, JPEG, GIF, ICO, bibliotecas `.excalidrawlib` y cursores `.cur`/`.ani` desde repositorios públicos **sin redirigir el navegador a otra web**.

## Funcionamiento

1. GitHub REST API enumera el árbol del repositorio (bajo demanda, con caché de sesión).
2. El visitante elige un archivo y pulsa «Descargar».
3. El navegador consulta exclusivamente `raw.githubusercontent.com`, con `credentials: omit` y sin redirecciones.
4. El contenido se limita a 10 MiB, y los SVG se sanitizan antes de crear el archivo local.
5. El archivo se guarda en el dispositivo del visitante mediante una URL blob. IconAtlas no rehostea ni replica en `vendor/` estos archivos remotos.

## Límites

- La API GitHub sin autenticación tiene límites por usuario; los árboles recursivos de repositorios muy grandes pueden truncarse.
- CORS, repositorios inexistentes, archivos grandes o SVG con contenido activo pueden impedir la descarga. Se informa del error en el panel.
- Algunos proyectos publican iconos como CSS, sprites, paquetes de fuentes, JSX/React u otros formatos: esos proyectos requieren adaptadores específicos y no se convierten automáticamente en SVG.
- Descargar un recurso público no implica que su autor conceda permiso para modificarlo, redistribuirlo o utilizarlo comercialmente. Se conservan los metadatos de procedencia; antes de incorporar colecciones a `vendor/` se exige revisión de derechos por activo.
- Los iconos remotos no aparecen en el contador global del catálogo descargable ni en su buscador unificado hasta generar índices e importarlos mediante el pipeline autorizado.

## Pruebas

`npm run typecheck && npm test && npm run build && npx playwright test`
