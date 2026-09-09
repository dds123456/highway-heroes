import type { FaceMorphName, RiderFacePreset } from '../entities/CharacterAsset';

/**
 * 捏脸设置存取：集中 localStorage 的读取、校验、默认值与持久化，
 * 与 SettingsStore 同一套风格。滑杆层把 FaceWidth / FaceNarrow 合并为一根
 * 「脸型宽窄」双极滑杆（-1 窄 … +1 宽），其余 morph 各一根 0~1 滑杆。
 */

export interface FaceSliderDef {
  id: 'width' | Exclude<FaceMorphName, 'FaceWidth' | 'FaceNarrow'>;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
}

export const FACE_SLIDERS: FaceSliderDef[] = [
  { id: 'NoseWidth', label: '鼻翼宽窄', min: 0, max: 1, step: .02, def: .5 },
  { id: 'NoseProjection', label: '鼻梁突出', min: 0, max: 1, step: .02, def: .5 },
  { id: 'LipFullness', label: '嘴唇厚度', min: 0, max: 1, step: .02, def: .5 },
  { id: 'width', label: '脸型宽窄', min: -1, max: 1, step: 0.02, def: 0 },
  { id: 'FaceLength', label: '脸长', min: 0, max: 1, step: 0.02, def: 0.1 },
  { id: 'JawWidth', label: '下颌宽', min: 0, max: 1, step: 0.02, def: 0.12 },
  { id: 'ChinLength', label: '下巴长', min: 0, max: 1, step: 0.02, def: 0 },
  { id: 'CheekFullness', label: '脸颊饱满', min: 0, max: 1, step: 0.02, def: 0.08 },
  { id: 'ForeheadHeight', label: '额头高', min: 0, max: 1, step: 0.02, def: 0 },
  { id: 'BrowDepth', label: '眉骨深', min: 0, max: 1, step: 0.02, def: 0 },
  { id: 'EyeRegionWidth', label: '眼距', min: 0, max: 1, step: 0.02, def: 0.05 },
  { id: 'MouthRegionWidth', label: '嘴宽', min: 0, max: 1, step: 0.02, def: 0 },
];

export type FaceSliderValues = Record<string, number>;

const KEY = 'hh.face';

function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function defaults(): FaceSliderValues {
  const values: FaceSliderValues = {};
  for (const slider of FACE_SLIDERS) values[slider.id] = slider.def;
  return values;
}

/** 滑杆值 → 10-key 面部 morph 预设（width 双极 → FaceWidth / FaceNarrow） */
export function slidersToPreset(values: FaceSliderValues): RiderFacePreset {
  const width = values.width ?? 0;
  const preset: RiderFacePreset = {
    FaceWidth: Math.max(0, width),
    FaceNarrow: Math.max(0, -width),
  };
  for (const slider of FACE_SLIDERS) {
    if (slider.id === 'width') continue;
    preset[slider.id] = values[slider.id] ?? 0;
  }
  return preset;
}

/** 10-key 预设 → 滑杆值（width = FaceWidth - FaceNarrow） */
export function presetToSliders(preset: RiderFacePreset): FaceSliderValues {
  const width = (preset.FaceWidth ?? 0) - (preset.FaceNarrow ?? 0);
  const values: FaceSliderValues = { width };
  for (const slider of FACE_SLIDERS) {
    if (slider.id === 'width') continue;
    values[slider.id] = preset[slider.id] ?? 0;
  }
  return values;
}

function readRaw(): FaceSliderValues | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = defaults();
    for (const slider of FACE_SLIDERS) {
      const n = Number(parsed[slider.id]);
      if (Number.isFinite(n)) out[slider.id] = clampNumber(n, slider.min, slider.max);
    }
    return out;
  } catch {
    return null;
  }
}

function writeRaw(values: FaceSliderValues): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(values));
  } catch {
    /* 隐私模式等写入失败时静默忽略 */
  }
}

export class FaceStore {
  private values: FaceSliderValues;

  constructor() {
    this.values = readRaw() ?? defaults();
  }

  /** 当前滑杆值（副本） */
  getValues(): FaceSliderValues {
    return { ...this.values };
  }

  /** 当前 10-key 面部 morph 预设（供 RiderModel / FaceScene 使用） */
  getPreset(): RiderFacePreset {
    return slidersToPreset(this.values);
  }

  setValue(id: string, n: number): void {
    const slider = FACE_SLIDERS.find((s) => s.id === id);
    if (!slider) return;
    this.values[slider.id] = clampNumber(n, slider.min, slider.max);
    writeRaw(this.values);
  }

  setValues(values: FaceSliderValues): void {
    for (const slider of FACE_SLIDERS) {
      const n = values[slider.id];
      if (n !== undefined) this.values[slider.id] = clampNumber(n, slider.min, slider.max);
    }
    writeRaw(this.values);
  }

  reset(): void {
    this.values = defaults();
    writeRaw(this.values);
  }

  random(): void {
    for (const slider of FACE_SLIDERS) {
      const span = slider.max - slider.min;
      this.values[slider.id] = slider.min + Math.random() * span;
    }
    writeRaw(this.values);
  }
}

export const faceStore = new FaceStore();
