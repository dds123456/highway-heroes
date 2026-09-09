export interface TargetRider{index:number;progress:number;finished:boolean;}
/** Physical road-relative direction, including the start-line seam; not leaderboard rank. */
export function selectMissileTarget(owner:TargetRider,riders:readonly TargetRider[],length:number):{index:number;dir:number}{
 let ahead=-1,behind=-1,frontDistance=Infinity,rearDistance=Infinity;
 for(const rider of riders){
  if(rider.index===owner.index||rider.finished)continue;
  let delta=((rider.progress-owner.progress)%length+length)%length;if(delta>length/2)delta-=length;
  if(delta>=0){if(delta<frontDistance){frontDistance=delta;ahead=rider.index;}}
  else if(-delta<rearDistance){rearDistance=-delta;behind=rider.index;}
 }
 return ahead>=0?{index:ahead,dir:1}:{index:behind,dir:-1};
}
