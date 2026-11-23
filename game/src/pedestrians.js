import {CELL,distance} from './config.js';
import {moveWithCollisions} from './city.js';
import {choose} from './random.js';
const coats=['#f89780','#f8d66d','#62ddd2','#e9e7d7','#bf98e8','#82b1e9'];
export function createPedestrian(x,y,color='#f8d66d',side=0){
  return {x,y,homeX:x,homeY:y,a:0,step:0,hp:45,panic:0,color,side,pace:34};
}
export function seedPedestrians(random){
  const people=[];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++)for(let index=0;index<5;index++){
    const side=index%2;
    const p=createPedestrian(col*CELL+(side?111:33+random()*286),row*CELL+(side?110+random()*231:111),choose(random,coats),side);
    p.pace=(random()<.5?-1:1)*(22+random()*24);people.push(p);
  }
  return people;
}
export function updatePedestrians(game,dt){
  for(const p of game.people){
    if(p.hp<=0||distance(p,game.player)>900)continue;
    const car=game.cars.find(c=>Math.abs(c.speed)>40&&distance(p,c)<83);
    if(car){
      p.panic=1.1;p.a=Math.atan2(p.y-car.y,p.x-car.x);
      if(distance(p,car)<23&&Math.abs(car.speed)>79){
        p.hp=0;game.burst(p.x,p.y,'#bc4c63',12);
        if(car===game.player.car){game.crime(1.05);car.speed*=.82;}
        continue;
      }
    }
    let vx=p.side?0:p.pace,vy=p.side?p.pace:0;
    if(p.panic>0){p.panic-=dt;vx=Math.cos(p.a)*106;vy=Math.sin(p.a)*106;}
    else if(distance(p,{x:p.homeX,y:p.homeY})>99){
      vx=(p.homeX-p.x)*.51;vy=(p.homeY-p.y)*.51;
    }
    if(Math.hypot(vx,vy)<4)p.pace=-p.pace;
    else p.a=Math.atan2(vy,vx);
    if(moveWithCollisions(game.city,p,vx*dt,vy*dt,6)){p.pace=-p.pace;if(p.panic>0)p.a+=1.6;}
    p.step+=Math.hypot(vx,vy)*dt*.16;
  }
}
export function frightenPedestrians(game,x,y){
  for(const p of game.people)if(distance(p,{x,y})<245){
    p.panic=2.8;p.a=Math.atan2(p.y-y,p.x-x);
  }
}
