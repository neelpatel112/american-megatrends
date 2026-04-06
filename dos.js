/**
 * ════════════════════════════════════════════════════════════
 *  RetroShell — Full MS-DOS 6.22 Emulator
 *  Boots after BIOS handoff. Fully interactive.
 *
 *  Commands: VER, DIR, CD, CLS, HELP, TYPE, COPY, DEL,
 *            MKDIR, CHKDSK, MEM, SCANDISK, FORMAT, EDIT,
 *            DEBUG, SYS, ATTRIB, PING, IPCONFIG, NETSTAT,
 *            TREE, DATE, TIME, ECHO, SET, COLOR, MODE,
 *            SNAKE, MATRIX, SYSINFO, SECRET, EXIT + more
 *
 *  Easter eggs: MATRIX rain, hidden files, secret folder,
 *               fake format bomb, SNAKE game, love letter
 * ════════════════════════════════════════════════════════════
 */
(function(){
'use strict';

/* ── Wait for BIOS complete ─────────────────────────── */
window.addEventListener('bios:complete', () => {
  setTimeout(bootDOS, 400);
});

const SFX = window.BiosAudio;
const delay = ms => new Promise(r => setTimeout(r, ms));
const rand  = (a,b) => Math.random()*(b-a)+a;

/* ════════════════════════════════════════════════════
   VIRTUAL FILE SYSTEM
════════════════════════════════════════════════════ */
const FS = {
  'C:': {
    type: 'dir',
    children: {
      'WINDOWS': {
        type:'dir',
        children:{
          'SYSTEM32':{ type:'dir', children:{
            'KERNEL32.DLL':{ type:'file', size:356864,  date:'04-14-2011', content:'Binary file. Cannot display.' },
            'NTDLL.DLL':   { type:'file', size:724992,  date:'04-14-2011', content:'Binary file. Cannot display.' },
            'CMD.EXE':     { type:'file', size:388608,  date:'04-14-2011', content:'Binary file. Cannot display.' },
          }},
          'WIN.INI':  { type:'file', size:219,  date:'01-01-2009', content:`[windows]\nload=\nrun=\n\n[Desktop]\nWallpaper=C:\\Windows\\default.bmp\nTileWallpaper=0\n` },
          'SYSTEM.INI':{ type:'file', size:422, date:'01-01-2009', content:`[boot]\nsystem.drv=system.drv\nshell=explorer.exe\n\n[386Enh]\nswapfile=win386.swp\n` },
        }
      },
      'DOS': {
        type:'dir',
        children:{
          'COMMAND.COM':{ type:'file', size:54619,  date:'04-09-1994', content:'Binary file. Cannot display.' },
          'FORMAT.COM': { type:'file', size:22717,  date:'04-09-1994', content:'Binary file. Cannot display.' },
          'FDISK.EXE':  { type:'file', size:57224,  date:'04-09-1994', content:'Binary file. Cannot display.' },
          'EDIT.COM':   { type:'file', size:69886,  date:'04-09-1994', content:'Binary file. Cannot display.' },
          'DEBUG.EXE':  { type:'file', size:20634,  date:'04-09-1994', content:'Binary file. Cannot display.' },
        }
      },
      'USERS': {
        type:'dir',
        children:{
          'ADMIN': {type:'dir', children:{
            'DESKTOP':{type:'dir', children:{
              'TODO.TXT':  { type:'file', size:128, date:'03-15-2011', content:`Things to do:\n- Fix the leaky faucet\n- Call mom back\n- Figure out why the PC beeps 3 times on startup\n- Buy milk\n` },
              'NOTES.TXT': { type:'file', size:256, date:'04-01-2011', content:`Note to self:\nThe password is NOT "password123"\nIt is "password1234"\n\nAlso: stop writing passwords in text files genius\n` },
            }},
            'DOCUMENTS':{type:'dir', children:{
              'RESUME.TXT':  { type:'file', size:512, date:'02-20-2011', content:`JOHN A. SMITH\njohn.smith@hotmail.com | (555) 867-5309\n\nOBJECTIVE:\nTo find employment that doesn't make me want to\ncry in the bathroom every day.\n\nSKILLS:\n- Microsoft Word (intermediate)\n- Can type 40 WPM\n- Excellent at pretending to be busy\n- Coffee consumption: expert level\n` },
              'BUDGET.TXT':  { type:'file', size:340, date:'03-01-2011', content:`Monthly Budget:\nRent:       -$800\nFood:       -$300\nInternet:   -$50\nGames:      -$200  <- mom says this is too much\nSteam sales:-$400  <- not a problem, they were on SALE\nSavings:    $0\nStatus:     send help\n` },
            }},
            'SECRET':{ type:'dir', hidden:true, children:{
              'README.TXT':  { type:'file', size:420, date:'04-20-2011', content:`If you found this folder, congratulations.\nYou are either very curious or very bored.\nProbably both.\n\nYour reward: this message and a virtual high five ✋\n\nP.S. Type SNAKE to play a game.\nP.P.S. Type MATRIX for a surprise.\nP.P.P.S. Try: ECHO I LOVE YOU\n` },
              'DIARY.TXT':   { type:'file', size:600, date:'01-14-2011', content:`Dear Diary,\n\nToday I spent 6 hours trying to install a printer driver.\nThe printer still doesn't work.\n\nI have come to the conclusion that printers are\nsentient beings that feed on human suffering.\n\nMy therapist says I need to "let go of anger."\nMy therapist has never tried to install an HP driver.\n\n- John\n` },
              'PASSWORDS.TXT':{ type:'file', size:180, date:'02-02-2011', content:`gmail:     hunter2\nfacebook:  hunter2\nbank:      hunter2\nbios:      hunter2\nnote: i should probably use different passwords\nnote2: i will do this tomorrow\nnote3: today is tomorrow from yesterday. still havent done it.\n` },
            }},
          }},
        }
      },
      'AUTOEXEC.BAT':{ type:'file', size:128, date:'01-01-2009', content:`@ECHO OFF\nPROMPT $P$G\nPATH=C:\\DOS;C:\\WINDOWS;C:\\WINDOWS\\SYSTEM32\nSET TEMP=C:\\TEMP\nSET TMP=C:\\TEMP\nLH C:\\DOS\\SHARE.EXE\n` },
      'CONFIG.SYS':  { type:'file', size:96,  date:'01-01-2009', content:`DEVICE=C:\\DOS\\HIMEM.SYS\nDEVICE=C:\\DOS\\EMM386.EXE NOEMS\nBUFFERS=20\nFILES=40\nDOS=HIGH,UMB\nSTACKS=0,0\n` },
    }
  }
};

/* ════════════════════════════════════════════════════
   SHELL STATE
════════════════════════════════════════════════════ */
let cwd      = 'C:';          // current working directory path string
let cwdNode  = FS['C:'];      // reference to current dir node
let inputBuf = '';
let history  = [];
let histIdx  = -1;
let dosActive = false;
let env = { PATH:'C:\\DOS;C:\\WINDOWS', TEMP:'C:\\TEMP', COMSPEC:'C:\\DOS\\COMMAND.COM', PROMPT:'$P$G' };

/* ════════════════════════════════════════════════════
   DOM
════════════════════════════════════════════════════ */
let outputEl, inputTextEl, promptEl, snakeCanvas;

/* ════════════════════════════════════════════════════
   BOOT SEQUENCE
════════════════════════════════════════════════════ */
async function bootDOS() {
  // Show DOS phase
  document.querySelectorAll('.phase').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  const phase = document.getElementById('phase-dos');
  phase.style.display='block'; void phase.offsetWidth; phase.classList.add('active');

  outputEl     = document.getElementById('dos-output');
  inputTextEl  = document.getElementById('dos-input-text');
  promptEl     = document.getElementById('dos-prompt');
  snakeCanvas  = document.getElementById('snake-canvas');

  dosActive = true;

  // Boot messages
  const bootLines = [
    {text:'',cls:''},
    {text:'Starting MS-DOS...',cls:'white'},
    {text:'',cls:''},
    {text:'HIMEM is testing extended memory...',cls:''},
    {text:'',cls:''},
  ];

  for(const l of bootLines){ printLine(l.text, l.cls); await delay(rand(80,180)); }

  // Fake driver load messages
  const drivers = [
    'C:\\DOS\\HIMEM.SYS loaded into High Memory Area',
    'C:\\DOS\\EMM386.EXE  Expanded Memory Manager 386 v4.49',
    'C:\\DOS\\SHARE.EXE   Share loaded',
    'MOUSE.SYS          Microsoft Mouse Driver v9.01 loaded',
    'CDROM.SYS          CD-ROM Extension v2.23 loaded',
    'IFSHLP.SYS         IFS Helper loaded',
  ];
  for(const d of drivers){ printLine(d,'dim'); await delay(rand(60,130)); }

  await delay(300);
  printLine('','');
  printLine('MS-DOS Version 6.22','white');
  printLine('(C)Copyright Microsoft Corp 1981-1994.','');
  printLine('','');
  printLine('C:\\>','' );
  // remove the fake prompt line, real prompt will be at bottom
  outputEl.lastChild && outputEl.removeChild(outputEl.lastChild);

  updatePrompt();
  setupInput();

  // Scroll to bottom
  outputEl.scrollTop = outputEl.scrollHeight;
}

/* ════════════════════════════════════════════════════
   OUTPUT HELPERS
════════════════════════════════════════════════════ */
function printLine(text='', cls='') {
  const span = document.createElement('span');
  span.className = 'dos-line' + (cls ? ' '+cls : '');
  span.textContent = text;
  outputEl.appendChild(span);
  outputEl.appendChild(document.createTextNode('\n'));
  scrollBottom();
}

function printLines(arr) { arr.forEach(([t,c])=>printLine(t,c||'')); }

function scrollBottom() { outputEl.scrollTop = outputEl.scrollHeight; }

function updatePrompt() { promptEl.textContent = cwd + '>'; }

/* ════════════════════════════════════════════════════
   INPUT
════════════════════════════════════════════════════ */
function setupInput() {
  document.addEventListener('keydown', handleKey);
}

function handleKey(e) {
  if(!dosActive) return;
  if(snakeRunning) { handleSnakeKey(e); e.preventDefault(); return; }

  SFX.shellKey();

  if(e.key === 'Enter') {
    e.preventDefault();
    const cmd = inputBuf.trim();
    // Echo the command line to output
    printLine(cwd + '> ' + cmd, 'dim');
    inputBuf = '';
    inputTextEl.textContent = '';
    if(cmd) { history.unshift(cmd); histIdx = -1; runCommand(cmd); }
    else printLine('');
    updatePrompt();
    return;
  }
  if(e.key === 'Backspace') {
    e.preventDefault();
    inputBuf = inputBuf.slice(0,-1);
    inputTextEl.textContent = inputBuf;
    return;
  }
  if(e.key === 'ArrowUp') {
    e.preventDefault();
    if(histIdx < history.length-1) histIdx++;
    inputBuf = history[histIdx] || '';
    inputTextEl.textContent = inputBuf;
    return;
  }
  if(e.key === 'ArrowDown') {
    e.preventDefault();
    if(histIdx > 0) histIdx--; else { histIdx=-1; inputBuf=''; }
    inputBuf = histIdx>=0 ? history[histIdx] : '';
    inputTextEl.textContent = inputBuf;
    return;
  }
  if(e.ctrlKey && e.key==='c') {
    e.preventDefault();
    printLine('^C','yellow');
    inputBuf=''; inputTextEl.textContent='';
    return;
  }
  if(e.key==='Tab') { e.preventDefault(); tabComplete(); return; }
  if(e.key.length===1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    inputBuf += e.key;
    inputTextEl.textContent = inputBuf;
  }
}

/* ── Tab completion ────────────────────────────────── */
function tabComplete(){
  const parts = inputBuf.split(' ');
  const partial = (parts[parts.length-1]||'').toUpperCase();
  const names = Object.keys(cwdNode.children||{});
  const match = names.find(n=>n.startsWith(partial));
  if(match){ parts[parts.length-1]=match; inputBuf=parts.join(' '); inputTextEl.textContent=inputBuf; }
}

/* ════════════════════════════════════════════════════
   PATH RESOLUTION
════════════════════════════════════════════════════ */
function resolvePath(input) {
  // Returns {node, pathStr} or null
  if(!input) return {node:cwdNode, pathStr:cwd};
  const up = input.toUpperCase();
  if(up==='..') {
    // Go up
    const parts = cwd.replace(/\\/g,'/').split('/').filter(Boolean);
    if(parts.length<=1) return {node:FS['C:'], pathStr:'C:'};
    parts.pop();
    return resolveAbsolute(parts.join('\\').replace('C:','C:'));
  }
  if(input.includes(':')) return resolveAbsolute(input);
  // Relative
  const full = cwd==='C:' ? 'C:\\'+input : cwd+'\\'+input;
  return resolveAbsolute(full);
}

function resolveAbsolute(path) {
  const parts = path.replace(/\//g,'\\').split('\\').filter(Boolean);
  let node = FS['C:'];
  let built = 'C:';
  for(let i=1;i<parts.length;i++){
    const p = parts[i].toUpperCase();
    if(!node.children||!node.children[p]) return null;
    node = node.children[p];
    built += '\\'+p;
  }
  return {node, pathStr:built};
}

function getNode(name) {
  if(!cwdNode.children) return null;
  return cwdNode.children[name.toUpperCase()] || null;
}

/* ════════════════════════════════════════════════════
   COMMAND ROUTER
════════════════════════════════════════════════════ */
function runCommand(raw) {
  const parts  = raw.trim().split(/\s+/);
  const cmd    = parts[0].toUpperCase();
  const args   = parts.slice(1);
  const argStr = args.join(' ');

  switch(cmd){
    case 'VER':        cmdVer(); break;
    case 'DIR':        cmdDir(argStr); break;
    case 'CD':
    case 'CHDIR':      cmdCd(argStr); break;
    case 'CLS':        cmdCls(); break;
    case 'HELP':       cmdHelp(argStr); break;
    case 'TYPE':       cmdType(argStr); break;
    case 'COPY':       cmdCopy(args); break;
    case 'DEL':
    case 'ERASE':      cmdDel(argStr); break;
    case 'MKDIR':
    case 'MD':         cmdMkdir(argStr); break;
    case 'RMDIR':
    case 'RD':         cmdRmdir(argStr); break;
    case 'CHKDSK':     cmdChkdsk(); break;
    case 'SCANDISK':   cmdScandisk(); break;
    case 'MEM':        cmdMem(); break;
    case 'FORMAT':     cmdFormat(argStr); break;
    case 'ATTRIB':     cmdAttrib(argStr); break;
    case 'TREE':       cmdTree(); break;
    case 'DATE':       cmdDate(); break;
    case 'TIME':       cmdTime(); break;
    case 'ECHO':       cmdEcho(argStr); break;
    case 'SET':        cmdSet(argStr); break;
    case 'COLOR':      cmdColor(argStr); break;
    case 'MODE':       cmdMode(); break;
    case 'PING':       cmdPing(argStr); break;
    case 'IPCONFIG':   cmdIpconfig(); break;
    case 'NETSTAT':    cmdNetstat(); break;
    case 'DEBUG':      cmdDebug(); break;
    case 'EDIT':       cmdEdit(argStr); break;
    case 'SYSINFO':    cmdSysinfo(); break;
    case 'SNAKE':      cmdSnake(); break;
    case 'MATRIX':     cmdMatrix(); break;
    case 'SECRET':     cmdSecret(); break;
    case 'EXIT':       cmdExit(); break;
    case 'REBOOT':
    case 'RESTART':    cmdReboot(); break;
    case 'HIMEM':
    case 'LOADHIGH':
    case 'LH':         printLine('Command loaded into UMB.','green'); break;
    case 'PATH':       printLine('PATH='+env.PATH,''); break;
    case 'PROMPT':     if(argStr){env.PROMPT=argStr;printLine('PROMPT set.','green');}else printLine(env.PROMPT,''); break;
    case 'CLS':        cmdCls(); break;
    default:
      // Check if it's a filename to run
      if(getNode(cmd)||getNode(cmd+'.EXE')||getNode(cmd+'.COM')||getNode(cmd+'.BAT')){
        printLine(`Bad command or file name — '${parts[0]}' is not executable in this shell.`,'yellow');
      } else {
        printLine(`Bad command or file name`,'red');
      }
  }
  printLine('');
}

/* ════════════════════════════════════════════════════
   COMMANDS
════════════════════════════════════════════════════ */

function cmdVer(){
  printLines([
    ['',''],
    ['MS-DOS Version 6.22','white'],
    ['(C)Copyright Microsoft Corp 1981-1994.',''],
  ]);
}

function cmdDir(arg){
  const showHidden = arg.toUpperCase().includes('/A');
  const node = cwdNode;
  if(!node.children){ printLine('File not found','red'); return; }

  printLine('');
  printLine(` Volume in drive C is SYSTEM      Serial Number is 1337-C0DE`,'');
  printLine(` Directory of ${cwd}`,'');
  printLine('');

  const entries = Object.entries(node.children);
  let fileCount=0, dirCount=0, totalBytes=0;

  // . and ..
  printLine(`.               <DIR>          04-25-2011  09:12`,'cyan');
  printLine(`..              <DIR>          04-25-2011  09:12`,'cyan');

  for(const [name, entry] of entries){
    if(entry.hidden && !showHidden) continue;
    const date = entry.date || '04-25-2011';
    if(entry.type==='dir'){
      dirCount++;
      printLine(`${name.padEnd(16)}<DIR>          ${date}  00:00`,'cyan');
    } else {
      fileCount++;
      totalBytes += entry.size||0;
      const sz = String(entry.size||0).padStart(10);
      printLine(`${name.padEnd(16)}${sz}   ${date}  00:00`,'');
    }
  }
  printLine('');
  printLine(`      ${fileCount} file(s)  ${totalBytes.toLocaleString()} bytes`,'');
  printLine(`      ${dirCount} dir(s)   ${(420*1024*1024).toLocaleString()} bytes free`,'');
}

function cmdCd(arg){
  if(!arg){ printLine(cwd,''); return; }
  const result = resolvePath(arg);
  if(!result){ printLine(`Invalid directory`,'red'); return; }
  if(result.node.type!=='dir'){ printLine(`Not a directory`,'red'); return; }
  cwd = result.pathStr;
  cwdNode = result.node;
  updatePrompt();
}

function cmdCls(){
  outputEl.innerHTML='';
}

function cmdHelp(arg){
  if(arg){
    const help = HELP_DETAIL[arg.toUpperCase()];
    if(help){ printLine(''); help.forEach(l=>printLine(l[0],l[1])); return; }
  }
  printLines([
    ['',''],
    ['For more information on a specific command, type HELP command-name','yellow'],
    ['',''],
    ['ATTRIB   CHDIR    CHKDSK   CLS      COLOR    COPY     DATE',''],
    ['DEBUG    DEL      DIR      ECHO     EDIT     FORMAT   HELP',''],
    ['IPCONFIG MATRIX   MD       MEM      MKDIR    MODE     NETSTAT',''],
    ['PATH     PING     PROMPT   RD       REBOOT   RMDIR    SCANDISK',''],
    ['SECRET   SET      SNAKE    SYSINFO  TIME     TREE     TYPE',''],
    ['VER      ',''],
    ['',''],
    ['💡 TIP: Try typing  SNAKE  for a surprise','yellow'],
  ]);
}

const HELP_DETAIL = {
  'DIR':   [['DIR [drive:][path][filename] [/A] [/P] [/W]','yellow'],['',''],['Displays a list of files and subdirectories.',''],['  /A   Displays files with HIDDEN attribute',''],['  /P   Pauses after each full screen of info',''],['  /W   Uses wide list format','']],
  'CD':    [['CHDIR [drive:][path]','yellow'],['',''],['Changes the current directory.',''],['  CD ..    Go up one level',''],['  CD \\     Go to root','']],
  'TYPE':  [['TYPE [drive:][path]filename','yellow'],['',''],['Displays the contents of a text file.','']],
  'COPY':  [['COPY source [destination]','yellow'],['',''],['Copies one or more files to another location.','']],
  'SNAKE': [['SNAKE','yellow'],['',''],['Launches the classic Snake game.',''],['Use arrow keys to move. Eat the food (*).',''],['ESC to quit.','']],
};

function cmdType(arg){
  if(!arg){ printLine('Required parameter missing','red'); return; }
  const name = arg.toUpperCase().split('\\').pop();
  const node = getNode(name);
  if(!node){ printLine(`File not found - ${arg}`,'red'); return; }
  if(node.type==='dir'){ printLine('Access is denied.','red'); return; }
  printLine('');
  (node.content||'[empty file]').split('\n').forEach(l=>printLine(l,''));
}

function cmdCopy(args){
  if(args.length<1){ printLine('Required parameter missing','red'); return; }
  printLine(`        1 file(s) copied.`,'green');
}

function cmdDel(arg){
  if(!arg){ printLine('Required parameter missing','red'); return; }
  const name=arg.toUpperCase();
  if(cwdNode.children&&cwdNode.children[name]&&cwdNode.children[name].type==='file'){
    delete cwdNode.children[name];
    printLine('');
  } else {
    printLine(`File not found - ${arg}`,'red');
  }
}

function cmdMkdir(arg){
  if(!arg){ printLine('Required parameter missing','red'); return; }
  if(!cwdNode.children) cwdNode.children={};
  cwdNode.children[arg.toUpperCase()]={type:'dir',children:{}};
  printLine('');
}

function cmdRmdir(arg){
  if(!arg){ printLine('Required parameter missing','red'); return; }
  const n=cwdNode.children&&cwdNode.children[arg.toUpperCase()];
  if(!n){ printLine(`Invalid path, not directory, or directory not empty`,'red'); return; }
  if(Object.keys(n.children||{}).length>0){ printLine('The directory is not empty.','red'); return; }
  delete cwdNode.children[arg.toUpperCase()];
  printLine('');
}

function cmdChkdsk(){
  printLines([
    ['',''],
    ['CHKDSK is checking the file allocation table (FAT)...',''],
    ['',''],
    ['Volume SYSTEM       created 01-01-2009',''],
    ['Volume Serial Number is 1337-C0DE',''],
    ['',''],
    ['    512,110,592 bytes total disk space',''],
    ['         65,536 bytes in 2 hidden files',''],
    ['         32,768 bytes in 8 directories',''],
    ['      91,422,720 bytes in 312 user files',''],
    ['     420,589,568 bytes available on disk',''],
    ['',''],
    ['          4,096 bytes in each allocation unit',''],
    ['        125,027 total allocation units on disk',''],
    ['        102,678 available allocation units on disk',''],
    ['',''],
    ['        655,360 total bytes memory',''],
    ['        558,784 bytes free',''],
    ['',''],
    ['CHKDSK found no errors.','green'],
  ]);
}

function cmdScandisk(){
  printLines([
    ['',''],
    ['Microsoft ScanDisk','white'],
    ['=================',''],
    ['',''],
    ['ScanDisk is now checking drive C.',''],
    ['',''],
  ]);
  // Animated — fake async
  let i=0;
  const stages=['Reading FAT...','Checking directories...','Checking files...','Checking free space...','Finalizing...'];
  const run=()=>{
    if(i<stages.length){printLine(`  ${stages[i]}`,'');i++;setTimeout(run,320);}
    else{
      printLine('','');
      printLine('ScanDisk found and fixed 0 problems.','green');
      printLine('');
    }
  };
  run();
}

function cmdMem(){
  printLines([
    ['',''],
    ['Memory Type        Total    Used    Free','white'],
    ['─────────────────────────────────────────','dim'],
    ['Conventional       640K     81K     559K',''],
    ['Upper              155K     31K     124K',''],
    ['Reserved           384K    384K       0K',''],
    ['Extended (XMS)    3968K     0K    3968K',''],
    ['─────────────────────────────────────────','dim'],
    ['Total memory      5147K    496K   4651K',''],
    ['',''],
    ['Total under 1 MB   795K    112K    683K',''],
    ['',''],
    ['Largest executable program size   559K (572,416 bytes)','green'],
    ['Largest free upper memory block   124K (126,976 bytes)',''],
    ['MS-DOS is resident in the high memory area.',''],
  ]);
}

async function cmdFormat(arg){
  if(!arg||!arg.toUpperCase().startsWith('C')){
    printLine('Usage: FORMAT [drive:]','yellow'); return;
  }
  printLine('');
  printLine('WARNING! ALL DATA ON NON-REMOVABLE DISK','red');
  printLine('DRIVE C: WILL BE LOST!','red');
  printLine('Proceed with Format (Y/N)?','yellow');
  await delay(1200);

  // FAKE BOMB — pretend to start then bail
  printLine('Y','white');
  printLine('');
  printLine('Formatting...','');
  await delay(400);

  // Escalating glitch effect
  const sw=document.getElementById('screen-wrap');
  sw.style.filter='brightness(1.4) contrast(1.2)';
  await delay(80);
  sw.style.filter='';
  await delay(120);
  sw.style.transform='translateX(6px)';
  await delay(60);
  sw.style.transform='';

  printLine('','');
  printLine('Just kidding. Format aborted.','green');
  printLine("Did your heart skip a beat? 😈",'yellow');
  SFX.beep(880,.1,.2);
  await delay(100);
  SFX.beep(1100,.1,.2);
}

function cmdAttrib(arg){
  if(!arg){ printLine('Syntax: ATTRIB [+R | -R] [+H | -H] [filename]','yellow'); return; }
  printLine(`A          ${arg.toUpperCase()}`,'');
}

function cmdTree(){
  function walk(node, prefix=''){
    if(!node.children) return;
    const entries=Object.entries(node.children);
    entries.forEach(([name,child],i)=>{
      const last=(i===entries.length-1);
      const branch=last?'└───':'├───';
      const cls=child.type==='dir'?'cyan':'';
      printLine(`${prefix}${branch}${name}`,cls);
      if(child.type==='dir') walk(child, prefix+(last?'    '+'│   '));
    });
  }
  printLine('');
  printLine('Folder PATH listing for volume SYSTEM','');
  printLine('Volume serial number is 1337-C0DE','');
  printLine('C:\\','white');
  walk(cwdNode);
}

function cmdDate(){
  const d=new Date();
  printLine(`Current date is ${d.toLocaleDateString('en-US',{weekday:'short',month:'2-digit',day:'2-digit',year:'numeric'})}`,'');
  printLine('Enter new date (mm-dd-yy): (press ENTER to skip)','yellow');
}

function cmdTime(){
  const d=new Date();
  printLine(`Current time is ${d.toLocaleTimeString('en-US',{hour12:false})}.00`,'');
  printLine('Enter new time: (press ENTER to skip)','yellow');
}

function cmdEcho(arg){
  if(!arg){ printLine('ECHO is on.',''); return; }
  // Easter egg
  if(arg.toUpperCase()==='I LOVE YOU'){
    printLines([
      ['',''],
      ['  ♥  ♥     ♥  ♥','red'],
      [' ♥     ♥ ♥     ♥','red'],
      [' ♥       I       ♥','red'],
      ['  ♥    LOVE    ♥','red'],
      ['    ♥   YOU   ♥','red'],
      ['      ♥     ♥','red'],
      ['        ♥','red'],
      ['',''],
    ]);
    SFX.beep(523,.15,.2);setTimeout(()=>SFX.beep(659,.15,.2),160);setTimeout(()=>SFX.beep(784,.25,.2),320);
    return;
  }
  printLine(arg,'white');
}

function cmdSet(arg){
  if(!arg){ Object.entries(env).forEach(([k,v])=>printLine(`${k}=${v}`,'')); return; }
  const eq=arg.indexOf('=');
  if(eq>0){const k=arg.slice(0,eq).toUpperCase();const v=arg.slice(eq+1);env[k]=v;printLine(`${k} set.`,'green');}
  else printLine(`Environment variable not found`,'red');
}

function cmdColor(arg){
  const colors={'0':'#000','1':'#000080','2':'#008000','3':'#008080','4':'#800000','5':'#800080','6':'#808000','7':'#c0c0c0','8':'#808080','9':'#0000ff','A':'#00ff00','B':'#00ffff','C':'#ff0000','D':'#ff00ff','E':'#ffff00','F':'#fff'};
  if(!arg||arg.length<2){printLine('Syntax: COLOR bg fg (e.g. COLOR 07)','yellow');return;}
  const bg=colors[arg[0].toUpperCase()],fg=colors[arg[1].toUpperCase()];
  if(bg)document.getElementById('dos-screen').style.background=bg;
  if(fg)document.getElementById('dos-screen').style.color=fg;
  printLine(`Color set.`,'');
}

function cmdMode(){
  printLines([
    ['',''],
    ['Status for device CON:','white'],
    ['----------------------','dim'],
    ['Lines:          25',''],
    ['Columns:        80',''],
    ['Keyboard rate:  31',''],
    ['Keyboard delay: 1',''],
    ['Code page:      437',''],
  ]);
}

async function cmdPing(arg){
  if(!arg){printLine('Usage: PING hostname','yellow');return;}
  printLine('');
  printLine(`Pinging ${arg} [127.0.0.1] with 32 bytes of data:`,'');
  await delay(200);
  for(let i=0;i<4;i++){
    await delay(rand(300,600));
    const ms=Math.floor(rand(8,55));
    printLine(`Reply from 127.0.0.1: bytes=32 time=${ms}ms TTL=128`,'green');
  }
  printLine('','');
  printLine(`Ping statistics for ${arg}:`,'');
  printLine(`    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`,'green');
  printLine(`Approximate round trip times in milli-seconds:`,'');
  printLine(`    Minimum = 8ms, Maximum = 55ms, Average = 24ms`,'');
}

function cmdIpconfig(){
  printLines([
    ['',''],
    ['Windows IP Configuration','white'],
    ['',''],
    ['Ethernet adapter Local Area Connection:',''],
    ['',''],
    ['   Connection-specific DNS Suffix . :',''],
    ['   IP Address. . . . . . . . . . . : 192.168.1.105','green'],
    ['   Subnet Mask . . . . . . . . . . : 255.255.255.0',''],
    ['   Default Gateway . . . . . . . . : 192.168.1.1',''],
    ['',''],
    ['Ethernet adapter Loopback:',''],
    ['',''],
    ['   IP Address. . . . . . . . . . . : 127.0.0.1',''],
    ['   Subnet Mask . . . . . . . . . . : 255.0.0.0',''],
  ]);
}

function cmdNetstat(){
  printLines([
    ['',''],
    ['Active Connections','white'],
    ['',''],
    ['  Proto  Local Address          Foreign Address        State',''],
    ['  TCP    192.168.1.105:1025     192.168.1.1:80         ESTABLISHED',''],
    ['  TCP    192.168.1.105:1033     65.52.100.91:443       ESTABLISHED',''],
    ['  TCP    127.0.0.1:1043         127.0.0.1:1043         TIME_WAIT',''],
    ['  UDP    0.0.0.0:500            *:*','dim'],
    ['  UDP    0.0.0.0:4500           *:*','dim'],
  ]);
}

function cmdDebug(){
  printLines([
    ['',''],
    ['-',''],
    ['Type ? for help, Q to quit','dim'],
    ['WARNING: DEBUG allows direct memory manipulation.','red'],
    ['This is a demo — commands are simulated.','yellow'],
    ['',''],
    ['- Q',''],
    ['Program terminated normally.',''],
  ]);
}

function cmdEdit(arg){
  printLines([
    ['',''],
    ['MS-DOS Editor - This is a GUI program and cannot run in this terminal.','yellow'],
    [`Use TYPE ${arg||'filename'} to view file contents.`,''],
  ]);
}

function cmdSysinfo(){
  const now=new Date();
  printLines([
    ['',''],
    ['═══════════════════════════════════════════','cyan'],
    ['   SYSTEM INFORMATION','white'],
    ['═══════════════════════════════════════════','cyan'],
    ['',''],
    [`  OS:         MS-DOS 6.22`,''],
    [`  CPU:        ${window.BIOS_CONFIG.cpu}`,''],
    [`  CPU Speed:  ${window.BIOS_CONFIG.cpuSpeed}`,''],
    [`  RAM:        ${window.BIOS_CONFIG.ramMB} MB`,''],
    [`  Disk C:     500.1 GB  (ATA-133, S.M.A.R.T. OK)`,''],
    [`  BIOS:       AMI v${window.BIOS_CONFIG.biosVer}  (${window.BIOS_CONFIG.biosDate})`,''],
    [`  Date:       ${now.toLocaleDateString()}`,''],
    [`  Time:       ${now.toLocaleTimeString()}`,''],
    ['',''],
    ['  💡 TIP: Type SNAKE to play a game.','yellow'],
    ['  💡 TIP: Type MATRIX for a visual trip.','yellow'],
    ['  💡 TIP: Type ECHO I LOVE YOU','yellow'],
    ['',''],
  ]);
}

function cmdSecret(){
  printLines([
    ['',''],
    ['There is no secret here.','red'],
    ['Move along.','red'],
    ['',''],
    ['...','dim'],
    ['',''],
    ['...okay maybe check C:\\USERS\\ADMIN\\SECRET','yellow'],
    ['',''],
  ]);
  SFX.beep(440,.1,.15);
}

async function cmdReboot(){
  printLine('');
  printLine('System rebooting...','yellow');
  await delay(1000);
  // Trigger full BIOS sequence again by reloading
  window.location.reload();
}

async function cmdExit(){
  printLine('');
  printLine('Shutting down...','yellow');
  await delay(600);
  SFX.crtOff();
  const sw=document.getElementById('screen-wrap');
  sw.style.animation='crt-off .24s ease-in forwards';
  setTimeout(()=>{
    document.getElementById('phase-dos').style.display='none';
    document.getElementById('phase-handoff').style.display='block';
    document.getElementById('power-led').className='led-off';
  },280);
}

/* ════════════════════════════════════════════════════
   MATRIX RAIN EASTER EGG
════════════════════════════════════════════════════ */
async function cmdMatrix(){
  printLine('Entering the Matrix...','green');
  dosActive=false;
  await delay(400);

  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:absolute;inset:0;z-index:200;background:#000;';
  canvas.width=document.getElementById('dos-screen').offsetWidth||640;
  canvas.height=document.getElementById('dos-screen').offsetHeight||400;
  document.getElementById('phase-dos').appendChild(canvas);
  const ctx=canvas.getContext('2d');

  const cols=Math.floor(canvas.width/14);
  const drops=Array(cols).fill(0).map(()=>Math.floor(Math.random()*canvas.height/16));
  const chars='アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOP0123456789@#$%^&*';

  let frame=0;
  const interval=setInterval(()=>{
    ctx.fillStyle='rgba(0,0,0,0.05)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font='13px "Share Tech Mono", monospace';
    for(let i=0;i<cols;i++){
      ctx.fillStyle=`hsl(120,100%,${50+Math.random()*30}%)`;
      const ch=chars[Math.floor(Math.random()*chars.length)];
      ctx.fillText(ch,i*14,drops[i]*16);
      if(drops[i]*16>canvas.height&&Math.random()>0.975) drops[i]=0;
      drops[i]++;
    }
    frame++;
    if(frame>400){
      clearInterval(interval);
      canvas.remove();
      dosActive=true;
      printLine('Wake up, Neo...','green');
      printLine('');
    }
  },40);

  // Allow ESC to exit early
  const escHandler=(e)=>{
    if(e.key==='Escape'){
      clearInterval(interval);
      canvas.remove();
      dosActive=true;
      printLine('[Matrix exited]','dim');
      printLine('');
      document.removeEventListener('keydown',escHandler);
    }
  };
  document.addEventListener('keydown',escHandler);
}

/* ════════════════════════════════════════════════════
   SNAKE GAME
════════════════════════════════════════════════════ */
let snakeRunning=false;
let snakeInterval=null;

function cmdSnake(){
  printLine('');
  printLine('SNAKE v1.0 — Use arrow keys. ESC to quit.','green');
  printLine('Eat the * to grow. Avoid walls and yourself.','');
  printLine('');
  dosActive=false;
  snakeRunning=true;

  const canvas=snakeCanvas;
  const CELL=15;
  const COLS=Math.floor(canvas.width/CELL);
  const ROWS=Math.floor(canvas.height/CELL);
  canvas.style.display='block';

  const ctx=canvas.getContext('2d');
  let snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  let dir={x:1,y:0};
  let nextDir={x:1,y:0};
  let food=spawnFood();
  let score=0;

  function spawnFood(){
    let f;
    do { f={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}; }
    while(snake.some(s=>s.x===f.x&&s.y===f.y));
    return f;
  }

  function draw(){
    ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Border
    ctx.strokeStyle='#55ff55';ctx.lineWidth=2;ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
    // Score
    ctx.fillStyle='#55ff55';ctx.font='11px "Share Tech Mono",monospace';
    ctx.fillText(`SCORE: ${score}`,4,12);
    // Food
    ctx.fillStyle='#ffff54';ctx.font=`${CELL}px "Share Tech Mono",monospace`;
    ctx.fillText('*',food.x*CELL,food.y*CELL+CELL-2);
    // Snake
    snake.forEach((s,i)=>{
      ctx.fillStyle=i===0?'#ffffff':'#55ff55';
      ctx.fillRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2);
    });
  }

  function step(){
    dir=nextDir;
    const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
    // Wall collision
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS){gameOver();return;}
    // Self collision
    if(snake.some(s=>s.x===head.x&&s.y===head.y)){gameOver();return;}
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){
      score+=10;food=spawnFood();SFX.beep(880,.05,.15);
    } else { snake.pop(); }
    draw();
  }

  function gameOver(){
    clearInterval(snakeInterval);
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#ff5555';ctx.font='20px "Share Tech Mono",monospace';
    ctx.textAlign='center';ctx.fillText('GAME OVER',canvas.width/2,canvas.height/2-10);
    ctx.fillStyle='#ffff54';ctx.font='13px "Share Tech Mono",monospace';
    ctx.fillText(`Score: ${score}`,canvas.width/2,canvas.height/2+14);
    ctx.fillText('Press ESC',canvas.width/2,canvas.height/2+34);
    SFX.errorBeep();
  }

  snakeInterval=setInterval(step,120);
  draw();
}

function handleSnakeKey(e){
  const dirs={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  if(dirs[e.key]){
    const nd=dirs[e.key];
    const cur=snakeInterval?{x:0,y:0}:{x:0,y:0};
    // Prevent reversing
    snakeCanvas; // just ref
    const snake=window.__snakeDirRef||{x:1,y:0};
    if(!(nd.x===-snake.x&&nd.y===-snake.y)){
      const inputRow=document.getElementById('dos-input-row');
      // We relay via the global nextDir in closure — just send key via synthetic approach
      document.dispatchEvent(new CustomEvent('snakeDir',{detail:nd}));
    }
  }
  if(e.key==='Escape'){
    clearInterval(snakeInterval);
    snakeCanvas.style.display='none';
    snakeRunning=false;
    dosActive=true;
    printLine('[Snake game ended]','dim');
    printLine('');
  }
}

// Patch snake dir via custom event
document.addEventListener('snakeDir',e=>{
  // nextDir is in closure — this approach uses a global bridge
  window.__snakeNextDir=e.detail;
});

})();
 