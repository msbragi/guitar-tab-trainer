import { describe, expect, it } from 'vitest';
import {
  buildDefaultGuitarProgramMap,
  readSf2Presets,
  remapSf2GuitarPresets,
} from '../src/app/projects/sf2-presets.js';

function buildMinimalSf2(presets: readonly { name: string; program: number; bank: number }[]): Uint8Array {
  const phdrSize = (presets.length + 1) * 38;
  const pdtaListSize = 4 + 8 + phdrSize;
  const riffSize = 4 + 8 + pdtaListSize;
  const buf = new Uint8Array(8 + riffSize);
  const view = new DataView(buf.buffer);

  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) buf[offset + i] = text.charCodeAt(i);
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, riffSize, true);
  writeStr(8, 'sfbk');

  writeStr(12, 'LIST');
  view.setUint32(16, pdtaListSize, true);
  writeStr(20, 'pdta');

  writeStr(24, 'phdr');
  view.setUint32(28, phdrSize, true);

  presets.forEach((p, idx) => {
    const base = 32 + idx * 38;
    writeStr(base, p.name.slice(0, 19));
    view.setUint16(base + 20, p.program, true);
    view.setUint16(base + 22, p.bank, true);
    view.setUint16(base + 24, idx, true);
  });
  const eopBase = 32 + presets.length * 38;
  writeStr(eopBase, 'EOP');
  view.setUint16(eopBase + 24, presets.length, true);

  return buf;
}

describe('sf2-presets', () => {
  it('legge i preset da phdr e auto-mappa i programmi GM chitarra', () => {
    const sf2 = buildMinimalSf2([
      { name: 'Clean Strat', program: 27, bank: 0 },
      { name: 'Lead Dist', program: 30, bank: 0 },
    ]);
    const presets = readSf2Presets(sf2);
    expect(presets).toEqual([
      { index: 0, bank: 0, program: 27, name: 'Clean Strat' },
      { index: 1, bank: 0, program: 30, name: 'Lead Dist' },
    ]);

    const map = buildDefaultGuitarProgramMap(presets);
    expect(map[27]).toBe(0);
    expect(map[30]).toBe(1);
    expect(map[29]).toBeNull();
  });

  it('auto-mappa un SF2 singolo su programma 0 verso GM 30 e isola i preset non mappati su bank 127', () => {
    const sf2 = buildMinimalSf2([
      { name: 'Solo Lead', program: 0, bank: 0 },
      { name: 'Unused Pad', program: 1, bank: 0 },
    ]);
    const presets = readSf2Presets(sf2);
    const map = buildDefaultGuitarProgramMap(presets);
    expect(map[30]).toBe(0);

    const patched = remapSf2GuitarPresets(sf2, { ...map, 29: null, 30: 0 });
    expect(patched).not.toBeNull();
    const after = readSf2Presets(patched!);
    expect(after[0]).toMatchObject({ bank: 0, program: 30, name: 'Solo Lead' });
    expect(after[1]).toMatchObject({ bank: 127, program: 1, name: 'Unused Pad' });
  });

  it('restituisce null se nessun programma chitarra è mappato', () => {
    const sf2 = buildMinimalSf2([{ name: 'Solo Lead', program: 0, bank: 0 }]);
    expect(remapSf2GuitarPresets(sf2, { 24: null, 25: null, 26: null, 27: null, 28: null, 29: null, 30: null, 31: null })).toBeNull();
  });
});
