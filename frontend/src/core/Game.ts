import * as THREE from 'three';
import { BIKES, ITEM_COLORS, RIDERS, TRACKS } from './constants';
import type { BikeSpec, Colorway, RiderSpec } from './constants';
import { EventBus } from './events';
import { Input } from './Input';
import { MODES } from './GameMode';
import type { GameModeId, GameModeRules } from './GameMode';
import { TrackPath } from '../math/TrackPath';
import { clamp } from '../math/utils';
import { GameRenderer } from '../render/Renderer';
import { CameraRig } from '../render/CameraRig';
import { CloudLayer, createSky } from '../render/Sky';
import { createRoadChunks, updateChunkVisibility } from '../render/Road';
import {
  createCheckpointGates,
  createEnvironmentChunks,
  createTerrain,
  createMountains,
  createStartGantry,
  updateEnvironmentVisibility,
} from '../render/Environment';
import { ParticleSystem } from '../render/Particles';
import { WeatherSystem } from '../render/Weather';
import {
  animatePads,
  createBoostPads,
  createRoadObstacles,
  type BoostPad,
  type RoadObstacle,
  updateObstacles,
  updatePads,
} from '../render/RoadItems';
import { BikeEntity } from '../entities/BikeEntity';
import { getWrapTexture } from '../render/wrapTextures';
import { RaceManager } from '../race/Race';
import { AudioEngine } from '../audio/AudioEngine';
import { ItemSystem } from '../items/ItemSystem';
import { HUD } from '../ui/HUD';
import type { Selection } from '../ui/HUD';
import { settingsStore } from '../settings/SettingsStore';
import { RecordStore } from '../records/RecordStore';
import { GhostRecorder, GhostVehicle, loadGhostVehicle } from '../ghost/GhostRecorder';
import { submitRaceResult } from '../net';

/** 固定逻辑步长：让物理 / AI / 道具在 30/60/120 FPS 下行为一致。 */
const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;
const MAX_SIM_STEPS = 8;

/** 每圈生成 3 段雨区（雷暴段），总长约占赛道 1/3。 */
function buildRainSections(length: number): Array<[number, number]> {
  const sectionLength = length / 9;
  const half = sectionLength / 2;
  const centers = [0.22, 0.5, 0.78];
  return centers.map((c) => [length * c - half, length * c + half] as [number, number]);
}

export class Game {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: GameRenderer;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private cameraRig: CameraRig;
  private hud: HUD;
  private input = new Input();
  private bus = new EventBus();
  private audio = new AudioEngine();
  private clock = new THREE.Clock();
  private raf = 0;
  private paused = false;
  private dpr = 1;
  private maxDpr = 1;
  private built = false;
  private isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  private helpOpen = false;
  private helpWasRacing = false;
  private settingsOpen = false;
  private hitMarker: { targetIndex: number; until: number } | null = null;

  // 固定时间步
  private accumulator = 0;
  private simTime = 0;

  private mode: GameModeRules = MODES.race;
  private modeId: GameModeId = 'race';
  private sel: Selection | null = null;

  // 漂移计分
  private driftScore = 0;
  private driftCombo = 0;
  private driftTimeLeft = 0;

  // 幽灵车（计时赛）
  private ghostRecorder = new GhostRecorder();
  private ghostVehicle: GhostVehicle | null = null;

  private track!: TrackPath;
  private clouds!: CloudLayer;
  private roadChunks!: ReturnType<typeof createRoadChunks>;
  private envChunks!: ReturnType<typeof createEnvironmentChunks>;
  private particles!: ParticleSystem;
  private weather!: WeatherSystem;
  private pads!: BoostPad[];
  private obstacles!: RoadObstacle[];
  private items: ItemSystem | null = null;
  private bikes: BikeEntity[] = [];
  private bikeNames: string[] = [];
  private race!: RaceManager;
  private weatherEl: HTMLElement;
  private flashEl: HTMLElement;
  private rainSections: Array<[number, number]> = [];
  private steerSensitivity = 1;
  private exhaustAccum = 0;
  private skidAccum = 0;
  private splashAccum = 0;
  private countValue = 4;
  private frameMs = 0;
  private frameCount = 0;
  private fps = 60;

  constructor() {
    this.root = document.getElementById('game-root')!;
    this.canvas = document.createElement('canvas');
    this.root.appendChild(this.canvas);
    this.renderer = new GameRenderer(this.canvas);
    this.maxDpr = Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.6 : 2);
    this.dpr = this.maxDpr;
    this.cameraRig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight));
    this.scene.add(this.world);
    this.weatherEl = document.getElementById('weather-overlay')!;
    this.flashEl = document.getElementById('weather-flash')!;

    this.hud = new HUD(this.bus);
    this.hud.setSelectStartHandler((sel) => this.startGame(sel));
    this.hud.setRestartHandler(() => this.restartRace());
    this.hud.setResumeHandler(() => this.resumeGame());
    this.hud.setExitToSelectHandler(() => this.exitToSelect());
    this.hud.setHelpToggleHandler(() => this.toggleHelp());
    this.hud.setPauseToggleHandler(() => this.togglePause());
    this.hud.setSettingsToggleHandler(() => this.toggleSettings());

    // 读取设置（统一校验后进入音频 / 转向系统）
    const s = settingsStore.get();
    this.audio.setSfxVolume(s.sfx);
    this.audio.setEngineVolume(s.engine);
    this.audio.setWeatherVolume(s.weather);
    this.audio.setMusicVolume(s.music);
    this.steerSensitivity = s.steer;

    this.input.setStartHandler(() => this.handleStart());
    this.input.setPauseHandler(() => this.togglePause());
    this.input.setHelpHandler(() => this.toggleHelp());
    this.input.setBackHandler(() => this.handleBack());

    this.wireEvents();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.installDebugApi();
    this.playSelectMusic();
    this.bindSelectMusicOnGesture();
    this.clock.start();
    this.raf = requestAnimationFrame(this.frame);
  }

  private wireEvents(): void {
    this.bus.on('race:state', ({ state }) => {
      if (state === 'countdown') {
        this.audio.init();
        this.audio.startEngine();
        this.countValue = 4;
      }
      if (state === 'racing') {
        this.audio.go();
        if (this.modeId === 'time-trial') {
          this.ghostRecorder.clear();
          this.ghostRecorder.start(0);
        }
      }
    });
    this.bus.on('race:finish', ({ rank, total, laps, bestLapMs }) => {
      this.audio.finish();
      this.hud.showHitFeedback(this.modeId === 'race' ? '冲线完赛！' : '计时结束！', 'positive');
      this.saveRaceResult(rank, total, laps, bestLapMs);
    });
    this.bus.on('race:lap', ({ index, time, valid }) => {
      if (index === 0 && this.modeId === 'time-trial' && valid) {
        this.finishTimeTrialLap(time);
      }
      if (index === 0) this.audio.countdownBeep(1);
    });
    this.bus.on('vehicle:collision', ({ index, strength }) => {
      const bike = this.bikes[index];
      if (!bike) return;
      const f = this.track.frameAt(bike.progress);
      const dir = bike.lateral > 0 ? f.right : f.right.clone().negate();
      this.particles.emitBarrier(bike.group.position.clone().addScaledVector(f.up, 0.6), dir);
      this.audio.collision(strength);
      if (index === 0) this.cameraRig.setShake(0.45 + strength * 0.55);
    });
    this.bus.on('vehicle:landing', ({ index, strength }) => {
      const bike = this.bikes[index];
      if (!bike) return;
      this.particles.emitLanding(bike.group.position.clone());
      if (index === 0) this.cameraRig.setShake(0.25 + strength * 0.5);
    });
    this.bus.on('vehicle:boost', ({ index, active }) => {
      if (index === 0 && active) this.audio.boost();
    });
    this.bus.on('vehicle:pickup', ({ index }) => {
      const bike = this.bikes[index];
      if (!bike) return;
      this.audio.boost();
      if (index === 0) {
        this.cameraRig.setShake(0.18);
        const f = this.track.frameAt(bike.progress);
        const rear = f.position.clone().addScaledVector(f.up, 0.45).addScaledVector(f.tangent, -1.15);
        this.particles.emitExhaust(rear, f.tangent, 1, true);
      }
    });
    this.bus.on('item:pickup', ({ index, kind }) => {
      this.audio.itemPickup();
      const bike = this.bikes[index];
      if (bike) this.particles.emitPickupSparkle(bike.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), new THREE.Color(ITEM_COLORS[kind]));
    });
    this.bus.on('item:fire', ({ index, kind }) => {
      this.audio.itemFire(kind);
      if (index === 0) this.cameraRig.setShake(0.12);
    });
    this.bus.on('item:hit', ({ index, kind, owner }) => {
      const bike = this.bikes[index];
      if (!bike) return;
      this.particles.emitItemHit(bike.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
      this.audio.itemHit(kind);
      if (owner === 0 && index !== 0) {
        this.audio.confirmHit();
        this.cameraRig.setShake(0.32);
        this.hitMarker = { targetIndex: index, until: this.simTime + 2.4 };
        this.hud.flashMinimapTarget(index);
        this.hud.showHitFeedback(`命中 ${this.bikeName(index)}！`, 'positive');
      } else if (index === 0) {
        this.cameraRig.setShake(0.6);
        this.hud.showHitFeedback('被击中！', 'negative');
      }
    });
    this.bus.on('item:block', ({ index, owner }) => {
      const bike = this.bikes[index];
      if (!bike) return;
      this.particles.emitShieldBlock(bike.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
      this.audio.shieldBlock();
      if (owner === 0) this.hud.showHitFeedback('被护盾挡下！', 'shield');
      else if (index === 0) this.hud.showHitFeedback('护盾格挡！', 'shield');
    });
    this.bus.on('audio:init', () => this.audio.init());
    this.bus.on('weather:change', ({ mode }) => {
      this.audio.setWeather(mode);
      this.weatherEl.className = mode === 'sunny' ? '' : `mode-${mode}`;
    });
    this.bus.on('weather:thunder', () => this.audio.thunder());
    this.bus.on('settings:sfx-volume', (v) => {
      this.audio.setSfxVolume(v);
      settingsStore.set({ sfx: v });
    });
    this.bus.on('settings:engine-volume', (v) => {
      this.audio.setEngineVolume(v);
      settingsStore.set({ engine: v });
    });
    this.bus.on('settings:weather-volume', (v) => {
      this.audio.setWeatherVolume(v);
      settingsStore.set({ weather: v });
    });
    this.bus.on('settings:music-volume', (v) => {
      this.audio.setMusicVolume(v);
      settingsStore.set({ music: v });
    });
    this.bus.on('settings:steer-sensitivity', (v) => {
      this.steerSensitivity = clamp(v, 0.5, 2.5);
      settingsStore.set({ steer: this.steerSensitivity });
      if (this.bikes[0]) this.bikes[0].steerGain = this.steerSensitivity;
    });
  }

  private startGame(sel: Selection): void {
    this.audio.init();
    this.helpOpen = false;
    this.settingsOpen = false;
    this.hitMarker = null;
    this.driftScore = 0;
    this.driftCombo = 0;
    this.simTime = 0;
    this.accumulator = 0;
    this.buildWorld(sel);
    this.configureDrift(sel);
    this.race.startRace();
  }

  private configureDrift(sel: Selection): void {
    const mode = MODES[sel.mode];
    this.driftTimeLeft = mode.timeLimitSec;
  }

  private buildWorld(sel: Selection): void {
    this.clearWorld();
    this.sel = sel;
    const mode = MODES[sel.mode];
    this.modeId = sel.mode;
    this.mode = mode;
    const spec = TRACKS[sel.track];
    this.track = new TrackPath(spec.id);
    this.rainSections = buildRainSections(this.track.length);

    const sunDir = new THREE.Vector3(0.42, 0.82, -0.38).normalize();
    this.world.add(createSky(sunDir, spec));
    this.clouds = new CloudLayer();
    this.world.add(this.clouds.group);

    this.roadChunks = createRoadChunks(this.track, spec);
    for (const c of this.roadChunks) this.world.add(c.group);
    this.envChunks = createEnvironmentChunks(this.track, spec);
    for (const c of this.envChunks) this.world.add(c.group);
    this.world.add(createTerrain(spec), createMountains(spec), createStartGantry(this.track), createCheckpointGates(this.track));

    this.pads = createBoostPads(this.track);
    this.obstacles = createRoadObstacles(this.track);
    for (const p of this.pads) this.world.add(p.group);
    for (const o of this.obstacles) this.world.add(o.group);

    const bikeSpec = BIKES[sel.bike];
    const riderSpec = RIDERS[sel.rider];
    const playerColorway = bikeSpec.colorways[sel.colorway] ?? bikeSpec.colorways[0];

    const bikeDefs: Array<[BikeSpec, RiderSpec, Colorway]> = [[bikeSpec, riderSpec, playerColorway]];
    for (let i = 0; i < mode.aiCount; i++) {
      const aiBike = BIKES[(sel.bike + 1 + i) % 3];
      const aiRider = RIDERS[i % RIDERS.length];
      bikeDefs.push([aiBike, aiRider, aiBike.colorways[0]]);
    }
    this.bikeNames = bikeDefs.map(([b]) => b.name);
    const grid = this.buildGrid(bikeDefs.length);
    this.bikes = bikeDefs.map(([b, r, cw], i) => {
      // 玩家（index 0）可选车衣进入比赛；AI 恒用原厂配色
      const wrap = i === 0 && sel.wrap ? getWrapTexture(b.form) : null;
      return new BikeEntity(i, grid.starts[i], grid.laterals[i], b, r, cw, wrap);
    });
    for (const b of this.bikes) this.world.add(b.group);
    this.bikes[0].steerGain = this.steerSensitivity;

    this.race = new RaceManager(this.bikes[0], this.bikes.slice(1), this.track, this.bus, mode.laps, mode.id);

    this.particles = new ParticleSystem(this.isTouch ? 420 : 700, this.rainSections);
    this.particles.addToScene(this.world);

    this.weather = new WeatherSystem(this.bus);
    this.world.add(this.weather.group);
    this.weather.setMode(spec.weather);

    this.items = mode.itemsEnabled ? new ItemSystem(this.track, this.bikes) : null;
    if (this.items) this.items.addToScene(this.world);

    // 幽灵车（仅计时赛，加载本地最佳圈）
    this.ghostVehicle = null;
    if (mode.id === 'time-trial') {
      this.ghostVehicle = loadGhostVehicle(spec.id, mode.id);
      if (this.ghostVehicle) this.world.add(this.ghostVehicle.group);
    }

    this.hud.setTrack(this.track);
    this.hud.setBikes(this.bikes);
    this.hud.setMode(mode.id);
    this.audio.playMusic(spec.music);
    this.built = true;
  }

  private buildGrid(count: number): { starts: number[]; laterals: number[] } {
    const laterals = count === 1 ? [0] : [-1.5, 2.2, 4.6, -4.2].slice(0, count);
    const starts = [0];
    for (let i = 1; i < count; i++) starts.push(this.track.length * (0.012 + (i - 1) * 0.016));
    return { starts, laterals };
  }

  private clearWorld(): void {
    if (this.world.parent) this.scene.remove(this.world);
    this.world.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.bikes = [];
    this.items = null;
    this.ghostVehicle = null;
    this.ghostRecorder.clear();
  }

  private restartRace(): void {
    if (!this.built) return;
    this.setPaused(false);
    this.helpOpen = false;
    this.settingsOpen = false;
    this.simTime = 0;
    this.accumulator = 0;
    this.driftScore = 0;
    this.driftCombo = 0;
    this.driftTimeLeft = this.mode.timeLimitSec;
    const grid = this.buildGrid(this.bikes.length);
    this.race.reset(grid.starts, grid.laterals);
    this.items?.reset();
    this.hitMarker = null;
    this.bus.emit('hud:item', { kind: null });
    this.hud.setMode(this.modeId);
    this.audio.resetEngine();
    this.race.startRace();
    this.audio.init();
  }

  private resumeGame(): void {
    this.setPaused(false);
    this.hud.showScreen('');
  }

  private exitToSelect(): void {
    this.paused = false;
    this.helpOpen = false;
    this.settingsOpen = false;
    this.hitMarker = null;
    this.driftScore = 0;
    this.driftCombo = 0;
    this.audio.stopEngine();
    this.audio.stopMusic();
    this.clearWorld();
    this.built = false;
    this.bus.emit('hud:item', { kind: null });
    this.hud.showScreen('mode');
    this.playSelectMusic();
  }

  private handleBack(): void {
    if (this.settingsOpen) this.toggleSettings();
    else if (this.helpOpen) this.toggleHelp();
    else if (this.built && this.paused) this.exitToSelect();
  }

  /** 选关界面：随机播放三首曲目之一 */
  private playSelectMusic(): void {
    const track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    this.audio.playMusic(track.music);
  }

  /** 首次用户交互时启动选关音乐（绕过浏览器自动播放限制） */
  private bindSelectMusicOnGesture(): void {
    const start = (): void => {
      document.removeEventListener('pointerdown', start);
      document.removeEventListener('keydown', start);
      document.removeEventListener('touchstart', start);
      if (!this.built) this.playSelectMusic();
    };
    document.addEventListener('pointerdown', start);
    document.addEventListener('keydown', start);
    document.addEventListener('touchstart', start);
  }

  private handleStart(): void {
    if (!this.built) {
      this.startGame(this.hud.getSelection());
      return;
    }
    const st = this.race.state;
    if (st === 'racing' || st === 'countdown') {
      if (this.paused) this.resumeGame();
      return;
    }
    if (st === 'finished') this.restartRace();
  }

  private setPaused(v: boolean): void {
    if (this.paused === v) return;
    this.paused = v;
    if (v) this.audio.pauseAll();
    else this.audio.resumeAll();
  }

  private togglePause(): void {
    if (!this.built) return;
    if (this.race.state === 'racing' || this.race.state === 'countdown') {
      this.setPaused(!this.paused);
      this.hud.showScreen(this.paused ? 'paused' : '');
    }
  }

  private toggleHelp(): void {
    if (this.helpOpen) {
      this.helpOpen = false;
      if (this.helpWasRacing) {
        this.setPaused(false);
        this.hud.showScreen('');
      } else if (this.built && this.race.state === 'finished') {
        this.hud.showScreen('finish');
      } else {
        this.hud.showScreen('mode');
      }
    } else {
      this.helpOpen = true;
      this.settingsOpen = false;
      this.helpWasRacing = this.built && (this.race.state === 'racing' || this.race.state === 'countdown');
      if (this.helpWasRacing) this.setPaused(true);
      this.hud.showScreen('help');
    }
  }

  private toggleSettings(): void {
    if (this.settingsOpen) {
      this.settingsOpen = false;
      if (this.built && this.paused) this.hud.showScreen('paused');
      else this.hud.showScreen('mode');
    } else {
      this.settingsOpen = true;
      this.helpOpen = false;
      this.hud.showScreen('settings');
    }
  }

  private bikeName(index: number): string {
    return this.bikeNames[index] ?? `对手${index}`;
  }

  private isInRainSection(progress: number): boolean {
    const p = this.track ? this.track.wrap(progress) : progress;
    return this.rainSections.some(([a, b]) => p > a && p < b);
  }

  private saveRaceResult(rank: number, total: number, laps: number[], bestLapMs: number): void {
    if (!this.sel) return;
    const spec = TRACKS[this.sel.track];
    const bike = BIKES[this.sel.bike];
    const result = RecordStore.makeResult({
      mode: this.modeId,
      trackId: spec.id,
      bikeId: bike.id,
      position: this.modeId === 'race' ? rank : undefined,
      totalTimeMs: Math.round(total * 1000),
      lapTimesMs: laps.map((t) => Math.round(t * 1000)),
      bestLapMs: Math.round(bestLapMs * 1000),
    });
    RecordStore.save(result);

    // 竞速赛完赛：提交全服排行榜（异步，不阻塞流程）
    if (this.modeId === 'race') {
      void submitRaceResult({
        totalTimeMs: result.totalTimeMs,
        bikeId: bike.id,
        trackId: spec.id,
        gameVersion: result.gameVersion,
      });
    }
  }

  private finishTimeTrialLap(lapTimeSec: number): void {
    if (!this.sel) return;
    const spec = TRACKS[this.sel.track];
    const bike = BIKES[this.sel.bike];
    const colorway = bike.colorways[this.sel.colorway] ?? bike.colorways[0];
    const rider = RIDERS[this.sel.rider];
    const result = this.ghostRecorder.finishLap(spec.id, this.modeId, bike.form, colorway, rider, Math.round(lapTimeSec * 1000));
    if (result.isBest) {
      this.hud.showHitFeedback(`新纪录！${this.formatMs(result.lapTimeMs)}`, 'positive');
    }
    // 新的一圈立即开始录制（起点即上一圈终点）
    this.ghostRecorder.start(this.race.raceTime);
  }

  private formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const tenth = Math.floor((ms % 1000) / 100);
    return `${s}.${tenth}`;
  }

  private updateDrift(dt: number): void {
    if (this.modeId !== 'drift' || this.race.state !== 'racing') return;
    this.driftTimeLeft -= dt;
    const p = this.bikes[0];
    if (p.isDrifting && p.speed > 30) {
      this.driftCombo += dt;
      const speedFactor = clamp(p.speed / 60, 0, 1);
      const comboMult = 1 + Math.min(this.driftCombo, 10) * 0.18;
      this.driftScore += 12 * speedFactor * comboMult * dt;
    } else {
      this.driftCombo = Math.max(0, this.driftCombo - dt * 2);
    }
    this.bus.emit('hud:drift', { score: Math.floor(this.driftScore), combo: this.driftCombo, timeLeft: Math.max(0, this.driftTimeLeft) });
    if (this.driftTimeLeft <= 0) this.finishDrift();
  }

  private finishDrift(): void {
    if (!this.sel) return;
    const spec = TRACKS[this.sel.track];
    const bike = BIKES[this.sel.bike];
    const score = Math.floor(this.driftScore);
    const prevBest = RecordStore.getBest(spec.id, 'drift');
    const best = Math.max(score, prevBest?.driftScore ?? 0);
    const isBest = score > 0 && score >= best && score > (prevBest?.driftScore ?? 0);
    RecordStore.save(
      RecordStore.makeResult({
        mode: 'drift',
        trackId: spec.id,
        bikeId: bike.id,
        totalTimeMs: Math.round(this.race.raceTime * 1000),
        lapTimesMs: [],
        bestLapMs: 0,
        driftScore: score,
      }),
    );
    this.bus.emit('drift:finish', { score, best, isBest });
    this.race.finishRace();
  }

  private updateHitArrow(): void {
    const marker = this.hitMarker;
    if (!marker || this.simTime > marker.until) {
      this.hitMarker = null;
      this.hud.updateHitArrow(0, false);
      return;
    }
    const target = this.bikes[marker.targetIndex];
    if (!target) {
      this.hud.updateHitArrow(0, false);
      return;
    }
    const cam = this.cameraRig.camera;
    const dir = target.group.position.clone().sub(cam.position);
    const q = cam.quaternion;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    let x = dir.dot(right);
    let y = dir.dot(up);
    if (dir.dot(fwd) < 0) {
      x = -x;
      y = -y;
    }
    this.hud.updateHitArrow(Math.atan2(y, x), true);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h, this.dpr);
    this.cameraRig.resize(w / Math.max(1, h));
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(MAX_FRAME_TIME, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.input.poll();

    const uiAction = this.input.uiAction;
    if (uiAction) this.hud.handleUiAction(uiAction);

    if (this.built) {
      const playing = !this.paused && this.race.state !== 'title';

      // 固定 60 Hz 逻辑步：物理 / AI / 道具在此推进，保证各帧率行为一致。
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < MAX_SIM_STEPS) {
        this.simTime += FIXED_STEP;
        if (playing) {
          this.race.update(FIXED_STEP, this.input.state, this.simTime);
          if (this.race.state === 'countdown') {
            const c = Math.max(0, Math.ceil(this.race.countdown));
            if (c !== this.countValue) {
              this.countValue = c;
              this.audio.countdownBeep(c);
            }
          }
          this.updateDrift(FIXED_STEP);
          this.updateParticleEmissions(FIXED_STEP, time);
          updatePads(this.pads, this.bikes, this.track, this.bus, this.race.raceTime);
          updateObstacles(this.obstacles, this.bikes, this.track, this.bus, this.race.raceTime);
          if (this.items) this.items.update(FIXED_STEP, this.race.raceTime, this.bikes, this.track, this.bus, this.input.state.useItem);
        }
        this.accumulator -= FIXED_STEP;
        steps += 1;
      }
      if (this.accumulator > FIXED_STEP) this.accumulator = FIXED_STEP;

      // 计时赛：录制幽灵 + 回放
      if (this.modeId === 'time-trial' && this.race.state === 'racing') {
        const p = this.bikes[0];
        this.ghostRecorder.record(this.race.raceTime, p.progress, p.lateral, p.speed, p.leanAmount);
      }
      if (this.ghostVehicle) this.ghostVehicle.update(this.race.raceTime, this.track);

      const player = this.bikes[0];
      const finishedRecently = this.race.state === 'racing' && player.finished && this.race.raceTime - player.finishTime < 2.2;
      const cinematic = this.race.state === 'countdown' || finishedRecently || this.race.state === 'finished';
      this.cameraRig.update(dt, player, this.track, cinematic, time);
      this.updateHitArrow();
      this.clouds.update(dt, this.cameraRig.camera);
      this.weather.setStorm(this.isInRainSection(player.progress));
      this.weather.update(dt, this.cameraRig.camera, time);
      this.flashEl.style.opacity = String(Math.min(1, this.weather.flash));

      updateChunkVisibility(this.roadChunks, player.progress, this.track.length);
      updateEnvironmentVisibility(this.envChunks, player.progress, this.track.length);
      animatePads(this.pads, time);

      const fov = this.cameraRig.camera.fov * THREE.MathUtils.DEG2RAD;
      const pixelScale = (window.innerHeight * this.dpr) / (2 * Math.tan(fov / 2));
      this.particles.update(dt, pixelScale);
      this.audio.update(player.speed, this.input.state.throttle, player.isDrifting, player.boostActive);
    } else {
      this.hud.renderSelection(dt);
    }

    this.renderer.render(this.scene, this.cameraRig.camera);
    this.trackFrameTime(dt);
  };

  private updateParticleEmissions(dt: number, time: number): void {
    this.exhaustAccum += dt;
    this.skidAccum += dt;
    this.splashAccum += dt;
    for (let i = 0; i < this.bikes.length; i++) {
      const bike = this.bikes[i];
      const origin = bike.group.position;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(bike.group.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(bike.group.quaternion);
      const rear = origin.clone().addScaledVector(up, 0.45).addScaledVector(fwd, -1.15);
      const throttle = bike === this.bikes[0] ? this.input.state.throttle : bike.speed > 4;
      if (throttle && bike.speed > 2 && this.exhaustAccum > 0.045) {
        this.particles.emitExhaust(rear, fwd, clamp(bike.speed / 40, 0, 1), bike.boostActive);
        this.exhaustAccum = 0;
      }
      if (bike.isDrifting && this.skidAccum > 0.035) {
        const side = bike.lateral > 0 ? 1 : -1;
        const pos = rear.clone().addScaledVector(up, 0.05);
        this.particles.emitSkid(pos, side);
        this.skidAccum = 0;
      }
      if (bike.speed > 14 && this.splashAccum > 0.07) {
        this.particles.emitSplash(rear, bike.progress);
        this.splashAccum = 0;
      }
    }
    void time;
  }

  private trackFrameTime(dt: number): void {
    this.frameMs += dt * 1000;
    this.frameCount++;
    if (this.frameCount < 60) return;
    const avg = this.frameMs / this.frameCount;
    this.fps = avg > 0 ? 1000 / avg : 60;
    this.frameMs = 0;
    this.frameCount = 0;
    if (avg > 24 && this.dpr > 1.05) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.resize();
    } else if (avg < 14.5 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
      this.resize();
    }
  }

  private installDebugApi(): void {
    window.__RACE_DEBUG__ = {
      setCamera: (mode) => {
        this.cameraRig.mode = mode;
      },
      jumpTo: (progress) => {
        if (!this.built) return;
        this.bikes[0].progress = this.track.wrap(progress);
        this.bikes[0].update(0, this.track, { throttle: false, brake: false, steer: 0, drift: false, boost: false, nitro: false }, this.bus, 0, false);
        this.cameraRig.snapTo(this.bikes[0], this.track);
      },
      start: () => this.handleStart(),
      pause: () => {
        this.setPaused(true);
        this.hud.showScreen('paused');
      },
      resume: () => this.resumeGame(),
      setState: (state) => {
        if (state === 'racing') this.handleStart();
      },
      setPostprocess: (enabled) => {
        this.renderer.direct = !enabled;
      },
      setWeather: (mode) => {
        if (this.built) this.weather.setMode(mode);
      },
      getState: () => this.getStateSafe(),
    };
  }

  private getStateSafe(): {
    progress: number;
    lateral: number;
    speed: number;
    state: string;
    rank: number;
    lap: number;
    countdown: number;
    fps: number;
    camPos: [number, number, number];
    camPitch: number;
    camLook: [number, number, number];
    bikeY: number;
    upY: number;
    tanY: number;
    slope: number;
    renderCalls: number;
    renderTris: number;
  } {
    if (!this.built) {
      return {
        progress: 0,
        lateral: 0,
        speed: 0,
        state: 'select',
        rank: 0,
        lap: 0,
        countdown: 0,
        fps: Math.round(this.fps),
        camPos: [0, 0, 0],
        camPitch: 0,
        camLook: [0, 0, 0],
        bikeY: 0,
        upY: 1,
        tanY: 0,
        slope: 0,
        renderCalls: 0,
        renderTris: 0,
      };
    }
    const bike = this.bikes[0];
    const frame = this.track.frameAt(bike.progress);
    return {
      progress: bike.progress,
      lateral: bike.lateral,
      speed: bike.speed,
      state: this.race.state,
      rank: this.race.playerRank,
      lap: bike.lap,
      countdown: this.race.countdown,
      fps: Math.round(this.fps),
      camPos: [this.cameraRig.camera.position.x, this.cameraRig.camera.position.y, this.cameraRig.camera.position.z],
      camPitch: Math.asin(new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraRig.camera.quaternion).y),
      camLook: [this.cameraRig.lookPoint.x, this.cameraRig.lookPoint.y, this.cameraRig.lookPoint.z],
      bikeY: bike.group.position.y,
      upY: frame.up.y,
      tanY: frame.tangent.y,
      slope: this.track.slopeAt(bike.progress),
      renderCalls: this.renderer.renderer.info.render.calls,
      renderTris: this.renderer.renderer.info.render.triangles,
    };
  }
}