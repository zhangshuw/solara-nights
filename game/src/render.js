import {WIDTH,HEIGHT,distance} from './config.js';
import {missionPoint} from './missions.js';
import {drawHud} from './hud.js';
import {drawCity,drawStreetLights} from './city-art.js';
import {drawCar,drawHeadlights,drawPerson,drawHelicopter,drawHelicopterBeam,drawEffects} from './entity-art.js';
import {ellipse,glow,polygon,rounded,line,label} from './art.js';

function drawWaypoint(ctx,game){
  const point=missionPoint(game);
  if(!point)return;
  const {x,y}=point, pulse=1+Math.sin(game.time*4)*.12;
  glow(ctx,x,y,47,'#ffbe736b');
  ctx.strokeStyle='#ffdd9fac';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(x,y,28*pulse,14*pulse,0,0,Math.PI*2);ctx.stroke();
  const high=y-29-Math.sin(game.time*5)*3;
  line(ctx,x,y-7,x,high,'#ffe2a3a9');
  polygon(ctx,[[x,high-13],[x+10,high-3],[x,high+7],[x-10,high-3]],'#ffc87a');
  polygon(ctx,[[x,high-8],[x+5,high-3],[x,high+2],[x-5,high-3]],'#3c3442');
  rounded(ctx,x-40,high-31,80,15,3,'#232638df');
  label(ctx,game.mission.active?'OBJECTIVE':'CONTRACT',x,high-20,{size:9,font:'monospace',color:'#ffe1b2',align:'center'});
}
function applyLighting(ctx,game,view){
  const tone=ctx.createLinearGradient(view.x,view.y,view.x+WIDTH,view.y+HEIGHT);
  const dusk=game.light;
  tone.addColorStop(0,'rgba(91,53,97,'+(dusk*.50)+')');
  tone.addColorStop(.56,'rgba(49,45,81,'+(dusk*.76)+')');
  tone.addColorStop(1,'rgba(24,34,66,'+(dusk*.88)+')');
  ctx.fillStyle=tone;ctx.fillRect(view.x-20,view.y-20,WIDTH+40,HEIGHT+40);
}
export function renderGame(ctx,game,hud=true){
  const p=game.player,view=game.camera;
  const visible=e=>e.x>view.x-110&&e.x<view.x+WIDTH+110&&e.y>view.y-110&&e.y<view.y+HEIGHT+110;
  const cars=game.cars.filter(visible),h=game.police.heli;
  ctx.save();ctx.translate(-view.x+Math.sin(game.tick*2.9)*game.shake,-view.y+Math.cos(game.tick*3.1)*game.shake);
  drawCity(ctx,game,view);
  for(const t of game.tracks.filter(visible)){
    ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.a);
    for(const offset of [-8,8])line(ctx,-15,offset,4,offset,'rgba(32,34,46,'+(Math.min(t.life/9,1)*.6)+')',2);
    ctx.restore();
  }
  applyLighting(ctx,game,view);
  drawStreetLights(ctx,game,view);
  for(const c of cars)if(c.hp>0&&(c===p.car||c.driver==='police'||game.light>.48&&c.driver==='traffic'))drawHeadlights(ctx,c);
  if(h)drawHelicopterBeam(ctx,h,p,game.time);
  for(const pickup of game.pickups.filter(visible))if(pickup.timer<=0){
    glow(ctx,pickup.x,pickup.y,20,'#7ef6c267');
    rounded(ctx,pickup.x-8,pickup.y-7,16,14,3,'#427e70');
    line(ctx,pickup.x-4,pickup.y,pickup.x+4,pickup.y,'#e5ffe5',2);line(ctx,pickup.x,pickup.y-4,pickup.x,pickup.y+4,'#e5ffe5',2);
  }
  if(hud)drawWaypoint(ctx,game);
  for(const person of game.people.filter(visible))drawPerson(ctx,person);
  for(const enemy of game.enemies.filter(visible))drawPerson(ctx,enemy);
  for(const c of cars)if(c!==p.car)drawCar(ctx,c,game.time);
  if(hud){
    ellipse(ctx,p.x,p.y+3,p.car?28:15,p.car?17:12,'#ffce792c');
    if(p.car)drawCar(ctx,p.car,game.time);
    else drawPerson(ctx,p,true);
  }
  drawEffects(ctx,game);
  if(h)drawHelicopter(ctx,h,game.time);
  ctx.restore();
  const vignette=ctx.createRadialGradient(640,340,230,640,365,730);
  vignette.addColorStop(0,'#131b2400');vignette.addColorStop(1,'#14192977');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
  if(hud)drawHud(ctx,game);
}
