import * as THREE from 'three';
import {loft,ellipsoid,createCharacterHead} from './CharacterGeometry';
import {mesh,tube,box,mat,bakeGroup,disposeObject,surfaceTexture,labelTexture} from '../render/Art';
import {SKIN_TONES,OUTFIT_COLORS} from '../settings/CharacterStore';
import type {CharacterProfile} from '../settings/CharacterStore';
import type {RiderSuitColors} from './CharacterAsset';
import {createCyberHelmet} from './CyberHelmet';

export interface CharacterAnatomy {
  group:THREE.Group; bones:Record<string,THREE.Bone>; hipHeight:number;
  setHelmet(visible:boolean):void; stand():void; dispose():void;
}
/** Bone-local lofts with overlapping rounded joint volumes; no inherited nonuniform scale. */
export function createCharacterBody(p:CharacterProfile,colors:RiderSuitColors):CharacterAnatomy {
  const group=new THREE.Group();group.name='PacificCharacter';
  const bones:Record<string,THREE.Bone>={};
  const kits:THREE.Group[]=[];
  const bone=(name:string,parent:THREE.Object3D,x:number,y:number,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones[name]=b;return b;};
  const kit=(parent:THREE.Object3D)=>{const k=new THREE.Group();parent.add(k);kits.push(k);return k;};
  const female=p.gender===1;
  const h=1+p.legLength*.065,arm=1+p.armLength*.075,shoulder=(1+p.shoulders*.15)*(female?.92:1);
  const waist=(1+p.waist*.18)*(female?.86:1),hip=(1+p.hips*.15)*(female?1.14:1),muscle=(1+p.muscle*.2)*(female?.87:1);
  const hipHeight=.94+.83*(h-1),hips=bone('hips',group,0,hipHeight);
  const spine=bone('spine',hips,0,.10-.83*(h-1));
  const chest=bone('chest',spine,0,.24),neck=bone('neck',chest,0,.20),head=bone('head',neck,0,.11);
  const fabric=surfaceTexture('leather','#dededb');fabric.repeat.set(3,5);
  const jacket=new THREE.MeshStandardMaterial({color:OUTFIT_COLORS[p.outfitColor],roughness:p.outfit===0?.76:.96,map:fabric,bumpMap:fabric,bumpScale:.0007});
  const pants=new THREE.MeshStandardMaterial({color:'#30373e',roughness:.94,map:fabric,bumpMap:fabric,bumpScale:.0005});
  const seams=mat('#686b68',.95),trim=mat('#24282b',.85),metal=mat('#969c9c',.38,.7);
  const skin=new THREE.MeshPhysicalMaterial({color:SKIN_TONES[p.skin],roughness:.78});
  const torso=kit(spine);
  // Pelvis, waist, ribcage and sloping trapezius are visibly distinct cross sections.
  const torsoGeometry=loft([[-.14,.115*hip,.095],[-.10,.142*hip,.105],[-.01,.13*waist,.088*waist],[.08,.151*waist,.097*waist],[.22,.176*shoulder,.116*(1+p.chest*.15)],[.32,.192*shoulder,.108],[.37,.139*shoulder,.086],[.405,.060,.054],[.41,.001,.001]],36,48,p.outfit===0?.007:.015);
  if(female){
    const positions=torsoGeometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      if(z<0){const shape=(Math.exp(-Math.pow((x-.072)/.050,2))+Math.exp(-Math.pow((x+.072)/.050,2)))*Math.exp(-Math.pow((y-.235)/.059,2));positions.setZ(i,z-shape*.020*(1+p.chest*.2));}
    }
    torsoGeometry.computeVertexNormals();
  }
  mesh(torso,torsoGeometry,jacket).name='AnatomicalTorso';
  const pelvis=kit(hips);
  mesh(pelvis,loft([[-.14,.06,.055],[-.105,.15*hip,.101],[-.03,.155*hip,.106],[.03,.132*waist,.096],[.065,.122*waist,.09]],28,22),pants).name='ContouredPelvis';
  const neckKit=kit(neck);
  mesh(neckKit,loft([[-.09,.070,.057],[-.04,.051,.048],[.045,.045,.043],[.08,.058,.048]],24,20),skin).scale.x=(1+p.neckWidth*.16)*(female?.92:1);
  const headKit=createCharacterHead(p);head.add(headKit);kits.push(headKit);
  // Tailored details track the torso dimensions instead of floating flat chest blocks.
  if(p.outfit===0){
    tube(torso,[[0,-.10,-.108],[0,.1,-.103*waist],[0,.25,-.119*(1+p.chest*.15)],[0,.36,-.089]],.002,metal,24);
    box(torso,[.013,.023,.006],[0,.30,-.112],metal,.002);
    for(const side of [-1,1])tube(torso,[[side*.07,-.04,-.101],[side*.12,.04,-.097],[side*.13,.085,-.085]],.002,trim,14);
  }else{
    const collar=mesh(torso,new THREE.TorusGeometry(.06,.009,8,32),trim,0,.397,0);collar.rotation.x=Math.PI/2;
    for(const side of [-1,1])tube(torso,[[side*.065,.30,-.112],[side*.10,.28,-.111],[side*.13,.23,-.103]],.0012,seams,12);
  }
  const patch=mesh(torso,new THREE.PlaneGeometry(.12,.075),new THREE.MeshStandardMaterial({map:labelTexture('88','玉鑫1号','#343b42'),roughness:1}),0,.245,.119);patch.name='Rider88';
  for(const side of [-1,1]){
    const suffix=side===1?'L':'R';
    const upper=bone('upper_arm'+suffix,chest,side*.184*shoulder,.102);
    const lower=bone('lower_arm'+suffix,upper,side*.282*arm,0);
    const hand=bone('hand'+suffix,lower,side*.247*arm,0);
    const armKit=kit(upper),foreKit=kit(lower),handKit=kit(hand);
    if(female)handKit.scale.set(.91,.91,.91);
    const sleeve=mesh(armKit,loft([[-.034,.024,.027],[0,.067*muscle,.071*muscle],[.06*arm,.073*muscle,.069*muscle],[.16*arm,.058*muscle,.060*muscle],[.255*arm,.043,.044],[.292*arm,.039,.041]],24,28,.016),jacket);
    sleeve.rotation.z=-side*Math.PI/2;
    const fore=mesh(foreKit,loft([[-.028,.034,.035],[0,.043,.044],[.068*arm,.049*muscle,.049*muscle],[.145*arm,.037,.039],[.229*arm,.027,.030],[.257*arm,.026,.028]],24,28,.022),jacket);
    fore.rotation.z=-side*Math.PI/2;
    // Elbow reinforcement and wrist cuff give the joint a layered silhouette.
    ellipsoid(foreKit,trim,[side*.025,0,.037],[.050,.035,.012]);
    const cuff=mesh(foreKit,new THREE.CylinderGeometry(.029,.031,.025,24),trim,side*.237*arm,0,0);cuff.rotation.z=Math.PI/2;
    // Palm and five separate, three-section fingers, in a relaxed grip.
    ellipsoid(handKit,skin,[side*.030,0,0],[.038,.018,.037],'Palm');
    for(let finger=0;finger<4;finger++){
      const z=(finger-1.5)*.016,len=[.046,.053,.05,.039][finger];
      tube(handKit,[[side*.049,0,z],[side*(.049+len*.45),-.004,z],[side*(.049+len*.86),-.012,z],[side*(.049+len),-.024,z]],.0065,skin,12);
      ellipsoid(handKit,skin,[side*.053,0,z],[.010,.010,.008]);
    }
    tube(handKit,[[side*.015,-.002,-.030],[side*.030,-.015,-.048],[side*.050,-.022,-.045]],.009,skin,12);
    const thigh=bone('thigh'+suffix,hips,side*.092*hip,-.04);
    const shin=bone('shin'+suffix,thigh,0,-.43*h);
    const foot=bone('foot'+suffix,shin,0,-.40*h);
    const thighKit=kit(thigh),shinKit=kit(shin),footKit=kit(foot);
    mesh(thighKit,loft([[-.458*h,.044,.047],[-.42*h,.053,.058],[-.31*h,.067*muscle,.072*muscle],[-.14*h,.080*muscle,.088*muscle],[-.035,.088*hip,.095],[.045,.064,.07]],28,34,.012),pants).name='Thigh';
    mesh(shinKit,loft([[-.43*h,.030,.034],[-.38*h,.032,.039],[-.25*h,.041,.053],[-.12*h,.059*muscle,.067*muscle],[-.025,.051,.055],[.027,.040,.047]],24,30,.015),pants).name='Calf';
    ellipsoid(shinKit,trim,[0,-.005,-.050],[.044,.055,.019],'Knee');
    tube(thighKit,[[side*.085,-.05,.002],[side*.071,-.22*h,.002],[side*.052,-.4*h,.002]],.0014,seams,20);
    // Shaped instep, heel cup, toe box and layered outsole (not a rectangular block).
    ellipsoid(footKit,trim,[0,-.024,-.058],[.051,.040,.115],'Boot');
    mesh(footKit,loft([[-.036,.048,.06],[.005,.048,.053],[.066,.038,.040]],24,20),trim);
    const sole=ellipsoid(footKit,trim,[0,-.058,-.060],[.054,.011,.116]);sole.name='Outsole';
    for(let i=0;i<4;i++)tube(footKit,[[-.03,.004-i*.006,-.048-i*.015],[0,.012-i*.006,-.052-i*.015],[.03,.004-i*.006,-.048-i*.015]],.0015,seams,8);
  }
  // Each rigid bone attachment gets material batches, but bones themselves are NEVER merged.
  for(const k of kits)bakeGroup(k);
  const helmet=createCyberHelmet();head.add(helmet);helmet.scale.copy(headKit.scale);helmet.visible=false;
  group.scale.setScalar(p.height/178);
  const stand=()=>{
    for(const b of Object.values(bones))b.rotation.set(0,0,0);
    bones.upper_armL.rotation.z=-1.35;bones.upper_armR.rotation.z=1.35;
    bones.lower_armL.rotation.y=.12;bones.lower_armR.rotation.y=-.12;
    bones.spine.rotation.x=.025;
    bones.chest.rotation.y=.025;bones.head.rotation.y=-.025;
  };
  return {group,bones,hipHeight:hipHeight*p.height/178,stand,
    setHelmet:(visible)=>{helmet.visible=visible;headKit.visible=!visible;},
    dispose:()=>disposeObject(group)};
}
