import * as THREE from 'three';
import { createRiderFigure, RIDER_HIP_Y } from './CharacterAsset';
import type { RiderFigure } from './CharacterAsset';
import { characterStore } from '../settings/CharacterStore';
import {solveLimb} from './RiderIK';
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
  bonneville: { seatY: 0.92, seatZ: -0.35, scale: 0.94 },
  dt1: { seatY: 1.00, seatZ: -0.35, scale: 0.94 },
  flh: { seatY: 0.92, seatZ: -0.35, scale: 0.94 },
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
  bonneville: { spine: -0.70, chest: -0.34, armPitch: -0.42, thigh: 1.32, shin: -2.0 },
  dt1: { spine: -0.64, chest: -0.32, armPitch: -0.48, thigh: 1.44, shin: -2.12 },
  flh: { spine: -0.79, chest: -0.37, armPitch: -0.25, thigh: 1.32, shin: -1.9 },
};

export class RiderModel {
  readonly group = new THREE.Group();
  private figure: RiderFigure;
  private base: BoneBase;

  constructor(spec: RiderSpec, form: BikeForm = 'bonneville') {
    const mount = MOUNTS[form];
    this.base = BASES[form];

    const appearance=characterStore.get();
    this.figure = createRiderFigure({ suit: spec.suit, panel: spec.suitLight, accent: spec.helmet },appearance);
    this.figure.group.position.y = -this.figure.hipHeight;
    this.figure.setHelmet(true);

    // GLB 脸朝 -Z → 翻转 180° 使车手面朝游戏前进方向（+Z）
    const flip = new THREE.Group();
    flip.rotation.y = Math.PI;
    flip.add(this.figure.group);
    this.group.add(flip);

    this.group.scale.setScalar(mount.scale);
    // Shorter reach slides the rider forward on the saddle instead of stretching their arms.
    const saddleOffset=.11+Math.max(0,178-appearance.height)*.004-Math.min(0,appearance.armLength)*.05;
    this.group.position.set(0, mount.seatY, mount.seatZ+saddleOffset);

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
    // Targets are in motorcycle coordinates; body size must not move the grips or pegs.
    this.group.updateWorldMatrix(true,true);
    const world=(x:number,y:number,z:number)=>this.group.localToWorld(new THREE.Vector3(x/this.group.scale.x,(y-this.group.position.y)/this.group.scale.y,(z-this.group.position.z)/this.group.scale.z));
    for(const side of [-1,1]){
      const s=side===1?'L':'R';
      if(!cele)solveLimb(b['upper_arm'+s],b['lower_arm'+s],b['hand'+s],world(-side*.32,1.07,.445),world(-side*.56,.93,-.03));
      solveLimb(b['thigh'+s],b['shin'+s],b['foot'+s],world(-side*.23,.44,-.10),world(-side*.29,.74,.48));
      const feetWorld=this.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
      b['foot'+s].quaternion.copy(b['foot'+s].parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(feetWorld));
    }
  }
}
