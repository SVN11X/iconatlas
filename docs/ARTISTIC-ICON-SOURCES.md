# Bibliotecas artísticas, 3D, pixel art y banderas

Esta ampliación incorpora **12 repositorios** al registro de fuentes GitHub de
IconAtlas (de 77 a 89). Se reconocen por su nombre canónico `owner/repo`, aunque
el usuario haya compartido una URL terminada en `/tree/main` o `/tree/master`.

El workflow `Deploy to GitHub Pages` usa `npm run github:index` para descubrir
los archivos compatibles del árbol de cada repositorio. El frontend ofrece la
misma búsqueda visual y, **para los SVG seguros**, el editor compartido con
copia SVG, portapapeles y exportación SVG/PNG. Las imágenes raster se pueden
previsualizar y descargar, **no se vuelven vectoriales automáticamente**.

| Repositorio | Tipo principal | Observaciones |
| --- | --- | --- |
| `Fantomiald/sketchyicons` | SVG / paquetes generados | MIT para el generador y condiciones de Lucide/Feather para la geometría. Las compilaciones pueden generar más SVG que los presentes en el árbol fuente. |
| `guokaigdg/naive-icons` | SVG | SVG directos en `svg/`; componentes React adicionales. MIT. |
| `withevergrow/withicons` | SVG / estilos generados | Algunos estilos están empaquetados en npm/CDN o se generan mediante build: no confundir cifras del proyecto con SVG presentes en GitHub. MIT. |
| `shuqikhor/pixel-icons` | SVG | Pixel art en `icons/`; algunos dibujos representan marcas y personajes. MIT para el repositorio. |
| `Semporia/Hand-Painted-icon` | PNG | Material de 108 px identificado por el autor como **uso personal**. Sin SVG equivalentes garantizados. |
| `realvjy/3dicons` | Imágenes 3D | CC0-1.0 declarada en el repositorio; se indexan únicamente formatos admitidos. |
| `icons8/3d-kit` | PNG transparente | Archivo de 1200 × 1200 en `png/`. Su README exige enlazar a Icons8 salvo un plan de pago. |
| `icons8/flat-color-icons` | SVG | Archivos en `svg/`, bajo MIT o Good Boy License según documentación; es una muestra de un catálogo mayor. |
| `abderrahmane-harouat/rinaz-glassmorphism-icons` | No confirmado | El URL solicitado no se pudo corroborar; la auditoría de GitHub registrará 404 si corresponde. Una referencia externa apunta a otro propietario; no se cambia silenciosamente el repositorio. |
| `fjudith/cloud-native-isometric-icons` | Isométricos | Los **activos** tienen condiciones CC BY-ND 4.0 en README (atribución, no derivados y conservación del README); la licencia Apache-2.0 del código no anula esas condiciones. |
| `richbl/isometric-icons` | SVG | Basado en Material Design; revisar los créditos de geometría derivada. |
| `lipis/flag-icons` | SVG | Banderas en `flags/1x1/` y `flags/4x3/`, con relaciones de aspecto diferentes. MIT. |

## Qué se agrega y qué no

- Se registran y monitorean las 12 fuentes en la **misma experiencia de
  IconAtlas**, sin crear una sección separada ni descargar todos los binarios
  a `vendor/`.
- El índice remoto provisional queda inicialmente con cero recursos. GitHub
  Actions lo sustituye por los archivos encontrados durante el despliegue.
- Una biblioteca puede indexarse parcialmente, no contener SVG o resultar
  inaccesible. Los contadores definitivos se leen de
  `public/github-index/report.json` **después del despliegue**, no se inventan.
- El registro **no aprueba redistribución** ni atribuye permisos de edición de
  materiales con derechos restringidos. Se conserva procedencia y documentación
  de las condiciones de uso.

## Verificación

En Actions, abrir el paso `Construir índice universal de recursos GitHub
(registro dinámico)`, y consultar el informe publicado en
`/iconatlas/github-index/report.json`: comprobar `registeredSources` (89),
`indexedSources`, `failedSources`, `partialSources` e `indexedAssets`.
Para fuentes PNG, comprobar vista previa y descarga raster; para SVG, abrir
el editor completo desde el buscador y comprobar copia y exportación.
