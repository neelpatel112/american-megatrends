/**
 * emulator.js
 * ══════════════════════════════════════════════════════════════
 * Wires the AMIBIOS POST screen → v86 MS-DOS 6.22 emulator.
 *
 * Flow:
 *   1. BIOS POST animation runs (bios.js)
 *   2. bios.js fires 'bios:complete'
 *   3. We show #phase-emulator with loading screen
 *   4. Fetch the DOS 6.22 disk image (with progress bar)
 *   5. Start v86 with the image as floppy A:
 *   6. v86 boots DOS — real COMMAND.COM prompt appears
 *   7. User types real DOS commands in the real emulator
 *
 * Key bindings handled here:
 *   DEL during boot  → our BIOS Setup overlay
 *   F8 during boot   → our Boot Menu overlay
 *   Ctrl+Alt+Del     → v86 reboot
 * ══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var CFG = window.BIOS_CONFIG;
  var SFX = window.BiosAudio;
  var EMU_CFG = CFG.emulator;

  var emulator = null;       // v86 instance
  var emuReady = false;      // true once DOS prompt appears

  /* ── helpers ──────────────────────────────────────── */
  var delay = function(ms) { return new Promise(function(r){ setTimeout(r, ms); }); };

  function setStatus(text, cls) {
    var el = document.getElementById('emu-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'hint-status ' + (cls || '');
  }

  function setProgress(pct, label) {
    var bar = document.getElementById('emu-progress');
    var pctEl = document.getElementById('emu-load-pct');
    var sub  = document.getElementById('emu-load-sub');
    if (bar)   bar.style.width = Math.min(100, pct) + '%';
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
    if (sub && label) sub.textContent = label;
  }

  /* ── show emulator phase ──────────────────────────── */
  function showEmulatorPhase() {
    // Kill all BIOS phases
    document.querySelectorAll('.phase').forEach(function(p) {
      p.style.cssText = 'display:none!important;';
      p.classList.remove('active');
    });
    // Show emulator div
    var ph = document.getElementById('phase-emulator');
    ph.style.display = 'flex';
    ph.style.flexDirection = 'column';
    // LED stays green
    var led = document.getElementById('power-led');
    if (led) led.className = 'led-green';
  }

  /* ── hide loading overlay once emulator is running ── */
  function hideLoading() {
    var l = document.getElementById('emu-loading');
    if (l) {
      l.style.transition = 'opacity .4s';
      l.style.opacity = '0';
      setTimeout(function() { l.style.display = 'none'; }, 420);
    }
  }

  /* ══════════════════════════════════════════════════
     DISK IMAGE FETCH WITH PROGRESS
  ══════════════════════════════════════════════════ */
  async function fetchDiskImage(url) {
    setProgress(0, 'Connecting to server...');

    var response;
    try {
      response = await fetch(url, { mode: 'cors' });
    } catch(e) {
      throw new Error('Network error: ' + e.message);
    }

    if (!response.ok) throw new Error('HTTP ' + response.status);

    var contentLength = response.headers.get('content-length');
    var total = contentLength ? parseInt(contentLength, 10) : 0;

    setProgress(2, 'Downloading disk image...');

    var reader = response.body.getReader();
    var chunks = [];
    var received = 0;

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
      received += result.value.length;
      if (total > 0) {
        var pct = (received / total) * 90; // 0-90% for download
        setProgress(pct, 'Downloading... ' + Math.round(received/1024) + ' KB / ' + Math.round(total/1024) + ' KB');
      } else {
        // Unknown size — show spinner-style progress
        setProgress(Math.min(85, received / 15000), 'Downloading... ' + Math.round(received/1024) + ' KB');
      }
    }

    setProgress(92, 'Assembling disk image...');

    // Concatenate chunks into single ArrayBuffer
    var totalLen = chunks.reduce(function(a, c){ return a + c.length; }, 0);
    var buffer = new Uint8Array(totalLen);
    var offset = 0;
    chunks.forEach(function(chunk) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    });

    setProgress(96, 'Validating image...');
    return buffer.buffer;
  }

  /* ══════════════════════════════════════════════════
     START v86 EMULATOR
  ══════════════════════════════════════════════════ */
  async function startEmulator(diskBuffer) {
    setProgress(98, 'Initializing CPU emulator...');

    // v86 needs the BIOS ROMs — we use the ones bundled with the lib
    // They're served from the same CDN as libv86.js
    var biosBase = 'https://cdn.jsdelivr.net/gh/copy/v86@master/bios/';

    // Build emulator config
    var emuConfig = {
      wasm_path: 'https://cdn.jsdelivr.net/gh/copy/v86@master/build/v86.wasm',

      /* Memory */
      memory_size: (EMU_CFG.memoryMB || 16) * 1024 * 1024,
      vga_memory_size: 2 * 1024 * 1024,

      /* BIOS ROMs */
      bios: { url: biosBase + 'seabios.bin' },
      vga_bios: { url: biosBase + 'vgabios.bin' },

      /* Boot from floppy A: */
      fda: { buffer: diskBuffer },

      /* Screen — v86 creates a canvas and puts it here */
      screen_container: document.getElementById('emulator-container'),

      /* Serial output to console (useful for debug) */
      serial_container_7: null,

      /* Run as fast as possible */
      autostart: true,

      /* Don't throttle — full speed */
      disable_mouse: false,
    };

    setProgress(99, 'Starting emulator...');

    // Instantiate v86
    emulator = new V86(emuConfig);

    setProgress(100, 'Booting MS-DOS 6.22...');
    setStatus('Booting...', 'booting');

    // Give v86 a moment to render its first frame, then hide loading
    await delay(600);
    hideLoading();
    addClickOverlay();
    setStatus('Booting...', 'booting');

    // Poll for DOS prompt — v86 fires 'screen-set-mode' when VGA is active
    // We also listen for keyboard_send / serial to detect the C:\> prompt
    emulator.add_listener('emulator-ready', function() {
      setStatus('Ready', 'ready');
      emuReady = true;
    });

    // Watch screen output to detect when DOS has booted
    var promptDetected = false;
    emulator.add_listener('serial0-output-char', function(char) {
      if (!promptDetected && char === '>') {
        promptDetected = true;
        setStatus('MS-DOS 6.22 — Ready', 'ready');
        emuReady = true;
      }
    });

    // Fallback: mark ready after 8 seconds regardless
    setTimeout(function() {
      if (!emuReady) {
        setStatus('MS-DOS 6.22 — Ready', 'ready');
        emuReady = true;
      }
    }, 8000);

    // Wire keyboard — capture all keys when emulator is focused
    wireKeyboard();
  }

  /* ══════════════════════════════════════════════════
     KEYBOARD WIRING
  ══════════════════════════════════════════════════ */
  function wireKeyboard() {
    var container = document.getElementById('emulator-container');
    if (!container) return;

    // Make container focusable
    container.setAttribute('tabindex', '0');

    // Intercept DEL and F8 BEFORE they reach v86
    // to show our BIOS UI overlays (cosmetic only — v86 is already past POST)
    document.addEventListener('keydown', function(e) {
      // Only intercept if emulator is shown and no overlay is open
      var phEmu = document.getElementById('phase-emulator');
      if (!phEmu || phEmu.style.display === 'none') return;

      var setupOv = document.getElementById('setup-overlay');
      var bootOv  = document.getElementById('bootmenu-overlay');
      var setupOpen = setupOv && setupOv.style.display !== 'none';
      var bootOpen  = bootOv  && bootOv.style.display  !== 'none';

      if (e.key === 'Delete' && !setupOpen && !bootOpen) {
        // Show our cosmetic BIOS setup overlay
        if (window.renderSetup) { window.renderSetup(); e.preventDefault(); return; }
      }
      if (e.key === 'F8' && !setupOpen && !bootOpen) {
        if (window.renderBootMenu) { window.renderBootMenu(); e.preventDefault(); return; }
      }

      // Close overlays on Escape / F10
      if (setupOpen && (e.key === 'Escape' || e.key === 'F10')) {
        if (window.closeSetup) window.closeSetup();
        e.preventDefault(); return;
      }
      if (bootOpen && (e.key === 'Escape' || e.key === 'Enter')) {
        if (window.closeBootMenu) window.closeBootMenu();
        e.preventDefault(); return;
      }
      if (setupOpen || bootOpen) {
        // Navigate menus
        if (window.handleSetupKey) window.handleSetupKey(e);
        e.preventDefault();
      }
    }, true); // capture phase so we intercept before v86
  }

  /* ══════════════════════════════════════════════════
     CLICK-TO-FOCUS OVERLAY
  ══════════════════════════════════════════════════ */
  function addClickOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'emu-click-overlay';
    overlay.innerHTML = '▶&nbsp; Click here to start typing in DOS';

    var container = document.getElementById('emulator-container');
    if (container) container.appendChild(overlay);

    overlay.addEventListener('click', function() {
      overlay.classList.add('hidden');
      // Focus the v86 canvas so it captures keyboard
      var canvas = container && container.querySelector('canvas');
      if (canvas) canvas.focus();
      setTimeout(function() { overlay.remove(); }, 400);
    });
  }

  /* ══════════════════════════════════════════════════
     BIOS SETUP MENU (cosmetic overlay for DEL key)
  ══════════════════════════════════════════════════ */
  var SM = {
    tabs: ['Main','Advanced','Boot','Security','Exit'],
    tab: 0, row: 0,
    items: {
      Main:     [['System Time','[ '+new Date().toLocaleTimeString()+']'],['System Date','['+new Date().toLocaleDateString()+']'],['SATA Config','Enhanced'],['ACPI Settings',''],['USB Config','']],
      Advanced: [['CPU Config',''],['Chipset',''],['Onboard Devices',''],['PCIPnP','']],
      Boot:     [['1st Boot Device','[Floppy]'],['2nd Boot Device','[Hard Drive]'],['3rd Boot Device','[CDROM]'],['Boot Settings','']],
      Security: [['Supervisor Password','Not Installed'],['User Password','Not Installed'],['HDD Password','Not Installed']],
      Exit:     [['Save & Exit',''],['Discard & Exit',''],['Load Defaults',''],['Save Changes','']],
    },
    help: {
      Main:     ['Set the system time.','Set the system date.','Configure SATA mode.','Configure ACPI settings.','Configure USB devices.'],
      Advanced: ['Configure CPU settings.','Configure chipset.','Configure onboard devices.','Configure PnP settings.'],
      Boot:     ['First boot device priority.','Second boot device.','Third boot device.','Configure boot behavior.'],
      Security: ['Set supervisor password.','Set user password.','HDD password status.'],
      Exit:     ['Save all changes and exit.','Exit without saving.','Load factory defaults.','Save without exiting.'],
    },
  };

  window.renderSetup = function() {
    var o = document.getElementById('setup-overlay');
    if (!o) return;
    var tab = SM.tabs[SM.tab];
    var items = SM.items[tab];
    o.innerHTML = '<div class="setup-box">' +
      '<div class="setup-title">BIOS SETUP UTILITY</div>' +
      '<div class="setup-tabs">' + SM.tabs.map(function(t,i){ return '<span class="stab '+(i===SM.tab?'active':'')+'">' + t + '</span>'; }).join('') + '</div>' +
      '<div class="setup-content">' +
        '<div class="setup-items">' + items.map(function(r,i){ return '<div class="sitem '+(i===SM.row?'sel':'')+'">'+r[0]+'<span class="sval">'+r[1]+'</span></div>'; }).join('') + '</div>' +
        '<div class="setup-helpbox"><div class="shelp-title">Item Help</div><div class="shelp-text">' + ((SM.help[tab]||[])[SM.row]||'') + '</div></div>' +
      '</div>' +
      '<div class="setup-footer">←→ Tab &nbsp; ↑↓ Row &nbsp; F10 Save+Exit &nbsp; ESC Exit</div>' +
    '</div>';
    o.style.display = 'flex';
    if (SFX) SFX.navBeep('select');
  };

  window.closeSetup = function() {
    var o = document.getElementById('setup-overlay');
    if (o) o.style.display = 'none';
    if (SFX) SFX.navBeep('back');
  };

  window.handleSetupKey = function(e) {
    var tab = SM.tabs[SM.tab];
    var items = SM.items[tab];
    if (e.key === 'ArrowDown')  { SM.row = (SM.row+1) % items.length; if(SFX)SFX.navBeep('move'); window.renderSetup(); }
    else if (e.key === 'ArrowUp')    { SM.row = (SM.row-1+items.length) % items.length; if(SFX)SFX.navBeep('move'); window.renderSetup(); }
    else if (e.key === 'ArrowRight') { SM.tab = (SM.tab+1) % SM.tabs.length; SM.row=0; if(SFX)SFX.navBeep('move'); window.renderSetup(); }
    else if (e.key === 'ArrowLeft')  { SM.tab = (SM.tab-1+SM.tabs.length) % SM.tabs.length; SM.row=0; if(SFX)SFX.navBeep('move'); window.renderSetup(); }
  };

  var BM = { items: CFG.bootOrder.concat(['Enter Setup']), sel: 0 };
  window.renderBootMenu = function() {
    var o = document.getElementById('bootmenu-overlay');
    if (!o) return;
    o.innerHTML = '<div class="bootmenu-box">' +
      '<div class="bm-title">Please select boot device:</div>' +
      '<div class="bm-list">' + BM.items.map(function(it,i){ return '<div class="bm-item '+(i===BM.sel?'sel':'')+'">'+it+'</div>'; }).join('') + '</div>' +
      '<div class="bm-footer">↑↓ Select &nbsp; ENTER Confirm &nbsp; ESC Cancel</div>' +
    '</div>';
    o.style.display = 'flex';
    if (SFX) SFX.navBeep('select');
  };
  window.closeBootMenu = function() {
    var o = document.getElementById('bootmenu-overlay');
    if (o) o.style.display = 'none';
    if (SFX) SFX.navBeep('back');
  };

  /* ══════════════════════════════════════════════════
     MAIN ENTRY — triggered by OS menu selection
     osmenu.js fires 'os:selected' with { id: 'dos' }
  ══════════════════════════════════════════════════ */
  window.addEventListener('os:selected', function(e) {
    if (!e.detail || e.detail.id !== 'dos') return;
    setTimeout(function() { initEmulator(); }, 200);
  });

  async function initEmulator() {
    showEmulatorPhase();

    // Check if v86 loaded successfully
    if (typeof V86 === 'undefined') {
      setProgress(0, 'ERROR: v86 emulator failed to load.');
      document.getElementById('emu-load-sub').textContent =
        'libv86.js could not be loaded from CDN. Check your internet connection.';
      document.getElementById('emu-load-sub').style.color = '#ff5555';
      setStatus('Load error', 'error');
      showFallbackShell();
      return;
    }

    // Try primary URL first, then fallback
    var imageBuffer = null;
    var urls = [EMU_CFG.diskImageUrl, EMU_CFG.fallbackUrl].filter(Boolean);

    for (var i = 0; i < urls.length; i++) {
      try {
        setProgress(0, 'Fetching: ' + urls[i].split('/').pop());
        imageBuffer = await fetchDiskImage(urls[i]);
        break; // success
      } catch(err) {
        console.warn('[EMU] Failed to fetch ' + urls[i] + ':', err.message);
        if (i < urls.length - 1) {
          setProgress(0, 'Primary failed, trying fallback...');
          await delay(800);
        }
      }
    }

    if (!imageBuffer) {
      // Both URLs failed — show our enhanced fake shell
      console.warn('[EMU] All disk image URLs failed. Using built-in shell.');
      setProgress(0, 'Disk image unavailable — loading built-in shell...');
      await delay(1200);
      showFallbackShell();
      return;
    }

    // Boot the real emulator
    try {
      await startEmulator(imageBuffer);
    } catch(err) {
      console.error('[EMU] v86 startup error:', err);
      setProgress(100, 'Emulator error: ' + err.message);
      setStatus('Emulator error', 'error');
      await delay(1500);
      showFallbackShell();
    }
  }

  /* ══════════════════════════════════════════════════
     FALLBACK SHELL
     If v86 or disk image fails, load our enhanced
     built-in JavaScript shell so the page isn't broken.
  ══════════════════════════════════════════════════ */
  function showFallbackShell() {
    var loading = document.getElementById('emu-loading');
    if (loading) loading.style.display = 'none';

    // Inject the fallback shell HTML
    var container = document.getElementById('emulator-container');
    if (!container) return;

    container.innerHTML = '';
    container.style.alignItems = 'flex-start';
    container.style.cursor = 'default';

    var shell = document.createElement('div');
    shell.id = 'fallback-shell';
    shell.style.cssText = [
      'width:100%', 'height:100%', 'background:#000', 'color:#c0c0c0',
      'font-family:"Share Tech Mono","Courier New",monospace',
      'font-size:clamp(10px,1.3vw,13.5px)', 'line-height:1.55',
      'padding:8px 12px', 'display:flex', 'flex-direction:column',
      'overflow:hidden', 'text-shadow:0 0 3px rgba(170,255,170,.35)',
    ].join(';');

    var output = document.createElement('div');
    output.id = 'fb-output';
    output.style.cssText = 'flex:1;overflow-y:auto;white-space:pre-wrap;word-break:break-all;scrollbar-width:none;';

    var inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;align-items:center;flex-shrink:0;padding-top:3px;border-top:1px solid #111;';
    var prompt  = document.createElement('span');
    prompt.id = 'fb-prompt';
    prompt.style.color = '#55ff55';
    prompt.textContent = 'C:\\> ';
    var typed   = document.createElement('span');
    typed.id = 'fb-typed';
    typed.style.cssText = 'color:#fff;white-space:pre;';
    var cursor  = document.createElement('span');
    cursor.textContent = '█';
    cursor.style.cssText = 'display:inline-block;color:#fff;animation:dos-cur .7s step-end infinite;margin-left:1px;';

    inputRow.appendChild(prompt);
    inputRow.appendChild(typed);
    inputRow.appendChild(cursor);
    shell.appendChild(output);
    shell.appendChild(inputRow);
    container.appendChild(shell);

    setStatus('Built-in Shell — Type HELP', 'ready');

    // Boot the built-in dos.js if available, otherwise inline mini-shell
    if (typeof window.__startBuiltinShell === 'function') {
      window.__startBuiltinShell(output, typed, prompt);
    } else {
      // Inline mini-shell as last resort
      startMiniShell(output, typed, prompt);
    }
  }

  /* ── Inline mini-shell (last resort) ─────────────── */
  function startMiniShell(out, typed, prompt) {
    var buf = '';
    var hist = [];
    var hi = -1;
    var cwd = 'C:';

    function print(text, color) {
      var s = document.createElement('span');
      s.style.display = 'block';
      if (color) s.style.color = color;
      s.textContent = text || '';
      out.appendChild(s);
      out.appendChild(document.createTextNode('\n'));
      out.scrollTop = out.scrollHeight;
    }

    print('');
    print('MS-DOS Version 6.22 (built-in shell)', '#ffffff');
    print('(C)Copyright Microsoft Corp 1981-1994.', '');
    print('');
    print('NOTE: Real disk image could not be loaded.', '#ffff54');
    print('      Running built-in JavaScript shell instead.', '#ffff54');
    print('');
    print('Type HELP for available commands.', '#55ff55');
    print('');

    document.addEventListener('keydown', function handler(e) {
      var fb = document.getElementById('fallback-shell');
      if (!fb) { document.removeEventListener('keydown', handler); return; }

      if (e.key === 'Enter') {
        e.preventDefault();
        var cmd = buf.trim();
        print(cwd + '> ' + cmd, '#555');
        buf = ''; typed.textContent = '';
        if (!cmd) { print(''); return; }
        hist.unshift(cmd); hi = -1;
        var parts = cmd.split(/\s+/);
        var c = parts[0].toUpperCase();
        var arg = parts.slice(1).join(' ');
        switch(c) {
          case 'VER':  print(''); print('MS-DOS Version 6.22','#fff'); break;
          case 'DIR':  print(''); print(' Volume in drive C is SYSTEM',''); print(' Directory of '+cwd,''); print(''); print('<DIR>  WINDOWS       04-25-1994','#55ffff'); print('<DIR>  DOS           04-25-1994','#55ffff'); print('<DIR>  USERS         04-25-1994','#55ffff'); print('       AUTOEXEC.BAT  04-25-1994',''); print('       CONFIG.SYS    04-25-1994',''); print(''); print('  2 file(s)   512 bytes',''); print('  3 dir(s)    420,000,000 bytes free',''); break;
          case 'CLS':  out.innerHTML = ''; break;
          case 'DATE': print('Current date is '+new Date().toLocaleDateString()); break;
          case 'TIME': print('Current time is '+new Date().toLocaleTimeString()); break;
          case 'MEM':  print(''); print('655,360 bytes total conventional memory',''); print('558,784 bytes available to MS-DOS','#55ff55'); break;
          case 'ECHO': print(arg||'ECHO is on.','#fff'); break;
          case 'EXIT': print('Goodbye.','#ffff54'); break;
          case 'HELP': print(''); print('VER  DIR  CLS  DATE  TIME  MEM  ECHO  HELP  EXIT','#55ffff'); print(''); print('(Full shell not available — disk image could not be loaded)','#555'); break;
          default: print("Bad command or file name - '"+parts[0]+"'",'#ff5555');
        }
        print('');
      } else if (e.key === 'Backspace') {
        e.preventDefault(); buf = buf.slice(0,-1); typed.textContent = buf;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); if(hi<hist.length-1)hi++; buf=hist[hi]||''; typed.textContent=buf;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); if(hi>0)hi--; else{hi=-1;buf='';} typed.textContent=buf;
      } else if (e.ctrlKey && e.key==='c') {
        e.preventDefault(); print('^C','#ffff54'); buf=''; typed.textContent='';
      } else if (e.key.length===1 && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); buf+=e.key; typed.textContent=buf;
      }
    });
  }

})();
 