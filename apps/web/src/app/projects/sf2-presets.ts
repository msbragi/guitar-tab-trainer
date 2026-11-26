export const GM_GUITAR_PROGRAMS = [24, 25, 26, 27, 28, 29, 30, 31] as const;
export type GmGuitarProgram = (typeof GM_GUITAR_PROGRAMS)[number];

export interface Sf2Preset {
  readonly index: number;
  readonly bank: number;
  readonly program: number;
  readonly name: string;
}

/** Maps a target GM guitar program (24..31) to a source preset index in the override SF2, or null (keep Base GM). */
export type GuitarProgramMap = Readonly<Record<number, number | null>>;

const PHDR_RECORD_SIZE = 38;
const UNUSED_BANK = 127;

function readFourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
}

function findPhdrChunk(bytes: Uint8Array): { readonly offset: number; readonly size: number } | null {
  if (bytes.byteLength < 12) return null;
  if (readFourCc(bytes, 0) !== 'RIFF' || readFourCc(bytes, 8) !== 'sfbk') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  while (pos + 8 <= bytes.byteLength) {
    const id = readFourCc(bytes, pos);
    const size = view.getUint32(pos + 4, true);
    const dataStart = pos + 8;
    const dataEnd = Math.min(bytes.byteLength, dataStart + size);

    if (id === 'LIST' && dataStart + 4 <= dataEnd && readFourCc(bytes, dataStart) === 'pdta') {
      let subPos = dataStart + 4;
      while (subPos + 8 <= dataEnd) {
        const subId = readFourCc(bytes, subPos);
        const subSize = view.getUint32(subPos + 4, true);
        const subData = subPos + 8;
        if (subId === 'phdr' && subData + subSize <= dataEnd) {
          return { offset: subData, size: subSize };
        }
        subPos = subData + subSize + (subSize & 1);
      }
      return null;
    }

    pos = dataStart + size + (size & 1);
  }
  return null;
}

/** Reads preset headers (phdr) from a SoundFont 2 buffer, excluding the terminal EOP record. */
export function readSf2Presets(bytes: Uint8Array): Sf2Preset[] {
  const phdr = findPhdrChunk(bytes);
  if (!phdr || phdr.size < PHDR_RECORD_SIZE * 2) return [];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const recordCount = Math.floor(phdr.size / PHDR_RECORD_SIZE) - 1;
  const presets: Sf2Preset[] = [];

  for (let i = 0; i < recordCount; i++) {
    const base = phdr.offset + i * PHDR_RECORD_SIZE;
    let name = '';
    for (let c = 0; c < 20; c++) {
      const ch = bytes[base + c]!;
      if (ch === 0) break;
      name += String.fromCharCode(ch);
    }
    const program = view.getUint16(base + 20, true);
    const bank = view.getUint16(base + 22, true);
    presets.push({
      index: i,
      bank,
      program,
      name: name.trim() || `Preset ${program}`,
    });
  }
  return presets;
}

/**
 * Builds a default guitar remapping table for an override SF2:
 * - Auto-maps any bank-0 presets already on GM guitar programs 24..31.
 * - If none match 24..31 (e.g. a single-instrument guitar SF2 saved on program 0),
 *   auto-maps its first bank-0 preset to GM 30 (Distortion Guitar).
 */
export function buildDefaultGuitarProgramMap(presets: readonly Sf2Preset[]): GuitarProgramMap {
  const map: Record<number, number | null> = {};
  let matchedAny = false;

  for (const gm of GM_GUITAR_PROGRAMS) {
    const match = presets.find((p) => p.bank === 0 && p.program === gm);
    map[gm] = match ? match.index : null;
    if (match) matchedAny = true;
  }

  if (!matchedAny) {
    const firstMelodic = presets.find((p) => p.bank === 0) ?? presets[0];
    if (firstMelodic) {
      map[30] = firstMelodic.index;
    }
  }
  return map;
}

/**
 * Returns a copy of the SF2 bytes with only the mapped guitar presets placed on Bank 0
 * at their target GM guitar program numbers (24..31). Unmapped presets are moved to an
 * unused bank (127) so they never overwrite non-guitar GM instruments (such as Piano 0).
 * Returns null if no guitar program is mapped to the override SF2.
 */
export function remapSf2GuitarPresets(bytes: Uint8Array, map: GuitarProgramMap): Uint8Array | null {
  const activeMappings = new Map<number, number>(); // sourceIndex -> targetGmProgram
  for (const gm of GM_GUITAR_PROGRAMS) {
    const sourceIndex = map[gm];
    if (typeof sourceIndex === 'number' && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
      activeMappings.set(sourceIndex, gm);
    }
  }
  if (activeMappings.size === 0) return null;

  const phdr = findPhdrChunk(bytes);
  if (!phdr || phdr.size < PHDR_RECORD_SIZE * 2) return null;

  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const recordCount = Math.floor(phdr.size / PHDR_RECORD_SIZE) - 1;

  for (let i = 0; i < recordCount; i++) {
    const base = phdr.offset + i * PHDR_RECORD_SIZE;
    const targetGm = activeMappings.get(i);
    if (targetGm !== undefined) {
      view.setUint16(base + 20, targetGm, true);
      view.setUint16(base + 22, 0, true);
    } else {
      view.setUint16(base + 22, UNUSED_BANK, true);
    }
  }

  return out;
}
