import {CELL,carColors,angleDelta,distance} from './config.js';
import {createCar} from './vehicles.js';
import {choose} from './random.js';

const directions=[[1,0],[0,1],[-1,0],[0,-1]];
const lanePoint=(col,row,dir)=>({x:col*CELL+52-directions[dir][1]*21,y:row*CELL+52+directions[dir][0]*21});
export function seedTraffic(random){
  const cars=[];
  for(let i=0;i<100;i++){
    const col=i%8,row=Math.floor(i/8)%8,dir=i%2===0?0:2;
    const start=lanePoint(col,row,dir), shift=(i<64?.27:.78)*CELL;
    const x=start.x+directions[dir][0]*shift;
    if(x<45||x>2880)continue;
    const c=createCar(x,start.y,dir*Math.PI/2,choose(random,carColors));
    c.driver='traffic';c.dir=dir;c.cruise=76+random()*57;c.col=col+directions[dir][0];c.row=row;
    c.target=lanePoint(c.col,c.row,dir);cars.push(c);
  }
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const c=createCar(col*CELL+91,row*CELL+168,Math.PI/2,choose(random,carColors));
    cars.push(c);
  }
  return cars;
}
export function updateTraffic(game,dt){
  for(const c of game.cars){
    if(c.driver!=='traffic')continue;
    if(distance(c,c.target)<11){
      const options=[c.dir,(c.dir+1)%4,(c.dir+3)%4,(c.dir+2)%4].filter(dir=>{
        const [dx,dy]=directions[dir];return c.col+dx>=0&&c.col+dx<=8&&c.row+dy>=0&&c.row+dy<=7;
      });
      const forward=options.includes(c.dir)&&game.random()<.69;
      c.dir=forward?c.dir:choose(game.random,options.length>1?options.filter(dir=>dir!==(c.dir+2)%4):options);
      c.col+=directions[c.dir][0];c.row+=directions[c.dir][1];
      c.target=lanePoint(c.col,c.row,c.dir);
    }
    const a=Math.atan2(c.target.y-c.y,c.target.x-c.x);
    const blocked=game.cars.some(o=>{
      if(o===c||Math.abs(o.x-c.x)>62||Math.abs(o.y-c.y)>62)return false;
      const dx=o.x-c.x,dy=o.y-c.y, ahead=dx*Math.cos(a)+dy*Math.sin(a);
      return ahead>0&&ahead<55&&Math.abs(dy*Math.cos(a)-dx*Math.sin(a))<20;
    });
    c.speed+=( (blocked?0:c.cruise)-c.speed)*Math.min(1,dt*3.8);
    c.a+=angleDelta(a,c.a)*Math.min(1,dt*10);
    c.x+=Math.cos(a)*c.speed*dt;c.y+=Math.sin(a)*c.speed*dt;
  }
}
