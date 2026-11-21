const TAU = Math.PI * 2;

/**
 * In-place Radix-2 Cooley-Tukey FFT with zero runtime allocations.
 */
export class Radix2Fft {
  readonly size: number;
  private readonly bitRev: Uint16Array;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two, got ${size}`);
    }
    this.size = size;
    this.bitRev = new Uint16Array(size);
    const bits = Math.round(Math.log2(size));
    for (let i = 0; i < size; i++) {
      let rev = 0;
      for (let j = 0; j < bits; j++) {
        rev = (rev << 1) | ((i >> j) & 1);
      }
      this.bitRev[i] = rev;
    }
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      const angle = (-TAU * i) / size;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }
  }

  forward(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      const j = this.bitRev[i]!;
      if (i < j) {
        const tr = re[i]!;
        re[i] = re[j]!;
        re[j] = tr;
        const ti = im[i]!;
        im[i] = im[j]!;
        im[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        let k = 0;
        for (let j = i; j < i + half; j++) {
          const l = j + half;
          const cos = this.cosTable[k]!;
          const sin = this.sinTable[k]!;
          k += step;
          const rl = re[l]!;
          const il = im[l]!;
          const tre = rl * cos - il * sin;
          const tim = rl * sin + il * cos;
          const rj = re[j]!;
          const ij = im[j]!;
          re[l] = rj - tre;
          im[l] = ij - tim;
          re[j] = rj + tre;
          im[j] = ij + tim;
        }
      }
    }
  }
}
