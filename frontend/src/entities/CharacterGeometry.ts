import * as THREE from 'three';
import {mesh,tube} from '../render/Art';
import {SKIN_TONES,HAIR_COLORS,EYE_COLORS,resolvedFace} from '../settings/CharacterStore';
import type {CharacterProfile} from '../settings/CharacterStore';

export type Ring = [y:number,rx:number,rz:number,z?:number];
function smoothSeam(g:THREE.BufferGeometry,segments:number,steps:number):void {
  const n=g.getAttribute('normal');const sum=new THREE.Vector3();
  for(let j=0;j<=steps;j++){const a=j*(segments+1),b=a+segments;sum.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,sum.x,sum.y,sum.z);n.setXYZ(b,sum.x,sum.y,sum.z);}
}
/** Smooth cross-section loft. Rings are physical dimensions, not scaled spheres. */
export function loft(rings:Ring[],segments=32,steps=40,folds=0):THREE.BufferGeometry {
  const curve=new THREE.CatmullRomCurve3(rings.map(r=>new THREE.Vector3(r[1],r[0],r[2])),false,'catmullrom',.25);
  const p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let j=0;j<=steps;j++){
    const v=j/steps,c=curve.getPoint(v);
    for(let i=0;i<=segments;i++){
      const u=i/segments,t=u*Math.PI*2;
      const crease=1+folds*Math.sin(v*58+t*2)*Math.pow(Math.sin(v*Math.PI),2);
      p.push(Math.sin(t)*Math.max(.0001,c.x)*crease,c.y,-Math.cos(t)*Math.max(.0001,c.z)*crease);
      uv.push(u,v);
      if(j<steps&&i<segments){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();smoothSeam(g,segments,steps);return g;
}
export function ellipsoid(parent:THREE.Object3D,material:THREE.Material,pos:number[],size:number[],name=''):THREE.Mesh{
  const g=new THREE.SphereGeometry(1,24,16);g.scale(size[0],size[1],size[2]);
  const m=mesh(parent,g,material,...pos as [number,number,number]);m.name=name;return m;
}
const gauss=(x:number,c:number,w:number)=>Math.exp(-(((x-c)/w)**2));
export function createCharacterHead(p:CharacterProfile):THREE.Group {
  const root=new THREE.Group();root.name='DetailedHead';
  const female=p.gender===1;
  const f=resolvedFace(p),width=(1+((f.FaceWidth??0)-(f.FaceNarrow??0))*.15)*(p.gender===1?.95:1),length=(1+(f.FaceLength??0)*.13)*(p.gender===1?.97:1);
  const noseWidth=.75+(f.NoseWidth??.5)*.5,noseDepth=.7+(f.NoseProjection??.5)*.6,lipFullness=.65+(f.LipFullness??.5)*.7;
  const skin=new THREE.MeshPhysicalMaterial({color:SKIN_TONES[p.skin],roughness:.79,metalness:0,vertexColors:true});
  const plainSkin=skin.clone();plainSkin.vertexColors=false;
  const lip=new THREE.MeshStandardMaterial({color:new THREE.Color(SKIN_TONES[p.skin]).multiply(new THREE.Color('#b78581')),roughness:.65});
  const hair=new THREE.MeshStandardMaterial({color:HAIR_COLORS[p.hairColor],roughness:.95});
  const crevice=new THREE.MeshStandardMaterial({color:new THREE.Color(SKIN_TONES[p.skin]).multiplyScalar(.37),roughness:1});
  const rows:Ring[]=[[-.107,.012,.027],[-.093,.047,.063],[-.07,.074+(f.JawWidth??0)*.009,.073],[-.04,.084,.079],[0,.089+(f.CheekFullness??0)*.008,.082],[.045,.097,.085],[.085,.095,.087],[.125,.094,.089],[.16,.079,.078],[.188,.05,.053],[.202,.001,.001]];
  // Sculpt the jaw-to-cheek transition, not a uniform scale of the male head.
  if(female){rows[1][1]=.033;rows[2][1]=.057+(f.JawWidth??0)*.013;rows[3][1]=.071;rows[4][1]=.086+(f.CheekFullness??0)*.007;rows[5][1]=.092;}
  else {rows[1][1]=.040;rows[2][1]=.066+(f.JawWidth??0)*.012;rows[3][1]=.079;}
  for(const r of rows){if(r[0]<-.07)r[0]-=(f.ChinLength??0)*.012;if(r[0]>.10)r[0]+=(f.ForeheadHeight??0)*(r[0]-.1)*.18;}
  const headCurve=new THREE.CatmullRomCurve3(rows.map(r=>new THREE.Vector3(r[1],r[0],r[2])),false,'catmullrom',.25);
  const surface=(u:number,v:number):THREE.Vector3=>{
    const c=headCurve.getPoint(v),t=u*Math.PI*2,x=Math.sin(t)*c.x*width;
    const front=Math.max(0,Math.cos(t));let z=-Math.cos(t)*c.z;
    // Flatten the facial plane and sculpt the bridge, brow, cheek and chin into ONE surface.
    if(front>0){
      z=-Math.pow(front,.68)*c.z;
      z-=gauss(x,0,.010*noseWidth)*gauss(c.y,.032,.037)*.024*noseDepth;
      z-=gauss(x,0,.014*noseWidth)*gauss(c.y,.003,.013)*.018*noseDepth;
      z-=(gauss(x,.052,.025)+gauss(x,-.052,.025))*gauss(c.y,.018,.024)*(female?.006:.004);
      z-=gauss(x,0,.029)*gauss(c.y,-.036,.019)*.003;
      z-=(gauss(x,.038,.021)+gauss(x,-.038,.021))*gauss(c.y,.086,.012)*((female?.0025:.004)+(f.BrowDepth??0)*.004);
      z+=(gauss(x,.038,.021)+gauss(x,-.038,.021))*gauss(c.y,.06,.015)*.005;
      z-=gauss(x,0,.036)*gauss(c.y,-.084,.015)*.004;
    }
    return new THREE.Vector3(x,c.y*length,z);
  };
  const vertices:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=64;j++)for(let i=0;i<=64;i++){
    const v=j/64,u=i/64,q=surface(u,v);vertices.push(q.x,q.y,q.z);uv.push(u,v);
    const warm=.007*Math.sin(i*17+j*31),cheek=gauss(Math.abs(q.x),.06,.024)*gauss(q.y,0,.034);
    colors.push(1,.97-cheek*.04+warm,.945-cheek*.035+warm);
    if(j<64&&i<64){const a=j*65+i,b=a+65;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();smoothSeam(g,64,64);
  mesh(root,g,skin).name='Head_Contoured';
  const eyeY=.060*length,eyeX=.038*(1+(f.EyeRegionWidth??0)*.2)*width;
  const white=new THREE.MeshStandardMaterial({color:'#dbd6c9',roughness:.32});
  const iris=new THREE.MeshStandardMaterial({color:EYE_COLORS[p.eyes],roughness:.29});
  const pupil=new THREE.MeshStandardMaterial({color:'#101211',roughness:.14});
  for(const side of [-1,1]){
    const x=side*eyeX;
    ellipsoid(root,white,[x,eyeY,-.080],[.016,.0048,.0038],'Eye');
    ellipsoid(root,iris,[x,eyeY,-.0838],[.0048,.0047,.0009]);
    ellipsoid(root,pupil,[x,eyeY,-.0847],[.0019,.0023,.0004]);
    for(const upper of [-1,1]){
      const points=Array.from({length:13},(_,i)=>{const t=i/12;return [x+(t-.5)*.033,eyeY+Math.sin(t*Math.PI)*(upper===1?.0051:.0036)*upper+(t-.5)*side*.002,-.0835+Math.abs(t-.5)*.002];});
      tube(root,points,upper===1?.0020:.0015,plainSkin,16);
      if(upper===1)tube(root,points,.00065,hair,16);
    }
    tube(root,[[x-.017,eyeY+.020,-.080],[x-.008,eyeY+.024,-.083],[x+.008,eyeY+.022,-.083],[x+.018,eyeY+.017,-.078]],female?.0016:.0023,hair,12);
    // Outer helix, concha and lobe; ears remain attached as head width changes.
    if(!(female&&p.hair===1)){
      const ear=ellipsoid(root,plainSkin,[side*.097*width,.031,.007],[.016,.030,.017],'Ear');ear.rotation.z=side*-.11;
      ellipsoid(root,lip,[side*.109*width,.031,-.002],[.006,.016,.011]);
      ellipsoid(root,plainSkin,[side*.105*width,.013,-.008],[.008,.012,.009]);
    }
    ellipsoid(root,crevice,[side*.009*noseWidth,-.006*length,-.079-.025*noseDepth],[.0035*noseWidth,.0016,.002]);
  }
  const mouthW=.021*(1+(f.MouthRegionWidth??0)*.32),mouthY=-.038*length;
  for(const upper of [-1,1]){
    const points=Array.from({length:17},(_,i)=>{const t=i/16;return [(t*2-1)*mouthW,mouthY+Math.sin(t*Math.PI)*(.0026*upper)-gauss(t,.5,.12)*.0012,-.081-Math.sin(t*Math.PI)*.003];});
    tube(root,points,(upper===1?.0021:.0028)*lipFullness,lip,20);
  }
  tube(root,[[-mouthW,mouthY,-.082],[0,mouthY-.001,-.087],[mouthW,mouthY,-.082]],.00065,crevice,16);
  if(p.hair!==3){
    const hp:number[]=[],hi:number[]=[];
    for(let j=0;j<=22;j++)for(let i=0;i<=64;i++){
      const u=i/64,front=Math.max(0,Math.cos(u*Math.PI*2));
      const start=.56+front*.16,v=start+(1-start)*j/22,q=surface(u,Math.min(.999,v));
      const volume=p.hair===0?.002:p.hair===1?.009:.015;
      q.x*=1.04;q.z*=1.045;q.y+=volume*Math.sin(j/22*Math.PI/2);
      if(p.hair===1&&!female)q.x+=.009*Math.sin(j/22*Math.PI);
      hp.push(q.x,q.y,q.z);if(j<22&&i<64){const a=j*65+i,b=a+65;hi.push(a,b,a+1,b,b+1,a+1);}
    }
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));hg.setIndex(hi);hg.computeVertexNormals();smoothSeam(hg,64,22);mesh(root,hg,hair).name='Hair';
    // Small ridges follow scalp flow rather than a second oversized sphere.
    if(p.hair!==0)for(let i=0;i<18;i++){
      const u=(i/18),front=Math.max(0,Math.cos(u*Math.PI*2)),start=.57+front*.17;
      const points=Array.from({length:9},(_,j)=>{const v=j/8,q=surface(u,start+(.985-start)*v);const volume=p.hair===1?.009:.015;return [q.x*1.043+(p.hair===1&&!female?.009*Math.sin(v*Math.PI):0),q.y+volume*Math.sin(v*Math.PI/2)+.0004,q.z*1.049];});
      tube(root,points,.0011,hair,10);
    }
  }
  if(female && (p.hair===1||p.hair===2)){
    // One continuous hair curtain avoids the disconnected, rope-like lock silhouette.
    const hp:number[]=[],hi:number[]=[],steps=24,segments=64;
    for(let j=0;j<=steps;j++)for(let i=0;i<=segments;i++){
      const v=j/steps,angle=.90+i/segments*(Math.PI*2-1.8);
      const radius=.095+.009*Math.sin(v*Math.PI)-.002*v;
      const groove=.0007*Math.cos(angle*32)*Math.sin(v*Math.PI);
      const tip=p.hair===1?-.071:-.015;
      hp.push(Math.sin(angle)*(radius+groove)*width,.132+v*(tip-.132),-Math.cos(angle)*(radius+groove));
      if(j<steps&&i<segments){const a=j*(segments+1)+i,b=a+segments+1;hi.push(a,b,a+1,b,b+1,a+1);}
    }
    const curtain=new THREE.BufferGeometry();curtain.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));curtain.setIndex(hi);curtain.computeVertexNormals();
    const curtainMaterial=hair.clone();curtainMaterial.side=THREE.DoubleSide;
    mesh(root,curtain,curtainMaterial).name='Hair_Curtain';
    if(p.hair===2){
      const tail=mesh(root,loft([[-.24,.008,.010],[-.19,.022,.024],[-.10,.027,.026],[-.015,.030,.028],[.026,.023,.022]],20,26),hair,0,.025,.117);tail.rotation.x=-.14;tail.name='LowPonytail';
      const tie=new THREE.MeshStandardMaterial({color:'#202831',roughness:.85});
      const band=mesh(root,new THREE.TorusGeometry(.025,.004,6,20),tie,0,.022,.117);band.rotation.x=Math.PI/2;
    }
  }
  if(p.beard){
    const beardMat=new THREE.MeshStandardMaterial({color:HAIR_COLORS[p.hairColor],roughness:1});
    for(let i=0;i<110;i++){
      const t=i/109,angle=(t-.5)*2.6;
      const y=-.068+.025*Math.sin(i*5.4),x=Math.sin(angle)*.074*width,z=-Math.pow(Math.cos(angle),.48)*.078-.002;
      ellipsoid(root,beardMat,[x,y*length,z],[.0016,p.beard===2?.006:.0017,.0012]);
    }
  }
  root.scale.setScalar(1+p.headSize*.06);root.scale.y*=.88;return root;
}
