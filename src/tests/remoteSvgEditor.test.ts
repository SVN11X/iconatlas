import { describe, expect, it } from 'vitest';
import { remoteSvgToData, makeRemoteSvgIcon } from '../utils/remoteSvgEditor';
import type { RemoteHit } from '../utils/universalGithubIndex';
import { buildSvg } from '../services/export/svg';

function hit(sourceId: string, approved = false): RemoteHit {
  return {
    key: `${sourceId}:icons/cloud.svg`,
    source: { id: sourceId, name: 'Google Cloud', repo: approved ? 'iconoir-icons/iconoir' : 'AwesomeLogos/google-cloud-icons',
      category: approved ? 'ui' : 'cloud', status: approved ? 'approved' : 'watch', redistributionApproved: approved,
      sha: 'a'.repeat(40), count: 218, partial: false, error: '' },
    asset: { path: 'icons/cloud.svg', kind: 'svg', size: 120 }, score: 1,
  };
}

describe('editor SVG remoto compartido con los iconos locales', () => {
  it('preserva el viewBox, los trazos y los colores del SVG original', () => {
    const data = remoteSvgToData('<svg viewBox="0 0 128 64" xmlns="http://www.w3.org/2000/svg" fill="#4285f4"><path d="M0 0H128V64H0z"/></svg>');
    const { icon } = makeRemoteSvgIcon(hit('gcp-awesome'), data);
    expect(data.viewBox).toBe('0 0 128 64');
    const output = buildSvg(icon, data, { padding: 10 });
    expect(output).toContain('fill="#4285f4"');
    expect(output).toContain('viewBox="-12.8 -12.8 153.6 89.6"');
    expect(icon.collection.customization).toBe('none');
  });
  it('deriva dimensiones cuando el SVG no tiene viewBox', () => {
    const data = remoteSvgToData('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><circle cx="8" cy="8" r="4"/></svg>');
    expect(data.viewBox).toBe('0 0 32 16');
  });
  it('no permite scripts ni referencias externas dentro del SVG', () => {
    expect(() => remoteSvgToData('<svg onload="alert(1)" viewBox="0 0 24 24"></svg>')).toThrow();
    expect(() => remoteSvgToData('<svg viewBox="0 0 24 24"><image href="https://x.y/z.png"/></svg>')).toThrow();
  });
  it('la recoloración monocroma exige una fuente aprobada y SVG heredado', () => {
    const data = remoteSvgToData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M1 1h8v8H1z"/></svg>');
    const unverified = makeRemoteSvgIcon(hit('gcp-awesome'), data).icon;
    expect(unverified.collection.customization).toBe('none');
    const open = makeRemoteSvgIcon(hit('iconoir', true), data).icon;
    expect(open.collection.customization).toBe('free');
    expect(buildSvg(open, data, { color: '#16a34a' })).toContain('#16a34a');
  });
});
