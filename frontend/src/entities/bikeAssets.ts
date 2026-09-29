import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { BikeForm } from '../core/constants';

/**
 * 摩托车 GLB 素材：加载并缓存三辆车的外壳模型，供 MotorcycleModel 实例化复用。
 * 素材已是标准 glTF 朝向（+Y 上、长度 +Z 前、宽度 +X），无需旋转。
 *
 * 加载时按高度把外壳切成三段：
 *   - 轮胎（最低段）
 *   - 车身下部
 *   - 车身上部
 * 三段分别贴不同 ToonMaterial，供实例化时做随机「车皮」双色涂装。
 *
 * 拆分算法按三角形处理：读取真实索引（u32/u16），用三角形重心高度决定归属，
 * 而不是只看第一个顶点，避免非连续索引几何产生破面与飞线。
 */
const MODEL_FILES: Record<BikeForm, string> = {
  bonneville: 'models/Cafe-Race-Bike-upright.glb',
  dt1: 'models/Yamaha-upright.glb',
  flh: 'models/RS200-PULSAR-upright.glb',
};

/** 新模型已按实车比例导出（长度约 1.72~2.08 单位），统一按 1.0 缩放。 */
const MODEL_SCALES: Record<BikeForm, number> = {
  bonneville: 1.0,
  dt1: 1.0,
  flh: 1.0,
};

/**
 * 车头朝向修正（绕 Y 轴 yaw，弧度）。素材应统一车头朝 +Z（游戏前进方向、与车手脸一致），
 * 但 Yamaha-upright.glb 导出时车头实际朝 -Z（实测其把手/最高点在 -Z 侧），需摆正 180°。
 * bonneville / flh 已朝 +Z，无需旋转。
 */
const MODEL_YAW: Record<BikeForm, number> = {
  bonneville: 0,
  dt1: Math.PI,
  flh: 0,
};

/** 轮胎/车身分割：高度低于「总高 * 比例」的三角面归为轮胎 */
const TIRE_TOP_FRAC: Record<BikeForm, number> = {
  bonneville: 0.34,
  dt1: 0.34,
  flh: 0.36,
};

export type BikePart = 'tire' | 'body-lower' | 'body-upper';

/** 加载失败时抛出的专用错误，便于加载界面展示失败文件与重试入口 */
export class BikeAssetLoadError extends Error {
  readonly form: BikeForm;
  readonly file: string;

  constructor(form: BikeForm, file: string, cause: unknown) {
    super(`[bikeAssets] 加载 ${file} 失败：${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'BikeAssetLoadError';
    this.form = form;
    this.file = file;
  }
}

const loader = new GLTFLoader();
const cache = new Map<BikeForm, THREE.Group>();
const pending = new Map<BikeForm, Promise<THREE.Group>>();

interface SplitResult {
  tire: THREE.BufferGeometry | null;
  bodyLower: THREE.BufferGeometry | null;
  bodyUpper: THREE.BufferGeometry | null;
}

/** 按高度把索引几何分割成轮胎 / 车身下部 / 车身上部三段（共享顶点属性，仅 index 不同） */
export function splitBands(geometry: THREE.BufferGeometry, tireTop: number, bodySplit: number): SplitResult {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const elementCount = index ? index.count : position.count;
  const triCount = Math.floor(elementCount / 3);

  const tireIdx: number[] = [];
  const lowerIdx: number[] = [];
  const upperIdx: number[] = [];

  const vertexIndexAt = (element: number): number => (index ? index.getX(element) : element);

  for (let triangle = 0; triangle < triCount; triangle += 1) {
    const offset = triangle * 3;
    const a = vertexIndexAt(offset);
    const b = vertexIndexAt(offset + 1);
    const c = vertexIndexAt(offset + 2);

    // 使用三角形中心高度，避免只看第一个顶点导致的错误归属。
    const centerY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;

    const target = centerY < tireTop ? tireIdx : centerY < bodySplit ? lowerIdx : upperIdx;
    target.push(a, b, c);
  }

  const makeGeometry = (indices: number[]): THREE.BufferGeometry | null => {
    if (indices.length === 0) return null;
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', position);
    if (normal) result.setAttribute('normal', normal);
    result.setIndex(indices);
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  };

  return {
    tire: makeGeometry(tireIdx),
    bodyLower: makeGeometry(lowerIdx),
    bodyUpper: makeGeometry(upperIdx),
  };
}

function normalize(template: THREE.Group, form: BikeForm): THREE.Group {
  template.scale.setScalar(MODEL_SCALES[form]);
  template.rotation.y = MODEL_YAW[form];

  // 关键：GLB 的统一朝向是通过「根节点整体变换」表达的（+Y 上、长度 +Z、地面 Y=0），
  // 但不同源文件的 xyz 轴名与模型实际朝向并不一致。这里把网格累计到世界空间的变换烘焙进顶点：
  // 无论原始文件的坐标轴怎么命名，最终几何体都统一成世界坐标（+Y 上、+Z 前），并按世界 Y 高度切分。
  template.updateMatrixWorld(true);

  // 收集所有 Mesh。当前三辆车的资产规范为「单 Mesh」：若未来更换为多 Mesh 模型，
  // 必须先在 Blender/构建脚本里拆好部件，或在这里改为逐个处理；直接吞掉其余网格会导致部件消失。
  const meshes: THREE.Mesh[] = [];
  template.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });

  if (meshes.length !== 1) {
    throw new Error(
      `[bikeAssets] ${MODEL_FILES[form]} 应恰好包含 1 个 Mesh（实际 ${meshes.length} 个）。` +
        ' 请在导出前合并网格，或扩展 bikeAssets 以支持多网格部件。',
    );
  }

  const source = meshes[0];
  // 烘焙世界变换：把 GLB 根节点/父级的旋转与位移固化到顶点数据里
  const baked = source.geometry.clone();
  baked.applyMatrix4(source.matrixWorld);
  source.geometry = baked;

  // 新 GLB 只导出位置与索引，无法线；烘焙后重新计算法线，配合 DoubleSide 让薄壳封闭、
  // 不太容易产生漏缝和单面发黑（CAD 薄壳是开放曲面，靠双面渲染 + 平滑法线呈现封闭感）。
  source.geometry.computeVertexNormals();
  let tireTop = 0;
  let bodySplit = 0;
  source.geometry.computeBoundingBox();
  if (source.geometry.boundingBox) {
    const minY = source.geometry.boundingBox.min.y;
    const height = source.geometry.boundingBox.max.y - minY;
    tireTop = minY + TIRE_TOP_FRAC[form] * height;
    // 车身上/下的分界：车身段（轮胎顶到最高点）的 55% 处
    bodySplit = tireTop + (height - TIRE_TOP_FRAC[form] * height) * 0.55;
  }

  const { tire, bodyLower, bodyUpper } = splitBands(source.geometry, tireTop, bodySplit);
  const mat = source.material as THREE.Material;
  mat.side = THREE.DoubleSide;
  template.clear();
  // 朝向 / 缩放已在上方通过 matrixWorld 烘焙进几何顶点，这里把根节点恢复为单位变换。
  // 否则 MODEL_YAW(π) 会再作用于已烘焙过 180° 的 Yamaha 几何（π + π = 2π 回到原朝向），
  // 导致车头重新朝 -Z，与车手翻转后朝 +Z 的脸朝向冲突，出现「人车相反」。
  template.rotation.set(0, 0, 0);
  template.scale.setScalar(1);
  template.position.set(0, 0, 0);
  if (bodyUpper) {
    const m = new THREE.Mesh(bodyUpper, source.material);
    m.userData.part = 'body-upper' satisfies BikePart;
    template.add(m);
  }
  if (bodyLower) {
    const m = new THREE.Mesh(bodyLower, source.material);
    m.userData.part = 'body-lower' satisfies BikePart;
    template.add(m);
  }
  if (tire) {
    const m = new THREE.Mesh(tire, source.material);
    m.userData.part = 'tire' satisfies BikePart;
    template.add(m);
  }

  template.updateMatrixWorld(true);
  template.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if ((mesh as { isMesh?: boolean }).isMesh) {
      const m = mesh.material as THREE.Material;
      if (m) m.side = THREE.DoubleSide;
    }
  });
  return template;
}

function loadOne(form: BikeForm): Promise<THREE.Group> {
  const hit = cache.get(form);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(form);
  if (inFlight) return inFlight;
  const p = loader
    .loadAsync(MODEL_FILES[form])
    .then((glb) => normalize(glb.scene, form))
    .then((tpl) => {
      cache.set(form, tpl);
      pending.delete(form);
      return tpl;
    })
    .catch((error) => {
      // 失败时不缓存空模型：清空 pending/cache，让下次调用能重新尝试。
      pending.delete(form);
      cache.delete(form);
      throw new BikeAssetLoadError(form, MODEL_FILES[form], error);
    });
  pending.set(form, p);
  return p;
}

/** 已成功加载的车型列表（供加载界面展示进度） */
export function loadedBikeForms(): BikeForm[] {
  return Array.from(cache.keys());
}

/** 预加载指定车型；失败会向上抛出 BikeAssetLoadError，由加载界面决定重试。 */
export function preloadBikeForms(forms: BikeForm[] = ['bonneville', 'dt1', 'flh']): Promise<THREE.Group[]> {
  return Promise.all(forms.map((f) => loadOne(f)));
}

/** 预加载三辆车模型（兼容旧调用）；任一失败都会 reject。 */
export async function preloadBikeModels(): Promise<void> {
  await preloadBikeForms();
}

/** 取某车型的缓存模板（未加载会抛错；正常流程下先调 preloadBikeModels）。 */
export function getBikeTemplate(form: BikeForm): THREE.Group {
  const tpl = cache.get(form);
  if (!tpl) throw new Error(`[bikeAssets] ${form} 尚未加载`);
  return tpl;
}
