import * as THREE from 'three';
import {createProp} from '../render/PropModels';
import {disposeObject} from '../render/Art';
import {halo,signalMaterial,SIGNAL_COLORS} from '../render/VisibilityFX';
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

/** Compatibility facade: pickups are lit, volumetric geometry instead of GIF billboards. */
export class ItemSprite {
 readonly sprite=new THREE.Group();
 private model:THREE.Group;private glow:THREE.Sprite;private ring:THREE.Mesh;private time=0;
 constructor(kind:ItemKind){
  this.model=createProp(kind);if(kind==='missile'){this.model.scale.setScalar(.76);this.model.rotation.z=-.40;}
  this.glow=halo(SIGNAL_COLORS[kind],1.65,.7);
  this.ring=new THREE.Mesh(new THREE.RingGeometry(.45,.51,48),signalMaterial(SIGNAL_COLORS[kind],.85));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=-.51;
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.095),signalMaterial('#efffff',.9));marker.position.y=.91;
  this.sprite.add(this.model,this.glow,this.ring,marker);this.sprite.name='ReadablePickup_'+kind;
 }
 update(dt:number):void{this.time+=dt;this.model.rotation.y+=dt*.65;const pulse=1+Math.sin(this.time*3)*.09;this.glow.scale.set(1.8*pulse,1.8*pulse,1);this.ring.scale.setScalar(pulse);}
 dispose():void{disposeObject(this.sprite);}
}
