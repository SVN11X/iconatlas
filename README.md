# IconAtlas

**Todos tus iconos. Un solo lugar.**

IconAtlas es un catálogo universal de iconos que funciona íntegramente en el navegador y se publica gratis en GitHub Pages. Permite buscar, explorar, personalizar, copiar y descargar iconos de tecnología, cloud, desarrollo e interfaces sin instalar nada ni crear una cuenta.

```
https://USUARIO.github.io/iconatlas/
```

## Características

| Función | Estado |
|---|---|
| Catálogo de **52 104 recursos**: 51 858 iconos descargables de 14 bibliotecas + 246 fichas oficiales solo-enlace (Azure, AWS, Google Cloud, Databricks, Microsoft, SAP, Oracle) | ✅ |
| Búsqueda instantánea (Web Worker + MiniSearch) por nombre, proveedor, producto, categoría, etiquetas y sinónimos ES/EN, tolerante a errores, con autocompletado, búsquedas recientes y Ctrl+K / ⌘K | ✅ |
| Filtros combinables (proveedor, categoría, estilo, colección, características) reflejados en la URL | ✅ |
| Cuadrícula virtualizada con acciones rápidas (también en táctil) y navegación con flechas | ✅ |
| Ficha detallada: vista previa vectorial con fondos (transparente/blanco/negro/personalizado) y zoom, metadatos, licencia, permisos, variantes | ✅ |
| Descarga SVG original (viewBox, colores y gradientes intactos) | ✅ |
| Exportación PNG 64–4096 px o tamaño personalizado (hasta 8192), transparencia real o fondo de color | ✅ |
| Copiar imagen PNG, código SVG y nombre al portapapeles (con alternativa si el navegador no lo admite) | ✅ |
| Personalización (color, margen, fondo) solo cuando la licencia lo permite; marcas bloqueadas | ✅ |
| Favoritos persistentes (localStorage, sin registro) con búsqueda y descarga | ✅ |
| Selección múltiple y ZIP local (SVG, PNG o ambos) organizado por proveedor, con `LICENSES.txt` | ✅ |
| Tema claro/oscuro, español/inglés, diseño responsive, WCAG 2.2 AA (en la medida verificada) | ✅ |
| Importador de colecciones, validador y comprobación programada de fuentes | ✅ |
| Despliegue automático con GitHub Actions | ✅ |

## Tecnologías

React 18 · TypeScript · Vite 6 · Tailwind CSS 3 · React Router 7 (HashRouter) · MiniSearch · TanStack Virtual · fflate · DOMPurify · SVGO · Lucide · Vitest · Playwright · GitHub Actions/Pages.

> Se eligió **MiniSearch** en lugar de Fuse.js porque utiliza un índice invertido: con más de 50 000 documentos responde en ~1–25 ms, frente a los cientos de milisegundos de un escaneo difuso lineal.

## Requisitos

- Node.js ≥ 20 (probado con 22) y npm ≥ 10.

## Instalación y uso local

```bash
npm install
npm run dev        # genera el catálogo si no existe y abre http://localhost:5173/iconatlas/
npm run build      # regenera y valida el catálogo, comprueba tipos y compila en dist/
npm run preview    # sirve dist/ en http://localhost:4173/iconatlas/
npm run test       # pruebas unitarias (Vitest)
npm run test:e2e   # pruebas E2E (Playwright, contra la compilación)
```

Otros scripts:

| Script | Descripción |
|---|---|
| `npm run catalog` | Genera `public/catalog/` a partir de las colecciones y manifiestos |
| `npm run catalog:validate` | Valida IDs, categorías, rutas, seguridad de SVG y permisos |
| `npm run catalog:check-sources` | Detecta nuevas versiones, iconos nuevos/retirados, cambios de licencia y enlaces rotos (no modifica nada) |
| `npm run import-icons -- --help` | Importa una colección desde carpeta, ZIP, IconifyJSON o paquete npm |
| `npm run typecheck` | Comprobación de tipos |

Si Playwright no puede descargar navegadores en tu entorno, usa uno instalado: `PW_CHROMIUM=/ruta/a/chromium npm run test:e2e`.

## Publicación en GitHub Pages

1. Crea un repositorio público llamado `iconatlas` y sube el código a la rama `main`.
2. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
3. Cada `push` a `main` ejecuta `.github/workflows/deploy.yml`: instala, valida el catálogo, comprueba tipos, ejecuta pruebas unitarias y E2E, compila y publica.
4. El sitio queda en `https://USUARIO.github.io/iconatlas/`.

La ruta base se toma del nombre del repositorio (`BASE_PATH`). Para un dominio propio o un repositorio `USUARIO.github.io`, define `BASE_PATH=/`. Detalles en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Cómo se usa

**Ejemplo:** necesitas el icono de *SAP HANA Cloud* para una presentación.
Abre IconAtlas → escribe «hana cloud» → abre el icono → **Copiar imagen** (pégalo en PowerPoint) o **Descargar PNG/SVG**.

- **Buscar:** barra superior o Ctrl+K / ⌘K. Admite sinónimos (`vm`, `base de datos`, `k8s`, `gcp`…).
- **Filtrar:** panel lateral (en móvil, botón «Filtros»). La URL guarda la búsqueda para compartirla.
- **Descargar:** en la tarjeta (acciones rápidas) o en la ficha (tamaño, fondo, color, margen).
- **Varios a la vez:** marca la casilla de cada tarjeta (o Mayús+clic, o «Seleccionar resultados») y pulsa **Descargar ZIP**.
- **Recursos oficiales restringidos** (por ejemplo, *Azure Data Factory*): la ficha enlaza a la descarga oficial y muestra alternativas descargables verificadas cuando existen.

## Incorporar nuevas bibliotecas

Las colecciones se declaran como datos, sin tocar la aplicación:

```bash
npm i -D @iconify-json/mdi
npm run import-icons -- --source npm:@iconify-json/mdi --id mdi --name "Material Design Icons" \
  --owner "Pictogrammers" --homepage https://pictogrammers.com --license Apache-2.0 \
  --license-url https://github.com/Templarian/MaterialDesign/blob/master/LICENSE --redistributable yes
npm run catalog
```

Los nuevos iconos aparecen automáticamente en búsqueda, filtros, contadores, proveedores y fichas. Ver [docs/CATALOG.md](docs/CATALOG.md) y [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Estado de los proveedores solicitados

| Proveedor | Descargables | Fichas oficiales (solo enlace) | Nota |
|---|---|---|---|
| Microsoft | 5 700 (Fluent UI, Codicons, logotipos de marca) | 108 (Azure + productos) | Los iconos de Azure/M365/Entra/Fabric/Power Platform/Dynamics solo permiten uso en diagramas y documentación: se enlazan. |
| AWS | 4 (logotipos de marca) | 71 | AWS Architecture Icons: uso en diagramas y materiales; sin permiso de redistribución. |
| Google Cloud | 13 (logotipos) + Material Symbols (Google, 15 728) | 32 | Iconografía 2025+ en la fuente oficial; se distingue de los *legacy console icons*. |
| Databricks | 3 (logotipos) | 12 | Sin iconos de producto con licencia redistribuible; no se fabrican versiones «oficiales». |
| SAP | **835 oficiales** (128 iconos de servicios SAP BTP + 705 SAP Fiori/UI5, Apache-2.0) | 8 | Integrados desde repositorios oficiales de SAP con licencia Apache-2.0. |
| Oracle | 2 (logotipos) | 15 | OCI Architecture Diagram Toolkits sin permiso de redistribución verificado. |
| IBM | 2 631 (Carbon, oficial) | — | |
| Otros (Cloudflare, Red Hat, Vercel, Netlify, Supabase, Firebase, MongoDB, Snowflake, DigitalOcean, Alibaba, Tencent, Huawei, OVHcloud, Hetzner, Vultr, Akamai, VMware, OpenStack, Salesforce, Cisco, Fortinet, Palo Alto…) | logotipos de Simple Icons / Devicon / SVG Logos | — | Cada proveedor tiene su colección/filtro; preparados para fuentes oficiales futuras. |

## Limitaciones conocidas

- Los iconos oficiales de arquitectura de **Azure, AWS, Google Cloud y Oracle** y los recursos de marca de **Databricks** no se redistribuyen: sus términos no lo permiten. IconAtlas muestra fichas con enlace oficial.
- Copiar imágenes requiere HTTPS y soporte de `ClipboardItem` (Chrome/Edge/Safari/Firefox recientes).
- La categorización de bibliotecas genéricas es automática (palabras clave) y puede tener imprecisiones; ~20 % de los iconos quedan en «Otros».
- Los favoritos se guardan por navegador (sin sincronización).
- La primera carga descarga el índice de metadatos (~4 MB sin comprimir, ~0,8 MB con gzip); los SVG se cargan por fragmentos bajo demanda.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) · [Catálogo](docs/CATALOG.md) · [Licencias](docs/LICENSES.md) · [Contribuir](docs/CONTRIBUTING.md) · [Despliegue](docs/DEPLOYMENT.md)

## Licencia

El código de IconAtlas se distribuye bajo licencia [MIT](LICENSE). Cada colección de iconos conserva su propia licencia (ver [docs/LICENSES.md](docs/LICENSES.md)). Las marcas y logotipos pertenecen a sus respectivos propietarios.
