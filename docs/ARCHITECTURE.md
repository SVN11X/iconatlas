# Arquitectura de IconAtlas

## Principios

1. **Estático por diseño.** Todo se ejecuta en el navegador; GitHub Pages solo sirve archivos. No hay backend, cuentas ni APIs de pago.
2. **El catálogo es datos, no código.** Proveedores, colecciones y fichas se describen en JSON (`src/catalog/`) y un script de Node genera artefactos optimizados (`public/catalog/`). La aplicación React no contiene listas de iconos.
3. **Licencias como parte del modelo.** Cada colección declara licencia, propietario, permisos (descarga, redistribución, modificación, uso comercial, atribución) y restricciones. La interfaz y la exportación obedecen esos datos.
4. **Fidelidad.** Los SVG se sirven tal como los publica la fuente (Iconify JSON es la representación original del paquete; los SVG vendorizados solo pasan una optimización conservadora). Los PNG se rasterizan desde el vector al tamaño final.

## Vista general

```
src/catalog/ (JSON fuente)          scripts/build-catalog  ──►  public/catalog/
  providers/providers.json            · carga fuentes            index.json      proveedores, colecciones, categorías, estadísticas, sinónimos
  collections/*.json                  · sanitiza y valida        icons.json      filas compactas de todos los recursos (~4 MB, ~0,6 MB gzip)
  manifests/reference/*.json          · clasifica y normaliza    svg/<col>/<n>.json  fragmentos de 400 SVG (carga bajo demanda)
  schemas/taxonomy|synonyms|...       · genera índices           details/<col>.json  metadatos extra (licencia por icono, colores, enlaces)
                                                                 report.json     informe de la compilación
```

```
Navegador
 ├─ CatalogProvider ── fetch index.json + icons.json ──► hidratación (Icon[] en memoria)
 │                    └─ SearchClient ──postMessage──► search.worker (MiniSearch)  ⇦ índice construido fuera del hilo principal
 ├─ ExplorePage ── filtros (URL) ── facetCounts ── IconGrid (virtualizado, @tanstack/react-virtual)
 │                                                └─ IconCard ─ IconImage ─ useIconPreview ─ getSvgData (fragmento + Cache Storage)
 ├─ IconDetail (ruta ?icon=) ── buildSvg ─ svgToPng (canvas) ─ clipboard
 └─ SelectionBar ── buildZip (fflate, local)
```

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| **Vite + React + TypeScript** | Compilación rápida, tipado estricto, ecosistema estándar. |
| **HashRouter** | GitHub Pages no reescribe rutas; con `#/` cualquier enlace compartido funciona bajo `/iconatlas/` sin páginas 404 especiales. |
| **`base` configurable (`BASE_PATH`)** | Funciona en `/<repo>/`, en dominio propio (`/`) o en previsualizaciones. |
| **MiniSearch en un Web Worker** | Índice invertido con prefijos, tolerancia a errores y *boosting*; ~1 s para indexar 52 000 documentos sin bloquear la UI; consultas de 1–25 ms. Fuse.js sería lineal (lento con este volumen). Hay modo de respaldo en el hilo principal. |
| **Sinónimos en tiempo de consulta** | `schemas/synonyms.json` expande consultas («vm» → «virtual machine», «base de datos» → «database»). Las puntuaciones se normalizan por consulta para que los sinónimos no superen a la coincidencia literal; los títulos que contienen todos los términos reciben bonificación. |
| **Filas compactas + fragmentos SVG** | La primera carga solo trae metadatos. Los SVG se piden por fragmentos de 400 iconos cuando una tarjeta es visible y se guardan en Cache Storage versionado por compilación. |
| **Virtualización** | Solo se renderizan las filas visibles de la cuadrícula (unas decenas de tarjetas aunque haya 50 000 resultados). |
| **`<img src="data:image/svg+xml">` para mostrar iconos** | Un SVG en `<img>` no ejecuta scripts ni comparte IDs con el documento: defensa XSS y sin colisiones de gradientes. Nunca se usa `innerHTML` con SVG. |
| **Rasterización con Canvas** | El SVG se redimensiona al tamaño de destino antes de dibujarlo (render vectorial a resolución completa). El origen es un `blob:` local, por lo que el canvas no queda contaminado (CORS). |
| **`ClipboardItem` con `Promise<Blob>`** | Mantiene la activación de usuario en Safari mientras se genera el PNG. Si no hay soporte, se informa y se ofrece descarga; nunca se muestra éxito falso. |
| **fflate** | ZIP en memoria, ligero (≈8 kB) y síncrono. |
| **Tailwind con variables CSS** | Temas claro/oscuro con tokens (`--bg`, `--fg`, `--accent`…) y contraste verificado con axe. |

## Seguridad

- **Compilación/importación** (`scripts/lib/svg-safety.mjs`): lista blanca de elementos; rechazo de `<script>`, `<foreignObject>`, `<iframe>`, `on*=`, `javascript:`, entidades XML, `@import` y referencias `href`/`url()` externas; límites de tamaño (512 KiB) y de `viewBox`. Los SVG importados pasan por un plugin SVGO que elimina contenido activo.
- **Ejecución:** `buildSvg` valida colores con una expresión estricta (`#rgb`/`#rrggbb`) y comprueba el documento final con DOMPurify (perfil SVG) **sin transformarlo**; si DOMPurify tuviera que eliminar algo, se rechaza.
- **CSP** estricta en producción (`script-src 'self'`, `object-src 'none'`, `connect-src 'self'`, sin orígenes externos).
- Sin proxies externos ni peticiones a terceros: todo el contenido se sirve desde el propio sitio.

## Almacenamiento local

| Clave | Formato |
|---|---|
| `iconatlas:favorites:v1` | `{ "v": 1, "ids": ["colección:nombre", …], "updatedAt": "ISO" }` (más reciente primero; acepta el formato antiguo `string[]`) |
| `iconatlas:recent-searches:v1` | `string[]` (máx. 8) |
| `iconatlas:theme:v1` | `"light"` \| `"dark"` |
| `iconatlas:lang:v1` | `"es"` \| `"en"` |
| `iconatlas:export-prefs:v1` | `{ "pngSize": 1024, "background": null \| "#rrggbb", "format": "svg" \| "png" \| "both" }` |
| Cache Storage `iconatlas-catalog-<generatedAt>` | Fragmentos SVG; las versiones antiguas se borran al cargar una nueva compilación. |

Los identificadores de icono (`colección:nombre`) son estables. Si una actualización retira un icono, los favoritos se conservan (la página de favoritos indica cuántos no están en el catálogo actual).

## Rendimiento (medido en la compilación actual)

- JS inicial: ~74 kB + 60 kB (gzip). Worker de búsqueda: 20 kB.
- `icons.json`: 4,0 MB → ~0,57 MB gzip (GitHub Pages sirve gzip).
- Indexación de búsqueda: ~1 s en un portátil, en segundo plano.
- Consultas: 1–25 ms. Filtrado + recuentos de facetas sobre 52 000 elementos: 14–50 ms (medido en Node 22).

## Estructura del repositorio

```
.github/workflows/   deploy.yml · validate.yml · sync-check.yml
docs/                documentación
e2e/                 pruebas Playwright (flujo de usuario, exportación, ZIP, accesibilidad, móvil, subruta)
public/              favicon, manifest (public/catalog se genera)
scripts/
  build-catalog/     generador del catálogo
  validate-icons/    validador
  check-sources/     comprobación de versiones, licencias y enlaces
  import-icons/      importador de colecciones
  lib/               seguridad SVG, clasificación, utilidades
src/
  app/               App, rutas, i18n, contexto del catálogo
  catalog/           providers/ · collections/ · manifests/reference/ · schemas/
  components/        layout · search · icons · filters · preview · ui
  hooks/ pages/ services/ (catalog · search · export · clipboard · storage) styles/ tests/ types/ utils/
vendor/              recursos vendorizados con licencia abierta (SAP BTP Solution Diagrams)
```
