import {distance} from './config.js';
import {junction} from './city.js';
import {createCar} from './vehicles.js';

export const chapters=[
  {name:'A LINE IN THE SAND',start:[4,3],type:'visit',target:[5,3],goal:'Meet Inez at the tram circle',story:'Inez has a name for the officer selling the harbor. Meet her before he finds hers.',pay:300},
  {name:'BORROWED SUN',start:[5,3],type:'steal',target:[5,4],goal:'Steal the copper Marlin',story:'The buyer left his Marlin outside the baths. The port ledger is in its glovebox.',pay:550},
  {name:'LOW TIDE',start:[5,4],type:'deliver',target:[7,5],goal:'Deliver a car to the seawall',story:'Inez can open the ledger at the seawall. Bring a car with enough room for a quick exit.',pay:700},
  {name:'DEAD FREQUENCY',start:[7,5],type:'target',target:[7,4],goal:'Take out Vale’s two enforcers',story:'Vale has cornered Inez near the marina. Clear the junction so she can get out.',pay:1050},
  {name:'ALL CHANNELS',start:[7,4],type:'evade',target:[6,2],goal:'Lose the police and reach the lookout',story:'The ledger is public. Vale has every cruiser looking for you. Head for the hills.',pay:1450},
  {name:'THE LAST FERRY',start:[6,2],type:'visit',target:[8,1],goal:'Reach the ferry lights',story:'Inez has two seats on the night crossing. Follow the shore to the ferry lights.',pay:2000}
];
export function createMission(index=0){
  return {index,active:false,car:null,banner:'WELCOME TO SOLARA',detail:'The harbor belongs to whoever can keep its secrets.',timer:7};
}
export function missionPoint(game){
  const m=game.mission,c=chapters[m.index];
  return c?(m.active&&m.car?m.car:junction(...(m.active?c.target:c.start))):null;
}
export function updateMission(game,dt){
  const m=game.mission,p=game.player,c=chapters[m.index];
  m.timer=Math.max(0,m.timer-dt);
  if(!c)return;
  const point=missionPoint(game),d=distance(point,p);
  if(!m.active){
    if(d>52||m.timer>0&&m.banner==='CONTRACT COMPLETE')return;
    m.active=true;m.banner=c.name;m.detail=c.story;m.timer=6;
    const target=junction(...c.target);
    if(c.type==='steal'){
      m.car=createCar(target.x+25,target.y+24,0,'#ff9e58','contract');
      game.cars.push(m.car);
    }
    if(c.type==='target'){
      game.enemies=[[-42,13],[61,-16]].map(([x,y],i)=>({x:target.x+x,y:target.y+y,a:0,hp:60,cooldown:1+i*.6,hostile:true,color:'#e37584'}));
    }
    if(c.type==='evade')game.crime(3.65);
    game.audio.blip(425);return;
  }
  if(c.type==='steal'&&m.car.hp<=0){
    const target=junction(...c.target);
    m.car=createCar(target.x+25,target.y+24,0,'#ff9e58','contract');game.cars.push(m.car);
  }
  const done={
    visit:d<48,steal:!!m.car&&p.car===m.car,deliver:d<56&&!!p.car,
    target:game.enemies.length>0&&game.enemies.every(e=>e.hp<=0),evade:d<76&&game.police.heat<=.06
  }[c.type];
  if(!done)return;
  p.money+=c.pay;p.ammo=Math.min(120,p.ammo+22);p.hp=Math.min(100,p.hp+25);
  m.index++;m.active=false;m.car=null;m.timer=5;
  m.banner=m.index===chapters.length?'SOLARA IS YOURS':'CONTRACT COMPLETE';
  m.detail=m.index===chapters.length?'Vale is finished. The city is yours to explore.':c.name+'   /   +$'+c.pay;
  game.audio.blip(760);game.persist();
}
