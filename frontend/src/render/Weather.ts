import * as THREE from 'three';
import { EventBus } from '../core/events';

export type WeatherMode = 'sunny' | 'rain' | 'snow' | 'storm';

function makeRainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 8, 64);
  // 雨滴：白色细长雨丝 + 深色描边（黑边包白），保证在暗色雷暴背景下依然清晰
  const cx = 4;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(18, 22, 34, 0.95)';
  ctx.fillStyle = 'rgba(235, 245, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(cx, 2);
  ctx.lineTo(cx, 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, 6, 1.9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, 26, 1.7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, 50, 1.4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function makeSnowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export class WeatherSystem {
  readonly group = new THREE.Group();
  /** 赛道基础天气（非雨区时生效：sunny / snow） */
  baseMode: WeatherMode = 'sunny';
  /** 当前生效天气（含雨区覆盖） */
  mode: WeatherMode = 'sunny';
  flash = 0;

  private bus: EventBus;
  private rain: THREE.Points;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private rainCount = 3600;
  private snowCount = 650;
  private inStorm = false;
  private lightningTimer = 4;
  private wind = 0;

  constructor(bus: EventBus) {
    this.bus = bus;
    const rainTex = makeRainTexture();
    const rainMat = new THREE.PointsMaterial({
      map: rainTex,
      color: 0xffffff,
      size: 1.9,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.rainPos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPos[i * 3] = (Math.random() - 0.5) * 36;
      this.rainPos[i * 3 + 1] = Math.random() * 22;
      this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.Points(rainGeo, rainMat);

    const snowTex = makeSnowTexture();
    const snowMat = new THREE.PointsMaterial({
      map: snowTex,
      color: 0xffffff,
      size: 1.1,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.snowPos = new Float32Array(this.snowCount * 3);
    for (let i = 0; i < this.snowCount; i++) {
      this.snowPos[i * 3] = (Math.random() - 0.5) * 130;
      this.snowPos[i * 3 + 1] = Math.random() * 70;
      this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * 130;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(snowGeo, snowMat);

    this.rain.visible = false;
    this.snow.visible = false;
    this.rain.layers.set(2);
    this.snow.layers.set(2);
    this.group.add(this.rain, this.snow);
    this.group.layers.set(2);
  }

  update(dt: number, camera: THREE.Camera, time: number): void {
    this.group.position.copy(camera.position);

    const eff = this.inStorm ? 'storm' : this.baseMode;
    if (eff !== this.mode) {
      this.mode = eff;
      this.bus.emit('weather:change', { mode: this.mode });
    }

    if (this.mode === 'rain' || this.mode === 'storm') {
      this.updateRain(dt, time);
    } else if (this.mode === 'snow') {
      this.updateSnow(dt, time);
    }

    if (this.mode === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.flash = 1;
        this.lightningTimer = 3.5 + Math.random() * 7;
        this.bus.emit('weather:thunder', undefined);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.4);
    const rainOpacity = this.mode === 'storm' ? 0.9 : this.mode === 'rain' ? 0.72 : 0;
    (this.rain.material as THREE.PointsMaterial).opacity = rainOpacity;
    (this.snow.material as THREE.PointsMaterial).opacity = this.mode === 'snow' ? 0.9 : 0;
    this.group.visible = this.mode !== 'sunny';
  }

  /** 设置赛道基础天气（晴天 / 雪原整场下雪） */
  setMode(mode: WeatherMode): void {
    this.baseMode = mode;
    if (mode === 'snow') {
      this.wind = 0.6;
    } else {
      this.wind = 0.8;
    }
    this.flash = 0;
    this.emit();
  }

  /** 进入/离开赛道上的雨区（雷暴段）。雨 + 雷声只在这一段出现。 */
  setStorm(active: boolean): void {
    if (this.inStorm === active) return;
    this.inStorm = active;
    if (active) {
      this.wind = 1.6;
      // 进入雨区后很快来第一道雷，保证雷声可被听到
      this.lightningTimer = 0.9 + Math.random() * 0.8;
      this.flash = 0;
    } else {
      this.wind = this.baseMode === 'snow' ? 0.6 : 0.8;
      this.lightningTimer = 4;
      this.flash = 0;
    }
    this.emit();
  }

  private emit(): void {
    this.mode = this.inStorm ? 'storm' : this.baseMode;
    this.bus.emit('weather:change', { mode: this.mode });
  }

  private updateRain(dt: number, time: number): void {
    const fall = 44 + this.wind * 5;
    for (let i = 0; i < this.rainCount; i++) {
      let x = this.rainPos[i * 3] + this.wind * dt * 7;
      const y = this.rainPos[i * 3 + 1] - fall * dt;
      if (y < 0) {
        x = (Math.random() - 0.5) * 36;
        this.rainPos[i * 3 + 1] = 20 + Math.random() * 2;
        this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
      } else {
        this.rainPos[i * 3 + 1] = y;
      }
      this.rainPos[i * 3] = x;
    }
    void time;
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  private updateSnow(dt: number, time: number): void {
    for (let i = 0; i < this.snowCount; i++) {
      const y = this.snowPos[i * 3 + 1] - 2.6 * dt;
      this.snowPos[i * 3] += Math.sin(time * 0.8 + i) * dt * 1.8 + this.wind * dt * 1.5;
      this.snowPos[i * 3 + 2] += Math.cos(time * 0.6 + i * 1.7) * dt * 1.4;
      this.snowPos[i * 3 + 1] = y < 0 ? 66 : y;
      if (y < 0) {
        this.snowPos[i * 3] = (Math.random() - 0.5) * 130;
        this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * 130;
      }
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
  }
}