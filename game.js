'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca, gris metálico
];

// Paleta con más contraste para el tema claro
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#607d8b', // N
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (reto)
];

// ---- Skins ----
function roundedRectPath(context, x, y, w, h, r) {
  if (context.roundRect) { context.roundRect(x, y, w, h, r); return; }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    colorsLight: COLORS_LIGHT,
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neón',
    glow: true,
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#00ff66', '#ff2255', '#3d7bff', '#ff8a00', '#c8d4ff'],
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.4;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px + 4, py + 4, size - 8, size - 8);
      context.globalAlpha = 1;
    },
  },
  pastel: {
    name: 'Pastel',
    radius: 0.25,
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8e6', '#b8e6c1', '#f5b8b8', '#b8d4f5', '#fcd3a4', '#cfd8dc'],
    colorsLight: [null, '#6cc9d6', '#f2cf63', '#bb86d1', '#7fcf8c', '#ec8a8a', '#82b0e8', '#f5b068', '#9aabb3'],
    drawCell(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      roundedRectPath(context, px + 1, py + 1, size - 2, size - 2, size * 0.25);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.beginPath();
      roundedRectPath(context, px + size * 0.2, py + size * 0.15, size * 0.6, size * 0.14, size * 0.07);
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#29b6d6', '#f5c518', '#a23fbd', '#4caf50', '#d84343', '#3f7fd8', '#f57c00', '#8d9aa0'],
    drawCell(context, px, py, size, color, alpha) {
      const b = Math.max(2, Math.round(size / 8)); // grosor del bisel
      const s = size - 2;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s, s);
      // patrón de píxeles (damero)
      context.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = b, a = 0; i < s - b; i += b, a++)
        for (let j = b, d = 0; j < s - b; j += b, d++)
          if ((a + d) % 2 === 0) context.fillRect(px + 1 + i, py + 1 + j, b, b);
      // bisel claro (arriba/izquierda) y oscuro (abajo/derecha)
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px + 1, py + 1, s, b);
      context.fillRect(px + 1, py + 1, b, s);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px + 1, py + 1 + s - b, s, b);
      context.fillRect(px + 1 + s - b, py + 1, b, s);
      context.globalAlpha = 1;
    },
  },
};

const NUT = 8;
const NUT_CHANCE = 0.05; // probabilidad de que la siguiente pieza sea la tuerca

const LINE_SCORES =[0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let palette = COLORS;
let currentSkin = SKINS.retro;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < NUT_CHANCE
    ? NUT
    : Math.floor(Math.random() * (PIECES.length - 2)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  currentSkin.drawCell(context, x * size, y * size, size, palette[colorIndex], alpha ?? 1);
}

// Celda central de la tuerca: celda de la skin activa con un orificio circular
function drawNutHole(context, x, y, size, alpha) {
  // Misma celda que el resto de la tuerca (estilo de la skin) y se recorta el orificio
  currentSkin.drawCell(context, x * size, y * size, size, palette[8], alpha ?? 1);
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  context.beginPath();
  context.arc((x + 0.5) * size, (y + 0.5) * size, size * 0.32, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // la pieza que no pudo aparecer no forma parte del tablero
  if (gameOver) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === 8) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === 8) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.type === 8) drawNutHole(nextCtx, offX + 1, offY + 1, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      // endGame() ya dibujó el estado final; no reprogramar el bucle
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

// Recalcula paleta y color de rejilla según tema + skin y redibuja
function refreshPalette() {
  const root = document.documentElement;
  gridColor = getComputedStyle(root).getPropertyValue('--grid').trim();
  palette = (root.dataset.theme === 'light' && currentSkin.colorsLight) || currentSkin.colors;
  // Con pausa o game over el bucle no redibuja
  if (current && next) { draw(); drawNext(); }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  themeToggle.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
  refreshPalette();
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = SKINS[name];
  document.documentElement.dataset.skin = name;
  try { localStorage.setItem('skin', name); } catch (e) {}
  skinSelect.value = name;
  refreshPalette();
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el selector usa sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evitar que Space/Enter vuelvan a activar el botón
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evitar que flechas/Space cambien la opción durante la partida
});

applySkin(document.documentElement.dataset.skin);
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

init();
