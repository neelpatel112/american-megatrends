window.BiosAudio = (function () {
  'use strict';
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function beep(freq=800, duration=0.18, volume=0.35) {
    try {
      const c=getCtx(), osc=c.createOscillator(), gain=c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type='square'; osc.frequency.setValueAtTime(freq,c.currentTime);
      gain.gain.setValueAtTime(volume,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+duration);
      osc.start(c.currentTime); osc.stop(c.currentTime+duration+0.02);
    } catch(_){}
  }
  function postBeep() { beep(1050,0.14,0.3); }
  function errorBeep() {
    try {
      const c=getCtx();
      [0,0.22,0.44].forEach(t=>{
        const osc=c.createOscillator(),gain=c.createGain();
        osc.connect(gain); gain.connect(c.destination); osc.type='square';
        osc.frequency.setValueAtTime(440,c.currentTime+t);
        gain.gain.setValueAtTime(0.28,c.currentTime+t);
        gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t+0.18);
        osc.start(c.currentTime+t); osc.stop(c.currentTime+t+0.22);
      });
    } catch(_){}
  }
  function virusAlarm() {
    try {
      const c=getCtx();
      for(let i=0;i<8;i++){
        const t=i*0.12, osc=c.createOscillator(),gain=c.createGain();
        osc.connect(gain); gain.connect(c.destination); osc.type='square';
        osc.frequency.setValueAtTime(1200-i*80,c.currentTime+t);
        gain.gain.setValueAtTime(0.4,c.currentTime+t);
        gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t+0.1);
        osc.start(c.currentTime+t); osc.stop(c.currentTime+t+0.13);
      }
    } catch(_){}
  }
  function tick() {
    try {
      const c=getCtx(), bufSize=Math.floor(c.sampleRate*0.012);
      const buf=c.createBuffer(1,bufSize,c.sampleRate);
      const data=buf.getChannelData(0);
      for(let i=0;i<bufSize;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/bufSize,6)*0.18;
      const src=c.createBufferSource(); src.buffer=buf;
      const gain=c.createGain(); gain.gain.setValueAtTime(0.5,c.currentTime);
      src.connect(gain); gain.connect(c.destination); src.start();
    } catch(_){}
  }
  function hdSeek() {
    try {
      const c=getCtx(), osc=c.createOscillator(), gain=c.createGain(), dist=c.createWaveShaper();
      const curve=new Float32Array(256);
      for(let i=0;i<256;i++){const x=(i*2)/256-1; curve[i]=(Math.PI+200)*x/(Math.PI+200*Math.abs(x));}
      dist.curve=curve;
      osc.connect(dist); dist.connect(gain); gain.connect(c.destination); osc.type='sawtooth';
      osc.frequency.setValueAtTime(120,c.currentTime);
      osc.frequency.linearRampToValueAtTime(60,c.currentTime+0.09);
      osc.frequency.linearRampToValueAtTime(110,c.currentTime+0.18);
      gain.gain.setValueAtTime(0.07,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.22);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.25);
    } catch(_){}
  }
  function memTick() {
    try {
      const c=getCtx(), osc=c.createOscillator(), gain=c.createGain();
      osc.connect(gain); gain.connect(c.destination); osc.type='sine';
      osc.frequency.setValueAtTime(4200+Math.random()*800,c.currentTime);
      gain.gain.setValueAtTime(0.025,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.04);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.045);
    } catch(_){}
  }
  function fanSpinUp(durationMs=1800) {
    try {
      const c=getCtx(), dur=durationMs/1000;
      const bufSize=Math.floor(c.sampleRate*dur);
      const buf=c.createBuffer(1,bufSize,c.sampleRate);
      const data=buf.getChannelData(0);
      for(let i=0;i<bufSize;i++) data[i]=Math.random()*2-1;
      const src=c.createBufferSource(); src.buffer=buf;
      const lpf=c.createBiquadFilter(); lpf.type='lowpass';
      lpf.frequency.setValueAtTime(80,c.currentTime);
      lpf.frequency.exponentialRampToValueAtTime(900,c.currentTime+dur*0.7);
      lpf.frequency.linearRampToValueAtTime(600,c.currentTime+dur);
      const gain=c.createGain();
      gain.gain.setValueAtTime(0,c.currentTime);
      gain.gain.linearRampToValueAtTime(0.18,c.currentTime+dur*0.3);
      gain.gain.linearRampToValueAtTime(0.12,c.currentTime+dur);
      src.connect(lpf); lpf.connect(gain); gain.connect(c.destination);
      src.start(); src.stop(c.currentTime+dur+0.05);
    } catch(_){}
  }
  function degauss() {
    try {
      const c=getCtx();
      const osc=c.createOscillator(), gain=c.createGain();
      osc.connect(gain); gain.connect(c.destination); osc.type='sine';
      osc.frequency.setValueAtTime(55,c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28,c.currentTime+0.5);
      gain.gain.setValueAtTime(0.55,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.7);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.75);
      const osc2=c.createOscillator(), gain2=c.createGain();
      osc2.connect(gain2); gain2.connect(c.destination); osc2.type='sawtooth';
      osc2.frequency.setValueAtTime(180,c.currentTime+0.05);
      osc2.frequency.exponentialRampToValueAtTime(40,c.currentTime+0.45);
      gain2.gain.setValueAtTime(0.08,c.currentTime+0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);
      osc2.start(c.currentTime+0.05); osc2.stop(c.currentTime+0.55);
    } catch(_){}
  }
  function crtOn() {
    try {
      const c=getCtx(), bufSize=Math.floor(c.sampleRate*0.3);
      const buf=c.createBuffer(1,bufSize,c.sampleRate);
      const data=buf.getChannelData(0);
      for(let i=0;i<bufSize;i++){const t=i/bufSize; data[i]=(Math.random()*2-1)*0.25*Math.pow(1-t,2);}
      const src=c.createBufferSource(); src.buffer=buf;
      const gain=c.createGain(); gain.gain.setValueAtTime(0.6,c.currentTime);
      src.connect(gain); gain.connect(c.destination); src.start();
      const hum=c.createOscillator(), humGain=c.createGain();
      hum.connect(humGain); humGain.connect(c.destination); hum.type='sine';
      hum.frequency.setValueAtTime(60,c.currentTime);
      humGain.gain.setValueAtTime(0.04,c.currentTime);
      humGain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);
      hum.start(c.currentTime); hum.stop(c.currentTime+0.55);
    } catch(_){}
  }
  function crtOff() {
    try {
      const c=getCtx(), osc=c.createOscillator(), gain=c.createGain();
      osc.connect(gain); gain.connect(c.destination); osc.type='sine';
      osc.frequency.setValueAtTime(800,c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40,c.currentTime+0.22);
      gain.gain.setValueAtTime(0.18,c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.25);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.28);
    } catch(_){}
  }
  function navBeep(dir='move') {
    const freq=dir==='select'?1200:dir==='back'?600:900;
    beep(freq,0.06,0.15);
  }
  function shellKey() { beep(800+Math.random()*400, 0.04, 0.08); }
  return { postBeep, errorBeep, virusAlarm, tick, hdSeek, memTick, fanSpinUp, degauss, crtOn, crtOff, navBeep, beep, shellKey };
})();
 