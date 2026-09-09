import * as THREE from 'three';
import {loft} from './CharacterGeometry';
import {mesh,box,tube,bakeGroup,labelTexture} from '../render/Art';
/** Forward is -Z. Faceted shell, swept crown rails and a recessed luminous visor. */
export function createCyberHelmet():THREE.Group{
 const g=new THREE.Group();g.name='ProtectiveHelmet';
 const shell=new THREE.MeshPhysicalMaterial({color:'#161c26',roughness:.58,metalness:.5,flatShading:true,clearcoat:.24});
 const armor=new THREE.MeshStandardMaterial({color:'#384352',roughness:.48,metalness:.62,flatShading:true});
 const black=new THREE.MeshStandardMaterial({color:'#080e17',roughness:.22,metalness:.55});
 const light=new THREE.MeshStandardMaterial({color:'#78f5ff',emissive:'#22dfff',emissiveIntensity:2.4,roughness:.25,toneMapped:false});
 const red=new THREE.MeshStandardMaterial({color:'#fb4166',emissive:'#ee1847',emissiveIntensity:1.3,toneMapped:false});
 mesh(g,loft([[-.083,.065,.084],[-.052,.111,.112],[.02,.128,.139],[.106,.121,.13],[.174,.093,.099],[.21,.035,.044],[.217,.001,.001]],12,14),shell).name='FacetedShell';
 // Angular wraparound eye band, built as a chamfered strip rather than a sphere visor.
 const strip=(y:number,height:number,material:THREE.Material)=>{
  const positions:number[]=[],ids:number[]=[];const points=[[-.12,-.061],[-.093,-.132],[0,-.151],[.093,-.132],[.12,-.061]];
  points.forEach(([x,z],i)=>{positions.push(x,y-height/2,z,x,y+height/2,z);if(i<4){const a=i*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setIndex(ids);geom.computeVertexNormals();material.side=THREE.DoubleSide;return mesh(g,geom,material);
 };
 strip(.066,.061,black).name='RecessedVisor';const eyeLine=strip(.073,.007,light);eyeLine.position.z=-.002;eyeLine.scale.x=1.005;eyeLine.name='CyanEyeLine';
 box(g,[.158,.046,.058],[0,-.044,-.125],armor,.008).rotation.x=-.16;
 for(const side of [-1,1]){
  const cheek=box(g,[.043,.082,.097],[side*.097,-.009,-.072],armor,.006);cheek.rotation.z=-side*.2;
  tube(g,[[side*.112,-.035,-.088],[side*.095,-.061,-.13],[side*.045,-.068,-.146]],.0025,light,5);
  tube(g,[[side*.056,.178,-.068],[side*.05,.205,.008],[side*.071,.162,.113]],.008,armor,6);
  tube(g,[[side*.056,.183,-.063],[side*.05,.210,.008],[side*.07,.168,.109]],.002,light,6);
  const hinge=mesh(g,new THREE.CylinderGeometry(.023,.023,.016,10),armor,side*.126,.045,0);hinge.rotation.z=Math.PI/2;
  for(let i=0;i<3;i++)box(g,[.028,.006,.007],[side*.042,-.037+i*.010,-.158],black,.001);
 }
 box(g,[.14,.016,.029],[0,.111,.133],armor,.003);box(g,[.095,.005,.006],[0,.114,.151],red,.001);
 mesh(g,new THREE.PlaneGeometry(.045,.022),new THREE.MeshStandardMaterial({map:labelTexture('88','YX-01','#18212b','#ddf7ff'),roughness:.7}),0,.145,-.116);
 bakeGroup(g);g.userData.design='CYBER YX-01';return g;
}
