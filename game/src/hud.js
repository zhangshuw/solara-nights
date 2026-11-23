import {WIDTH,HEIGHT,distance,clamp} from './config.js';
import {stars} from './police.js';
import {chapters,missionPoint} from './missions.js';
import {drawMinimap} from './minimap.js';
import {label,line,rounded,polygon} from './art.js';

const pale='#fff1d9',muted='#a9b5c2',gold='#ffcb84',mono='monospace';
const panel='#151c2bee';
const cash=n=>'$'+Math.round(n).toLocaleString('en-US');
export function drawHud(ctx,game){
  const p=game.player,n=stars(game.police),m=game.mission,c=chapters[m.index],point=missionPoint(game);
  rounded(ctx,26,25,292,111,9,panel);
  rounded(ctx,26,37,3,85,1,gold);
  label(ctx,'SOLARA  /  NIGHT OPERATIONS',43,47,{size:11,font:mono,color:gold});
  label(ctx,cash(p.money),301,76,{size:25,color:pale,align:'right'});
  for(let i=0;i<5;i++)label(ctx,'★',43+i*23,77,{size:20,color:i<n?(n>=4?'#ff8796':gold):'#51576b'});
  label(ctx,'VITALS',43,103,{size:10,font:mono,color:muted});
  label(ctx,Math.ceil(p.hp)+' / 100',301,103,{size:10,font:mono,color:muted,align:'right'});
  rounded(ctx,43,111,258,7,3,'#495065');
  rounded(ctx,43,111,258*p.hp/100,7,3,p.hp>35?'#72d4b5':'#ff788d');
  drawMinimap(ctx,game);
  rounded(ctx,26,HEIGHT-111,438,85,9,panel);
  rounded(ctx,40,HEIGHT-97,35,55,6,'#35404e');
  label(ctx,String(Math.min(m.index+1,chapters.length)).padStart(2,'0'),57,HEIGHT-64,{size:16,color:gold,align:'center',font:mono});
  label(ctx,c?c.name:'FREE ROAM',90,HEIGHT-87,{size:11,font:mono,color:gold});
  label(ctx,c?(m.active?c.goal:'Go to the contract marker'):'All contracts completed',90,HEIGHT-60,{size:17,color:pale});
  if(point)label(ctx,Math.round(distance(p,point)*.72)+' m',447,HEIGHT-87,{size:11,font:mono,align:'right',color:muted});
  rounded(ctx,WIDTH-176,HEIGHT-96,150,70,9,panel);
  label(ctx,p.car?'VEHICLE  /  '+p.ammo+' RDS':'SIDEARM',WIDTH-160,HEIGHT-72,{size:11,font:mono,color:muted});
  label(ctx,p.car?Math.round(Math.abs(p.car.speed)*.51)+' km/h':String(p.ammo).padStart(2,'0')+' RDS',WIDTH-41,HEIGHT-43,{size:22,color:pale,align:'right'});
  let prompt=p.car?(Math.abs(p.car.speed)>120?'SPACE  HANDBRAKE':'E  EXIT VEHICLE'):'SHIFT  SPRINT   /   CLICK  FIRE';
  if(!p.car&&game.cars.some(c=>c.kind!=='police'&&c.hp>0&&distance(p,c)<61))prompt='E  ENTER VEHICLE';
  label(ctx,prompt,WIDTH/2,HEIGHT-29,{size:11,font:mono,color:'#fff2d0',align:'center'});
  if(m.timer>0){
    const w=590,x=(WIDTH-w)/2,y=26;
    rounded(ctx,x,y,w,66,9,panel);line(ctx,x+20,y+8,x+w-20,y+8,'#ffc78480');
    label(ctx,m.banner,WIDTH/2,y+31,{size:19,color:gold,align:'center'});
    label(ctx,m.detail,WIDTH/2,y+52,{size:13,color:pale,align:'center'});
  }
  if(point){
    const x=point.x-game.camera.x,y=point.y-game.camera.y;
    if(x<20||x>WIDTH-20||y<18||y>HEIGHT-18){
      const cx=clamp(x,480,1006),cy=clamp(y,117,HEIGHT-114);
      polygon(ctx,[[cx,cy-8],[cx+8,cy],[cx,cy+8],[cx-8,cy]],gold);
    }
  }
  if(!p.hp){
    ctx.fillStyle='#23172cb8';ctx.fillRect(0,0,WIDTH,HEIGHT);
    label(ctx,'DOWN IN SOLARA',WIDTH/2,HEIGHT/2,{size:50,color:'#ff94a2',align:'center',weight:900});
    label(ctx,'Clinic transport inbound',WIDTH/2,HEIGHT/2+35,{color:pale,align:'center'});
  }
}
