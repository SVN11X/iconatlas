# Índice universal GitHub de IconAtlas

La búsqueda principal `#/explore?q=...` reúne **dos grupos claramente identificados**:

- Catálogo local de IconAtlas, con las acciones de edición, favoritos, ZIP y descarga ya existentes.
- Recursos públicos indexados de **todas las fuentes GitHub registradas**, con vista previa y descarga individual **bajo demanda desde el repositorio de origen**. No se copian esos binarios a `vendor/` y no se suman falsamente al contador de iconos locales.

## Automatización

El despliegue `.github/workflows/deploy.yml` ejecuta `npm run github:index` antes de la compilación, en cada push a `main`, manualmente y cada lunes. Usa `GITHUB_TOKEN` para consultar los metadatos, commit exacto y árboles GitHub de todos los repositorios registrados (incluidas las fuentes `watch` y `paused`). El índice estático `public/github-index/index.json` se reconstruye dentro del artefacto publicado.

El fichero versionado `public/github-index/index.json` es solo un *bootstrap* sin activos; evita 404 en pruebas locales. Se reemplaza por el resultado real durante la Action. Para generar el índice localmente, ejecuta `npm run github:index` (opcionalmente define `GITHUB_TOKEN`).

El informe de cobertura `public/github-index/report.json` se publica como artefacto de la Action. Incluye por fuente `count`, `partial`, `error`. Los árboles truncados se intentan recorrer por subárboles; una fuente nunca se etiqueta como completa si se supera el presupuesto de solicitudes. Repositorios inaccesibles, sin archivos admitidos o sin una estructura reconocible **siguen registrados, pero no proporcionan iconos individuales**.

## Alcance y límites expresos

- Indexamos archivos `.svg`, `.png`, `.webp`, `.avif`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.cur`, `.ani` y `.excalidrawlib` de hasta 10 MiB. Son descargables individualmente dentro de `/explore` cuando GitHub los sirve con CORS; los SVG pasan por la sanitización existente.
- Un repositorio que usa únicamente fuentes, React/JSX, CSS, sprites, PSD o paquetes comprimidos todavía necesita un **adaptador de extracción** para obtener iconos individuales. No anunciamos que todos sus elementos estén ya descargables. Una biblioteca Excalidraw se descarga como biblioteca, no como un SVG por elemento.
- Usamos commit SHA para evitar que una rama cambie entre la indexación y la descarga.
- No se transfieren ni se inventan derechos de uso o licencias. Cada archivo conserva la procedencia de su repositorio y las condiciones de uso siguen siendo aplicables. `status: watch` ya **no impide indexar**, pero **no autoriza copiar o redistribuir los SVG en `vendor/`**.
- La búsqueda del índice grande se ejecuta en un Web Worker para no bloquear la interfaz. Las coincidencias remotas se muestran en una cuadrícula separada dentro del mismo `/explore`, no en un sitio diferente. Los filtros del catálogo local no se aplican automáticamente a las fuentes GitHub.

## Validación

```
npm run typecheck
npm test
npm run build
npx playwright test
```

Después de hacer push, confirma que el informe de la Action muestra fuentes indexadas y archivos detectados. Si el índice se queda vacío, comprueba permisos y límites de la API GitHub en el paso `Construir índice universal de recursos GitHub`.
