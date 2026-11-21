/**
 * Parameter metadata and preset bank management adapted from Hendrix / SoundCraft (MIT License).
 */

export type ParameterCategory =
  | 'Eq'
  | 'Dynamics'
  | 'PitchShift'
  | 'Reverb'
  | 'Delay'
  | 'Modulation'
  | 'Harmonic'
  | 'Dither'
  | 'Instrument'
  | 'Other';

export type ParameterUnit =
  | 'None'
  | 'Db'
  | 'Hz'
  | 'Ms'
  | 'Percent'
  | 'Ratio'
  | 'Semitones'
  | 'Cents'
  | 'Seconds'
  | 'Toggle'
  | 'Choice';

export type ParameterTaper = 'Linear' | 'Log';

export interface ParamInfo {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly unit: ParameterUnit;
  readonly taper: ParameterTaper;
  readonly choices: readonly string[];
}

export function clampParam(param: ParamInfo, value: number): number {
  const v = Number.isNaN(value) ? param.default : value;
  const clamped = Math.max(param.min, Math.min(param.max, v));
  if (param.unit === 'Toggle' || param.unit === 'Choice') {
    return Math.max(param.min, Math.min(param.max, Math.round(clamped)));
  }
  return clamped;
}

export function formatParam(param: ParamInfo, value: number): string {
  const v = clampParam(param, value);
  switch (param.unit) {
    case 'Choice':
      return param.choices[v] ?? `${v}`;
    case 'Toggle':
      return v >= 0.5 ? 'On' : 'Off';
    case 'Db':
      return v <= -95.9 ? '-inf dB' : `${v.toFixed(1)} dB`;
    case 'Hz':
      return v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${v.toFixed(1)} Hz`;
    case 'Ms':
      return `${v.toFixed(1)} ms`;
    case 'Percent':
      return `${v.toFixed(0)}%`;
    case 'Ratio':
      return `${v.toFixed(1)}:1`;
    case 'Semitones':
      return `${v.toFixed(0)} st`;
    case 'Cents':
      return `${v.toFixed(0)} ct`;
    case 'Seconds':
      return `${v.toFixed(2)} s`;
    default:
      return `${v}`;
  }
}

function p(
  id: string,
  name: string,
  min: number,
  max: number,
  def: number,
  unit: ParameterUnit,
  choices: readonly string[] = [],
): ParamInfo {
  return { id, name, min, max, default: def, unit, taper: 'Linear', choices };
}

export const HENDRIX_PARAMETERS: readonly ParamInfo[] = [
  p('0', 'Detection Mode', 0, 1, 0, 'Choice', ['Mono · Single Notes', 'Poly · Chords']),
  p('1', 'Send MIDI', 0, 1, 1, 'Toggle'),
  p('2', 'Input Threshold', -72, -6, -48, 'Db'),
  p('3', 'Note Stability', 0, 80, 12, 'Ms'),
  p('4', 'Release', 10, 300, 40, 'Ms'),
  p('5', 'Lowest Note', 24, 96, 36, 'None'),
  p('6', 'Highest Note', 36, 108, 96, 'None'),
  p('7', 'Voices', 1, 6, 6, 'None'),
  p('8', 'Reference A4', 400, 480, 440, 'Hz'),
  p('9', 'Transpose', -24, 24, 0, 'Semitones'),
  p('10', 'Velocity · 0 = Dynamic', 0, 127, 0, 'None'),
  p('11', 'Verification', 0, 2, 1, 'Choice', ['Fast', 'Balanced', 'Accurate']),
  p('12', 'Audio Passthrough', 0, 1, 1, 'Toggle'),
  p('13', 'Mono Bends', 0, 1, 0, 'Toggle'),
  p('14', 'Bend Range', 0, 2, 0, 'Choice', ['±2 Semitones', '±12 Semitones', '±24 Semitones']),
  p('15', 'Bend Smoothing', 0, 80, 8, 'Ms'),
  p('16', 'Mono · Detection Window', 0, 3, 0, 'Choice', ['Direct', '5 ms', '10 ms', '15 ms']),
  p('17', 'Mono · Retrigger Picks', 0, 1, 1, 'Toggle'),
  p('18', 'Pick Threshold', 0.5, 18, 3, 'Db'),
  p('19', 'Pick Min Interval', 10, 150, 35, 'Ms'),
];

export type ParameterValues = Record<string, number>;

export interface HendrixPreset {
  readonly id: number;
  name: string;
  params: ParameterValues;
}

export function factoryParameterValues(): ParameterValues {
  const values: ParameterValues = {};
  for (const param of HENDRIX_PARAMETERS) {
    values[param.id] = param.default;
  }
  return values;
}

export function validateParameterValues(values: ParameterValues): void {
  const keys = Object.keys(values);
  if (keys.length > 32) {
    throw new Error('Too many Hendrix parameters');
  }
  for (const [id, val] of Object.entries(values)) {
    const param = HENDRIX_PARAMETERS.find((item) => item.id === id);
    if (!param) {
      throw new Error(`Unknown Hendrix parameter: ${id}`);
    }
    if (!Number.isFinite(val) || val < param.min || val > param.max) {
      throw new Error(`Invalid Hendrix value for ${param.name}`);
    }
  }
}

export class HendrixPresetBank {
  readonly version = 1;
  readonly entries: HendrixPreset[] = [];
  defaultId: number | null = null;

  isEmpty(): boolean {
    return this.entries.length === 0 && this.defaultId === null;
  }

  get(id: number): HendrixPreset | undefined {
    return this.entries.find((item) => item.id === id);
  }

  initial(): ParameterValues | undefined {
    if (this.defaultId === null) return undefined;
    return this.get(this.defaultId)?.params;
  }

  save(name: string, params: ParameterValues, makeDefault: boolean): number {
    validateParameterValues(params);
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 80 || /[\x00-\x1F\x7F]/.test(trimmed)) {
      throw new Error('Preset name must be 1–80 printable characters');
    }
    const existing = this.entries.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    let id: number;
    if (existing) {
      existing.name = trimmed;
      existing.params = { ...params };
      id = existing.id;
    } else {
      if (this.entries.length >= 128) {
        throw new Error('Preset bank is full (128 presets)');
      }
      const maxId = this.entries.reduce((max, item) => Math.max(max, item.id), 0);
      id = maxId + 1;
      this.entries.push({ id, name: trimmed, params: { ...params } });
    }
    if (makeDefault) {
      this.defaultId = id;
    }
    return id;
  }

  remove(id: number): void {
    const idx = this.entries.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
    }
    if (this.defaultId === id) {
      this.defaultId = null;
    }
  }
}
