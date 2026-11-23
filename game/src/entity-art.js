import {ellipse,glow,label,line,polygon,rounded} from './art.js';

export function drawHeadlights(ctx,c){
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);
  const beam=ctx.createLinearGradient(17,0,173,0);
  beam.addColorStop(0,'#fff5c69a');beam.addColorStop(.42,'#ffdd8c43');beam.addColorStop(1,'#ffdd8c00');
  for(const side of [-1,1])polygon(ctx,[[19,side*7-3],[169,side*7-35],[171,side*7+39],[20,side*7+3]],beam);
  ctx.restore();
}
export function drawCar(ctx,c,time){
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);
  ellipse(ctx,3,5,25,14,'#1a202a69');
  for(const x of [-14,11])for(const y of [-11,8])rounded(ctx,x,y,8,4,1,'#252832');
  rounded(ctx,-22,-10,44,20,5,c.hp<=0?'#453d46':c.color);
  rounded(ctx,-20,-9,39,3,1,'#fff1da85');
  rounded(ctx,-19,7,38,2,1,'#35354360');
  polygon(ctx,[[-12,-7],[9,-7],[15,-5],[15,5],[9,7],[-12,7],[-16,5],[-16,-5]],'#263647');
  rounded(ctx,-9,-6,16,12,2,c.kind==='police'?'#e4edef':(c.hp>0?c.color:'#514953'));
  line(ctx,12,-5,14,3,'#9fcbc8',1.2);
  for(const side of [-1,1]){
    rounded(ctx,18,side*6-1.7,4,3.4,1,'#fff3bc');
    rounded(ctx,-22,side*6-1.5,4,3,1,'#ff6469');
  }
  if(c.kind==='police'){
    for(const x of [-17,16])rounded(ctx,x,-9,5,18,1,'#34435e');
    const flash=Math.sin(time*24+c.x*.01)>0;
    if(c.driver==='police'){
      glow(ctx,0,-6,32,flash?'#ff4a6aa6':'#ff4a6a3a');
      glow(ctx,0,6,32,flash?'#58a2ff49':'#58a2ffd0');
    }
    rounded(ctx,-3,-8,6,8,1,flash?'#ffced0':'#de4768');
    rounded(ctx,-3,0,6,8,1,flash?'#528cff':'#c8edff');
  }
  if(c.hp<=0){
    for(let i=0;i<4;i++){
      const offset=(time*34+i*9)%36;
      ellipse(ctx,-5-offset*.5,-offset*.7,7+offset*.15,5+offset*.1,'#29243155');
    }
  }
  ctx.restore();
}
export function drawPerson(ctx,p,player=false){
  if(p.hp<=0){ellipse(ctx,p.x,p.y,10,5,'#6b364c95');return;}
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
  ellipse(ctx,1,4,11,7,'#24253070');
  const stride=Math.sin(p.step??0)*4;
  for(const side of [-1,1]){
    rounded(ctx,-8+stride*side,side*4-1.7,8,3.4,1.5,'#293143');
    rounded(ctx,-5,side*6-2.1,10,4.2,2,player?'#f0b065':p.color);
  }
  rounded(ctx,-6,-5.5,13,11,4,player?'#e8ccae':p.color);
  ellipse(ctx,1,0,4.5,4.1,'#e8ad88');
  ellipse(ctx,-.7,0,3.2,4.1,player?'#293340':'#4c3d46');
  if(player||p.hostile){
    rounded(ctx,4,-3,9,5,2,'#bd8f79');
    rounded(ctx,10,-3,10,3,1,'#292938');
  }
  ctx.restore();
  if(p.hostile){
    rounded(ctx,p.x-13,p.y-23,26,4,2,'#2b2435');
    rounded(ctx,p.x-13,p.y-23,26*p.hp/60,4,2,'#ff7790');
  }
}
export function drawHelicopterBeam(ctx,h,p,time){
  const x=p.x+Math.sin(time*1.6)*19,y=p.y+Math.cos(time*1.4)*12;
  const beam=ctx.createLinearGradient(h.x,h.y,x,y);
  beam.addColorStop(0,'#fff9cf42');beam.addColorStop(1,'#fff2ae62');
  polygon(ctx,[[h.x-5,h.y],[h.x+5,h.y-1],[x+48,y-4],[x+22,y+28],[x-40,y+27],[x-50,y-4]],beam);
  ellipse(ctx,x,y+9,50,30,'#ffeac939');
  ctx.strokeStyle='#fff3caa6';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.ellipse(x,y+9,49,29,0,0,Math.PI*2);ctx.stroke();
}
export function drawHelicopter(ctx,h,time){
  ellipse(ctx,h.x+35,h.y+38,42,19,'#1b23345c');
  ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.a);
  rounded(ctx,-41,-4,43,8,3,'#26364b');
  rounded(ctx,-43,-11,9,22,2,'#49617c');
  ellipse(ctx,4,0,27,14,'#28354d');
  ellipse(ctx,18,0,13,10,'#7da5ad');
  line(ctx,-13,-17,23,-17,'#b0b2b4',3);line(ctx,-13,17,23,17,'#b0b2b4',3);
  glow(ctx,24,0,28,'#fff0a687');
  for(let i=0;i<4;i++){
    const a=time*24+i*Math.PI/2;
    line(ctx,0,0,Math.cos(a)*53,Math.sin(a)*53,'#ded5c1a0',3.5);
  }
  ellipse(ctx,0,0,4,4,'#ded5c1');ctx.restore();
  label(ctx,'AIR SUPPORT',h.x,h.y-35,{size:10,align:'center',color:'#ffe4b0',font:'monospace'});
}
export function drawEffects(ctx,game){
  for(const b of game.bullets){
    line(ctx,b.x-b.vx*.045,b.y-b.vy*.045,b.x,b.y,b.faction==='player'?'#ffda8766':'#ff87946f',5);
    line(ctx,b.x-b.vx*.035,b.y-b.vy*.035,b.x,b.y,b.faction==='player'?'#fff1ae':'#ffabb0',1.8);
  }
  for(const f of game.flashes){
    glow(ctx,f.x,f.y,39,'#ffb65694');
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.a);
    polygon(ctx,[[-5,0],[4,-6],[16,-3],[28,0],[13,4],[5,8]],'#ffcf7b');
    polygon(ctx,[[0,0],[8,-3],[20,0],[6,4]],'#fffce4');ctx.restore();
  }
  for(const p of game.particles)ellipse(ctx,p.x,p.y,p.size,p.size*.62,p.color);
}
