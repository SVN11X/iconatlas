import { findSvgIssues, sanitizeSvgDocument, splitSvg } from './svg-safety.mjs';
import { createClassifier, humanize, splitStyle } from './catalog-utils.mjs';
import taxonomy from '../../src/catalog/schemas/taxonomy.json';

describe('seguridad SVG (compilación/importación)', () => {
  it('detecta contenido activo y referencias externas', () => {
    expect(findSvgIssues('<script>alert(1)</script>')).not.toEqual([]);
    expect(findSvgIssues('<path onclick="x()" d="M0 0"/>')).not.toEqual([]);
    expect(findSvgIssues('<use href="https://evil.example/x.svg#a"/>')).not.toEqual([]);
    expect(findSvgIssues('<rect fill="url(https://evil.example/a)"/>')).not.toEqual([]);
    expect(findSvgIssues('<foreignObject/>')).not.toEqual([]);
    expect(findSvgIssues('<path d="M0 0" fill="url(#g)"/><use href="#a"/>')).toEqual([]);
  });

  it('sanitiza un documento malicioso conservando el contenido gráfico', () => {
    const dirty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" onload="alert(1)"><script>alert(2)</script><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><a href="javascript:alert(3)"><path fill="url(#g)" d="M0 0h16v16H0z"/></a></svg>';
    const clean = sanitizeSvgDocument(dirty, 'x');
    expect(clean).not.toMatch(/script|onload|javascript/i);
    const { viewBox, body } = splitSvg(clean);
    expect(viewBox).toBe('0 0 16 16');
    expect(body).toContain('d="M0 0h16v16H0z"');
    expect(findSvgIssues(body)).toEqual([]);
  });

  it('obtiene el viewBox a partir de width/height si falta', () => {
    expect(splitSvg('<svg width="32" height="16"><path d="M0 0"/></svg>').viewBox).toBe('0 0 32 16');
    expect(() => splitSvg('<svg><path/></svg>')).toThrow();
  });
});

describe('utilidades de catálogo', () => {
  it('normaliza nombres y estilos', () => {
    expect(humanize('sap-ai-core')).toBe('SAP AI Core');
    expect(splitStyle('add-circle-24-filled', [{ suffix: '-24-filled', style: 'filled' }], 'outline')).toEqual({ base: 'add-circle', style: 'filled' });
  });
  it('clasifica en la taxonomía', () => {
    const classify = createClassifier(taxonomy);
    expect(classify('database-search')).toBe('databases');
    expect(classify('cloud-rain')).toBe('weather');
    expect(classify('postgresql', { brand: true })).toBe('databases');
    expect(classify('acme-unknown-brand', { brand: true })).toBe('brands');
  });
});
