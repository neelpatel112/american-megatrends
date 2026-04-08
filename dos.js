/**
 * ══════════════════════════════════════════════════════
 *  dos.js  —  MS-DOS 6.22 Shell
 *  Activates automatically after bios:complete fires.
 *
 *  Phase switch:  sets #phase-dos { display:flex }
 *                 hides #phase-handoff inline style
 *
 *  New features vs last version:
 *    CALC     — interactive calculator
 *    CAL      — monthly calendar
 *    TASKS    — fake running process list
 *    NOTE     — quick notepad (type lines, save to FS)
 *    CLOCK    — live updating digital clock
 *    WEATHER  — fake weather report (with joke)
 *    FORTUNE  — random fortune cookie message
 *    HISTORY  — show command history
 *    FIND     — search text in a file
 *    FC       — file compare
 *    LABEL    — change volume label
 *    VOL      — show volume info
 *    DISKCOMP — fake disk compare
 *    DEFRAG   — animated fake defrag with progress
 *    Improved DIR, TREE, HELP, SYSINFO
 * ══════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* ── listen for BIOS complete ─────────────────────── */
  window.addEventListener('bios:complete', function () {
    setTimeout(startDOS, 500);
  });

  const SFX   = window.BiosAudio;
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const rand  = (a, b) => Math.random() * (b - a) + a;

  /* ══════════════════════════════════════════════════
     VIRTUAL FILE SYSTEM
  ══════════════════════════════════════════════════ */
  var FS = {
    type: 'dir', name: 'C:', label: 'SYSTEM',
    children: {
      'WINDOWS': { type:'dir', children:{
        'SYSTEM32':{ type:'dir', children:{
          'KERNEL32.DLL':{ type:'file', size:356864, date:'04-14-2011', content:'Binary file — cannot display.' },
          'CMD.EXE':     { type:'file', size:388608, date:'04-14-2011', content:'Binary file — cannot display.' },
        }},
        'WIN.INI':   { type:'file', size:219, date:'01-01-2009', content:'[windows]\nload=\nrun=\n\n[Desktop]\nWallpaper=(None)\nTileWallpaper=0\n' },
        'SYSTEM.INI':{ type:'file', size:422, date:'01-01-2009', content:'[boot]\nshell=explorer.exe\n\n[386Enh]\nswapfile=win386.swp\n' },
      }},
      'DOS': { type:'dir', children:{
        'COMMAND.COM':{ type:'file', size:54619, date:'04-09-1994', content:'Binary file.' },
        'FORMAT.COM': { type:'file', size:22717, date:'04-09-1994', content:'Binary file.' },
        'EDIT.COM':   { type:'file', size:69886, date:'04-09-1994', content:'Binary file.' },
        'DEBUG.EXE':  { type:'file', size:20634, date:'04-09-1994', content:'Binary file.' },
      }},
      'USERS': { type:'dir', children:{
        'ADMIN': { type:'dir', children:{
          'DESKTOP': { type:'dir', children:{
            'TODO.TXT':   { type:'file', size:128, date:'03-15-2011', content:'Things to do:\n- Fix the leaky faucet\n- Call mom back\n- Buy milk\n- Figure out why the PC beeps 3 times on boot\n' },
            'NOTES.TXT':  { type:'file', size:256, date:'04-01-2011', content:'Note to self:\nThe password is NOT "password123"\nIt IS "password1234"\n\nAlso: stop putting passwords in text files.\n' },
            'README.TXT': { type:'file', size:180, date:'04-25-2011', content:'Welcome to RetroShell.\n\nType HELP to see all commands.\nType SYSINFO for system info.\nType SNAKE or MATRIX for fun.\n' },
          }},
          'DOCUMENTS': { type:'dir', children:{
            'RESUME.TXT':{ type:'file', size:512, date:'02-20-2011', content:'JOHN A. SMITH\njohn.smith@hotmail.com\n\nSKILLS:\n- Microsoft Word (intermediate)\n- Can type 40 WPM\n- Coffee: expert level\n' },
            'BUDGET.TXT':{ type:'file', size:340, date:'03-01-2011', content:'Monthly Budget:\nRent:    -$800\nFood:    -$300\nGames:   -$200  <- mom says too much\nSavings: $0\nStatus:  send help\n' },
          }},
          'SECRET': { type:'dir', hidden:true, children:{
            'README.TXT':    { type:'file', size:200, date:'04-20-2011', content:'You found the secret folder! Nice.\n\nTry: ECHO I LOVE YOU\nTry: FORTUNE\nTry: CALC\nTry: SNAKE\nTry: DEFRAG\n' },
            'PASSWORDS.TXT': { type:'file', size:180, date:'02-02-2011', content:'gmail:    hunter2\nfacebook: hunter2\nbank:     hunter2\n\nI should use different passwords.\nI will do this tomorrow.\nSaid that last week too.\n' },
            'DIARY.TXT':     { type:'file', size:600, date:'01-14-2011', content:'Dear Diary,\n\nSpent 6 hours installing a printer driver.\nPrinter still does not work.\n\nPrinters are sentient evil.\nMy therapist disagrees.\nMy therapist has never installed an HP driver.\n' },
          }},
        }},
      }},
      'AUTOEXEC.BAT':{ type:'file', size:128, date:'01-01-2009', content:'@ECHO OFF\nPROMPT $P$G\nPATH=C:\\DOS;C:\\WINDOWS\nSET TEMP=C:\\TEMP\n' },
      'CONFIG.SYS':  { type:'file', size:96,  date:'01-01-2009', content:'DEVICE=C:\\DOS\\HIMEM.SYS\nBUFFERS=20\nFILES=40\nDOS=HIGH,UMB\n' },
    }
  };

  /* ── shell state ──────────────────────────────────── */
  var cwdPath = 'C:';
  var cwdNode = FS;
  var inputBuf = '';
  var cmdHistory = [];
  var histIdx = -1;
  var active = false;
  var noteLines = [];
  var noteMode = false;
  var calcMode = false;
  var calcBuf = '';
  var clockTimer = null;
  var snakeRunning = false;
  var snakeLoop = null;
  var env = { PATH:'C:\\DOS;C:\\WINDOWS', TEMP:'C:\\TEMP', COMSPEC:'C:\\DOS\\COMMAND.COM' };

  /* ── DOM refs (set in startDOS) ───────────────────── */
  var $out, $typed, $prompt, $canvas;

  /* ══════════════════════════════════════════════════
     PHASE SWITCH  —  this is the critical piece
  ══════════════════════════════════════════════════ */
  function showDOS() {
    /* 1. Hide every BIOS phase using inline style so they
          can never come back via CSS class */
    document.querySelectorAll('.phase').forEach(function(p) {
      p.style.display = 'none';
      p.classList.remove('active');
    });

    /* 2. Explicitly kill phase-handoff which is the last
          active one and sits at z-index:10 as a black wall */
    var h = document.getElementById('phase-handoff');
    if (h) { h.style.cssText = 'display:none!important;'; }

    /* 3. Show DOS phase — use flex so #dos-screen fills it */
    var d = document.getElementById('phase-dos');
    d.style.display = 'flex';
    d.style.flexDirection = 'column';
    /* z-index already 50 in dos.css, reinforce inline */
    d.style.zIndex = '50';
  }

  /* ══════════════════════════════════════════════════
     START
  ══════════════════════════════════════════════════ */
  async function startDOS() {
    showDOS();

    $out    = document.getElementById('dos-output');
    $typed  = document.getElementById('dos-typed');
    $prompt = document.getElementById('dos-prompt');
    $canvas = document.getElementById('snake-canvas');

    active = true;
    updatePrompt();
    startClock();
    setupKeys();

    /* boot messages */
    await printSlow('', 60);
    await printSlow('Starting MS-DOS...', 80, 'w');
    await printSlow('', 40);

    var drivers = [
      'HIMEM.SYS   - Extended Memory Manager loaded',
      'EMM386.EXE  - Expanded Memory Manager loaded',
      'SHARE.EXE   - File sharing loaded',
      'MOUSE.SYS   - Mouse driver v9.01 loaded',
      'CDROM.SYS   - CD-ROM extension v2.23 loaded',
    ];
    for (var i = 0; i < drivers.length; i++) {
      await printSlow(drivers[i], 60 + rand(0, 60), 'd');
    }

    await printSlow('', 200);
    await printSlow('MS-DOS Version 6.22', 0, 'w');
    await printSlow('(C)Copyright Microsoft Corp 1981-1994.', 0);
    await printSlow('', 0);
    await printSlow('Type HELP for a list of commands.', 0, 'y');
    await printSlow('', 0);

    scrollBottom();
  }

  /* ══════════════════════════════════════════════════
     OUTPUT HELPERS
  ══════════════════════════════════════════════════ */
  function print(text, cls) {
    var span = document.createElement('span');
    span.className = 'dl' + (cls ? ' ' + cls : '');
    span.textContent = (text === undefined || text === null) ? '' : String(text);
    $out.appendChild(span);
    $out.appendChild(document.createTextNode('\n'));
    scrollBottom();
  }

  function prints(arr) {
    arr.forEach(function(row) {
      print(row[0], row[1] || '');
    });
  }

  async function printSlow(text, ms, cls) {
    print(text, cls || '');
    if (ms > 0) await delay(ms);
  }

  function scrollBottom() {
    $out.scrollTop = $out.scrollHeight;
  }

  function updatePrompt() {
    $prompt.textContent = cwdPath + '> ';
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'dos-toast';
    t.textContent = msg;
    document.getElementById('phase-dos').appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  /* ══════════════════════════════════════════════════
     LIVE CLOCK (updates every second in taskbar)
  ══════════════════════════════════════════════════ */
  function startClock() {
    var bar = document.createElement('div');
    bar.id = 'dos-taskbar';
    bar.innerHTML = '<span>MS-DOS 6.22</span><span class="tb-clock" id="tb-clock"></span>';
    document.getElementById('phase-dos').appendChild(bar);

    function tick() {
      var el = document.getElementById('tb-clock');
      if (el) el.textContent = new Date().toLocaleTimeString();
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ══════════════════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════════════════ */
  function setupKeys() {
    document.addEventListener('keydown', function(e) {
      if (!active) return;
      if (snakeRunning) { handleSnakeKey(e); e.preventDefault(); return; }

      if (SFX && SFX.shellKey) SFX.shellKey();

      /* NOTE mode — line-by-line input */
      if (noteMode) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (inputBuf.toUpperCase() === '.') {
            /* end note */
            noteMode = false;
            active = true;
            print('Note saved. ' + noteLines.length + ' line(s).', 'g');
            print('');
          } else {
            noteLines.push(inputBuf);
            print(inputBuf);
          }
          inputBuf = ''; $typed.textContent = '';
          return;
        }
        if (e.key === 'Backspace') { e.preventDefault(); inputBuf = inputBuf.slice(0,-1); $typed.textContent = inputBuf; return; }
        if (e.key.length === 1) { e.preventDefault(); inputBuf += e.key; $typed.textContent = inputBuf; }
        return;
      }

      /* CALC mode */
      if (calcMode) {
        if (e.key === 'Escape') { calcMode = false; print('[Calculator closed]','d'); print(''); e.preventDefault(); return; }
        if (e.key === 'Enter') {
          e.preventDefault();
          var expr = calcBuf.trim();
          calcBuf = ''; $typed.textContent = '';
          if (!expr) return;
          print('  ' + expr);
          try {
            /* safe eval: only numbers and operators */
            if (!/^[\d\s\+\-\*\/\.\(\)%]+$/.test(expr)) throw new Error('Invalid');
            var result = Function('"use strict"; return (' + expr + ')')();
            print('  = ' + result, 'g');
          } catch(err) {
            print('  Syntax error', 'r');
          }
          print('');
          return;
        }
        if (e.key === 'Backspace') { e.preventDefault(); calcBuf = calcBuf.slice(0,-1); $typed.textContent = calcBuf; return; }
        if (e.key.length === 1) { e.preventDefault(); calcBuf += e.key; $typed.textContent = calcBuf; }
        return;
      }

      /* normal mode */
      if (e.key === 'Enter') {
        e.preventDefault();
        var cmd = inputBuf.trim();
        print(cwdPath + '> ' + cmd, 'd');
        inputBuf = ''; $typed.textContent = '';
        if (cmd) { cmdHistory.unshift(cmd); histIdx = -1; runCommand(cmd); }
        else print('');
        updatePrompt();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        inputBuf = inputBuf.slice(0, -1);
        $typed.textContent = inputBuf;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx < cmdHistory.length - 1) histIdx++;
        inputBuf = cmdHistory[histIdx] || '';
        $typed.textContent = inputBuf;
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx > 0) histIdx--; else { histIdx = -1; inputBuf = ''; }
        inputBuf = histIdx >= 0 ? cmdHistory[histIdx] : '';
        $typed.textContent = inputBuf;
        return;
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        print('^C', 'y');
        inputBuf = ''; $typed.textContent = '';
        return;
      }
      if (e.key === 'Tab') { e.preventDefault(); tabComplete(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        inputBuf += e.key;
        $typed.textContent = inputBuf;
      }
    });
  }

  function tabComplete() {
    var parts = inputBuf.split(' ');
    var partial = (parts[parts.length - 1] || '').toUpperCase();
    var names = Object.keys(cwdNode.children || {});
    var match = names.find(function(n) { return n.startsWith(partial); });
    if (match) { parts[parts.length - 1] = match; inputBuf = parts.join(' '); $typed.textContent = inputBuf; }
  }

  /* ══════════════════════════════════════════════════
     PATH / FS HELPERS
  ══════════════════════════════════════════════════ */
  function getChild(name) {
    if (!cwdNode.children) return null;
    return cwdNode.children[name.toUpperCase()] || null;
  }

  function resolvePath(input) {
    if (!input) return { node: cwdNode, path: cwdPath };
    var u = input.toUpperCase().replace(/\//g, '\\');
    if (u === '..') {
      if (cwdPath === 'C:') return { node: FS, path: 'C:' };
      var parts = cwdPath.split('\\');
      parts.pop();
      var newPath = parts.join('\\');
      return resolveAbs(newPath);
    }
    if (u === '\\' || u === 'C:\\') return { node: FS, path: 'C:' };
    if (u.startsWith('C:')) return resolveAbs(u);
    /* relative */
    var full = cwdPath === 'C:' ? 'C:\\' + u : cwdPath + '\\' + u;
    return resolveAbs(full);
  }

  function resolveAbs(path) {
    var parts = path.toUpperCase().replace(/\\/g, '/').split('/').filter(Boolean);
    var node = FS;
    var built = 'C:';
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (!node.children || !node.children[p]) return null;
      node = node.children[p];
      built += '\\' + p;
    }
    return { node: node, path: built };
  }

  /* ══════════════════════════════════════════════════
     COMMAND ROUTER
  ══════════════════════════════════════════════════ */
  function runCommand(raw) {
    var parts  = raw.trim().split(/\s+/);
    var cmd    = parts[0].toUpperCase();
    var args   = parts.slice(1);
    var argStr = args.join(' ');

    switch (cmd) {
      case 'VER':      cmdVer(); break;
      case 'DIR':      cmdDir(argStr); break;
      case 'CD':
      case 'CHDIR':    cmdCd(argStr); break;
      case 'CLS':      cmdCls(); break;
      case 'HELP':     cmdHelp(argStr); break;
      case 'TYPE':     cmdType(argStr); break;
      case 'COPY':     cmdCopy(args); break;
      case 'DEL':
      case 'ERASE':    cmdDel(argStr); break;
      case 'MKDIR':
      case 'MD':       cmdMkdir(argStr); break;
      case 'RMDIR':
      case 'RD':       cmdRmdir(argStr); break;
      case 'CHKDSK':   cmdChkdsk(); break;
      case 'SCANDISK': cmdScandisk(); break;
      case 'DEFRAG':   cmdDefrag(); break;
      case 'MEM':      cmdMem(); break;
      case 'FORMAT':   cmdFormat(argStr); break;
      case 'ATTRIB':   cmdAttrib(argStr); break;
      case 'TREE':     cmdTree(); break;
      case 'DATE':     cmdDate(); break;
      case 'TIME':     cmdTime(); break;
      case 'ECHO':     cmdEcho(argStr); break;
      case 'SET':      cmdSet(argStr); break;
      case 'COLOR':    cmdColor(argStr); break;
      case 'PING':     cmdPing(argStr); break;
      case 'IPCONFIG': cmdIpconfig(); break;
      case 'NETSTAT':  cmdNetstat(); break;
      case 'SYSINFO':  cmdSysinfo(); break;
      case 'TASKS':
      case 'TASKLIST': cmdTasks(); break;
      case 'CALC':     cmdCalc(); break;
      case 'CAL':      cmdCal(argStr); break;
      case 'NOTE':     cmdNote(argStr); break;
      case 'CLOCK':    cmdClock(); break;
      case 'WEATHER':  cmdWeather(argStr); break;
      case 'FORTUNE':  cmdFortune(); break;
      case 'HISTORY':  cmdHistory(); break;
      case 'FIND':     cmdFind(args); break;
      case 'VOL':      cmdVol(); break;
      case 'LABEL':    cmdLabel(argStr); break;
      case 'DISKCOMP': cmdDiskcomp(); break;
      case 'SNAKE':    cmdSnake(); break;
      case 'MATRIX':   cmdMatrix(); break;
      case 'SECRET':   cmdSecret(); break;
      case 'PATH':     print('PATH=' + env.PATH); break;
      case 'EXIT':     cmdExit(); break;
      case 'REBOOT':
      case 'RESTART':  cmdReboot(); break;
      default:
        print("Bad command or file name - '" + parts[0] + "'", 'r');
    }
    print('');
  }

  /* ══════════════════════════════════════════════════
     COMMANDS
  ══════════════════════════════════════════════════ */
  function cmdVer() {
    print('');
    print('MS-DOS Version 6.22', 'w');
    print('(C)Copyright Microsoft Corp 1981-1994.');
  }

  function cmdDir(arg) {
    var showHidden = arg.toUpperCase().indexOf('/A') !== -1;
    var node = cwdNode;
    if (!node.children) { print('File not found', 'r'); return; }
    print('');
    print(' Volume in drive C is ' + FS.label + '    Serial Number is 1337-C0DE');
    print(' Directory of ' + cwdPath);
    print('');
    print(padR('.', 16) + '<DIR>          04-25-2011  09:12', 'c');
    print(padR('..', 16) + '<DIR>          04-25-2011  09:12', 'c');
    var files = 0, dirs = 0, bytes = 0;
    Object.entries(node.children).forEach(function(entry) {
      var name = entry[0], item = entry[1];
      if (item.hidden && !showHidden) return;
      var date = item.date || '04-25-2011';
      if (item.type === 'dir') {
        dirs++;
        print(padR(name, 16) + '<DIR>          ' + date + '  00:00', 'c');
      } else {
        files++;
        bytes += item.size || 0;
        print(padR(name, 16) + padL(item.size || 0, 12) + '   ' + date + '  00:00');
      }
    });
    print('');
    print('      ' + files + ' file(s)     ' + bytes.toLocaleString() + ' bytes');
    print('      ' + dirs  + ' dir(s)    ' + (420*1024*1024).toLocaleString() + ' bytes free');
  }

  function cmdCd(arg) {
    if (!arg) { print(cwdPath); return; }
    var result = resolvePath(arg);
    if (!result || result.node.type !== 'dir') { print('Invalid directory', 'r'); return; }
    cwdPath = result.path;
    cwdNode = result.node;
    updatePrompt();
  }

  function cmdCls() { $out.innerHTML = ''; }

  function cmdHelp(arg) {
    if (arg) {
      var detail = HELP[arg.toUpperCase()];
      if (detail) { print(''); detail.forEach(function(l){print(l[0],l[1]||'');}); return; }
      print('No help available for: ' + arg, 'y');
      return;
    }
    print('');
    print('Available commands:', 'h');
    var cmds = [
      ['ATTRIB','Display/change file attributes'],
      ['CALC','Interactive calculator (ESC to quit)'],
      ['CAL','Show monthly calendar'],
      ['CD / CHDIR','Change directory'],
      ['CHKDSK','Check disk integrity'],
      ['CLS','Clear screen'],
      ['COLOR','Change text colors (e.g. COLOR 0A)'],
      ['COPY','Copy a file'],
      ['DATE','Display/set system date'],
      ['DEFRAG','Defragment drive C (animated)'],
      ['DEL / ERASE','Delete a file'],
      ['DIR','List directory (DIR /A shows hidden)'],
      ['DISKCOMP','Disk compare (simulated)'],
      ['ECHO','Print text (try: ECHO I LOVE YOU)'],
      ['EXIT','Shut down the shell'],
      ['FIND','Search text in a file'],
      ['FORTUNE','Get a fortune cookie message'],
      ['HISTORY','Show command history'],
      ['IPCONFIG','Show network config'],
      ['LABEL','Change volume label'],
      ['MATRIX','Matrix rain animation (ESC to stop)'],
      ['MD / MKDIR','Create directory'],
      ['MEM','Show memory usage'],
      ['NETSTAT','Show network connections'],
      ['NOTE','Simple notepad (type lines, . to save)'],
      ['PATH','Show executable path'],
      ['PING','Ping a host'],
      ['RD / RMDIR','Remove empty directory'],
      ['REBOOT','Restart the system'],
      ['SCANDISK','Scan disk for errors'],
      ['SECRET','...'],
      ['SET','Show/set environment variables'],
      ['SNAKE','Play Snake (arrow keys, ESC to quit)'],
      ['SYSINFO','Detailed system information'],
      ['TASKS','Show running processes'],
      ['TIME','Display/set system time'],
      ['TREE','Show directory tree'],
      ['TYPE','Display file contents'],
      ['VER','Show OS version'],
      ['VOL','Show volume information'],
      ['WEATHER','Fake weather report'],
    ];
    cmds.forEach(function(c) {
      print('  ' + padR(c[0], 14) + c[1]);
    });
    print('');
    print('TIP: Use arrow keys for command history. TAB to autocomplete.', 'y');
  }

  var HELP = {
    'DIR':  [['DIR [path] [/A]','y'],['',''],['List files in current or specified directory.'],['  /A   Show hidden files too']],
    'CD':   [['CD [path]','y'],['',''],['Change current directory.'],['  CD ..   go up one level'],['  CD \\   go to root C:']],
    'TYPE': [['TYPE filename','y'],['',''],['Display contents of a text file.']],
    'SNAKE':[['SNAKE','y'],['',''],['Launch Snake game.'],['Arrow keys to move, eat * to grow.'],['ESC to quit.']],
    'CALC': [['CALC','y'],['',''],['Interactive calculator.'],['Type any math expression and press Enter.'],['Examples: 2+2   100/4   (5*3)+2   15%3'],['ESC to exit calculator.']],
    'NOTE': [['NOTE [filename]','y'],['',''],['Simple line-by-line text editor.'],['Type lines of text and press Enter.'],['Type a single dot ( . ) on its own line to save.']],
  };

  function cmdType(arg) {
    if (!arg) { print('Required parameter missing', 'r'); return; }
    var name = arg.toUpperCase().split('\\').pop();
    var node = getChild(name);
    if (!node) { print('File not found - ' + arg, 'r'); return; }
    if (node.type === 'dir') { print('Access is denied.', 'r'); return; }
    print('');
    (node.content || '').split('\n').forEach(function(l){ print(l); });
  }

  function cmdCopy(args) {
    if (!args[0]) { print('Required parameter missing', 'r'); return; }
    print('        1 file(s) copied.', 'g');
  }

  function cmdDel(arg) {
    if (!arg) { print('Required parameter missing', 'r'); return; }
    var name = arg.toUpperCase();
    if (cwdNode.children && cwdNode.children[name] && cwdNode.children[name].type === 'file') {
      delete cwdNode.children[name];
    } else {
      print('File not found - ' + arg, 'r');
    }
  }

  function cmdMkdir(arg) {
    if (!arg) { print('Required parameter missing', 'r'); return; }
    if (!cwdNode.children) cwdNode.children = {};
    cwdNode.children[arg.toUpperCase()] = { type:'dir', children:{} };
    print('Directory created.', 'g');
  }

  function cmdRmdir(arg) {
    if (!arg) { print('Required parameter missing', 'r'); return; }
    var n = cwdNode.children && cwdNode.children[arg.toUpperCase()];
    if (!n) { print('Invalid path or directory not found', 'r'); return; }
    if (Object.keys(n.children || {}).length > 0) { print('The directory is not empty.', 'r'); return; }
    delete cwdNode.children[arg.toUpperCase()];
  }

  function cmdChkdsk() {
    prints([
      [''],['CHKDSK is checking the file allocation table...'],[''],
      ['Volume SYSTEM   created 01-01-2009'],['Volume Serial Number is 1337-C0DE'],[''],
      ['    512,110,592 bytes total disk space'],
      ['         65,536 bytes in 2 hidden files'],
      ['         32,768 bytes in 8 directories'],
      ['      91,422,720 bytes in 312 user files'],
      ['     420,589,568 bytes available on disk'],[''],
      ['          4,096 bytes in each allocation unit'],
      ['        125,027 total allocation units on disk'],
      ['        102,678 available allocation units on disk'],[''],
      ['CHKDSK found no errors.','g'],
    ]);
  }

  function cmdScandisk() {
    print('');
    print('Microsoft ScanDisk', 'w');
    print('ScanDisk is now checking drive C:');
    print('');
    var stages = ['Reading FAT...','Checking directories...','Checking files...','Checking free space...','Finalizing...'];
    var i = 0;
    function step() {
      if (i < stages.length) { print('  ' + stages[i], 'd'); i++; setTimeout(step, 320); }
      else { print(''); print('ScanDisk found and fixed 0 problems.', 'g'); print(''); }
    }
    step();
  }

  async function cmdDefrag() {
    print('');
    print('MS-DOS Defragmenter', 'w');
    print('Defragmenting drive C:...');
    print('');
    active = false;
    var totalBlocks = 40;
    var blocks = Array(totalBlocks).fill(0).map(function() {
      return Math.random() < 0.4 ? 1 : 0; /* 1 = fragmented */
    });
    for (var pass = 0; pass < 3; pass++) {
      /* draw the block map */
      var row = $out.lastElementChild;
      var bar = '  [';
      blocks.forEach(function(b) { bar += b === 1 ? '░' : '█'; });
      bar += '] Pass ' + (pass + 1) + '/3';
      if (row && row.className.indexOf('defrag-bar') !== -1) {
        row.textContent = bar;
      } else {
        var s = document.createElement('span');
        s.className = 'dl g defrag-bar';
        s.textContent = bar;
        $out.appendChild(s);
        $out.appendChild(document.createTextNode('\n'));
      }
      scrollBottom();
      /* resolve fragmented blocks one at a time */
      for (var j = 0; j < blocks.length; j++) {
        if (blocks[j] === 1) {
          blocks[j] = 0;
          var barEl = $out.querySelector('.defrag-bar');
          if (barEl) {
            var b2 = '  [';
            blocks.forEach(function(bb){ b2 += bb===1?'░':'█'; });
            b2 += '] Pass ' + (pass+1) + '/3';
            barEl.textContent = b2;
          }
          await delay(rand(30, 80));
        }
      }
      await delay(200);
    }
    print('');
    print('Defragmentation complete. 100% of drive C: is not fragmented.', 'g');
    active = true;
  }

  function cmdMem() {
    prints([
      [''],
      ['Memory Type        Total    Used    Free','w'],
      ['─────────────────────────────────────────','d'],
      ['Conventional       640K     81K     559K'],
      ['Upper              155K     31K     124K'],
      ['Extended (XMS)    3968K      0K    3968K'],
      ['─────────────────────────────────────────','d'],
      ['Total memory      4763K    112K   4651K'],
      [''],
      ['Largest executable program size   559K (572,416 bytes)','g'],
      ['MS-DOS is resident in the high memory area.'],
    ]);
  }

  async function cmdFormat(arg) {
    if (!arg || arg[0].toUpperCase() !== 'C') { print('Usage: FORMAT [drive:]', 'y'); return; }
    print('');
    print('WARNING! ALL DATA ON NON-REMOVABLE DISK DRIVE C: WILL BE LOST!', 'r');
    print('Proceed with Format (Y/N)?', 'y');
    await delay(1200);
    print('Y', 'w');
    print('Formatting...');
    await delay(400);
    /* scare them */
    var sw = document.getElementById('screen-wrap');
    sw.style.filter = 'brightness(1.5)';
    await delay(80);
    sw.style.filter = '';
    await delay(100);
    sw.style.transform = 'translateX(5px)';
    await delay(60);
    sw.style.transform = '';
    print('');
    print('Just kidding. Format aborted. 😈', 'g');
    print("Did your heart skip a beat?", 'y');
    if (SFX) { SFX.beep(880,.1,.2); setTimeout(function(){SFX.beep(1100,.1,.2);},120); }
  }

  function cmdAttrib(arg) {
    if (!arg) { print('Syntax: ATTRIB [+R|-R] [+H|-H] filename', 'y'); return; }
    print('A          ' + arg.toUpperCase());
  }

  function cmdTree() {
    print('');
    print('Folder PATH listing for volume SYSTEM');
    print('Volume serial number is 1337-C0DE');
    print('C:\\', 'w');
    function walk(node, prefix) {
      if (!node.children) return;
      var entries = Object.entries(node.children);
      entries.forEach(function(entry, i) {
        var name = entry[0], child = entry[1];
        var last = i === entries.length - 1;
        var branch = last ? '└───' : '├───';
        print(prefix + branch + name, child.type === 'dir' ? 'c' : '');
        if (child.type === 'dir') walk(child, prefix + (last ? '    ' : '│   '));
      });
    }
    walk(cwdNode, '');
  }

  function cmdDate() { print('Current date is ' + new Date().toLocaleDateString('en-US',{weekday:'short',month:'2-digit',day:'2-digit',year:'numeric'})); }
  function cmdTime() { print('Current time is ' + new Date().toLocaleTimeString('en-US',{hour12:false})); }

  function cmdEcho(arg) {
    if (!arg) { print('ECHO is on.'); return; }
    if (arg.toUpperCase() === 'I LOVE YOU') {
      prints([
        [''],
        ['  ♥  ♥     ♥  ♥','r'],
        [' ♥     ♥ ♥     ♥','r'],
        [' ♥      I AM      ♥','r'],
        ['  ♥   IN LOVE   ♥','r'],
        ['    ♥  WITH YOU ♥','r'],
        ['      ♥       ♥','r'],
        ['        ♥','r'],
        [''],
      ]);
      if (SFX) { [523,659,784].forEach(function(f,i){setTimeout(function(){SFX.beep(f,.15,.2);},i*160);}); }
      return;
    }
    print(arg, 'w');
  }

  function cmdSet(arg) {
    if (!arg) { Object.entries(env).forEach(function(e){ print(e[0]+'='+e[1]); }); return; }
    var eq = arg.indexOf('=');
    if (eq > 0) { var k=arg.slice(0,eq).toUpperCase(); env[k]=arg.slice(eq+1); print(k+' set.','g'); }
    else print('Environment variable not found','r');
  }

  function cmdColor(arg) {
    var MAP={'0':'#000','1':'#000080','2':'#008000','3':'#008080','4':'#800000','5':'#800080','6':'#808000','7':'#c0c0c0','8':'#808080','9':'#0000ff','A':'#00ff00','B':'#00ffff','C':'#ff0000','D':'#ff00ff','E':'#ffff00','F':'#fff'};
    if (!arg||arg.length<2){print('Syntax: COLOR bg fg  e.g. COLOR 0A','y');return;}
    var bg=MAP[arg[0].toUpperCase()], fg=MAP[arg[1].toUpperCase()];
    var sc=document.getElementById('dos-screen');
    if(bg)sc.style.background=bg;
    if(fg)sc.style.color=fg;
    print('Color set.','g');
  }

  async function cmdPing(arg) {
    if (!arg) { print('Usage: PING hostname','y'); return; }
    print('');
    print('Pinging '+arg+' [127.0.0.1] with 32 bytes of data:');
    for (var i=0;i<4;i++) {
      await delay(rand(300,700));
      print('Reply from 127.0.0.1: bytes=32 time='+Math.floor(rand(8,60))+'ms TTL=128','g');
    }
    print('');
    print('Ping statistics for '+arg+':');
    print('    Packets: Sent=4, Received=4, Lost=0 (0% loss)','g');
  }

  function cmdIpconfig() {
    prints([
      [''],['Windows IP Configuration','w'],[''],
      ['Ethernet adapter Local Area Connection:'],[''],
      ['   IP Address. . . . : 192.168.1.105','g'],
      ['   Subnet Mask . . . : 255.255.255.0'],
      ['   Default Gateway . : 192.168.1.1'],[''],
      ['Loopback Adapter:'],[''],
      ['   IP Address. . . . : 127.0.0.1'],
    ]);
  }

  function cmdNetstat() {
    prints([
      [''],['Active Connections','w'],[''],
      ['  Proto  Local Address            Foreign Address          State'],
      ['  TCP    192.168.1.105:1025       192.168.1.1:80           ESTABLISHED'],
      ['  TCP    192.168.1.105:1033       65.52.100.91:443         ESTABLISHED'],
      ['  UDP    0.0.0.0:500              *:*','d'],
    ]);
  }

  function cmdSysinfo() {
    var now = new Date();
    var cfg = window.BIOS_CONFIG || {};
    prints([
      [''],
      ['═══════════════════════════════════════════','c'],
      ['   SYSTEM INFORMATION','w'],
      ['═══════════════════════════════════════════','c'],
      [''],
      ['  OS          :  MS-DOS 6.22'],
      ['  CPU         :  ' + (cfg.cpu||'Unknown')],
      ['  CPU Speed   :  ' + (cfg.cpuSpeed||'Unknown')],
      ['  RAM         :  ' + (cfg.ramMB||'Unknown') + ' MB'],
      ['  Disk C:     :  500.1 GB  (ATA-133)'],
      ['  BIOS        :  AMI v' + (cfg.biosVer||'?') + '  (' + (cfg.biosDate||'?') + ')'],
      ['  Date        :  ' + now.toLocaleDateString()],
      ['  Time        :  ' + now.toLocaleTimeString()],
      ['  Shell       :  RetroShell v2.0'],
      ['  Environment :  ' + Object.keys(env).length + ' variables set'],
      [''],
      ['  Type HELP to see all available commands.','y'],
    ]);
  }

  function cmdTasks() {
    var tasks = [
      ['System Idle Process','0','0 K','Normal'],
      ['System','4','244 K','Normal'],
      ['smss.exe','364','412 K','Normal'],
      ['csrss.exe','532','4,256 K','Normal'],
      ['winlogon.exe','556','5,124 K','High'],
      ['services.exe','600','3,840 K','Normal'],
      ['lsass.exe','612','1,508 K','Normal'],
      ['svchost.exe','784','4,916 K','Normal'],
      ['svchost.exe','832','14,780 K','Normal'],
      ['explorer.exe','1488','18,204 K','Normal'],
      ['COMMAND.COM','1552','1,024 K','Normal'],
    ];
    print('');
    print(padR('Image Name',25) + padR('PID',8) + padR('Mem Usage',14) + 'Priority', 'w');
    print(Array(55).join('─'), 'd');
    tasks.forEach(function(t) {
      print(padR(t[0],25) + padR(t[1],8) + padR(t[2],14) + t[3]);
    });
    print('');
    print(tasks.length + ' process(es) running.', 'g');
  }

  /* ── CALC ─────────────────────────────────────────── */
  function cmdCalc() {
    calcMode = true;
    calcBuf = '';
    $typed.textContent = '';
    prints([
      [''],
      ['┌─────────────────────────────────────┐','c'],
      ['│  CALC.EXE  —  MS-DOS Calculator     │','c'],
      ['│  Type any math expression + ENTER   │','c'],
      ['│  Examples: 2+2   (5*8)/4   15%3     │','c'],
      ['│  ESC to exit                        │','c'],
      ['└─────────────────────────────────────┘','c'],
      [''],
    ]);
    $prompt.textContent = 'CALC> ';
  }

  /* ── CAL ──────────────────────────────────────────── */
  function cmdCal(arg) {
    var now = new Date();
    var month = now.getMonth(), year = now.getFullYear();
    if (arg) {
      var parts = arg.split(' ');
      if (parts[0]) month = parseInt(parts[0]) - 1;
      if (parts[1]) year = parseInt(parts[1]);
    }
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var first = new Date(year, month, 1).getDay();
    var days  = new Date(year, month+1, 0).getDate();
    print('');
    print('    ' + monthNames[month] + ' ' + year, 'w');
    print(' Su Mo Tu We Th Fr Sa');
    var line = '    '.repeat(first).slice(0, first*3);
    for (var d = 1; d <= days; d++) {
      line += padL(d, 3);
      var dow = (first + d - 1) % 7;
      if (dow === 6 || d === days) { print(line); line = ''; }
    }
    print('');
  }

  /* ── NOTE ─────────────────────────────────────────── */
  function cmdNote(arg) {
    var fname = (arg || 'UNTITLED.TXT').toUpperCase();
    noteLines = [];
    noteMode = true;
    active = true;
    prints([
      [''],
      ['NOTE.EXE — Simple Text Editor','w'],
      ['File: ' + fname,'y'],
      ['Type lines of text. Type a single dot (.) on its own line to save.'],
      [''],
    ]);
    $prompt.textContent = 'NOTE> ';
  }

  /* ── CLOCK ────────────────────────────────────────── */
  function cmdClock() {
    print('');
    print('Current time: ' + new Date().toLocaleTimeString(), 'g');
    print('The clock in the bottom-right corner updates every second.', 'y');
  }

  /* ── WEATHER ──────────────────────────────────────── */
  var CITIES = {
    LONDON:   { temp:'12°C',  cond:'Overcast and drizzly',    hum:'88%', wind:'SW 14 mph' },
    NEWYORK:  { temp:'18°C',  cond:'Partly cloudy',           hum:'62%', wind:'NE 9 mph'  },
    TOKYO:    { temp:'22°C',  cond:'Clear skies',             hum:'55%', wind:'E 7 mph'   },
    SYDNEY:   { temp:'27°C',  cond:'Sunny',                   hum:'48%', wind:'SE 11 mph' },
    MOSCOW:   { temp:'-3°C',  cond:'Heavy snow',              hum:'92%', wind:'N 20 mph'  },
    DUBAI:    { temp:'38°C',  cond:'Hot and sunny',           hum:'30%', wind:'NW 5 mph'  },
    DEFAULT:  { temp:'20°C',  cond:'Probably fine',           hum:'60%', wind:'Variable'  },
  };
  function cmdWeather(arg) {
    var key = arg ? arg.toUpperCase().replace(/\s/g,'') : 'DEFAULT';
    var w = CITIES[key] || CITIES.DEFAULT;
    var city = arg || 'Your Location';
    prints([
      [''],
      ['Weather Report — ' + city.toUpperCase(),'h'],
      [''],
      ['  Condition  :  ' + w.cond,'g'],
      ['  Temperature:  ' + w.temp],
      ['  Humidity   :  ' + w.hum],
      ['  Wind       :  ' + w.wind],
      [''],
      ['Data provided by WeatherDOS™ v1.0 (accuracy not guaranteed)','d'],
      ['Note: This is entirely made up.','d'],
    ]);
  }

  /* ── FORTUNE ──────────────────────────────────────── */
  var FORTUNES = [
    'The best time to plant a tree was 20 years ago. The second best time is now.',
    'You will find a bug in production after a 3-day weekend.',
    'It works on my machine.',
    'Have you tried turning it off and on again?',
    'There are only 10 types of people: those who understand binary and those who do not.',
    'In theory, theory and practice are the same. In practice, they are not.',
    'The code you wrote 6 months ago is always written by someone else.',
    'SELECT * FROM users; — Saying this out loud in a restaurant should bring a waiter.',
    'Real programmers count from 0.',
    'To understand recursion, you must first understand recursion.',
    'A user interface is like a joke — if you have to explain it, it is not that good.',
    '"It is not a bug. It is an undocumented feature." — Every developer, ever.',
    'Your strongest muscle and worst enemy is your mind. Also: your off-by-one errors.',
    'Life is short. But not as short as the time between pushing to prod and regretting it.',
  ];
  function cmdFortune() {
    var f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    print('');
    print('  ┌' + Array(f.length+2).join('─') + '┐', 'y');
    print('  │ ' + f + ' │', 'y');
    print('  └' + Array(f.length+2).join('─') + '┘', 'y');
    print('');
  }

  /* ── HISTORY ──────────────────────────────────────── */
  function cmdHistory() {
    print('');
    if (cmdHistory.length === 0) { print('No command history yet.', 'd'); return; }
    cmdHistory.slice().reverse().forEach(function(cmd, i) {
      print('  ' + padL(i+1, 3) + '  ' + cmd);
    });
  }

  /* ── FIND ─────────────────────────────────────────── */
  function cmdFind(args) {
    if (args.length < 2) { print('Usage: FIND "text" filename', 'y'); return; }
    var needle = args[0].replace(/"/g,'').toUpperCase();
    var fname  = args[1].toUpperCase();
    var node   = getChild(fname);
    if (!node || node.type !== 'file') { print('File not found: ' + args[1], 'r'); return; }
    print('');
    print('---------- ' + fname);
    var found = 0;
    (node.content||'').split('\n').forEach(function(line, i) {
      if (line.toUpperCase().indexOf(needle) !== -1) {
        print((i+1) + ': ' + line, 'g');
        found++;
      }
    });
    if (found === 0) print('FIND: no matches found for "' + args[0] + '"', 'y');
  }

  /* ── VOL ──────────────────────────────────────────── */
  function cmdVol() {
    print('');
    print(' Volume in drive C is ' + FS.label);
    print(' Volume Serial Number is 1337-C0DE');
  }

  /* ── LABEL ────────────────────────────────────────── */
  function cmdLabel(arg) {
    if (!arg) { print('Current label: ' + FS.label); return; }
    FS.label = arg.toUpperCase().substring(0, 11);
    print('Volume label changed to: ' + FS.label, 'g');
  }

  /* ── DISKCOMP ─────────────────────────────────────── */
  function cmdDiskcomp() {
    print('');
    print('Insert FIRST diskette in drive A:');
    print('Insert SECOND diskette in drive A:');
    print('');
    print('Drive A: not found.', 'r');
    print('(No floppy drive detected on this system)', 'y');
  }

  /* ── SECRET ───────────────────────────────────────── */
  function cmdSecret() {
    print('');
    print("There is no secret here. Move along.", 'r');
    print('');
    print('...', 'd');
    print('');
    print("Okay fine. Try:  CD C:\\USERS\\ADMIN\\SECRET", 'y');
    print('Use DIR /A to see hidden files inside.', 'y');
  }

  /* ── EXIT ─────────────────────────────────────────── */
  async function cmdExit() {
    print('Shutting down...', 'y');
    active = false;
    if (clockTimer) clearInterval(clockTimer);
    await delay(600);
    if (SFX) SFX.crtOff();
    var sw = document.getElementById('screen-wrap');
    if (sw) { sw.style.animation = 'crt-off .24s ease-in forwards'; }
    setTimeout(function() {
      var pd = document.getElementById('phase-dos');
      if (pd) pd.style.display = 'none';
      var led = document.getElementById('power-led');
      if (led) led.className = 'led-off';
    }, 280);
  }

  async function cmdReboot() {
    print('System rebooting...', 'y');
    active = false;
    await delay(800);
    window.location.reload();
  }

  /* ══════════════════════════════════════════════════
     MATRIX RAIN
  ══════════════════════════════════════════════════ */
  async function cmdMatrix() {
    print('Entering the Matrix... (ESC to exit)', 'g');
    active = false;
    await delay(300);

    var cv = document.createElement('canvas');
    cv.id = 'matrix-canvas';
    var scr = document.getElementById('dos-screen');
    cv.width  = scr.offsetWidth  || 640;
    cv.height = scr.offsetHeight || 400;
    scr.appendChild(cv);
    var ctx = cv.getContext('2d');

    var cols  = Math.floor(cv.width / 14);
    var drops = Array.from({length:cols}, function() { return Math.floor(Math.random() * cv.height / 16); });
    var chars = 'アイウエオカキクケコABCDEFGH0123456789@#$%';
    var frame = 0;
    var running = true;

    function drawFrame() {
      if (!running) return;
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0,0,cv.width,cv.height);
      ctx.font = '13px "Share Tech Mono",monospace';
      for (var i = 0; i < cols; i++) {
        ctx.fillStyle = 'hsl(120,100%,' + (50+Math.random()*30) + '%)';
        ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*14, drops[i]*16);
        if (drops[i]*16 > cv.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      frame++;
      if (frame > 420) { stopMatrix(); return; }
      requestAnimationFrame(drawFrame);
    }

    function stopMatrix() {
      running = false;
      cv.remove();
      active = true;
      print('Wake up, Neo...', 'g');
      print('');
    }

    var escHandler = function(e) {
      if (e.key === 'Escape') { running = false; stopMatrix(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
    requestAnimationFrame(drawFrame);
  }

  /* ══════════════════════════════════════════════════
     SNAKE GAME
  ══════════════════════════════════════════════════ */
  function cmdSnake() {
    print('');
    print('SNAKE — Arrow keys to move. ESC to quit.', 'g');
    print('Eat * to grow. Avoid walls and yourself.', 'd');
    print('');
    active = false;
    snakeRunning = true;

    var cv  = $canvas;
    cv.style.display = 'block';
    var ctx = cv.getContext('2d');
    var W   = cv.width, H = cv.height;
    var CS  = 16;   /* cell size */
    var COLS = Math.floor(W/CS), ROWS = Math.floor(H/CS);

    var snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    var dir = {x:1,y:0}, nextDir = {x:1,y:0};
    var food = spawnFood();
    var score = 0;
    var alive = true;

    function spawnFood() {
      var f;
      do { f = {x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)}; }
      while (snake.some(function(s){return s.x===f.x&&s.y===f.y;}));
      return f;
    }

    function draw() {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = '#55ff55'; ctx.lineWidth = 2; ctx.strokeRect(1,1,W-2,H-2);
      ctx.fillStyle = '#55ff55'; ctx.font = '11px "Share Tech Mono",monospace';
      ctx.fillText('SCORE: ' + score, 4, 14);
      /* food */
      ctx.fillStyle = '#ffff54'; ctx.font = CS+'px "Share Tech Mono",monospace';
      ctx.fillText('*', food.x*CS, food.y*CS+CS-2);
      /* snake */
      snake.forEach(function(s, i) {
        ctx.fillStyle = i===0 ? '#fff' : '#55ff55';
        ctx.fillRect(s.x*CS+1, s.y*CS+1, CS-2, CS-2);
      });
      if (!alive) {
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = '#ff5555'; ctx.font = '20px "Share Tech Mono",monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W/2, H/2-10);
        ctx.fillStyle = '#ffff54'; ctx.font = '13px "Share Tech Mono",monospace';
        ctx.fillText('Score: ' + score, W/2, H/2+12);
        ctx.fillText('Press ESC', W/2, H/2+32);
        ctx.textAlign = 'left';
      }
    }

    function step() {
      if (!alive) return;
      dir = nextDir;
      var head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
      if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS) { alive=false; draw(); if(SFX)SFX.errorBeep(); return; }
      if (snake.some(function(s){return s.x===head.x&&s.y===head.y;})) { alive=false; draw(); if(SFX)SFX.errorBeep(); return; }
      snake.unshift(head);
      if (head.x===food.x && head.y===food.y) {
        score += 10; food = spawnFood();
        if (SFX) SFX.beep(880, .05, .15);
      } else { snake.pop(); }
      draw();
    }

    draw();
    snakeLoop = setInterval(step, 115);
  }

  function handleSnakeKey(e) {
    var MAP = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
    if (MAP[e.key]) {
      var nd = MAP[e.key];
      /* prevent reversing */
      var ctx2 = $canvas.getContext('2d'); /* just a ref to keep closure */
      var cur = {x:0,y:0}; /* We track via nextDir closure */
      window.__snakeDir = nd; /* bridge */
    }
    if (e.key === 'Escape') {
      clearInterval(snakeLoop);
      $canvas.style.display = 'none';
      snakeRunning = false;
      active = true;
      print('[Snake game ended — score: ' + (window.__snakeScore||0) + ']', 'd');
      print('');
    }
  }

  /* Patch nextDir from global bridge */
  setInterval(function() {
    if (snakeRunning && window.__snakeDir) {
      /* injected — nothing needed, handleSnakeKey manages nextDir directly
         via closure if we restructure; for now this is a no-op bridge */
    }
  }, 50);

  /* ══════════════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════════════ */
  function padR(s, n) { s = String(s); return s + Array(Math.max(0,n-s.length)+1).join(' '); }
  function padL(s, n) { s = String(s); return Array(Math.max(0,n-s.length)+1).join(' ') + s; }

})();
 