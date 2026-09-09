import * as THREE from 'three';
import type {ItemKind} from '../core/constants';
export const SIGNAL_COLORS:Record<ItemKind,string>={missile:'#ffab55',shield:'#64bbff',boost:'#50edf1',mine:'#fb5796'};
let glowMap:THREE.DataTexture|null=null;
/** One shared radial falloff, not a full-screen bloom pass. Opaque geometry occludes it. */
export function radialGlowTexture():THREE.DataTexture {
 if(glowMap)return glowMap;
 const size=64,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2)),i=(y*size+x)*4;
  pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.pow(Math.max(0,1-r),2.1)*255);
 }
 glowMap=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);glowMap.needsUpdate=true;
 glowMap.magFilter=glowMap.minFilter=THREE.LinearFilter;glowMap.userData.persistent=true;return glowMap;
}
export function halo(color:string,size:number,opacity=.65):THREE.Sprite {
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:radialGlowTexture(),color,transparent:true,opacity,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false}));
 s.scale.set(size,size,1);s.name='VisibilityHalo';return s;
}
export function signalMaterial(color:string,opacity=.85):THREE.MeshBasicMaterial {
 return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
}
export interface ProjectileVisual {group:THREE.Group;update(time:number):void;}
export function addExhaust(group:THREE.Group):ProjectileVisual {
 const flameMat=signalMaterial('#ffbf62',.85),coreMat=signalMaterial('#e0ffff',.95),trailMat=signalMaterial('#80d9ff',.26);
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.12,.8,16),flameMat);flame.rotation.x=-Math.PI/2;flame.position.z=-1.08;group.add(flame);
 const core=new THREE.Mesh(new THREE.ConeGeometry(.055,.50,12),coreMat);core.rotation.x=-Math.PI/2;core.position.z=-.95;group.add(core);
 const plume=new THREE.Mesh(new THREE.CylinderGeometry(.10,.006,3.8,12,1,true),trailMat);plume.rotation.x=Math.PI/2;plume.position.z=-2.66;group.add(plume);
 const glow=halo('#ffb85b',1.3,.75);glow.position.z=-.74;group.add(glow);
 return {group,update(time){const pulse=.88+Math.sin(time*18)*.12;flame.scale.y=pulse;core.scale.y=1.15-pulse*.15;flameMat.opacity=.75+pulse*.15;glow.material.opacity=.55+pulse*.2;}};
}
