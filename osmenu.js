/**
 * osmenu.js — AMIBIOS Boot Device Selection Menu
 * ══════════════════════════════════════════════════════
 * Shown after bios:complete fires.
 * User selects an OS with keyboard or mouse.
 *
 * Flow:
 *   bios:complete → showOSMenu()
 *   User selects MS-DOS 6.22 → fires 'os:selected' {id:'dos'}
 *   User selects Win 3.1     → shows coming-soon popup
 *
 * emulator.js listens for 'os:selected' to start the right OS.
 * ══════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var SFX = window.BiosAudio;
  var delay = function(ms){ return new Promise(function(r){ setTimeout(r,ms); }); };

  /* ── OS definitions ───────────────────────────────── */
  var OS_LIST = [
    {
      id:        'dos',
      label:     'MS-DOS 6.22',
      sublabel:  'Microsoft Disk Operating System — 1994',
      type:      'Floppy (A:)  —  1.44 MB FAT12',
      icon:      'dos-icon',
      available: true,
    },
    {
      id:        'win31',
      label:     'Microsoft Windows 3.1',
      sublabel:  'Windows — 1992',
      type:      'Hard Disk (C:)  —  IDE 504 MB',
      icon:      'win31-icon',
      available: true,
      comingSoon: false,
    },
  ];

  var selectedIdx = 0;  // keyboard selection index (only available ones navigable)
  var menuActive  = false;
  var confirming  = false;

  /* ── Listen for BIOS complete ─────────────────────── */
  window.addEventListener('bios:complete', function () {
    setTimeout(showOSMenu, 280);
  });

  /* ══════════════════════════════════════════════════
     BUILD THE MENU HTML
  ══════════════════════════════════════════════════ */
  function buildMenu() {
    var phase = document.getElementById('phase-osmenu');
    if (!phase) return;

    var now  = new Date();
    var time = now.toLocaleTimeString('en-US', {hour12:false});
    var date = now.toLocaleDateString('en-US', {month:'2-digit', day:'2-digit', year:'numeric'});

    // Build row HTML
    var rowsHTML = OS_LIST.map(function(os, i) {
      var lockBadge = os.comingSoon
        ? '<span class="osm-lock">⌛ COMING SOON</span>'
        : '';
      return [
        '<div class="osm-row ' + (os.available ? 'available' : 'coming-soon') + '"',
        '  data-idx="' + i + '" data-id="' + os.id + '"',
        '  role="option" aria-label="' + os.label + '">',
        '  <div class="osm-id">' + (i + 1) + '</div>',
        '  <div class="osm-name">',
        '    <span class="os-label">',
        '      <span class="os-icon ' + os.icon + '"></span>',
        '      ' + os.label + lockBadge,
        '    </span>',
        '    <span class="os-sublabel">' + os.sublabel + '</span>',
        '  </div>',
        '  <div class="osm-type">' + os.type + '</div>',
        '</div>',
      ].join('');
    }).join('');

    phase.innerHTML = [
      /* title bar */
      '<div id="osm-titlebar">',
      '  <div id="osm-title">AMIBIOS &mdash; Boot Device Selection Menu</div>',
      '  <div id="osm-version">Version 08.00.15</div>',
      '</div>',

      /* instructions */
      '<div id="osm-instructions">',
      '  <div class="osm-instr-line"><span>↑↓</span> Use arrow keys to highlight a boot device</div>',
      '  <div class="osm-instr-line"><span>ENTER</span> = Boot Selected Device &nbsp;&nbsp; <span>ESC</span> = Return to BIOS Setup</div>',
      '</div>',

      /* body */
      '<div id="osm-body">',

      /* table */
      '  <div id="osm-table-header">',
      '    <div>ID</div>',
      '    <div>Boot Device</div>',
      '    <div>Type / Location</div>',
      '  </div>',
      '  <div id="osm-list" role="listbox">',
      rowsHTML,
      '  </div>',

      /* info panels */
      '  <div id="osm-panels">',
      '    <div class="osm-panel">',
      '      <div class="osm-panel-title">Legend</div>',
      '      <div class="osm-panel-row"><span>IDE</span><span class="pv">Integrated Drive Electronics</span></div>',
      '      <div class="osm-panel-row"><span>SATA</span><span class="pv">Serial ATA Device</span></div>',
      '      <div class="osm-panel-row"><span>USB</span><span class="pv">Universal Serial Bus</span></div>',
      '      <div class="osm-panel-row"><span>PXE</span><span class="pv">Preboot Execution Env.</span></div>',
      '    </div>',
      '    <div class="osm-panel">',
      '      <div class="osm-panel-title">Status</div>',
      '      <div class="osm-panel-row"><span>System Time</span><span class="pv" id="osm-clock">' + time + '</span></div>',
      '      <div class="osm-panel-row"><span>System Date</span><span class="pv">' + date + '</span></div>',
      '      <div class="osm-panel-row"><span>CPU Temp</span><span class="pv">38°C / 100°F</span></div>',
      '      <div class="osm-panel-row"><span>Boot Mode</span><span class="pv">Legacy BIOS</span></div>',
      '    </div>',
      '  </div>',

      '</div>', /* /osm-body */

      /* footer */
      '<div id="osm-footer">',
      '  <span><span class="osm-key">↑↓</span> Move</span>',
      '  <span><span class="osm-key">ENTER</span> Boot</span>',
      '  <span><span class="osm-key">ESC</span> Cancel</span>',
      '  <span><span class="osm-key">Click</span> Select &amp; Boot</span>',
      '</div>',

      /* boot confirmation overlay */
      '<div id="osm-confirm">',
      '  <div class="osm-confirm-box">',
      '    <div class="osm-confirm-title" id="osm-confirm-title">Booting...</div>',
      '    <div class="osm-confirm-sub"  id="osm-confirm-sub">Loading boot device...</div>',
      '    <div class="osm-confirm-bar"><div class="osm-confirm-fill" id="osm-confirm-fill"></div></div>',
      '    <div class="osm-confirm-pct" id="osm-confirm-pct">0%</div>',
      '  </div>',
      '</div>',

      /* coming soon popup */
      '<div id="osm-soon-popup">',
      '  <div class="osm-soon-box">',
      '    <div class="osm-soon-icon">🪟</div>',
      '    <div class="osm-soon-title">Microsoft Windows 3.1</div>',
      '    <div class="osm-soon-sub">This operating system is not yet available.<br>Windows 3.1 support is coming soon.</div>',
      '    <button class="osm-soon-btn" id="osm-soon-close">[ OK — Return to Menu ]</button>',
      '  </div>',
      '</div>',

    ].join('\n');
  }

  /* ══════════════════════════════════════════════════
     SHOW / HIGHLIGHT
  ══════════════════════════════════════════════════ */
  function showOSMenu() {
    // Kill all BIOS phases
    document.querySelectorAll('.phase').forEach(function(p) {
      p.style.cssText = 'display:none!important;';
      p.classList.remove('active');
    });
    // Also kill handoff
    var h = document.getElementById('phase-handoff');
    if (h) h.style.cssText = 'display:none!important;';

    buildMenu();

    var phase = document.getElementById('phase-osmenu');
    phase.style.display = 'flex';

    menuActive = true;
    highlightRow(selectedIdx);
    startClock();
    attachEvents();
    if (SFX) SFX.navBeep && SFX.navBeep('select');
  }

  function highlightRow(idx) {
    document.querySelectorAll('.osm-row').forEach(function(row) {
      row.classList.remove('selected');
    });
    var rows = document.querySelectorAll('.osm-row');
    if (rows[idx]) rows[idx].classList.add('selected');
  }

  /* ── live clock ───────────────────────────────────── */
  var clockTimer = null;
  function startClock() {
    clockTimer = setInterval(function() {
      var el = document.getElementById('osm-clock');
      if (el) el.textContent = new Date().toLocaleTimeString('en-US', {hour12:false});
    }, 1000);
  }

  /* ══════════════════════════════════════════════════
     EVENTS
  ══════════════════════════════════════════════════ */
  function attachEvents() {
    /* keyboard */
    document.addEventListener('keydown', handleKey);

    /* mouse — row hover highlight */
    document.querySelectorAll('.osm-row').forEach(function(row) {
      row.addEventListener('mouseenter', function() {
        if (!menuActive || confirming) return;
        var idx = parseInt(row.dataset.idx, 10);
        selectedIdx = idx;
        highlightRow(idx);
        if (SFX) SFX.navBeep && SFX.navBeep('move');
      });
      row.addEventListener('click', function() {
        if (!menuActive || confirming) return;
        var idx = parseInt(row.dataset.idx, 10);
        selectedIdx = idx;
        highlightRow(idx);
        bootSelected();
      });
    });

    /* coming soon close button */
    document.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'osm-soon-close') {
        closeSoonPopup();
      }
    });
  }

  function handleKey(e) {
    if (!menuActive) return;

    /* close coming soon popup */
    var soonPopup = document.getElementById('osm-soon-popup');
    if (soonPopup && soonPopup.style.display !== 'none') {
      if (e.key === 'Escape' || e.key === 'Enter') { closeSoonPopup(); e.preventDefault(); }
      return;
    }

    if (confirming) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % OS_LIST.length;
      highlightRow(selectedIdx);
      if (SFX) SFX.navBeep && SFX.navBeep('move');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + OS_LIST.length) % OS_LIST.length;
      highlightRow(selectedIdx);
      if (SFX) SFX.navBeep && SFX.navBeep('move');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      bootSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      /* ESC — go back (just flash the screen, no real back for now) */
      flashScreen();
    } else if (e.key >= '1' && e.key <= '9') {
      /* number shortcut */
      var n = parseInt(e.key, 10) - 1;
      if (n < OS_LIST.length) {
        selectedIdx = n;
        highlightRow(n);
        if (SFX) SFX.navBeep && SFX.navBeep('move');
        setTimeout(bootSelected, 180);
      }
    }
  }

  /* ── flash the whole menu (ESC feedback) ─────────── */
  function flashScreen() {
    var phase = document.getElementById('phase-osmenu');
    if (!phase) return;
    phase.style.filter = 'brightness(1.4)';
    setTimeout(function() { phase.style.filter = ''; }, 80);
    if (SFX) SFX.navBeep && SFX.navBeep('back');
  }

  /* ── coming soon popup ────────────────────────────── */
  function showSoonPopup() {
    var p = document.getElementById('osm-soon-popup');
    if (p) p.style.display = 'flex';
    if (SFX) SFX.navBeep && SFX.navBeep('back');
  }
  function closeSoonPopup() {
    var p = document.getElementById('osm-soon-popup');
    if (p) p.style.display = 'none';
    if (SFX) SFX.navBeep && SFX.navBeep('back');
  }

  /* ══════════════════════════════════════════════════
     BOOT SELECTED OS
  ══════════════════════════════════════════════════ */
  function bootSelected() {
    var os = OS_LIST[selectedIdx];
    if (!os) return;

    if (os.comingSoon || !os.available) {
      showSoonPopup();
      return;
    }

    confirming = true;
    if (SFX) SFX.navBeep && SFX.navBeep('select');
    showBootConfirm(os);
  }

  async function showBootConfirm(os) {
    var confirmDiv = document.getElementById('osm-confirm');
    var titleEl    = document.getElementById('osm-confirm-title');
    var subEl      = document.getElementById('osm-confirm-sub');
    var fillEl     = document.getElementById('osm-confirm-fill');
    var pctEl      = document.getElementById('osm-confirm-pct');

    if (!confirmDiv) return;

    titleEl.textContent = 'Booting ' + os.label + '...';
    subEl.textContent   = 'Reading boot sector from ' + os.type + '...';
    fillEl.style.width  = '0%';
    pctEl.textContent   = '0%';
    confirmDiv.style.display = 'flex';

    /* animate progress 0 → 100 over ~1.8s */
    var steps = 60;
    var stepMs = 1800 / steps;
    for (var i = 0; i <= steps; i++) {
      var pct = Math.round((i / steps) * 100);
      fillEl.style.width = pct + '%';
      pctEl.textContent  = pct + '%';

      /* update sub label at certain points */
      if (pct === 20) subEl.textContent = 'Loading boot record...';
      if (pct === 45) subEl.textContent = 'Initializing ' + os.label + '...';
      if (pct === 75) subEl.textContent = 'Transferring control to OS...';
      if (pct === 95) subEl.textContent = 'Starting ' + os.label + '...';

      if (SFX && i % 12 === 0) SFX.hdSeek && SFX.hdSeek();
      await delay(stepMs);
    }

    await delay(200);

    /* stop clock, stop key listening */
    if (clockTimer) clearInterval(clockTimer);
    document.removeEventListener('keydown', handleKey);
    menuActive = false;

    /* Hide the menu phase */
    var phase = document.getElementById('phase-osmenu');
    if (phase) phase.style.display = 'none';

    /* Fire the OS selection event */
    window.dispatchEvent(new CustomEvent('os:selected', {
      detail: { id: os.id, os: os },
      bubbles: true,
    }));
  }

})();
 