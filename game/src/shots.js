import {createCar} from './vehicles.js';
import {createPoliceCar} from './police.js';
import {createPedestrian} from './pedestrians.js';
import {firePlayerWeapon,shoot} from './combat.js';
import {followCamera,stepGame} from './simulation.js';
import {distance} from './config.js';

const idle={axis:()=>({x:0,y:0}),mouse:{x:900,y:350,down:false},pressed:new Set(),on:()=>false};
const scenes={
  chase:{x:2573,y:1507,light:.54,index:4,heat:3.89,money:4310,hp:76,car:'#f6a265',speed:307,banner:'ALL CHANNELS',detail:'The ledger is public. Get out of sight and reach the lookout.'},
  foot:{x:2581,y:1553,light:.13,index:3,heat:0,money:1550,hp:100,banner:'DEAD FREQUENCY',detail:'Inez is pinned down by the marina. Find her before Vale does.'},
  drive:{x:2621,y:1505,light:.67,index:2,heat:1.51,money:850,hp:91,car:'#78dac9',speed:229,banner:'LOW TIDE',detail:'Deliver the car to Inez at the seawall.'},
  mission:{x:2574,y:1501,light:.39,index:3,heat:1.61,money:1550,hp:83,banner:'DEAD FREQUENCY',detail:'Take out Vale’s enforcers and clear the marina junction.'}
};
export function stageShot(game,name){
  const s=scenes[name];
  if(!s)return false;
  for(let frame=0;frame<108;frame++)stepGame(game,idle,1/60);
  const p=game.player;
  Object.assign(p,{x:s.x,y:s.y,a:name==='foot'?.29:-.04,step:1.6,hp:s.hp,money:s.money,ammo:72});
  const chase=name==='chase',drive=name==='drive';
  game.light=s.light;game.shake=0;game.time=16.25;
  game.cars=game.cars.filter(c=>distance(c,p)>145);
  game.people=game.people.filter(person=>distance(person,p)>65);
  Object.assign(game.mission,{index:s.index,active:true,timer:8,banner:s.banner,detail:s.detail});
  Object.assign(game.police,{heat:s.heat,quiet:0});
  if(s.car){
    const c=createCar(p.x,p.y,p.a,s.car);c.speed=s.speed;c.driver='player';c.owned=true;
    p.car=c;game.cars.push(c);
  }
  if(chase||drive){
    const spots=chase?[[-84,-8],[-179,14],[-252,-19],[-377,18]]:[[-133,-3],[-277,18]];
    for(const [x,y] of spots)game.cars.push(createPoliceCar(p.x+x,p.y+y,-.06+y*.004));
    if(chase)game.police.heli={x:p.x-133,y:p.y-133,a:.21};
    for(let i=0;i<24;i++){
      const t=i/23;
      game.tracks.push({x:p.x-19-i*7,y:p.y+63*t*t,a:-Math.atan(t*.71),life:8-i*.17});
    }
    game.burst(p.x-38,p.y+9,'#ffbd77',12);
  }
  for(const [x,y,a,color] of [[2862,1480,Math.PI,'#e19b8c'],[2756,1480,Math.PI,'#a7b3cc'],[2815,1520,0,'#f6d197'],[2926,1659,-Math.PI/2,'#8dc6bd'],[2551,1698,-Math.PI/2,'#d1b6dc'],[2384,1520,0,'#e0b288']]){
    const c=createCar(x,y,a,color);
    c.driver='traffic';c.speed=108;game.cars.push(c);
  }
  if(name==='foot'){
    for(const [x,y,a,color] of [[-35,0,.3,'#ffb57f'],[34,0,2.9,'#81e1cd'],[69,2,3.1,'#c8a0ed'],[100,4,0,'#f1d37d'],[1,84,1.6,'#83bef0'],[-38,-94,2.1,'#e1a0a9']]){
      const walker=createPedestrian(p.x+x,p.y+y,color);walker.a=a;walker.step=x;game.people.push(walker);
    }
  }
  if(name==='mission'){
    game.enemies=[[116,-15],[165,33]].map(([x,y],i)=>({x:p.x+x,y:p.y+y,hp:60-i*30,a:Math.PI,hostile:true,color:'#ec8198',cooldown:1}));
    p.a=Math.atan2(-15,116);
    firePlayerWeapon(game);game.police.heat=s.heat;
    const b=game.bullets.at(-1);b.x+=b.vx*.075;b.y+=b.vy*.075;
    shoot(game,game.enemies[1],Math.PI+.19,'enemy');
    const reply=game.bullets.at(-1);reply.x+=reply.vx*.09;reply.y+=reply.vy*.09;
    game.burst(p.x+115,p.y-15,'#f47d93',14);game.burst(p.x+96,p.y+14,'#ffe092',15);
    for(const spark of game.particles){spark.x+=spark.vx*.12;spark.y+=spark.vy*.12;}
  }
  followCamera(game,1);
  return true;
}
