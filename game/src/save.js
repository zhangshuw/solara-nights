const SLOT='solara-nights-v1';
export function loadSave(){
  try{
    const data=JSON.parse(localStorage.getItem(SLOT));
    return data&&['x','y','money','mission','heat','seed'].every(key=>Number.isFinite(data[key]))?data:null;
  }catch{return null;}
}
export function saveGame(game){
  try{
    const {x,y,money}=game.player;
    localStorage.setItem(SLOT,JSON.stringify({x,y,money,mission:game.mission.index,heat:game.police.heat,seed:game.seed}));
  }catch{}
}
