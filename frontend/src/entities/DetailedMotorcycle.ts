import * as THREE from 'three';
import type {BikeForm,Colorway} from '../core/constants';
import {box,mesh,tube,mat,bakeGroup,surfaceTexture,labelTexture} from '../render/Art';
import {makeWrapMaterial} from '../render/WrapMaterial';

export interface DetailedBike { root:THREE.Group; wheels:THREE.Group[]; steering:THREE.Group; }
export function createDetailedBike(form:BikeForm,c:Colorway,wrap:THREE.Texture|null):DetailedBike {
 const root=new THREE.Group();root.name='Pacific_'+form;
 const fixed=new THREE.Group();root.add(fixed);
 const steering=new THREE.Group();steering.position.set(0,.33,.79);root.add(steering);
 const sport=form==='flh',scrambler=form==='dt1';
 const paint=wrap?makeWrapMaterial(wrap):new THREE.MeshPhysicalMaterial({color:c.primary,roughness:.5,metalness:.25,clearcoat:.3,clearcoatRoughness:.4});
 const accent=mat(c.accent,.52,.22),rubber=mat('#17191b',.94),steel=mat('#9ca4a7',.32,.85);
 const dark=mat('#262b2f',.5,.62),chrome=mat('#c4cccd',.22,.95),brake=mat('#767c7c',.46,.8);
 const leather=mat(c.seat,.86);leather.map=surfaceTexture('leather','#a7a7a7');leather.bumpMap=leather.map;leather.bumpScale=.002;
 const red=new THREE.MeshStandardMaterial({color:'#9e1823',roughness:.32,emissive:'#b51316',emissiveIntensity:.5});
 const lamp=new THREE.MeshStandardMaterial({color:'#fff6d6',roughness:.18,metalness:.1,emissive:'#ffe1a6',emissiveIntensity:.7});
 const amber=new THREE.MeshStandardMaterial({color:'#cb7619',roughness:.4});
 const glass=new THREE.MeshPhysicalMaterial({color:'#41565e',roughness:.12,metalness:.25,transparent:true,opacity:.82,side:THREE.DoubleSide});
 const wheel=(front:boolean):THREE.Group=>{
  const w=new THREE.Group();w.name=front?'FrontWheel':'RearWheel';
  if(front)steering.add(w);else {w.position.set(0,.33,-.77);root.add(w);}
  const torus=mesh(w,new THREE.TorusGeometry(.255,.075,12,48),rubber);torus.rotation.y=Math.PI/2;torus.scale.z=front?.86:1.1;
  const rim=mesh(w,new THREE.TorusGeometry(.213,.024,8,40),chrome);rim.rotation.y=Math.PI/2;
  const hub=mesh(w,new THREE.CylinderGeometry(.055,.055,.19,16),dark);hub.rotation.z=Math.PI/2;
  for(const side of [-1,1]){
   const disc=mesh(w,new THREE.RingGeometry(.1,.183,32),brake,side*.09);disc.rotation.y=side*Math.PI/2;
   for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    const bolt=mesh(w,new THREE.SphereGeometry(.009,5,4),dark,side*.093,Math.sin(a)*.16,Math.cos(a)*.16);
    bolt.scale.x=.2;
   }
  }
  const n=sport?6:20;
  for(let i=0;i<n;i++){
   const a=i/n*Math.PI*2;
   tube(w,[[0,0,0],[sport?.008:0,Math.sin(a+.12)*.12,Math.cos(a+.12)*.12],[0,Math.sin(a)*.212,Math.cos(a)*.212]],sport?.014:.005,chrome,3);
  }
  for(let i=0;i<(scrambler?36:28);i++){
   const a=i/(scrambler?36:28)*Math.PI*2;
   for(const side of [-1,1]){
    const tread=box(w,[.058,scrambler?.015:.004,.039],[side*.031,Math.cos(a)*.327,Math.sin(a)*.327],rubber);
    tread.rotation.x=a;
   }
  }
  bakeGroup(w);return w;
 };
 const wheels=[wheel(false),wheel(true)];
 // Welded frame, engine cradle and triangulated swingarm.
 for(const side of [-1,1]){
  const x=side*.17;
  tube(fixed,[[x,.81,-.55],[x,.76,.4],[x,.3,.22],[x,.3,-.43],[x,.81,-.55]],.022,dark,16);
  tube(fixed,[[x,.33,-.77],[x,.4,-.2],[x,.57,-.28]],.022,dark,5);
  tube(fixed,[[side*.13,.87,.48],[side*.13,.53,.65],[side*.13,.34,.79]],.024,chrome,6);
  tube(fixed,[[side*.17,.38,-.67],[side*.17,.74,-.49]],.035,steel,4);
  for(let i=0;i<9;i++){
   const spring=mesh(fixed,new THREE.TorusGeometry(.044,.008,5,12),dark,side*.17,.44+i*.028,-.64+i*.014);
   spring.rotation.x=Math.PI/2-.43;
  }
  box(fixed,[.11,.035,.16],[side*.29,.35,-.16],rubber,.008);
 }
 // Crank case and individually visible cylinder cooling fins.
 const crank=mesh(fixed,new THREE.CylinderGeometry(.18,.18,.34,24),dark,0,.43,-.13);crank.rotation.z=Math.PI/2;
 for(const side of [-1,1]){
  const cover=mesh(fixed,new THREE.CylinderGeometry(.137,.146,.04,24),steel,side*.185,.43,-.13);cover.rotation.z=Math.PI/2;
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;const screw=mesh(fixed,new THREE.CylinderGeometry(.009,.009,.044,6),dark,side*.19,.43+Math.sin(a)*.115,-.13+Math.cos(a)*.115);screw.rotation.z=Math.PI/2;
  }
 }
 for(let row=0;row<2;row++){
  const engine=new THREE.Group();engine.position.set(0,.55,.08+row*.14);engine.rotation.x=-.15;fixed.add(engine);
  for(let i=0;i<7;i++)box(engine,[.32,.018,.15],[0,i*.026,0],i%2?steel:dark,.006);
 }
 for(const side of [-1,1]){
  tube(fixed,[[side*.09,.64,.28],[side*.1,.39,.39],[side*.2,.25,.21],[side*.25,.27,-.49]],.023,chrome,18);
 }
 const exhaust=mesh(fixed,new THREE.CylinderGeometry(.065,.048,.57,20),steel,.26,scrambler?.68:.31,-.51);
 exhaust.rotation.x=Math.PI/2;
 const exhaustTip=mesh(fixed,new THREE.CylinderGeometry(.043,.043,.016,20),rubber,.26,scrambler?.68:.31,-.805);exhaustTip.rotation.x=Math.PI/2;
 // Smooth shaped tank with fuel cap and trim. Part separation supports future wraps.
 const tank=mesh(fixed,new THREE.SphereGeometry(1,32,20),paint,0,.91,.16);tank.scale.set(sport?.255:.235,.17,sport?.34:.31);tank.name='Paint_FuelTank';
 const cap=mesh(fixed,new THREE.CylinderGeometry(.043,.043,.012,20),chrome,0,1.077,.18);
 cap.rotation.x=-.05;
 box(fixed,[.032,.015,.39],[0,1.067,.14],accent,.008);
 const seatHeight=scrambler?.93:.85;
 box(fixed,[.36,.09,scrambler?.62:.47],[0,seatHeight,-.36],leather,.045);
 for(let i=0;i<8;i++)box(fixed,[.31,.002,.007],[0,seatHeight+.046,-.53+i*.048],dark,.002);
 const tail=mesh(fixed,new THREE.SphereGeometry(1,24,14),paint,0,seatHeight-.015,-.67);tail.scale.set(.19,.11,.2);
 box(fixed,[.19,.045,.035],[0,seatHeight,-.82],red,.014);
 // Mudguards have actual curvature rather than enclosing wheels.
 for(const z of [.79,-.77]){
  const fender=mesh(fixed,new THREE.TorusGeometry(.35,.035,8,32,Math.PI*.83),paint,0,.33,z);
  fender.rotation.set(0,Math.PI/2,Math.PI*.08);fender.scale.z=2.8;
 }
 tube(fixed,[[0,.84,.45],[0,1.03,.5]],.027,dark,3);
 tube(fixed,[[-.37,1.06,.5],[-.23,1.06,.47],[0,1.02,.49],[.23,1.06,.47],[.37,1.06,.5]],.014,chrome,8);
 for(const side of [-1,1]){
  const grip=mesh(fixed,new THREE.CylinderGeometry(.025,.025,.13,12),rubber,side*.32,1.06,.5);grip.rotation.z=Math.PI/2;
  const peg=mesh(fixed,new THREE.CylinderGeometry(.018,.018,.13,12),rubber,side*.25,.415,-.10);peg.rotation.z=Math.PI/2;
  tube(fixed,[[side*.27,1.07,.52],[side*.35,1.23,.56]],.009,steel,3);
  const mirror=mesh(fixed,new THREE.SphereGeometry(1,16,10),glass,side*.36,1.24,.56);mirror.scale.set(.072,.04,.018);
  const signal=mesh(fixed,new THREE.SphereGeometry(1,12,8),amber,side*.24,.83,.61);signal.scale.set(.025,.026,.045);
 }
 const gauge=mesh(fixed,new THREE.CylinderGeometry(.065,.065,.03,20),dark,0,1.035,.42);gauge.rotation.x=-.5;
 const gaugeFace=mesh(fixed,new THREE.CircleGeometry(.053,24),mat('#d9dacc',.65),0,1.052,.409);gaugeFace.rotation.x=-Math.PI/2-.5;
 if(sport){
  // A sectional sport fairing: side cheeks, belly pan and a swept windscreen.
  for(const side of [-1,1]){
   const sh=new THREE.Shape();sh.moveTo(-.48,.35);sh.lineTo(-.32,.88);sh.lineTo(.28,1.02);sh.lineTo(.52,.83);sh.lineTo(.18,.56);sh.lineTo(-.18,.32);sh.closePath();
   const panel=mesh(fixed,new THREE.ExtrudeGeometry(sh,{depth:.032,bevelEnabled:true,bevelThickness:.022,bevelSize:.025,bevelSegments:2,steps:1}),paint,side*.265,0,.25);
   panel.rotation.y=-Math.PI/2;panel.scale.z=-side;
   for(let i=0;i<3;i++)box(fixed,[.012,.023,.14],[side*.291,.63+i*.045,.2],dark,.004);
  }
  box(fixed,[.42,.17,.7],[0,.31,.03],paint,.06);
  const nose=mesh(fixed,new THREE.SphereGeometry(1,28,18),paint,0,.93,.68);nose.scale.set(.26,.17,.22);
  const wind=mesh(fixed,new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.5),glass,0,1.08,.59);wind.scale.set(.205,.24,.14);wind.rotation.x=.4;
  for(const side of [-1,1])box(fixed,[.14,.04,.03],[side*.135,.946,.878],lamp,.015);
 }else{
  const housing=mesh(fixed,new THREE.CylinderGeometry(.115,.105,.14,24),dark,0,.95,.68);housing.rotation.x=Math.PI/2;
  const rim=mesh(fixed,new THREE.TorusGeometry(.111,.012,8,24),chrome,0,.95,.757);
  void rim;
  const lens=mesh(fixed,new THREE.CircleGeometry(.102,32),lamp,0,.95,.764);
  void lens;
  if(scrambler){
   box(fixed,[.39,.06,.42],[0,.8,.68],paint,.025);
   for(let i=-2;i<=2;i++)box(fixed,[.19,.007,.012],[0,.95+i*.031,.77],dark);
  }
 }
 // Number and identity plates are real attached body parts, never floating over tires.
 const numberMat=new THREE.MeshStandardMaterial({map:labelTexture('88','玉鑫1号','#191d20'),roughness:.72});
 for(const side of [-1,1]){
  const plate=box(fixed,[.016,.19,.31],[side*.202,.72,-.4],dark,.012);
  void plate;
  const decal=mesh(fixed,new THREE.PlaneGeometry(.29,.16),numberMat,side*.213,.725,-.4);decal.rotation.y=side*Math.PI/2;
 }
 const license=mesh(fixed,new THREE.PlaneGeometry(.18,.072),new THREE.MeshStandardMaterial({map:labelTexture('YX • 88','PACIFIC','#ded8ba','#1b2023'),roughness:.8}),0,.66,-.87);license.rotation.y=Math.PI;
 bakeGroup(fixed);
 return {root,wheels,steering};
}
