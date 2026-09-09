import {beforeAll,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {CharacterStore,defaultCharacter,normalizeCharacter,randomCharacter,resolvedFace} from '../../src/settings/CharacterStore';
import {createCharacterBody} from '../../src/entities/CharacterBody';
import {createCharacterHead} from '../../src/entities/CharacterGeometry';
import {solveLimb} from '../../src/entities/RiderIK';
import {RiderModel} from '../../src/entities/Rider';
import {characterStore} from '../../src/settings/CharacterStore';
import {BIKES,RIDERS} from '../../src/core/constants';
beforeAll(()=>{const ctx=new Proxy({},{get:()=>()=>{}});vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});});
const colors={suit:'#333333',panel:'#555555',accent:'#993333'};
describe('Character profile',()=>{
 it('clamps non-finite and unknown data without corrupting defaults',()=>{
  const p=normalizeCharacter({height:Infinity,waist:-99,skin:100,hair:NaN,face:{width:1e8,JawWidth:'oops'}});
  expect(p.height).toBe(178);expect(p.waist).toBe(-1);expect(p.skin).toBe(5);expect(p.hair).toBe(1);expect(p.face.width).toBe(1);expect(p.face.JawWidth).toBe(.12);
 });
 it('migrates hh.face and keeps drafts isolated until save',()=>{
  const map=new Map([['hh.face',JSON.stringify({width:.8})]]),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
  const s=new CharacterStore(storage),draft=s.get();expect(draft.face.width).toBe(.8);draft.height=190;
  expect(s.get().height).toBe(178);expect(map.has('hh.character.v1')).toBe(false);
  expect(s.save(draft)).toBe(true);expect(new CharacterStore(storage).get().height).toBe(190);
 });
 it('handles corrupt and unavailable storage',()=>{
  expect(new CharacterStore({getItem:()=>'{',setItem:()=>{}}).get().height).toBe(178);
  const s=new CharacterStore(null);expect(s.save(defaultCharacter())).toBe(false);
 });
 it('shape blending changes anatomy and leaves the source profile unchanged',()=>{
  const p=defaultCharacter(),copy=structuredClone(p),a=resolvedFace(p);p.resemblance=1;
  expect(resolvedFace(p).JawWidth).not.toBe(a.JawWidth);expect(copy.face).toEqual(p.face);
 });
 it('random profiles remain valid',()=>{for(let i=0;i<20;i++){const p=randomCharacter();expect(normalizeCharacter(p)).toEqual(p);}});
});
describe('Full-body anatomy',()=>{
 it.each([1,2])('female hairstyle %s has a continuous finite hair surface within render budget',hair=>{
  const body=createCharacterBody({...defaultCharacter(),gender:1,hair},colors);body.stand();
  // Body rendering batches material meshes, so inspect named parts before batching.
  const head=createCharacterHead({...defaultCharacter(),gender:1,hair});
  expect(head.getObjectByName('Hair_Curtain')).toBeDefined();
  expect(Boolean(head.getObjectByName('LowPonytail'))).toBe(hair===2);
  head.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
  let triangles=0,draws=0;
  body.group.traverse(o=>{if(o instanceof THREE.Mesh){draws++;const p=o.geometry.getAttribute('position');for(const v of p.array)if(!Number.isFinite(v))throw Error('Invalid female vertex');triangles+=(o.geometry.index?.count??p.count)/3;}});
  expect(triangles).toBeLessThan(80000);expect(draws).toBeLessThan(90);body.dispose();
 });
 it.each([0,1])('outfit %s has finite geometry, 17 articulating bones and bounded budget',outfit=>{
  const body=createCharacterBody({...defaultCharacter(),outfit},colors);body.stand();
  expect(Object.keys(body.bones)).toHaveLength(17);
  let triangles=0,draws=0;body.group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;draws++;const p=m.geometry.getAttribute('position');for(const v of p.array)if(!Number.isFinite(v))throw Error('Invalid vertex');triangles+=(m.geometry.index?.count??p.count)/3;});
  expect(triangles).toBeGreaterThan(15000);expect(triangles).toBeLessThan(75000);expect(draws).toBeLessThan(85);
  const bounds=new THREE.Box3().setFromObject(body.group),size=bounds.getSize(new THREE.Vector3());expect(size.y).toBeGreaterThan(1.65);expect(size.y).toBeLessThan(1.95);expect(bounds.min.y).toBeGreaterThan(-.04);
  body.dispose();
 });
 it('height, shoulders and legs change geometry and seat anchoring',()=>{
  const a=createCharacterBody(defaultCharacter(),colors),b=createCharacterBody({...defaultCharacter(),height:190,shoulders:1,legLength:1},colors);
  expect(b.hipHeight).toBeGreaterThan(a.hipHeight);expect(b.bones.upper_armL.position.x).toBeGreaterThan(a.bones.upper_armL.position.x);expect(b.bones.shinL.position.length()).toBeGreaterThan(a.bones.shinL.position.length());a.dispose();b.dispose();
 });
 it('IK places a reachable wrist on its target under scaled parent transforms',()=>{
  const body=createCharacterBody({...defaultCharacter(),height:190},colors);body.group.rotation.y=.4;body.group.position.set(3,1,-2);body.group.updateMatrixWorld(true);
  const u=body.bones.upper_armL,l=body.bones.lower_armL,e=body.bones.handL;
  const root=u.getWorldPosition(new THREE.Vector3()),target=root.clone().add(new THREE.Vector3(.2,-.2,-.2));
  solveLimb(u,l,e,target,root.clone().add(new THREE.Vector3(.4,-.4,.2)));
  expect(e.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(.0001);body.dispose();
 });
 it.each(BIKES)('$form keeps short and tall riders mounted with bounded grip error',bike=>{
  const saved=characterStore.get();
  try{for(const gender of [0,1])for(const height of [165,190]){
    characterStore.save({...defaultCharacter(),gender,height,armLength:-1,legLength:1});
    const rider=new RiderModel(RIDERS[0],bike.form);rider.group.updateMatrixWorld(true);
    const wrist=rider.group.getObjectByName('handL')!.getWorldPosition(new THREE.Vector3());
    const error=wrist.distanceTo(new THREE.Vector3(-.32,1.07,.445));
    expect(error).toBeLessThan(.04);
    const foot=rider.group.getObjectByName('footL')!.getWorldPosition(new THREE.Vector3());expect(foot.distanceTo(new THREE.Vector3(-.23,.44,-.1))).toBeLessThan(.005);
  }}finally{characterStore.save(saved);}
 });
});
