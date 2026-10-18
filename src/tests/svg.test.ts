import { buildSvg, customizationFor, isValidColor, parseViewBox, assertSafeSvg, fileBaseName } from '../services/export/svg';
import { makeCollection, makeIcon } from './fixtures';

const mono = { body: '<path fill="currentColor" d="M0 0h24v24H0z"/>', viewBox: '0 0 24 24' };
const color = { body: '<path fill="#ff0000" d="M0 0h10v10H0z"/><path fill="#00ff00" d="M10 10h10v10H10z"/>', viewBox: '0 0 20 20' };

describe('buildSvg', () => {
  it('conserva el viewBox y produce un SVG autónomo', () => {
    const svg = buildSvg(makeIcon(), mono);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('width="24" height="24"');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  });

  it('aplica el color en iconos monocromos personalizables', () => {
    const svg = buildSvg(makeIcon(), mono, { color: '#4f46e5' });
    expect(svg).toContain('fill="#4f46e5"');
    expect(svg).not.toContain('currentColor');
  });

  it('no altera los colores originales de iconos multicolor', () => {
    const icon = makeIcon({ flags: 0 });
    const svg = buildSvg(icon, color, { color: '#123456' });
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('#00ff00');
    expect(svg).not.toContain('#123456');
  });

  it('bloquea colores no permitidos en marcas (solo color oficial, negro o blanco)', () => {
    const coll = makeCollection({ id: 'simple-icons', kind: 'brand', customization: 'brand-mono' });
    const icon = makeIcon({ collection: coll, hex: '3776AB' });
    expect(customizationFor(icon).presetColors).toEqual(['#3776AB', '#000000', '#ffffff']);
    expect(buildSvg(icon, mono, { color: '#ff00ff' })).toContain('#3776AB');
    expect(buildSvg(icon, mono, { color: '#ffffff' })).toContain('fill="#ffffff"');
  });

  it('las marcas bloqueadas no cambian de color', () => {
    const coll = makeCollection({ customization: 'none', kind: 'brand' });
    const svg = buildSvg(makeIcon({ collection: coll }), mono, { color: '#ff00ff' });
    expect(svg).not.toContain('#ff00ff');
  });

  it('el margen amplía el viewBox sin escalar el contenido y el fondo cubre todo', () => {
    const svg = buildSvg(makeIcon(), mono, { padding: 10, background: '#ffffff' });
    expect(svg).toContain('viewBox="-2.4 -2.4 28.8 28.8"');
    expect(svg).toContain('<rect x="-2.4" y="-2.4" width="28.8" height="28.8" fill="#ffffff"/>');
    expect(svg).toContain('d="M0 0h24v24H0z"');
  });

  it('respeta la proporción cuando se pide un tamaño', () => {
    const svg = buildSvg(makeIcon({ flags: 0 }), { body: '<rect width="40" height="20" fill="#000"/>', viewBox: '0 0 40 20' }, { size: 200 });
    expect(svg).toContain('width="200" height="100"');
  });

  it('rechaza colores que podrían inyectar marcado', () => {
    expect(isValidColor('#fff')).toBe(true);
    expect(isValidColor('#ffffff"/><script>')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    const svg = buildSvg(makeIcon(), mono, { color: '"/><script>alert(1)</script>', background: 'url(javascript:alert(1))' });
    expect(svg).not.toContain('script');
    expect(svg).not.toContain('javascript');
  });

  it('assertSafeSvg detecta contenido activo', () => {
    expect(() => assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toThrow();
    expect(() => assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path onload="alert(1)" d="M0 0"/></svg>')).toThrow();
    expect(() => assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>')).toThrow();
    expect(() => assertSafeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>')).not.toThrow();
  });

  it('valida viewBox y nombres de archivo', () => {
    expect(() => parseViewBox('0 0 0 10')).toThrow();
    expect(parseViewBox('0,0,24,24')).toEqual([0, 0, 24, 24]);
    expect(fileBaseName(makeIcon({ name: 'azure-storage-account' }))).toBe('azure-storage-account');
  });
});
