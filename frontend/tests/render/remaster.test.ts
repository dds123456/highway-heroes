import {beforeAll,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createDetailedBike} from '../../src/entities/DetailedMotorcycle';
import {createProp} from '../../src/render/PropModels';
import {createEnvironmentChunks} from '../../src/render/Environment';
import {createRoadChunks} from '../../src/render/Road';
import {TrackPath} from '../../src/math/TrackPath';
import {BIKES,TRACKS} from '../../src/core/constants';
beforeAll(()=>{
 const context=new Proxy({}, {get:()=>()=>{}});
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>context})});
});
function inspect(root:THREE.Object3D){
 let meshes=0,triangles=0;
 root.traverse(o=>{
  const m=o as THREE.Mesh;if(!m.isMesh)return;meshes++;
  const p=m.geometry.getAttribute('position');expect(p).toBeTruthy();
  for(const n of p.array)expect(Number.isFinite(n)).toBe(true);
  triangles+=(m.geometry.index?.count??p.count)/3;
  const materials=Array.isArray(m.material)?m.material:[m.material];
  for(const mat of materials)expect((mat as THREE.ShaderMaterial).isShaderMaterial).not.toBe(true);
 });
 return {meshes,triangles};
}
describe('Pacific Edition art kit',()=>{
 it.each(BIKES)('$form has finite geometry, separate animated wheels and bounded draw calls',bike=>{
  const m=createDetailedBike(bike.form,bike.colorways[0],null);
  expect(m.wheels).toHaveLength(2);expect(m.steering.children).toContain(m.wheels[1]);
  const info=inspect(m.root);expect(info.meshes).toBeLessThan(38);expect(info.triangles).toBeLessThan(80000);
  const b=new THREE.Box3().setFromObject(m.root),size=b.getSize(new THREE.Vector3());
  expect(size.z).toBeGreaterThan(1.8);expect(size.z).toBeLessThan(2.7);expect(b.min.y).toBeGreaterThan(-.03);
 });
 it.each(['missile','shield','boost','mine'] as const)('%s is a real lit 3D pickup',kind=>{
  const model=createProp(kind);expect(inspect(model).triangles).toBeGreaterThan(100);
  expect(model.children.some(c=>(c as THREE.Sprite).isSprite)).toBe(false);
 });
 it('road UVs have no backwards repetition across segment boundaries',()=>{
  const chunks=createRoadChunks(new TrackPath('meadow'),TRACKS[0]);
  expect(chunks).toHaveLength(24);
  for(const chunk of chunks){
   const asphalt=chunk.group.children[2] as THREE.Mesh;
   const uv=asphalt.geometry.getAttribute('uv');
   for(let i=2;i<uv.count;i+=2)expect(uv.getX(i)).toBeGreaterThan(uv.getX(i-2));
   expect(asphalt.receiveShadow).toBe(true);
  }
 });
 it('scenery batches are finite and never overrun instance buffers',()=>{
  const chunks=createEnvironmentChunks(new TrackPath('meadow'),TRACKS[0]);
  expect(chunks).toHaveLength(24);
  for(const chunk of chunks){
   expect(chunk.group.children.length).toBeGreaterThan(5);expect(chunk.group.children.length).toBeLessThan(28);
   chunk.group.traverse(o=>{const m=o as THREE.InstancedMesh;if(m.isInstancedMesh)expect(m.count).toBeLessThanOrEqual(m.instanceMatrix.count);});
   chunk.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.computeBoundingBox();expect(Number.isFinite(m.geometry.boundingBox!.max.x)).toBe(true);}});
  }
 },20000);
});

