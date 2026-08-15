import * as THREE from 'three';
import { COLORS } from '../core/constants';
import { addShell } from '../render/ShellMaterial';
import { makeToonMaterial } from '../render/ToonMaterial';

export class MotorcycleModel {
  readonly group = new THREE.Group();
  private rearWheel = new THREE.Group();
  private frontWheel = new THREE.Group();
  private frontAssembly = new THREE.Group();
  private shadow!: THREE.Mesh;
  private wheelRadius = 0.36;

  constructor(primary: THREE.Color, accent: THREE.Color) {
    const bodyMat = makeToonMaterial(primary, { rimColor: COLORS.rim, rimPower: 3, gloss: 30, specular: 0.8 });
    const darkMat = makeToonMaterial('#20242d', { rimColor: COLORS.rimTeal, rimPower: 3, specular: 0.3 });
    const accentMat = makeToonMaterial(accent, { rimColor: COLORS.rim, rimPower: 3.5, gloss: 20, specular: 0.7 });
    const chromeMat = makeToonMaterial('#cfd6e0', { gloss: 48, specular: 1.5, rimColor: COLORS.rimTeal, rimPower: 2.5 });

    const frame = this.box(0.3, 0.2, 1.52, darkMat, 0, 0.62, 0);
    const tank = this.box(0.36, 0.26, 0.46, bodyMat, 0, 0.9, 0.34);
    const seat = this.box(0.34, 0.13, 0.56, accentMat, 0, 0.84, -0.22);
    const fairing = this.box(0.34, 0.52, 0.56, bodyMat, 0, 0.96, 0.72);
    const windscreen = this.box(0.02, 0.4, 0.5, chromeMat, 0, 1.22, 0.88);
    const tail = this.box(0.3, 0.14, 0.5, bodyMat, 0, 0.72, -0.72);
    const exhaust = this.cylinder(0.08, 0.95, chromeMat, 0.2, 0.42, -0.5);
    exhaust.rotation.x = Math.PI / 2;
    const rearFender = this.box(0.3, 0.1, 0.62, bodyMat, 0, 0.52, -0.72);

    this.rearWheel.position.set(0, this.wheelRadius, -0.74);
    this.frontWheel.position.set(0, this.wheelRadius, 0.8);
    this.buildWheel(this.rearWheel, darkMat, accentMat);
    this.buildWheel(this.frontWheel, darkMat, accentMat);

    this.frontAssembly.position.set(0, 0.9, 0.8);
    const forkL = this.cylinder(0.055, 0.9, chromeMat, -0.11, -0.42, 0);
    const forkR = this.cylinder(0.055, 0.9, chromeMat, 0.11, -0.42, 0);
    const handlebar = this.cylinder(0.045, 0.62, chromeMat, 0, 0.32, 0.08);
    handlebar.rotation.z = Math.PI / 2;
    this.frontAssembly.add(forkL, forkR, handlebar, this.frontWheel);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;

    this.group.add(frame, tank, seat, fairing, windscreen, tail, exhaust, rearFender, this.rearWheel, this.frontAssembly, this.shadow);
    addShell(fairing, { width: 0.07 });
    addShell(tank, { width: 0.07 });
    addShell(seat, { width: 0.06 });
    addShell(tail, { width: 0.06 });
  }

  private box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    return mesh;
  }

  private cylinder(r: number, h: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
    mesh.position.set(x, y, z);
    return mesh;
  }

  private buildWheel(parent: THREE.Group, tireMat: THREE.Material, rimMat: THREE.Material): void {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 18), tireMat);
    tire.geometry.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10), rimMat);
    rim.geometry.rotateZ(Math.PI / 2);
    const spokes = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.05), rimMat);
      spoke.rotation.y = (i / 5) * Math.PI;
      spokes.add(spoke);
    }
    parent.add(tire, rim, spokes);
  }

  update(dt: number, speed: number, steer: number, boost: boolean): void {
    const spin = (speed * dt) / this.wheelRadius;
    this.rearWheel.rotation.x += spin;
    this.frontWheel.rotation.x += spin;
    this.frontAssembly.rotation.y = dampAngle(this.frontAssembly.rotation.y, steer * 0.34, 10, dt);
    const shake = speed > 50 ? Math.sin(performance.now() * 0.035) * speed * 0.00008 : 0;
    this.group.position.y = Math.sin(performance.now() * 0.02) * 0.006 + shake;
    this.shadow.visible = !boost;
  }
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
