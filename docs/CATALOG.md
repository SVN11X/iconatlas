# Catálogo de IconAtlas

## Conceptos

| Concepto | Dónde | Descripción |
|---|---|---|
| **Proveedor** | `src/catalog/providers/providers.json` | Propietario de productos/marcas (Microsoft, AWS, SAP…). Incluye `match` (regex para asignar logotipos de bibliotecas de marcas), `logoIcon` y `officialIcons` (fuentes oficiales revisadas, con términos y fecha). |
| **Colección** | `src/catalog/collections/*.json` | Conjunto de archivos con licencia que permite redistribución (Iconify JSON, SVG vendorizados, UI5…). |
| **Ficha oficial solo-enlace** | `src/catalog/manifests/reference/*.json` | Recursos oficiales cuyos términos no permiten redistribución: se conservan únicamente como inventario de recursos pendientes en `report.json`; por defecto NO se publican como resultados sin SVG. |
| **Categoría** | `src/catalog/schemas/taxonomy.json` | Taxonomía unificada (34 categorías en 3 grupos) con palabras clave para la clasificación automática y mapeo de categorías nativas. |
| **Sinónimos** | `src/catalog/schemas/synonyms.json` | Grupos de equivalencias ES/EN y abreviaturas usados por la búsqueda. |
| **Nombres oficiales** | `src/catalog/schemas/title-overrides.json` | Nombres de marca que no se pueden deducir del identificador (p. ej. `dotnetcore` → «.NET Core»). |

## Modelo de un recurso

Cada recurso tiene un identificador único `colección:nombre` (p. ej. `sap-btp:sap-hana-cloud`, `azure-architecture:azure-data-factory`). En `public/catalog/icons.json` se guarda como fila compacta:

```json
["sap-hana-cloud", 10, "SAP HANA Cloud", 1, 0, 4, 0, 3, "", "sap-hana-cloud", "", 1]
```

| Campo | Significado |
|---|---|
| `name` | Identificador dentro de la colección (minúsculas y guiones) |
| `collection` | Índice en `collections` |
| `title` | Nombre visible/oficial |
| `category` | Índice en `categories` |
| `style` | Índice en `styles` (original, monochrome, outline, filled, duotone, …, external) |
| `provider` | Índice en `providers` |
| `shard` | Fragmento SVG (`svg/<colección>/<shard>.json`); `-1` = ficha de referencia solo con `--include-references` (no se publica por defecto) |
| `flags` | Bits: 1 monocromo (`currentColor`), 2 oficial, 4 color de marca conocido, 8 histórico |
| `tags` | Alias y etiquetas separados por `|` |
| `group` | Nombre base para agrupar variantes (outline/filled/…) |
| `hex` | Color oficial de marca (Simple Icons) |
| `priority` | Orden por tipo de colección (0 fichas oficiales … 3 interfaz) |

La licencia, el propietario, los permisos y las restricciones se heredan de la colección (`index.json`). Las excepciones por icono (p. ej. licencias específicas de Simple Icons, URL de guía de marca, colores) están en `details/<colección>.json`.

Ejemplo de definición de colección:

```json
{
  "id": "sap-btp",
  "name": "SAP BTP Solution Diagrams — Service Icons",
  "kind": "architecture",
  "provider": "sap",
  "source": { "type": "svg-folder", "path": "vendor/sap-btp-solution-diagrams/svg", "strip": "^\\d+-|_sd$",
              "upstream": "https://github.com/SAP/btp-solution-diagrams", "commit": "57199627c08f…" },
  "owner": "SAP SE",
  "license": { "spdx": "Apache-2.0", "title": "Apache 2.0", "url": "https://github.com/SAP/btp-solution-diagrams/blob/main/LICENSE" },
  "official": true,
  "permissions": { "download": true, "redistribute": true, "modify": false, "commercial": "yes", "attribution": true },
  "customization": "none",
  "restrictions": ["Iconos oficiales de servicios SAP BTP: se conservan sin modificar…"],
  "reviewed": "2026-10-18"
}
```

`customization`: `free` (color y apariencia libres), `brand-mono` (solo color oficial, negro o blanco — Simple Icons), `none` (diseño original obligatorio; solo fondo y margen).

## Tipos de fuente

| `source.type` | Uso |
|---|---|
| `iconify` | Paquete npm `@iconify-json/<set>` (`include`/`exclude` regex opcionales) |
| `iconify-file` | Archivo IconifyJSON vendorizado (`path`) |
| `ui5` | Paquete `@ui5/webcomponents-icons` (extrae `pathData` y `viewBox`) |
| `svg-folder` | Carpeta de SVG vendorizados (`path`, `strip` para limpiar nombres) — se sanitizan y optimizan de forma conservadora |
| `reference` | Fichas sin archivo (manifiestos de `manifests/reference`) |

## Proceso de compilación (`npm run catalog`)

1. Carga taxonomía, sinónimos, proveedores, colecciones y manifiestos.
2. Para cada colección: lee la fuente, omite iconos ocultos/obsoletos de Iconify y exclusiones declaradas, **valida la seguridad** de cada SVG, normaliza nombres, detecta el estilo por sufijo, determina la paleta (monocromo/multicolor), asigna proveedor (regex de marcas), categoría (categoría nativa → palabras clave → «Marcas»/«Otros») y nombre oficial.
3. Escribe fragmentos SVG de 400 iconos, `details/`, `icons.json` e `index.json` con estadísticas reales.
4. Para fichas oficiales calcula **alternativas descargables** (logotipos del mismo producto en colecciones abiertas).
5. Genera `report.json` (versiones, totales, rechazados, avisos). `--strict` hace fallar la compilación ante errores.

## Validación (`npm run catalog:validate`)

IDs únicos y bien formados, nombres no vacíos, categorías/estilos/proveedores existentes, fragmentos y SVG presentes, `viewBox` válido, SVG seguro, metadatos de licencia y permisos completos, coherencia de restricciones (una colección solo-enlace no puede permitir descarga; una colección con archivos debe permitir redistribución), `logoIcon` existentes y estadísticas coherentes. También se ejecuta en `npm test` y en CI.

## Duplicados y variantes

- Dentro de una colección, el ID es único; los iconos con el mismo nombre base y distinto estilo se agrupan como **variantes** (`group`) y se muestran en la ficha.
- Entre colecciones no se eliminan duplicados: el mismo producto puede tener logotipo multicolor (SVG Logos), monocromo (Simple Icons), icono de tecnología (Devicon) o ficha oficial; la ficha muestra «En otras colecciones».
- El importador omite archivos con **contenido idéntico** y renombra como `-2`, `-3`… los que comparten nombre con contenido distinto (registrado en `import-log.json`).

## Importadores

`npm run import-icons -- --help`. Fuentes admitidas: carpeta, ZIP, IconifyJSON (`.json`) y paquete npm (`npm:@iconify-json/x`). El importador exige `--license`, `--license-url`, `--owner` y `--redistributable yes`, sanitiza, normaliza, detecta duplicados, escribe `vendor/<id>/SOURCE.json` + `import-log.json` y crea `src/catalog/collections/<id>.json`.

## Actualizaciones (`npm run catalog:check-sources`)

Compara las versiones instaladas con las publicadas en npm, descarga el `icons.json` nuevo para calcular **iconos añadidos, retirados y renombrados** (alias), detecta **cambios de licencia** y comprueba **enlaces oficiales**. No modifica nada. El workflow semanal `sync-check.yml` abre o actualiza un issue `catalog-sync` con el informe.

Para actualizar una biblioteca abierta: `npm update @iconify-json/<set>` → `npm run catalog` → revisar `report.json` → PR. Las colecciones vendorizadas u oficiales restringidas **nunca** se actualizan automáticamente: requieren revisar los términos y actualizar `reviewed`.

Los iconos retirados no se eliminan de los favoritos de los usuarios (los IDs se conservan en su navegador).
