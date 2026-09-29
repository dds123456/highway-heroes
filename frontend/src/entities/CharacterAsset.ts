import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COLORS } from '../core/constants';
import { makeToonMaterial } from '../render/ToonMaterial';

/**
 * 角色捏脸素材：加载 rider-lightweight-morph.glb（A-pose 轻量车手，带 10 组面部 morph），
 * 只取其中的「可塑脑袋」（Head_Morphable + 头发/眼睛/鼻子/嘴），用 ToonMaterial 上色，
 * 让脸与游戏的三渲二风格一致。GLB 由 build-lightweight-rider.mjs 程序化导出，零额外材质贴图。
 */
export const RIDER_ASSET_URL = 'assets/characters/rider-lightweight-morph.glb';

export type FaceMorphName =
  | 'FaceWidth'
  | 'FaceNarrow'
  | 'FaceLength'
  | 'JawWidth'
  | 'ChinLength'
  | 'CheekFullness'
  | 'ForeheadHeight'
  | 'BrowDepth'
  | 'EyeRegionWidth'
  | 'MouthRegionWidth';

export type RiderFacePreset = Partial<Record<FaceMorphName, number>>;

/** 参考默认脸（与 zip 内 CharacterAsset.ts 一致；FaceStore 内才是权威默认） */
export const DEFAULT_FACE: RiderFacePreset = {
  FaceWidth: 0.08,
  FaceLength: 0.1,
  JawWidth: 0.12,
  CheekFullness: 0.08,
  EyeRegionWidth: 0.05,
};

/** 头部相关网格名 → 上色方案（颜色 + 高光） */
const HEAD_PART_COLORS: Record<string, { color: string; specular: number }> = {
  Head_Morphable: { color: '#b9795e', specular: 0.2 },
  Hair_Cap: { color: '#090a0c', specular: 0.4 },
  Eye_L: { color: '#f4f4ef', specular: 0.4 },
  Eye_R: { color: '#f4f4ef', specular: 0.4 },
  Pupil_L: { color: '#17100f', specular: 0.75 },
  Pupil_R: { color: '#17100f', specular: 0.75 },
  Nose: { color: '#b9795e', specular: 0.2 },
  Mouth: { color: '#b3162b', specular: 0.2 },
};

let cachedScene: THREE.Group | null = null;

export class RiderAssetLoadError extends Error {
  constructor(cause: unknown) {
    super(`[CharacterAsset] 加载 ${RIDER_ASSET_URL} 失败：${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'RiderAssetLoadError';
  }
}

function findMeshByName(root: THREE.Object3D, name: string): THREE.Mesh | null {
  const matches: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object.name === name && (object as THREE.Mesh).isMesh) matches.push(object as THREE.Mesh);
  });
  return matches[0] ?? null;
}

/** 预加载并缓存 rider GLB（boot 阶段调用；失败向上抛出） */
export async function preloadRiderCharacter(url = RIDER_ASSET_URL): Promise<void> {
  if (cachedScene) return;
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const head = findMeshByName(gltf.scene, 'Head_Morphable');
    if (!head || !head.morphTargetDictionary || !head.morphTargetInfluences) {
      throw new Error('rider GLB 缺少 Head_Morphable 面部 morph 数据');
    }
    cachedScene = gltf.scene;
  } catch (error) {
    cachedScene = null;
    throw new RiderAssetLoadError(error);
  }
}

export interface RiderHead {
  group: THREE.Group;
  setFace(preset: RiderFacePreset): void;
  dispose(): void;
}

/**
 * 克隆一份「可塑脑袋」，重新上色为 ToonMaterial。
 * 头部网格都直接挂在 headBone 下（非蒙皮），克隆单个网格即还原头部局部变换。
 */
export function createRiderHead(): RiderHead {
  if (!cachedScene) throw new Error('[CharacterAsset] rider 尚未加载，请先 preloadRiderCharacter');

  const group = new THREE.Group();
  const parts: THREE.Mesh[] = [];

  cachedScene.traverse((object) => {
    const original = object as THREE.Mesh;
    if (!original.isMesh || !(original.name in HEAD_PART_COLORS)) return;
    const colorSpec = HEAD_PART_COLORS[original.name];

    const clone = original.clone();
    const toon = makeToonMaterial(colorSpec.color, {
      rimColor: COLORS.rim,
      rimPower: 3,
      specular: colorSpec.specular,
    });
    clone.material = toon;
    clone.castShadow = true;
    clone.receiveShadow = true;
    // 眼睛/鼻子/嘴略高于头球表面，抬高渲染顺序避免深度闪描
    clone.renderOrder = original.name === 'Head_Morphable' || original.name === 'Hair_Cap' ? 0 : 1;
    group.add(clone);
    parts.push(clone);
  });

  const headMesh = parts.find((m) => m.name === 'Head_Morphable');
  if (!headMesh || !headMesh.morphTargetDictionary || !headMesh.morphTargetInfluences) {
    throw new Error('[CharacterAsset] 克隆头部时丢失面部 morph 数据');
  }
  const morphDict = headMesh.morphTargetDictionary;
  const morphInfluences = headMesh.morphTargetInfluences;

  const setFace = (preset: RiderFacePreset): void => {
    for (const [name, raw] of Object.entries(preset)) {
      const index: number | undefined = morphDict[name];
      if (index !== undefined) morphInfluences[index] = THREE.MathUtils.clamp(raw ?? 0, 0, 1);
    }
  };

  return {
    group,
    setFace,
    dispose: () => {
      // 几何体与缓存的 GLB 场景共享（clone 复用同一份 geometry），只释放每个副本私有的
      // ToonMaterial即可；销毁 geometry 会让下一次 createRiderHead 用到已释放的资源。
      for (const part of parts) {
        (part.material as THREE.Material).dispose();
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 全身车手：克隆 rider GLB 的 17 骨骼 + 全部可见网格，按车手配色上色。
// 可见部位是「刚体骨骼父子」结构（非蒙皮，只有 Rig_Skin_Proxy 是隐形蒙皮代理），
// 因此直接克隆骨骼层级 + 逐网格挂到对应骨骼下，即可像骨架一样旋转摆姿势。
// ─────────────────────────────────────────────────────────────

/** 车手 GLB 中髋关节（hips 骨骼）距足底的高度（米），用于把臀部对齐到座垫 */
export const RIDER_HIP_Y = 0.94;

/** 骑行服配色（来自 RiderSpec：suit 主色 / panel 亮色 / accent 强调色） */
export interface RiderSuitColors {
  suit: string;
  panel: string;
  accent: string;
}

const SKIN = '#b9795e';
const HAIR = '#090a0c';
const EYE_WHITE = '#f4f4ef';
const PUPIL = '#17100f';

interface FigurePartStyle {
  color: string;
  specular: number;
  /** 抬高渲染顺序，避免眼睛/鼻子/嘴等贴在头球表面的细小件深度闪描 */
  renderOrder: number;
}

function figurePartStyle(name: string, c: RiderSuitColors): FigurePartStyle | null {
  if (name.startsWith('Print88_')) return { color: '#f4f4ef', specular: 0.5, renderOrder: 1 };
  switch (name) {
    case 'Torso':
    case 'Pelvis':
    case 'UpperArm_L':
    case 'UpperArm_R':
    case 'Thigh_L':
    case 'Thigh_R':
    case 'Boot_L':
    case 'Boot_R':
      return { color: c.suit, specular: 0.38, renderOrder: 0 };
    case 'Forearm_L':
    case 'Forearm_R':
    case 'Shin_L':
    case 'Shin_R':
    case 'Chest_Cream_Panel':
      return { color: c.panel, specular: 0.4, renderOrder: 0 };
    case 'Red_Center_Stripe':
    case 'Knee_Red_L':
    case 'Knee_Red_R':
      return { color: c.accent, specular: 0.5, renderOrder: 1 };
    case 'Head_Morphable':
    case 'Nose':
    case 'Hand_L':
    case 'Hand_R':
      return { color: SKIN, specular: 0.2, renderOrder: 0 };
    case 'Hair_Cap':
      return { color: HAIR, specular: 0.4, renderOrder: 0 };
    case 'Eye_L':
    case 'Eye_R':
      return { color: EYE_WHITE, specular: 0.4, renderOrder: 1 };
    case 'Pupil_L':
    case 'Pupil_R':
      return { color: PUPIL, specular: 0.75, renderOrder: 1 };
    case 'Mouth':
      return { color: '#b3162b', specular: 0.2, renderOrder: 1 };
    default:
      return null;
  }
}

export interface RiderFigure {
  group: THREE.Group;
  /** 按骨骼名访问骨骼节点（摆姿态用）：hips/spine/chest/neck/head/upper_armL…footR */
  bones: Record<string, THREE.Bone>;
  setFace(preset: RiderFacePreset): void;
  dispose(): void;
}

/** 克隆一份「全身可摆姿势」车手：A-pose 17 骨骼 + 各部位网格，网格重上 ToonMaterial 配色 */
export function createRiderFigure(colors: RiderSuitColors): RiderFigure {
  if (!cachedScene) throw new Error('[CharacterAsset] rider 尚未加载，请先 preloadRiderCharacter');

  const group = new THREE.Group();
  const bones: Record<string, THREE.Bone> = {};
  const boneClones = new Map<THREE.Object3D, THREE.Bone>();

  // 1) 克隆骨骼层级（rest pose 各骨骼旋转均为单位四元数）
  cachedScene.traverse((object) => {
    if (!(object as THREE.Bone).isBone) return;
    const b = new THREE.Bone();
    b.name = object.name;
    b.position.copy(object.position);
    b.rotation.copy(object.rotation);
    b.scale.copy(object.scale);
    bones[object.name] = b;
    boneClones.set(object, b);
  });
  cachedScene.traverse((object) => {
    if (!(object as THREE.Bone).isBone) return;
    const parent = object.parent ? boneClones.get(object.parent) : undefined;
    (parent ?? group).add(boneClones.get(object)!);
  });

  // 2) 克隆可见网格，挂到对应骨骼下并上色。
  //    几何逐实例 clone（与 MotorcycleModel 一致），避免 clearWorld/SelectionScene 的
  //    dispose 破坏缓存的模板几何。
  const parts: THREE.Mesh[] = [];
  cachedScene.traverse((object) => {
    const source = object as THREE.Mesh;
    if (!source.isMesh || source.name === 'Rig_Skin_Proxy') return;
    const style = figurePartStyle(source.name, colors);
    if (!style) return;
    const clone = source.clone();
    clone.geometry = source.geometry.clone();
    clone.material = makeToonMaterial(style.color, { rimColor: COLORS.rim, rimPower: 3, specular: style.specular });
    clone.castShadow = true;
    clone.receiveShadow = true;
    clone.renderOrder = style.renderOrder;
    const parent = source.parent ? boneClones.get(source.parent) : undefined;
    (parent ?? group).add(clone);
    parts.push(clone);
  });

  const headMesh = parts.find((m) => m.name === 'Head_Morphable');
  if (!headMesh || !headMesh.morphTargetDictionary || !headMesh.morphTargetInfluences) {
    throw new Error('[CharacterAsset] 克隆全身时丢失 Head_Morphable 面部 morph 数据');
  }
  const morphDict = headMesh.morphTargetDictionary;
  const morphInfluences = headMesh.morphTargetInfluences;

  const setFace = (preset: RiderFacePreset): void => {
    for (const [name, raw] of Object.entries(preset)) {
      const index: number | undefined = morphDict[name];
      if (index !== undefined) morphInfluences[index] = THREE.MathUtils.clamp(raw ?? 0, 0, 1);
    }
  };

  return {
    group,
    bones,
    setFace,
    dispose: () => {
      // 几何是逐实例 clone 的，可直接销毁，不影响缓存的模板。
      for (const part of parts) {
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
    },
  };
}