#!/usr/bin/env node
import { isMainModule } from './lib/catalog-utils.mjs';
/** Audita estado y contenido de fuentes GitHub. No descarga, incorpora ni ejecuta código remoto. */
import { writeFileSync, appendFileSync } from 'node:fs';
import { loadSources, githubGet, treeSummary, markdownTable } from './lib/github-repos.mjs';

export async function checkRepositories(sources, client = githubGet) {
  const results = [];
  for (const source of sources) {
    if (source.status === 'paused') {
      results.push({ id: source.id, repo: source.repo, state: 'paused' });
      continue;
    }
    try {
      const r = await client(`/repos/${source.repo}`);
      if (r.full_name?.toLowerCase() !== source.repo.toLowerCase()) {
        results.push({ id: source.id, repo: source.repo, state: 'moved', canonical: r.full_name });
        continue;
      }
      const tree = await client(`/repos/${source.repo}/git/trees/${encodeURIComponent(r.default_branch)}?recursive=1`);
      const summary = treeSummary(tree);
      const assetCount = summary.formats.svg + summary.formats.raster + summary.formats.excalidrawlib;
      const state = r.archived ? 'archived' : r.disabled ? 'disabled' : summary.truncated ? 'partial' : assetCount === 0 ? 'no-assets' : 'healthy';
      results.push({ id: source.id, repo: source.repo, state,
        pushedAt: r.pushed_at, defaultBranch: r.default_branch,
        ...summary, licenseDetected: r.license?.spdx_id ?? 'unknown',
        approved: source.status === 'approved' && source.redistributionApproved === true,
      });
    } catch (e) {
      results.push({ id: source.id, repo: source.repo, state: 'error', error: String(e.message) });
    }
  }
  return { checkedAt: new Date().toISOString(), totals: {
    monitored: results.length,
    healthy: results.filter((r) => r.state === 'healthy').length,
    needingReview: results.filter((r) => !['healthy', 'paused'].includes(r.state)).length,
  }, results };
}

export function formatHealth(report) {
  return `# Comprobación de repositorios IconAtlas\n\n${report.checkedAt}\n\n` +
    markdownTable(report.results.map((r) => ({
      repo: r.repo, state: r.state,
      svg: r.formats?.svg ?? '-', raster: r.formats?.raster ?? '-',
      library: r.formats?.excalidrawlib ?? '-',
      note: r.error ?? r.canonical ?? (r.truncated ? 'Árbol truncado' : ''),
    })), ['repo','state','svg','raster','library','note']) + '\n';
}

if (isMainModule(import.meta.url)) {
  const sources = loadSources();
  const report = await checkRepositories(sources);
  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'github-health-report.json';
  writeFileSync(out, JSON.stringify(report, null, 2));
  const md = formatHealth(report);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  // Transient network errors are reported, not masked as missing icon licenses.
}
