import {WIDTH,HEIGHT,WORLD_W,WORLD_H,clamp} from './config.js';
import {seededRandom} from './random.js';
import {createCity,solid,junction} from './city.js';
import {createPlayer,updatePlayer} from './player.js';
import {seedTraffic,updateTraffic} from './traffic.js';
import {seedPedestrians,updatePedestrians} from './pedestrians.js';
import {reportCrime,updatePolice,stars} from './police.js';
import {updateCombat} from './combat.js';
import {createMission,updateMission,chapters} from './missions.js';
const spawn={x:1475,y:1221};
export function createGame(seed,audio,persist,saved){
  const random=seededRandom(seed),city=createCity(seed);
  const position=saved&&!solid(city,saved.x,saved.y,8)?saved:spawn;
  const player=createPlayer(position.x,position.y);
  player.money=Math.max(0,saved?.money??0);
  const game={
    seed,random,city,player,audio,tick:0,time:0,light:.34,shake:0,dead:0,
    camera:{x:0,y:0},cars:seedTraffic(random),people:seedPedestrians(random),enemies:[],tracks:[],
    bullets:[],flashes:[],particles:[],mission:createMission(clamp(Math.floor(saved?.mission??0),0,chapters.length)),
    police:{heat:clamp(saved?.heat??0,0,5),quiet:0,spawn:0,heli:null},
    pickups:Array.from({length:24},(_,i)=>{
      const point=junction(1+i%7,Math.floor(i/7)*2);
      return {x:point.x+75,y:point.y+60,timer:0};
    }),
    persist:()=>persist(game),
    crime:intensity=>reportCrime(game.police,intensity),
    burst(x,y,color,count){
      for(let i=0;i<count;i++){
        const a=random()*Math.PI*2,speed=24+random()*172;
        game.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.25+random()*.47,color,size:1+random()*3});
      }
    }
  };
  followCamera(game,1);
  return game;
}
export function followCamera(game,weight){
  const p=game.player;
  const x=clamp(p.x-WIDTH/2,0,WORLD_W-WIDTH),y=clamp(p.y-HEIGHT/2,0,WORLD_H-HEIGHT);
  game.camera.x+=(x-game.camera.x)*weight;game.camera.y+=(y-game.camera.y)*weight;
}
function respawn(game){
  const p=game.player;
  if(p.car){p.car.driver='parked';p.car.speed=0;}
  Object.assign(p,createPlayer(spawn.x,spawn.y),{money:Math.max(0,p.money-150)});
  Object.assign(game.police,{heat:0,quiet:0,spawn:0,heli:null});
  game.bullets=[];game.enemies=[];game.mission=createMission(game.mission.index);
  game.mission.banner='BACK ON THE STREET';game.mission.detail='Clinic fee   /   up to $150';
  followCamera(game,1);game.persist();
}
export function stepGame(game,input,dt){
  game.tick++;game.time+=dt;game.shake*=Math.pow(.035,dt);
  game.light=.32+.27*Math.sin(game.time*.009);
  if(game.player.hp>0){
    updatePlayer(game,input,dt);updateTraffic(game,dt);updatePedestrians(game,dt);
    updatePolice(game,dt);updateCombat(game,dt);
    if(game.player.hp>0)updateMission(game,dt);
  }else{
    game.dead+=dt;
    if(game.dead>2.2){respawn(game);game.dead=0;}
  }
  for(const track of game.tracks)track.life-=dt;
  game.tracks=game.tracks.filter(t=>t.life>0);
  for(const p of game.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}
  game.particles=game.particles.filter(p=>p.life>0);
  followCamera(game,1-Math.pow(.0018,dt));
  game.audio.update(game.player.car?.speed??null,stars(game.police),true,dt);
}
