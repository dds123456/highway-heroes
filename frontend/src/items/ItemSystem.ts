import * as THREE from 'three';
import { hexColor, ITEM_KINDS } from '../core/constants';
import type { ItemKind } from '../core/constants';
import { EventBus } from '../core/events';
import type { BikeEntity } from '../entities/BikeEntity';
import { TrackPath } from '../math/TrackPath';
import { makeToonMaterial } from '../render/ToonMaterial';
import { ItemSprite } from './itemSprites';

interface ItemBox {
  sprite: ItemSprite;
  progress: number;
  lateral: number;
  kind: ItemKind;
  cooldownUntil: number;
  phase: number;
}

interface Missile {
  group: THREE.Group;
  progress: number;
  lateral: number;
  owner: number;
  target: number;
  dir: number;
  travelled: number;
}

interface Mine {
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  progress: number;
  lateral: number;
  owner: number;
  armedIn: number;
  expireIn: number;
}

function signedDelta(a: number, b: number, length: number): number {
  let d = a - b;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
}

function yawQuaternion(tangent: THREE.Vector3): THREE.Quaternion {
  const flat = tangent.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-6) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat.normalize());
}

const MISSILE_SPEED = 150;

export class ItemSystem {
  readonly group = new THREE.Group();
  private boxes: ItemBox[] = [];
  private missiles: Missile[] = [];
  private mines: Mine[] = [];
  private inventory: (ItemKind | null)[];
  private shieldUntil: number[];
  private firedAt: number[];
  private bikes: BikeEntity[];
  private shieldBubbles: THREE.Mesh[] = [];
  private shieldBubbleMats: THREE.MeshBasicMaterial[] = [];
  private now = 0;

  constructor(track: TrackPath, bikes: BikeEntity[]) {
    this.bikes = bikes;
    this.inventory = new Array(bikes.length).fill(null);
    this.shieldUntil = new Array(bikes.length).fill(0);
    this.firedAt = new Array(bikes.length).fill(-9);
    this.buildBoxes(track);
    this.buildShields();
  }

  private buildBoxes(track: TrackPath): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const progress = track.wrap(((i + 0.35) / count) * track.length);
      const lateral = [-5.5, 0, 5.5, -2.6, 2.6][i % 5];
      const kind = ITEM_KINDS[i % ITEM_KINDS.length];
      const f = track.frameAt(progress);
      const item = new ItemSprite(kind);
      item.sprite.scale.setScalar(2.2);
      item.sprite.position.copy(f.position).addScaledVector(f.right, lateral).addScaledVector(f.up, 1.35);
      this.group.add(item.sprite);
      this.boxes.push({ sprite: item, progress, lateral, kind, cooldownUntil: 0, phase: Math.random() * Math.PI * 2 });
    }
  }

  /** 每台车挂一个护盾光圈（半透明气泡） */
  private buildShields(): void {
    for (const bike of this.bikes) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x5cf2e3,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), mat);
      bubble.position.set(0, 0.95, 0);
      bubble.visible = false;
      this.shieldBubbles.push(bubble);
      this.shieldBubbleMats.push(mat);
      bike.group.add(bubble);
    }
  }

  addToScene(scene: THREE.Object3D): void {
    scene.add(this.group);
  }

  reset(): void {
    for (const m of this.missiles) this.group.remove(m.group);
    for (const m of this.mines) this.group.remove(m.group);
    this.missiles = [];
    this.mines = [];
    this.inventory.fill(null);
    this.shieldUntil.fill(0);
    this.firedAt.fill(-9);
    for (const box of this.boxes) box.cooldownUntil = 0;
    for (const b of this.shieldBubbles) b.visible = false;
  }

  getPlayerItem(): ItemKind | null {
    return this.inventory[0];
  }

  isShielded(index: number): boolean {
    return this.shieldUntil[index] > this.now;
  }

  private makeMissile(track: TrackPath, owner: number, target: number, dir: number): void {
    const bike = this.bikes[owner];
    const frame = track.frameAt(bike.progress);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.7, 10),
      makeToonMaterial('#ff2d3f', { emissive: hexColor('#ff2d3f'), emissiveIntensity: 0.8, rimColor: null }),
    );
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), makeToonMaterial('#ffffff', { rimColor: null }));
    tip.position.set(0, 0, 0.9);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 6),
      makeToonMaterial('#ffd23f', { emissive: hexColor('#ff9a3d'), emissiveIntensity: 1.4, rimColor: null }),
    );
    flame.position.set(0, 0, -1.0);
    flame.scale.set(1, 1, 0.7);
    group.add(body, tip, flame);
    group.position.copy(frame.position).addScaledVector(frame.up, 1.1).addScaledVector(frame.right, bike.lateral);
    const q = yawQuaternion(frame.tangent);
    if (dir < 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    group.quaternion.copy(q);
    this.group.add(group);
    this.missiles.push({ group, progress: track.wrap(bike.progress + dir * 2), lateral: bike.lateral, owner, target, dir, travelled: 0 });
  }

  private makeMine(track: TrackPath, owner: number): void {
    const bike = this.bikes[owner];
    const frame = track.frameAt(bike.progress);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 14, 10),
      makeToonMaterial('#ff7a3d', { emissive: hexColor('#ff4d1a'), emissiveIntensity: 0.7, rimColor: hexColor('#5cf2e3') }),
    );
    const spikes = new THREE.Mesh(new THREE.IcosahedronGeometry(0.74, 0), makeToonMaterial('#211e2e', { rimColor: null }));
    // 地雷攻击范围光圈
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2d3f, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(body, spikes, ring);
    group.position.copy(frame.position).addScaledVector(frame.up, 0.5).addScaledVector(frame.right, bike.lateral);
    group.quaternion.copy(yawQuaternion(frame.tangent));
    this.group.add(group);
    this.mines.push({ group, ring, ringMat, progress: track.wrap(bike.progress - 6), lateral: bike.lateral, owner, armedIn: 0.7, expireIn: 18 });
  }

  update(
    dt: number,
    time: number,
    bikes: BikeEntity[],
    track: TrackPath,
    bus: EventBus,
    playerUseItem: boolean,
  ): void {
    this.bikes = bikes;
    this.now = time;
    const L = track.length;

    // 护盾光圈显示 / 脉冲
    for (let i = 0; i < this.bikes.length; i++) {
      const shielded = this.isShielded(i);
      const bubble = this.shieldBubbles[i];
      if (!bubble) continue;
      bubble.visible = shielded;
      if (shielded) {
        bubble.scale.setScalar(1 + Math.sin(time * 6) * 0.05);
        this.shieldBubbleMats[i].opacity = 0.13 + Math.sin(time * 8) * 0.05;
      }
    }

    for (const box of this.boxes) {
      box.phase += dt * 2.4;
      box.sprite.update(dt);
      // 轻微上下浮动，避免呆板
      const f = track.frameAt(box.progress);
      box.sprite.sprite.position.copy(f.position).addScaledVector(f.right, box.lateral).addScaledVector(f.up, 1.35 + Math.sin(box.phase) * 0.18);
      if (time < box.cooldownUntil) continue;
      for (const bike of bikes) {
        const d = signedDelta(bike.progress, box.progress, L);
        if (Math.abs(d) < 3.4 && Math.abs(bike.lateral - box.lateral) < 3.0 && bike.speed > 2) {
          box.cooldownUntil = time + 4;
          this.inventory[bike.index] = box.kind;
          bus.emit('item:pickup', { index: bike.index, kind: box.kind });
          if (bike.index === 0) bus.emit('hud:item', { kind: box.kind });
        }
      }
    }

    const playerItem = this.inventory[0];
    if (playerUseItem && playerItem) {
      if (this.fire(0, playerItem, track, bus, time)) {
        this.inventory[0] = null;
        bus.emit('hud:item', { kind: null });
      }
    }

    for (let i = 1; i < bikes.length; i++) {
      const item = this.inventory[i];
      if (!item) continue;
      if (time - this.firedAt[i] > 2 && Math.random() < dt * 0.9) {
        if (this.fire(i, item, track, bus, time)) {
          this.inventory[i] = null;
        }
      }
    }

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.travelled += dt * MISSILE_SPEED;
      m.progress = track.wrap(m.progress + dt * MISSILE_SPEED * m.dir);
      const target = bikes[m.target];
      if (target && !target.finished) {
        const d = signedDelta(target.progress, m.progress, L);
        m.lateral += (target.lateral - m.lateral) * Math.min(1, dt * 3.2);
        if (Math.abs(d) < 6 && Math.abs(target.lateral - m.lateral) < 3.2) {
          this.explode(target, m, bus);
          this.disposeMissile(i);
          continue;
        }
      }
      if (m.travelled > 700) {
        this.disposeMissile(i);
        continue;
      }
      const f = track.frameAt(m.progress);
      const q = yawQuaternion(f.tangent);
      if (m.dir < 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      m.group.position.copy(f.position).addScaledVector(f.up, 1.1).addScaledVector(f.right, m.lateral);
      m.group.quaternion.copy(q);
    }

    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.armedIn -= dt;
      m.expireIn -= dt;
      const armed = m.armedIn <= 0;
      const pulse = 1 + Math.sin(time * 6 + m.progress) * 0.08;
      m.group.scale.setScalar(armed ? pulse : 0.55);
      m.ringMat.opacity = armed ? 0.4 + Math.sin(time * 7) * 0.2 : 0.15;
      let exploded = false;
      if (armed) {
        for (const bike of bikes) {
          if (bike.index === m.owner) continue;
          const d = signedDelta(bike.progress, m.progress, L);
          if (Math.abs(d) < 3 && Math.abs(bike.lateral - m.lateral) < 3) {
            this.hitBike(bike, 'mine', m.owner, bus);
            exploded = true;
            break;
          }
        }
      }
      if (exploded || m.expireIn <= 0) {
        this.group.remove(m.group);
        this.mines.splice(i, 1);
      }
    }
  }

  private fire(index: number, kind: ItemKind, track: TrackPath, bus: EventBus, time: number): boolean {
    if (kind === 'missile') {
      // 玩家优先攻击前方最近的对手（后方仅有无人领先时才回退）；AI 主动瞄准玩家攻击
      const t = index === 0 ? this.findTarget(this.bikes[index], track) : this.targetPlayer(this.bikes[index], track);
      if (t.index < 0) return false;
      this.makeMissile(track, index, t.index, t.dir);
    } else if (kind === 'mine') {
      this.makeMine(track, index);
    } else if (kind === 'boost') {
      this.bikes[index].applyPickupBoost();
    } else if (kind === 'shield') {
      this.shieldUntil[index] = time + 5;
    }
    this.firedAt[index] = time;
    bus.emit('item:fire', { index, kind });
    return true;
  }

  /** 找目标：优先锁定「前方」（进度领先）最近的对临时；前方无人时才退回「后方」 */
  private findTarget(bike: BikeEntity, track: TrackPath): { index: number; dir: number } {
    const L = track.length;
    let aheadIndex = -1;
    let aheadDist = Infinity;
    let behindIndex = -1;
    let behindDist = Infinity;
    for (const other of this.bikes) {
      if (other.index === bike.index) continue;
      const d = signedDelta(other.progress, bike.progress, L);
      if (d > 0) {
        if (d < aheadDist) {
          aheadDist = d;
          aheadIndex = other.index;
        }
      } else {
        const dist = -d;
        if (dist < behindDist) {
          behindDist = dist;
          behindIndex = other.index;
        }
      }
    }
    if (aheadIndex >= 0) return { index: aheadIndex, dir: 1 };
    return { index: behindIndex, dir: -1 };
  }

  /** AI 导弹瞄准玩家（玩家未冲线时）；玩家已冲线则退回最近对手 */
  private targetPlayer(bike: BikeEntity, track: TrackPath): { index: number; dir: number } {
    const player = this.bikes[0];
    if (player && !player.finished) {
      const d = signedDelta(player.progress, bike.progress, track.length);
      return { index: 0, dir: d >= 0 ? 1 : -1 };
    }
    return this.findTarget(bike, track);
  }

  private explode(target: BikeEntity, m: Missile, bus: EventBus): void {
    if (this.isShielded(target.index)) {
      bus.emit('item:block', { index: target.index, owner: m.owner });
    } else {
      this.hitBike(target, 'missile', m.owner, bus);
    }
    this.group.remove(m.group);
  }

  private hitBike(bike: BikeEntity, kind: ItemKind, owner: number, bus: EventBus): void {
    bike.applyObstacleHit(0);
    bus.emit('item:hit', { index: bike.index, kind, owner });
  }

  private disposeMissile(i: number): void {
    const m = this.missiles[i];
    this.group.remove(m.group);
    this.missiles.splice(i, 1);
  }
}