export function createAudio(){
  let context,master,motor,siren,pad,noise,time=0,muted=false;
  function voice(type,freq){
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=type;oscillator.frequency.value=freq;gain.gain.value=0;
    oscillator.connect(gain).connect(master);oscillator.start();
    return {oscillator,gain};
  }
  function wake(){
    if(!globalThis.AudioContext)return;
    if(!context){
      context=new AudioContext();
      master=context.createGain();master.gain.value=muted?0:.49;master.connect(context.destination);
      motor=voice('triangle',35);siren=voice('sine',620);
      pad=[voice('sine',55),voice('sine',82.4),voice('sine',110.2)];
      noise=context.createBuffer(1,context.sampleRate*.24,context.sampleRate);
      const samples=noise.getChannelData(0);
      let state=931;
      for(let i=0;i<samples.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;samples[i]=(state/2147483648-1);}
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
  }
  function update(speed,wanted,active,dt){
    if(!context)return;
    time+=dt;
    const now=context.currentTime;
    motor.oscillator.frequency.setTargetAtTime(32+Math.abs(speed??0)*.21,now,.08);
    motor.gain.gain.setTargetAtTime(active&&speed!==null?.13:0,now,.12);
    siren.oscillator.frequency.setTargetAtTime(630+210*Math.sin(time*6.5),now,.05);
    siren.gain.gain.setTargetAtTime(active&&wanted?.018+wanted*.007:0,now,.19);
    pad.forEach((v,i)=>v.gain.gain.setTargetAtTime(active?.038+.016*Math.sin(time*.5+i):0,now,.4));
  }
  function shot(volume){
    if(!context)return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),now=context.currentTime;
    source.buffer=noise;filter.type='lowpass';filter.frequency.setValueAtTime(6600,now);filter.frequency.exponentialRampToValueAtTime(550,now+.105);
    gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15);
    source.connect(filter).connect(gain).connect(master);source.start();source.stop(now+.18);
  }
  function blip(freq){
    if(!context)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
    oscillator.frequency.setValueAtTime(freq,now);oscillator.frequency.exponentialRampToValueAtTime(freq*1.5,now+.19);
    gain.gain.setValueAtTime(.09,now);gain.gain.exponentialRampToValueAtTime(.001,now+.27);
    oscillator.connect(gain).connect(master);oscillator.start();oscillator.stop(now+.28);
  }
  return {wake,update,shot,blip,get muted(){return muted;},toggle(){muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.49,context.currentTime,.08);}};
}
