import { describe, expect, it } from 'vitest';
import { isValidSf2Bytes, SoundFontStore } from '../src/app/projects/soundfont-store.js';

function fakeSf2Bytes(extra: readonly number[] = []): Uint8Array {
  // RIFF + 4 size bytes + sfbk
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x73, 0x66, 0x62, 0x6b, ...extra]);
}

describe('SoundFontStore & validazione SF2', () => {
  it('valida intestazione RIFF/sfbk', () => {
    expect(isValidSf2Bytes(fakeSf2Bytes())).toBe(true);
    expect(isValidSf2Bytes(new Uint8Array([1, 2, 3]))).toBe(false);
    expect(isValidSf2Bytes(new Uint8Array(20))).toBe(false);
  });

  it('salva, legge e rimuove slot base e guitar con fallback in-memory', async () => {
    const store = new SoundFontStore(undefined);
    expect(await store.readAll()).toEqual({ base: null, guitar: null, guitarMap: null });

    await store.save('base', { name: 'GeneralUser.sf2', bytes: fakeSf2Bytes([1, 2]) });
    await store.save('guitar', { name: 'LeadGuitar.sf2', bytes: fakeSf2Bytes([3, 4]) });

    const all = await store.readAll();
    expect(all.base?.name).toBe('GeneralUser.sf2');
    expect(all.guitar?.name).toBe('LeadGuitar.sf2');
    expect(Array.from(all.base?.bytes.slice(-2) ?? [])).toEqual([1, 2]);

    await store.remove('guitar');
    const afterRemove = await store.readAll();
    expect(afterRemove.base?.name).toBe('GeneralUser.sf2');
    expect(afterRemove.guitar).toBeNull();
    store.close();
  });
});
