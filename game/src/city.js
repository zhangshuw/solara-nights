import {CELL,ROAD,COLS,ROWS,WORLD_W,WORLD_H} from './config.js';
import {seededRandom,choose} from './random.js';

const roofs=['#d9886e','#e4b384','#c57e78','#aaa895','#e2c296','#b8a08c','#8ea9a4'];
const signs=['LUMA','PALOMA','AFTERGLOW','ORBIT','MOTEL','SUNLINE','MAR AZUL','CIRRUS','SODA CLUB'];
export const coastX=(y)=>2988+10*Math.sin(y/138)+7*Math.sin(y/67);
export const junction=(column,row)=>({x:column*CELL+52,y:row*CELL+52});
export function createCity(seed){
  const random=seededRandom(seed^9123), blocks=[], buildings=[];
  for(let row=0;row<ROWS;row++) for(let col=0;col<8;col++){
    const x=col*CELL+ROAD,y=row*CELL+ROAD;
    const park=(col+row*3)%7===0 || (col===6&&row===3);
    const block={x,y,col,row,park,trees:[],buildings:[]};
    for(let i=0;i<(park?24:7);i++){
      const tx=park?13+random()*229:(i<4?11:244);
      block.trees.push({x:x+tx,y:y+13+random()*229,r:8+random()*8,palm:!park||i%4===0});
    }
    if(!park){
      for(let i=0;i<4;i++){
        const bx=x+28+(i%2)*105,by=y+26+Math.floor(i/2)*105;
        const building={x:bx,y:by,w:73+random()*16,h:71+random()*17,z:12+random()*28,color:choose(random,roofs),
          sign:random()<.37?choose(random,signs):'', style:Math.floor(random()*4)};
        block.buildings.push(building); buildings.push(building);
      }
    }
    blocks.push(block);
  }
  return {blocks,buildings};
}

export function solid(city,x,y,r=8){
  if(x<r||y<r||y>WORLD_H-r||x>Math.min(WORLD_W-r,coastX(y)+143-r))return true;
  const col=Math.floor(x/CELL),row=Math.floor(y/CELL);
  const block=city.blocks[row*8+col];
  if(!block||block.col!==col||block.row!==row)return false;
  return block.buildings.some(b=>x+r>b.x&&y+r>b.y&&x-r<b.x+b.w&&y-r<b.y+b.h);
}
export function moveWithCollisions(city,body,dx,dy,r){
  let hit=false;
  if(!solid(city,body.x+dx,body.y,r))body.x+=dx;else hit=true;
  if(!solid(city,body.x,body.y+dy,r))body.y+=dy;else hit=true;
  return hit;
}
