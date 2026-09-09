import * as THREE from 'three';
import type { BikeForm, Colorway, RiderSpec } from '../core/constants';
import { MotorcycleModel } from '../entities/Motorcycle';
import { RiderModel } from '../entities/Rider';
import type { TrackPath } from '../math/TrackPath';

/**
 * 幽灵车：以固定逻辑帧记录紧凑状态（进度 / 横向位置 / 速度 / 倾角），
 * 回放时用赛道 frame + 横向位置重建世界坐标，不保存完整 Three.js 矩阵或粒子。
 */
export interface GhostFrame {
  t: number;
  progress: number;
  lateral: number;
  speed: number;
  lean: number;
}

export interface GhostLap {
  trackId: string;
  mode: string;
  bikeForm: BikeForm;
  colorway: Colorway;
  rider: RiderSpec;
  lapTimeMs: number;
  frames: GhostFrame[];
}

const STORE_KEY = 'hh.ghost.v1';

function clampLerp(min: number, max: number, t: number): number {
  const v = t < 0 ? 0 : t > 1 ? 1 : t;
  return min + (max - min) * v;
}

export class GhostRecorder {
  private recording = false;
  private frames: GhostFrame[] = [];
  private startTime = 0;
  private lastProgress = 0;
  private lastLateral = 0;
  private lastSpeed = 0;

  start(time: number): void {
    this.recording = true;
    this.frames = [];
    this.startTime = time;
  }

  record(time: number, progress: number, lateral: number, speed: number, lean: number): void {
    if (!this.recording) return;
    this.lastProgress = progress;
    this.lastLateral = lateral;
    this.lastSpeed = speed;
    this.frames.push({ t: time - this.startTime, progress, lateral, speed, lean });
  }

  stop(): void {
    this.recording = false;
  }

  isEmpty(): boolean {
    return this.frames.length === 0;
  }

  /** 完成一圈时调用：返回本圈是否优于当前最佳，并持久化最佳幽灵数据。 */
  finishLap(
    trackId: string,
    mode: string,
    bikeForm: BikeForm,
    colorway: Colorway,
    rider: RiderSpec,
    lapTimeMs: number,
  ): { isBest: boolean; lapTimeMs: number } {
    this.stop();
    const prevBest = this.load();
    const isBest = !prevBest || lapTimeMs < prevBest.lapTimeMs;
    if (isBest) {
      this.save({
        trackId,
        mode,
        bikeForm,
        colorway,
        rider,
        lapTimeMs,
        frames: this.frames,
      });
    }
    return { isBest, lapTimeMs };
  }

  clear(): void {
    this.recording = false;
    this.frames = [];
  }

  load(): GhostLap | null {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const lap = parsed as GhostLap;
      if (!Array.isArray(lap.frames)) return null;
      return lap;
    } catch {
      return null;
    }
  }

  save(lap: GhostLap): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(lap));
    } catch {
      /* 容量不足时静默丢弃幽灵数据 */
    }
  }
}

/**
 * 幽灵车可视化：读入 GhostLap，每帧按当前比赛时间插值状态并摆放模型。
 * 使用独立材质与半透明车身，与玩家区分。
 */
export class GhostVehicle {
  readonly group = new THREE.Group();
  private lap: GhostLap;
  private model: MotorcycleModel;
  private rider: RiderModel;
  private enabled = true;

  constructor(lap: GhostLap) {
    this.lap = lap;
    this.model = new MotorcycleModel(lap.bikeForm, lap.colorway);
    this.rider = new RiderModel(lap.rider, lap.bikeForm);
    this.group.add(this.model.group, this.rider.group);
    // 幽灵半透明化（必须先挂载子节点再遍历）
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as { isMesh?: boolean }).isMesh) return;
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of mats) {
        m.transparent = true;
        m.opacity = 0.42;
        m.depthWrite = false;
      }
    });
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.group.visible = v;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 根据比赛时间插值幽灵帧并摆放；返回是否仍在有效时间范围内 */
  update(raceTime: number, track: TrackPath): boolean {
    if (!this.enabled || this.lap.frames.length === 0) return false;
    const frames = this.lap.frames;
    // 帧时间是毫秒；比赛 raceTime 是秒。取模循环回放整圈。
    const targetMs = (raceTime * 1000) % this.lap.lapTimeMs;
    if (targetMs < 0) return false;

    let i = 1;
    while (i < frames.length - 1 && frames[i].t < targetMs) i++;
    const a = frames[i - 1];
    const b = frames[i];
    const span = Math.max(1e-3, b.t - a.t);
    const k = clampLerp(0, 1, (targetMs - a.t) / span);
    const progress = clampLerp(a.progress, b.progress, k);
    const lateral = clampLerp(a.lateral, b.lateral, k);
    const lean = clampLerp(a.lean, b.lean, k);

    const f = track.frameAt(progress);
    const pos = f.position.clone().addScaledVector(f.right, lateral).addScaledVector(f.up, 0.04);
    this.group.position.copy(pos);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent);
    const qPath = new THREE.Quaternion().setFromRotationMatrix(basis);
    const qLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lean, 'ZYX'));
    this.group.quaternion.copy(qPath).multiply(qLocal);
    this.rider.setPose({
      lean,
      pitch: 0,
      steer: 0,
      crouch: 0.5,
      airborne: false,
      celebrate: false,
      time: raceTime,
    });
    this.model.update(0, clampLerp(a.speed, b.speed, k), 0, false);
    return true;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}

/** 依据本地记录构建幽灵车（无记录或赛道不匹配时返回 null） */
export function loadGhostVehicle(trackId: string, mode: string): GhostVehicle | null {
  const recorder = new GhostRecorder();
  const lap = recorder.load();
  if (!lap) return null;
  if (lap.trackId !== trackId || lap.mode !== mode) return null;
  return new GhostVehicle(lap);
}
