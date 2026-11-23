import {createGame,stepGame,followCamera} from './simulation.js';
import {createInput} from './input.js';
import {createAudio} from './audio.js';
import {loadSave,saveGame} from './save.js';
import {renderGame} from './render.js';
import {drawMenu,menuItems,menuHit} from './menus.js';
import {stageShot} from './shots.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d',{alpha:false});
const input=createInput(canvas),audio=createAudio();
const query=new URLSearchParams(location.search);
const seed=Number(query.get('seed')??7341)>>>0;
const shot=query.get('shot');
if(shot){
  const scene=createGame(seed,audio,()=>{});
  if(stageShot(scene,shot)){
    renderGame(ctx,scene);
    window.__shotReady=true;
  }else startApplication();
}else startApplication();

function startApplication(){
  let saved=loadSave(),game=createGame(seed,audio,saveGame),mode='title',back='title',selection=0;
  const backdrop=createGame(seed,audio,()=>{});
  backdrop.player.x=2630;backdrop.player.y=1500;backdrop.light=.48;
  followCamera(backdrop,1);
  let last=null,lag=0;
  const dt=1/60;
  function action(value){
    if(value==='continue'&&!saved){audio.blip(175);return;}
    audio.blip(395);
    if(value==='start'||value==='continue'){
      game=value==='continue'?createGame(saved.seed,audio,saveGame,saved):createGame(seed,audio,saveGame);
      mode='play';game.persist();
    }else if(value==='resume')mode='play';
    else if(value==='controls'){back=mode;mode='controls';}
    else if(value==='back')mode=back;
    else if(value==='title'){game.persist();saved=loadSave();mode='title';}
    selection=0;input.mouse.down=false;
  }
  function frame(now){
    const elapsed=last===null?0:Math.min(.10,(now-last)/1000);last=now;
    const oldMode=mode,pressed=input.pressed;
    if(pressed.size)audio.wake();
    if(pressed.has('KeyM'))audio.toggle();
    if(pressed.has('Escape')||pressed.has('KeyP')){
      if(mode==='play'){game.persist();mode='pause';selection=0;}
      else if(mode==='pause')action('resume');
      else if(mode==='controls')action('back');
    }
    if(mode!=='play'){
      const items=menuItems(mode,!!saved);
      if(pressed.has('ArrowDown')||pressed.has('KeyS'))selection=(selection+1)%items.length;
      if(pressed.has('ArrowUp')||pressed.has('KeyW'))selection=(selection-1+items.length)%items.length;
      if(pressed.has('Enter')&&mode===oldMode)action(items[selection].value);
      else if(pressed.has('Click')){
        const hit=menuHit(mode,items,input.mouse);
        if(hit>=0)action(items[hit].value);
      }
    }
    if(mode==='play'){
      lag+=elapsed;
      while(lag>=dt){
        stepGame(game,input,dt);
        if(game.tick%300===0&&game.player.hp>0)game.persist();
        pressed.clear();lag-=dt;
      }
      renderGame(ctx,game);
    }else{
      lag=0;audio.update(null,0,false,elapsed);
      if(mode==='title'||mode==='controls'&&back==='title'){
        backdrop.time+=elapsed;renderGame(ctx,backdrop,false);
      }else renderGame(ctx,game);
      drawMenu(ctx,mode,!!saved,selection,audio.muted);
    }
    if(mode!=='play'||oldMode!=='play')pressed.clear();
    requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide',()=>{if((mode==='play'||mode==='pause')&&game.player.hp>0)game.persist();});
  requestAnimationFrame(frame);
}
