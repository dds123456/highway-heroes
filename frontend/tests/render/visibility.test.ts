import {beforeAll,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {TrackPath} from '../../src/math/TrackPath';
import {createBoostPads,animatePads} from '../../src/render/RoadItems';
import {radialGlowTexture,halo,addExhaust} from '../../src/render/VisibilityFX';
import {createProp} from '../../src/render/PropModels';
import {ItemSystem} from '../../src/items/ItemSystem';
import {EventBus} from '../../src/core/events';
import type {BikeEntity} from '../../src/entities/BikeEntity';
beforeAll(()=>{const ctx=new Proxy({},{get:()=>()=>{}});vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});});
describe('Readable road interactions',()=>{
 it('shares a soft radial halo that respects opaque occlusion',()=>{
  const t=radialGlowTexture(),a=t.image.data!;expect(radialGlowTexture()).toBe(t);
  expect(a[3]).toBe(0);expect(a[(32*64+32)*4+3]).toBeGreaterThan(230);
  const s=halo('#ffffff',2);expect(s.material.depthTest).toBe(true);expect(s.material.depthWrite).toBe(false);
 });
 it('keeps flowing arrows above pad top and follows the road frame',()=>{
  const track=new TrackPath(),pads=createBoostPads(track,3),p=pads[0];
  expect(p.arrows).toHaveLength(4);for(const a of p.arrows)expect(a.position.y).toBeGreaterThan(.10);
  animatePads(pads,0);const z=p.arrows[0].position.z;animatePads(pads,.1);expect(p.arrows[0].position.z).toBeGreaterThan(z);
  expect(new THREE.Vector3(0,0,1).applyQuaternion(p.group.quaternion).dot(track.frameAt(p.progress).tangent)).toBeGreaterThan(.999);
 });
 it('uses an elongated finned missile and pulsing rear exhaust',()=>{
  const p=createProp('missile'),s=new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3());
  expect(s.y).toBeGreaterThan(s.x*2);expect(p.userData.components.tailFins).toBe(4);
  const g=new THREE.Group(),fx=addExhaust(g);expect(g.children.length).toBe(4);for(const c of g.children)expect(c.position.z).toBeLessThan(0);fx.update(.1);
  expect(g.children[0].scale.y).toBeGreaterThan(.7);
 });
 it('hides a collected pickup and launches actual guided geometry',()=>{
  const track=new TrackPath(),progress=track.length*.035;
  const bikes=[{index:0,progress,lateral:-5.5,speed:20,group:new THREE.Group(),finished:false},{index:1,progress:progress+100,lateral:0,speed:20,group:new THREE.Group(),finished:false}] as unknown as BikeEntity[];
  const system=new ItemSystem(track,bikes),bus=new EventBus();system.update(.016,1,bikes,track,bus,false);
  expect(system.getPlayerItem()).toBe('missile');const pickup=system.group.getObjectByName('ReadablePickup_missile')!;expect(pickup.visible).toBe(false);
  system.update(.016,1.1,bikes,track,bus,true);expect(system.getPlayerItem()).toBeNull();expect(system.group.getObjectByName('ActiveGuidedMissile')).toBeTruthy();
  bikes[0].progress=0;system.update(.016,6,bikes,track,bus,false);expect(pickup.visible).toBe(true);
  system.reset();expect(system.group.getObjectByName('ActiveGuidedMissile')).toBeUndefined();
 });
});
