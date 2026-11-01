import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { runImport } from './index.mjs';

const base = { id: 'test-import', name: 'Test', owner: 'Tester', license: 'MIT', 'license-url': 'https://example.org/LICENSE', redistributable: 'yes', 'dry-run': true };
const good = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
const evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><path d="M1 1h2v2H1z"/></svg>';

describe('importador de colecciones', () => {
  it('exige licencia y confirmación de redistribución', () => {
    assert.equal(runImport({ ...base, redistributable: undefined }).ok, false);
    assert.equal(runImport({ ...base, license: 'Proprietary' }).ok, false);
  });

  it('importa una carpeta: sanitiza, normaliza nombres y detecta duplicados', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-import-'));
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'Cloud_Server.svg'), good);
    writeFileSync(join(dir, 'sub', 'copy.svg'), good); // mismo contenido → duplicado
    writeFileSync(join(dir, 'evil.svg'), evil); // se sanitiza
    writeFileSync(join(dir, 'broken.svg'), '<svg><path/></svg>'); // sin viewBox → rechazado
    const r = runImport({ ...base, source: dir });
    assert.equal(r.ok, true);
    assert.deepEqual(r.log.imported.sort(), ['cloud-server', 'evil']);
    assert.equal(r.log.skippedDuplicates.length, 1);
    assert.deepEqual(r.log.rejected.map((x) => x.name), ['broken.svg']);
    assert.equal(r.def.source.type, 'svg-folder');
  });

  it('importa un ZIP y rechaza rutas inseguras', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-zip-'));
    const zipPath = join(dir, 'icons.zip');
    writeFileSync(zipPath, zipSync({ 'icons/a.svg': strToU8(good), '../escape.svg': strToU8(good) }));
    const r = runImport({ ...base, source: zipPath });
    assert.equal(r.ok, true);
    assert.deepEqual(r.log.imported, ['a']);
    assert.match(r.log.rejected[0].issues[0], /insegura/);
  });
});
