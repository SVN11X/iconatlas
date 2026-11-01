#!/usr/bin/env node
/** Busca posibles bibliotecas nuevas y genera un informe, sin añadir ni descargar iconos. */
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, listJson, readJson, isMainModule } from './lib/catalog-utils.mjs';
import { loadSources, githubGet, treeSummary, markdownTable } from './lib/github-repos.mjs';

const QUERIES = [
  'topic:icons topic:svg fork:false archived:false',
  'topic:icon-library fork:false archived:false',
  'topic:icon-pack fork:false archived:false',
  'topic:architecture-icons fork:false archived:false',
  'topic:svg-icons fork:false archived:false',
];

export async function discoverRepositories(sources, client = githubGet, queries = QUERIES) {
  const linked = new Set(sources.map((s) => s.repo.toLowerCase()));
  // Evitar volver a proponer colecciones del proyecto que ya están integradas.
  for (const path of listJson(join(ROOT, 'src/catalog/collections'))) {
    const def = readJson(path);
    for (const url of [def.homepage, def.source?.upstream]) {
      const match = String(url || '').match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/i);
      if (match) linked.add(match[1].toLowerCase());
    }
  }
  const unique = new Map();
  const errors = [];
  for (const q of queries) {
    try {
      const data = await client(`/search/repositories?q=${encodeURIComponent(q)}&per_page=30&sort=updated&order=desc`);
      for (const repo of data.items ?? []) {
        if (!repo.full_name || linked.has(repo.full_name.toLowerCase()) || repo.fork || repo.archived || repo.disabled) continue;
        if (!unique.has(repo.full_name.toLowerCase())) unique.set(repo.full_name.toLowerCase(), repo);
      }
    } catch (e) { errors.push(`${q}: ${String(e.message)}`); }
  }
  // Detectar repositorios que contienen activos reales, no solo README con la palabra 'icons'.
  const ranked = [...unique.values()].sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0)).slice(0, 25);
  const candidates = [];
  for (const r of ranked) {
    try {
      const tree = treeSummary(await client(`/repos/${r.full_name}/git/trees/${encodeURIComponent(r.default_branch)}?recursive=1`));
      if (!tree.formats.svg && !tree.formats.excalidrawlib && !tree.truncated) continue;
      candidates.push({ repo: r.full_name, url: r.html_url,
        stars: r.stargazers_count ?? 0, licenseDetected: r.license?.spdx_id ?? 'unknown',
        ...tree, reason: 'Pendiente de revisión de licencia, calidad y duplicados',
      });
    } catch (e) { errors.push(`${r.full_name}: ${String(e.message)}`); }
  }
  return { checkedAt: new Date().toISOString(), searches: queries, candidates, errors };
}

export function formatDiscovery(report) {
  return `# Fuentes nuevas candidatas para IconAtlas\n\n${report.checkedAt}\n\n` +
    markdownTable(report.candidates.map((r) => ({ repo: r.repo, stars: r.stars,
      svg: r.formats.svg, library: r.formats.excalidrawlib, license: r.licenseDetected,
      note: r.truncated ? 'Muestra incompleta' : 'Validar antes de importar',
    })), ['repo','stars','svg','library','license','note']) +
    (report.errors.length ? `\n\nErrores de consulta:\n${report.errors.map((e) => `- ${e}`).join('\n')}\n` : '');
}

if (isMainModule(import.meta.url)) {
  const report = await discoverRepositories(loadSources());
  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'github-discovery-report.json';
  writeFileSync(out, JSON.stringify(report, null, 2));
  const md = formatDiscovery(report);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (!report.candidates.length && report.errors.length) process.exitCode = 1;
}
