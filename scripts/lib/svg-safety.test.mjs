import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findSvgIssues, sanitizeSvgDocument, splitSvg } from './svg-safety.mjs';
import { createClassifier, humanize, splitStyle } from './catalog-utils.mjs';

// JSON leído desde una ruta nativa: evita las distintas interpretaciones de import assertions.
const taxonomy = JSON.parse(readFileSync(new URL('../../src/catalog/schemas/taxonomy.json', import.meta.url), 'utf8'));

describe('seguridad SVG (compilación/importación)', () => {
  it('detecta contenido activo y referencias externas', () => {
    assert.notDeepEqual(findSvgIssues('<script>alert(1)</script>'), []);
    assert.notDeepEqual(findSvgIssues('<path onclick="x()" d="M0 0"/>'), []);
    assert.notDeepEqual(findSvgIssues('<use href="https://evil.example/x.svg#a"/>'), []);
    assert.notDeepEqual(findSvgIssues('<rect fill="url(https://evil.example/a)"/>'), []);
    assert.notDeepEqual(findSvgIssues('<foreignObject/>'), []);
    assert.deepEqual(findSvgIssues('<path d="M0 0" fill="url(#g)"/><use href="#a"/>'), []);
  });

  it('sanitiza un documento malicioso conservando el contenido gráfico', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" onload="alert(1)"><script>alert(2)</script><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><a href="javascript:alert(3)"><path fill="url(#g)" d="M0 0h16v16H0z"/></a></svg>';
    const clean = sanitizeSvgDocument(dirty, 'x');
    assert.doesNotMatch(clean, /script|onload|javascript/i);
    const { viewBox, body } = splitSvg(clean);
    assert.equal(viewBox, '0 0 16 16');
    assert.ok(body.includes('d="M0 0h16v16H0z"'));
    assert.deepEqual(findSvgIssues(body), []);
  });

  it('obtiene el viewBox a partir de width/height si falta', () => {
    assert.equal(splitSvg('<svg width="32" height="16"><path d="M0 0"/></svg>').viewBox, '0 0 32 16');
    assert.throws(() => splitSvg('<svg><path/></svg>'));
  });
});

describe('utilidades de catálogo', () => {
  it('normaliza nombres y estilos', () => {
    assert.equal(humanize('sap-ai-core'), 'SAP AI Core');
    assert.deepEqual(splitStyle('add-circle-24-filled', [{ suffix: '-24-filled', style: 'filled' }], 'outline'), { base: 'add-circle', style: 'filled' });
  });
  it('clasifica en la taxonomía', () => {
    const classify = createClassifier(taxonomy);
    assert.equal(classify('database-search'), 'databases');
    assert.equal(classify('cloud-rain'), 'weather');
    assert.equal(classify('postgresql', { brand: true }), 'databases');
    assert.equal(classify('acme-unknown-brand', { brand: true }), 'brands');
  });
});
