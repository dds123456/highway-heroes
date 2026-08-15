import * as THREE from 'three';
import { EventBus } from '../core/events';

export type WeatherMode = 'sunny' | 'rain' | 'snow' | 'storm';

function makeRainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 8, 48);
  ctx.fillStyle = 'rgba(220,235,255,0.9)';
  ctx.fillRect(3, 0, 2, 46);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
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
  mode: WeatherMode = 'sunny';
  flash = 0;

  private bus: EventBus;
  private rain: THREE.Points;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private rainCount = 900;
  private snowCount = 650;
  private nextChangeAt = 18;
  private lightningTimer = 4;
  private wind = 0;

  constructor(bus: EventBus) {
    this.bus = bus;
    const rainTex = makeRainTexture();
    const rainMat = new THREE.PointsMaterial({
      map: rainTex,
      color: 0xcfe4ff,
      size: 1.7,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rainPos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPos[i * 3] = (Math.random() - 0.5) * 110;
      this.rainPos[i * 3 + 1] = Math.random() * 80;
      this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
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
    if (time > this.nextChangeAt) {
      this.cycle();
      this.nextChangeAt = time + 52;
    }
    this.group.position.copy(camera.position);
    this.group.visible = this.mode !== 'sunny';

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
  }

  setMode(mode: WeatherMode): void {
    this.mode = mode;
    this.wind = mode === 'snow' ? 0.6 : mode === 'storm' ? 1.6 : 0.8;
    this.lightningTimer = 2;
    this.flash = 0;
    this.nextChangeAt = performance.now() / 1000 + 52;
    this.bus.emit('weather:change', { mode });
  }

  private cycle(): void {
    const order: WeatherMode[] = ['sunny', 'rain', 'storm', 'snow'];
    const idx = order.indexOf(this.mode);
    this.mode = order[(idx + 1) % order.length];
    this.wind = this.mode === 'snow' ? 0.6 : this.mode === 'storm' ? 1.6 : 0.8;
    this.lightningTimer = 2.5 + Math.random() * 3;
    this.flash = 0;
    this.bus.emit('weather:change', { mode: this.mode });
  }

  private updateRain(dt: number, time: number): void {
    for (let i = 0; i < this.rainCount; i++) {
      const y = this.rainPos[i * 3 + 1] - (30 + this.wind * 4) * dt;
      this.rainPos[i * 3] += this.wind * dt * 6;
      this.rainPos[i * 3 + 1] = y < 0 ? 78 : y;
      if (y < 0) {
        this.rainPos[i * 3] = (Math.random() - 0.5) * 110;
        this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 110;
      }
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
