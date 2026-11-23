import {CELL,clamp,distance,angleDelta} from './config.js';
import {moveWithCollisions} from './city.js';
import {createCar} from './vehicles.js';
import {hurtPlayer,shoot} from './combat.js';

export const stars=police=>Math.min(5,Math.ceil(Math.max(0,police.heat-.06)));
export function createPoliceCar(x,y,a){
  const c=createCar(x,y,a,'#e4edef','police');
  c.driver='police';c.hp=145;c.cooldown=.8;c.ram=0;return c;
}
export function reportCrime(police,intensity){
  police.heat=clamp(police.heat+intensity,0,5);police.quiet=0;
}
function routeTowardPlayer(car,p){
  const center=n=>Math.round((n-52)/CELL)*CELL+52;
  const rx=center(car.x),ry=center(car.y), px=center(p.x),py=center(p.y);
  if(distance(car,p)<140)return p;
  if(Math.abs(car.x-rx)<38&&Math.abs(car.y-ry)<38){
    if(px!==rx&&Math.abs(px-rx)>=Math.abs(py-ry))return {x:px,y:ry};
    if(py!==ry)return {x:rx,y:py};
    return p;
  }
  if(Math.abs(car.x-rx)<52)return {x:rx,y:py===ry?ry:py};
  if(Math.abs(car.y-ry)<52)return {x:px===rx?rx:px,y:ry};
  return Math.abs(car.x-rx)<Math.abs(car.y-ry)?{x:rx,y:car.y}:{x:car.x,y:ry};
}
export function updatePolice(game,dt){
  const state=game.police,p=game.player,n=stars(state);
  state.quiet+=dt;state.spawn-=dt;
  const units=game.cars.filter(c=>c.driver==='police');
  if(!n){
    for(const c of units){c.driver='traffic';c.dir=0;c.col=Math.max(0,Math.min(8,Math.round((c.x-52)/CELL)));c.row=Math.max(0,Math.min(7,Math.round((c.y-52)/CELL)));c.target={x:c.col*CELL+52,y:c.row*CELL+73};c.cruise=100;}
    state.heli=null;return;
  }
  if(state.quiet>7){
    const contact=units.some(c=>distance(c,p)<270);
    state.heat=Math.max(0,state.heat-dt*(contact&&state.quiet<18?.025:.29));
  }
  if(units.length<Math.min(n+1,5)&&state.spawn<=0){
    const angle=game.random()*Math.PI*2;
    const x=clamp(Math.round((p.x+Math.cos(angle)*510-52)/CELL),0,8)*CELL+52;
    const y=clamp(Math.round((p.y+Math.sin(angle)*510-52)/CELL),0,7)*CELL+52;
    if(distance({x,y},p)>240)game.cars.push(createPoliceCar(x,y,angle+Math.PI));
    state.spawn=1.55;
  }
  for(const c of units){
    const d=distance(c,p),target=routeTowardPlayer(c,p);
    const aim=Math.atan2(target.y-c.y,target.x-c.x);
    c.a+=angleDelta(aim,c.a)*Math.min(1,dt*6);
    c.speed+=((d<34?37:235+n*17)-c.speed)*dt*2.4;
    if(moveWithCollisions(game.city,c,Math.cos(c.a)*c.speed*dt,Math.sin(c.a)*c.speed*dt,14))c.speed*=.61;
    c.cooldown-=dt;c.ram-=dt;
    if(d<36&&c.ram<=0){hurtPlayer(game,11);c.ram=1.25;if(p.car)p.car.speed*=.72;}
    if(d<253&&d>42&&c.cooldown<=0&&n>=2){
      c.cooldown=1.5+game.random();shoot(game,c,Math.atan2(p.y-c.y,p.x-c.x)+(game.random()-.5)*.22,'police');
    }
  }
  if(n>=4){
    state.heli??={x:p.x-250,y:p.y-154,a:0};
    const h=state.heli,t=game.time;
    const tx=p.x+Math.cos(t*.83)*176,ty=p.y-100+Math.sin(t*.78)*76;
    h.a=Math.atan2(ty-h.y,tx-h.x);h.x+=(tx-h.x)*dt*1.1;h.y+=(ty-h.y)*dt*1.1;
  }else state.heli=null;
}
