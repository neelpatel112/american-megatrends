/**
 * bios.js — AMIBIOS POST Screen Animation
 * Runs the visual POST sequence then fires 'bios:complete'.
 * emulator.js catches that event and starts v86.
 */
(function () {
  'use strict';

  var CFG = window.BIOS_CONFIG;
  var SFX = window.BiosAudio;
  var FX  = CFG.effects;
  var SND = CFG.sounds;
  var T   = CFG.timing;
  var EGG = CFG.easterEggs;

  var delay = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
  var rand  = function(a,b){ return Math.random()*(b-a)+a; };
  var pick  = function(arr){ return arr[Math.floor(Math.random()*arr.length)]; };

  /* ── typewriter ───────────────────────────────────── */
  async function typeText(el, text, cd) {
    cd = cd || 14;
    el.textContent = '';
    for (var i = 0; i < text.length; i++) {
      el.textContent += text[i];
      if (SND.typewriterSound && text[i].trim()) SFX.tick();
      await delay(cd + rand(-4,4));
    }
  }

  /* ── phase switch ─────────────────────────────────── */
  function showPhase(id) {
    document.querySelectorAll('.phase').forEach(function(p){
      p.classList.remove('active');
      p.style.display = 'none';
    });
    var el = document.getElementById(id);
    el.style.display = 'block';
    void el.offsetWidth;
    el.classList.add('active');
  }

  /* ── power LED ────────────────────────────────────── */
  var led = document.getElementById('power-led');
  function setLED(s) {
    if (!led) return;
    led.className = s==='green' ? 'led-green' : s==='amber' ? 'led-amber' : 'led-off';
  }

  /* ── barrel distortion SVG filter ────────────────── */
  function injectBarrel() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width','0'); svg.setAttribute('height','0');
    svg.style.position='absolute';
    svg.innerHTML = '<defs><filter id="barrel-filter" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feImage result="map" preserveAspectRatio="none" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3CradialGradient id=\'g\' cx=\'50%25\' cy=\'50%25\' r=\'70%25\'%3E%3Cstop offset=\'0%25\' stop-color=\'%23808080\'/%3E%3Cstop offset=\'100%25\' stop-color=\'%23404040\'/%3E%3C/radialGradient%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23g)\'/%3E%3C/svg%3E"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></defs>';
    document.body.appendChild(svg);
    if (FX.barrelDistortion) document.getElementById('screen-wrap').classList.add('barrel');
  }

  /* ── phosphor burn-in ─────────────────────────────── */
  function showBurnIn() {
    if (!FX.phosphorBurnIn) return;
    var l = document.getElementById('burnin-layer');
    if (l) l.textContent = 'AMIBIOS(C)2011 American Megatrends, Inc.    BIOS Date: 04/25/11 09:12:53\nIntel(R) Pentium(R) CPU @ 100MHz\n\nTesting Memory:  16384K ████████████████████\n\nAMIBIOS(C)2011 American Megatrends Inc.\nVerifying DMI Pool Data......Update Success!\n\n    ___    __  ___ ____\n   /   |  /  |/  //  _/\n  / /| | / /|_/ / / /\n /_/  |_/_/  /_//___/';
  }

  /* ── CRT effects ──────────────────────────────────── */
  var flickerInt=null, jitterInt=null, glitchInt=null;

  function startCRT(el) {
    if (!el) return;
    if (FX.crtFlicker) {
      flickerInt = setInterval(function(){
        if (Math.random()<.06){ el.style.filter='brightness('+rand(.83,.96)+')'; setTimeout(function(){el.style.filter='';},rand(30,80)); }
      },180);
    }
    if (FX.screenJitter) {
      jitterInt = setInterval(function(){
        if (Math.random()<.04){ el.style.transform='translateX('+rand(-3,3)+'px)'; setTimeout(function(){el.style.transform='';},55); }
      },250);
    }
    if (FX.glitchLines) {
      var GC='█▓▒░▄▀■□XXXXXXXX////\\\\';
      glitchInt = setInterval(function(){
        if (Math.random()<.07){
          var g=document.createElement('div'); g.className='glitch-line';
          var len=Math.floor(rand(6,36));
          g.textContent=Array.from({length:len},function(){return pick(GC.split(''));}).join('');
          g.style.top=Math.floor(rand(10,90))+'%'; g.style.left=Math.floor(rand(0,55))+'%';
          g.style.color=pick(['#ff5555','#ffff54','#55ff55','#aaaaff','#fff']);
          el.appendChild(g); setTimeout(function(){g.remove();},rand(55,175));
        }
      },600);
    }
  }

  function stopCRT() {
    clearInterval(flickerInt); clearInterval(jitterInt); clearInterval(glitchInt);
  }

  /* ── POST lines ───────────────────────────────────── */
  var POST_LINES = [
    {label:'AMIBIOS(C)2011 American Megatrends Inc.',      status:'',                           cls:'status-ok',  ms:180, hd:false},
    {label:'Initializing Intel(R) Boot Agent GE v1.3.43', status:'',                           cls:'status-ok',  ms:260, hd:false},
    {label:'PXE-MOF: Exiting Intel Boot Agent.',           status:'',                           cls:'status-ok',  ms:200, hd:false},
    {label:'Verifying DMI Pool Data',                       status:'......Update Success!',     cls:'status-ok',  ms:700, hd:false},
    {label:'SATA Port 0: ST3500418AS',                      status:'Ultra DMA Mode-5, S.M.A.R.T. OK', cls:'status-ok', ms:320, hd:true},
    {label:'SATA Port 1:',                                  status:'Not Detected',              cls:'status-warn',ms:160, hd:false},
    {label:'USB Device(s):',                                status:'1 Keyboard, 1 Mouse',       cls:'status-ok',  ms:340, hd:false},
    {label:'Auto-detecting USB Mass Storage..',             status:'1 Device Found',            cls:'status-ok',  ms:460, hd:false},
    {label:'Checking NVRAM..',                              status:'OK',                        cls:'status-ok',  ms:210, hd:false},
    {label:'Loading Setup Defaults..',                      status:'Done',                      cls:'status-ok',  ms:240, hd:false},
  ];

  function addPostLine(label, status, cls) {
    var wrap = document.getElementById('post-lines');
    var row  = document.createElement('div');
    row.className = 'post-line';
    row.innerHTML = '<span class="label">'+label+'</span><span class="'+(cls||'status-ok')+'">'+(status||'')+'</span>';
    wrap.appendChild(row);
  }

  /* ── Fake errors / pranks ─────────────────────────── */
  async function maybeFakeError() {
    if (Math.random() > EGG.failChance) return;
    SFX.errorBeep();
    addPostLine('!! CMOS Checksum Error — Defaults Loaded !!','','status-fail');
    await delay(900);
    addPostLine('Press F1 to Run SETUP, F2 to Load Defaults','','status-warn');
    await delay(1800);
    addPostLine('Continuing with defaults...','','status-ok');
    await delay(600);
  }

  async function maybeKeyboardJoke() {
    if (Math.random() > EGG.keyboardJoke) return;
    var j = document.createElement('div');
    j.style.cssText = 'position:absolute;bottom:30px;left:50%;transform:translateX(-50%);z-index:700;color:#ffff54;font-family:"Share Tech Mono",monospace;font-size:clamp(11px,1.4vw,15px);animation:kblink .9s step-end infinite;white-space:nowrap;';
    j.textContent = 'Keyboard not found — Press any key to continue';
    document.getElementById('screen-wrap').appendChild(j);
    await delay(4500);
    j.remove();
  }

  /* ── Virus pranks (same as before) ───────────────── */
  async function maybeVirusPrank() {
    if (Math.random() > EGG.virusChance) return;
    var scripts = [cryptoViperPrank, ghostRatPrank, biosCorruptPrank];
    await pick(scripts)();
  }

  async function cryptoViperPrank() {
    var o = document.getElementById('virus-overlay');
    o.style.cssText = 'display:flex;flex-direction:column;gap:2px;padding:14px;position:absolute;inset:0;z-index:800;background:#000;font-family:"Share Tech Mono",monospace;font-size:clamp(10px,1.3vw,13px);';
    document.getElementById('screen-wrap').classList.add('virus-red-tint');
    SFX.virusAlarm && SFX.virusAlarm();
    var lines=[['red','!! WARNING: CRYPTOVIPER v3.1.4 RANSOMWARE DETECTED !!'],['yellow',''],['white','Scanning system files...']];
    for(var i=0;i<lines.length;i++){var d=document.createElement('div');d.className='virus-line '+lines[i][0];d.textContent=lines[i][1];o.appendChild(d);await delay(90);}
    var FILES=['C:\\Windows\\System32\\kernel32.dll','C:\\Users\\Admin\\Documents\\passwords.txt','C:\\Users\\Admin\\Desktop\\banking.xlsx'];
    for(var f=0;f<FILES.length;f++){var d2=document.createElement('div');d2.className='virus-line red';d2.textContent='  [ENCRYPTING] '+FILES[f];o.appendChild(d2);SFX.hdSeek&&SFX.hdSeek();await delay(rand(130,260));}
    await delay(300);
    var w=document.createElement('div');w.className='virus-line yellow blink';w.textContent='  YOUR FILES ARE BEING ENCRYPTED. DO NOT TURN OFF YOUR COMPUTER.';o.appendChild(w);
    SFX.virusAlarm&&SFX.virusAlarm(); await delay(3500);
    o.innerHTML='';var j=document.createElement('div');j.className='virus-line green';j.style.cssText='font-size:clamp(14px,2vw,22px);text-align:center;margin-top:30%;';j.textContent='😂  lol just kidding. your files are fine.';o.appendChild(j);
    SFX.beep&&SFX.beep(880,.2,.3); await delay(2400);
    document.getElementById('screen-wrap').classList.remove('virus-red-tint');
    o.style.display='none'; o.innerHTML='';
  }

  async function ghostRatPrank() {
    var o = document.getElementById('virus-overlay');
    o.style.cssText='display:flex;flex-direction:column;gap:2px;padding:14px;position:absolute;inset:0;z-index:800;background:#000;color:#00ff00;font-family:"Share Tech Mono",monospace;font-size:clamp(10px,1.3vw,13px);';
    SFX.errorBeep&&SFX.errorBeep(); await delay(200);
    var lines=[['','Microsoft Windows [Version 5.1.2600]'],['',''],['#ff3333','ALERT: UNAUTHORIZED REMOTE CONNECTION DETECTED'],['',''],['#ffff54','  TCP 192.168.1.5:1337  185.220.101.47:4444  ESTABLISHED'],['#ff3333','WARNING: GHOST_RAT v2.7 backdoor detected'],['#ff3333','  keylogger.exe  PID:6666']];
    for(var i=0;i<lines.length;i++){var d=document.createElement('div');d.className='virus-line';d.style.color=lines[i][0]||'#00ff00';d.textContent=lines[i][1];o.appendChild(d);await delay(rand(60,130));}
    var pb=document.createElement('div');pb.className='virus-line';pb.style.color='#ff3333';o.appendChild(pb);
    for(var p=0;p<=100;p+=2){var bar='█'.repeat(Math.floor(p/5)).padEnd(20,'░');pb.textContent='  Upload: ['+bar+'] '+p+'%';await delay(55);}
    SFX.virusAlarm&&SFX.virusAlarm(); await delay(2500);
    o.innerHTML='';var j=document.createElement('div');j.className='virus-line';j.style.cssText='color:#55ff55;font-size:clamp(13px,1.8vw,20px);text-align:center;margin-top:30%;';j.textContent='🤣  gotcha. 100% fake. relax bro.';o.appendChild(j);
    SFX.beep&&SFX.beep(660,.15,.25); await delay(2400); o.style.display='none'; o.innerHTML='';
  }

  async function biosCorruptPrank() {
    var o = document.getElementById('virus-overlay');
    o.style.cssText='display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;position:absolute;inset:0;z-index:800;background:#000;font-family:"Share Tech Mono",monospace;';
    document.getElementById('screen-wrap').classList.add('virus-red-tint');
    SFX.errorBeep&&SFX.errorBeep(); await delay(300); SFX.errorBeep&&SFX.errorBeep();
    var msgs=[['#ff0000','clamp(14px,2vw,22px)','!! CRITICAL BIOS CORRUPTION DETECTED !!'],['#ff5555','','Firmware integrity check: FAILED'],['#ffff54','','Attempting recovery from backup...']];
    for(var i=0;i<msgs.length;i++){var d=document.createElement('div');d.style.cssText='color:'+msgs[i][0]+';'+(msgs[i][1]?'font-size:'+msgs[i][1]+';':'');d.textContent=msgs[i][2];o.appendChild(d);await delay(350);}
    var wrap=document.createElement('div');wrap.style.cssText='width:60%;border:1px solid #ff4400;height:14px;margin-top:8px;';
    var fill=document.createElement('div');fill.style.cssText='height:100%;background:linear-gradient(90deg,#660000,#ff2200);width:0%;';wrap.appendChild(fill);o.appendChild(wrap);
    var pct=document.createElement('div');pct.style.color='#ff8844';o.appendChild(pct);
    for(var p2=0;p2<=47;p2++){fill.style.width=p2+'%';pct.textContent='Recovery: '+p2+'%';await delay(60);}
    fill.style.background='#ff0000';var fail=document.createElement('div');fail.style.cssText='color:#ff0000;font-size:clamp(13px,1.8vw,18px);margin-top:10px;';fail.textContent='RECOVERY FAILED — SYSTEM UNBOOTABLE';o.appendChild(fail);
    SFX.virusAlarm&&SFX.virusAlarm(); await delay(1500); o.innerHTML=''; await delay(700);
    var j=document.createElement('div');j.style.cssText='color:#55ff55;font-size:clamp(13px,1.8vw,19px);text-align:center;';j.textContent='😂  psyche. your BIOS is fine. stop sweating.';o.appendChild(j);
    SFX.beep&&SFX.beep(523,.15,.25); await delay(2400);
    document.getElementById('screen-wrap').classList.remove('virus-red-tint');
    o.style.display='none'; o.innerHTML='';
  }

  /* ── DOOM Easter egg ──────────────────────────────── */
  var doomBuf = '';
  function checkDoom(k) {
    if (!EGG.doomUnlock) return;
    doomBuf += k.toLowerCase(); if (doomBuf.length>4) doomBuf=doomBuf.slice(-4);
    if (doomBuf==='doom') { doomBuf=''; triggerDoom(); }
  }
  async function triggerDoom() {
    var o=document.getElementById('doom-overlay'); o.style.display='flex';
    var logo=document.createElement('div');logo.className='doom-logo';logo.textContent='DOOM';o.appendChild(logo);
    var sub=document.createElement('div');sub.className='doom-sub';sub.textContent='id Software · 1993  —  Loading...';o.appendChild(sub);
    var bw=document.createElement('div');bw.className='doom-bar';var bf=document.createElement('div');bf.className='doom-fill';bw.appendChild(bf);o.appendChild(bw);
    var pct=document.createElement('div');pct.className='doom-pct';o.appendChild(pct);
    SFX.beep&&SFX.beep(220,.3,.4); await delay(200); SFX.beep&&SFX.beep(165,.3,.35);
    for(var i=0;i<=100;i++){bf.style.width=i+'%';pct.textContent=i+'%';await delay(rand(30,60));}
    await delay(300);pct.textContent='Error: DOOM.EXE not found.';pct.style.color='#ff5555';SFX.errorBeep&&SFX.errorBeep();await delay(2000);
    var j=document.createElement('div');j.className='doom-sub';j.style.color='#55ff55';j.style.marginTop='12px';j.textContent='(nice try though 👾)';o.appendChild(j);
    await delay(2000); o.style.display='none'; o.innerHTML='';
  }

  /* ── Konami code ──────────────────────────────────── */
  var KC=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'],ki=0;
  function checkKonami(k) {
    ki=(k===KC[ki])?ki+1:0;
    if(ki===KC.length){ ki=0; [440,523,659,880].forEach(function(f,i){setTimeout(function(){SFX.beep&&SFX.beep(f,.1,.3);},i*110);}); var el=document.createElement('div');el.className='konami-msg';el.textContent='★  KONAMI CODE — +30 LIVES ACTIVATED  ★';document.getElementById('screen-wrap').appendChild(el);setTimeout(function(){el.remove();},3500); }
  }

  /* ── BIOS Setup / Boot Menu keys (during POST only) ── */
  var SM={tabs:['Main','Advanced','Boot','Security','Exit'],tab:0,row:0,visible:false,
    items:{Main:[['System Time','[ 12:00:00]'],['System Date','[04/05/1994]'],['Floppy Drive A','[1.44 MB]'],['Pri. Master','[LBA, 504 MB]'],['ACPI Settings','']],Advanced:[['CPU Config',''],['Chipset',''],['Onboard Devices',''],['PCIPnP','']],Boot:[['1st Boot Device','[Floppy]'],['2nd Boot Device','[Hard Drive]'],['3rd Boot Device','[CDROM]'],['Boot Settings','']],Security:[['Supervisor Password','Not Installed'],['User Password','Not Installed']],Exit:[['Save & Exit',''],['Discard & Exit',''],['Load Defaults',''],['Save Changes','']]},
    help:{Main:['Set system time.','Set system date.','Configure floppy.','Configure hard disk.','Configure ACPI.'],Advanced:['CPU settings.','Chipset settings.','Onboard devices.','PnP settings.'],Boot:['1st boot priority.','2nd boot device.','3rd boot device.','Boot behavior.'],Security:['Set supervisor password.','Set user password.'],Exit:['Save all and exit.','Exit without saving.','Load defaults.','Save without exit.']}};

  function renderSetup(){
    var o=document.getElementById('setup-overlay');
    var tab=SM.tabs[SM.tab];var items=SM.items[tab];
    o.innerHTML='<div class="setup-box"><div class="setup-title">BIOS SETUP UTILITY</div><div class="setup-tabs">'+SM.tabs.map(function(t,i){return'<span class="stab '+(i===SM.tab?'active':'')+'">'+(t)+'</span>';}).join('')+'</div><div class="setup-content"><div class="setup-items">'+items.map(function(r,i){return'<div class="sitem '+(i===SM.row?'sel':'')+'">'+r[0]+'<span class="sval">'+r[1]+'</span></div>';}).join('')+'</div><div class="setup-helpbox"><div class="shelp-title">Item Help</div><div class="shelp-text">'+((SM.help[tab]||[])[SM.row]||'')+'</div></div></div><div class="setup-footer">←→ Tab &nbsp; ↑↓ Row &nbsp; F10 Save+Exit &nbsp; ESC Exit</div></div>';
    o.style.display='flex'; SM.visible=true; SFX.navBeep&&SFX.navBeep('select');
  }
  function closeSetup(){ document.getElementById('setup-overlay').style.display='none'; SM.visible=false; SFX.navBeep&&SFX.navBeep('back'); }

  var BM={items:CFG.bootOrder.concat(['Enter Setup']),sel:0,visible:false};
  function renderBootMenu(){
    var o=document.getElementById('bootmenu-overlay');
    o.innerHTML='<div class="bootmenu-box"><div class="bm-title">Please select boot device:</div><div class="bm-list">'+BM.items.map(function(it,i){return'<div class="bm-item '+(i===BM.sel?'sel':'')+'">'+it+'</div>';}).join('')+'</div><div class="bm-footer">↑↓ Select &nbsp; ENTER Confirm &nbsp; ESC Cancel</div></div>';
    o.style.display='flex'; BM.visible=true; SFX.navBeep&&SFX.navBeep('select');
  }
  function closeBootMenu(){ document.getElementById('bootmenu-overlay').style.display='none'; BM.visible=false; SFX.navBeep&&SFX.navBeep('back'); }

  var biosRunning = true;
  document.addEventListener('keydown', function(e){
    checkKonami(e.key); checkDoom(e.key);
    if (SM.visible){
      var tab=SM.tabs[SM.tab];var items=SM.items[tab];
      if(e.key==='ArrowDown'){SM.row=(SM.row+1)%items.length;SFX.navBeep&&SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowUp'){SM.row=(SM.row-1+items.length)%items.length;SFX.navBeep&&SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowRight'){SM.tab=(SM.tab+1)%SM.tabs.length;SM.row=0;SFX.navBeep&&SFX.navBeep('move');renderSetup();}
      else if(e.key==='ArrowLeft'){SM.tab=(SM.tab-1+SM.tabs.length)%SM.tabs.length;SM.row=0;SFX.navBeep&&SFX.navBeep('move');renderSetup();}
      else if(e.key==='Escape'||e.key==='F10')closeSetup();
      e.preventDefault();return;
    }
    if(BM.visible){
      if(e.key==='ArrowDown'){BM.sel=(BM.sel+1)%BM.items.length;SFX.navBeep&&SFX.navBeep('move');renderBootMenu();}
      else if(e.key==='ArrowUp'){BM.sel=(BM.sel-1+BM.items.length)%BM.items.length;SFX.navBeep&&SFX.navBeep('move');renderBootMenu();}
      else if(e.key==='Enter'){SFX.navBeep&&SFX.navBeep('select');closeBootMenu();}
      else if(e.key==='Escape')closeBootMenu();
      e.preventDefault();return;
    }
    if(biosRunning&&e.key==='Delete'){renderSetup();e.preventDefault();}
    if(biosRunning&&e.key==='F8'){renderBootMenu();e.preventDefault();}
  });

  /* ══════════════════════════════════════════════════
     PHASES
  ══════════════════════════════════════════════════ */
  async function phaseBlack() {
    showPhase('phase-black'); setLED('amber');
    if (SND.fanSpinUp) SFX.fanSpinUp(T.fanSpinDuration);
    await delay(T.fanSpinDuration * 0.6);
    setLED('green'); SFX.crtOn&&SFX.crtOn();
    if (SND.degauss) {
      await delay(120); SFX.degauss&&SFX.degauss();
      var sw=document.getElementById('screen-wrap');sw.classList.add('degauss-flash');
      setTimeout(function(){sw.classList.remove('degauss-flash');},700);
    }
    await delay(T.blackFlash);
  }

  async function phasePost() {
    showPhase('phase-post'); showBurnIn();
    var screen = document.querySelector('#phase-post .bios-screen');
    startCRT(screen);
    await delay(250); if(SND.postBeep)SFX.postBeep&&SFX.postBeep();
    await typeText(document.getElementById('cpu-line'), CFG.cpu, 12);
    await delay(160);

    // Memory counter
    var memLine = document.getElementById('mem-test-line');
    memLine.innerHTML = '<span>Testing Memory: </span>';
    var countEl=document.createElement('span');countEl.className='mem-count';memLine.appendChild(countEl);
    var barOut=document.createElement('span');barOut.className='mem-bar-outer';
    var barIn=document.createElement('span');barIn.className='mem-bar-inner';barOut.appendChild(barIn);memLine.appendChild(barOut);
    var totalKB=CFG.ramMB*1024,steps=200,step=Math.floor(totalKB/steps);
    var cur=0,tc=0;
    while(cur<totalKB){cur=Math.min(cur+step,totalKB);countEl.textContent=cur.toLocaleString()+'K';barIn.style.width=((cur/totalKB)*100).toFixed(1)+'%';tc++;if(SND.typewriterSound&&tc%8===0)SFX.memTick&&SFX.memTick();await delay(T.memCountDuration/steps);}
    await delay(110);memLine.style.display='none';document.getElementById('mem-ok-line').style.display='block';SFX.beep&&SFX.beep(1200,.08,.2);await delay(250);

    for(var i=0;i<POST_LINES.length;i++){
      var item=POST_LINES[i];
      await delay(item.ms+rand(-30,50));
      if(item.hd&&SND.hdSeekSound)SFX.hdSeek&&SFX.hdSeek();
      addPostLine(item.label,item.status,item.cls);
    }
    await delay(350); await maybeFakeError(); await maybeKeyboardJoke(); await maybeVirusPrank();
    await delay(400); stopCRT();
  }

  async function phaseSummary() {
    document.getElementById('sum-cpu').textContent=CFG.cpu;
    document.getElementById('sum-speed').textContent=CFG.cpuSpeed;
    document.getElementById('sum-ram').textContent=CFG.ramMB+' MB';
    document.getElementById('sum-ramfreq').textContent=CFG.ramFrequency;
    document.getElementById('sum-pri-m').textContent=CFG.drives.priMaster;
    document.getElementById('sum-pri-s').textContent=CFG.drives.priSlave||'Not Detected';
    var boEl=document.getElementById('boot-order-list');boEl.innerHTML='';
    CFG.bootOrder.forEach(function(b,i){var d=document.createElement('div');d.className='boot-order-item';d.textContent=(i+1)+'. '+b;boEl.appendChild(d);});
    showPhase('phase-summary');
    startCRT(document.querySelector('#phase-summary .bios-screen'));
    await delay(T.summaryHold); stopCRT();
  }

  async function phaseHandoff() {
    setLED('amber'); SFX.crtOff&&SFX.crtOff();
    var s=document.querySelector('#phase-summary .bios-screen');if(s)s.classList.add('crt-off');
    await delay(260); showPhase('phase-handoff'); setLED('off');
    await delay(T.handoffDelay);
    biosRunning = false;
    window.dispatchEvent(new CustomEvent('bios:complete',{bubbles:true}));
  }

  /* ── Run ──────────────────────────────────────────── */
  async function run() {
    injectBarrel();
    try {
      await phaseBlack();
      await phasePost();
      await phaseSummary();
      await phaseHandoff();
    } catch(err) {
      console.error('[BIOS]',err);
      window.dispatchEvent(new CustomEvent('bios:complete'));
    }
  }

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', run)
    : run();

})();
 