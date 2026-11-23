import {WIDTH,HEIGHT} from './config.js';
import {label,line,rounded} from './art.js';
const gold='#ffcb88', ivory='#fff1db';
const controls=[
  ['WASD / ARROWS','Move on foot or steer a vehicle'],
  ['SHIFT','Sprint on foot'],
  ['MOUSE / LEFT CLICK','Aim and fire the sidearm'],
  ['E','Enter or exit a vehicle'],
  ['SPACE','Handbrake and drift'],
  ['ESC / P','Pause or resume'],
  ['M','Toggle audio']
];
export function menuItems(mode,hasSave){
  if(mode==='title')return [{label:'Start new game',value:'start'},{label:'Continue story',value:'continue',disabled:!hasSave},{label:'Controls',value:'controls'}];
  if(mode==='pause')return [{label:'Resume',value:'resume'},{label:'Controls',value:'controls'},{label:'Save and return to title',value:'title'}];
  return [{label:'Back',value:'back'}];
}
function menuBounds(mode,index){
  return {x:mode==='title'?67:440,y:(mode==='title'?385:mode==='controls'?549:320)+index*52,w:mode==='title'?325:400,h:43};
}
export function menuHit(mode,items,mouse){
  return items.findIndex((_,i)=>{const {x,y,w,h}=menuBounds(mode,i);return mouse.x>=x&&mouse.x<=x+w&&mouse.y>=y&&mouse.y<=y+h;});
}
export function drawMenu(ctx,mode,hasSave,selected,muted){
  const shade=ctx.createLinearGradient(0,0,WIDTH,0);
  shade.addColorStop(0,'#101724f7');shade.addColorStop(.52,'#151d2ca1');shade.addColorStop(1,'#23243b35');
  ctx.fillStyle=mode==='title'?shade:'#111828cc';ctx.fillRect(0,0,WIDTH,HEIGHT);
  if(mode==='title'){
    line(ctx,69,90,119,90,gold,3);
    label(ctx,'SOLARA BAY  /  A CRIME STORY',133,95,{size:13,font:'monospace',color:gold});
    label(ctx,'SOLARA',58,213,{size:112,weight:900,color:ivory});
    label(ctx,'NIGHTS',60,307,{size:112,weight:900,color:gold});
    label(ctx,'The harbor belongs to whoever can keep its secrets.',69,350,{size:17,color:'#ead8c0'});
    label(ctx,'FOLLOW THE LEDGER TO THE WATER',69,615,{size:11,font:'monospace',color:gold});
  }else if(mode==='pause'){
    label(ctx,'PAUSED',640,264,{size:59,weight:900,align:'center',color:ivory});
  }else{
    rounded(ctx,391,104,498,511,13,'#192233');
    label(ctx,'CONTROLS',640,161,{size:39,weight:900,align:'center',color:gold});
    controls.forEach(([key,description],i)=>{
      const y=207+i*47;
      line(ctx,424,y+13,856,y+13,'#65718266');
      label(ctx,key,426,y,{size:12,color:gold,font:'monospace'});
      label(ctx,description,615,y,{size:14,color:ivory,weight:500});
    });
  }
  menuItems(mode,hasSave).forEach((item,i)=>{
    const {x,y,w,h}=menuBounds(mode,i),active=i===selected;
    rounded(ctx,x,y,w,h,6,active?gold:'#303b50dd');
    label(ctx,item.label,x+16,y+27,{size:16,color:item.disabled?(active?'#775940':'#9ba4ae'):(active?'#252435':ivory)});
    label(ctx,active?'↵':'›',x+w-16,y+27,{size:16,color:item.disabled?(active?'#775940':'#9ba4ae'):(active?'#252435':ivory),align:'right'});
  });
  label(ctx,'↑ ↓  SELECT     ENTER  CONFIRM     M  AUDIO '+(muted?'OFF':'ON'),mode==='title'?69:640,675,{size:11,font:'monospace',color:'#f1daba',align:mode==='title'?'left':'center'});
}
