import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Bake a static kit into one draw per material. Do not pass articulated roots. */
export function bakeGroup(root:THREE.Group):void {
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert();
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 root.traverse(o=>{
  const m=o as THREE.Mesh;if(!m.isMesh||Array.isArray(m.material))return;
  const g=m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));
  const non=g.index?g.toNonIndexed():g;
  if(non!==g)g.dispose();
  if(!non.getAttribute('uv'))non.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(non.getAttribute('position').count*2),2));
  const batch=batches.get(m.material)??[];batch.push(non);batches.set(m.material,batch);
  m.geometry.dispose();
 });
 root.clear();
 for(const [material,geometries] of batches){
  const merged=mergeGeometries(geometries,false);
  geometries.forEach(g=>g.dispose());
  if(merged)mesh(root,merged,material);
 }
}
export function rng(seed:number):()=>number {
 return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
export function surfaceTexture(kind:'asphalt'|'concrete'|'leather'|'ground',base='#777366'):THREE.CanvasTexture {
 const c=document.createElement('canvas'); c.width=c.height=256;
 const ctx=c.getContext('2d')!;ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
 const rand=rng(189+kind.length);
 for(let i=0;i<18000;i++){
  const v=rand()>.5?240:15;
  ctx.fillStyle='rgba('+v+','+v+','+v+','+(.03+rand()*.13)+')';
  const r=kind==='ground'?1+rand()*3:.3+rand()*1.2;
  ctx.fillRect(rand()*256,rand()*256,r,r);
 }
 if(kind==='asphalt'){
  ctx.strokeStyle='rgba(18,19,20,.2)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,100);
  for(let x=0;x<=256;x+=14)ctx.lineTo(x,100+Math.sin(x*.06)*9+rand()*6);
  ctx.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
}
export function mat(color:THREE.ColorRepresentation,roughness=.7,metalness=0):THREE.MeshStandardMaterial {
 return new THREE.MeshStandardMaterial({color,roughness,metalness});
}
export function mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0):THREE.Mesh {
 const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);
 m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function box(parent:THREE.Object3D,size:[number,number,number],pos:[number,number,number],material:THREE.Material,radius=0):THREE.Mesh {
 return mesh(parent,radius?new RoundedBoxGeometry(...size,2,radius):new THREE.BoxGeometry(...size),material,...pos);
}
export function tube(parent:THREE.Object3D,points:number[][],radius:number,material:THREE.Material,segments=12):THREE.Mesh {
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
 return mesh(parent,new THREE.TubeGeometry(curve,segments,radius,8,false),material);
}
export function labelTexture(title:string,subtitle:string,background='#184c3e',foreground='#f4f1e7'):THREE.CanvasTexture {
 const c=document.createElement('canvas');c.width=1024;c.height=384;
 const ctx=c.getContext('2d')!;ctx.fillStyle=background;ctx.fillRect(0,0,1024,384);
 ctx.strokeStyle=foreground;ctx.lineWidth=8;ctx.strokeRect(16,16,992,352);
 ctx.textAlign='center';ctx.fillStyle=foreground;ctx.font='600 82px Arial, Microsoft YaHei, sans-serif';
 ctx.fillText(title,512,164);ctx.font='38px Arial, Microsoft YaHei, sans-serif';ctx.fillText(subtitle,512,275);
 if(title==='88'){
  ctx.fillStyle=background;ctx.fillRect(28,28,968,328);ctx.fillStyle=foreground;
  ctx.font='bold 278px Bahnschrift, Arial, sans-serif';ctx.fillText(title,512,277);
  ctx.font='52px Microsoft YaHei, sans-serif';ctx.fillText(subtitle,512,350);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
export interface LightingRig {sun:THREE.DirectionalLight;dispose():void;}
/** Release instance-owned GPU resources while leaving optional cached wraps alive. */
export function disposeObject(root:THREE.Object3D):void {
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 root.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)for(const a of Array.isArray(m.material)?m.material:[m.material])materials.add(a);});
 for(const material of materials){
  for(const value of Object.values(material)){const t=value as THREE.Texture;if(t?.isTexture&&!t.userData.persistent)textures.add(t);}
  material.dispose();
 }
 for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();
}
export function configureLighting(scene:THREE.Scene,renderer:THREE.WebGLRenderer,showroom=false):LightingRig {
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const hemi=new THREE.HemisphereLight('#c1d9ee','#7b7261',showroom?1.6:1.8);
 const sun=new THREE.DirectionalLight('#fff0d5',showroom?3.5:3.1);
 sun.position.set(-35,65,30);sun.castShadow=true;
 const r=showroom?5:45;
 Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:1,far:180});
 sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;
 scene.add(hemi,sun,sun.target);
 const room=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);
 const env=pmrem.fromScene(room,.025);room.dispose();pmrem.dispose();
 scene.environment=env.texture;scene.environmentIntensity=showroom?.42:.25;
 return {sun,dispose:()=>{env.dispose();sun.shadow.dispose();scene.remove(hemi,sun,sun.target);}};
}
