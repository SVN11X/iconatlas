# Licencias, fuentes y marcas

El **código** de IconAtlas se publica bajo licencia MIT (`LICENSE`). Cada **colección de iconos** conserva su propia licencia. La licencia de una biblioteca cubre los archivos y el trabajo de sus autores, **no concede derechos sobre las marcas** que representan.

Revisión de permisos: 18/10/2026.

## Bibliotecas integradas (descargables)

| Colección | Iconos | Propietario | Licencia | Atribución | Modificación en IconAtlas | Notas |
|---|---:|---|---|---|---|---|
| Material Symbols | 15 728 | Google | [Apache-2.0](https://github.com/google/material-design-icons/blob/master/LICENSE) | Conservar aviso de licencia (incluido en `LICENSES.txt`) | Libre | Oficial de Google |
| Phosphor Icons | 9 072 | Phosphor Icons | [MIT](https://github.com/phosphor-icons/core/blob/main/LICENSE) | — | Libre | |
| Tabler Icons | 6 238 | Paweł Kuna | [MIT](https://github.com/tabler/tabler-icons/blob/main/LICENSE) | — | Libre | |
| Fluent UI System Icons | 4 994 | Microsoft | [MIT](https://github.com/microsoft/fluentui-system-icons/blob/main/LICENSE) | — | Libre | Oficial de Microsoft; variantes 24 px regular/filled |
| Simple Icons | 3 466 | Simple Icons Collaborators | [CC0-1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md) | — | Solo color oficial / negro / blanco | Marcas registradas; algunos iconos tienen licencia propia (se muestra en la ficha) |
| IBM Carbon Icons | 2 631 | IBM | [Apache-2.0](https://github.com/carbon-design-system/carbon/blob/main/LICENSE) | — | Libre | Oficial de IBM |
| Bootstrap Icons | 2 078 | The Bootstrap Authors | [MIT](https://github.com/twbs/icons/blob/main/LICENSE) | — | Libre | |
| SVG Logos | 1 924 | Gil Barbara | [CC0-1.0](https://github.com/gilbarbara/logos/blob/main/LICENSE.txt) | — | Bloqueada | Marcas registradas. Excluidos `aws-*`, `google-cloud-functions`, `google-cloud-run` (reproducciones de iconos oficiales restringidos) |
| Lucide | 1 891 | Lucide Contributors | [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | — | Libre | |
| Heroicons | 1 288 | Refactoring UI Inc. | [MIT](https://github.com/tailwindlabs/heroicons/blob/master/LICENSE) | — | Libre | |
| Devicon | 1 061 | Devicon contributors | [MIT](https://github.com/devicons/devicon/blob/master/LICENSE) | — | Bloqueada | Marcas registradas. Excluidos `azuredatafactory`, `azuresqldatabase` (reproducciones de iconos de Azure) |
| SAP Fiori / UI5 Icons (SAP-icons v5) | 705 | SAP SE | [Apache-2.0](https://github.com/SAP/ui5-webcomponents/blob/main/LICENSE.txt) | — | Libre | Oficial de SAP (`@ui5/webcomponents-icons`) |
| Codicons (VS Code) | 654 | Microsoft | [CC-BY-4.0](https://github.com/microsoft/vscode-codicons/blob/main/LICENSE) | **Sí** | Libre | Atribución: «Codicons © Microsoft Corporation, CC BY 4.0» |
| SAP BTP Solution Diagrams — Service Icons | 128 | SAP SE | [Apache-2.0](https://github.com/SAP/btp-solution-diagrams/blob/main/LICENSE) | **Sí** (aviso de copyright) | Bloqueada | Oficial de SAP; `REUSE.toml` declara Apache-2.0 para todo el repositorio. Vendorizado en `vendor/sap-btp-solution-diagrams` (commit `57199627c08f`, 02/10/2026) |

Las licencias Apache-2.0 y MIT exigen conservar el aviso de copyright y licencia al redistribuir: el ZIP de exportación incluye `LICENSES.txt` con esa información.

«Uso comercial verificado»: las bibliotecas de interfaz con licencia permisiva se marcan como «sí». En bibliotecas de marcas se indica «no verificado»: el archivo es libre, pero el uso de la marca depende de su propietario.

## Fuentes oficiales enlazadas (no redistribuidas)

| Fuente | Términos observados | Tratamiento |
|---|---|---|
| [Azure architecture icons](https://learn.microsoft.com/en-us/azure/architecture/icons/) | «Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation. You can copy, distribute, and display the icons only for the permitted use…». No recortar, voltear, rotar ni distorsionar. | 82 fichas con enlace |
| Microsoft 365, Entra ID, Fabric, Power Platform y Dynamics 365 (Microsoft Learn) | Conjuntos oficiales para diagramas | 26 fichas con enlace |
| [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) | «We allow customers and partners to use these toolkits and assets to create architecture diagrams» (también whitepapers, presentaciones, pósters). Sin permiso de redistribución. Paquete trimestral (07/2026). | 71 fichas con enlace |
| [Google Cloud icons](https://cloud.google.com/icons) | Iconos para diagramas y documentación; sin términos de redistribución publicados. Iconografía renovada en 2025; existen *legacy console icons*. | 32 fichas con enlace |
| [Databricks Brand Center](https://brand.databricks.com/) | Directrices de marca; sin licencia de redistribución de iconos de producto. | 12 fichas con enlace; no se fabrican iconos «oficiales» |
| [OCI Architecture Diagram Toolkits](https://docs.oracle.com/en-us/iaas/Content/General/Reference/graphicsfordiagrams.htm) | Kits para diagramas (draw.io, PowerPoint, Visio); sin términos de redistribución explícitos. | 15 fichas con enlace |
| SAP (productos sin icono en BTP Solution Diagrams) | — | 8 fichas con enlace |

## Marcas comerciales

Microsoft, Azure, AWS, Amazon Web Services, Google Cloud, Databricks, SAP, Oracle, IBM y el resto de nombres y logotipos son marcas de sus respectivos propietarios. IconAtlas no está afiliado ni patrocinado por ninguno de ellos. Antes de usar un logotipo en materiales comerciales, consulta las directrices de marca del propietario (enlazadas en la ficha cuando se conocen).

## Dependencias de la aplicación

React, React Router, MiniSearch, TanStack Virtual, fflate, DOMPurify, Lucide (MIT/ISC/Apache-2.0/MPL-2.0 según el paquete). Herramientas de desarrollo: Vite, TypeScript, Tailwind CSS, SVGO, Vitest, Playwright, axe-core.
