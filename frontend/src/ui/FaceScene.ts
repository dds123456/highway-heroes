import * as THREE from 'three';
import { createRiderHead } from '../entities/CharacterAsset';
import type { RiderFacePreset, RiderHead } from '../entities/CharacterAsset';

/**
 * 捏脸界面 3D 场景：大头聚焦展示可塑脑袋，自动旋转 + 拖动查看，实时反映 morph 滑杆。
 * 与 SelectionScene 同套路（独立 WebGLRenderer + alpha 画布 + 指针拖拽），复用项目的 NPR 材质。
 */
const HEAD_SCALE = 1.4; // 放大展示（原生头半径约 0.145，放大到约 0.2 方便观察）
const HEAD_CENTER_Y = -0.07 * HEAD_SCALE; // 原生头球心在局部 y≈0.07，上移使球心对齐原点

export class FaceScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private turntable = new THREE.Group();
  private head: RiderHead;
  private autoSpin = 0.5;
  private yaw = 0.5;
  private vel = 0;
  private dragging = false;
  private lastX = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'face-canvas';
    container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
    this.camera.position.set(0, 0.04, 0.95);
    this.camera.lookAt(0, 0, 0);

    this.head = createRiderHead();
    // GLB 模型脸朝 -Z，旋转 180° 让脸朝观察者（+Z）
    this.head.group.rotation.y = Math.PI;
    this.head.group.scale.setScalar(HEAD_SCALE);
    this.head.group.position.y = HEAD_CENTER_Y;
    this.turntable.add(this.head.group);
    this.scene.add(this.turntable);

    this.bindDrag();
  }

  setFace(preset: RiderFacePreset): void {
    this.head.setFace(preset);
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
    this.head.dispose();
    this.renderer.dispose();
  }
}