import {moveWithCollisions} from './city.js';
import {drivePlayer,toggleVehicle} from './vehicles.js';
import {firePlayerWeapon} from './combat.js';

export function createPlayer(x,y){
  return {x,y,a:0,step:0,hp:100,money:0,ammo:96,car:null,cooldown:0,flash:0};
}
export function updatePlayer(game,input,dt){
  const p=game.player;
  if(input.pressed.has('KeyE'))toggleVehicle(game);
  if(p.car)drivePlayer(game,input,dt);
  else{
    const axis=input.axis(), length=Math.hypot(axis.x,axis.y);
    const speed=input.on('ShiftLeft','ShiftRight')?237:152;
    if(length){
      moveWithCollisions(game.city,p,axis.x/length*speed*dt,axis.y/length*speed*dt,8);
      p.step+=speed*dt*.085;
    }else p.step=0;
    p.a=Math.atan2(input.mouse.y+game.camera.y-p.y,input.mouse.x+game.camera.x-p.x);
  }
  p.cooldown=Math.max(0,p.cooldown-dt);
  p.flash=Math.max(0,p.flash-dt);
  if(input.mouse.down){
    const aim=Math.atan2(input.mouse.y+game.camera.y-p.y,input.mouse.x+game.camera.x-p.x);
    firePlayerWeapon(game,aim);
  }
}
