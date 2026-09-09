import * as THREE from 'three';
import type {ItemKind} from '../core/constants';
import {mat,mesh,box,tube,bakeGroup,labelTexture} from './Art';
export function createProp(kind:ItemKind):THREE.Group {
 const g=new THREE.Group();g.name='Pickup_'+kind;
 const dark=mat('#293334',.65,.5),metal=mat('#a9afb0',.35,.8),amber=mat('#bfa05b',.5,.35);
 const blue=mat('#355364',.55,.4),white=mat('#c9c7b9',.8);
 if(kind==='boost'){
  mesh(g,new THREE.CylinderGeometry(.14,.14,.58,24),blue);
  for(const y of [-.29,.29])mesh(g,new THREE.SphereGeometry(.14,20,12),blue,0,y).scale.y=.4;
  for(const y of [-.17,.17])mesh(g,new THREE.TorusGeometry(.144,.016,6,24),metal,0,y).rotation.x=Math.PI/2;
  mesh(g,new THREE.CylinderGeometry(.035,.035,.1,12),metal,0,.38);
  mesh(g,new THREE.TorusGeometry(.067,.012,6,16),amber,0,.445).rotation.x=Math.PI/2;
  const badge=mesh(g,new THREE.PlaneGeometry(.22,.15),new THREE.MeshStandardMaterial({map:labelTexture('N₂O','NITRO','#d3cdba','#263438'),roughness:.8}),0,0,.143);void badge;
 }else if(kind==='missile'){
  g.name='GuidedMissile';
  mesh(g,new THREE.CylinderGeometry(.105,.105,.92,28),white,0,.04).name='LongFuselage';
  mesh(g,new THREE.ConeGeometry(.105,.34,28),dark,0,.67).name='PointedNose';
  mesh(g,new THREE.CylinderGeometry(.086,.112,.14,24,1,true),metal,0,-.48).name='ExhaustNozzle';
  mesh(g,new THREE.CylinderGeometry(.066,.066,.018,20),dark,0,-.535);
  for(let i=0;i<4;i++){
   const shape=new THREE.Shape();shape.moveTo(.08,-.44);shape.lineTo(.30,-.46);shape.lineTo(.29,-.32);shape.lineTo(.10,-.12);shape.closePath();
   const fin=mesh(g,new THREE.ExtrudeGeometry(shape,{depth:.017,bevelEnabled:false}),dark);fin.rotation.y=i*Math.PI/2;fin.name='SweptTailFin';
   const fore=box(g,[.10,.13,.012],[0,.20,0],metal);fore.position.x=Math.cos(i*Math.PI/2)*.115;fore.position.z=-Math.sin(i*Math.PI/2)*.115;fore.rotation.y=i*Math.PI/2;
  }
  for(const y of [.40,-.23])mesh(g,new THREE.CylinderGeometry(.108,.108,.035,28),amber,0,y);
  const stencil=mesh(g,new THREE.PlaneGeometry(.13,.25),new THREE.MeshStandardMaterial({map:labelTexture('88','GUIDED','#d6d8d2','#29353c'),roughness:.72}),0,.03,.107);stencil.name='MissileStencil';
 }else if(kind==='mine'){
  mesh(g,new THREE.CylinderGeometry(.29,.33,.11,32),dark,0,-.05);
  mesh(g,new THREE.CylinderGeometry(.22,.28,.06,32),metal,0,.035);
  mesh(g,new THREE.CylinderGeometry(.17,.19,.025,24),amber,0,.08);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;mesh(g,new THREE.CylinderGeometry(.013,.013,.015,6),dark,Math.cos(a)*.25,.07,Math.sin(a)*.25);}
  box(g,[.045,.02,.04],[0,.107,0],new THREE.MeshStandardMaterial({color:'#9a201a',emissive:'#a32219',emissiveIntensity:.7}));
 }else{
  const s=new THREE.Shape();s.moveTo(-.27,.32);s.lineTo(.27,.32);s.lineTo(.25,-.1);s.quadraticCurveTo(.16,-.32,0,-.4);s.quadraticCurveTo(-.16,-.32,-.25,-.1);s.closePath();
  mesh(g,new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2}),blue);
  box(g,[.38,.075,.015],[0,.21,.075],metal,.008);
  box(g,[.03,.26,.012],[0,-.01,.075],amber,.004);
  tube(g,[[-.13,.15,-.03],[-.13,.15,-.12],[.13,.15,-.12],[.13,.15,-.03]],.018,dark,6);
 }
 bakeGroup(g);if(kind==='missile')g.userData.components={fuselage:1,nose:1,tailFins:4,nozzle:1};return g;
}
