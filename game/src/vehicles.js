import {carColors,clamp,distance} from './config.js';
import {moveWithCollisions,solid} from './city.js';

export function createCar(x,y,a,color=carColors[0],kind='civilian'){
  return {x,y,a,color,kind,speed:0,hp:115,driver:'parked',marks:[]};
}
export function damageCar(game,car,amount){
  if(car.hp<=0)return;
  car.hp=Math.max(0,car.hp-amount);
  if(car.hp===0){
    car.speed=0;
    car.driver='wreck';
    game.burst(car.x,car.y,'#ffaf61',27);
    if(game.player.car===car){
      game.player.car=null;
      game.player.hp=Math.max(0,game.player.hp-24);
    }
  }
}
export function toggleVehicle(game){
  const p=game.player;
  if(p.car){
    const car=p.car;
    if(Math.abs(car.speed)>120)return;
    for(const offset of [Math.PI/2,-Math.PI/2,Math.PI]){
      const x=car.x+Math.cos(car.a+offset)*32,y=car.y+Math.sin(car.a+offset)*32;
      if(solid(game.city,x,y,9))continue;
      car.driver='parked';car.speed=0;p.car=null;p.x=x;p.y=y;return;
    }
    return;
  }
  const car=game.cars.filter(c=>c.hp>0&&c.kind!=='police'&&distance(c,p)<61).sort((a,b)=>distance(a,p)-distance(b,p))[0];
  if(!car)return;
  if(!car.owned){
    car.owned=true;
    game.crime(.85);
  }
  car.driver='player';p.car=car;p.x=car.x;p.y=car.y;
}
export function drivePlayer(game,input,dt){
  const p=game.player,c=p.car;
  if(!c)return;
  const axis=input.axis(), drift=input.on('Space');
  c.speed=clamp(c.speed+(-axis.y*(axis.y>0&&c.speed>0?520:355)-c.speed*(drift?1.65:.52))*dt,-120,365);
  c.a+=axis.x*Math.sign(c.speed)*Math.min(1,Math.abs(c.speed)/44)*(drift?3.1:2.03)*dt;
  c.heading=(c.heading??c.a)+Math.atan2(Math.sin(c.a-(c.heading??c.a)),Math.cos(c.a-(c.heading??c.a)))*Math.min(1,dt*(drift?3:13));
  if(drift&&Math.abs(c.speed)>67&&game.tick%3===0){
    game.tracks.push({x:c.x,y:c.y,a:c.a,life:9});
    if(game.tracks.length>240)game.tracks.shift();
  }
  const impact=Math.abs(c.speed);
  if(moveWithCollisions(game.city,c,Math.cos(c.heading)*c.speed*dt,Math.sin(c.heading)*c.speed*dt,16)){
    c.speed*=-.24;
    if(impact>75){damageCar(game,c,impact*.038);game.crime(.12);game.shake=7;game.burst(c.x,c.y,'#ffc87b',8);}
  }
  for(const other of game.cars){
    if(other===c||distance(c,other)>29||Math.abs(c.speed)<32)continue;
    damageCar(game,other,impact*.075);damageCar(game,c,impact*.04);game.crime(.23);
    game.burst(c.x,c.y,'#ffd279',8);c.speed*=-.3;game.shake=8;
    break;
  }
  p.x=c.x;p.y=c.y;p.a=c.a;
}
