/**
 * win31-apps.js — Windows 3.1 App Implementations
 * ══════════════════════════════════════════════════
 * Minesweeper, analog Clock, Paintbrush
 * All exposed on window.Win31Apps
 * ══════════════════════════════════════════════════
 */
(function () {
  'use strict';

  window.Win31Apps = {};

  /* ══════════════════════════════════════════════════
     MINESWEEPER
  ══════════════════════════════════════════════════ */
  Win31Apps.initMinesweeper = function(container) {
    if (!container) return;

    var COLS = 9, ROWS = 9, MINES = 10;
    var board, revealed, flagged, gameOver, mineCount, timerVal, timerInterval;

    function newGame() {
      clearInterval(timerInterval);
      board    = Array(ROWS * COLS).fill(0);
      revealed = Array(ROWS * COLS).fill(false);
      flagged  = Array(ROWS * COLS).fill(false);
      gameOver = false;
      mineCount = MINES;
      timerVal  = 0;

      /* Place mines */
      var placed = 0;
      while (placed < MINES) {
        var idx = Math.floor(Math.random() * ROWS * COLS);
        if (board[idx] !== -1) { board[idx] = -1; placed++; }
      }
      /* Count neighbours */
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var i = r * COLS + c;
          if (board[i] === -1) continue;
          var count = 0;
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              var nr = r+dr, nc = c+dc;
              if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr*COLS+nc]===-1) count++;
            }
          }
          board[i] = count;
        }
      }

      timerInterval = setInterval(function() {
        timerVal = Math.min(999, timerVal + 1);
        var t = container.querySelector('.mine-counter.timer');
        if (t) t.textContent = String(timerVal).padStart(3,'0');
      }, 1000);

      render();
    }

    function render() {
      var html = [
        '<div class="mine-header">',
        '  <div class="mine-counter flags">' + String(mineCount).padStart(3,'0') + '</div>',
        '  <div class="mine-smiley" id="mine-smiley">😀</div>',
        '  <div class="mine-counter timer">000</div>',
        '</div>',
        '<div class="mine-grid" style="grid-template-columns:repeat('+COLS+',22px);">',
      ];
      for (var i = 0; i < ROWS * COLS; i++) {
        var cls = 'mine-cell';
        var content = '';
        if (revealed[i]) {
          cls += ' revealed';
          if (board[i] === -1) { cls += ' exploded'; content = '💣'; }
          else if (board[i] > 0) { cls += ' mine-'+board[i]; content = board[i]; }
        } else if (flagged[i]) {
          cls += ' flagged';
        }
        html.push('<div class="'+cls+'" data-idx="'+i+'">'+content+'</div>');
      }
      html.push('</div>');
      container.innerHTML = html.join('');

      container.querySelector('#mine-smiley').addEventListener('click', newGame);

      container.querySelectorAll('.mine-cell').forEach(function(cell) {
        var idx = parseInt(cell.dataset.idx, 10);
        cell.addEventListener('click', function() { revealCell(idx); render(); });
        cell.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          if (revealed[idx]) return;
          flagged[idx] = !flagged[idx];
          mineCount += flagged[idx] ? -1 : 1;
          render();
        });
      });
    }

    function revealCell(idx) {
      if (gameOver || revealed[idx] || flagged[idx]) return;
      revealed[idx] = true;
      if (board[idx] === -1) {
        gameOver = true;
        clearInterval(timerInterval);
        /* Reveal all mines */
        board.forEach(function(v,i){ if(v===-1)revealed[i]=true; });
        setTimeout(function(){
          var s = container.querySelector('#mine-smiley');
          if (s) s.textContent = '😵';
        }, 10);
        return;
      }
      /* Flood fill empty cells */
      if (board[idx] === 0) {
        var r = Math.floor(idx / COLS), c = idx % COLS;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var nr = r+dr, nc = c+dc;
            if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) {
              var ni = nr*COLS+nc;
              if (!revealed[ni]&&!flagged[ni]) revealCell(ni);
            }
          }
        }
      }
      /* Check win */
      var hidden = revealed.filter(function(v){ return !v; }).length;
      if (hidden === MINES) {
        gameOver = true;
        clearInterval(timerInterval);
        setTimeout(function(){
          var s = container.querySelector('#mine-smiley');
          if (s) s.textContent = '😎';
        }, 10);
      }
    }

    newGame();
  };

  /* ══════════════════════════════════════════════════
     ANALOG CLOCK
  ══════════════════════════════════════════════════ */
  Win31Apps.initClock = function(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var clockInterval;

    function drawClock() {
      var W = canvas.width, H = canvas.height;
      var cx = W/2, cy = H/2, r = Math.min(W,H)/2 - 4;
      var now = new Date();
      var h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();

      ctx.clearRect(0,0,W,H);

      /* Face */
      ctx.fillStyle = '#c0c0c0';
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#808080'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx-1,cy-1,r,0,Math.PI*2); ctx.stroke();

      /* Hour markers */
      for (var i = 0; i < 12; i++) {
        var a = (i/12)*Math.PI*2 - Math.PI/2;
        var len = i % 3 === 0 ? r*0.15 : r*0.08;
        ctx.strokeStyle = '#000'; ctx.lineWidth = i%3===0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*(r-len), cy + Math.sin(a)*(r-len));
        ctx.lineTo(cx + Math.cos(a)*(r-4),   cy + Math.sin(a)*(r-4));
        ctx.stroke();
      }

      function hand(angle, length, width, color) {
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle)*length, cy + Math.sin(angle)*length);
        ctx.stroke();
      }

      /* Hands */
      hand((h/12 + m/720)*Math.PI*2 - Math.PI/2, r*0.5,  3, '#000');
      hand((m/60  + s/3600)*Math.PI*2 - Math.PI/2, r*0.7, 2, '#000');
      hand(s/60*Math.PI*2 - Math.PI/2,             r*0.8, 1, '#ff0000');

      /* Centre dot */
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
    }

    drawClock();
    clockInterval = setInterval(drawClock, 1000);

    /* Clean up when window is closed */
    canvas.addEventListener('remove', function(){ clearInterval(clockInterval); });
  };

  /* ══════════════════════════════════════════════════
     PAINTBRUSH
  ══════════════════════════════════════════════════ */
  Win31Apps.initPaint = function(container) {
    if (!container) return;

    var COLORS = [
      '#000000','#808080','#800000','#ff0000','#808000','#ffff00',
      '#008000','#00ff00','#008080','#00ffff','#000080','#0000ff',
      '#800080','#ff00ff','#c0c0c0','#ffffff',
    ];

    var currentColor = '#000000';
    var currentTool  = 'pencil';
    var drawing = false;
    var lastX = 0, lastY = 0;

    var TOOLS = [
      {id:'pencil',  icon:'✏️', title:'Pencil'},
      {id:'brush',   icon:'🖌️', title:'Brush'},
      {id:'eraser',  icon:'⬜', title:'Eraser'},
      {id:'fill',    icon:'🪣', title:'Fill'},
      {id:'line',    icon:'╱',  title:'Line'},
      {id:'rect',    icon:'⬜', title:'Rectangle'},
      {id:'ellipse', icon:'○',  title:'Ellipse'},
      {id:'text',    icon:'A',  title:'Text'},
    ];

    var toolsHTML = TOOLS.map(function(t) {
      return '<div class="paint-tool'+(t.id===currentTool?' active':'')+'" data-tool="'+t.id+'" title="'+t.title+'">'+t.icon+'</div>';
    }).join('');

    var colorsHTML = COLORS.map(function(c) {
      return '<div class="paint-color'+(c===currentColor?' selected':'')+'" style="background:'+c+';" data-color="'+c+'"></div>';
    }).join('');

    container.className = 'paint-app';
    container.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;';
    container.innerHTML = [
      '<div class="paint-toolbar">'+toolsHTML+'</div>',
      '<div class="paint-canvas-wrap" style="flex:1;overflow:auto;background:#808080;padding:4px;">',
      '  <canvas id="paint-canvas" width="460" height="280"></canvas>',
      '</div>',
      '<div class="paint-colors">',
      '  <div class="paint-color selected" id="paint-current" style="width:28px;height:28px;background:'+currentColor+';border:2px inset;margin-right:4px;"></div>',
      colorsHTML,
      '</div>',
    ].join('');

    var canvas = document.getElementById('paint-canvas');
    var ctx = canvas.getContext('2d');

    /* Fill white */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    /* Tool buttons */
    container.querySelectorAll('.paint-tool').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentTool = btn.dataset.tool;
        container.querySelectorAll('.paint-tool').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    /* Color buttons */
    container.querySelectorAll('.paint-color[data-color]').forEach(function(swatch) {
      swatch.addEventListener('click', function() {
        currentColor = swatch.dataset.color;
        var cur = document.getElementById('paint-current');
        if (cur) cur.style.background = currentColor;
        container.querySelectorAll('.paint-color[data-color]').forEach(function(s){ s.classList.remove('selected'); });
        swatch.classList.add('selected');
      });
    });

    /* Drawing */
    canvas.addEventListener('mousedown', function(e) {
      drawing = true;
      var r = canvas.getBoundingClientRect();
      lastX = e.clientX - r.left;
      lastY = e.clientY - r.top;
      if (currentTool === 'fill') { floodFill(Math.round(lastX), Math.round(lastY), currentColor); }
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!drawing) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
      ctx.lineWidth   = currentTool === 'eraser' ? 12 : currentTool === 'brush' ? 5 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
      lastX = x; lastY = y;
    });
    canvas.addEventListener('mouseup',    function(){ drawing = false; });
    canvas.addEventListener('mouseleave', function(){ drawing = false; });

    /* Simple flood fill */
    function floodFill(x, y, fillColor) {
      var imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
      var data = imgData.data;
      var idx = (y * canvas.width + x) * 4;
      var targetR=data[idx], targetG=data[idx+1], targetB=data[idx+2];

      /* Convert fill color hex to rgb */
      var fc = parseInt(fillColor.slice(1),16);
      var fillR=(fc>>16)&255, fillG=(fc>>8)&255, fillB=fc&255;
      if (targetR===fillR&&targetG===fillG&&targetB===fillB) return;

      var stack = [[x,y]];
      while (stack.length) {
        var pt = stack.pop();
        var px=pt[0], py=pt[1];
        if (px<0||px>=canvas.width||py<0||py>=canvas.height) continue;
        var pi=(py*canvas.width+px)*4;
        if (data[pi]!==targetR||data[pi+1]!==targetG||data[pi+2]!==targetB) continue;
        data[pi]=fillR; data[pi+1]=fillG; data[pi+2]=fillB;
        stack.push([px+1,py],[px-1,py],[px,py+1],[px,py-1]);
      }
      ctx.putImageData(imgData,0,0);
    }

    Win31Apps.paintClear = function() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    };
  };

})();
 