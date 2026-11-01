import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteIndex, enumerateRepoTree, kindFromPath } from './github-index.mjs';

describe('índice GitHub universal', () => {
  it('clasifica formatos seguros y excluye rutas inseguras', () => {
    assert.equal(kindFromPath('icons/home.svg', 10), 0);
    assert.equal(kindFromPath('images/a.webp', 10), 1);
    assert.equal(kindFromPath('libs/a.excalidrawlib', 10), 2);
    assert.equal(kindFromPath('cursors/pointer.cur', 10), 3);
    assert.equal(kindFromPath('../escape.svg', 10), null);
    assert.equal(kindFromPath('icons/evil.svg?x=1', 10), null);
    assert.equal(kindFromPath('icons/huge.svg', 11 * 1024 * 1024), null);
    assert.equal(kindFromPath('readme.md', 10), null);
  });
  it('reconstruye un árbol truncado desde sus subárboles sin perder rutas', async () => {
    const sha = 'a'.repeat(40);
    const request = async path => {
      if (path.endsWith('?recursive=1')) return { truncated: true, tree: [] };
      if (path.endsWith('/' + sha)) return { tree: [{ path: 'icons', type: 'tree', sha: 'b'.repeat(40) }, { path: 'root.svg', type: 'blob', size: 5 }] };
      if (path.endsWith('/' + 'b'.repeat(40))) return { tree: [{ path: 'nested.svg', type: 'blob', size: 5 }] };
      throw Error(path);
    };
    const tree = await enumerateRepoTree('owner/repo', sha, request);
    assert.equal(tree.partial, false);
    assert.deepEqual(tree.entries.map(a => a.path), ['root.svg', 'icons/nested.svg']);
  });
  it('indexa todas las fuentes incluso las no aprobadas sin inventar licencias', async () => {
    const sha = 'a'.repeat(40);
    const source = { id: 'gcp', name: 'Google Cloud', repo: 'AwesomeLogos/google-cloud-icons', category: 'cloud', status: 'watch', redistributionApproved: false };
    const request = async path => path.includes('/commits/') ? { sha, commit: { tree: { sha } } }
      : path.includes('/git/trees/') ? { truncated: false, tree: [{ path: 'SVG/gcp.svg', type: 'blob', size: 125 }] }
        : { default_branch: 'main', archived: false, disabled: false };
    const result = await createRemoteIndex([source], request);
    assert.equal(result.stats.indexedSources, 1);
    assert.equal(result.stats.indexedAssets, 1);
    assert.equal(result.sources[0].redistributionApproved, false);
    assert.deepEqual(result.assets[0], [0, 'SVG/gcp.svg', 0, 125]);
  });
});
