/** Time-based showers: dry interval, gradual onset, sustained rain, gradual clearance. */
export class WeatherCycle {
  intensity=0;
  private remaining=0;
  private target=0;
  private wet=false;
  private forced:number|null=null;
  constructor(private random:()=>number=Math.random){this.reset();}
  reset():void{this.intensity=0;this.target=0;this.wet=false;this.forced=null;this.remaining=35+this.random()*40;}
  force(value:number|null):void{this.forced=value===null?null:Math.max(0,Math.min(1,value));}
  update(dt:number):number{
    if(!Number.isFinite(dt)||dt<=0)return this.intensity;
    if(this.forced===null){
      this.remaining-=dt;
      if(this.remaining<=0){this.wet=!this.wet;this.target=this.wet?.35+this.random()*.5:0;this.remaining=this.wet?30+this.random()*40:55+this.random()*65;}
    }
    const target=this.forced??this.target,step=dt/(target>this.intensity?18:24);
    this.intensity+=Math.max(-step,Math.min(step,target-this.intensity));
    return this.intensity;
  }
}
