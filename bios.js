/**
 * AMIBIOS Boot Engine
 * After handoff fires 'bios:complete' → dos.js takes over
 */
(function () {
  'use strict';
  const CFG=window.BIOS_CONFIG, SFX=window.BiosAudio;
  const FX=CFG.effects, SND=CFG.sounds, T=CFG.timing, EGG=CFG.easterEggs;
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const rand=(a,b)=>Math.random()*(b-a)+a;
  const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

  async function typeText(el,text,cd=16){
    el.textContent='';
    for(const ch of text){
      el.textContent+=ch;
      if(SND.typewriterSound&&ch.trim())SFX.tick();
      await delay(cd+rand(-4,4));
    }
  }

  function showPhase(id){
    document.querySelectorAll('.phase').forEach(p=>{p.classList.remove('active');p.style.display='none';});
    const el=document.getElementById(id);
    el.style.display='block'; void el.offsetWidth; el.classList.add('active');
  }

  const led=document.getElementById('power-led');
  function setLED(s){led.className=s==='off'?'led-off':s==='green'?'led-green':'led-amber';}

  function injectBarrelFilter(){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';
    svg.innerHTML=`<defs><filter id="barrel-filter" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feImage result="map" preserveAspectRatio="none" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='70%25'%3E%3Cstop offset='0%25' stop-color='%23808080'/%3E%3Cstop offset='100%25' stop-color='%23404040'/%3E%3C/radialGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G"/>
    </filter></defs>`;
    document.body.appendChild(svg);
    if(FX.barrelDistortion)document.getElementById('screen-wrap').classList.add('barrel');
  }

  const BURNIN=`AMIBIOS(C)2011 American Megatrends, Inc.           BIOS Date: 04/25/11 09:12:53  Ver: 08.00.15
Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz

Testing Memory:  4194304K ████████████████████

AMIBIOS(C)2011 American Megatrends Inc.
Verifying DMI Pool Data......Update Success!
SATA Port 0: ST3500418AS     Ultra DMA Mode-5, S.M.A.R.T. OK

    ___    __  ___ ____
   /   |  /  |/  //  _/
  / /| | / /|_/ / / /
 / ___ |/ /  / /_/ /
/_/  |_/_/  /_//___/`;

  function showBurnIn(){
    if(!FX.phosphorBurnIn)return;
    document.getElementById('burnin-layer').textContent=BURNIN;
  }

  let flickerInt=null,jitterInt=null,glitchInt=null;
  function startCRT(el){
    if(!el)return;
    if(FX.crtFlicker)flickerInt=setInterval(()=>{if(Math.random()<.06){el.style.filter=`brightness(${rand(.82,.96)})`;setTimeout(()=>{el.style.filter='';},rand(30,80));}},180);
    if(FX.screenJitter)jitterInt=setInterval(()=>{if(Math.random()<.04){el.style.transform=`translateX(${rand(-3,3)}px)`;setTimeout(()=>{el.style.transform='';},55);}},250);
    if(FX.glitchLines)glitchInt=setInterval(()=>{if(Math.random()<.07)spawnGlitch(el);},600);
  }
  function stopCRT(){clearInterval(flickerInt);clearInterval(jitterInt);clearInterval(glitchInt);}
  const GC='█▓▒░▄▀■□XXXXXXXX////\\\\';
  function spawnGlitch(p){
    const g=document.createElement('div');g.className='glitch-line';
    const l=Math.floor(rand(6,36));
    g.textContent=Array.from({length:l},()=>pick(GC.split(''))).join('');
    g.style.top=Math.floor(rand(10,90))+'%';g.style.left=Math.floor(rand(0,55))+'%';
    g.style.color=pick(['#ff5555','#ffff54','#55ff55','#aaaaff','#fff']);
    p.appendChild(g);setTimeout(()=>g.remove(),rand(55,175));
  }

  const POST_LINES=[
    {label:'AMIBIOS(C)2011 American Megatrends Inc.',     status:'',                            cls:'status-ok',  ms:200, hd:false},
    {label:'Initializing Intel(R) Boot Agent GE v1.3.43', status:'',                            cls:'status-ok',  ms:310, hd:false},
    {label:'PXE-MOF: Exiting Intel Boot Agent.',          status:'',                            cls:'status-ok',  ms:240, hd:false},
    {label:'Verifying DMI Pool Data',                      status:'......Update Success!',      cls:'status-ok',  ms:820, hd:false},
    {label:'SATA Port 0: ST3500418AS',                     status:'Ultra DMA Mode-5, S.M.A.R.T. OK',cls:'status-ok',ms:360,hd:true},
    {label:'SATA Port 1:',                                 status:'Not Detected',               cls:'status-warn',ms:185, hd:false},
    {label:'SATA Port 2:',                                 status:'Not Detected',               cls:'status-warn',ms:185, hd:false},
    {label:'SATA Port 3:',                                 status:'Not Detected',               cls:'status-warn',ms:185, hd:false},
    {label:'USB Device(s):',                               status:'1 Keyboard, 1 Mouse, 1 Hub', cls:'status-ok',  ms:400, hd:false},
    {label:'Auto-detecting USB Mass Storage..',            status:'1 Device Found',             cls:'status-ok',  ms:570, hd:false},
    {label:'Checking NVRAM..',                             status:'OK',                         cls:'status-ok',  ms:255, hd:false},
    {label:'Loading Setup Defaults..',                     status:'Done',                       cls:'status-ok',  ms:295, hd:false},
  ];

  function addPostLine(label,status,cls){
    const wrap=document.getElementById('post-lines');
    const row=document.createElement('div');row.className='post-line';
    row.innerHTML=`<span class="label">${label}</span><span class="${cls||'status-ok'}">${status||''}</span>`;
    wrap.appendChild(row);
  }

  /* ── Virus Pranks ──────────────────────────────────── */
  const VIRUS_SCRIPTS=[
    async function cryptoViper(){
      const o=document.getElementById('virus-overlay');
      o.style.cssText='display:flex;flex-direction:column;gap:2px;padding:14px;';
      document.getElementById('screen-wrap').classList.add('virus-red-tint');
      SFX.virusAlarm();
      const lines=[
        ['red','!! WARNING: CRYPTOVIPER v3.1.4 RANSOMWARE DETECTED !!'],
        ['yellow',''],
        ['white','Scanning system files...'],
      ];
      for(const[cls,text]of lines){
        const d=document.createElement('div');d.className=`virus-line ${cls}`;d.textContent=text;o.appendChild(d);await delay(90);
      }
      const FILES=['C:\\Windows\\System32\\kernel32.dll','C:\\Users\\Admin\\Documents\\passwords.txt','C:\\Users\\Admin\\Desktop\\banking.xlsx','C:\\Windows\\System32\\ntoskrnl.exe','C:\\Users\\Admin\\Pictures\\','C:\\Program Files\\'];
      for(const f of FILES){
        const d=document.createElement('div');d.className='virus-line red';d.textContent=`  [ENCRYPTING] ${f}`;o.appendChild(d);SFX.hdSeek();await delay(rand(130,270));
      }
      await delay(300);
      const w=document.createElement('div');w.className='virus-line yellow blink';w.textContent='  YOUR FILES ARE BEING ENCRYPTED. DO NOT TURN OFF YOUR COMPUTER.';o.appendChild(w);
      const b=document.createElement('div');b.className='virus-line white';b.textContent='  Send 0.5 BTC to: 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf9Nc';o.appendChild(b);
      SFX.virusAlarm();await delay(3800);
      o.innerHTML='';
      const j=document.createElement('div');j.className='virus-line green';j.style.cssText='font-size:clamp(14px,2vw,22px);text-align:center;margin-top:30%;';j.textContent='😂  lol just kidding. your files are fine bro.';o.appendChild(j);
      SFX.beep(880,.2,.3);await delay(2500);
      document.getElementById('screen-wrap').classList.remove('virus-red-tint');
      o.style.display='none';o.innerHTML='';
    },
    async function ghostRAT(){
      const o=document.getElementById('virus-overlay');
      o.style.cssText='display:flex;flex-direction:column;gap:2px;padding:14px;color:#00ff00;';
      SFX.errorBeep();await delay(200);
      const lines=[
        ['','Microsoft Windows [Version 5.1.2600]'],
        ['',''],
        ['#ff3333','ALERT: UNAUTHORIZED REMOTE CONNECTION DETECTED'],
        ['',''],
        ['','Active Connections:'],
        ['#ffff54','  TCP    192.168.1.5:1337     185.220.101.47:4444  ESTABLISHED'],
        ['#ff3333','  TCP    192.168.1.5:9999     *.*.*.*:31337        SYN_SENT'],
        ['',''],
        ['#ff3333','WARNING: GHOST_RAT v2.7 backdoor detected'],
        ['#ff3333','  keylogger.exe   PID:6666   Mem:512KB'],
        ['#ff3333','  screengrab.exe  PID:4444   Mem:768KB'],
        ['',''],
        ['#ffff54','Uploading data to remote server...'],
      ];
      for(const[color,text]of lines){
        const d=document.createElement('div');d.className='virus-line';d.style.color=color||'#00ff00';d.textContent=text;o.appendChild(d);
        if(SND.typewriterSound&&text.trim())SFX.tick();await delay(rand(60,130));
      }
      const pbar=document.createElement('div');pbar.className='virus-line';pbar.style.color='#ff3333';o.appendChild(pbar);
      for(let i=0;i<=100;i+=2){const bar='█'.repeat(Math.floor(i/5)).padEnd(20,'░');pbar.textContent=`  Upload: [${bar}] ${i}%`;await delay(55);}
      await delay(400);
      const d2=document.createElement('div');d2.className='virus-line';d2.style.color='#ff3333';d2.textContent='  Upload complete. 2.4 GB sent.';o.appendChild(d2);
      SFX.virusAlarm();await delay(2500);
      o.innerHTML='';
      const j=document.createElement('div');j.className='virus-line';j.style.cssText='color:#55ff55;font-size:clamp(13px,1.8vw,20px);text-align:center;margin-top:30%;';j.textContent='🤣  gotcha. 100% fake. relax bro.';o.appendChild(j);
      SFX.beep(660,.15,.25);await delay(2500);o.style.display='none';o.innerHTML='';
    },
    async function biosCorrupt(){
      const o=document.getElementById('virus-overlay');
      o.style.cssText='display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;background:#000;';
      document.getElementById('screen-wrap').classList.add('virus-red-tint');
      SFX.errorBeep();await delay(300);SFX.errorBeep();
      const msgs=[
        {text:'!! CRITICAL BIOS CORRUPTION DETECTED !!',color:'#ff0000',size:'clamp(14px,2vw,22px)'},
        {text:'',color:'#fff',size:''},
        {text:'Firmware integrity check: FAILED',color:'#ff5555',size:''},
        {text:'',color:'#fff',size:''},
        {text:'Attempting recovery from backup...',color:'#ffff54',size:''},
      ];
      for(const m of msgs){
        const d=document.createElement('div');d.style.cssText=`color:${m.color};font-family:'Share Tech Mono',monospace;${m.size?`font-size:${m.size};`:''}`;d.textContent=m.text;o.appendChild(d);await delay(350);
      }
      const wrap=document.createElement('div');wrap.style.cssText='width:60%;border:1px solid #ff4400;height:14px;margin-top:8px;';
      const fill=document.createElement('div');fill.style.cssText='height:100%;background:linear-gradient(90deg,#660000,#ff2200);width:0%;transition:width .05s';
      wrap.appendChild(fill);o.appendChild(wrap);
      const pct=document.createElement('div');pct.style.cssText="color:#ff8844;font-family:'Share Tech Mono',monospace;";o.appendChild(pct);
      for(let i=0;i<=47;i++){fill.style.width=i+'%';pct.textContent=`Recovery: ${i}%`;await delay(60);}
      await delay(200);fill.style.background='#ff0000';
      const fail=document.createElement('div');fail.style.cssText="color:#ff0000;font-family:'Share Tech Mono',monospace;font-size:clamp(13px,1.8vw,18px);margin-top:10px;";fail.textContent='RECOVERY FAILED — SYSTEM UNBOOTABLE';o.appendChild(fail);
      SFX.virusAlarm();await delay(300);SFX.virusAlarm();
      await delay(1500);o.style.background='#000';o.innerHTML='';await delay(800);
      const j=document.createElement('div');j.style.cssText="color:#55ff55;font-family:'Share Tech Mono',monospace;font-size:clamp(13px,1.8vw,19px);text-align:center;";j.textContent='😂  psyche. your BIOS is fine. stop sweating lmao.';o.appendChild(j);
      SFX.beep(523,.15,.25);await delay(2500);
      document.getElementById('screen-wrap').classList.remove('virus-red-tint');
      o.style.display='none';o.innerHTML='';
    },
  ];
  async function maybeVirusPrank(){if(Math.random()>EGG.virusChance)return;await pick(VIRUS_SCRIPTS)();}

  /* ── DOOM ──────────────────────────────────────────── */
  let doomBuf='';
  function checkDoom(k){
    if(!EGG.doomUnlock)return;
    doomBuf+=k.toLowerCase();if(doomBuf.length>4)doomBuf=doomBuf.slice(-4);
    if(doomBuf==='doom'){doomBuf='';triggerDoom();}
  }
  async function triggerDoom(){
    const o=document.getElementById('doom-overlay');o.style.display='flex';
    const logo=document.createElement('div');logo.className='doom-logo';logo.textContent='DOOM';o.appendChild(logo);
    const sub=document.createElement('div');sub.className='doom-sub';sub.textContent='id Software · 1993  —  Loading...';o.appendChild(sub);
    const bw=document.createElement('div');bw.className='doom-bar';
    const bf=document.createElement('div');bf.className='doom-fill';bw.appendChild(bf);o.appendChild(bw);
    const pct=document.createElement('div');pct.className='doom-pct';o.appendChild(pct);
    SFX.beep(220,.3,.4);await delay(200);SFX.beep(165,.3,.35);
    for(let i=0;i<=100;i++){bf.style.width=i+'%';pct.textContent=i+'%';await delay(rand(30,60));}
    await delay(300);pct.textContent='Error: DOOM.EXE not found on this system.';pct.style.color='#ff5555';SFX.errorBeep();await delay(2000);
    const j=document.createElement('div');j.className='doom-sub';j.style.cssText='color:#55ff55;margin-top:12px;';j.textContent='(nice try though 👾)';o.appendChild(j);
    await delay(2000);o.style.display='none';o.innerHTML='';
  }

  /* ── Keyboard not found ────────────────────────────── */
  async function maybeKeyboardJoke(){
    if(Math.random()>EGG.keyboardJoke)return;
    const joke=document.createElement('div');joke.className='kbd-joke';joke.textContent='Keyboard not found — Press any key to continue';
    document.getElementById('screen-wrap').appendChild(joke);
    await delay(5000);joke.remove();
  }

  /* ── CMOS error ────────────────────────────────────── */
  async function maybeFakeError(){
    if(Math.random()>EGG.failChance)return;
    SFX.errorBeep();addPostLine('!! CMOS Checksum Error — Defaults Loaded !!','','status-fail');
    await delay(1100);addPostLine('Press F1 to Run SETUP, F2 to Load Defaults','','status-warn');
    await delay(2100);addPostLine('Continuing with defaults...','','status-ok');await delay(700);
  }

  /* ── Phases ────────────────────────────────────────── */
  async function phaseBlack(){
    showPhase('phase-black');setLED('amber');
    if(SND.fanSpinUp)SFX.fanSpinUp(T.fanSpinDuration);
    await delay(T.fanSpinDuration*.6);
    setLED('green');SFX.crtOn();
    if(SND.degauss){
      await delay(120);SFX.degauss();
      const sw=document.getElementById('screen-wrap');sw.classList.add('degauss-flash');
      setTimeout(()=>sw.classList.remove('degauss-flash'),700);
    }
    await delay(T.blackFlash);
  }

  async function phasePost(){
    showPhase('phase-post');showBurnIn();
    const screen=document.querySelector('#phase-post .bios-screen');
    startCRT(screen);
    await delay(280);if(SND.postBeep)SFX.postBeep();
    await typeText(document.getElementById('cpu-line'),CFG.cpu,13);await delay(180);
    const memLine=document.getElementById('mem-test-line');
    memLine.innerHTML='<span>Testing Memory: </span>';
    const countEl=document.createElement('span');countEl.className='mem-count';memLine.appendChild(countEl);
    const barOut=document.createElement('span');barOut.className='mem-bar-outer';
    const barIn=document.createElement('span');barIn.className='mem-bar-inner';barOut.appendChild(barIn);memLine.appendChild(barOut);
    const totalKB=CFG.ramMB*1024,steps=220,step=Math.floor(totalKB/steps);
    let cur=0,tc=0;
    while(cur<totalKB){cur=Math.min(cur+step,totalKB);countEl.textContent=cur.toLocaleString()+'K';barIn.style.width=((cur/totalKB)*100).toFixed(1)+'%';tc++;if(SND.typewriterSound&&tc%8===0)SFX.memTick();await delay(T.memCountDuration/steps);}
    await delay(120);memLine.style.display='none';document.getElementById('mem-ok-line').style.display='block';SFX.beep(1200,.08,.2);await delay(280);
    for(const item of POST_LINES){await delay(item.ms+rand(-40,60));if(item.hd&&SND.hdSeekSound)SFX.hdSeek();addPostLine(item.label,item.status,item.cls);}
    await delay(400);await maybeFakeError();await maybeKeyboardJoke();await maybeVirusPrank();await delay(500);stopCRT();
  }

  async function phaseSummary(){
    document.getElementById('sum-cpu').textContent=CFG.cpu;
    document.getElementById('sum-speed').textContent=CFG.cpuSpeed;
    document.getElementById('sum-ram').textContent=CFG.ramMB+' MB';
    document.getElementById('sum-ramfreq').textContent=CFG.ramFrequency;
    document.getElementById('sum-pri-m').textContent=CFG.drives.priMaster;
    document.getElementById('sum-pri-s').textContent=CFG.drives.priSlave;
    document.getElementById('sum-sec-m').textContent=CFG.drives.secMaster;
    document.getElementById('sum-sec-s').textContent=CFG.drives.secSlave;
    const boEl=document.getElementById('boot-order-list');boEl.innerHTML='';
    CFG.bootOrder.forEach((b,i)=>{const d=document.createElement('div');d.className='boot-order-item';d.textContent=`${i+1}. ${b}`;boEl.appendChild(d);});
    showPhase('phase-summary');startCRT(document.querySelector('#phase-summary .bios-screen'));
    await delay(T.summaryHold);stopCRT();
  }

  async function phaseHandoff(){
    setLED('amber');SFX.crtOff();
    const s=document.querySelector('#phase-summary .bios-screen');if(s)s.classList.add('crt-off');
    await delay(280);showPhase('phase-handoff');setLED('off');await delay(T.handoffDelay);
    window.dispatchEvent(new CustomEvent('bios:complete',{bubbles:true}));
  }

  /* ── BIOS Setup (DEL) ──────────────────────────────── */
  const SM={tabs:['Main','Advanced','Boot','Security','Exit'],tab:0,row:0,visible:false,
    items:{Main:[['System Time','[ 12:00:00]'],['System Date','[04/05/2026]'],['SATA Config','Enhanced'],['ACPI Settings',''],['USB Config','']],Advanced:[['CPU Config',''],['Chipset',''],['Onboard Devices',''],['PCIPnP','']],Boot:[['1st Boot Device','[Hard Drive]'],['2nd Boot Device','[USB Drive]'],['3rd Boot Device','[CDROM]'],['Boot Settings','']],Security:[['Supervisor Password','Not Installed'],['User Password','Not Installed'],['HDD Password','Not Installed']],Exit:[['Save & Exit',''],['Discard & Exit',''],['Load Defaults',''],['Save Changes','']]},
    help:{Main:['Set system time.','Set system date.','Configure SATA mode.','Configure ACPI.','Configure USB.'],Advanced:['Configure CPU.','Configure chipset.','Configure onboard.','Configure PnP.'],Boot:['1st boot priority.','2nd boot device.','3rd boot device.','Boot behavior.'],Security:['Set supervisor password.','Set user password.','HDD password status.'],Exit:['Save all and exit.','Exit without saving.','Load defaults.','Save without exit.']}};
  function renderSetup(){
    const o=document.getElementById('setup-overlay');const tab=SM.tabs[SM.tab];const items=SM.items[tab];
    o.innerHTML=`<div class="setup-box"><div class="setup-title">BIOS SETUP UTILITY</div><div class="setup-tabs">${SM.tabs.map((t,i)=>`<span class="stab ${i===SM.tab?'active':''}">${t}</span>`).join('')}</div><div class="setup-content"><div class="setup-items">${items.map(([l,v],i)=>`<div class="sitem ${i===SM.row?'sel':''}">${l}<span class="sval">${v}</span></div>`).join('')}</div><div class="setup-helpbox"><div class="shelp-title">Item Help</div><div class="shelp-text">${(SM.help[tab]||[])[SM.row]||''}</div></div></div><div class="setup-footer">←→ Tab &nbsp; ↑↓ Row &nbsp; F10 Save+Exit &nbsp; ESC Exit</div></div>`;
    o.style.display='flex';SM.visible=true;
  }
  function closeSetup(){document.getElementById('setup-overlay').style.display='none';SM.visible=false;SFX.navBeep('back');}

  const BM={items:[...CFG.bootOrder,'Enter Setup'],sel:0,visible:false};
  function renderBootMenu(){
    const o=document.getElementById('bootmenu-overlay');
    o.innerHTML=`<div class="bootmenu-box"><div class="bm-title">Please select boot device:</div><div class="bm-list">${BM.items.map((it,i)=>`<div class="bm-item ${i===BM.sel?'sel':''}">${it}</div>`).join('')}</div><div class="bm-footer">↑↓ Select &nbsp; ENTER Confirm &nbsp; ESC Cancel</div></div>`;
    o.style.display='flex';BM.visible=true;
  }
  function closeBootMenu(){document.getElementById('bootmenu-overlay').style.display='none';BM.visible=false;SFX.navBeep('back');}

  const KC=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let ki=0;
  function checkKonami(k){
    if(!EGG.konamiUnlock)return;ki=(k===KC[ki])?ki+1:0;
    if(ki===KC.length){ki=0;[440,523,659,880].forEach((f,i)=>setTimeout(()=>SFX.beep(f,.1,.3),i*110));const el=document.createElement('div');el.className='konami-msg';el.textContent='★  KONAMI CODE — +30 LIVES ACTIVATED  ★';document.getElementById('screen-wrap').appendChild(el);setTimeout(()=>el.remove(),3500);}
  }

  let running=true;
  document.addEventListener('keydown',e=>{
    checkKonami(e.key);checkDoom(e.key);
    if(SM.visible){const tab=SM.tabs[SM.tab];const items=SM.items[tab];
      if(e.key==='ArrowDown'){SM.row=(SM.row+1)%items.length;SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowUp'){SM.row=(SM.row-1+items.length)%items.length;SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowRight'){SM.tab=(SM.tab+1)%SM.tabs.length;SM.row=0;SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowLeft'){SM.tab=(SM.tab-1+SM.tabs.length)%SM.tabs.length;SM.row=0;SFX.navBeep('move');renderSetup();}
      else if(e.key==='Escape'||e.key==='F10')closeSetup();
      e.preventDefault();return;
    }
    if(BM.visible){
      if(e.key==='ArrowDown'){BM.sel=(BM.sel+1)%BM.items.length;SFX.navBeep('move');renderBootMenu();}
      else if(e.key==='ArrowUp'){BM.sel=(BM.sel-1+BM.items.length)%BM.items.length;SFX.navBeep('move');renderBootMenu();}
      else if(e.key==='Enter'){SFX.navBeep('select');closeBootMenu();}
      else if(e.key==='Escape')closeBootMenu();
      e.preventDefault();return;
    }
    if(e.key==='Delete'&&running){SFX.navBeep('select');renderSetup();}
    if(e.key==='F8'&&running){SFX.navBeep('select');renderBootMenu();}
  });

  async function run(){
    injectBarrelFilter();
    try{
      await phaseBlack();await phasePost();await phaseSummary();
      running=false;await phaseHandoff();
    }catch(err){console.error('[BIOS]',err);window.dispatchEvent(new CustomEvent('bios:complete'));}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();
})();
 