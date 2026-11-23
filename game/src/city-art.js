import {CELL,ROAD,WIDTH,HEIGHT,WORLD_H} from './config.js';
import {coastX} from './city.js';
import {ellipse,line,label,polygon,rounded,glow} from './art.js';

export function drawCoast(ctx,view,time){
  const water=ctx.createLinearGradient(2920,0,3600,0);
  water.addColorStop(0,'#45a99d');water.addColorStop(.3,'#247d88');water.addColorStop(1,'#155369');
  ctx.fillStyle=water;ctx.fillRect(2975,0,625,WORLD_H);
  const start=Math.floor(view.y/16)*16,end=view.y+HEIGHT+30;
  for(const [offset,color] of [[157,'#66b9ad'],[145,'#ebeed2'],[138,'#cdba8e'],[119,'#e3c38e'],[26,'#d0ad80'],[8,'#b7a699']]){
    const points=[[2974,start]];
    for(let y=start;y<=end+16;y+=16)points.push([coastX(y)+offset,y]);
    points.push([2974,end+16]);polygon(ctx,points,color);
  }
  for(let y=Math.floor(view.y/27)*27;y<end;y+=27){
    for(let i=0;i<7;i++){
      const x=coastX(y)+172+i*80+Math.sin(y*.13+i+time*.28)*23;
      line(ctx,x,y,x+20+i*3,y-3,'#b6f4df43',1.4);
    }
  }
  for(let y=412;y<WORLD_H;y+=CELL*2){
    ctx.fillStyle='#214d5963';ctx.fillRect(2989,y+12,207,39);
    ctx.fillStyle='#977d68';ctx.fillRect(2981,y,198,32);
    for(let x=2985;x<3179;x+=9)line(ctx,x,y,x,y+32,'#685e57',1);
    line(ctx,2981,y,3179,y,'#e3c294',2);line(ctx,2981,y+30,3179,y+30,'#e3c294',2);
    rounded(ctx,3170,y-10,31,52,3,'#ab917a');
  }
  for(let y=Math.floor(view.y/79)*79;y<end;y+=79){
    const x=coastX(y)+66+(y%4)*14;
    ellipse(ctx,x+7,y+6,12,9,'#725d5750');
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3;
      polygon(ctx,[[x,y],[x+Math.cos(a)*12,y+Math.sin(a)*12],[x+Math.cos(a+Math.PI/3)*12,y+Math.sin(a+Math.PI/3)*12]],n%2?'#f6e3be':(y%2?'#d06e63':'#368d92'));
    }
  }
}
function drawPalm(ctx,x,y,r){
  ellipse(ctx,x+r*.72,y+r*.58,r*1.2,r*.56,'#243a3551');
  line(ctx,x+3,y+7,x,y,'#785b48',3);
  for(let i=0;i<7;i++){
    const a=i*2.4;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);
    ctx.fillStyle=i%2?'#477959':'#67946a';
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(r*.58,-r*.67,r*1.22,-r*.04);ctx.quadraticCurveTo(r*.57,-r*.10,0,0);ctx.fill();
    ctx.restore();
  }
  ellipse(ctx,x,y,2.7,3,'#a0aa67');
}
function drawBuilding(ctx,b){
  const {x,y,w,h,z,color,style}=b, ox=-z*.37,oy=-z*.56,rx=x+ox,ry=y+oy;
  polygon(ctx,[[x,y],[x+w,y],[x+w+z*.95,y+z*.44],[x+w+z*.95,y+h+z*.44],[x+z*.95,y+h+z*.44],[x,y+h]],'#38344348');
  polygon(ctx,[[rx,ry+h],[rx+w,ry+h],[x+w,y+h],[x,y+h]],'#866c68');
  polygon(ctx,[[rx+w,ry],[x+w,y],[x+w,y+h],[rx+w,ry+h]],'#a18578');
  for(let j=9;j<w-7;j+=13){
    ctx.fillStyle=(j%3===0)?'#e0b18a':'#555568';ctx.fillRect(x+j,y+h-7,7,5);
  }
  rounded(ctx,rx,ry,w,h,2,color);
  ctx.strokeStyle='#fff2ce8f';ctx.lineWidth=2;ctx.strokeRect(rx+2,ry+2,w-4,h-4);
  ctx.strokeStyle='#44334233';ctx.lineWidth=1;ctx.strokeRect(rx+7,ry+7,w-14,h-14);
  if(style===0||style===3){
    for(let k=12;k<h-10;k+=7)line(ctx,rx+10,ry+k,rx+w-10,ry+k,'#6e525535');
  }
  if(style===1){
    rounded(ctx,rx+12,ry+13,w-24,22,3,'#66595670');
    rounded(ctx,rx+11,ry+11,w-24,20,3,'#c5b8a0');
    for(let k=16;k<w-13;k+=8)line(ctx,rx+k,ry+14,rx+k,ry+27,'#56585c',2);
  }else{
    rounded(ctx,rx+w-30,ry+10,19,15,1,'#39404a70');
    rounded(ctx,rx+w-33,ry+7,18,14,1,'#aeb5ad');ellipse(ctx,rx+w-24,ry+14,4,4,'#62696b');
  }
  if(style===2){
    rounded(ctx,rx+12,ry+h-34,w-30,22,4,'#efe2c6');
    rounded(ctx,rx+15,ry+h-31,w-36,16,3,'#61a6a1');
    line(ctx,rx+19,ry+h-25,rx+w-27,ry+h-25,'#c0e4d1');
  }
  if(b.sign){
    rounded(ctx,x+3,y+h+1,w-6,15,2,'#4b354d');
    line(ctx,x+6,y+h+3,x+w-6,y+h+3,'#fc96aa',1);
    label(ctx,b.sign,x+w/2,y+h+12,{align:'center',size:9,color:'#ffd3c6',font:'monospace'});
  }
}
function drawPark(ctx,x,y){
  rounded(ctx,x+7,y+7,242,242,13,'#7b9b71');
  rounded(ctx,x+16,y+16,224,224,10,'#8ba77b');
  line(ctx,x+125,y+13,x+125,y+242,'#d6c4a0',13);
  line(ctx,x+13,y+127,x+242,y+127,'#d6c4a0',13);
  ellipse(ctx,x+125,y+130,39,36,'#657c72');
  ellipse(ctx,x+125,y+126,35,33,'#dac5a4');
  ellipse(ctx,x+125,y+126,28,27,'#508d91');
  ellipse(ctx,x+125,y+126,20,18,'#86c0b8');
  ellipse(ctx,x+125,y+126,5,5,'#f7e5c3');
  for(const dx of [42,180])for(const dy of [101,139])rounded(ctx,x+dx,y+dy,24,6,2,'#936f5e');
}
function drawBlock(ctx,block){
  const {x,y,park}=block;
  rounded(ctx,x,y,256,256,13,'#a29486');
  rounded(ctx,x+2,y+2,252,251,11,'#d3bc9e');
  ctx.strokeStyle='#a9937d88';ctx.lineWidth=1;
  for(let i=16;i<256;i+=16){
    line(ctx,x+i,y+2,x+i,y+17,'#a9937d88');
    line(ctx,x+i,y+239,x+i,y+254,'#a9937d88');
    line(ctx,x+2,y+i,x+17,y+i,'#a9937d88');
    line(ctx,x+239,y+i,x+254,y+i,'#a9937d88');
  }
  if(park)drawPark(ctx,x,y);
  else{
    rounded(ctx,x+17,y+17,222,222,4,'#bdab94');
    for(let i=0;i<8;i++)line(ctx,x+22+i*28,y+227,x+29+i*28,y+208,'#ead3ab88',1.5);
  }
  for(const building of block.buildings)drawBuilding(ctx,building);
  for(const t of block.trees){
    if(t.palm)drawPalm(ctx,t.x,t.y,t.r);
    else{
      ellipse(ctx,t.x+6,t.y+7,t.r,t.r*.66,'#465d4e75');
      ellipse(ctx,t.x,t.y,t.r*.84,t.r*.76,'#527e62');
      ellipse(ctx,t.x-3,t.y-4,t.r*.57,t.r*.48,'#6a966b');
    }
  }
}
function drawIntersection(ctx,x,y){
  for(let j=16;j<ROAD-10;j+=12){
    for(const edge of [-7,ROAD+3]){
      ctx.fillStyle='#decbb386';ctx.fillRect(x+j,y+edge,5,5);ctx.fillRect(x+edge,y+j,5,5);
    }
  }
  for(const [dx,dy] of [[7,7],[96,96]]){
    ellipse(ctx,x+dx+3,y+dy+4,5,3,'#22273277');
    line(ctx,x+dx,y+dy,x+dx-3,y+dy-10,'#333740',2);
    rounded(ctx,x+dx-7,y+dy-12,7,4,1,'#ffd899');
  }
}
export function drawCity(ctx,game,view){
  ctx.fillStyle='#555765';ctx.fillRect(view.x-20,view.y-20,WIDTH+40,HEIGHT+40);
  const c0=Math.max(0,Math.floor(view.x/CELL)-1),c1=Math.min(8,Math.floor((view.x+WIDTH)/CELL)+1);
  const r0=Math.max(0,Math.floor(view.y/CELL)-1),r1=Math.min(7,Math.floor((view.y+HEIGHT)/CELL)+1);
  for(let c=c0;c<=c1;c++)for(let r=r0;r<=r1;r++){
    const x=c*CELL,y=r*CELL;
    for(let i=118;i<350;i+=22){
      line(ctx,x+ROAD/2,y+i,x+ROAD/2,y+i+10,'#efbc7699',1.7);
      if(c<8)line(ctx,x+i,y+ROAD/2,x+i+10,y+ROAD/2,'#efbc7699',1.7);
    }
    for(const d of [13,ROAD-13]){
      line(ctx,x+d,y+110,x+d,y+CELL,'#cbc0ac57');
      if(c<8)line(ctx,x+110,y+d,x+CELL,y+d,'#cbc0ac57');
    }
    for(let i=0;i<39;i++){
      const xx=x+(i*79+c*83+r*31)%CELL,yy=y+(i*47+r*41)%CELL;
      ellipse(ctx,xx,yy,1+i%4,.46,'#e2d7bb26');
    }
    drawIntersection(ctx,x,y);
    if(c<8)drawBlock(ctx,game.city.blocks[r*8+c]);
  }
  if(view.x+WIDTH>2840)drawCoast(ctx,view,game.time);
}
export function drawStreetLights(ctx,game,view){
  if(game.light<.36)return;
  for(const block of game.city.blocks){
    if(block.x<view.x-270||block.x>view.x+WIDTH+40||block.y<view.y-270||block.y>view.y+HEIGHT+40)continue;
    glow(ctx,block.x-12,block.y-14,34,'#ffd17e55');
    glow(ctx,block.x+242,block.y+245,25,'#ffd17e39');
    for(const b of block.buildings)if(b.sign)glow(ctx,b.x+b.w/2,b.y+b.h+7,23,'#fa728a5a');
  }
}
