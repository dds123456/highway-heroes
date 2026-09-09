import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {box,mesh,mat,surfaceTexture,labelTexture} from '../render/Art';
import type {RiderSuitColors} from './CharacterAsset';
/** Equipment follows the existing articulated skeleton; face morphs are preserved underneath. */
export function equipRider(bones:Record<string,THREE.Bone>,parts:THREE.Mesh[],colors:RiderSuitColors):void{
 const fabric=surfaceTexture('leather','#a2a2a2');
 for(const p of parts){
  const m=p.material as THREE.MeshPhysicalMaterial;
  if(/Torso|Pelvis|Arm|Thigh|Shin|Boot|Hand/.test(p.name)){m.map=fabric;m.bumpMap=fabric;m.bumpScale=.001;m.roughness=.88;}
  if(p.name.startsWith('Print88_')||p.name==='Chest_Cream_Panel'||p.name==='Red_Center_Stripe')p.visible=false;
  if(p.name==='Torso'){
   p.geometry.dispose();
   p.geometry=new THREE.LatheGeometry([[0,-.31],[.125,-.31],[.15,-.27],[.17,-.1],[.185,.12],[.205,.24],[.18,.3],[.1,.32],[0,.32]].map(([r,y])=>new THREE.Vector2(r,y)),24);
   p.geometry.scale(1,1,.75);p.position.y=.1;
  }
  if(p.name.startsWith('Boot_')){
   p.geometry.dispose();p.geometry=new RoundedBoxGeometry(.15,.13,.29,3,.035);p.rotation.set(0,0,0);p.position.set(0,-.035,-.065);
   m.color.set('#25282a');
  }
  if(p.name.startsWith('Hand_')){m.color.set('#24272a');p.scale.multiplyScalar(.82);}
  if(p.name.startsWith('Knee_Red')){m.color.set('#353b3e');m.roughness=.52;}
 }
 const shell=new THREE.MeshPhysicalMaterial({color:colors.accent,roughness:.38,metalness:.12,clearcoat:.5});
 const trim=mat('#252a2d',.7),zip=mat('#959a94',.45,.6);
 mesh(bones.neck,new THREE.CapsuleGeometry(.067,.12,5,12),trim,0,-.045,0);
 mesh(bones.chest,new THREE.CylinderGeometry(.095,.11,.09,16),trim,0,.205,0);
 const visor=new THREE.MeshPhysicalMaterial({color:'#20313c',metalness:.45,roughness:.15,transparent:true,opacity:.96,side:THREE.DoubleSide});
 const helmetGroup=new THREE.Group();bones.head.add(helmetGroup);helmetGroup.name='ProtectiveHelmet';
 const helmet=mesh(helmetGroup,new THREE.SphereGeometry(1,32,24),shell,0,.073,.008);helmet.scale.set(.168,.205,.165);
 // Visor follows the curved front of the shell (-Z in source coordinates).
 const glass=mesh(helmetGroup,new THREE.SphereGeometry(1,28,12,Math.PI*.08,Math.PI*.84,Math.PI*.29,Math.PI*.27),visor,0,.076,.008);
 glass.rotation.y=Math.PI;glass.scale.set(.176,.21,.179);
 const chin=box(helmetGroup,[.24,.07,.12],[0,-.049,-.13],shell,.025);
 void chin;
 for(let i=-2;i<=2;i++)box(helmetGroup,[.018,.012,.01],[i*.033,-.047,-.194],trim,.003);
 for(const side of [-1,1]){
  const pivot=mesh(helmetGroup,new THREE.CylinderGeometry(.022,.022,.01,16),zip,side*.171,.09,0);pivot.rotation.z=Math.PI/2;
 }
 box(bones.chest,[.007,.29,.012],[0,.08,-.15],zip,.003);
 for(const side of [-1,1]){
  const pad=box(bones['upper_arm'+(side===1?'L':'R')],[.12,.11,.16],[side*.075,.014,0],trim,.035);void pad;
  box(bones.chest,[.095,.055,.012],[side*.11,.17,-.15],trim,.01);
  box(bones['foot'+(side===1?'L':'R')],[.157,.026,.29],[0,-.1,-.065],trim,.015);
 }
 // Embossed back patch and reflective seam, designed to read from the chase camera.
 box(bones.chest,[.28,.018,.01],[0,.18,.154],zip,.004);
 const patch=mesh(bones.chest,new THREE.PlaneGeometry(.19,.12),new THREE.MeshStandardMaterial({map:labelTexture('88','玉鑫1号','#262c2e'),roughness:.92}),0,.075,.151);
 void patch;
 helmetGroup.traverse(o=>{if((o as THREE.Mesh).isMesh)parts.push(o as THREE.Mesh);});
}
