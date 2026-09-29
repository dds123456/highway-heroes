import * as THREE from 'three';
import { hexColor, WORLD } from '../core/constants';
import type { BikeSpec, Colorway, RiderSpec } from '../core/constants';
import { EventBus } from '../core/events';
import { TrackPath } from '../math/TrackPath';
import { clamp, damp } from '../math/utils';
import { MotorcycleModel } from './Motorcycle';
import { RiderModel } from './Rider';

export interface BikeInput {
  throttle: boolean;
  brake: boolean;
  steer: number;
  drift: boolean;
  boost: boolean;
  nitro: boolean;
}

export class BikeEntity {
  readonly index: number;
  readonly group = new THREE.Group();
  readonly model: MotorcycleModel;
  readonly rider: RiderModel;
  readonly primaryColor: THREE.Color;

  progress = 0;
  lateral = 0;
  speed = 0;
  /** AI 加速倍率（AIDriver 按落后距离设置，玩家恒为 1） */
  accelBoost = 1;
  /** AI 极限速度倍率（AIDriver 设置：落后 1~2×，领先 1.2×；玩家恒为 1） */
  maxSpeedMul = 1;
  lap = 0;
  finished = false;
  finishTime = 0;
  rank = 0;
  /** 转向灵敏度倍率（玩家可调，AI 恒为 1） */
  steerGain = 1;

  private lean = 0;
  private pitch = 0;
  private heading = 0;
  private airHeight = 0;
  private verticalSpeed = 0;
  private airborne = false;
  private suspension = 0;
  private impactTimer = 0;
  private driftCharge = 0;
  private boostReady = false;
  private boostTimer = 0;
  private driftActive = false;
  private wasDrifting = false;
  private wasBoosting = false;
  private prevLateral = 0;
  private collisionCooldown = 0;
  private curvature = 0;

  constructor(
    index: number,
    startProgress: number,
    startLateral: number,
    bike: BikeSpec,
    rider: RiderSpec,
    colorway: Colorway,
    wrapTexture: THREE.Texture | null = null,
  ) {
    this.index = index;
    this.progress = startProgress;
    this.lateral = startLateral;
    this.primaryColor = hexColor(colorway.primary);
    this.model = new MotorcycleModel(bike.form, colorway, wrapTexture);
    this.rider = new RiderModel(rider, bike.form);
    this.group.add(this.model.group, this.rider.group);
  }

  get isAirborne(): boolean {
    return this.airborne;
  }

  get isDrifting(): boolean {
    return this.driftActive;
  }

  get leanAmount(): number {
    return this.lean;
  }

  get boostActive(): boolean {
    return this.boostTimer > 0;
  }

  get charge(): number {
    return this.driftCharge;
  }

  get canBeHit(): boolean {
    return this.collisionCooldown <= 0;
  }

  applyPickupBoost(): void {
    this.boostTimer = Math.max(this.boostTimer, 2.4);
    this.speed = Math.min(this.speed + 14, WORLD.maxSpeed * this.maxSpeedMul + 26);
    this.driftCharge = clamp(this.driftCharge + 0.25, 0, 1);
    this.boostReady = this.driftCharge >= 0.98;
  }

  applyObstacleHit(pushDirection: number): void {
    if (this.collisionCooldown > 0 || this.airborne) return;
    this.speed *= 0.25;
    const maxLateral = WORLD.roadHalfWidth - 0.5;
    this.lateral = clamp(this.lateral + pushDirection * 2.3, -maxLateral, maxLateral);
    this.collisionCooldown = 1.5;
    this.impactTimer = 0.55;
  }

  reset(startProgress: number, startLateral: number): void {
    this.progress = startProgress;
    this.lateral = startLateral;
    this.speed = 0;
    this.lap = 0;
    this.finished = false;
    this.finishTime = 0;
    this.rank = 0;
    this.lean = 0;
    this.pitch = 0;
    this.heading = 0;
    this.airHeight = 0;
    this.verticalSpeed = 0;
    this.airborne = false;
    this.suspension = 0;
    this.impactTimer = 0;
    this.driftCharge = 0;
    this.boostReady = false;
    this.boostTimer = 0;
    this.driftActive = false;
    this.wasDrifting = false;
    this.wasBoosting = false;
    this.prevLateral = startLateral;
    this.collisionCooldown = 0;
    this.curvature = 0;
  }

  update(dt: number, track: TrackPath, input: BikeInput, bus: EventBus, time: number, allowControl: boolean): void {
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.impactTimer = Math.max(0, this.impactTimer - dt);
    this.curvature = track.curvatureAt(this.progress, 12);

    if (!allowControl && !this.finished) {
      this.model.update(dt, 0, 0, false);
      this.rider.setPose({
        lean: 0,
        pitch: 0,
        steer: 0,
        crouch: 0.2,
        airborne: false,
        celebrate: false,
        time,
      });
      this.applyTransform(track);
      return;
    }

    const maxSpeed = WORLD.maxSpeed * this.maxSpeedMul + (this.boostTimer > 0 ? 34 : 0);
    if (this.finished) {
      // 完赛自动巡航：回正车头贴路前进，避免直行冲出弯道
      input = { throttle: true, brake: false, steer: clamp(this.lateral * 0.7, -1, 1), drift: false, boost: false, nitro: false };
    }
    const steerInput = -input.steer;

    if (!this.airborne) {
      if (input.throttle) {
        const accelFactor = Math.pow(Math.max(0, 1 - this.speed / maxSpeed), 0.42);
        this.speed += WORLD.accel * this.accelBoost * dt * accelFactor;
      }
      if (input.brake) this.speed -= WORLD.brake * dt;
      this.speed -= this.speed * this.speed * WORLD.drag * dt;
      if (!input.throttle && !input.brake) {
        this.speed -= this.speed * this.speed * WORLD.coastDrag * dt;
      }
      if (this.driftActive) this.speed -= 3.4 * dt;
    } else {
      this.speed = Math.max(0, this.speed - 3.4 * dt);
    }
    this.speed = clamp(this.speed, 0, maxSpeed);

    const speedFactor = clamp(this.speed / 20, 0, 1);
    const grip = this.airborne ? 0.2 : clamp(1.5 - (this.speed / maxSpeed) * 0.78, 0.55, 1.5);
    const driftSteer = this.driftActive ? 2.1 : 1.15;
    this.prevLateral = this.lateral;
    this.lateral += steerInput * grip * driftSteer * speedFactor * 2.4 * this.steerGain * dt;
    const maxLateral = WORLD.roadHalfWidth - 0.5;
    const prevClamped = this.lateral >= maxLateral || this.lateral <= -maxLateral;
    this.lateral = clamp(this.lateral, -maxLateral, maxLateral);
    if (!prevClamped && (this.lateral >= maxLateral || this.lateral <= -maxLateral) && this.speed > 16 && this.collisionCooldown <= 0) {
      this.speed *= 0.62;
      this.impactTimer = 0.3;
      this.collisionCooldown = 0.9;
      bus.emit('vehicle:collision', { index: this.index, strength: clamp(this.speed / (WORLD.maxSpeed * this.maxSpeedMul), 0, 1) });
    }

    const wantsDrift =
      !this.airborne &&
      this.speed > 36 &&
      Math.abs(input.steer) > 0.4 &&
      (input.drift || Math.abs(input.steer) > 0.82);
    this.driftActive = wantsDrift;
    if (this.driftActive) {
      this.driftCharge = clamp(this.driftCharge + dt * 0.16, 0, 1);
    } else {
      this.driftCharge = clamp(this.driftCharge - dt * 0.12, 0, 1);
    }
    this.boostReady = this.driftCharge >= 0.98;
    if (input.throttle && input.nitro && this.boostReady && this.boostTimer <= 0) {
      this.boostTimer = 2.4;
      this.driftCharge = 0;
      this.boostReady = false;
      bus.emit('vehicle:boost', { index: this.index, active: true });
    }
    if (this.boostTimer > 0) this.boostTimer -= dt;

    if (this.wasDrifting !== this.driftActive) {
      bus.emit('vehicle:drift', { index: this.index, active: this.driftActive });
      this.wasDrifting = this.driftActive;
    }
    if (this.wasBoosting && this.boostTimer <= 0) {
      bus.emit('vehicle:boost', { index: this.index, active: false });
    }
    this.wasBoosting = this.boostTimer > 0;

    const moveFactor = this.airborne ? 0.22 : 1;
    this.progress = track.wrap(this.progress + this.speed * dt * moveFactor);

    if (!this.airborne) {
      const slope = track.slopeAt(this.progress);
      const ahead = track.slopeAt(this.progress + Math.min(14, this.speed * 0.2));
      if (slope > 0.16 && ahead < slope * 0.62 && this.speed > 48) {
        this.airborne = true;
        this.verticalSpeed = 6.5 + this.speed * 0.075;
        this.suspension = 0.1;
      }
    }
    if (this.airborne) {
      this.airHeight += this.verticalSpeed * dt;
      this.verticalSpeed -= WORLD.gravity * dt;
      if (this.airHeight <= 0) {
        const strength = clamp(-this.verticalSpeed / 18, 0, 1);
        this.airHeight = 0;
        this.airborne = false;
        this.suspension = 0.08 + strength * 0.16;
        this.impactTimer = 0.38;
        bus.emit('vehicle:landing', { index: this.index, strength });
      }
    }
    this.suspension = damp(this.suspension, 0, 9, dt);

    const leanTarget = clamp(
      -steerInput * this.steerGain * (0.35 + this.speed * 0.011) - this.curvature * this.speed * this.speed * 0.00035,
      -1.3,
      1.3,
    );
    this.lean = damp(this.lean, leanTarget, this.driftActive ? 3.8 : 7.5, dt);

    const slope = track.slopeAt(this.progress);
    const pitchTarget =
      -slope * 0.72
      + (input.throttle ? -0.11 : input.brake ? 0.22 : 0)
      + (this.airborne ? this.verticalSpeed * 0.011 : 0);
    this.pitch = damp(this.pitch, pitchTarget, 6, dt);

    const lateralVel = (this.lateral - this.prevLateral) / Math.max(dt, 0.001);
    const headingTarget = Math.atan2(clamp(lateralVel, -12, 12), Math.max(this.speed, 7)) * 0.85;
    this.heading = damp(this.heading, headingTarget, 5.5, dt);

    const crouch = clamp(0.28 + (this.speed / maxSpeed) * 0.34 + (input.brake ? 0.35 : 0) + (this.airborne ? 0.2 : 0), 0, 1.1);
    this.rider.setPose({
      lean: this.lean,
      pitch: this.pitch,
      steer: steerInput,
      crouch,
      airborne: this.airborne,
      celebrate: this.finished && time - this.finishTime > 1.2,
      time,
    });
    this.model.update(dt, this.speed, steerInput, this.boostTimer > 0);
    this.applyTransform(track);
  }

  private applyTransform(track: TrackPath): void {
    const f = track.frameAt(this.progress);
    const pos = f.position
      .clone()
      .addScaledVector(f.right, this.lateral)
      .addScaledVector(f.up, this.suspension + this.airHeight);
    this.group.position.copy(pos);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent);
    const qPath = new THREE.Quaternion().setFromRotationMatrix(basis);
    const qLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, 0, this.lean, 'ZYX'));
    this.group.quaternion.copy(qPath).multiply(qLocal);
  }
}
