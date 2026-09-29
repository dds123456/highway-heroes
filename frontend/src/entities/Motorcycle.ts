import * as THREE from 'three';
import { COLORS, hexColor } from '../core/constants';
import type { BikeForm, Colorway } from '../core/constants';
import { makeToonMaterial } from '../render/ToonMaterial';
import { makeWrapMaterial } from '../render/WrapMaterial';
import { getBikeTemplate } from './bikeAssets';
import type { BikePart } from './bikeAssets';

/**
 * 随机车皮配色库：每辆车实例化时随机抽取一个「下半车身」色，形成双色涂装，
 * 让同一车型的不同车不至通身一色。
 */
const LIVERY_COLORS = [
  '#ffd23f', '#ff2d3f', '#5cf2e3', '#b45bff',
  '#2fb6ff', '#ff7ac8', '#ff8a3d', '#8ce068',
  '#e8492f', '#34569c', '#d8b13b', '#16c9a0',
];

function pickLivery(seed: number, primary: string): string {
  // 随机但可复现：用 instanceSeed 打散，避免与车身主色完全相同
  let idx = Math.abs(seed * 1103515245 + 12345) % LIVERY_COLORS.length;
  const primaryNorm = primary.toLowerCase();
  for (let tries = 0; tries < LIVERY_COLORS.length; tries++) {
    const c = LIVERY_COLORS[idx];
    if (c.toLowerCase() !== primaryNorm) return c;
    idx = (idx + 1) % LIVERY_COLORS.length;
  }
  return LIVERY_COLORS[idx];
}

function liveryGloss(primary: string): number {
  // 亮色车身用更高的高光，深色车身用略低高光
  const v = parseInt(primary.slice(1), 16);
  const lum = (((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114) / 255;
  return lum > 0.5 ? 34 : 26;
}

let instanceSeed = 0;

/**
 * 摩托车实体模型：从 GLB 外壳素材实例化（替换原先的程序化建模）。
 * 外壳在加载时已按高度分割为轮胎 / 车身下 / 车身上三段，
 * 这里分别贴深色轮胎、随机下半车身涂装、主色车身上部的 NPR 材质。
 * 传入 wrapTexture 时，车身下/上改用三平面采样的车衣材质（选车台预览用），轮胎不变。
 */
export class MotorcycleModel {
  readonly group = new THREE.Group();
  private bikeRoot: THREE.Group;
  private shadow: THREE.Mesh;

  constructor(form: BikeForm, colorway: Colorway, wrapTexture: THREE.Texture | null = null) {
    const template = getBikeTemplate(form);
    this.bikeRoot = template.clone(true);

    const livery = pickLivery(instanceSeed++, colorway.primary);
    const bodyMat = makeToonMaterial(colorway.primary, {
      rimColor: COLORS.rim,
      rimPower: 3,
      gloss: liveryGloss(colorway.primary),
      specular: 0.6,
    });
    bodyMat.side = THREE.DoubleSide;
    const liveryMat = makeToonMaterial(livery, {
      rimColor: hexColor('#5cf2e3'),
      rimPower: 3,
      gloss: liveryGloss(livery),
      specular: 0.55,
    });
    liveryMat.side = THREE.DoubleSide;
    const tireMat = makeToonMaterial('#1a1d24', {
      rimColor: COLORS.rimTeal,
      rimPower: 3,
      gloss: 18,
      specular: 0.25,
    });
    tireMat.side = THREE.DoubleSide;
    const wrapMat = wrapTexture
      ? makeWrapMaterial(wrapTexture, { rimColor: COLORS.rim, rimPower: 3, specular: 0.55 })
      : null;
    if (wrapMat) wrapMat.side = THREE.DoubleSide;

    // 克隆几何并统一材质：清场 dispose 时不会破坏缓存里的共享几何
    this.bikeRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as { isMesh?: boolean }).isMesh) return;
      mesh.geometry = mesh.geometry.clone();
      const part = mesh.userData.part as BikePart | undefined;
      if (part === 'tire') mesh.material = tireMat;
      else if (wrapMat) mesh.material = wrapMat;
      else if (part === 'body-lower') mesh.material = liveryMat;
      else mesh.material = bodyMat;
    });

    // 地面投影
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.shadow.renderOrder = 1;

    this.group.add(this.bikeRoot, this.shadow);
  }

  update(dt: number, speed: number, steer: number, boost: boolean): void {
    void dt;
    void steer;
    const shake = speed > 50 ? Math.sin(performance.now() * 0.035) * speed * 0.00008 : 0;
    this.bikeRoot.position.y = Math.sin(performance.now() * 0.02) * 0.006 + shake;
    this.shadow.visible = !boost;
  }
}