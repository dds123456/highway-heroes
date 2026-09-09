import {FaceScene} from './FaceScene';
import {FACE_SLIDERS} from '../settings/FaceStore';
import {characterStore,defaultCharacter,randomCharacter,FACE_BASES,BODY_SLIDERS,SKIN_TONES,HAIR_COLORS,EYE_COLORS,HAIR_STYLES,OUTFITS,OUTFIT_COLORS} from '../settings/CharacterStore';
import type {CharacterSection,CharacterProfile} from '../settings/CharacterStore';
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
export class CharacterEditor {
  readonly element=node('div','screen screen-face character-editor');
  private stage=node('div','character-stage');
  private controls=node('div','character-controls');
  private status=node('p','character-status');
  private profile=characterStore.get();
  private history:CharacterProfile[]=[];
  private previous=structuredClone(this.profile);
  private comparing=false;
  private compareButton!:HTMLButtonElement;
  private scene:FaceScene|null=null;
  private section:CharacterSection='heritage';
  private tabButtons:HTMLButtonElement[]=[];
  private viewButtons:HTMLButtonElement[]=[];
  private helmetButton!:HTMLButtonElement;
  private spinButton!:HTMLButtonElement;
  constructor(private close:()=>void){
    const header=node('header','character-header');
    const identity=node('div');identity.append(node('span','character-kicker','PACIFIC / CHARACTER STUDIO'),node('h1','','角色工作室'));
    header.append(identity,node('p','','从面部轮廓到全身比例，塑造你的公路车手。'));
    const layout=node('div','character-layout'),visual=node('section','character-visual');
    const top=node('div','character-viewbar');
    for(const [id,label] of [['full','全身'],['torso','上半身'],['face','头部']] as const){
      const b=this.button(label,()=>{this.scene?.setView(id);this.viewButtons.forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});
      b.setAttribute('aria-pressed',String(id==='full'));this.viewButtons.push(b);top.append(b);
    }
    const angles=node('div','character-anglebar');
    for(const [label,angle] of [['正面',0],['侧面',Math.PI/2],['背面',Math.PI]] as const)angles.append(this.button(label,()=>{this.scene?.setAngle(angle);this.spinButton.setAttribute('aria-pressed','false');}));
    this.spinButton=this.button('自动旋转',()=>{const on=this.spinButton.getAttribute('aria-pressed')!=='true';this.spinButton.setAttribute('aria-pressed',String(on));this.scene?.setSpin(on);});this.spinButton.setAttribute('aria-pressed','false');
    this.helmetButton=this.button('头盔预览',()=>{const on=this.helmetButton.getAttribute('aria-pressed')!=='true';this.helmetButton.setAttribute('aria-pressed',String(on));this.scene?.setHelmet(on);});this.helmetButton.setAttribute('aria-pressed','false');
    angles.append(this.spinButton,this.helmetButton);
    visual.append(top,this.stage,angles,node('p','character-tip','拖动人物旋转 · 外观参数不影响性能和碰撞'));
    const panel=node('section','character-panel'),tabs=node('div','character-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','角色定制分类');
    const definitions=[['heritage','01 基础脸型'],['face','02 五官'],['body','03 体型'],['style','04 外观']] as const;
    for(const [id,label] of definitions){
      const b=this.button(label,()=>{this.section=id;this.renderControls();this.updateTabs();this.scene?.setView(id==='body'?'full':id==='face'?'face':id==='heritage'?'face':'full');this.viewButtons.forEach(v=>v.setAttribute('aria-pressed',String(v.textContent===(id==='face'||id==='heritage'?'头部':'全身'))));});
      b.id='character-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls','character-fields');
      b.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=this.tabButtons.indexOf(b),next=this.tabButtons[(i+(e.key==='ArrowRight'?1:3))%4];next.click();next.focus();}});
      this.tabButtons.push(b);tabs.append(b);
    }
    this.controls.id='character-fields';this.controls.setAttribute('role','tabpanel');
    const actions=node('div','character-actions');actions.append(this.button('随机角色',()=>{this.profile=randomCharacter();this.renderControls();this.changed();}),this.button('恢复默认',()=>{this.profile=defaultCharacter();this.renderControls();this.changed();}));
    actions.append(this.button('撤销上一步',()=>{const p=this.history.pop();if(!p)return;this.profile=p;this.previous=structuredClone(p);this.comparing=false;this.compareButton.setAttribute('aria-pressed','false');this.renderControls();this.scene?.setAppearance(p);this.status.textContent='已撤销 · 尚未保存';}));
    this.compareButton=this.button('对比已保存',()=>{this.comparing=!this.comparing;this.compareButton.setAttribute('aria-pressed',String(this.comparing));this.scene?.setAppearance(this.comparing?characterStore.get():this.profile);this.status.textContent=this.comparing?'正在查看已保存角色 · 再点一次返回草稿':'已返回草稿 · 尚未保存';});this.compareButton.setAttribute('aria-pressed','false');actions.append(this.compareButton);
    const bottom=node('footer','character-footer');
    this.status.setAttribute('role','status');this.status.textContent='草稿模式 · 保存后同步到车库与比赛';
    const save=this.button('保存角色',()=>{if(characterStore.save(this.profile))this.close();else this.status.textContent='已应用到当前游戏，但浏览器禁止持久保存；关闭页面后可能丢失。';});save.classList.add('character-save');
    bottom.append(this.status,this.button('取消修改',()=>this.close()),save);
    panel.append(tabs,this.controls,actions);layout.append(visual,panel);this.element.append(header,layout,bottom);
    // Native inputs own arrows/Enter; do not let the global race shortcuts steal them.
    this.element.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.close();}});
    this.renderControls();this.updateTabs();
  }
  private button(label:string,action:()=>void):HTMLButtonElement{const b=node('button','',label);b.type='button';b.addEventListener('click',action);return b;}
  private updateTabs():void{for(const b of this.tabButtons){const on=b.id==='character-tab-'+this.section;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}this.controls.setAttribute('aria-labelledby','character-tab-'+this.section);}
  private changed():void{this.history.push(this.previous);if(this.history.length>40)this.history.shift();this.previous=structuredClone(this.profile);this.comparing=false;this.compareButton.setAttribute('aria-pressed','false');this.status.textContent='有未保存修改 · 预览中';this.scene?.setAppearance(this.profile);}
  private slider(id:string,label:string,min:number,max:number,step:number,value:number,set:(v:number)=>void,unit=''):void{
    const row=node('div','character-field'),head=node('div','character-field-head'),lab=node('label','',label),read=node('output');
    const input=node('input');input.type='range';input.id='character-'+id;lab.htmlFor=input.id;
    input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(value);
    const format=(v:number)=>unit?v.toFixed(0)+' '+unit:Math.round((v-min)/(max-min)*100)+'%';
    read.textContent=format(value);read.setAttribute('for',input.id);input.setAttribute('aria-valuetext',format(value));
    input.addEventListener('input',()=>{const v=Number(input.value);set(v);read.textContent=format(v);input.setAttribute('aria-valuetext',format(v));this.changed();});
    const reset=this.button('重置',()=>{const defaults=defaultCharacter();const v=id==='resemblance'?defaults.resemblance:id in defaults.face?defaults.face[id]:Number(defaults[id as keyof CharacterProfile]);if(!Number.isFinite(v))return;input.value=String(v);input.dispatchEvent(new Event('input'));});reset.setAttribute('aria-label','重置'+label);
    head.append(lab,read,reset);row.append(head,input);this.controls.append(row);
  }
  private choices(key:'gender'|'shapeA'|'shapeB'|'hair'|'hairColor'|'skin'|'eyes'|'beard'|'outfit'|'outfitColor',label:string,options:readonly string[],colors?:readonly string[]):void{
    const field=node('fieldset','character-options'),legend=node('legend','',label),list=node('div','character-option-list');field.append(legend,list);
    options.forEach((name,index)=>{const b=this.button(name,()=>{this.profile[key]=index;list.querySelectorAll('button').forEach((btn,i)=>btn.setAttribute('aria-pressed',String(i===index)));this.changed();if(key==='gender'){this.renderControls();this.controls.querySelector<HTMLButtonElement>('fieldset button[aria-pressed="true"]')?.focus();}});
      b.setAttribute('aria-pressed',String(this.profile[key]===index));if(colors){b.classList.add('character-swatch');b.style.setProperty('--swatch',colors[index]);}list.append(b);
    });this.controls.append(field);
  }
  private renderControls():void{
    this.controls.replaceChildren();
    this.choices('gender','车手性别',['男车手','女车手']);
    if(this.section==='heritage'){
      this.controls.append(node('h2','','基础轮廓'),node('p','character-description','混合两种原创基础脸型，再到五官栏微调。这是美术形态混合，不代表族裔或真实遗传。'));
      this.choices('shapeA','基础 A',FACE_BASES.map(b=>b.name));this.choices('shapeB','基础 B',FACE_BASES.map(b=>b.name));
      this.slider('resemblance','相似度 A → B',0,1,.01,this.profile.resemblance,v=>this.profile.resemblance=v);
    }else if(this.section==='face'){
      this.controls.append(node('h2','','面部细调'),node('p','character-description','调整会叠加在基础轮廓上，眼睛和嘴部随头部结构联动。'));
      for(const s of FACE_SLIDERS)this.slider(s.id,s.label,s.min,s.max,s.step,this.profile.face[s.id],v=>this.profile.face[s.id]=v);
    }else if(this.section==='body'){
      this.controls.append(node('h2','','全身比例'),node('p','character-description','肩颈、胸腰胯和四肢一起更新；衣服跟随轮廓，身高只影响外观。'));
      for(const s of BODY_SLIDERS)this.slider(s.id,s.label,s.min,s.max,s.step,this.profile[s.id],v=>this.profile[s.id]=v,'unit' in s?s.unit:'');
    }else{
      this.controls.append(node('h2','','外观与衣着'));
      this.choices('skin','肤色',SKIN_TONES.map((_,i)=>'肤色 '+(i+1)),SKIN_TONES);
      this.choices('hair','发型',this.profile.gender===1?['利落短发','齐颈侧分','低束马尾','光头']:HAIR_STYLES);this.choices('hairColor','发色',['黑色','深棕','栗色','亚麻','灰色'],HAIR_COLORS);
      this.choices('eyes','瞳色',['深棕瞳','灰绿瞳','灰蓝瞳','榛色瞳'],EYE_COLORS);
      this.choices('beard','胡须',['无胡须','胡茬','短胡须']);this.choices('outfit','服装',OUTFITS);
      this.choices('outfitColor','服装配色',['石墨灰','橄榄绿','暗酒红','暖灰'],OUTFIT_COLORS);
    }
  }
  open():void{this.profile=characterStore.get();this.history=[];this.previous=structuredClone(this.profile);this.comparing=false;this.compareButton.setAttribute('aria-pressed','false');this.renderControls();this.updateTabs();this.status.textContent='草稿模式 · 保存后同步到车库与比赛';this.scene=new FaceScene(this.stage,this.profile);this.viewButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===0)));this.spinButton.setAttribute('aria-pressed','false');this.helmetButton.setAttribute('aria-pressed','false');this.tabButtons.find(b=>b.tabIndex===0)?.focus();}
  render(dt:number):void{this.scene?.render(dt);}
  dispose():void{this.scene?.dispose();this.scene=null;}
}
