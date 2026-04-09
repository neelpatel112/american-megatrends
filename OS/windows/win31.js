/**
 * win31.js — Microsoft Windows 3.1 Engine
 * ══════════════════════════════════════════════════════
 * Listens for os:selected {id:'win31'}
 *
 * Flow:
 *   os:selected → splash screen (boot/windows.jpg, 3s + bar)
 *   → fade out splash
 *   → play sound/winstrt.mp3
 *   → show desktop with Program Manager
 *
 * Directory structure expected:
 *   boot/windows.jpg       — startup splash image
 *   sound/winstrt.mp3      — startup sound
 *   OS/windows/win31.css   — styles (loaded in index.html)
 *   OS/windows/win31-apps.js — app implementations
 * ══════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* ── Constants ────────────────────────────────────── */
  var SPLASH_IMAGE  = 'boot/windows.jpg';
  var STARTUP_SOUND = 'sound/winstrt.mp3';
  var SPLASH_DURATION = 3000; // ms to show splash before fade

  var delay = function(ms){ return new Promise(function(r){ setTimeout(r,ms); }); };

  /* ── State ────────────────────────────────────────── */
  var windows   = {};   // id → { el, title, minimized, zIndex }
  var zCounter  = 100;
  var dragState = null;
  var resizeState = null;
  var activeWin = null;
  var clockTimer = null;
  var taskbarTimer = null;

  /* ── Listen for OS selection ──────────────────────── */
  window.addEventListener('os:selected', function(e) {
    if (!e.detail || e.detail.id !== 'win31') return;
    setTimeout(startWin31, 200);
  });

  /* ══════════════════════════════════════════════════
     BOOT SEQUENCE
  ══════════════════════════════════════════════════ */
  async function startWin31() {
    hideAllPhases();
    showPhaseWin31();
    await runSplash();
    await launchDesktop();
  }

  function hideAllPhases() {
    document.querySelectorAll('.phase').forEach(function(p){
      p.style.cssText = 'display:none!important;';
      p.classList.remove('active');
    });
    var osmenu = document.getElementById('phase-osmenu');
    if (osmenu) osmenu.style.display = 'none';
  }

  function showPhaseWin31() {
    var ph = document.getElementById('phase-win31');
    ph.style.display = 'flex';
    ph.style.flexDirection = 'column';
    ph.style.zIndex = '60';
  }

  /* ── Splash screen ────────────────────────────────── */
  async function runSplash() {
    var ph = document.getElementById('phase-win31');

    /* Build splash HTML */
    ph.innerHTML = [
      '<div id="w31-splash">',
      '  <img id="w31-splash-img" src="' + SPLASH_IMAGE + '" alt="Windows 3.1" draggable="false"/>',
      '  <div id="w31-splash-bar-wrap">',
      '    <div id="w31-splash-bar-outer">',
      '      <div id="w31-splash-bar-inner"></div>',
      '    </div>',
      '    <div id="w31-splash-label">Starting Windows 3.1...</div>',
      '  </div>',
      '</div>',
    ].join('');

    var img  = document.getElementById('w31-splash-img');
    var bar  = document.getElementById('w31-splash-bar-inner');
    var lbl  = document.getElementById('w31-splash-label');

    /* Fade image in */
    await delay(80);
    img.classList.add('visible');

    /* Animate loading bar 0 → 100% over SPLASH_DURATION */
    var steps   = 80;
    var stepMs  = SPLASH_DURATION / steps;
    var labels  = {
      10: 'Loading SYSTEM.INI...',
      25: 'Loading WIN.INI...',
      40: 'Initializing device drivers...',
      55: 'Loading GDI.EXE...',
      70: 'Loading USER.EXE...',
      85: 'Starting Program Manager...',
      95: 'Initializing desktop...',
    };

    for (var i = 0; i <= steps; i++) {
      var pct = Math.round((i / steps) * 100);
      bar.style.width = pct + '%';
      if (labels[pct]) lbl.textContent = labels[pct];
      await delay(stepMs);
    }

    /* Hold 1 extra second at 100% */
    await delay(400);

    /* Fade out */
    img.classList.add('fadeout');
    await delay(650);
  }

  /* ── Play startup sound ───────────────────────────── */
  function playStartupSound() {
    try {
      var audio = new Audio(STARTUP_SOUND);
      audio.volume = 0.85;
      audio.play().catch(function() {
        /* autoplay blocked — fine, desktop still shows */
      });
    } catch(e) { /* no audio support */ }
  }

  /* ══════════════════════════════════════════════════
     DESKTOP
  ══════════════════════════════════════════════════ */
  async function launchDesktop() {
    var ph = document.getElementById('phase-win31');

    ph.innerHTML = [
      /* Desktop area */
      '<div id="w31-desktop" style="display:block;">',
      buildDesktopIcons(),
      '</div>',

      /* Taskbar */
      '<div id="w31-taskbar">',
      '  <div id="w31-start-btn" title="Program Manager">',
      '    <span style="font-size:13px;">🪟</span> Program Manager',
      '  </div>',
      '  <div id="w31-taskbar-btns" style="display:flex;gap:2px;flex:1;overflow:hidden;"></div>',
      '  <div id="w31-clock">12:00 PM</div>',
      '</div>',

      /* Window layer */
      '<div id="w31-winlayer" style="position:absolute;inset:0 0 28px 0;pointer-events:none;z-index:50;overflow:hidden;"></div>',

    ].join('');

    /* Wire events */
    document.getElementById('w31-start-btn').addEventListener('click', function(){
      openProgramManager();
    });
    wireDesktopIcons();
    startClock();
    wireDragGlobal();

    /* Play sound AFTER desktop is visible */
    await delay(80);
    playStartupSound();

    /* Auto-open Program Manager after sound */
    await delay(600);
    openProgramManager();
  }

  /* ── Desktop icon definitions ────────────────────── */
  var DESKTOP_ICONS = [
    { id:'progman',    label:'Program\nManager',    icon:'🗂️',  x:16,  y:16,  action:'openProgramManager' },
    { id:'filemanager',label:'File\nManager',       icon:'📁',  x:16,  y:110, action:'openFileManager'   },
    { id:'notepad',    label:'Notepad',              icon:'📝',  x:16,  y:204, action:'openNotepad'       },
    { id:'minesweeper',label:'Minesweeper',          icon:'💣',  x:16,  y:298, action:'openMinesweeper'   },
    { id:'clock',      label:'Clock',                icon:'🕐',  x:16,  y:392, action:'openClock'         },
    { id:'paint',      label:'Paintbrush',           icon:'🎨',  x:16,  y:486, action:'openPaint'         },
    { id:'mycomp',     label:'My Computer',          icon:'🖥️',  x:96,  y:16,  action:'openMyComputer'    },
    { id:'control',    label:'Control\nPanel',       icon:'⚙️',  x:96,  y:110, action:'openControlPanel'  },
  ];

  function buildDesktopIcons() {
    return DESKTOP_ICONS.map(function(ic) {
      return [
        '<div class="w31-icon" id="dicon-'+ic.id+'"',
        '  style="left:'+ic.x+'px;top:'+ic.y+'px;"',
        '  data-action="'+ic.action+'">',
        '  <div class="w31-icon-svg" style="display:flex;align-items:center;justify-content:center;font-size:26px;width:32px;height:32px;">'+ic.icon+'</div>',
        '  <div class="w31-icon-label">'+ic.label.replace('\n','<br>')+'</div>',
        '</div>',
      ].join('');
    }).join('');
  }

  function wireDesktopIcons() {
    DESKTOP_ICONS.forEach(function(ic) {
      var el = document.getElementById('dicon-' + ic.id);
      if (!el) return;
      el.addEventListener('dblclick', function() {
        if (typeof window.Win31Apps !== 'undefined' && window.Win31Apps[ic.action]) {
          window.Win31Apps[ic.action]();
        } else if (typeof window[ic.action] === 'function') {
          window[ic.action]();
        } else {
          callAction(ic.action);
        }
      });
      el.addEventListener('click', function(e) {
        document.querySelectorAll('.w31-icon').forEach(function(i){ i.classList.remove('selected'); });
        el.classList.add('selected');
        e.stopPropagation();
      });
    });
    /* Deselect on desktop click */
    var desk = document.getElementById('w31-desktop');
    if (desk) desk.addEventListener('click', function() {
      document.querySelectorAll('.w31-icon').forEach(function(i){ i.classList.remove('selected'); });
    });
  }

  function callAction(name) {
    var map = {
      openProgramManager: openProgramManager,
      openFileManager:    openFileManager,
      openNotepad:        openNotepad,
      openMinesweeper:    openMinesweeper,
      openClock:          openClock,
      openPaint:          openPaint,
      openMyComputer:     openMyComputer,
      openControlPanel:   openControlPanel,
    };
    if (map[name]) map[name]();
  }

  /* ── Live clock ───────────────────────────────────── */
  function startClock() {
    function tick() {
      var el = document.getElementById('w31-clock');
      if (!el) { clearInterval(clockTimer); return; }
      var d = new Date();
      var h = d.getHours(), m = d.getMinutes();
      var ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      el.textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ══════════════════════════════════════════════════
     WINDOW MANAGEMENT
  ══════════════════════════════════════════════════ */
  function getWinLayer() { return document.getElementById('w31-winlayer'); }

  function createWindow(opts) {
    /*
      opts: { id, title, width, height, x, y, content, menubar, statusbar, resizable }
    */
    var id = opts.id || ('win' + Date.now());
    var w  = opts.width  || 400;
    var h  = opts.height || 300;
    var x  = opts.x !== undefined ? opts.x : 60 + Object.keys(windows).length * 22;
    var y  = opts.y !== undefined ? opts.y : 40 + Object.keys(windows).length * 22;

    var layer = getWinLayer();
    if (!layer) return null;

    /* Bring existing window to front if already open */
    if (windows[id]) {
      focusWindow(id);
      if (windows[id].minimized) restoreWindow(id);
      return windows[id].el;
    }

    var el = document.createElement('div');
    el.className = 'w31-window';
    el.id = 'wnd-' + id;
    el.style.cssText = 'width:'+w+'px;height:'+h+'px;left:'+x+'px;top:'+y+'px;pointer-events:all;';

    el.innerHTML = [
      /* Title bar */
      '<div class="w31-titlebar" data-winid="'+id+'">',
      '  <div class="w31-titlebar-icon" data-winid="'+id+'" title="System menu">■</div>',
      '  <div class="w31-titlebar-title">'+opts.title+'</div>',
      '  <div class="w31-btn-min" data-winid="'+id+'" title="Minimize">▼</div>',
      '  <div class="w31-btn-max" data-winid="'+id+'" title="Maximize">▲</div>',
      '  <div class="w31-btn-close" data-winid="'+id+'" title="Close">✕</div>',
      '</div>',

      /* Menu bar */
      opts.menubar ? '<div class="w31-menubar">'+opts.menubar+'</div>' : '',

      /* Client area */
      '<div class="w31-client'+(opts.greyClient?' grey-bg':'')+'">',
      opts.content || '',
      '</div>',

      /* Status bar */
      opts.statusbar ? '<div class="w31-statusbar"><div class="w31-status-pane" id="status-'+id+'">'+opts.statusbar+'</div></div>' : '',

      /* Resize handle */
      opts.resizable !== false ? '<div class="w31-resize" data-winid="'+id+'"></div>' : '',
    ].join('');

    layer.appendChild(el);
    windows[id] = { el:el, title:opts.title, minimized:false, zIndex:++zCounter, x:x, y:y, w:w, h:h };
    focusWindow(id);
    wireTitlebar(el, id);
    updateTaskbar();
    return el;
  }

  function focusWindow(id) {
    if (!windows[id]) return;
    activeWin = id;
    zCounter++;
    windows[id].el.style.zIndex = zCounter;
    windows[id].zIndex = zCounter;
    /* Update active/inactive appearance */
    Object.keys(windows).forEach(function(wid) {
      if (windows[wid].el) {
        if (wid === id) windows[wid].el.classList.remove('inactive');
        else windows[wid].el.classList.add('inactive');
      }
    });
    updateTaskbar();
  }

  function closeWindow(id) {
    if (!windows[id]) return;
    windows[id].el.remove();
    delete windows[id];
    /* Remove minimized icon if any */
    var micon = document.getElementById('micon-' + id);
    if (micon) micon.remove();
    updateTaskbar();
  }

  function minimizeWindow(id) {
    if (!windows[id]) return;
    windows[id].el.style.display = 'none';
    windows[id].minimized = true;
    /* Place minimized icon at bottom of desktop */
    var desk = document.getElementById('w31-desktop');
    if (!desk) return;
    var micon = document.getElementById('micon-' + id);
    if (!micon) {
      micon = document.createElement('div');
      micon.className = 'w31-minimized-icon';
      micon.id = 'micon-' + id;
      var iconIdx = Object.keys(windows).indexOf(id);
      micon.style.left = (8 + iconIdx * 74) + 'px';
      micon.innerHTML = '<div style="font-size:22px;">🗔</div><div class="w31-icon-label">'+windows[id].title+'</div>';
      micon.addEventListener('dblclick', function() { restoreWindow(id); });
      desk.appendChild(micon);
    }
    updateTaskbar();
  }

  function restoreWindow(id) {
    if (!windows[id]) return;
    windows[id].el.style.display = 'flex';
    windows[id].minimized = false;
    var micon = document.getElementById('micon-' + id);
    if (micon) micon.remove();
    focusWindow(id);
  }

  function maximizeWindow(id) {
    if (!windows[id]) return;
    var el = windows[id].el;
    if (el.classList.contains('maximized')) {
      /* restore */
      el.classList.remove('maximized');
      el.style.width  = windows[id].w + 'px';
      el.style.height = windows[id].h + 'px';
      el.style.left   = windows[id].x + 'px';
      el.style.top    = windows[id].y + 'px';
    } else {
      /* save current */
      windows[id].w = parseInt(el.style.width);
      windows[id].h = parseInt(el.style.height);
      windows[id].x = parseInt(el.style.left);
      windows[id].y = parseInt(el.style.top);
      el.classList.add('maximized');
    }
  }

  /* ── Title bar wiring ─────────────────────────────── */
  function wireTitlebar(el, id) {
    /* Close */
    var closeBtn = el.querySelector('.w31-btn-close');
    if (closeBtn) closeBtn.addEventListener('click', function(e){ e.stopPropagation(); closeWindow(id); });

    /* Minimize */
    var minBtn = el.querySelector('.w31-btn-min');
    if (minBtn) minBtn.addEventListener('click', function(e){ e.stopPropagation(); minimizeWindow(id); });

    /* Maximize */
    var maxBtn = el.querySelector('.w31-btn-max');
    if (maxBtn) maxBtn.addEventListener('click', function(e){ e.stopPropagation(); maximizeWindow(id); });

    /* Focus on click */
    el.addEventListener('mousedown', function(e) {
      focusWindow(id);
      e.stopPropagation();
    });

    /* Drag via titlebar */
    var titlebar = el.querySelector('.w31-titlebar');
    if (titlebar) {
      titlebar.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('w31-btn-min') ||
            e.target.classList.contains('w31-btn-max') ||
            e.target.classList.contains('w31-btn-close') ||
            e.target.classList.contains('w31-titlebar-icon')) return;
        dragState = {
          id:   id,
          startX: e.clientX - parseInt(el.style.left||0),
          startY: e.clientY - parseInt(el.style.top||0),
        };
        e.preventDefault();
      });
    }

    /* Resize handle */
    var resizeHandle = el.querySelector('.w31-resize');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', function(e) {
        resizeState = {
          id: id,
          startX: e.clientX,
          startY: e.clientY,
          startW: parseInt(el.style.width||400),
          startH: parseInt(el.style.height||300),
        };
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  /* ── Global drag / resize ─────────────────────────── */
  function wireDragGlobal() {
    document.addEventListener('mousemove', function(e) {
      if (dragState) {
        var wdata = windows[dragState.id];
        if (!wdata) { dragState = null; return; }
        var layer = getWinLayer();
        var lRect = layer ? layer.getBoundingClientRect() : {left:0,top:0,width:window.innerWidth,height:window.innerHeight};
        var nx = Math.max(0, Math.min(e.clientX - dragState.startX - lRect.left, lRect.width  - 60));
        var ny = Math.max(0, Math.min(e.clientY - dragState.startY - lRect.top,  lRect.height - 20));
        wdata.el.style.left = nx + 'px';
        wdata.el.style.top  = ny + 'px';
        wdata.x = nx; wdata.y = ny;
      }
      if (resizeState) {
        var rdata = windows[resizeState.id];
        if (!rdata) { resizeState = null; return; }
        var nw = Math.max(120, resizeState.startW + (e.clientX - resizeState.startX));
        var nh = Math.max(80,  resizeState.startH + (e.clientY - resizeState.startY));
        rdata.el.style.width  = nw + 'px';
        rdata.el.style.height = nh + 'px';
        rdata.w = nw; rdata.h = nh;
      }
    });
    document.addEventListener('mouseup', function() {
      dragState   = null;
      resizeState = null;
    });
  }

  /* ── Taskbar update ───────────────────────────────── */
  function updateTaskbar() {
    var container = document.getElementById('w31-taskbar-btns');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(windows).forEach(function(id) {
      var wdata = windows[id];
      var btn = document.createElement('div');
      btn.className = 'w31-taskbtn' + (id === activeWin ? ' active' : '');
      btn.textContent = wdata.title;
      btn.addEventListener('click', function() {
        if (wdata.minimized) restoreWindow(id);
        else focusWindow(id);
      });
      container.appendChild(btn);
    });
  }

  /* ══════════════════════════════════════════════════
     MENU SYSTEM
  ══════════════════════════════════════════════════ */
  var openDropdown = null;

  function showDropdown(menuItemEl, items) {
    closeDropdown();
    var rect = menuItemEl.getBoundingClientRect();
    var ph   = document.getElementById('phase-win31');
    var phR  = ph ? ph.getBoundingClientRect() : {left:0,top:0};

    var dd = document.createElement('div');
    dd.className = 'w31-dropdown';
    dd.id = 'w31-active-dropdown';
    dd.style.left = (rect.left - phR.left) + 'px';
    dd.style.top  = (rect.bottom - phR.top) + 'px';

    items.forEach(function(item) {
      if (item === '-') {
        var sep = document.createElement('div'); sep.className='w31-dd-sep'; dd.appendChild(sep);
      } else {
        var di = document.createElement('div');
        di.className = 'w31-dd-item' + (item.disabled?' disabled':'') + (item.check?' w31-dd-check':'');
        di.textContent = item.label;
        if (!item.disabled && item.action) {
          di.addEventListener('click', function() { closeDropdown(); item.action(); });
        }
        dd.appendChild(di);
      }
    });

    ph.appendChild(dd);
    openDropdown = dd;
    menuItemEl.classList.add('open');

    setTimeout(function() {
      document.addEventListener('click', closeDropdown, {once:true});
    }, 0);
  }

  function closeDropdown() {
    if (openDropdown) { openDropdown.remove(); openDropdown = null; }
    document.querySelectorAll('.w31-menu-item.open').forEach(function(el){ el.classList.remove('open'); });
  }

  function wireMenubar(el, menuDefs) {
    var menubar = el.querySelector('.w31-menubar');
    if (!menubar) return;
    menuDefs.forEach(function(def) {
      var item = menubar.querySelector('[data-menu="'+def.name+'"]');
      if (!item) return;
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        showDropdown(item, def.items);
      });
    });
  }

  /* ══════════════════════════════════════════════════
     APPS
  ══════════════════════════════════════════════════ */

  /* ── Program Manager ──────────────────────────────── */
  function openProgramManager() {
    var groups = [
      { icon:'🖥️', label:'Accessories' },
      { icon:'🎮', label:'Games' },
      { icon:'🔧', label:'System Tools' },
      { icon:'📊', label:'Office' },
      { icon:'🌐', label:'Network' },
      { icon:'📁', label:'File Manager' },
    ];

    var iconsHTML = groups.map(function(g) {
      return '<div class="w31-progman-icon" onclick=""><div class="w31-pm-img" style="font-size:24px;display:flex;align-items:center;justify-content:center;">'+g.icon+'</div><div class="w31-pm-label">'+g.label+'</div></div>';
    }).join('');

    var menubarHTML = [
      '<span class="w31-menu-item" data-menu="file">File</span>',
      '<span class="w31-menu-item" data-menu="options">Options</span>',
      '<span class="w31-menu-item" data-menu="window">Window</span>',
      '<span class="w31-menu-item" data-menu="help">Help</span>',
    ].join('');

    var el = createWindow({
      id: 'progman', title: 'Program Manager',
      width: 500, height: 340, x: 60, y: 40,
      menubar: menubarHTML,
      greyClient: true,
      resizable: true,
      statusbar: 'Windows 3.1',
      content: '<div style="padding:8px;display:flex;flex-wrap:wrap;">' + iconsHTML + '</div>',
    });
    if (!el) return;

    wireMenubar(el, [
      { name:'file', items:[
        {label:'New...',         action:function(){}},
        {label:'Open',          action:function(){}},
        {label:'Move...',       action:function(){}},
        {label:'Copy...',       action:function(){}},
        '-',
        {label:'Delete',        action:function(){}},
        {label:'Properties...', action:function(){}},
        '-',
        {label:'Run...',        action:function(){ openRunDialog(); }},
        '-',
        {label:'Exit Windows...', action:function(){ showExitDialog(); }},
      ]},
      { name:'options', items:[
        {label:'Auto Arrange',  check:true, action:function(){}},
        {label:'Minimize on Use',           action:function(){}},
        '-',
        {label:'Save Settings on Exit',     action:function(){}},
      ]},
      { name:'window', items:[
        {label:'Cascade',       action:function(){ cascadeWindows(); }},
        {label:'Tile',          action:function(){}},
        {label:'Arrange Icons', action:function(){}},
        '-',
        {label:'1 Program Manager', check:true, action:function(){ focusWindow('progman'); }},
      ]},
      { name:'help', items:[
        {label:'Contents',      action:function(){}},
        {label:'Search...',     action:function(){}},
        '-',
        {label:'About Program Manager...', action:function(){ showAbout(); }},
      ]},
    ]);

    /* Wire group icons to open apps */
    var groupActions = ['openMyComputer','openMyComputer','openFileManager','openNotepad','openMyComputer','openFileManager'];
    var pmIcons = el.querySelectorAll('.w31-progman-icon');
    pmIcons.forEach(function(ic, i) {
      ic.addEventListener('dblclick', function() { callAction(groupActions[i] || 'openNotepad'); });
    });
  }

  /* ── Notepad ──────────────────────────────────────── */
  function openNotepad() {
    var menubarHTML = [
      '<span class="w31-menu-item" data-menu="file">File</span>',
      '<span class="w31-menu-item" data-menu="edit">Edit</span>',
      '<span class="w31-menu-item" data-menu="search">Search</span>',
      '<span class="w31-menu-item" data-menu="help">Help</span>',
    ].join('');

    var el = createWindow({
      id: 'notepad', title: 'Notepad - (Untitled)',
      width: 420, height: 300, x: 100, y: 80,
      menubar: menubarHTML,
      resizable: true,
      content: '<textarea id="notepad-ta" spellcheck="false" wrap="off">Welcome to Windows 3.1 Notepad!\n\nYou can type here. This is a real editable text area.\nUse File > Save As... (placeholder) or just type freely.\n</textarea>',
    });
    if (!el) return;

    /* Make textarea fill client */
    var ta = document.getElementById('notepad-ta');
    if (ta) {
      var client = el.querySelector('.w31-client');
      if (client) { client.style.padding='0'; ta.style.cssText='width:100%;height:100%;border:none;outline:none;resize:none;font-family:"Courier New",monospace;font-size:13px;padding:4px;'; }
    }

    wireMenubar(el, [
      { name:'file', items:[
        {label:'New',        action:function(){ var t=document.getElementById('notepad-ta'); if(t)t.value=''; }},
        {label:'Open...',    action:function(){}, disabled:true},
        {label:'Save',       action:function(){}, disabled:true},
        {label:'Save As...', action:function(){}, disabled:true},
        '-',
        {label:'Print',      action:function(){}, disabled:true},
        '-',
        {label:'Exit',       action:function(){ closeWindow('notepad'); }},
      ]},
      { name:'edit', items:[
        {label:'Undo',       action:function(){}},
        '-',
        {label:'Cut',        action:function(){ document.execCommand('cut'); }},
        {label:'Copy',       action:function(){ document.execCommand('copy'); }},
        {label:'Paste',      action:function(){ document.execCommand('paste'); }},
        {label:'Delete',     action:function(){ document.execCommand('delete'); }},
        '-',
        {label:'Select All', action:function(){ var t=document.getElementById('notepad-ta'); if(t){t.focus();t.select();} }},
        {label:'Time/Date',  action:function(){ var t=document.getElementById('notepad-ta'); if(t){t.value+='\n'+new Date().toLocaleString();} }},
        '-',
        {label:'Word Wrap',  action:function(){}},
      ]},
      { name:'search', items:[
        {label:'Find...',      action:function(){}, disabled:true},
        {label:'Find Next',    action:function(){}, disabled:true},
        {label:'Replace...',   action:function(){}, disabled:true},
        {label:'Go To Line...',action:function(){}, disabled:true},
      ]},
      { name:'help', items:[
        {label:'Help Topics',  action:function(){}},
        '-',
        {label:'About Notepad...', action:function(){ showAboutApp('Notepad','Microsoft Notepad\nVersion 3.1\n\nPart of the Microsoft Windows operating\nsystem environment.'); }},
      ]},
    ]);
  }

  /* ── Minesweeper ──────────────────────────────────── */
  function openMinesweeper() {
    var el = createWindow({
      id: 'minesweeper', title: 'Minesweeper',
      width: 248, height: 320, x: 200, y: 100,
      resizable: false,
      greyClient: true,
      content: '<div id="mine-root"></div>',
    });
    if (!el) return;
    if (window.Win31Apps && window.Win31Apps.initMinesweeper) {
      window.Win31Apps.initMinesweeper(document.getElementById('mine-root'));
    }
  }

  /* ── Clock ────────────────────────────────────────── */
  function openClock() {
    var el = createWindow({
      id: 'clock', title: 'Clock',
      width: 160, height: 160, x: 320, y: 160,
      resizable: true,
      greyClient: true,
      content: '<canvas id="w31-analog-clock" width="140" height="140"></canvas>',
    });
    if (!el) return;
    if (window.Win31Apps && window.Win31Apps.initClock) {
      window.Win31Apps.initClock(document.getElementById('w31-analog-clock'));
    }
  }

  /* ── Paint ────────────────────────────────────────── */
  function openPaint() {
    var menubarHTML = [
      '<span class="w31-menu-item" data-menu="file">File</span>',
      '<span class="w31-menu-item" data-menu="edit">Edit</span>',
      '<span class="w31-menu-item" data-menu="view">View</span>',
      '<span class="w31-menu-item" data-menu="options">Options</span>',
      '<span class="w31-menu-item" data-menu="help">Help</span>',
    ].join('');

    var el = createWindow({
      id: 'paint', title: 'Paintbrush',
      width: 520, height: 380, x: 80, y: 60,
      menubar: menubarHTML,
      resizable: true,
      content: '<div id="paint-root"></div>',
    });
    if (!el) return;
    if (window.Win31Apps && window.Win31Apps.initPaint) {
      window.Win31Apps.initPaint(document.getElementById('paint-root'));
    }
    wireMenubar(el, [
      { name:'file', items:[
        {label:'New',    action:function(){ if(window.Win31Apps&&window.Win31Apps.paintClear)window.Win31Apps.paintClear(); }},
        '-',
        {label:'Exit',   action:function(){ closeWindow('paint'); }},
      ]},
      { name:'edit',    items:[{label:'Undo',action:function(){}},{label:'Cut',action:function(){}},{label:'Copy',action:function(){}},{label:'Paste',action:function(){}}]},
      { name:'view',    items:[{label:'Tool Box',check:true,action:function(){}},{label:'Color Box',check:true,action:function(){}},{label:'Status Bar',check:true,action:function(){}}]},
      { name:'options', items:[{label:'Image Attributes...',action:function(){}},{label:'Flip and Rotate...',action:function(){}},{label:'Stretch and Skew...',action:function(){}}]},
      { name:'help',    items:[{label:'Help Topics',action:function(){}},'-',{label:'About Paintbrush...',action:function(){ showAboutApp('Paintbrush','Microsoft Paintbrush\nVersion 3.1'); }}]},
    ]);
  }

  /* ── File Manager ─────────────────────────────────── */
  function openFileManager() {
    var menubarHTML = [
      '<span class="w31-menu-item" data-menu="file">File</span>',
      '<span class="w31-menu-item" data-menu="disk">Disk</span>',
      '<span class="w31-menu-item" data-menu="tree">Tree</span>',
      '<span class="w31-menu-item" data-menu="view">View</span>',
      '<span class="w31-menu-item" data-menu="options">Options</span>',
      '<span class="w31-menu-item" data-menu="window">Window</span>',
      '<span class="w31-menu-item" data-menu="help">Help</span>',
    ].join('');

    var treeHTML = [
      '<div class="fm-tree-item selected">📁 C:\\</div>',
      '<div class="fm-tree-item" style="padding-left:18px;">📁 WINDOWS</div>',
      '<div class="fm-tree-item" style="padding-left:18px;">📁 DOS</div>',
      '<div class="fm-tree-item" style="padding-left:18px;">📁 TEMP</div>',
    ].join('');

    var filesHTML = [
      ['📁','WINDOWS'],['📁','DOS'],['📁','TEMP'],['📁','SYSTEM'],
      ['📄','AUTOEXEC.BAT'],['📄','CONFIG.SYS'],['📄','WIN.INI'],['📄','SYSTEM.INI'],
      ['📄','COMMAND.COM'],['🖼️','SETUP.EXE'],['📄','README.TXT'],
    ].map(function(f){ return '<div class="fm-file-item"><div class="fm-icon">'+f[0]+'</div><div>'+f[1]+'</div></div>'; }).join('');

    var el = createWindow({
      id: 'filemanager', title: 'File Manager',
      width: 480, height: 300, x: 90, y: 70,
      menubar: menubarHTML,
      resizable: true,
      statusbar: 'C:\\ — 420 MB free',
      content: '<div class="fm-tree">'+treeHTML+'</div><div class="fm-files">'+filesHTML+'</div>',
    });
    if (!el) return;
    wireMenubar(el, [
      { name:'file', items:[{label:'Open',action:function(){}},{label:'Move...',action:function(){}},{label:'Copy...',action:function(){}},'-',{label:'Delete',action:function(){}},{label:'Properties...',action:function(){}},'-',{label:'Exit',action:function(){closeWindow('filemanager');}}]},
      { name:'disk', items:[{label:'Copy Disk...',action:function(){}},{label:'Label Disk...',action:function(){}},{label:'Format Disk...',action:function(){}},{label:'Connect Network Drive...',action:function(){}}]},
      { name:'tree', items:[{label:'Expand One Level',action:function(){}},{label:'Expand Branch',action:function(){}},{label:'Expand All',action:function(){}},{label:'Collapse Branch',action:function(){}}]},
      { name:'view', items:[{label:'Tree and Directory',check:true,action:function(){}},{label:'Tree Only',action:function(){}},{label:'Directory Only',action:function(){}},'-',{label:'Name',action:function(){}},{label:'All File Details',action:function(){}},{label:'Sort by Name',check:true,action:function(){}},{label:'Sort by Type',action:function(){}},{label:'Sort by Size',action:function(){}},{label:'Sort by Date',action:function(){}}]},
      { name:'options', items:[{label:'Confirmation...',action:function(){}},{label:'Font...',action:function(){}},{label:'Status Bar',check:true,action:function(){}},{label:'Open New Window on Connect',action:function(){}},'-',{label:'Save Settings on Exit',action:function(){}}]},
      { name:'window', items:[{label:'New Window',action:function(){}},{label:'Cascade',action:function(){}},{label:'Tile',action:function(){}},{label:'Arrange Icons',action:function(){}}]},
      { name:'help', items:[{label:'Contents',action:function(){}},'-',{label:'About File Manager...',action:function(){ showAboutApp('File Manager','Microsoft File Manager\nVersion 3.1'); }}]},
    ]);
  }

  /* ── My Computer ──────────────────────────────────── */
  function openMyComputer() {
    var items = [
      {icon:'💾', label:'Drive A:'},
      {icon:'💿', label:'Drive B:'},
      {icon:'🖥️', label:'Drive C:'},
      {icon:'🖨️', label:'Printers'},
      {icon:'⚙️', label:'Control Panel'},
      {icon:'🌐', label:'Network'},
    ];
    var content = '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;">' +
      items.map(function(it){ return '<div class="w31-progman-icon"><div class="w31-pm-img" style="font-size:24px;display:flex;align-items:center;justify-content:center;">'+it.icon+'</div><div class="w31-pm-label">'+it.label+'</div></div>'; }).join('') + '</div>';
    createWindow({ id:'mycomp', title:'My Computer', width:320, height:200, x:120, y:80, resizable:true, greyClient:true, content:content });
  }

  /* ── Control Panel ────────────────────────────────── */
  function openControlPanel() {
    var items = [
      {icon:'🎨', label:'Colors'},    {icon:'🖋️', label:'Fonts'},
      {icon:'🖱️', label:'Mouse'},     {icon:'⌨️', label:'Keyboard'},
      {icon:'🖨️', label:'Printers'},  {icon:'🌐', label:'Network'},
      {icon:'📅', label:'Date/Time'}, {icon:'🔊', label:'Sound'},
    ];
    var content = '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;">' +
      items.map(function(it){ return '<div class="w31-progman-icon"><div class="w31-pm-img" style="font-size:24px;display:flex;align-items:center;justify-content:center;">'+it.icon+'</div><div class="w31-pm-label">'+it.label+'</div></div>'; }).join('') + '</div>';
    createWindow({ id:'control', title:'Control Panel', width:340, height:220, x:130, y:90, resizable:true, greyClient:true, content:content });
  }

  /* ── About dialog ─────────────────────────────────── */
  function showAbout() {
    showAboutApp('Program Manager',
      'Microsoft Windows\nVersion 3.1\n\n' +
      'Copyright © 1985-1992 Microsoft Corp.\n\n' +
      '386 Enhanced Mode\n' +
      '16,384 KB Free Memory');
  }

  function showAboutApp(name, msg) {
    var ph = document.getElementById('phase-win31');
    var d = document.createElement('div');
    d.className = 'w31-dialog';
    d.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);min-width:280px;';
    d.innerHTML = [
      '<div class="w31-titlebar" style="cursor:default;">',
      '  <div class="w31-titlebar-title">About '+name+'</div>',
      '</div>',
      '<div class="w31-dialog-body">',
      '  <div style="font-size:28px;">🪟</div>',
      '  <div class="w31-dialog-msg" style="white-space:pre-line;text-align:center;">'+msg+'</div>',
      '  <div class="w31-dialog-buttons">',
      '    <div class="w31-dialog-btn default" id="about-ok">OK</div>',
      '  </div>',
      '</div>',
    ].join('');
    ph.appendChild(d);
    document.getElementById('about-ok').addEventListener('click', function(){ d.remove(); });
  }

  /* ── Exit dialog ──────────────────────────────────── */
  function showExitDialog() {
    var ph = document.getElementById('phase-win31');
    var d = document.createElement('div');
    d.className = 'w31-dialog';
    d.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);';
    d.innerHTML = [
      '<div class="w31-titlebar" style="cursor:default;">',
      '  <div class="w31-titlebar-title">Exit Windows</div>',
      '</div>',
      '<div class="w31-dialog-body">',
      '  <div class="w31-dialog-msg">This will end your Windows session.<br>Exit Windows?</div>',
      '  <div class="w31-dialog-buttons">',
      '    <div class="w31-dialog-btn default" id="exit-ok">OK</div>',
      '    <div class="w31-dialog-btn" id="exit-cancel">Cancel</div>',
      '  </div>',
      '</div>',
    ].join('');
    ph.appendChild(d);
    document.getElementById('exit-ok').addEventListener('click', function(){
      d.remove();
      shutdownWindows();
    });
    document.getElementById('exit-cancel').addEventListener('click', function(){ d.remove(); });
  }

  /* ── Run dialog ───────────────────────────────────── */
  function openRunDialog() {
    var ph = document.getElementById('phase-win31');
    var d = document.createElement('div');
    d.className = 'w31-dialog';
    d.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);min-width:300px;';
    d.innerHTML = [
      '<div class="w31-titlebar" style="cursor:default;">',
      '  <div class="w31-titlebar-title">Run</div>',
      '</div>',
      '<div class="w31-dialog-body" style="align-items:flex-start;">',
      '  <div style="font-size:12px;">Command Line:</div>',
      '  <input id="run-input" type="text" style="width:100%;font-family:Courier New;font-size:12px;border:inset 2px;padding:2px 4px;outline:none;" placeholder="e.g. NOTEPAD.EXE"/>',
      '  <div style="display:flex;gap:8px;width:100%;justify-content:center;margin-top:4px;">',
      '    <div class="w31-dialog-btn default" id="run-ok">OK</div>',
      '    <div class="w31-dialog-btn" id="run-cancel">Cancel</div>',
      '  </div>',
      '</div>',
    ].join('');
    ph.appendChild(d);
    var inp = document.getElementById('run-input');
    if (inp) setTimeout(function(){ inp.focus(); }, 50);
    document.getElementById('run-ok').addEventListener('click', function(){
      var cmd = (inp ? inp.value : '').toUpperCase().replace('.EXE','').replace('.COM','').trim();
      d.remove();
      if (cmd==='NOTEPAD')      openNotepad();
      else if (cmd==='MINESWEEPER'||cmd==='WINMINE') openMinesweeper();
      else if (cmd==='CLOCK')   openClock();
      else if (cmd==='PAINT'||cmd==='PAINTBRUSH') openPaint();
      else if (cmd==='WINFILE') openFileManager();
    });
    document.getElementById('run-cancel').addEventListener('click', function(){ d.remove(); });
  }

  /* ── Cascade ──────────────────────────────────────── */
  function cascadeWindows() {
    var offset = 0;
    Object.keys(windows).forEach(function(id) {
      var w = windows[id];
      if (!w.minimized) {
        w.el.style.left = (30 + offset * 20) + 'px';
        w.el.style.top  = (30 + offset * 20) + 'px';
        w.el.classList.remove('maximized');
        offset++;
      }
    });
  }

  /* ── Shutdown ─────────────────────────────────────── */
  async function shutdownWindows() {
    if (clockTimer) clearInterval(clockTimer);
    var ph = document.getElementById('phase-win31');
    /* Fade to black */
    var blackout = document.createElement('div');
    blackout.style.cssText = 'position:absolute;inset:0;background:#000;z-index:99999;opacity:0;transition:opacity 0.8s;';
    ph.appendChild(blackout);
    await delay(50);
    blackout.style.opacity = '1';
    await delay(900);
    /* Show OS menu again */
    ph.style.display = 'none';
    window.dispatchEvent(new CustomEvent('win31:exit', { bubbles:true }));
  }

  /* Expose some functions for apps file */
  window.Win31 = {
    createWindow:    createWindow,
    closeWindow:     closeWindow,
    focusWindow:     focusWindow,
    wireMenubar:     wireMenubar,
    showDropdown:    showDropdown,
    showAboutApp:    showAboutApp,
    openNotepad:     openNotepad,
    openMinesweeper: openMinesweeper,
    openClock:       openClock,
    openPaint:       openPaint,
    openFileManager: openFileManager,
    openMyComputer:  openMyComputer,
    openControlPanel:openControlPanel,
    openProgramManager: openProgramManager,
  };

})();
 