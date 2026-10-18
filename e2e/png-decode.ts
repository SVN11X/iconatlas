import { inflateSync } from 'node:zlib';

/** Decodificador PNG mínimo (RGBA/RGB 8 bits, sin entrelazado) para verificar transparencia y color en pruebas. */
export class PNG {
  constructor(public width: number, public height: number, private px: Uint8Array) {}
  static decode(buf: Buffer): PNG {
    let off = 8;
    let width = 0, height = 0, colorType = 0, bitDepth = 0;
    const idat: Buffer[] = [];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString('ascii', off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
      else if (type === 'IDAT') idat.push(data);
      else if (type === 'IEND') break;
      off += 12 + len;
    }
    if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error(`PNG no soportado: depth ${bitDepth} type ${colorType}`);
    const bpp = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const out = new Uint8Array(width * height * 4);
    const prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
        let v = line[x];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[x] = v & 255;
      }
      for (let x = 0; x < width; x++) {
        out[(y * width + x) * 4] = cur[x * bpp]; out[(y * width + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * width + x) * 4 + 2] = cur[x * bpp + 2];
        out[(y * width + x) * 4 + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
      }
      prev.set(cur);
    }
    return new PNG(width, height, out);
  }
  alphaAt(x: number, y: number) { return this.px[(y * this.width + x) * 4 + 3]; }
  rgbAt(x: number, y: number) { const i = (y * this.width + x) * 4; return [this.px[i], this.px[i + 1], this.px[i + 2]]; }
  maxAlpha() { let m = 0; for (let i = 3; i < this.px.length; i += 4) if (this.px[i] > m) m = this.px[i]; return m; }
}
