import {distance} from './config.js';
import {solid,moveWithCollisions} from './city.js';
import {damageCar} from './vehicles.js';
import {frightenPedestrians} from './pedestrians.js';

export function shoot(game,source,a,faction){
  const x=source.x+Math.cos(a)*22,y=source.y+Math.sin(a)*22;
  const speed=faction==='player'?895:525;
  game.bullets.push({x,y,px:x,py:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.68,faction,source});
  game.flashes.push({x,y,a,life:.115});
  if(distance(source,game.player)<640)game.audio.shot(faction==='player'?.24:.075);
}
export function firePlayerWeapon(game,aim=game.player.a){
  const p=game.player;
  if(p.cooldown>0||p.ammo<=0)return;
  p.cooldown=.19;p.ammo--;p.flash=.12;
  shoot(game,p,aim,'player');
  game.crime(.19);game.shake=Math.max(2,game.shake);
  frightenPedestrians(game,p.x,p.y);
}
export function hurtPlayer(game,amount){
  const p=game.player;
  if(p.car)damageCar(game,p.car,amount*1.2);
  p.hp=Math.max(0,p.hp-amount*(p.car?.38:1));
  game.shake=Math.max(game.shake,5);
  game.burst(p.x,p.y,p.car?'#ffcc83':'#c94e64',6);
}
function bulletImpact(game,b){
  if(solid(game.city,b.x,b.y,1)){game.burst(b.x,b.y,'#ffcc83',4);return true;}
  if(b.faction!=='player'&&distance(b,game.player)<(game.player.car?23:12)){
    hurtPlayer(game,b.faction==='police'?7:9);return true;
  }
  if(b.faction!=='player')return false;
  const person=[...game.enemies,...game.people].find(p=>p.hp>0&&distance(p,b)<(p.hostile?14:10));
  if(person){
    person.hp-=30;game.burst(b.x,b.y,'#d15670',9);
    if(!person.hostile)game.crime(.48);
    return true;
  }
  const car=game.cars.find(c=>c!==game.player.car&&c.hp>0&&distance(c,b)<20);
  if(car){damageCar(game,car,24);game.burst(b.x,b.y,'#ffd183',9);game.crime(.17);return true;}
  return false;
}
export function updateCombat(game,dt){
  for(const e of game.enemies){
    const d=distance(e,game.player);
    if(d>550||e.hp<=0)continue;
    e.a=Math.atan2(game.player.y-e.y,game.player.x-e.x);
    e.cooldown-=dt;
    if(d>135)moveWithCollisions(game.city,e,Math.cos(e.a)*65*dt,Math.sin(e.a)*65*dt,9);
    if(d<360&&e.cooldown<=0){e.cooldown=1.35+game.random()*.55;shoot(game,e,e.a+(game.random()-.5)*.26,'enemy');}
  }
  for(const b of game.bullets){
    b.life-=dt;b.px=b.x;b.py=b.y;
    for(let i=0;i<3;i++){
      b.x+=b.vx*dt/3;b.y+=b.vy*dt/3;
      if(bulletImpact(game,b)){b.life=0;break;}
    }
  }
  game.bullets=game.bullets.filter(b=>b.life>0);
  for(const f of game.flashes)f.life-=dt;
  game.flashes=game.flashes.filter(f=>f.life>0);
  for(const pickup of game.pickups){
    if(pickup.timer>0){pickup.timer-=dt;continue;}
    if(distance(pickup,game.player)<26&&(game.player.hp<100||game.player.ammo<84)){
      game.player.hp=Math.min(100,game.player.hp+42);
      game.player.ammo=Math.min(120,game.player.ammo+36);
      pickup.timer=32;game.audio.blip(620);
    }
  }
}
