import * as THREE from 'three';
/** Analytic two-bone IK in world space. Uniform avatar height scaling is included. */
export function solveLimb(upper:THREE.Bone,lower:THREE.Bone,end:THREE.Bone,target:THREE.Vector3,pole:THREE.Vector3):void {
  upper.updateWorldMatrix(true,true);
  const start=upper.getWorldPosition(new THREE.Vector3()),scale=upper.getWorldScale(new THREE.Vector3()).x;
  const l1=lower.position.length()*scale,l2=end.position.length()*scale;
  const direction=target.clone().sub(start),d=THREE.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);direction.normalize();
  const bend=pole.clone().sub(start);bend.addScaledVector(direction,-bend.dot(direction));
  if(bend.lengthSq()<1e-8)bend.set(0,1,0).addScaledVector(direction,-direction.y);bend.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),rise=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbow=start.clone().addScaledVector(direction,along).addScaledVector(bend,rise);
  const aim=(b:THREE.Bone,axis:THREE.Vector3,to:THREE.Vector3)=>{
    const world=b.getWorldPosition(new THREE.Vector3()),q=new THREE.Quaternion().setFromUnitVectors(axis.normalize(),to.clone().sub(world).normalize());
    const parent=b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();b.quaternion.copy(parent.multiply(q));b.updateWorldMatrix(false,true);
  };
  aim(upper,lower.position.clone(),elbow);
  aim(lower,end.position.clone(),start.clone().addScaledVector(direction,d));
}
