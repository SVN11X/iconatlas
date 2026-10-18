# Despliegue en GitHub Pages

## Primera publicación

```bash
git init -b main
git add .
git commit -m "IconAtlas: primera versión"
git remote add origin https://github.com/USUARIO/iconatlas.git
git push -u origin main
```

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. El workflow **Deploy to GitHub Pages** (`.github/workflows/deploy.yml`) se ejecuta en cada push a `main` (o manualmente desde *Actions → Run workflow*).
3. Al terminar, el sitio está en `https://USUARIO.github.io/iconatlas/` (la URL aparece en el entorno `github-pages`).

## Qué hace el workflow

| Paso | Detalle |
|---|---|
| `actions/checkout@v4` | Obtiene el código |
| `actions/setup-node@v4` | Node 22 con caché npm |
| `npm ci` | Instalación reproducible (`package-lock.json`) |
| `npm run catalog -- --strict` + `catalog:validate` | Genera y valida el catálogo (falla ante errores) |
| `npm run typecheck`, `npm test` | Tipos y pruebas unitarias |
| `npm run build` | Compila con `BASE_PATH=/<repositorio>/` |
| `npm run test:e2e` | Playwright contra la compilación servida en la subruta (incluye accesibilidad con axe) |
| `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` | Publicación oficial de GitHub Pages |

Permisos mínimos: `contents: read`, `pages: write`, `id-token: write`. `concurrency: pages` evita despliegues simultáneos.

## Subruta y enrutado

- Vite usa `base: process.env.BASE_PATH ?? '/iconatlas/'`; todos los recursos (JS, CSS, catálogo, favicon, manifest, worker) se resuelven con `import.meta.env.BASE_URL`.
- El enrutado usa `HashRouter` (`#/explore?q=…`), por lo que recargar o compartir cualquier enlace funciona sin `404.html`.
- Para un dominio propio o un repositorio `USUARIO.github.io`, cambia `BASE_PATH: /` en el workflow.

## Otros workflows

- `validate.yml`: PR y ramas distintas de `main`.
- `sync-check.yml`: cada lunes comprueba fuentes y abre/actualiza el issue `catalog-sync`. No publica ni modifica nada.

## Comprobación local idéntica a Pages

```bash
BASE_PATH=/iconatlas/ npm run build
npm run preview          # http://localhost:4173/iconatlas/
npm run test:e2e
```
