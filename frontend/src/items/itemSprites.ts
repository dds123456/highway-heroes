import * as THREE from 'three';
import type { ItemKind } from '../core/constants';

/**
 * 道具 GIF 精灵：把四类道具的旋转 GIF 压成「6×4」帧图集（PNG），
 * 用 THREE.Sprite 逐帧采样播放，替换原先的「礼物盒 + 色球」呈现。
 *
 * 图集由脚本 .item-gifs-tmp/build_atlas.py 从用户提供的 GIF 生成：
 *   - 每格 480×480，共 24 帧（6 列 × 4 行），16 FPS；
 *   - 深色背景已做「暗部抠透明」，霓虹主体保留原色。
 */
const ATLAS_FILES: Record<ItemKind, string> = {
  missile: 'items/missile.png',
  shield: 'items/shield.png',
  boost: 'items/boost.png',
  mine: 'items/mine.png',
};

const COLS = 6;
const ROWS = 4;
const FRAME_COUNT = 24;
const FPS = 16;

const loader = new THREE.TextureLoader();
const cache = new Map<ItemKind, THREE.Texture>();
const pending = new Map<ItemKind, Promise<THREE.Texture>>();

function loadOne(kind: ItemKind): Promise<THREE.Texture> {
  const hit = cache.get(kind);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(kind);
  if (inFlight) return inFlight;

  const p = loader
    .loadAsync(ATLAS_FILES[kind])
    .then((texture) => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      cache.set(kind, texture);
      pending.delete(kind);
      return texture;
    })
    .catch((error) => {
      pending.delete(kind);
      cache.delete(kind);
      throw error;
    });
  pending.set(kind, p);
  return p;
}

/** 预加载四类道具图集（boot 阶段调用；任一失败会向上抛出） */
export function preloadItemSprites(kinds: ItemKind[] = ['missile', 'shield', 'boost', 'mine']): Promise<THREE.Texture[]> {
  return Promise.all(kinds.map((k) => loadOne(k)));
}

/** 取某道具的图集纹理（未加载会抛错） */
export function getItemSpriteTexture(kind: ItemKind): THREE.Texture {
  const t = cache.get(kind);
  if (!t) throw new Error(`[itemSprites] ${kind} 图集尚未加载`);
  return t;
}

/** 单个道具精灵：内部持有一份克隆纹理，独立维护自己的当前帧 offset/repeat */
export class ItemSprite {
  readonly sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private texture: THREE.Texture;
  private elapsed = 0;

  constructor(kind: ItemKind) {
    // 克隆纹理：图集 image 共享，但 offset/repeat 各自独立，避免多道具互相串帧。
    const base = cache.get(kind) ?? null;
    this.texture = base ? base.clone() : new THREE.Texture();
    this.material = new THREE.SpriteMaterial({
      map: base ? this.texture : null,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.material.fog = false;
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.frustumCulled = false; // 大尺寸 billboard 避免被包围球误剔除
    this.sprite.visible = !!base; // 图集未加载时隐藏，避免抛错中断比赛
    this.setFrame(0);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const total = FRAME_COUNT / FPS;
    if (this.elapsed >= total) this.elapsed -= total;
    const frame = Math.floor(this.elapsed * FPS) % FRAME_COUNT;
    this.setFrame(frame);
  }

  private setFrame(index: number): void {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const t = this.texture;
    // flipY=true（默认）：上传后 v=0 对应原图底部行、v=1 对应原图顶部行。
    // 帧 i 位于第 row 行（图集顶部起），故其 v 区间为 [1-(row+1)/ROWS, 1-row/ROWS]。
    t.offset.set(col / COLS, 1 - (row + 1) / ROWS);
    t.repeat.set(1 / COLS, 1 / ROWS);
    t.updateMatrix();
  }

  dispose(): void {
    this.material.dispose();
    this.texture.dispose();
  }
}
