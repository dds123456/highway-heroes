import {beforeAll,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {selectMissileTarget} from '../../src/items/MissileTarget';
import {defaultCharacter,normalizeCharacter,CharacterStore} from '../../src/settings/CharacterStore';
import {createCharacterBody} from '../../src/entities/CharacterBody';
import {createCyberHelmet} from '../../src/entities/CyberHelmet';
beforeAll(()=>{const ctx=new Proxy({},{get:()=>()=>{}});vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});});
const rider=(index:number,progress:number,finished=false)=>({index,progress,finished});
describe('Uniform front-first missile selection',()=>{
 it('prefers forward rider even when rear is closer',()=>{const a=rider(0,100);expect(selectMissileTarget(a,[a,rider(1,90),rider(2,180)],1000)).toEqual({index:2,dir:1});});
 it('falls back to nearest rear and skips finishers',()=>{const a=rider(0,100);expect(selectMissileTarget(a,[a,rider(1,160,true),rider(2,90),rider(3,50)],1000)).toEqual({index:2,dir:-1});});
 it('crosses start seam and applies the same rule to AI',()=>{const a=rider(2,990);expect(selectMissileTarget(a,[rider(0,980),a,rider(1,10)],1000)).toEqual({index:1,dir:1});});
 it('has no target when only finished opponents remain',()=>{const a=rider(0,100);expect(selectMissileTarget(a,[a,rider(1,140,true)],1000).index).toBe(-1);});
});
describe('Gender and cyber equipment',()=>{
 it('migrates old profiles and saves female appearance',()=>{expect(normalizeCharacter({}).gender).toBe(0);expect(normalizeCharacter({gender:99}).gender).toBe(0);const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};const s=new CharacterStore(storage);s.save({...defaultCharacter(),gender:1});expect(new CharacterStore(storage).get().gender).toBe(1);});
 it('changes full-body proportions without changing bone names or height',()=>{const colors={suit:'#333',panel:'#444',accent:'#555'},a=createCharacterBody(defaultCharacter(),colors),b=createCharacterBody({...defaultCharacter(),gender:1},colors);expect(b.bones.upper_armL.position.x).toBeLessThan(a.bones.upper_armL.position.x);expect(b.bones.thighL.position.x).toBeGreaterThan(a.bones.thighL.position.x);expect(Object.keys(b.bones)).toEqual(Object.keys(a.bones));expect(b.hipHeight).toBe(a.hipHeight);a.dispose();b.dispose();});
 it('builds a bounded finite faceted helmet with emissive parts',()=>{const g=createCyberHelmet();const size=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());expect(size.y).toBeGreaterThan(.25);expect(size.y).toBeLessThan(.4);let emissive=0;g.traverse(o=>{if(o instanceof THREE.Mesh){for(const v of o.geometry.attributes.position.array)expect(Number.isFinite(v)).toBe(true);const m=o.material as THREE.MeshStandardMaterial;if(m.emissiveIntensity>1)emissive++;}});expect(emissive).toBeGreaterThanOrEqual(2);});
});
