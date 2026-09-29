import * as THREE from 'three';
import { COLORS, WORLD } from '../core/constants';
import { EventBus } from '../core/events';
import { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp, makePadTexture } from '../math/utils';
import { makeToonMaterial } from './ToonMaterial';

export interface BoostPad {
  group: THREE.Group;
  progress: number;
  lateral: number;
  cooldownUntil: number;
  material: THREE.ShaderMaterial;
}

export interface RoadObstacle {
  group: THREE.Group;
  progress: number;
  lateral: number;
  radius: number;
}

function yawQuaternion(tangent: THREE.Vector3): THREE.Quaternion {
  const flat = tangent.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat.normalize());
}

function signedDelta(a: number, b: number, length: number): number {
  let d = a - b;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
}

export function createBoostPads(track: TrackPath, count = 12): BoostPad[] {
  const padTex = makePadTexture();
  const material = makeToonMaterial('#ff8a3d', {
    emissive: new THREE.Color(1, 0.42, 0.12),
    emissiveIntensity: 0.85,
    rimColor: COLORS.rim,
    rimPower: 3,
    specular: 0.35,
  });
  const arrowMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false });
  const pads: BoostPad[] = [];
  for (let i = 0; i < count; i++) {
    const progress = track.wrap(((i + 0.65) / count) * track.length);
    const lateral = [-4.5, 0, 4.5][i % 3];
    const f = track.frameAt(progress);
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 8.6), material);
    body.position.set(0, 0.045, 0);
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 7.4), arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 0.095, 0);
    group.add(body, arrow);
    group.position.copy(f.position).addScaledVector(f.right, lateral).addScaledVector(f.up, 0.05);
    group.quaternion.copy(yawQuaternion(f.tangent));
    pads.push({ group, progress, lateral, cooldownUntil: 0, material });
  }
  return pads;
}

export function animatePads(pads: BoostPad[], time: number): void {
  for (const pad of pads) {
    pad.material.uniforms.uEmissiveIntensity.value = 0.8 + Math.sin(time * 4 + pad.progress * 0.02) * 0.35;
  }
}

export function updatePads(
  pads: BoostPad[],
  bikes: BikeEntity[],
  track: TrackPath,
  bus: EventBus,
  time: number,
): void {
  for (const pad of pads) {
    if (time < pad.cooldownUntil) continue;
    for (const bike of bikes) {
      const d = signedDelta(bike.progress, pad.progress, track.length);
      if (Math.abs(d) < 4.6 && Math.abs(bike.lateral - pad.lateral) < 4.2 && bike.speed > 2) {
        pad.cooldownUntil = time + 2.6;
        bike.applyPickupBoost();
        bus.emit('vehicle:pickup', { index: bike.index });
      }
    }
  }
}

export function createRoadObstacles(track: TrackPath, count = 14): RoadObstacle[] {
  const redMat = makeToonMaterial('#ff4d5e', { rimColor: COLORS.rim, rimPower: 3, specular: 0.35 });
  const whiteMat = makeToonMaterial('#f4f1e7', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const darkMat = makeToonMaterial('#20242d', { rimColor: COLORS.rimTeal, rimPower: 3 });
  const orangeMat = makeToonMaterial('#ff7a3d', { rimColor: COLORS.rim, rimPower: 3 });
  const obstacles: RoadObstacle[] = [];
  const laterals = [-5.4, 5.4, -1.2, 3.4];
  for (let i = 0; i < count; i++) {
    const progress = track.wrap(((i + 0.82) / count) * track.length);
    const lateral = laterals[i % laterals.length];
    const f = track.frameAt(progress);
    const group = new THREE.Group();
    const kind = i % 3;
    if (kind === 0) {
      const tireA = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 14), darkMat);
      tireA.position.set(-0.7, 0.85, 0);
      const tireB = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 14), darkMat);
      tireB.position.set(0.7, 0.85, 0);
      const tireTop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.42, 14), darkMat);
      tireTop.position.set(0, 2.05, 0);
      group.add(tireA, tireB, tireTop);
    } else if (kind === 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.7, 16), redMat);
      barrel.position.y = 0.85;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.4, 16), whiteMat);
      band.position.y = 1.15;
      group.add(barrel, band);
    } else {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 0.34), whiteMat);
      barrier.position.y = 0.78;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.36, 0.36), redMat);
      stripe.position.y = 1.05;
      group.add(barrier, stripe);
      for (const x of [-1.7, 0, 1.7]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 8), orangeMat);
        cone.position.set(x, 0.55, 1.7);
        group.add(cone);
      }
    }
    group.position.copy(f.position).addScaledVector(f.right, lateral).addScaledVector(f.up, 0.25);
    group.quaternion.copy(yawQuaternion(f.tangent));
    obstacles.push({ group, progress, lateral, radius: 1.7 });
  }
  return obstacles;
}

export function updateObstacles(
  obstacles: RoadObstacle[],
  bikes: BikeEntity[],
  track: TrackPath,
  bus: EventBus,
  time: number,
): void {
  void time;
  for (const obstacle of obstacles) {
    for (const bike of bikes) {
      if (!bike.canBeHit) continue;
      const d = signedDelta(bike.progress, obstacle.progress, track.length);
      if (Math.abs(d) < 2.7 && Math.abs(bike.lateral - obstacle.lateral) < obstacle.radius + 0.7) {
        const strength = clamp(bike.speed / WORLD.maxSpeed, 0.3, 1);
        const push = bike.lateral >= obstacle.lateral ? 1 : -1;
        bike.applyObstacleHit(push);
        bus.emit('vehicle:collision', { index: bike.index, strength });
      }
    }
  }
}
