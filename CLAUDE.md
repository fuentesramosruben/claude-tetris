# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin linter ni tests. La documentación y los textos de UI están en español.

## Ejecutar

Abrir `index.html` directamente en el navegador (`start index.html` en Windows), o servir estático: `python -m http.server 8000`.

## Arquitectura

Tres archivos: `index.html` (DOM + canvases), `style.css`, `game.js` (toda la lógica, script clásico con `'use strict'`, sin módulos).

- **Estado global mutable** en `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.), reiniciado por `init()`. No hay clases ni módulos.
- **Bucle**: `loop(ts)` vía `requestAnimationFrame` acumula `dropAccum` y baja la pieza al superar `dropInterval`; `draw()` redibuja todo cada frame. Pausa y game over cancelan el frame (`cancelAnimationFrame(animId)`); reanudar vuelve a llamar a `loop`.
- **Flujo de bloqueo**: `lockPiece()` → `merge()` → `clearLines()` (actualiza lines/score/level/`dropInterval`) → `spawn()` (si la nueva pieza colisiona, `endGame()`).
- **Piezas**: matrices en `PIECES` cuyo valor de celda (1–8) indexa `COLORS`; el tablero guarda ese mismo índice (0 = vacío). La pieza 8 es la tuerca (3×3 con centro vacío, sale con `NUT_CHANCE` = 5%); `drawNutHole` dibuja su orificio circular mientras cae (actual, sombra y "Siguiente"). Rotación = `rotateCW` + wall kicks horizontales simples (`[0,-1,1,-2,2]`) en `tryRotate`.
- **Tamaños acoplados**: `COLS`/`ROWS`/`BLOCK` en `game.js` deben coincidir con `width`/`height` de `<canvas id="board">` en `index.html` (300×600). El canvas `next-canvas` es 120×120 (cuadrícula 4×4 de 30px).
- El HUD (`updateHUD`) se actualiza por IDs del DOM (`score`, `lines`, `level`, `overlay*`, `restart-btn`) que deben existir en `index.html`.
- **Tema claro/oscuro**: colores en variables CSS (`:root` oscuro por defecto, `:root[data-theme="light"]`). `applyTheme()` en `game.js` guarda la preferencia en `localStorage`, cachea `--grid` para `drawGrid()` y elige `COLORS` o `COLORS_LIGHT`. El botón `#theme-toggle` debe existir en `index.html`; un script inline en `<head>` aplica el tema antes de pintar.
- Puntuación: `LINE_SCORES[n] * level`; soft drop +1/fila, hard drop +2/celda. Velocidad: `max(100, 1000 - (level-1)*90)` ms; nivel sube cada 10 líneas.
