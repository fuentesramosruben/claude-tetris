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
const startScreen = document.getElementById('start-screen');
const startTable = document.getElementById('start-table');
const startStats = document.getElementById('start-stats');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordSection = document.getElementById('record-section');
const recordMsg = document.getElementById('record-msg');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');
const overTable = document.getElementById('over-table');
const overStats = document.getElementById('over-stats');

let gridColor = '#22222e';
let palette = COLORS;

let combo, maxCombo, pendingRecord;
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
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
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
  const color = palette[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Celda central de la tuerca: cuadrado con un orificio circular
function drawNutHole(context, x, y, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = palette[8];
  context.beginPath();
  context.rect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.arc((x + 0.5) * size, (y + 0.5) * size, size * 0.32, 0, Math.PI * 2);
  context.fill('evenodd');
  context.globalAlpha = 1;
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
  showGameOverRecords();
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

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  palette = theme === 'light' ? COLORS_LIGHT : COLORS;
  themeToggle.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
  // Con pausa o game over el bucle no redibuja
  if (current && next) { draw(); drawNext(); }
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
  combo = 0;
  maxCombo = 0;
  pendingRecord = null;
  recordSection.classList.add('rec-hidden');
  startScreen.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // No interceptar teclas mientras se escribe en un campo de texto
  if (e.target && e.target.tagName === 'INPUT') return;
  // Sin partida iniciada (pantalla de inicio) no hay nada que controlar
  if (!current) return;
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

// ---- Records ----
const RECORDS_KEY = 'tetrisRecords';
const NAME_KEY = 'tetrisLastName';
const MAX_TOP = 5;

function loadRecords() {
  const rec = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && typeof data === 'object') {
      if (Array.isArray(data.top)) {
        rec.top = data.top
          .filter(t => t && Number.isFinite(t.score))
          .slice(0, MAX_TOP)
          .map(t => ({
            name: String(t.name ?? '').slice(0, 12),
            score: t.score,
            lines: Number(t.lines) || 0,
            level: Number(t.level) || 1,
            date: String(t.date ?? ''),
          }));
      }
      rec.bestCombo = Number(data.bestCombo) || 0;
      rec.maxLines = Number(data.maxLines) || 0;
    }
  } catch (e) {}
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) {}
}

function qualifiesForTop(rec, pts) {
  return pts > 0 && (rec.top.length < MAX_TOP || pts > rec.top[rec.top.length - 1].score);
}

// Inserta una entrada tras las de igual puntuación y recorta al top 5
function insertEntry(list, entry) {
  const out = list.concat(entry).sort((a, b) => b.score - a.score);
  return { list: out.slice(0, MAX_TOP), index: out.indexOf(entry) };
}

function renderTable(table, entries, highlight) {
  const tbody = table.tBodies[0];
  tbody.textContent = '';
  const head = tbody.insertRow();
  head.className = 'records-head';
  ['#', 'Nombre', 'Puntos', 'Líneas'].forEach(t => { head.insertCell().textContent = t; });
  if (!entries.length) {
    const cell = tbody.insertRow().insertCell();
    cell.colSpan = 4;
    cell.className = 'records-empty';
    cell.textContent = 'Sin records todavía';
    return;
  }
  entries.forEach((en, i) => {
    const row = tbody.insertRow();
    if (i === highlight) row.className = 'highlight';
    row.insertCell().textContent = i + 1;
    row.insertCell().textContent = en.name || 'Anónimo';
    row.insertCell().textContent = en.score.toLocaleString();
    row.insertCell().textContent = en.lines;
    if (en.date) row.title = new Date(en.date).toLocaleDateString('es-ES');
  });
}

function statsText(rec) {
  return `Mejor combo: ${rec.bestCombo} · Líneas máx.: ${rec.maxLines}`;
}

function showStartScreen() {
  const rec = loadRecords();
  renderTable(startTable, rec.top, -1);
  startStats.textContent = statsText(rec);
  startScreen.classList.remove('hidden');
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  overStats.textContent = `${statsText(rec)} · Combo de la partida: ${maxCombo}`;
  recordSection.classList.remove('rec-hidden');
  if (qualifiesForTop(rec, score)) {
    pendingRecord = { name: '', score, lines, level, date: new Date().toISOString() };
    const { list, index } = insertEntry(rec.top, pendingRecord);
    renderTable(overTable, list, index);
    recordMsg.classList.remove('rec-hidden');
    recordForm.classList.remove('rec-hidden');
    let last = '';
    try { last = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    recordName.value = last.slice(0, 12);
    // Pequeña espera para que no se escriban espacios de un Space pulsado en el juego
    setTimeout(() => { if (pendingRecord) { recordName.focus(); recordName.select(); } }, 500);
  } else {
    pendingRecord = null;
    renderTable(overTable, rec.top, -1);
    recordMsg.classList.add('rec-hidden');
    recordForm.classList.add('rec-hidden');
  }
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingRecord) return;
  const name = recordName.value.trim().slice(0, 12) || 'Anónimo';
  try { localStorage.setItem(NAME_KEY, name); } catch (err) {}
  const rec = loadRecords();
  pendingRecord.name = name;
  const { list, index } = insertEntry(rec.top, pendingRecord);
  rec.top = list;
  saveRecords(rec);
  pendingRecord = null;
  renderTable(overTable, list, index);
  recordForm.classList.add('rec-hidden');
  recordMsg.classList.add('rec-hidden');
  recordName.blur();
});

playBtn.addEventListener('click', () => { init(); playBtn.blur(); });

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
  showStartScreen();
  resetRecordsBtn.blur();
});

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evitar que Space/Enter vuelvan a activar el botón
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

showStartScreen();
