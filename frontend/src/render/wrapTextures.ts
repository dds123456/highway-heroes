import * as THREE from 'three';
import type { BikeForm } from '../core/constants';

/**
 * 车衣（vinyl wrap）纹理：加载用户提供的三套无缝 PNG 贴图（赛博/伏特蓝/落日条纹），
 * 与独立展示包一致。GLB 外壳无 UV，由 WrapMaterial 三平面采样包到车身上。
 *
 * 纹理在 boot 阶段通过 preloadWrapTextures 预加载，getWrapTexture 同步取缓存；
 * 未加载时抛错（正常流程下先预加载）。
 */
export interface WrapDef {
  name: string;
  tagline: string;
  accent: string;
}

export const WRAP_DEFS: Record<BikeForm, WrapDef> = {
  bonneville: { name: 'Cyber Matte 88', tagline: '赛博哑光 88', accent: '#d52a32' },
  dt1: { name: 'Sunset Classic 07', tagline: '落日经典 07', accent: '#ed8115' },
  flh: { name: 'Volt Division 27', tagline: '伏特联队 27', accent: '#176cff' },
};

const WRAP_FILES: Record<BikeForm, string> = {
  bonneville: 'textures/cafe-race-cyber-wrap.png',
  dt1: 'textures/yamaha-sunset-stripe-wrap.png',
  flh: 'textures/rs200-electric-blue-wrap.png',
};

const loader = new THREE.TextureLoader();
const cache = new Map<BikeForm, THREE.Texture>();
const pending = new Map<BikeForm, Promise<THREE.Texture>>();

function loadOne(form: BikeForm): Promise<THREE.Texture> {
  const hit = cache.get(form);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(form);
  if (inFlight) return inFlight;

  const p = loader
    .loadAsync(WRAP_FILES[form])
    .then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.persistent = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      cache.set(form, texture);
      pending.delete(form);
      return texture;
    })
    .catch((error) => {
      // 失败不缓存，下次可重试
      pending.delete(form);
      cache.delete(form);
      throw error;
    });
  pending.set(form, p);
  return p;
}

/** 预加载三辆车衣纹理（任一失败都会 reject） */
export function preloadWrapTextures(forms: BikeForm[] = ['bonneville', 'dt1', 'flh']): Promise<THREE.Texture[]> {
  return Promise.all(forms.map((form) => loadOne(form)));
}

/** 取某车型的车衣纹理（未加载会抛错；正常流程下先调 preloadWrapTextures） */
export function getWrapTexture(form: BikeForm): THREE.Texture {
  const texture = cache.get(form);
  if (!texture) throw new Error(`[wrapTextures] ${form} 车衣纹理尚未加载`);
  return texture;
}
