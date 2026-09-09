import * as THREE from 'three';
export interface WrapMaterialOptions {
 wrapScale?:number; rimColor?:THREE.Color|string; rimPower?:number; specular?:number;
}
/** UV mapping is restricted to painted panels, never tires or mechanical parts. */
export class WrapMaterial extends THREE.MeshPhysicalMaterial {
 constructor(texture:THREE.Texture,_options:WrapMaterialOptions={}) {
  super({color:'#ffffff',map:texture,roughness:.64,metalness:.16,clearcoat:.12,clearcoatRoughness:.55});
 }
}
export function makeWrapMaterial(texture:THREE.Texture,options:WrapMaterialOptions={}):WrapMaterial {
 return new WrapMaterial(texture,options);
}
