import * as THREE from 'three';
import { clamp, rand } from '../math/utils';

interface ParticleState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  growth: number;
}

const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPixelScale / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform float uHardness;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    float soft = 1.0 - smoothstep(0.62, 1.0, r);
    float hard = 1.0 - step(0.88, r);
    float alpha = mix(soft, hard, uHardness);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;

export class ParticlePool {
  readonly points: THREE.Points;
  private capacity: number;
  private states: ParticleState[] = [];
  private positionAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private colorAttr: THREE.BufferAttribute;
  private cursor = 0;

  constructor(capacity: number, blending: THREE.Blending, hardness: number) {
    this.capacity = capacity;
    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(capacity), 1);
    this.colorAttr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uPixelScale: { value: 720 },
        uHardness: { value: hardness },
      },
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.layers.set(2);
  }

  emit(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    size: number,
    life: number,
    gravity = 0,
    growth = 0,
    alpha = 1,
  ): void {
    if (this.states.length < this.capacity) {
      this.states.push({
        pos: pos.clone(),
        vel: vel.clone(),
        color: color.clone(),
        size,
        alpha,
        life,
        maxLife: life,
        gravity,
        growth,
      });
      return;
    }
    const s = this.states[this.cursor];
    s.pos.copy(pos);
    s.vel.copy(vel);
    s.color.copy(color);
    s.size = size;
    s.alpha = alpha;
    s.life = life;
    s.maxLife = life;
    s.gravity = gravity;
    s.growth = growth;
    this.cursor = (this.cursor + 1) % this.capacity;
  }

  update(dt: number, pixelScale: number): void {
    const mat = this.points.material as THREE.ShaderMaterial;
    mat.uniforms.uPixelScale.value = pixelScale;
    let write = 0;
    for (let i = 0; i < this.states.length; i++) {
      const s = this.states[i];
      s.life -= dt;
      if (s.life <= 0) continue;
      s.vel.y -= s.gravity * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.size = Math.max(0.05, s.size + s.growth * dt);
      const t = s.life / s.maxLife;
      this.positionAttr.setXYZ(write, s.pos.x, s.pos.y, s.pos.z);
      this.sizeAttr.setX(write, s.size);
      this.alphaAttr.setX(write, s.alpha * clamp(t * 1.4, 0, 1));
      this.colorAttr.setXYZ(write, s.color.r, s.color.g, s.color.b);
      this.states[write] = s;
      write++;
    }
    this.states.length = write;
    this.positionAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, write);
  }
}

export class ParticleSystem {
  readonly smoke: ParticlePool;
  readonly spark: ParticlePool;
  private wetZoneStart: number;
  private wetZoneEnd: number;

  constructor(capacity = 700, wetZoneStart = 0, wetZoneEnd = 0) {
    this.smoke = new ParticlePool(capacity, THREE.NormalBlending, 0.8);
    this.spark = new ParticlePool(360, THREE.AdditiveBlending, 1);
    this.wetZoneStart = wetZoneStart;
    this.wetZoneEnd = wetZoneEnd;
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.smoke.points, this.spark.points);
  }

  update(dt: number, pixelScale: number): void {
    this.smoke.update(dt, pixelScale);
    this.spark.update(dt, pixelScale);
  }

  emitExhaust(pos: THREE.Vector3, dir: THREE.Vector3, throttle: number, boost: boolean): void {
    const color = boost ? new THREE.Color(0.9, 0.7, 0.35) : new THREE.Color(0.72, 0.72, 0.74);
    const spread = new THREE.Vector3(rand(-0.5, 0.5), rand(0, 0.4), rand(-0.5, 0.5));
    this.smoke.emit(
      pos,
      dir.clone().multiplyScalar(-(2 + throttle * 6)).add(spread),
      color,
      0.35 + throttle * 0.3,
      0.8 + throttle * 0.7,
      1.6,
      1.6,
      0.55,
    );
    if (boost) {
      this.spark.emit(
        pos,
        dir.clone().multiplyScalar(-14).add(spread.multiplyScalar(2)),
        new THREE.Color(1, 0.55, 0.2),
        0.5,
        0.5,
        2,
        -0.2,
        1,
      );
    }
  }

  emitSkid(pos: THREE.Vector3, side: number): void {
    const vel = new THREE.Vector3(rand(-0.7, 0.7) + side * 1.6, rand(1.2, 2.6), rand(-0.7, 0.7));
    this.smoke.emit(
      pos,
      vel,
      new THREE.Color(0.88, 0.88, 0.9),
      0.6 + Math.random() * 0.5,
      1.3,
      0.8,
      2.8,
      0.7,
    );
  }

  emitLanding(pos: THREE.Vector3): void {
    for (let i = 0; i < 10; i++) {
      const vel = new THREE.Vector3(rand(-2, 2), rand(1, 3.5), rand(-2, 2));
      this.smoke.emit(
        pos,
        vel,
        new THREE.Color(0.62, 0.52, 0.42),
        0.5 + Math.random() * 0.6,
        0.9 + Math.random() * 0.6,
        2,
        2.4,
        0.8,
      );
    }
  }

  emitBarrier(pos: THREE.Vector3, dir: THREE.Vector3): void {
    for (let i = 0; i < 8; i++) {
      this.spark.emit(
        pos,
        dir.clone().multiplyScalar(4).add(new THREE.Vector3(rand(-2, 2), rand(0.5, 3), rand(-2, 2))),
        new THREE.Color(1, 0.65, 0.2),
        0.35,
        0.55,
        6,
        0.1,
        1,
      );
    }
    for (let i = 0; i < 5; i++) {
      this.smoke.emit(
        pos,
        new THREE.Vector3(rand(-1, 1), rand(1, 2), rand(-1, 1)),
        new THREE.Color(0.55, 0.5, 0.45),
        0.7,
        0.8,
        1,
        2,
        0.8,
      );
    }
  }

  emitSplash(pos: THREE.Vector3, progress: number): void {
    const inWet = progress > this.wetZoneStart && progress < this.wetZoneEnd;
    if (!inWet) return;
    for (let i = 0; i < 5; i++) {
      this.spark.emit(
        pos,
        new THREE.Vector3(rand(-2.4, 2.4), rand(1.5, 5), rand(-2.4, 2.4)),
        new THREE.Color(0.55, 0.8, 1),
        0.28,
        0.5,
        9,
        0.05,
        0.9,
      );
    }
  }
}
