import {WIDTH,HEIGHT} from './config.js';
export function createInput(canvas){
  const held=new Set(), pressed=new Set();
  const mouse={x:WIDTH/2,y:HEIGHT/2,down:false};
  const keys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyE','KeyP','Escape','Enter','KeyM']);
  window.addEventListener('keydown',e=>{if(keys.has(e.code))e.preventDefault();if(!e.repeat)pressed.add(e.code);held.add(e.code);});
  window.addEventListener('keyup',e=>held.delete(e.code));
  window.addEventListener('blur',()=>{held.clear();pressed.clear();mouse.down=false;});
  function point(e){
    const rect=canvas.getBoundingClientRect();
    mouse.x=(e.clientX-rect.left)*WIDTH/rect.width;
    mouse.y=(e.clientY-rect.top)*HEIGHT/rect.height;
  }
  canvas.addEventListener('pointermove',point);
  canvas.addEventListener('pointerdown',e=>{if(e.button===0){point(e);mouse.down=true;pressed.add('Click');}});
  window.addEventListener('pointerup',()=>mouse.down=false);
  const on=(...codes)=>codes.some(code=>held.has(code));
  return {mouse,pressed,on,axis:()=>({x:+on('KeyD','ArrowRight')-+on('KeyA','ArrowLeft'),y:+on('KeyS','ArrowDown')-+on('KeyW','ArrowUp')})};
}
