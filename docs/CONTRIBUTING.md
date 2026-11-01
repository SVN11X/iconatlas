# Contribuir a IconAtlas

## Antes de añadir recursos

1. **Verifica la licencia** del archivo *y* los términos del propietario de la marca. Una licencia abierta del repositorio no implica derechos sobre las marcas que contiene.
2. Solo se incorporan archivos cuya **redistribución esté permitida de forma explícita**. Si hay dudas, conserva el recurso únicamente en el **inventario técnico de referencias** en `src/catalog/manifests/reference/` en lugar del archivo.
3. No marques un recurso como **oficial** sin una fuente verificable del propietario.
4. No crees ni subas versiones «oficiales» inventadas de logotipos o iconos de producto.

## Añadir una biblioteca

```bash
# Paquete Iconify
npm i -D @iconify-json/<set>
npm run import-icons -- --source npm:@iconify-json/<set> --id <set> --name "Nombre" --owner "Autor" \
  --homepage https://... --license MIT --license-url https://.../LICENSE --redistributable yes

# Carpeta o ZIP de SVG
npm run import-icons -- --source ./mis-svg --id mi-coleccion --name "Mi colección" --owner "Autor" \
  --license Apache-2.0 --license-url https://.../LICENSE --redistributable yes --kind ui

npm run catalog && npm run catalog:validate
```

Revisa y completa el JSON generado en `src/catalog/collections/<id>.json`: `provider`, `kind`, `customization`, `styles` (sufijos → estilo), `restrictions`, `attribution`, `official`.

## Registrar recursos oficiales pendientes (no publicados)

Edita o crea `src/catalog/manifests/reference/<id>.json`:

```json
{
  "id": "mi-proveedor-oficial",
  "name": "Proveedor — iconos oficiales",
  "kind": "reference",
  "provider": "mi-proveedor",
  "sourceUrl": "https://URL-OFICIAL-VERIFICADA",
  "terms": "Resumen literal de los términos",
  "reviewed": "AAAA-MM-DD",
  "official": true,
  "permissions": { "download": false, "redistribute": false, "modify": false, "commercial": "unverified", "attribution": false },
  "customization": "none",
  "license": { "spdx": "LicenseRef-Proprietary", "title": "Términos del propietario", "url": "https://URL-OFICIAL-VERIFICADA" },
  "restrictions": ["…"],
  "entries": [{ "name": "Producto", "category": "compute", "family": "Compute", "aliases": ["alias"] }]
}
```

## Añadir un proveedor

Añade una entrada en `src/catalog/providers/providers.json` con `id`, `name`, `kind`, `website`, `match` (regex sobre nombres de logotipos) y, si existen, `officialIcons` con la URL y los términos revisados.

## Mejorar la búsqueda y la clasificación

- Sinónimos: `src/catalog/schemas/synonyms.json`.
- Categorías y palabras clave: `src/catalog/schemas/taxonomy.json`.
- Nombres oficiales: `src/catalog/schemas/title-overrides.json`.

## Calidad

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

Las PR ejecutan `validate.yml` (catálogo estricto, tipos, unitarias, compilación, E2E con axe y auditoría de dependencias).
