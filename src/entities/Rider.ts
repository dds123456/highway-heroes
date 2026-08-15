import * as THREE from 'three';
import { COLORS } from '../core/constants';
import { addShell } from '../render/ShellMaterial';
import { makeToonMaterial } from '../render/ToonMaterial';

export interface RiderPose {
  lean: number;
  pitch: number;
  steer: number;
  crouch: number;
  airborne: boolean;
  celebrate: boolean;
  time: number;
}

export class RiderModel {
  readonly group = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private hipL = new THREE.Group();
  private hipR = new THREE.Group();
  private kneeL = new THREE.Group();
  private kneeR = new THREE.Group();

  constructor(accent: THREE.Color) {
    const suit = makeToonMaterial('#1e2532', { rimColor: COLORS.rim, rimPower: 3.4, specular: 0.35 });
    const suitLight = makeToonMaterial('#eef2f7', { rimColor: COLORS.rim, rimPower: 3, specular: 0.4 });
    const helmet = makeToonMaterial(accent, { rimColor: COLORS.rimTeal, rimPower: 3.2, gloss: 32, specular: 0.9 });
    const visor = makeToonMaterial('#10131a', { gloss: 48, specular: 1.4, rimColor: COLORS.rimTeal, rimPower: 2 });

    const pelvis = this.box(0.34, 0.22, 0.26, suit, 0, 0.06, 0);
    this.torso.position.set(0, 0.28, 0);
    this.torso.add(this.box(0.42, 0.58, 0.24, suit, 0, 0.24, 0.01));
    this.torso.add(this.box(0.3, 0.16, 0.3, suitLight, 0, 0.52, 0.04));
    this.torso.add(pelvis);

    this.head.position.set(0, 0.62, 0.04);
    const headGeo = new THREE.SphereGeometry(0.205, 12, 10);
    const helmetMesh = new THREE.Mesh(headGeo, helmet);
    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0.35, 1.5), visor);
    visorMesh.position.set(0, 0.02, 0.09);
    visorMesh.rotation.x = -0.12;
    this.head.add(helmetMesh, visorMesh);

    for (const [shoulder, elbow, side] of [
      [this.shoulderL, this.elbowL, -1],
      [this.shoulderR, this.elbowR, 1],
    ] as const) {
      shoulder.position.set(0.25 * side, 0.4, 0.04);
      const upper = this.cylinder(0.09, 0.42, suit, 0, -0.2, -0.03);
      upper.rotation.x = 0.55;
      elbow.position.set(0, -0.38, -0.16);
      const fore = this.cylinder(0.08, 0.38, suit, 0, -0.17, -0.02);
      const hand = this.box(0.1, 0.1, 0.12, suitLight, 0, -0.2, 0.02);
      elbow.add(fore, hand);
      shoulder.add(upper, elbow);
      this.torso.add(shoulder);
      addShell(fore, { width: 0.05 });
    }

    for (const [hip, knee, side] of [
      [this.hipL, this.kneeL, -1],
      [this.hipR, this.kneeR, 1],
    ] as const) {
      hip.position.set(0.17 * side, 0.02, -0.14);
      const thigh = this.cylinder(0.1, 0.42, suit, 0, -0.2, 0.04);
      thigh.rotation.x = 0.35;
      knee.position.set(0, -0.36, 0.12);
      const shin = this.cylinder(0.085, 0.38, suit, 0, -0.17, 0.05);
      const boot = this.box(0.13, 0.12, 0.3, suitLight, 0, -0.14, 0.08);
      knee.add(shin, boot);
      hip.add(thigh, knee);
      this.group.add(hip);
      addShell(shin, { width: 0.05 });
    }

    this.torso.add(this.head);
    this.group.add(this.torso);
    addShell(helmetMesh, { width: 0.055 });
    this.group.position.y = 1.06;
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

  setPose(pose: RiderPose): void {
    const { lean, pitch, steer, crouch, airborne, celebrate, time } = pose;
    const bounce = airborne ? Math.sin(time * 22) * 0.05 : 0;
    const cele = celebrate ? 1 : 0;
    const crouchTarget = celebrate ? 0 : crouch + bounce;

    this.torso.rotation.x = -0.08 + pitch * 0.85 + crouchTarget * -0.55;
    this.torso.rotation.z = -lean * 0.55 + cele * 0.12;
    this.head.rotation.y = steer * 0.42 + cele * 0.35;
    this.head.rotation.x = -0.12 + pitch * 0.22 - crouchTarget * 0.25 + (airborne ? 0.12 : 0);

    const armLift = -0.35 - crouchTarget * 0.5 + pitch * 0.35 + cele * -2.0;
    const armBend = 0.42 + crouchTarget * 0.7 + cele * -0.9;
    this.shoulderL.rotation.x = armLift;
    this.shoulderR.rotation.x = armLift;
    this.elbowL.rotation.x = armBend;
    this.elbowR.rotation.x = armBend;
    this.shoulderL.rotation.z = 0.18 + cele * 1.6;
    this.shoulderR.rotation.z = -0.18 + cele * -1.6;

    const legLift = 0.38 + crouchTarget * 0.9 + pitch * -0.2 + (celebrate ? 0.5 : 0);
    const kneeBend = -0.95 - crouchTarget * 1.1 + (celebrate ? -0.55 : 0);
    this.hipL.rotation.x = legLift;
    this.hipR.rotation.x = legLift;
    this.kneeL.rotation.x = kneeBend;
    this.kneeR.rotation.x = kneeBend;

    if (celebrate) {
      const wave = Math.sin(time * 6) * 0.35;
      this.head.rotation.z = wave;
      this.torso.rotation.z = wave * 0.25;
    }
  }
}
