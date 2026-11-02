# Fuentes Microsoft Fabric, Power BI y Google Cloud (noviembre 2026)

La integración se hace **desde el índice universal de GitHub**: cada repositorio
registrado se analiza en la Action de despliegue. Los archivos SVG que se
encuentren podrán consultarse en el buscador y abrirse en el editor compartido,
obteniéndose bajo demanda desde GitHub. No se copian a `vendor/` por defecto.

| Fuente | Archivos y particularidades |
| --- | --- |
| `FabricTools/fabric-icons` | SVG procedentes de `@fabric-msft/svg-icons`, publicados en su árbol `node_modules/@fabric-msft/svg-icons`. |
| `vytautas9/fabric-icons` | SVG individuales en `icons/high_res/`, además de bibliotecas de draw.io en XML; el índice actual solo indexa formatos compatibles. |
| `microsoft/PowerBI-Icons` | SVG y PNG oficiales, repositorio archivado desde el 29/10/2024. |
| `marclelijveld/Power-BI-Icons` | Fork de la colección de Microsoft: contiene duplicados y biblioteca diagrams.net XML. |
| `astrzala/FabricToolset` | SVG bajo `Microsoft Fabric & Azure Icon Pack`; otras carpetas contienen scripts. |
| `kevincobain2000/google-cloud-icons` | Fuente solicitada; no se pudo confirmar que la URL sea accesible. El informe de indexación mostrará si hay 404, error u otros archivos. |

## Condiciones de uso

La licencia MIT de **código** de algunos repositorios no transfiere automáticamente
derechos sobre logotipos o marcas de Microsoft y Google. La guía oficial de
Microsoft Fabric permite copiar, distribuir y mostrar sus iconos para usos
específicos (diagramas de arquitectura, formación o documentación), pero
restringe otras modificaciones o usos. IconAtlas conserva la procedencia y no
marca estas fuentes como aprobadas para redistribución a `vendor/`.

La edición, copia y exportación SVG/PNG en IconAtlas se aplican a SVG
**compatibles** que puedan descargarse y sanitizarse de forma segura.

## Comprobación en GitHub Actions

Tras subir a `main`, ejecutar o revisar `Deploy to GitHub Pages` y el paso
`Construir índice universal de recursos GitHub (registro dinámico)`.
Consultar `/github-index/report.json` para comprobar los seis repositorios,
sus cifras, y si alguno contiene errores o indexación parcial.
La cifra de SVG indexados y el número de bibliotecas no se deben suponer a
partir de un repositorio registrado; dependen del informe real.
