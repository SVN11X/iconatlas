# Fuentes GitHub: integración, vigilancia y descubrimiento

## Qué incluye esta actualización

- Registro `src/catalog/github-sources.json`: 30 repositorios *candidatos o ya conocidos*, sin duplicar entradas.
- Action `github-health.yml`: diaria, verifica existencia, traslado, archivo, actividad y árbol de archivos; publica JSON y un issue con incidencias.
- Action `github-discover.yml`: semanal, busca nuevos repositorios con temas de iconos, cruza sus nombres con el registro y examina si tienen SVG o `.excalidrawlib`. Publica candidatos para revisión, no los importa.
- Action `github-import.yml`: **manual**, descarga un snapshot fijado por commit de una fuente aprobada y lo incorpora como SVG sanitizados a `vendor/<id>`. Ejecuta catálogo, validación, pruebas y genera un PR para revisión.
- Los SVG que se hayan importado se muestran, personalizan (si la licencia lo permite) y descargan dentro de IconAtlas, usando los mecanismos ya existentes. Las fichas sin SVG no presentan botón principal para salir a una web externa; se ofrece búsqueda interna y alternativas. Siguen existiendo enlaces de procedencia y licencia en los metadatos.

## Primer uso

1. Aplica el parche sobre la misma versión del ZIP y publícalo en `main`.
2. En GitHub, abre **Actions** y ejecuta `Auditar repositorios de iconos` y `Descubrir bibliotecas de iconos GitHub` para comprobar el registro inicial.
3. Revisa los reportes e incidencias generados. Un repositorio activo no implica licencia de redistribución.
4. Para cada colección que deseas alojar, verifica el permiso de redistribución **de los archivos SVG, no solo del código**, y edita su entrada en `src/catalog/github-sources.json`:

```json
{
  "id": "fuente-ejemplo",
  "repo": "autor/repositorio",
  "name": "Nombre de la colección",
  "category": "ui",
  "status": "approved",
  "license": "MIT",
  "licenseUrl": "https://github.com/autor/repositorio/blob/main/LICENSE",
  "redistributionApproved": true,
  "commercial": "yes",
  "attribution": "Autor original"
}
```

5. Ejecuta `Importar colección GitHub aprobada` en Actions, introduciendo el `source_id`. Revisa y fusiona el PR. **Se necesitan permisos para crear ramas y pull requests desde GitHub Actions** o deberás aplicar la importación manualmente.
6. Alternativa desde un clon local que tenga acceso a GitHub: `npm ci && npm run github:import -- --id fuente-ejemplo && npm run catalog && npm run catalog:validate && npm run build`. Revisa el diff antes de confirmar cambios.

## Qué NO hace automáticamente

- No incorpora colecciones con licencias desconocidas ni realiza scraping de sitios comerciales.
- No interpreta `.excalidrawlib`, iconos raster ni archivos PlantUML como si fueran SVG. Se detectan y reportan, pero requieren adaptadores adicionales.
- No busca en absolutamente todo GitHub: usa consultas periódicas y muestreo de repositorios públicos; GitHub API impone límites y los árboles pueden aparecer truncados.
- No promete almacenar millones de SVG en un único sitio GitHub Pages. Las colecciones grandes requieren distribución remota, partición del índice o CDN; el importador limita los lotes a 50.000 SVG y archivos ZIP a 75 MiB.
- No convierte automáticamente recursos de AWS, GCP, Azure, Workday ni marcas ajenas en activos libres. Los términos de cada propietario siguen aplicándose.

## Seguridad y operación

Las Actions de monitoreo/descubrimiento solo leen la API GitHub y no ejecutan código de repositorios de terceros. El importador solo toma un ZIP del commit SHA devuelto por la API de GitHub y lo pasa por el validador SVG existente. El token `GITHUB_TOKEN` se utiliza únicamente en Actions. Los SVG no se inyectan mediante `innerHTML` en el navegador.

Para detectar una actualización del upstream hay que ejecutar el importador nuevamente y revisar el PR; nunca se sincroniza automáticamente contenido potencialmente malicioso. Si falla un repositorio, el informe muestra la incidencia sin eliminar iconos ya publicados.

## Comprobaciones locales

```bash
node --test scripts/lib/github-repos.test.mjs
node scripts/github-health.mjs --out github-health-report.json
node scripts/github-discover.mjs --out github-discovery-report.json
npm run catalog
npm run catalog:validate
npm run build
```

Las dos comprobaciones de red requieren conectividad; para evitar el límite de 60 solicitudes por hora sin autenticar, usa `GITHUB_TOKEN` en el entorno.
