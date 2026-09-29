import * as THREE from 'three';
import { createRiderFigure, RIDER_HIP_Y } from './CharacterAsset';
import type { RiderFigure } from './CharacterAsset';
import { faceStore } from '../settings/FaceStore';
import type { BikeForm, RiderSpec } from '../core/constants';

export interface RiderPose {
  lean: number;
  pitch: number;
  steer: number;
  crouch: number;
  airborne: boolean;
  celebrate: boolean;
  time: number;
}

interface RiderMount {
  seatY: number;
  seatZ: number;
  scale: number;
}

// 各车型座高 / 前后偏移 / 整体缩放（沿用上一版校准；GLB 车手约 1.75m，等比缩小贴座）
// dt1 的 GLB 在 bikeAssets 里绕 Y 摆正了 180°（车头朝 +Z），座位随之前后对调，
// 故其 seatZ 取负，车手仍在座位上方；其余参数（座高/缩放/姿态）前后对称，无需改。
const MOUNTS: Record<BikeForm, RiderMount> = {
  bonneville: { seatY: 0.7, seatZ: 0, scale: 0.7 },
  dt1: { seatY: 0.53, seatZ: -0.04, scale: 0.7 },
  flh: { seatY: 0.55, seatZ: -0.02, scale: 0.7 },
};

// 基础骑行姿态（GLB 本地坐标，脸朝 -Z，单位弧度）：
//   spine/chest 负 = 前倾；armPitch 负 = 双手放低到车把；thigh 正 = 大腿前抬；shin 负 = 屈膝。
interface BoneBase {
  spine: number;
  chest: number;
  armPitch: number;
  thigh: number;
  shin: number;
}

const BASES: Record<BikeForm, BoneBase> = {
  bonneville: { spine: -0.42, chest: -0.2, armPitch: -0.42, thigh: 1.32, shin: -2.0 },
  dt1: { spine: -0.46, chest: -0.26, armPitch: -0.28, thigh: 1.44, shin: -2.12 },
  flh: { spine: -0.3, chest: -0.12, armPitch: -0.15, thigh: 1.22, shin: -1.9 },
};

export class RiderModel {
  readonly group = new THREE.Group();
  private figure: RiderFigure;
  private base: BoneBase;

  constructor(spec: RiderSpec, form: BikeForm = 'bonneville') {
    const mount = MOUNTS[form];
    this.base = BASES[form];

    this.figure = createRiderFigure({ suit: spec.suit, panel: spec.suitLight, accent: spec.helmet });
    this.figure.group.position.y = -RIDER_HIP_Y; // 臀部对齐 group 原点（座垫）

    // GLB 脸朝 -Z → 翻转 180° 使车手面朝游戏前进方向（+Z）
    const flip = new THREE.Group();
    flip.rotation.y = Math.PI;
    flip.add(this.figure.group);
    this.group.add(flip);

    this.group.scale.setScalar(mount.scale);
    this.group.position.set(0, mount.seatY, mount.seatZ);

    this.figure.setFace(faceStore.getPreset()); // 选车台 & 比赛共用同一张脸
    this.setPose({ lean: 0, pitch: 0, steer: 0, crouch: 0.3, airborne: false, celebrate: false, time: 0 });
  }

  setPose(p: RiderPose): void {
    const b = this.figure.bones;
    const B = this.base;
    // BikeEntity 的 crouch 恒为 0.28~1.1，归一化成相对中性姿态（0.28）的增量
    const tuck = Math.max(0, p.crouch - 0.28);
    const cele = p.celebrate ? 1 : 0;
    const bounce = p.airborne ? Math.sin(p.time * 22) * 0.05 : 0;

    // 躯干俯仰：负 = 前倾。tuck 越大越伏；pitch>0（刹车）回正上仰。
    const spineX = B.spine + p.pitch * 0.5 - tuck * 0.5 + bounce;
    const chestX = B.chest + p.pitch * 0.2 - tuck * 0.3;
    b.spine.rotation.x = spineX;
    b.chest.rotation.x = chestX;

    // 过弯侧倾（绕 Z）：经 π 翻转后符号取反（旧程序化身体为 -lean*0.55）
    const roll = p.lean * 0.55 - cele * 0.12;
    b.spine.rotation.z = roll;
    b.hips.rotation.z = roll * 0.3;

    // 头部：自动回正保持目视前方 + 目视转向
    const leanTotal = spineX + chestX;
    b.neck.rotation.x = -leanTotal * 0.5;
    b.head.rotation.x = -leanTotal * 0.5 + p.pitch * 0.1;
    b.head.rotation.y = p.steer * 0.42 + cele * 0.35;
    b.head.rotation.z = cele ? Math.sin(p.time * 6) * 0.35 : 0;

    // 手臂：A-pose（水平外展）→ 前伸握把；庆祝时抬臂挥动
    if (cele) {
      b.upper_armL.rotation.y = 0.5;
      b.upper_armR.rotation.y = -0.5;
      b.upper_armL.rotation.x = 1.0;
      b.upper_armR.rotation.x = 1.0;
    } else {
      b.upper_armL.rotation.y = Math.PI / 2;
      b.upper_armR.rotation.y = -Math.PI / 2;
      const armPitch = B.armPitch - tuck * 0.4 + p.pitch * 0.2;
      b.upper_armL.rotation.x = armPitch;
      b.upper_armR.rotation.x = armPitch;
    }

    // 腿：大腿前抬 + 屈膝（tuck 越深收腿越紧）
    const thigh = B.thigh - tuck * 0.15 + (cele ? 0.2 : 0);
    const shin = B.shin - tuck * 0.3;
    b.thighL.rotation.x = thigh;
    b.thighR.rotation.x = thigh;
    b.shinL.rotation.x = shin;
    b.shinR.rotation.x = shin;
  }
}