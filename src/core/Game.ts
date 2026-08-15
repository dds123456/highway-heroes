import * as THREE from 'three';
import { COLORS } from './constants';
import { EventBus } from './events';
import { Input } from './Input';
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
import { RaceManager } from '../race/Race';
import { AudioEngine } from '../audio/AudioEngine';
import { HUD } from '../ui/HUD';

export class Game {
  private root = document.getElementById('game-root')!;
  private canvas: HTMLCanvasElement;
  private renderer: GameRenderer;
  private scene = new THREE.Scene();
  private track: TrackPath;
  private cameraRig: CameraRig;
  private clouds: CloudLayer;
  private roadChunks: ReturnType<typeof createRoadChunks>;
  private envChunks: ReturnType<typeof createEnvironmentChunks>;
  private particles: ParticleSystem;
  private weather: WeatherSystem;
  private pads: BoostPad[];
  private obstacles: RoadObstacle[];
  private weatherEl: HTMLElement;
  private flashEl: HTMLElement;
  private bikes: BikeEntity[] = [];
  private race: RaceManager;
  private audio = new AudioEngine();
  private hud: HUD;
  private input = new Input();
  private bus = new EventBus();
  private clock = new THREE.Clock();
  private raf = 0;
  private paused = false;
  private dpr = 1;
  private maxDpr = 1;
  private wetStart: number;
  private wetEnd: number;
  private exhaustAccum = 0;
  private skidAccum = 0;
  private splashAccum = 0;
  private countValue = 4;
  private frameMs = 0;
  private frameCount = 0;
  private fps = 60;

  constructor() {
    this.track = new TrackPath();
    this.wetStart = this.track.length * 0.62;
    this.wetEnd = this.track.length * 0.74;
    this.canvas = document.createElement('canvas');
    this.root.appendChild(this.canvas);
    this.renderer = new GameRenderer(this.canvas);
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;
    this.cameraRig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight));

    const sunDir = new THREE.Vector3(0.42, 0.82, -0.38).normalize();
    this.scene.add(createSky(sunDir));
    this.clouds = new CloudLayer();
    this.scene.add(this.clouds.group);

    this.roadChunks = createRoadChunks(this.track);
    for (const chunk of this.roadChunks) this.scene.add(chunk.group);
    this.envChunks = createEnvironmentChunks(this.track);
    for (const chunk of this.envChunks) this.scene.add(chunk.group);
    this.scene.add(createTerrain(), createMountains(), createStartGantry(this.track), createCheckpointGates(this.track));
    this.pads = createBoostPads(this.track);
    this.obstacles = createRoadObstacles(this.track);
    for (const pad of this.pads) this.scene.add(pad.group);
    for (const obstacle of this.obstacles) this.scene.add(obstacle.group);

    const starts = [0, this.track.length * 0.012, this.track.length * 0.028, this.track.length * 0.044];
    const laterals = [-1.5, 2.2, 4.6, -4.2];
    const bikeDefs = [
      [COLORS.player, COLORS.playerAccent],
      [COLORS.aiA, COLORS.sun],
      [COLORS.aiB, COLORS.sun],
      [COLORS.aiC, COLORS.sun],
    ] as const;
    this.bikes = bikeDefs.map(([primary, accent], i) => new BikeEntity(i, starts[i], laterals[i], primary, accent));
    for (const bike of this.bikes) this.scene.add(bike.group);

    this.race = new RaceManager(this.bikes[0], this.bikes.slice(1), this.track, this.bus);

    this.particles = new ParticleSystem(700, this.wetStart, this.wetEnd);
    this.particles.addToScene(this.scene);
    this.weather = new WeatherSystem(this.bus);
    this.scene.add(this.weather.group);
    this.weatherEl = document.getElementById('weather-overlay')!;
    this.flashEl = document.getElementById('weather-flash')!;

    this.hud = new HUD(this.bus, this.track);
    this.hud.setBikes(this.bikes);
    this.hud.setRestartHandler(() => this.handleStart());

    this.input.setStartHandler(() => this.handleStart());
    this.input.setPauseHandler(() => this.togglePause());

    this.wireEvents();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.installDebugApi();
    this.clock.start();
    this.raf = requestAnimationFrame(this.frame);
  }

  private wireEvents(): void {
    this.bus.on('race:state', ({ state }) => {
      if (state === 'countdown') {
        this.audio.init();
        this.countValue = 4;
      }
      if (state === 'racing') this.audio.go();
    });
    this.bus.on('race:finish', () => this.audio.finish());
    this.bus.on('race:lap', ({ index }) => {
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
    this.bus.on('audio:init', () => this.audio.init());
    this.bus.on('weather:change', ({ mode }) => {
      this.audio.setWeather(mode);
      this.weatherEl.className = mode === 'sunny' ? '' : `mode-${mode}`;
    });
    this.bus.on('weather:thunder', () => this.audio.thunder());
  }

  private handleStart(): void {
    const state = this.race.state;
    if (state === 'racing' || state === 'countdown') {
      if (this.paused) {
        this.paused = false;
        this.hud.showScreen('');
      }
      return;
    }
    this.audio.init();
    if (state === 'finished') this.resetRace();
    this.race.startRace();
  }

  private resetRace(): void {
    const starts = [0, this.track.length * 0.012, this.track.length * 0.028, this.track.length * 0.044];
    const laterals = [-1.5, 2.2, 4.6, -4.2];
    this.race.reset(starts, laterals);
  }

  private togglePause(): void {
    if (this.race.state === 'racing' || this.race.state === 'countdown') {
      this.paused = !this.paused;
      this.hud.showScreen(this.paused ? 'paused' : '');
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h, this.dpr);
    this.cameraRig.resize(w / Math.max(1, h));
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.input.poll();

    if (!this.paused && this.race.state !== 'title') {
      this.race.update(dt, this.input.state, time);
      if (this.race.state === 'countdown') {
        const c = Math.max(0, Math.ceil(this.race.countdown));
        if (c !== this.countValue) {
          this.countValue = c;
          this.audio.countdownBeep(c);
        }
      }
    }

    const player = this.bikes[0];
    const finishedRecently = this.race.state === 'racing' && player.finished && time - player.finishTime < 4.5;
    const cinematic = this.race.state === 'countdown' || finishedRecently || this.race.state === 'finished';
    this.cameraRig.update(dt, player, this.track, cinematic, time);
    this.clouds.update(dt, this.cameraRig.camera);
    this.weather.update(dt, this.cameraRig.camera, time);
    this.flashEl.style.opacity = String(Math.min(1, this.weather.flash));

    updateChunkVisibility(this.roadChunks, player.progress, this.track.length);
    updateEnvironmentVisibility(this.envChunks, player.progress, this.track.length);
    this.updateParticleEmissions(dt, time);
    animatePads(this.pads, time);
    updatePads(this.pads, this.bikes, this.track, this.bus, this.race.raceTime);
    updateObstacles(this.obstacles, this.bikes, this.track, this.bus, this.race.raceTime);

    const fov = this.cameraRig.camera.fov * THREE.MathUtils.DEG2RAD;
    const pixelScale = (window.innerHeight * this.dpr) / (2 * Math.tan(fov / 2));
    this.particles.update(dt, pixelScale);
    this.audio.update(player.speed, this.input.state.throttle, player.isDrifting, player.boostActive);

    this.renderer.render(this.scene, this.cameraRig.camera);
    this.trackFrameTime(dt);
  };

  private updateParticleEmissions(dt: number, time: number): void {
    this.exhaustAccum += dt;
    this.skidAccum += dt;
    this.splashAccum += dt;
    for (let i = 0; i < this.bikes.length; i++) {
      const bike = this.bikes[i];
      const f = this.track.frameAt(bike.progress);
      const rear = f.position.clone().addScaledVector(f.up, 0.45).addScaledVector(f.tangent, -1.15);
      const throttle = bike === this.bikes[0] ? this.input.state.throttle : bike.speed > 4;
      if (throttle && bike.speed > 2 && this.exhaustAccum > 0.045) {
        this.particles.emitExhaust(rear, f.tangent, clamp(bike.speed / 40, 0, 1), bike.boostActive);
        this.exhaustAccum = 0;
      }
      if (bike.isDrifting && this.skidAccum > 0.035) {
        const side = bike.lateral > 0 ? 1 : -1;
        const pos = rear.clone().addScaledVector(f.up, 0.05);
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
        this.bikes[0].progress = this.track.wrap(progress);
        this.bikes[0].update(0, this.track, { throttle: false, brake: false, steer: 0, drift: false, boost: false, nitro: false }, this.bus, 0, false);
        this.cameraRig.snapTo(this.bikes[0], this.track);
      },
      start: () => this.handleStart(),
      pause: () => {
        this.paused = true;
        this.hud.showScreen('paused');
      },
      resume: () => {
        this.paused = false;
        this.hud.showScreen('');
      },
      setState: (state) => {
        if (state === 'racing') this.handleStart();
      },
      setPostprocess: (enabled) => {
        this.renderer.direct = !enabled;
      },
      setWeather: (mode) => {
        this.weather.setMode(mode);
      },
      getState: () => ({
        progress: this.bikes[0].progress,
        lateral: this.bikes[0].lateral,
        speed: this.bikes[0].speed,
        state: this.race.state,
        rank: this.race.playerRank,
        lap: this.bikes[0].lap,
        countdown: this.race.countdown,
        fps: Math.round(this.fps),
        camPos: [this.cameraRig.camera.position.x, this.cameraRig.camera.position.y, this.cameraRig.camera.position.z],
        camPitch: Math.asin(new THREE.Vector3(0, 0, -1).applyQuaternion(this.cameraRig.camera.quaternion).y),
        camLook: [this.cameraRig.lookPoint.x, this.cameraRig.lookPoint.y, this.cameraRig.lookPoint.z],
        bikeY: this.bikes[0].group.position.y,
        upY: this.track.frameAt(this.bikes[0].progress).up.y,
        tanY: this.track.frameAt(this.bikes[0].progress).tangent.y,
        slope: this.track.slopeAt(this.bikes[0].progress),
        renderCalls: this.renderer.renderer.info.render.calls,
        renderTris: this.renderer.renderer.info.render.triangles,
      }),
    };
  }
}
