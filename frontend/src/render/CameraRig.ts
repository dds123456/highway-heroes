import * as THREE from 'three';
import { WORLD } from '../core/constants';
import { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { clamp, damp } from '../math/utils';

export type CameraMode = 'chase' | 'hood' | 'side' | 'orbit' | 'far';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'chase';
  private position = new THREE.Vector3(0, 8, -16);
  private lookTarget = new THREE.Vector3(0, 2, 0);
  private fov = 62;
  private shake = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 5000);
    this.camera.position.copy(this.position);
  }

  setShake(strength: number): void {
    this.shake = clamp(this.shake + strength, 0, 1);
  }

  snapTo(bike: BikeEntity, track: TrackPath): void {
    const f = track.frameAt(bike.progress);
    this.position.copy(bike.group.position)
      .addScaledVector(f.up, 2.7)
      .addScaledVector(f.tangent, -7.2);
    this.lookTarget.copy(bike.group.position)
      .addScaledVector(f.up, 1.0)
      .addScaledVector(f.tangent, 7);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
  }

  update(dt: number, bike: BikeEntity, track: TrackPath, cinematic: boolean, time: number): void {
    const f = track.frameAt(bike.progress);
    const bikePos = bike.group.position;
    const up = f.up;
    const forward = f.tangent;
    const right = f.right;
    const mode = cinematic || this.mode === 'orbit' ? 'orbit' : this.mode;
    let desired: THREE.Vector3;
    let look: THREE.Vector3;

    if (mode === 'chase') {
      desired = bikePos.clone().addScaledVector(up, 2.7).addScaledVector(forward, -7.2).addScaledVector(right, bike.lateral * -0.08);
      look = bikePos.clone().addScaledVector(up, 1.0).addScaledVector(forward, 7);
    } else if (mode === 'hood') {
      desired = bikePos.clone().addScaledVector(up, 1.1).addScaledVector(forward, 3.2);
      look = bikePos.clone().addScaledVector(up, 0.9).addScaledVector(forward, 30);
    } else if (mode === 'side') {
      desired = bikePos.clone().addScaledVector(right, 6.5).addScaledVector(up, 1.8).addScaledVector(forward, -1.5);
      look = bikePos.clone().addScaledVector(up, 0.9).addScaledVector(forward, 6);
    } else if (mode === 'far') {
      desired = bikePos.clone().addScaledVector(up, 9).addScaledVector(forward, -24).addScaledVector(right, 5);
      look = bikePos.clone().addScaledVector(up, 0.8).addScaledVector(forward, 18);
    } else {
      const angle = time * 0.32;
      desired = bikePos.clone().addScaledVector(up, 2.2);
      desired.x += Math.cos(angle) * 13;
      desired.z += Math.sin(angle) * 13;
      look = bikePos.clone().addScaledVector(up, 1.2);
    }

    const lambda = mode === 'orbit' ? 3.2 : 6;
    this.position.x = damp(this.position.x, desired.x, lambda, dt);
    this.position.y = damp(this.position.y, desired.y, lambda, dt);
    this.position.z = damp(this.position.z, desired.z, lambda, dt);
    this.lookTarget.x = damp(this.lookTarget.x, look.x, 8, dt);
    this.lookTarget.y = damp(this.lookTarget.y, look.y, 8, dt);
    this.lookTarget.z = damp(this.lookTarget.z, look.z, 8, dt);

    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.shake > 0.001) {
      const s = this.shake * this.shake;
      this.position.x += (Math.random() - 0.5) * 0.8 * s;
      this.position.y += (Math.random() - 0.5) * 0.6 * s;
      this.position.z += (Math.random() - 0.5) * 0.8 * s;
    }

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
    const targetFov = 62 + clamp(bike.speed / WORLD.maxSpeed, 0, 1) * 23;
    this.fov = damp(this.fov, targetFov, 2.2, dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  get lookPoint(): THREE.Vector3 {
    return this.lookTarget;
  }
}
