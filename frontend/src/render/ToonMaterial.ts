import * as THREE from 'three';
export interface ToonMaterialOptions {
 color?: THREE.Color | string; map?: THREE.Texture | null; rimColor?: THREE.Color | null;
 rimPower?: number; gloss?: number; specular?: number; emissive?: THREE.Color | null;
 emissiveIntensity?: number; transparent?: boolean; opacity?: number; depthWrite?: boolean;
}
/** Compatibility API; all callers now receive physically based materials. */
export class ToonMaterial extends THREE.MeshPhysicalMaterial {
 constructor(o: ToonMaterialOptions = {}) {
  super({color:o.color??'#ffffff', map:o.map??null,
   roughness:THREE.MathUtils.clamp(.92-(o.specular??.25)*.55,.32,.96),metalness:0,
   emissive:o.emissive??new THREE.Color(0),emissiveIntensity:o.emissiveIntensity??0,
   transparent:o.transparent??false,opacity:o.opacity??1,depthWrite:o.depthWrite??true});
 }
}
export function makeToonMaterial(color:THREE.Color|string,options:ToonMaterialOptions={}):ToonMaterial {
 return new ToonMaterial({color,...options});
}
