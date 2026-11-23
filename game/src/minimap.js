import {WORLD_W,WORLD_H,CELL,distance} from './config.js';
import {missionPoint} from './missions.js';
import {ellipse,label,line,rounded,polygon} from './art.js';
const x=1036,y=25,w=218,h=192,mx=x+11,my=y+30,mw=w-22,mh=140;
export function drawMinimap(ctx,game){
  const p=game.player,scale=.12;
  const tx=wx=>mx+mw/2+(wx-p.x)*scale;
  const ty=wy=>my+mh/2+(wy-p.y)*scale;
  rounded(ctx,x,y,w,h,10,'#151d2cf3');
  label(ctx,'SOLARA / STREET GRID',x+12,y+20,{size:11,font:'monospace',color:'#f5d7a6'});
  label(ctx,'N ↑',x+w-14,y+20,{size:11,font:'monospace',color:'#f5d7a6',align:'right'});
  ctx.save();ctx.beginPath();ctx.roundRect(mx,my,mw,mh,5);ctx.clip();
  ctx.fillStyle='#254456';ctx.fillRect(mx,my,mw,mh);
  ctx.fillStyle='#394552';ctx.fillRect(tx(0),ty(0),2928*scale,WORLD_H*scale);
  for(let col=0;col<8;col++)for(let row=0;row<8;row++){
    const block=game.city.blocks[row*8+col];
    ctx.fillStyle=block.park?'#435950':'#283241';
    ctx.fillRect(tx(col*CELL+104),ty(row*CELL+104),256*scale,256*scale);
  }
  for(let col=0;col<=8;col++)line(ctx,tx(col*CELL+52),ty(0),tx(col*CELL+52),ty(WORLD_H),'#65737a',1);
  for(let row=0;row<8;row++)line(ctx,tx(0),ty(row*CELL+52),tx(2928),ty(row*CELL+52),'#65737a',1);
  const m=missionPoint(game);
  if(m){
    const ax=Math.max(mx+7,Math.min(mx+mw-7,tx(m.x))),ay=Math.max(my+7,Math.min(my+mh-7,ty(m.y)));
    ctx.setLineDash([4,4]);line(ctx,tx(p.x),ty(p.y),ax,ay,'#ffc06e9e');ctx.setLineDash([]);
    polygon(ctx,[[ax,ay-5],[ax+5,ay],[ax,ay+5],[ax-5,ay]],'#ffc06e');
  }
  for(const c of game.cars){
    if(c===p.car||distance(c,p)>950||c.hp<=0)continue;
    const police=c.driver==='police';
    ellipse(ctx,tx(c.x),ty(c.y),police?4:1.7,police?4:1.7,police?'#ff778e':'#afc5c2b0');
  }
  const helicopter=game.police.heli;
  if(helicopter)ellipse(ctx,tx(helicopter.x),ty(helicopter.y),4,4,'#94baff');
  const px=tx(p.x),py=ty(p.y);
  ctx.save();ctx.translate(px,py);ctx.rotate(p.a);
  polygon(ctx,[[8,0],[-5,5],[-3,0],[-5,-5]],'#f9f5e9');ctx.restore();
  ctx.restore();
  label(ctx,'●  YOU       ◆  CONTRACT',x+13,y+h-8,{size:10,font:'monospace',color:'#bec7cc'});
}
