import * as THREE from 'three';
import { hexColor } from '../core/constants';
import type { BikeSpec, Colorway, RiderSpec } from '../core/constants';
import { MotorcycleModel } from '../entities/Motorcycle';
import { RiderModel } from '../entities/Rider';
import { makeToonMaterial } from '../render/ToonMaterial';

export class SelectionScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private turntable = new THREE.Group();
  private holder = new THREE.Group();
  private bike: MotorcycleModel | null = null;
  private rider: RiderModel | null = null;
  private autoSpin = 0.55;
  private yaw = 0.7;
  private vel = 0;
  private dragging = false;
  private lastX = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'turntable-canvas';
    container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
    this.camera.position.set(0, 1.7, 4.6);
    this.camera.lookAt(0, 1.0, 0);

    // 展台
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.75, 0.5, 40),
      makeToonMaterial('#eef2ff', { rimColor: hexColor('#5cf2e3'), rimPower: 3, specular: 0.3 }),
    );
    podium.position.y = -0.25;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.07, 10, 48),
      makeToonMaterial('#ffd23f', { emissive: hexColor('#ff9a3d'), emissiveIntensity: 0.7, rimColor: null }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(podium, ring, this.turntable);
    this.turntable.add(this.holder);

    this.bindDrag();
  }

  private bindDrag(): void {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.autoSpin = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.vel = (e.clientX - this.lastX) * 0.012;
      this.yaw += this.vel;
      this.lastX = e.clientX;
    });
    const end = (): void => {
      this.dragging = false;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', end);
  }

  show(bike: BikeSpec, rider: RiderSpec, colorway: Colorway, wrapTexture: THREE.Texture | null = null): void {
    while (this.holder.children.length) {
      const child = this.holder.children[0];
      this.holder.remove(child);
      (child as THREE.Group).traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    this.bike = new MotorcycleModel(bike.form, colorway, wrapTexture);
    this.rider = new RiderModel(rider, bike.form);
    const fit = new THREE.Group();
    fit.add(this.bike.group, this.rider.group);
    fit.scale.setScalar(1.35);
    this.holder.add(fit);
  }

  setTrackTint(top: string, bottom: string): void {
    // 展台背景由 DOM 渐变呈现，这里仅保留接口。
    void top;
    void bottom;
  }

  render(dt: number): void {
    if (this.disposed) return;
    if (!this.dragging) {
      this.yaw += (this.autoSpin + this.vel * 0.4) * dt;
      this.vel *= 0.92;
    }
    this.turntable.rotation.y = this.yaw;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== Math.floor(w) || this.canvas.height !== Math.floor(h)) {
      this.renderer.setSize(Math.floor(w), Math.floor(h), false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}