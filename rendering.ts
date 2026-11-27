// ============================================================================
// 7 & 9. RENDERIZADO: FONDO OFF-SCREEN, PREVIEWS, JUGADOR, ENEMIGOS Y VFX
// ============================================================================

import { CONFIG } from './config';
import { CHARACTER_LIST, getCharacterModule } from './characters/index';
import { STATE } from './state';
import { CAMERA } from './camera';
import { INPUT_TOUCH } from './input';

let canvas: HTMLCanvasElement | null = null;
let ctx!: CanvasRenderingContext2D;

let bgCanvas: HTMLCanvasElement | null = null;
let bgCtx: CanvasRenderingContext2D | null = null;

function ensureRenderContext(): boolean {
  if (ctx) return true;
  if (typeof document === 'undefined') return false;
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
  const context = canvas ? canvas.getContext('2d') : null;
  if (!context) return false;
  ctx = context;
  return true;
}

function ensureBgCanvas(): HTMLCanvasElement | null {
  if (bgCanvas && bgCtx) return bgCanvas;
  if (typeof document === 'undefined') return null;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = CONFIG.WORLD_WIDTH;
  bgCanvas.height = CONFIG.WORLD_HEIGHT;
  bgCtx = bgCanvas.getContext('2d');
  return bgCanvas;
}

export type BackgroundMode = boolean | 'stage1' | 'stage2' | 'stage3' | 'liberated';

function drawMarineSeagullEmblem(
  bctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  color: string
): void {
  bctx.save();
  bctx.translate(cx, cy);
  bctx.scale(scale, scale);
  bctx.fillStyle = color;
  bctx.beginPath();
  bctx.moveTo(0, -10);
  bctx.quadraticCurveTo(16, -24, 30, -12);
  bctx.quadraticCurveTo(16, -8, 6, 4);
  bctx.lineTo(0, 12);
  bctx.lineTo(-6, 4);
  bctx.quadraticCurveTo(-16, -8, -30, -12);
  bctx.quadraticCurveTo(-16, -24, 0, -10);
  bctx.closePath();
  bctx.fill();
  bctx.restore();
}

function drawCompassRose(bctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  bctx.save();
  bctx.translate(cx, cy);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const len = i % 2 === 0 ? radius : radius * 0.62;
    bctx.save();
    bctx.rotate(a);
    bctx.fillStyle = i % 2 === 0 ? 'rgba(200, 169, 81, 0.22)' : 'rgba(144, 202, 249, 0.14)';
    bctx.beginPath();
    bctx.moveTo(len, 0);
    bctx.lineTo(0, -14);
    bctx.lineTo(0, 0);
    bctx.closePath();
    bctx.fill();
    bctx.fillStyle = 'rgba(20, 24, 34, 0.22)';
    bctx.beginPath();
    bctx.moveTo(len, 0);
    bctx.lineTo(0, 14);
    bctx.lineTo(0, 0);
    bctx.closePath();
    bctx.fill();
    bctx.restore();
  }
  bctx.restore();
}

function drawBuggyCircusEmblem(bctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  bctx.save();
  bctx.translate(cx, cy);
  bctx.strokeStyle = 'rgba(245, 197, 24, 0.28)';
  bctx.lineWidth = 4;
  bctx.beginPath();
  bctx.moveTo(-78, -52);
  bctx.lineTo(78, 52);
  bctx.moveTo(78, -52);
  bctx.lineTo(-78, 52);
  bctx.stroke();

  bctx.fillStyle = 'rgba(244, 228, 193, 0.18)';
  bctx.beginPath();
  bctx.arc(0, 0, 44, 0, Math.PI * 2);
  bctx.fill();

  bctx.fillStyle = 'rgba(211, 47, 47, 0.34)';
  bctx.beginPath();
  bctx.arc(0, 4, 15, 0, Math.PI * 2);
  bctx.fill();
  bctx.restore();
}

export function prerenderBackground(mode: BackgroundMode = 'stage1'): void {
  ensureBgCanvas();
  if (!bgCtx) return;

  const resolved: 'stage1' | 'stage2' | 'stage3' | 'liberated' =
    mode === true ? 'liberated' : mode === false ? 'stage1' : mode;
  const mx = CONFIG.ARENA_MARGIN_X;
  const my = CONFIG.ARENA_MARGIN_Y;

  if (resolved === 'stage3') {
    const cx = CONFIG.WORLD_WIDTH / 2;
    const cy = CONFIG.WORLD_HEIGHT / 2;

    // Fondo marino crepuscular alrededor del puerto de Orange Town
    bgCtx.fillStyle = '#0D2238';
    bgCtx.fillRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    bgCtx.strokeStyle = 'rgba(100, 181, 246, 0.14)';
    bgCtx.lineWidth = 3;
    for (let wy = 18; wy < CONFIG.WORLD_HEIGHT; wy += 36) {
      for (let wx = 20; wx < CONFIG.WORLD_WIDTH; wx += 95) {
        if (wx > mx - 10 && wx < CONFIG.WORLD_WIDTH - mx + 10 && wy > my - 10 && wy < CONFIG.WORLD_HEIGHT - my + 10) continue;
        bgCtx.beginPath();
        bgCtx.arc(wx, wy, 18, 0.15 * Math.PI, 0.85 * Math.PI);
        bgCtx.stroke();
      }
    }

    // Pavimento adoquinado oscuro del puerto circense (alto contraste para telégrafos)
    bgCtx.fillStyle = '#2A2333';
    bgCtx.fillRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, CONFIG.WORLD_HEIGHT - my * 2);

    const tileW = 88;
    const tileH = 56;
    for (let y = my; y < CONFIG.WORLD_HEIGHT - my; y += tileH) {
      const rowIdx = Math.round(y / tileH);
      const offset = rowIdx % 2 === 0 ? 0 : tileW / 2;
      for (let x = mx - tileW; x < CONFIG.WORLD_WIDTH - mx + tileW; x += tileW) {
        const px = Math.max(mx, x + offset + 2);
        const pw = Math.min(CONFIG.WORLD_WIDTH - mx, x + offset + tileW - 2) - px;
        if (pw <= 4) continue;
        const hash = Math.abs(Math.sin((x + 11) * 14.31 + (y + 23) * 63.17));
        bgCtx.fillStyle = hash < 0.35 ? '#332B3E' : hash < 0.72 ? '#292232' : '#2E2738';
        bgCtx.fillRect(px, y + 2, pw, Math.min(tileH - 4, CONFIG.WORLD_HEIGHT - my - (y + 2)));
      }
    }

    // Pista central del Circo de Buggy (segmentos alternos carmesí/crema sutiles)
    const ringR = 320;
    const slices = 16;
    for (let s = 0; s < slices; s++) {
      const a0 = (s / slices) * Math.PI * 2;
      const a1 = ((s + 1) / slices) * Math.PI * 2;
      bgCtx.fillStyle = s % 2 === 0 ? 'rgba(183, 28, 28, 0.22)' : 'rgba(244, 228, 193, 0.10)';
      bgCtx.beginPath();
      bgCtx.moveTo(cx, cy);
      bgCtx.arc(cx, cy, ringR, a0, a1);
      bgCtx.closePath();
      bgCtx.fill();
    }

    // Anillos dorados de la pista circense + emblema de Buggy
    bgCtx.strokeStyle = 'rgba(245, 197, 24, 0.42)';
    bgCtx.lineWidth = 7;
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, ringR, 0, Math.PI * 2);
    bgCtx.stroke();

    bgCtx.strokeStyle = 'rgba(211, 47, 47, 0.40)';
    bgCtx.lineWidth = 4;
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, 190, 0, Math.PI * 2);
    bgCtx.stroke();
    drawBuggyCircusEmblem(bgCtx, cx, cy);

    // Focos cálidos de escenario en las esquinas interiores
    const spots = [
      [mx + 220, my + 180],
      [CONFIG.WORLD_WIDTH - mx - 220, my + 180],
      [mx + 220, CONFIG.WORLD_HEIGHT - my - 180],
      [CONFIG.WORLD_WIDTH - mx - 220, CONFIG.WORLD_HEIGHT - my - 180]
    ];
    spots.forEach(([sx, sy]) => {
      if (!bgCtx) return;
      const sg = bgCtx.createRadialGradient(sx, sy, 12, sx, sy, 165);
      sg.addColorStop(0, 'rgba(255, 213, 79, 0.14)');
      sg.addColorStop(1, 'rgba(255, 213, 79, 0)');
      bgCtx.fillStyle = sg;
      bgCtx.beginPath();
      bgCtx.arc(sx, sy, 165, 0, Math.PI * 2);
      bgCtx.fill();
    });

    // Borde de muelle de madera en todo el perímetro
    bgCtx.strokeStyle = '#6D4C2D';
    bgCtx.lineWidth = 18;
    bgCtx.strokeRect(mx - 6, my - 6, CONFIG.WORLD_WIDTH - mx * 2 + 12, CONFIG.WORLD_HEIGHT - my * 2 + 12);
    bgCtx.strokeStyle = '#F5C518';
    bgCtx.lineWidth = 4;
    bgCtx.strokeRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, CONFIG.WORLD_HEIGHT - my * 2);

    // Carpas rayadas en las 4 esquinas fuera del área central
    const cornerTents = [
      [mx + 44, my + 44],
      [CONFIG.WORLD_WIDTH - mx - 44, my + 44],
      [mx + 44, CONFIG.WORLD_HEIGHT - my - 44],
      [CONFIG.WORLD_WIDTH - mx - 44, CONFIG.WORLD_HEIGHT - my - 44]
    ];
    cornerTents.forEach(([tx, ty]) => {
      if (!bgCtx) return;
      for (let tSlice = 0; tSlice < 8; tSlice++) {
        bgCtx.fillStyle = tSlice % 2 === 0 ? '#C62828' : '#F4E4C1';
        bgCtx.beginPath();
        bgCtx.moveTo(tx, ty);
        bgCtx.arc(tx, ty, 52, (tSlice / 8) * Math.PI * 2, ((tSlice + 1) / 8) * Math.PI * 2);
        bgCtx.closePath();
        bgCtx.fill();
      }
      bgCtx.strokeStyle = '#1A120B';
      bgCtx.lineWidth = 3;
      bgCtx.beginPath();
      bgCtx.arc(tx, ty, 52, 0, Math.PI * 2);
      bgCtx.stroke();
      bgCtx.fillStyle = '#F5C518';
      bgCtx.beginPath();
      bgCtx.arc(tx, ty, 9, 0, Math.PI * 2);
      bgCtx.fill();
    });

    // Banderines de feria y cajas de pólvora en bordes
    const pennantColors = ['#EF5350', '#FFD54F', '#29B6F6', '#F4E4C1'];
    let pIdx = 0;
    for (let px = mx + 120; px < CONFIG.WORLD_WIDTH - mx - 120; px += 46) {
      bgCtx.fillStyle = pennantColors[pIdx % pennantColors.length];
      bgCtx.beginPath();
      bgCtx.moveTo(px - 14, my - 4);
      bgCtx.lineTo(px + 14, my - 4);
      bgCtx.lineTo(px, my + 16);
      bgCtx.closePath();
      bgCtx.fill();

      bgCtx.fillStyle = pennantColors[(pIdx + 2) % pennantColors.length];
      bgCtx.beginPath();
      bgCtx.moveTo(px - 14, CONFIG.WORLD_HEIGHT - my + 4);
      bgCtx.lineTo(px + 14, CONFIG.WORLD_HEIGHT - my + 4);
      bgCtx.lineTo(px, CONFIG.WORLD_HEIGHT - my - 16);
      bgCtx.closePath();
      bgCtx.fill();
      pIdx++;
    }

    const circusProps = [
      { x: 260, y: 122, t: 'powder' }, { x: 820, y: 120, t: 'barrel' }, { x: 1740, y: 120, t: 'powder' },
      { x: 2300, y: 122, t: 'barrel' }, { x: 260, y: 1316, t: 'barrel' }, { x: 960, y: 1318, t: 'powder' },
      { x: 1620, y: 1318, t: 'barrel' }, { x: 2300, y: 1316, t: 'powder' }
    ];
    circusProps.forEach((d) => {
      if (!bgCtx) return;
      if (d.t === 'powder') {
        bgCtx.fillStyle = '#B71C1C';
        bgCtx.strokeStyle = '#1A120B';
        bgCtx.lineWidth = 2.5;
        bgCtx.fillRect(d.x - 18, d.y - 18, 36, 36);
        bgCtx.strokeRect(d.x - 18, d.y - 18, 36, 36);
        bgCtx.fillStyle = '#F5C518';
        bgCtx.beginPath();
        bgCtx.arc(d.x, d.y, 6, 0, Math.PI * 2);
        bgCtx.fill();
      } else {
        bgCtx.fillStyle = '#5D4037';
        bgCtx.strokeStyle = '#1A120B';
        bgCtx.lineWidth = 2.5;
        bgCtx.beginPath();
        bgCtx.arc(d.x, d.y, 16, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.stroke();
      }
    });
    return;
  }

  if (resolved === 'stage2' || resolved === 'liberated') {
    const isLib = resolved === 'liberated';
    // Base stone/courtyard palette (cooler Marine fortress slate/concrete)
    bgCtx.fillStyle = isLib ? '#4E5866' : '#353E49';
    bgCtx.fillRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);

    const tileW = 96;
    const tileH = 64;
    for (let y = 0; y < CONFIG.WORLD_HEIGHT; y += tileH) {
      const rowIdx = Math.round(y / tileH);
      const offset = rowIdx % 2 === 0 ? 0 : tileW / 2;
      for (let x = -tileW; x < CONFIG.WORLD_WIDTH + tileW; x += tileW) {
        const hash = Math.abs(Math.sin((x + 17) * 12.9898 + (y + 31) * 78.233));
        if (hash < 0.34) {
          bgCtx.fillStyle = isLib ? '#576373' : '#3C4653';
        } else if (hash < 0.72) {
          bgCtx.fillStyle = isLib ? '#4C5664' : '#333C48';
        } else {
          bgCtx.fillStyle = isLib ? '#525C6B' : '#38414D';
        }
        bgCtx.fillRect(x + offset + 2, y + 2, tileW - 4, tileH - 4);

        // Subtle weathering & hairline cracks on select slabs
        if (hash > 0.82) {
          bgCtx.strokeStyle = 'rgba(18, 24, 32, 0.35)';
          bgCtx.lineWidth = 1.5;
          bgCtx.beginPath();
          bgCtx.moveTo(x + offset + 18, y + 14);
          bgCtx.lineTo(x + offset + 42, y + 28);
          bgCtx.lineTo(x + offset + 56, y + 24);
          bgCtx.stroke();
        }
      }
    }

    // Worn drill-ground central concrete apron & patrol lane markings
    const cx = CONFIG.WORLD_WIDTH / 2;
    const cy = CONFIG.WORLD_HEIGHT / 2;

    bgCtx.fillStyle = isLib ? 'rgba(92, 106, 122, 0.32)' : 'rgba(64, 76, 92, 0.38)';
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, 340, 0, Math.PI * 2);
    bgCtx.fill();

    // Faint courtyard patrol border lines (well inside playable area, high contrast)
    bgCtx.strokeStyle = 'rgba(207, 216, 220, 0.14)';
    bgCtx.lineWidth = 4;
    bgCtx.setLineDash([28, 18]);
    bgCtx.strokeRect(mx + 120, my + 100, CONFIG.WORLD_WIDTH - (mx + 120) * 2, CONFIG.WORLD_HEIGHT - (my + 100) * 2);
    bgCtx.setLineDash([]);

    // Cardinal parade walkways leading toward center
    bgCtx.strokeStyle = 'rgba(144, 202, 249, 0.14)';
    bgCtx.lineWidth = 3;
    bgCtx.beginPath();
    bgCtx.moveTo(mx, cy - 55); bgCtx.lineTo(cx - 335, cy - 55);
    bgCtx.moveTo(mx, cy + 55); bgCtx.lineTo(cx - 335, cy + 55);
    bgCtx.moveTo(cx + 335, cy - 55); bgCtx.lineTo(CONFIG.WORLD_WIDTH - mx, cy - 55);
    bgCtx.moveTo(cx + 335, cy + 55); bgCtx.lineTo(CONFIG.WORLD_WIDTH - mx, cy + 55);
    bgCtx.moveTo(cx - 55, my); bgCtx.lineTo(cx - 55, cy - 335);
    bgCtx.moveTo(cx + 55, my); bgCtx.lineTo(cx + 55, cy - 335);
    bgCtx.moveTo(cx - 55, cy + 335); bgCtx.lineTo(cx - 55, CONFIG.WORLD_HEIGHT - my);
    bgCtx.moveTo(cx + 55, cy + 335); bgCtx.lineTo(cx + 55, CONFIG.WORLD_HEIGHT - my);
    bgCtx.stroke();

    // Central Marine crest & brass trim circle
    bgCtx.strokeStyle = 'rgba(144, 202, 249, 0.25)';
    bgCtx.lineWidth = 6;
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, 250, 0, Math.PI * 2);
    bgCtx.stroke();
    bgCtx.strokeStyle = 'rgba(200, 169, 81, 0.28)';
    bgCtx.lineWidth = 3;
    bgCtx.beginPath();
    bgCtx.arc(cx, cy, 175, 0, Math.PI * 2);
    bgCtx.stroke();
    drawMarineSeagullEmblem(bgCtx, cx, cy, 2.5, 'rgba(144, 202, 249, 0.16)');

    // Perimeter cast shadows from fortress walls onto courtyard rim
    const shadowGradTop = bgCtx.createLinearGradient(0, my, 0, my + 48);
    shadowGradTop.addColorStop(0, 'rgba(10, 16, 24, 0.45)');
    shadowGradTop.addColorStop(1, 'rgba(10, 16, 24, 0)');
    bgCtx.fillStyle = shadowGradTop;
    bgCtx.fillRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, 48);

    const shadowGradLeft = bgCtx.createLinearGradient(mx, 0, mx + 42, 0);
    shadowGradLeft.addColorStop(0, 'rgba(10, 16, 24, 0.38)');
    shadowGradLeft.addColorStop(1, 'rgba(10, 16, 24, 0)');
    bgCtx.fillStyle = shadowGradLeft;
    bgCtx.fillRect(mx, my, 42, CONFIG.WORLD_HEIGHT - my * 2);

    // Perimeter Marine Base Props (tucked strictly near edges/corners so lanes stay wide open)
    const perimeterProps = [
      { x: 145, y: 128, t: 'crate' }, { x: 192, y: 125, t: 'barrel' }, { x: 140, y: 175, t: 'barrel' },
      { x: 460, y: 118, t: 'rack' },  { x: 920, y: 118, t: 'crate' },  { x: 1640, y: 118, t: 'rack' },
      { x: 2380, y: 128, t: 'crate' }, { x: 2425, y: 132, t: 'crate' }, { x: 2410, y: 178, t: 'barrel' },
      { x: 142, y: 1308, t: 'barrel' }, { x: 188, y: 1312, t: 'crate' }, { x: 640, y: 1316, t: 'rack' },
      { x: 1920, y: 1316, t: 'rack' }, { x: 2385, y: 1308, t: 'crate' }, { x: 2428, y: 1272, t: 'barrel' },
      { x: 132, y: 510, t: 'ammo' }, { x: 132, y: 930, t: 'crate' },
      { x: 2426, y: 510, t: 'crate' }, { x: 2426, y: 930, t: 'ammo' }
    ];

    perimeterProps.forEach((d) => {
      if (!bgCtx) return;
      bgCtx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      bgCtx.beginPath();
      bgCtx.ellipse(d.x + 3, d.y + 6, 22, 12, 0, 0, Math.PI * 2);
      bgCtx.fill();

      if (d.t === 'crate') {
        bgCtx.fillStyle = '#795548';
        bgCtx.strokeStyle = '#261810';
        bgCtx.lineWidth = 2.5;
        bgCtx.fillRect(d.x - 18, d.y - 18, 36, 36);
        bgCtx.strokeRect(d.x - 18, d.y - 18, 36, 36);
        bgCtx.fillStyle = '#1565C0';
        bgCtx.fillRect(d.x - 16, d.y - 4, 32, 8);
      } else if (d.t === 'barrel') {
        bgCtx.fillStyle = '#5D4037';
        bgCtx.strokeStyle = '#1B110B';
        bgCtx.lineWidth = 2.5;
        bgCtx.beginPath();
        bgCtx.arc(d.x, d.y, 16, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.stroke();
        bgCtx.strokeStyle = '#90A4AE';
        bgCtx.lineWidth = 2;
        bgCtx.beginPath();
        bgCtx.arc(d.x, d.y, 11, 0, Math.PI * 2);
        bgCtx.stroke();
      } else if (d.t === 'rack') {
        // Weapon/ammunition rack
        bgCtx.fillStyle = '#4E342E';
        bgCtx.strokeStyle = '#1C110B';
        bgCtx.lineWidth = 2;
        bgCtx.fillRect(d.x - 30, d.y - 10, 60, 20);
        bgCtx.strokeRect(d.x - 30, d.y - 10, 60, 20);
        bgCtx.strokeStyle = '#CFD8DC';
        bgCtx.lineWidth = 3;
        for (let w = -20; w <= 20; w += 10) {
          bgCtx.beginPath();
          bgCtx.moveTo(d.x + w, d.y - 14);
          bgCtx.lineTo(d.x + w, d.y + 12);
          bgCtx.stroke();
        }
      } else if (d.t === 'ammo') {
        // Cannonball pyramid stack
        const coords = [[-9, 5], [0, 5], [9, 5], [-4.5, -3], [4.5, -3], [0, -10]];
        coords.forEach(([ox, oy]) => {
          if (!bgCtx) return;
          bgCtx.fillStyle = '#263238';
          bgCtx.strokeStyle = '#0D1317';
          bgCtx.lineWidth = 1.5;
          bgCtx.beginPath();
          bgCtx.arc(d.x + ox, d.y + oy, 6, 0, Math.PI * 2);
          bgCtx.fill();
          bgCtx.stroke();
        });
      }
    });

    // Fortress Stone Masonry Walls
    bgCtx.fillStyle = '#262E38';
    bgCtx.fillRect(0, 0, CONFIG.WORLD_WIDTH, my);
    bgCtx.fillRect(0, CONFIG.WORLD_HEIGHT - my, CONFIG.WORLD_WIDTH, my);
    bgCtx.fillRect(0, 0, mx, CONFIG.WORLD_HEIGHT);
    bgCtx.fillRect(CONFIG.WORLD_WIDTH - mx, 0, mx, CONFIG.WORLD_HEIGHT);

    // Wall block lines & battlements
    bgCtx.strokeStyle = '#181E26';
    bgCtx.lineWidth = 2;
    for (let x = 0; x < CONFIG.WORLD_WIDTH; x += 64) {
      bgCtx.strokeRect(x, 8, 64, my - 14);
      bgCtx.strokeRect(x, CONFIG.WORLD_HEIGHT - my + 6, 64, my - 14);
    }
    for (let y = my; y < CONFIG.WORLD_HEIGHT - my; y += 64) {
      bgCtx.strokeRect(8, y, mx - 14, 64);
      bgCtx.strokeRect(CONFIG.WORLD_WIDTH - mx + 6, y, mx - 14, 64);
    }

    // Iron Gates on Cardinal Axes
    bgCtx.fillStyle = '#1E252D';
    bgCtx.strokeStyle = '#90A4AE';
    bgCtx.lineWidth = 3;
    // North & South gates
    bgCtx.fillRect(cx - 70, 12, 140, my - 12);
    bgCtx.strokeRect(cx - 70, 12, 140, my - 12);
    bgCtx.fillRect(cx - 70, CONFIG.WORLD_HEIGHT - my, 140, my - 12);
    bgCtx.strokeRect(cx - 70, CONFIG.WORLD_HEIGHT - my, 140, my - 12);
    for (let gx = cx - 54; gx <= cx + 54; gx += 18) {
      bgCtx.beginPath();
      bgCtx.moveTo(gx, 14); bgCtx.lineTo(gx, my);
      bgCtx.moveTo(gx, CONFIG.WORLD_HEIGHT - my); bgCtx.lineTo(gx, CONFIG.WORLD_HEIGHT - 14);
      bgCtx.stroke();
    }

    // Courtyard rim trim + Iron Bollards along perimeter corners/gates
    bgCtx.strokeStyle = '#78909C';
    bgCtx.lineWidth = 6;
    bgCtx.strokeRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, CONFIG.WORLD_HEIGHT - my * 2);

    const bollards = [
      [cx - 88, my + 8], [cx + 88, my + 8],
      [cx - 88, CONFIG.WORLD_HEIGHT - my - 8], [cx + 88, CONFIG.WORLD_HEIGHT - my - 8],
      [mx + 8, cy - 88], [mx + 8, cy + 88],
      [CONFIG.WORLD_WIDTH - mx - 8, cy - 88], [CONFIG.WORLD_WIDTH - mx - 8, cy + 88]
    ];
    bollards.forEach(([bx, by]) => {
      if (!bgCtx) return;
      bgCtx.fillStyle = '#37474F';
      bgCtx.strokeStyle = '#0D1317';
      bgCtx.lineWidth = 2.5;
      bgCtx.beginPath();
      bgCtx.arc(bx, by, 9, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.stroke();
      bgCtx.fillStyle = '#CFD8DC';
      bgCtx.beginPath();
      bgCtx.arc(bx - 2, by - 2, 3, 0, Math.PI * 2);
      bgCtx.fill();
    });

    // Marine Banners & Seagull Emblems on Fortress Walls
    for (let x = 240; x < CONFIG.WORLD_WIDTH - 240; x += 420) {
      if (Math.abs(x + 48 - cx) < 130) continue;
      bgCtx.fillStyle = '#ECEFF1';
      bgCtx.fillRect(x, 10, 96, 56);
      bgCtx.strokeStyle = '#1565C0';
      bgCtx.lineWidth = 3;
      bgCtx.strokeRect(x, 10, 96, 56);
      bgCtx.fillStyle = '#1565C0';
      bgCtx.fillRect(x, 10, 96, 12);
      bgCtx.fillRect(x, 54, 96, 12);
      drawMarineSeagullEmblem(bgCtx, x + 48, 39, 0.72, '#1565C0');
    }

    // Corner fortress cannons & spotlight floor cones
    const corners = [
      [mx + 22, my + 22, Math.PI * 0.25],
      [CONFIG.WORLD_WIDTH - mx - 22, my + 22, Math.PI * 0.75],
      [mx + 22, CONFIG.WORLD_HEIGHT - my - 22, -Math.PI * 0.25],
      [CONFIG.WORLD_WIDTH - mx - 22, CONFIG.WORLD_HEIGHT - my - 22, -Math.PI * 0.75]
    ];
    corners.forEach(([kx, ky, ang]) => {
      if (!bgCtx) return;
      const beam = bgCtx.createRadialGradient(kx, ky, 10, kx + Math.cos(ang) * 160, ky + Math.sin(ang) * 160, 210);
      beam.addColorStop(0, isLib ? 'rgba(255, 213, 79, 0.16)' : 'rgba(144, 202, 249, 0.13)');
      beam.addColorStop(1, 'rgba(144, 202, 249, 0)');
      bgCtx.fillStyle = beam;
      bgCtx.beginPath();
      bgCtx.arc(kx + Math.cos(ang) * 110, ky + Math.sin(ang) * 110, 175, 0, Math.PI * 2);
      bgCtx.fill();

      bgCtx.save();
      bgCtx.translate(kx, ky);
      bgCtx.rotate(ang);
      bgCtx.fillStyle = '#1E252D';
      bgCtx.strokeStyle = '#CFD8DC';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath();
      bgCtx.roundRect(-8, -9, 32, 18, 5);
      bgCtx.fill();
      bgCtx.stroke();
      bgCtx.restore();
    });
    return;
  }

  // Stage 1 (Waves 1–5): Plaza Portuaria de Shells Town enriquecida
  const cx1 = CONFIG.WORLD_WIDTH / 2;
  const cy1 = CONFIG.WORLD_HEIGHT / 2;
  bgCtx.fillStyle = '#0F2942';
  bgCtx.fillRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);

  bgCtx.fillStyle = '#3B3B44';
  bgCtx.fillRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, CONFIG.WORLD_HEIGHT - my * 2);

  const tileW = 80, tileH = 50;
  for (let y = my; y < CONFIG.WORLD_HEIGHT - my; y += tileH) {
    const rowIdx = Math.round(y / tileH);
    const offset = rowIdx % 2 === 0 ? 0 : tileW / 2;
    for (let x = mx - tileW; x < CONFIG.WORLD_WIDTH - mx + tileW; x += tileW) {
      const px = Math.max(mx, x + offset + 2);
      const pw = Math.min(CONFIG.WORLD_WIDTH - mx, x + offset + tileW - 2) - px;
      if (pw <= 4) continue;
      const hash = Math.abs(Math.sin((x + 7) * 12.9898 + (y + 19) * 78.233));
      bgCtx.fillStyle = hash < 0.34 ? '#474751' : hash < 0.72 ? '#3B3B43' : '#41414B';
      bgCtx.fillRect(px, y + 2, pw, Math.min(tileH - 4, CONFIG.WORLD_HEIGHT - my - (y + 2)));
    }
  }

  // Rosa de los vientos en la plaza central
  bgCtx.fillStyle = 'rgba(200, 169, 81, 0.08)';
  bgCtx.beginPath();
  bgCtx.arc(cx1, cy1, 260, 0, Math.PI * 2);
  bgCtx.fill();
  bgCtx.strokeStyle = 'rgba(200, 169, 81, 0.42)';
  bgCtx.lineWidth = 6;
  bgCtx.beginPath();
  bgCtx.arc(cx1, cy1, 225, 0, Math.PI * 2);
  bgCtx.stroke();
  bgCtx.strokeStyle = 'rgba(244, 228, 193, 0.16)';
  bgCtx.lineWidth = 2.5;
  bgCtx.beginPath();
  bgCtx.arc(cx1, cy1, 165, 0, Math.PI * 2);
  bgCtx.stroke();
  drawCompassRose(bgCtx, cx1, cy1, 155);

  // Caminos empedrados cardinales hacia la plaza
  bgCtx.strokeStyle = 'rgba(200, 169, 81, 0.18)';
  bgCtx.lineWidth = 3;
  bgCtx.beginPath();
  bgCtx.moveTo(mx, cy1 - 48); bgCtx.lineTo(cx1 - 225, cy1 - 48);
  bgCtx.moveTo(mx, cy1 + 48); bgCtx.lineTo(cx1 - 225, cy1 + 48);
  bgCtx.moveTo(cx1 + 225, cy1 - 48); bgCtx.lineTo(CONFIG.WORLD_WIDTH - mx, cy1 - 48);
  bgCtx.moveTo(cx1 + 225, cy1 + 48); bgCtx.lineTo(CONFIG.WORLD_WIDTH - mx, cy1 + 48);
  bgCtx.stroke();

  // Faroles cálidos y toldos de mercado en los bordes (sin invadir la zona central de combate)
  const lanterns = [
    [mx + 140, my + 24], [cx1 - 340, my + 24], [cx1 + 340, my + 24], [CONFIG.WORLD_WIDTH - mx - 140, my + 24],
    [mx + 140, CONFIG.WORLD_HEIGHT - my - 24], [CONFIG.WORLD_WIDTH - mx - 140, CONFIG.WORLD_HEIGHT - my - 24]
  ];
  lanterns.forEach(([lx, ly]) => {
    if (!bgCtx) return;
    const lg = bgCtx.createRadialGradient(lx, ly, 4, lx, ly, 95);
    lg.addColorStop(0, 'rgba(255, 213, 79, 0.24)');
    lg.addColorStop(1, 'rgba(255, 213, 79, 0)');
    bgCtx.fillStyle = lg;
    bgCtx.beginPath();
    bgCtx.arc(lx, ly, 95, 0, Math.PI * 2);
    bgCtx.fill();
  });

  const awnings = [
    { x: 380, y: my + 20 }, { x: 2100, y: my + 20 },
    { x: 460, y: CONFIG.WORLD_HEIGHT - my - 20 }, { x: 2040, y: CONFIG.WORLD_HEIGHT - my - 20 }
  ];
  awnings.forEach((aw) => {
    if (!bgCtx) return;
    for (let s = 0; s < 6; s++) {
      bgCtx.fillStyle = s % 2 === 0 ? '#C62828' : '#F4E4C1';
      bgCtx.fillRect(aw.x - 54 + s * 18, aw.y - 14, 18, 28);
    }
    bgCtx.strokeStyle = '#3A2210';
    bgCtx.lineWidth = 2.5;
    bgCtx.strokeRect(aw.x - 54, aw.y - 14, 108, 28);
  });

  const decorSeed = [
    { x: 220, y: 180, t: 'crate' }, { x: 265, y: 196, t: 'barrel' },
    { x: 920, y: 165, t: 'rock' },  { x: 1640, y: 170, t: 'crate' },
    { x: 2320, y: 205, t: 'barrel' },{ x: 240, y: 1245, t: 'barrel' },
    { x: 980, y: 1275, t: 'crate' },{ x: 1580, y: 1265, t: 'rock' },
    { x: 2280, y: 1235, t: 'crate' },{ x: 640, y: 220, t: 'sign' },
    { x: 1920, y: 1220, t: 'sign' }
  ];

  decorSeed.forEach(d => {
    if (!bgCtx) return;
    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    bgCtx.beginPath();
    bgCtx.ellipse(d.x + 4, d.y + 8, 22, 11, 0, 0, Math.PI * 2);
    bgCtx.fill();

    if (d.t === 'crate') {
      bgCtx.fillStyle = '#8B5A2B';
      bgCtx.strokeStyle = '#3A2210';
      bgCtx.lineWidth = 3;
      bgCtx.fillRect(d.x - 20, d.y - 20, 40, 40);
      bgCtx.strokeRect(d.x - 20, d.y - 20, 40, 40);
      bgCtx.beginPath();
      bgCtx.moveTo(d.x - 20, d.y - 20); bgCtx.lineTo(d.x + 20, d.y + 20);
      bgCtx.stroke();
    } else if (d.t === 'barrel') {
      bgCtx.fillStyle = '#6B4423';
      bgCtx.strokeStyle = '#2A1A0E';
      bgCtx.lineWidth = 3;
      bgCtx.beginPath();
      bgCtx.arc(d.x, d.y, 17, 0, Math.PI * 2);
      bgCtx.fill(); bgCtx.stroke();
      bgCtx.strokeStyle = '#9E9E9E';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath();
      bgCtx.arc(d.x, d.y, 11, 0, Math.PI * 2);
      bgCtx.stroke();
    } else if (d.t === 'rock') {
      bgCtx.fillStyle = '#5A5A66';
      bgCtx.beginPath();
      bgCtx.ellipse(d.x, d.y, 30, 20, 0.2, 0, Math.PI * 2);
      bgCtx.fill();
    } else if (d.t === 'sign') {
      bgCtx.fillStyle = '#4A321F';
      bgCtx.fillRect(d.x - 4, d.y - 24, 8, 48);
      bgCtx.fillStyle = '#F4E4C1';
      bgCtx.fillRect(d.x - 26, d.y - 22, 52, 22);
      bgCtx.strokeStyle = '#7A5600';
      bgCtx.lineWidth = 2;
      bgCtx.strokeRect(d.x - 26, d.y - 22, 52, 22);
    }
  });

  // Tablas de muelle de madera en el perímetro
  bgCtx.fillStyle = '#5C3A21';
  bgCtx.fillRect(0, 0, CONFIG.WORLD_WIDTH, my);
  bgCtx.fillRect(0, CONFIG.WORLD_HEIGHT - my, CONFIG.WORLD_WIDTH, my);
  bgCtx.fillRect(0, 0, mx, CONFIG.WORLD_HEIGHT);
  bgCtx.fillRect(CONFIG.WORLD_WIDTH - mx, 0, mx, CONFIG.WORLD_HEIGHT);

  bgCtx.strokeStyle = 'rgba(34, 18, 8, 0.45)';
  bgCtx.lineWidth = 2;
  for (let px = 0; px < CONFIG.WORLD_WIDTH; px += 48) {
    bgCtx.beginPath();
    bgCtx.moveTo(px, 0); bgCtx.lineTo(px, my);
    bgCtx.moveTo(px, CONFIG.WORLD_HEIGHT - my); bgCtx.lineTo(px, CONFIG.WORLD_HEIGHT);
    bgCtx.stroke();
  }

  bgCtx.strokeStyle = '#C8A951';
  bgCtx.lineWidth = 6;
  bgCtx.strokeRect(mx, my, CONFIG.WORLD_WIDTH - mx * 2, CONFIG.WORLD_HEIGHT - my * 2);

  // Tableros Marine & carteles Wanted en la muralla norte
  for (let x = 220; x < CONFIG.WORLD_WIDTH - 220; x += 380) {
    bgCtx.fillStyle = '#1B3A6B';
    bgCtx.fillRect(x, 12, 95, 48);
    bgCtx.strokeStyle = '#F5C518';
    bgCtx.lineWidth = 2;
    bgCtx.strokeRect(x, 12, 95, 48);
    drawMarineSeagullEmblem(bgCtx, x + 48, 36, 0.62, '#F4E4C1');
  }
}

export function initRendering(): void {
  ensureRenderContext();
  prerenderBackground('stage1');
}

if (typeof document !== 'undefined') {
  prerenderBackground('stage1');
}

// ==========================================================================
// 8. UI & PREVIEWS LIGEROS PARA LOBBY MÓVIL
// ==========================================================================
let showcaseCanvasEl: HTMLCanvasElement | null = null;
let showcaseCtx: CanvasRenderingContext2D | null = null;
let lastShowcaseDrawMs = 0;

export function renderRosterThumbnails(): void {
  if (typeof document === 'undefined') return;
  CHARACTER_LIST.forEach((mod, idx) => {
    const c = document.getElementById(`preview-${mod.id}`) as HTMLCanvasElement | null;
    if (!c) return;
    const pctx = c.getContext('2d');
    if (!pctx) return;
    pctx.clearRect(0, 0, 52, 52);
    pctx.save();
    pctx.translate(26, 29);
    pctx.fillStyle = 'rgba(0,0,0,0.42)';
    pctx.beginPath();
    pctx.ellipse(0, 14, 13, 4.5, 0, 0, Math.PI * 2);
    pctx.fill();
    mod.drawPreview(pctx, 0.7 + idx * 0.4, mod);
    pctx.restore();
  });
}

export function renderCharacterPreviews(timeMs: number, force = false): void {
  if (STATE.screen !== 'select') return;
  if (!force && timeMs - lastShowcaseDrawMs < 62) return;
  lastShowcaseDrawMs = timeMs;

  if (!showcaseCanvasEl || !showcaseCanvasEl.isConnected) {
    showcaseCanvasEl = document.getElementById('showcase-preview-canvas') as HTMLCanvasElement | null;
    showcaseCtx = showcaseCanvasEl ? showcaseCanvasEl.getContext('2d') : null;
  }
  if (!showcaseCanvasEl || !showcaseCtx) return;

  const mod = getCharacterModule(STATE.charId);
  const t = timeMs * 0.004;
  const bob = Math.sin(t) * 1.8;
  const w = showcaseCanvasEl.width;
  const h = showcaseCanvasEl.height;

  showcaseCtx.clearRect(0, 0, w, h);
  showcaseCtx.save();
  showcaseCtx.translate(w / 2, h * 0.54 + bob);
  showcaseCtx.scale(1.32, 1.32);

  showcaseCtx.fillStyle = 'rgba(0,0,0,0.45)';
  showcaseCtx.beginPath();
  showcaseCtx.ellipse(0, 15 - bob, 14, 5, 0, 0, Math.PI * 2);
  showcaseCtx.fill();

  mod.drawPreview(showcaseCtx, t, mod);
  showcaseCtx.restore();
}

// ==========================================================================
// 9. RENDERIZADO: 60 FPS CON CAMARA Y MINIMAPA
// ==========================================================================
export function render(): void {
  if (!ensureRenderContext()) return;
  const bg = ensureBgCanvas();

  ctx.save();

  if (STATE.shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * STATE.shakeIntensity * 2;
    const sy = (Math.random() - 0.5) * STATE.shakeIntensity * 2;
    ctx.translate(sx, sy);
  }

  const charMod = getCharacterModule(STATE.charId);
  const camZoom = charMod.getCameraZoom?.(STATE.player) ?? 1.0;
  const isCamZoomed = Math.abs(camZoom - 1.0) > 0.001;
  if (isCamZoomed) {
    ctx.save();
    ctx.translate(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-CONFIG.WIDTH / 2, -CONFIG.HEIGHT / 2);
  }

  ctx.save();
  ctx.translate(-CAMERA.x, -CAMERA.y);

  if (bg) {
    ctx.drawImage(bg, 0, 0);
  }

  charMod.drawWorldBeforePlayer?.({
    ctx,
    state: STATE,
    player: STATE.player,
    cfg: charMod,
    t: performance.now() * 0.005
  });

  for (let i = 0; i < STATE.enemies.length; i++) {
    const en = STATE.enemies[i];
    if (en.hp <= 0) continue;

    if (!en.isBoss && en.telegraphTimer > 0) {
      const tMax = en.telegraphDuration || 0.4;
      const prog = Math.max(0, Math.min(1, 1 - en.telegraphTimer / tMax));
      const isFlash = prog > 0.85;
      ctx.save();
      if (en.type === 'shooter' || en.type === 'rifleman') {
        const aimLen = en.type === 'rifleman' ? 375 : 285;
        const ex = en.x + Math.cos(en.telegraphAngle) * aimLen;
        const ey = en.y + Math.sin(en.telegraphAngle) * aimLen;
        const cx = en.x + Math.cos(en.telegraphAngle) * (aimLen * prog);
        const cy = en.y + Math.sin(en.telegraphAngle) * (aimLen * prog);
        ctx.strokeStyle = en.type === 'rifleman' ? 'rgba(255, 64, 64, 0.36)' : 'rgba(255, 82, 82, 0.28)';
        ctx.lineWidth = en.type === 'rifleman' ? 4 : 3;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = isFlash
          ? '#FFFFFF'
          : en.type === 'rifleman'
            ? `rgba(255, 82, 82, ${0.55 + prog * 0.45})`
            : `rgba(255, 213, 79, ${0.45 + prog * 0.5})`;
        ctx.lineWidth = isFlash ? 4 : 2.2;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        if (prog > 0.55) {
          ctx.fillStyle = isFlash ? '#FFFFFF' : en.type === 'rifleman' ? '#FF5252' : '#FFD54F';
          ctx.beginPath();
          ctx.arc(en.x + Math.cos(en.telegraphAngle) * 24, en.y + Math.sin(en.telegraphAngle) * 24, 3 + prog * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (en.type === 'vanguard') {
        const slamCx = en.x + Math.cos(en.telegraphAngle) * 24;
        const slamCy = en.y + Math.sin(en.telegraphAngle) * 24;
        ctx.fillStyle = 'rgba(255, 112, 67, 0.16)';
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 138, 101, 0.9)';
        ctx.lineWidth = isFlash ? 3.2 : 2.2;
        ctx.beginPath();
        ctx.arc(slamCx, slamCy, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.5)' : `rgba(255, 112, 67, ${0.24 + prog * 0.34})`;
        ctx.beginPath();
        ctx.arc(slamCx, slamCy, Math.max(8, 70 * prog), 0, Math.PI * 2);
        ctx.fill();
      } else if (en.type === 'swordsman') {
        const halfAng = Math.PI / 3.2;
        const lungeLen = 112;
        ctx.fillStyle = 'rgba(128, 216, 255, 0.14)';
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(128, 216, 255, 0.9)';
        ctx.lineWidth = isFlash ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.arc(en.x, en.y, lungeLen, en.telegraphAngle - halfAng, en.telegraphAngle + halfAng);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.52)' : `rgba(128, 216, 255, ${0.22 + prog * 0.32})`;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.arc(en.x, en.y, Math.max(8, lungeLen * prog), en.telegraphAngle - halfAng, en.telegraphAngle + halfAng);
        ctx.closePath();
        ctx.fill();
      } else if (en.type === 'knife_juggler') {
        const aimLen = 310;
        [-0.22, 0, 0.22].forEach((off) => {
          const ang = en.telegraphAngle + off;
          ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 82, 82, 0.42)';
          ctx.lineWidth = isFlash ? 3.2 : 2.2;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.lineTo(en.x + Math.cos(ang) * aimLen, en.y + Math.sin(ang) * aimLen);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      } else if (en.type === 'acrobat') {
        const laneLen = 135;
        const laneW = 36;
        ctx.translate(en.x, en.y);
        ctx.rotate(en.telegraphAngle);
        ctx.fillStyle = 'rgba(255, 213, 79, 0.16)';
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 213, 79, 0.92)';
        ctx.lineWidth = isFlash ? 3 : 2;
        ctx.fillRect(0, -laneW / 2, laneLen, laneW);
        ctx.strokeRect(0, -laneW / 2, laneLen, laneW);
        ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.5)' : `rgba(255, 193, 7, ${0.25 + prog * 0.35})`;
        ctx.fillRect(0, -laneW / 2, laneLen * prog, laneW);
      } else if (en.type === 'cannon_brute') {
        const tx = Math.max(CONFIG.ARENA_MARGIN_X + 60, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 60, STATE.player.x));
        const ty = Math.max(CONFIG.ARENA_MARGIN_Y + 60, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 60, STATE.player.y));
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 112, 67, 0.85)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255, 87, 34, ${0.15 + prog * 0.25})`;
        ctx.beginPath();
        ctx.arc(tx, ty, 38 * prog + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const halfAng = en.type === 'officer' ? Math.PI / 3 : Math.PI / 3.5;
        ctx.fillStyle = 'rgba(255, 202, 40, 0.14)';
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 160, 0, 0.85)';
        ctx.lineWidth = isFlash ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.arc(en.x, en.y, en.attackRange, en.telegraphAngle - halfAng, en.telegraphAngle + halfAng);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.52)' : `rgba(255, 179, 0, ${0.24 + prog * 0.30})`;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.arc(en.x, en.y, Math.max(4, en.attackRange * prog), en.telegraphAngle - halfAng, en.telegraphAngle + halfAng);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (en.isBoss && en.aiState === 'telegraph') {
      const tMax = en.telegraphMaxTimer || 0.60;
      const prog = Math.max(0, Math.min(1, 1 - en.stateTimer / tMax));
      const isFlash = prog > 0.88;
      ctx.save();
      if (en.type === 'buggy') {
        if (en.telegraphType === 'knife_barrage') {
          const halfA = en.phase === 3 ? 0.58 : 0.44;
          const fanR = 360;
          ctx.fillStyle = 'rgba(239, 83, 80, 0.14)';
          ctx.strokeStyle = isFlash ? '#FFFFFF' : '#FF5252';
          ctx.lineWidth = isFlash ? 3.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, fanR, en.telegraphAngle - halfA, en.telegraphAngle + halfA);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isFlash ? 'rgba(255,255,255,0.45)' : `rgba(255, 82, 82, ${0.2 + prog * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, fanR * prog, en.telegraphAngle - halfA, en.telegraphAngle + halfA);
          ctx.closePath();
          ctx.fill();
        } else if (en.telegraphType === 'buggy_ball') {
          const laneLen = 380;
          const laneW = 44;
          ctx.translate(en.x, en.y);
          ctx.rotate(en.telegraphAngle);
          ctx.fillStyle = 'rgba(211, 47, 47, 0.16)';
          ctx.strokeStyle = isFlash ? '#FFFFFF' : '#FF7043';
          ctx.lineWidth = isFlash ? 3.5 : 2.5;
          ctx.fillRect(0, -laneW / 2, laneLen, laneW);
          ctx.strokeRect(0, -laneW / 2, laneLen, laneW);
          ctx.fillStyle = isFlash ? 'rgba(255,255,255,0.5)' : `rgba(255, 87, 34, ${0.24 + prog * 0.38})`;
          ctx.fillRect(0, -laneW / 2, laneLen * prog, laneW);
        } else if (en.telegraphType === 'bara_split') {
          const auraR = 92;
          ctx.fillStyle = `rgba(79, 195, 247, ${0.14 + prog * 0.22})`;
          ctx.strokeStyle = isFlash ? '#FFFFFF' : '#4FC3F7';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(en.x, en.y, auraR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#FFD54F';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(en.x, en.y, 76 + prog * 28, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (en.type === 'morgan') {
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(144, 202, 249, 0.95)';
        ctx.lineWidth = isFlash ? 4 : 2.8;
        if (en.telegraphType === 'axe_cleave') {
          const cleaveR = 110;
          const halfA = Math.PI / 2.0;
          ctx.fillStyle = 'rgba(21, 101, 192, 0.18)';
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, cleaveR, en.telegraphAngle - halfA, en.telegraphAngle + halfA);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.55)' : `rgba(30, 136, 229, ${0.28 + prog * 0.36})`;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, Math.max(8, cleaveR * prog), en.telegraphAngle - halfA, en.telegraphAngle + halfA);
          ctx.closePath();
          ctx.fill();
        } else if (en.telegraphType === 'axe_shockwave') {
          const laneLen = 420;
          const laneW = 54;
          ctx.translate(en.x, en.y);
          ctx.rotate(en.telegraphAngle);
          ctx.fillStyle = 'rgba(144, 202, 249, 0.15)';
          ctx.fillRect(0, -laneW / 2, laneLen, laneW);
          ctx.strokeRect(0, -laneW / 2, laneLen, laneW);
          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.55)' : `rgba(66, 165, 245, ${0.28 + prog * 0.36})`;
          ctx.fillRect(0, -laneW / 2, laneLen * prog, laneW);
        } else {
          const laneLen = 305;
          const laneW = en.radius * 2.1;
          ctx.translate(en.x, en.y);
          ctx.rotate(en.telegraphAngle);
          ctx.fillStyle = 'rgba(255, 82, 82, 0.16)';
          ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 138, 101, 0.95)';
          ctx.fillRect(0, -laneW / 2, laneLen, laneW);
          ctx.strokeRect(0, -laneW / 2, laneLen, laneW);
          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.55)' : `rgba(255, 82, 82, ${0.28 + prog * 0.38})`;
          ctx.fillRect(0, -laneW / 2, laneLen * prog, laneW);
        }
      } else {
        ctx.strokeStyle = isFlash ? '#FFFFFF' : 'rgba(255, 152, 0, 0.92)';
        ctx.lineWidth = isFlash ? 3.5 : 2.5;
        if (en.telegraphType === 'melee') {
          ctx.fillStyle = 'rgba(255, 111, 0, 0.16)';
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, 70, en.telegraphAngle - Math.PI / 2.2, en.telegraphAngle + Math.PI / 2.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.55)' : `rgba(255, 111, 0, ${0.28 + prog * 0.34})`;
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.arc(en.x, en.y, Math.max(6, 70 * prog), en.telegraphAngle - Math.PI / 2.2, en.telegraphAngle + Math.PI / 2.2);
          ctx.closePath();
          ctx.fill();
        } else {
          const laneLen = 260;
          const laneW = en.radius * 1.4;
          ctx.translate(en.x, en.y);
          ctx.rotate(en.telegraphAngle);
          ctx.fillStyle = 'rgba(255, 111, 0, 0.16)';
          ctx.fillRect(0, -laneW / 2, laneLen, laneW);
          ctx.strokeRect(0, -laneW / 2, laneLen, laneW);

          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.55)' : `rgba(255, 111, 0, ${0.28 + prog * 0.36})`;
          ctx.fillRect(0, -laneW / 2, laneLen * prog, laneW);
        }
      }
      ctx.restore();
    }
  }

  for (let i = 0; i < STATE.pendingStrikes.length; i++) {
    const st = STATE.pendingStrikes[i];
    const prog = Math.max(0, Math.min(1, 1 - (st.timer / st.maxTimer)));
    const isFlash = prog > 0.85;
    ctx.save();
    ctx.translate(st.ox, st.oy);
    ctx.rotate(st.angle);
    ctx.fillStyle = 'rgba(123, 31, 162, 0.14)';
    ctx.strokeStyle = isFlash ? '#FFFFFF' : '#E1BEE7';
    ctx.lineWidth = isFlash ? 3.5 : 2.5;
    ctx.fillRect(0, -st.width / 2, st.length, st.width);
    ctx.strokeRect(0, -st.width / 2, st.length, st.width);

    // Silueta de brazo/mano gigante cargando
    ctx.fillStyle = isFlash ? 'rgba(243, 229, 245, 0.58)' : `rgba(171, 71, 188, ${0.26 + prog * 0.34})`;
    const fillLen = st.length * prog;
    ctx.fillRect(0, -st.width * 0.34, Math.min(fillLen, st.length * 0.72), st.width * 0.68);
    if (prog > 0.45) {
      const palmX = st.length * 0.72;
      const fingerLen = st.length * 0.28 * ((prog - 0.45) / 0.55);
      for (let f = -2; f <= 2; f++) {
        ctx.beginPath();
        ctx.roundRect(palmX, f * (st.width * 0.16) - st.width * 0.06, fingerLen, st.width * 0.12, 8);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  for (let i = 0; i < STATE.hazards.length; i++) {
    const hz = STATE.hazards[i];
    const seed = Math.abs(Math.sin(hz.x * 12.9898 + hz.y * 78.233)) * 1000;
    ctx.save();
    if (hz.type === 'kkg_fissure') {
      const lifeRatio = Math.min(0.95, hz.life / (hz.maxLife || 3.0));
      ctx.globalAlpha = lifeRatio;
      ctx.translate(hz.x, hz.y);
      ctx.rotate(hz.angle || 0);
      const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 105);
      aura.addColorStop(0, 'rgba(255, 23, 68, 0.26)');
      aura.addColorStop(1, 'rgba(255, 23, 68, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 105, 0, Math.PI * 2);
      ctx.fill();

      const segs = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const px = -95 + t * 190;
        const py = s === 0 || s === segs ? 0 : Math.sin(seed + s * 2.7) * 14;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 4;
      for (let b = 0; b < 4; b++) {
        const bx = -55 + b * 36;
        const by = Math.sin(seed + (b + 2) * 2.7) * 10;
        const bAng = (b % 2 === 0 ? 1 : -1) * (0.75 + (b % 3) * 0.25);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(bAng) * 32, by + Math.sin(bAng) * 32);
        ctx.stroke();
        ctx.strokeStyle = '#FF5252';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 4;
      }
    } else if (hz.type === 'zoro_crack_line') {
      ctx.globalAlpha = Math.min(0.88, hz.life * 2);
      const dx = hz.endX - hz.x, dy = hz.endY - hz.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len, ny = dx / len;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        const j = (s === 0 || s === 6) ? 0 : Math.sin(seed + s * 3.1) * 9;
        const px = hz.x + dx * t + nx * j;
        const py = hz.y + dy * t + ny * j;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = '#A5D6A7';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#E8F5E9';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (hz.type === 'zoro_crack') {
      ctx.globalAlpha = Math.min(0.85, hz.life * 2.5);
      const grad = ctx.createRadialGradient(hz.x, hz.y, 4, hz.x, hz.y, hz.radius);
      grad.addColorStop(0, 'rgba(102, 187, 106, 0.45)');
      grad.addColorStop(0.75, 'rgba(46, 125, 50, 0.25)');
      grad.addColorStop(1, 'rgba(46, 125, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#A5D6A7';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (let r = 0; r < 5; r++) {
        const ang = seed * 0.01 + (r / 5) * Math.PI * 2;
        const midR = hz.radius * 0.48;
        const endR = hz.radius * 0.92;
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y);
        ctx.lineTo(hz.x + Math.cos(ang + 0.12) * midR, hz.y + Math.sin(ang + 0.12) * midR);
        ctx.lineTo(hz.x + Math.cos(ang - 0.08) * endR, hz.y + Math.sin(ang - 0.08) * endR);
        ctx.stroke();
      }
    } else if (hz.type === 'usopp_smoke') {
      ctx.globalAlpha = Math.min(0.68, hz.life * 0.42);
      const rot = performance.now() * 0.00045;
      for (let l = 0; l < 5; l++) {
        const ang = rot + seed + (l / 5) * Math.PI * 2;
        const dist = l === 0 ? 0 : hz.radius * 0.38;
        const lx = hz.x + Math.cos(ang) * dist;
        const ly = hz.y + Math.sin(ang) * dist;
        const lr = hz.radius * (l === 0 ? 0.78 : 0.58);
        const smokeGrad = ctx.createRadialGradient(lx, ly, lr * 0.1, lx, ly, lr);
        smokeGrad.addColorStop(0, 'rgba(236, 239, 241, 0.65)');
        smokeGrad.addColorStop(0.55, 'rgba(176, 190, 197, 0.45)');
        smokeGrad.addColorStop(1, 'rgba(176, 190, 197, 0)');
        ctx.fillStyle = smokeGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (hz.type === 'buggy_bomb') {
      const prog = Math.max(0, Math.min(1, 1 - hz.life / (hz.maxLife || 1.0)));
      const flash = prog > 0.78 && Math.floor(performance.now() / 60) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 82, 82, 0.18)';
      ctx.strokeStyle = flash ? '#FFFFFF' : '#FF5252';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 87, 34, ${0.22 + prog * 0.34})`;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, Math.max(8, hz.radius * prog), 0, Math.PI * 2);
      ctx.fill();

      // Bomba caricaturesca en el centro con mecha encendida
      ctx.fillStyle = '#212121';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF5252';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#FFFFFF' : '#FFD54F';
      ctx.beginPath();
      ctx.arc(hz.x + 8, hz.y - 12, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = Math.min(0.45, hz.life * 0.2);
      ctx.fillStyle = hz.type === 'alvida_slow' ? '#E91E63' : '#4FC3F7';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = 0; i < STATE.traps.length; i++) {
    const tr = STATE.traps[i];
    const pulse = 1 + Math.sin(performance.now() * 0.015 + i) * 0.2;
    ctx.save();
    ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, 14 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#D32F2F';
    ctx.strokeStyle = '#FFCDD2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < STATE.berriesDrops.length; i++) {
    const b = STATE.berriesDrops[i];
    ctx.fillStyle = '#F5C518';
    ctx.strokeStyle = '#7A5600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (let i = 0; i < STATE.afterimages.length; i++) {
    const af = STATE.afterimages[i];
    const ratio = Math.max(0, af.life / af.maxLife);
    const r = af.radius || STATE.player.radius;
    ctx.save();
    ctx.translate(af.x, af.y);
    ctx.rotate(af.angle || 0);
    ctx.globalAlpha = ratio * 0.42;
    ctx.fillStyle = af.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.32, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = ratio * 0.55;
    ctx.beginPath();
    ctx.moveTo(-r * 1.85, -r * 0.48);
    ctx.lineTo(-r * 0.45, -r * 0.48);
    ctx.moveTo(-r * 1.65, r * 0.48);
    ctx.lineTo(-r * 0.35, r * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  if (STATE.targetedEnemy && STATE.targetedEnemy.hp > 0) {
    const te = STATE.targetedEnemy;
    const bob = Math.sin(performance.now() * 0.01) * 4;
    ctx.save();
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(te.x, te.y + te.radius * 0.7, te.radius + 8, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F5C518';
    ctx.beginPath();
    ctx.moveTo(te.x, te.y - te.radius - 16 + bob);
    ctx.lineTo(te.x - 8, te.y - te.radius - 28 + bob);
    ctx.lineTo(te.x + 8, te.y - te.radius - 28 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < STATE.enemies.length; i++) {
    drawEnemy(STATE.enemies[i]);
  }

  drawPlayer();

  charMod.drawWorldAfterPlayer?.({
    ctx,
    state: STATE,
    player: STATE.player,
    cfg: charMod,
    t: performance.now() * 0.005
  });

  for (let i = 0; i < STATE.slashEffects.length; i++) {
    drawSlashEffect(STATE.slashEffects[i]);
  }

  for (let i = 0; i < STATE.projectiles.length; i++) {
    const pr = STATE.projectiles[i];
    const baseAlpha = pr.roomStallTimer > 0 ? Math.max(0.25, 1 - pr.roomStallTimer * 0.85) : 1.0;
    if (pr.trail && pr.trail.length > 1) {
      let trailColor = pr.color || '#FFF59D';
      let headW = (pr.radius || 6) * 0.9;
      if (pr.type === 'zoro_air_cut' || pr.type === 'pound_ho_x') {
        trailColor = '#A5D6A7';
        headW = 14;
      } else if (pr.type === 'firebird_star' || pr.type === 'diable_comet') {
        trailColor = '#FF7043';
        headW = 10;
      } else if (pr.type === 'mace_boomerang') {
        trailColor = '#FF5252';
        headW = 16;
      } else if (pr.type === 'kizaru_light_beam') {
        trailColor = '#FFF59D';
        headW = 5;
      } else if (pr.type === 'kizaru_light_orb' || pr.type === 'kizaru_light_orb_heavy' || pr.type === 'kizaru_yasakani_orb') {
        trailColor = '#FFF59D';
        headW = pr.type === 'kizaru_light_orb_heavy' ? 14 : 9;
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = trailColor;
      for (let tIdx = 0; tIdx < pr.trail.length - 1; tIdx++) {
        const p0 = pr.trail[tIdx];
        const p1 = pr.trail[tIdx + 1];
        const frac = (tIdx + 1) / pr.trail.length;
        ctx.globalAlpha = baseAlpha * frac * 0.45;
        ctx.lineWidth = Math.max(1.5, headW * frac);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    if (pr.type === 'mace_boomerang') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(performance.now() * 0.02);
      ctx.fillStyle = '#2A2A30';
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * pr.radius, Math.sin(a) * pr.radius);
        ctx.lineTo(Math.cos(a) * (pr.radius + 7), Math.sin(a) * (pr.radius + 7));
        ctx.stroke();
      }
    } else if (pr.type === 'firebird_star') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = '#FF5722';
      ctx.strokeStyle = '#FFEB3B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-10, -16);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (pr.type === 'pound_ho_x') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rotation || 0);
      ctx.strokeStyle = '#66BB6A';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-24, -24); ctx.lineTo(24, 24);
      ctx.moveTo(-24, 24);  ctx.lineTo(24, -24);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    } else if (pr.type === 'zoro_air_cut') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      drawTaperedCrescent(22, -Math.PI * 0.44, Math.PI * 0.44, 9, '#66BB6A', '#FFFFFF');
    } else if (pr.type === 'diable_comet') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = 'rgba(255, 87, 34, 0.38)';
      ctx.beginPath();
      ctx.ellipse(-5, 0, 26, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      // Estela en medialuna de patada ardiente
      drawTaperedCrescent(15, -Math.PI * 0.55, Math.PI * 0.55, 8, '#FF5722', '#FFEB3B');
      ctx.fillStyle = '#FF7043';
      ctx.beginPath();
      ctx.ellipse(2, 0, 15, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF59D';
      ctx.beginPath();
      ctx.ellipse(6, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.type === 'morgan_wind_blade') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      drawTaperedCrescent(28, -Math.PI * 0.52, Math.PI * 0.52, 12, '#1E88E5', '#ECEFF1');
    } else if (pr.type === 'rifle_shot') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = '#FF5252';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-10, -3.5, 20, 7, 3.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF59D';
      ctx.beginPath();
      ctx.arc(5, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.type === 'kizaru_light_orb' || pr.type === 'kizaru_light_orb_heavy' || pr.type === 'kizaru_yasakani_orb') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      const r = pr.radius || 10;
      const isHeavy = pr.type === 'kizaru_light_orb_heavy';
      ctx.fillStyle = isHeavy ? 'rgba(255, 213, 79, 0.38)' : 'rgba(255, 245, 157, 0.34)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isHeavy ? '#FFD54F' : '#FFF59D';
      ctx.strokeStyle = '#FBC02D';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r * 0.15, 0, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.type === 'kizaru_light_beam') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = 'rgba(255, 213, 79, 0.36)';
      ctx.beginPath();
      ctx.roundRect(-24, -4.2, 48, 8.4, 4.2);
      ctx.fill();
      ctx.fillStyle = '#FFF59D';
      ctx.beginPath();
      ctx.roundRect(-22, -2.3, 44, 4.6, 2.3);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(-20, -1.1, 41, 2.2, 1.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, 0, 3.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.type === 'buggy_knife_proj') {
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rotation ?? Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = '#ECEFF1';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-4, -4.5);
      ctx.lineTo(-4, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#D32F2F';
      ctx.fillRect(-10, -2.2, 6, 4.4);
    } else if (pr.type === 'buggy_ball_proj') {
      ctx.translate(pr.x, pr.y);
      ctx.fillStyle = '#D32F2F';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-2, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.arc(9, -11, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = pr.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = 0; i < STATE.particles.length; i++) {
    const pt: any = STATE.particles[i];
    if (!pt.active) continue;
    const lifeRatio = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = lifeRatio * (pt.alpha != null ? pt.alpha : 1);
    if (pt.shape === 'spark') {
      const ang = Math.atan2(pt.vy, pt.vx);
      const spd = Math.hypot(pt.vx, pt.vy);
      const streakLen = Math.min(20, Math.max(5.5, spd * 0.055)) * lifeRatio;
      const halfW = Math.max(1.2, pt.size * 0.42 * lifeRatio);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(ang);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.moveTo(streakLen, 0);
      ctx.lineTo(0, -halfW);
      ctx.lineTo(-streakLen * 0.7, 0);
      ctx.lineTo(0, halfW);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (0.72 + 0.28 * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = 0; i < STATE.floatingTexts.length; i++) {
    const ft: any = STATE.floatingTexts[i];
    if (!ft.active) continue;
    const elapsed = ft.maxLife - ft.life;
    const popT = Math.min(1, elapsed / 0.14);
    const popScale = ft.isCrit ? easeOutBack(popT) : (0.78 + 0.22 * easeOutQuart(popT));
    ctx.save();
    ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
    ctx.translate(ft.x, ft.y);
    if (ft.tiltAngle) ctx.rotate(ft.tiltAngle);
    ctx.scale(popScale, popScale);
    ctx.font = `900 ${Math.round(18 * ft.scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = ft.isCrit ? 5 : 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(ft.text, 0, 0);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
  }

  ctx.restore(); // Fin de cámara
  if (isCamZoomed) {
    ctx.restore();
  }

  // Stage 2 / Stage 3 atmospheric tint & drifting motes
  if (STATE.wave >= 11) {
    const nowSec = performance.now() * 0.001;
    ctx.save();
    const circusTint = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    circusTint.addColorStop(0, 'rgba(34, 14, 46, 0.16)');
    circusTint.addColorStop(0.55, 'rgba(20, 12, 30, 0.02)');
    circusTint.addColorStop(1, 'rgba(18, 10, 26, 0.18)');
    ctx.fillStyle = circusTint;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const confettiColors = ['rgba(255, 213, 79, 0.34)', 'rgba(239, 83, 80, 0.30)', 'rgba(79, 195, 247, 0.28)'];
    for (let m = 0; m < 22; m++) {
      const mx = ((m * 157 + nowSec * (32 + (m % 4) * 10)) % (CONFIG.WIDTH + 40)) - 20;
      const my = ((m * 89 + Math.sin(nowSec * 1.1 + m) * 26 + nowSec * 12) % (CONFIG.HEIGHT + 20)) - 10;
      ctx.fillStyle = confettiColors[m % confettiColors.length];
      ctx.beginPath();
      ctx.arc(mx, my, 1.8 + (m % 3) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (STATE.wave >= 6) {
    const nowSec = performance.now() * 0.001;
    ctx.save();
    const skyTint = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    skyTint.addColorStop(0, 'rgba(18, 38, 66, 0.14)');
    skyTint.addColorStop(0.55, 'rgba(20, 32, 48, 0.03)');
    skyTint.addColorStop(1, 'rgba(12, 18, 28, 0.14)');
    ctx.fillStyle = skyTint;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    ctx.fillStyle = 'rgba(220, 235, 250, 0.24)';
    for (let m = 0; m < 18; m++) {
      const mx = ((m * 173 + nowSec * (28 + (m % 4) * 9)) % (CONFIG.WIDTH + 40)) - 20;
      const my = ((m * 97 + Math.sin(nowSec * 0.8 + m) * 24 + nowSec * 8) % (CONFIG.HEIGHT + 20)) - 10;
      ctx.beginPath();
      ctx.arc(mx, my, 1.4 + (m % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Foco y bandas cinematográficas durante la entrada de Buggy
  if (STATE.bossCinematic.active) {
    const boss = STATE.enemies.find((e) => e.isBoss && e.type === STATE.bossCinematic.bossType);
    if (boss) {
      const sx = boss.x - CAMERA.x;
      const sy = boss.y - CAMERA.y;
      ctx.save();
      const spot = ctx.createRadialGradient(sx, sy, 48, sx, sy, 290);
      spot.addColorStop(0, 'rgba(255, 235, 160, 0.16)');
      spot.addColorStop(0.65, 'rgba(255, 180, 60, 0.05)');
      spot.addColorStop(1, 'rgba(6, 8, 14, 0.45)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.fillStyle = 'rgba(6, 8, 14, 0.92)';
      ctx.fillRect(0, 0, CONFIG.WIDTH, 42);
      ctx.fillRect(0, CONFIG.HEIGHT - 42, CONFIG.WIDTH, 42);
      ctx.restore();
    }
  }

  if (INPUT_TOUCH.joystick.active) {
    const j = INPUT_TOUCH.joystick;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = 'rgba(200, 169, 81, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(j.originX, j.originY, CONFIG.JOYSTICK_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(245, 197, 24, 0.85)';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(j.currX, j.currY, CONFIG.JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (STATE.impactFlashTimer > 0) {
    ctx.save();
    ctx.fillStyle = STATE.impactFlashColor || '#FFFFFF';
    ctx.globalAlpha = Math.min(1, STATE.impactFlashTimer / 0.09) * 0.42;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
  }

  ctx.restore();
  renderMinimap();
}

export function renderMinimap(): void {
  const mc = document.getElementById('minimapCanvas') as HTMLCanvasElement | null;
  if (!mc || STATE.screen !== 'playing') return;
  const mctx = mc.getContext('2d');
  if (!mctx) return;
  const mw = mc.width, mh = mc.height;
  mctx.clearRect(0, 0, mw, mh);

  const sx = mw / CONFIG.WORLD_WIDTH;
  const sy = mh / CONFIG.WORLD_HEIGHT;

  mctx.strokeStyle = 'rgba(255,255,255,0.22)';
  mctx.lineWidth = 1;
  mctx.strokeRect(CAMERA.x * sx, CAMERA.y * sy, CONFIG.WIDTH * sx, CONFIG.HEIGHT * sy);

  for (let i = 0; i < STATE.enemies.length; i++) {
    const en = STATE.enemies[i];
    if (en.hp <= 0) continue;
    mctx.fillStyle = en.isBoss ? '#FF1744' : '#FF5252';
    mctx.beginPath();
    mctx.arc(en.x * sx, en.y * sy, en.isBoss ? 3.5 : 2, 0, Math.PI * 2);
    mctx.fill();
  }

  mctx.fillStyle = '#4CAF50';
  mctx.beginPath();
  mctx.arc(STATE.player.x * sx, STATE.player.y * sy, 3, 0, Math.PI * 2);
  mctx.fill();
}

export function drawPlayer(): void {
  if (!ensureRenderContext()) return;
  const p = STATE.player;
  const charMod = getCharacterModule(STATE.charId);
  const t = performance.now() * 0.005;
  const rc = { ctx, state: STATE, player: p, cfg: charMod, t };

  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.invulnTimer > 0 && Math.floor(performance.now() / 50) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  const bodyScale = charMod.getBodyScale?.(p) ?? 1.0;
  if (bodyScale !== 1.0) {
    ctx.scale(bodyScale, bodyScale);
  }

  const flyOffsetY = charMod.getFlyOffsetY?.(p) ?? 0;
  const shadowScale = flyOffsetY < 0 ? 0.72 : 1.0;

  ctx.fillStyle = flyOffsetY < 0 ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius * 0.85 * bodyScale, p.radius * 0.95 * bodyScale * shadowScale, 8 * bodyScale * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  if (flyOffsetY !== 0) {
    ctx.translate(0, flyOffsetY);
  }

  charMod.drawAura?.(rc);

  const extraSpin = charMod.getBodySpin?.(p) ?? 0;

  if (p.landSquashTimer > 0) {
    const lsq = Math.sin((p.landSquashTimer / 0.12) * Math.PI);
    ctx.scale(1 + 0.14 * lsq, 1 - 0.12 * lsq);
  }

  ctx.rotate(p.facingAngle + extraSpin);

  if ((p.visualScaleX && Math.abs(p.visualScaleX - 1) > 0.004) || (p.visualScaleY && Math.abs(p.visualScaleY - 1) > 0.004)) {
    ctx.scale(p.visualScaleX || 1, p.visualScaleY || 1);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(p.radius + 10, 0);
  ctx.lineTo(p.radius + 2, -6);
  ctx.lineTo(p.radius + 2, 6);
  ctx.closePath();
  ctx.fill();

  charMod.drawBody(rc);

  ctx.restore();
}

// ==========================================================================
// DIBUJADO AUTÉNTICO DE MARINES DE ONE PIECE Y CAPITANA ALVIDA + PUNTOS SANGRADO
// ==========================================================================
export function drawEnemy(en: any): void {
  if (!ensureRenderContext()) return;
  ctx.save();
  ctx.translate(en.x, en.y);

  if (en.rootTimer > 0) {
    ctx.strokeStyle = en.lawShamblesDebuffTimer > 0 ? 'rgba(38, 198, 218, 0.9)' : 'rgba(186, 104, 200, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, en.radius * 0.7, en.radius + 6, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (en.inLawRoom) {
    ctx.strokeStyle = 'rgba(38, 198, 218, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (en.blindTimer > 0) {
    ctx.strokeStyle = 'rgba(255, 245, 157, 0.92)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -en.radius * 0.65, en.radius * 0.7, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, en.radius * 0.85, en.radius * 0.9, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (en.hitSquashTimer > 0) {
    const sq = Math.sin((en.hitSquashTimer / (en.hitSquashMax || 0.12)) * Math.PI);
    const hAng = en.hitAngle || 0;
    ctx.rotate(hAng);
    ctx.scale(1 - 0.22 * sq, 1 + 0.18 * sq);
    ctx.rotate(-hAng);
  }
  ctx.rotate(en.facing);

  const isFlash = en.flashTimer > 0;

  if (en.type === 'buggy') {
    // Capitán Buggy el Payaso ("Wanted"): abrigo rojo con cuello de piel, camisa a rayas, bicornio pirata, nariz roja y Bara Bara no Mi
    const isBlooper = (en.blooperTimer || 0) > 0;
    const wob = isBlooper ? Math.sin(performance.now() * 0.028) * 0.22 : 0;
    ctx.rotate(wob);

    const floatY = en.baraSplitActive ? Math.sin(performance.now() * 0.012) * 5 : 0;

    // Capa y abrigo rojo de Capitán
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#B71C1C';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-28, -32 + floatY, 34, 64, 11);
    ctx.fill();
    ctx.stroke();

    // Camisa de rayas azules/blancas
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#ECEFF1';
    ctx.beginPath();
    ctx.arc(2, floatY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#1976D2';
    ctx.lineWidth = 3.5;
    for (let sy = -14; sy <= 14; sy += 9) {
      ctx.beginPath();
      ctx.moveTo(-14, sy + floatY);
      ctx.lineTo(16, sy + floatY);
      ctx.stroke();
    }

    // Puños dorados y brazos (o manos separadas orbitando con cuchillos en Bara Bara)
    const handAng = en.baraHandAngle || 0;
    if (en.baraSplitActive) {
      for (let h = 0; h < 2; h++) {
        const a = handAng + h * Math.PI;
        const hx = Math.cos(a) * 44;
        const hy = Math.sin(a) * 44;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#4FC3F7';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Cuchillos cruzados en la mano flotante
        ctx.strokeStyle = '#ECEFF1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(2, -10); ctx.lineTo(18, -14);
        ctx.moveTo(2, 10); ctx.lineTo(18, 14);
        ctx.stroke();
        ctx.restore();
      }
      // Botas independientes abajo durante Bara Bara
      ctx.fillStyle = '#5D4037';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-6, -24, 9, 6, 0.2, 0, Math.PI * 2);
      ctx.ellipse(-6, 24, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(16, -22, 7.5, 0, Math.PI * 2);
      ctx.arc(16, 22, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Cabeza con maquillaje de payaso, mechones azules, bicornio y nariz roja
    const headOffX = en.baraSplitActive ? Math.cos(handAng * 1.3) * 8 + 6 : 4;
    const headOffY = en.baraSplitActive ? Math.sin(handAng * 1.3) * 8 : 0;
    ctx.save();
    ctx.translate(headOffX, headOffY + floatY);

    // Mechones azules laterales
    ctx.fillStyle = '#1E88E5';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-4, -18, 7.5, 0, Math.PI * 2);
    ctx.arc(-4, 18, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rostro maquillado
    ctx.fillStyle = isBlooper && en.blooperType === 'backfire' ? '#5D4037' : (isFlash ? '#FFFFFF' : '#F5E1CE');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bicornio pirata naranja-rojo de Buggy con calavera
    ctx.fillStyle = '#E65100';
    ctx.beginPath();
    ctx.ellipse(-6, 0, 12, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // ¡Gran nariz roja de payaso!
    ctx.fillStyle = '#FF1744';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(13, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Estrellitas de mareo si está en medio de un blooper
    if (isBlooper) {
      const spin = performance.now() * 0.008;
      ctx.fillStyle = '#FFEB3B';
      for (let st = 0; st < 3; st++) {
        const sa = spin + (st / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * 24, Math.sin(sa) * 24, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (en.type === 'morgan') {
    // Captain Morgan ("Axe-Hand Morgan"): broad torso, white captain coat, steel jaw plate, battle-axe right hand
    // Captain coat cape/back
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#ECEFF1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-28, -32, 34, 64, 10);
    ctx.fill();
    ctx.stroke();

    // Coat fur collar & blue Marine sash
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#263238';
    ctx.fillRect(-20, -28, 12, 56);

    // Muscular tan chest + diagonal scar
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#D7A47A';
    ctx.beginPath();
    ctx.ellipse(2, 0, 24, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#8D4E3B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.lineTo(18, 12);
    ctx.stroke();

    // Gold captain epaulets
    ctx.fillStyle = '#F5C518';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-4, -27, 8, 0, Math.PI * 2);
    ctx.arc(-4, 27, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Massive steel Axe-Hand replacing right arm (y > 0 side)
    ctx.fillStyle = '#37474F';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.fillRect(6, 16, 26, 11);
    ctx.strokeRect(6, 16, 26, 11);
    // Gleaming curved battle-axe blade
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#CFD8DC';
    ctx.beginPath();
    ctx.moveTo(22, 16);
    ctx.quadraticCurveTo(54, 4, 58, 22);
    ctx.quadraticCurveTo(54, 42, 22, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(46, 12);
    ctx.quadraticCurveTo(55, 22, 46, 33);
    ctx.stroke();

    // Head, blonde flat-top, and iconic steel jaw guard
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#E0AE84';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(4, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blonde hair
    ctx.fillStyle = '#FDD835';
    ctx.beginPath();
    ctx.arc(-2, 0, 13, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();

    // Steel chin/jaw plate bolted on front of face
    ctx.fillStyle = '#607D8B';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(7, 0, 12, -Math.PI * 0.48, Math.PI * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (en.isBoss) {
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#AD1457';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-4, 0, en.radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#FFFFFF' : '#EC407A';
    ctx.beginPath();
    ctx.arc(0, 0, en.radius - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.lineTo(36, 26);
    ctx.stroke();

    ctx.fillStyle = '#37474F';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(40, 27, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let sp = 0; sp < 6; sp++) {
      const sa = (sp / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(40 + Math.cos(sa) * 12, 27 + Math.sin(sa) * 12);
      ctx.lineTo(40 + Math.cos(sa) * 18, 27 + Math.sin(sa) * 18);
      ctx.stroke();
    }

    ctx.fillStyle = '#1A1A20';
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D32F2F';
    ctx.beginPath();
    ctx.ellipse(-10, -14, 14, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (en.type === 'vanguard') {
    // Heavy armored Marine Bruiser with iron battle-cleaver
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#263238';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(-20, -24, 38, 48, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#FFFFFF' : '#1565C0';
    ctx.beginPath();
    ctx.arc(0, 0, en.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Steel shoulder armor plates
    ctx.fillStyle = '#90A4AE';
    ctx.beginPath();
    ctx.arc(-2, -19, 8, 0, Math.PI * 2);
    ctx.arc(-2, 19, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heavy iron cleaver/hammer
    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(8, 15);
    ctx.lineTo(28, 18);
    ctx.stroke();
    ctx.fillStyle = '#B0BEC5';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(24, 9, 15, 19, 3);
    ctx.fill();
    ctx.stroke();

    // White Marine cap
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(2, 0, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.arc(11, 0, 6, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  } else if (en.type === 'swordsman') {
    // Agile Marine Swordsman with white/gold coat & long curved blade
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#ECEFF1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius - 4, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();

    // Curved Marine cutlass/katana
    ctx.strokeStyle = '#E0F7FA';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 11);
    ctx.quadraticCurveTo(26, 15, 38, 6);
    ctx.stroke();
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(11, 7);
    ctx.lineTo(11, 16);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.arc(9.5, 0, 5.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  } else if (en.type === 'rifleman') {
    // Marine Marksman / Rifleman with sharpshooter coat & long bayonet rifle
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#0D47A1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Long rifle stock + steel barrel + bayonet
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(22, 8);
    ctx.stroke();
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(40, 8);
    ctx.stroke();
    ctx.strokeStyle = '#FF5252';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(35, 8);
    ctx.lineTo(42, 6);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF5252';
    ctx.beginPath();
    ctx.arc(8, 0, 5.2, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  } else if (en.type === 'officer') {
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#ECEFF1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-24, -22, 26, 44, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(2, 0, en.radius - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F5C518';
    ctx.beginPath();
    ctx.arc(0, -18, 6.5, 0, Math.PI * 2);
    ctx.arc(0, 18, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(34, 18);
    ctx.stroke();
    ctx.strokeStyle = '#F5C518';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(14, 18);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(3, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.arc(13, 0, 7, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.fillStyle = '#F5C518';
    ctx.beginPath();
    ctx.arc(9, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (en.type === 'shield') {
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#1E4D8C';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-1, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (en.hasShield && !en.shieldBroken) {
      const isExposed = en.shieldExposedTimer > 0;
      ctx.save();
      if (isExposed) ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#0D47A1';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(isExposed ? -2 : 4, 0, en.radius + 4, -Math.PI * 0.46, Math.PI * 0.46);
      ctx.stroke();

      ctx.strokeStyle = '#B0BEC5';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(isExposed ? -2 : 4, 0, en.radius + 4, -Math.PI * 0.43, Math.PI * 0.43);
      ctx.stroke();
      ctx.restore();
    }
  } else if (en.type === 'shooter') {
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#1976D2';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(22, 8);
    ctx.stroke();
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(32, 8);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0D47A1';
    ctx.beginPath();
    ctx.arc(8, 0, 5.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  } else if (en.type === 'knife_juggler') {
    // Lanzacuchillos del circo: chaleco a rayas rojas/blancas, pañuelo morado y cuchillos dobles
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#D32F2F';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F4E4C1';
    ctx.fillRect(-7, -en.radius + 4, 14, en.radius * 2 - 8);

    ctx.strokeStyle = '#ECEFF1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -13); ctx.lineTo(25, -17);
    ctx.moveTo(10, 13); ctx.lineTo(25, 17);
    ctx.stroke();

    ctx.fillStyle = '#8E24AA';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (en.type === 'acrobat') {
    // Acróbata en monociclo: rueda frontal, bufanda dorada y sable ligero
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#FFFFFF' : '#FF8F00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FF5252';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, -8); ctx.lineTo(-22, -14);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(10, 11); ctx.lineTo(29, 13);
    ctx.stroke();

    ctx.fillStyle = '#F4E4C1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(2, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (en.type === 'cannon_brute') {
    // Artillero circense: forzudo ancho con cañón portátil de hombro
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#4E342E';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-20, -23, 38, 46, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFlash ? '#FFFFFF' : '#C62828';
    ctx.beginPath();
    ctx.arc(0, 0, en.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#263238';
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(4, 10, 30, 13, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D32F2F';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(2, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = isFlash ? '#FFFFFF' : '#F5F5F5';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(2, 0, 11.5, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.stroke();

    ctx.strokeStyle = '#B0BEC5';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(10, 11);
    ctx.lineTo(27, 14);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1565C0';
    ctx.beginPath();
    ctx.arc(8, 0, 5.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  }

  ctx.restore();

  const barW = en.isBoss ? 64 : 34;
  const barH = 5;
  const hpRatio = Math.max(0, en.hp / en.maxHp);
  ctx.fillStyle = '#000';
  ctx.fillRect(-barW / 2 - 1, -en.radius - 13, barW + 2, barH + 2);
  ctx.fillStyle = en.isBoss ? '#FF5252' : '#4CAF50';
  ctx.fillRect(-barW / 2, -en.radius - 12, barW * hpRatio, barH);

  if (en.type === 'shield' && en.hasShield && !en.shieldBroken) {
    const shRatio = Math.max(0, en.shieldHp / (en.shieldMaxHp || 80));
    ctx.fillStyle = '#0D47A1';
    ctx.fillRect(-barW / 2 - 1, -en.radius - 19, barW + 2, 4);
    ctx.fillStyle = '#4FC3F7';
    ctx.fillRect(-barW / 2, -en.radius - 18, barW * shRatio, 3);
  }

  // E1: Indicador visual de stacks de sangrado de Killer
  if (en.killerBleedStacks > 0) {
    const dotSpacing = 7;
    const startX = -((5 - 1) * dotSpacing) / 2;
    const dotY = -en.radius - (en.type === 'shield' && en.hasShield && !en.shieldBroken ? 25 : 19);
    for (let s = 0; s < 5; s++) {
      ctx.beginPath();
      ctx.arc(startX + s * dotSpacing, dotY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = s < en.killerBleedStacks ? '#FF1744' : 'rgba(0,0,0,0.6)';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  if (en.frozen) {
    ctx.fillStyle = 'rgba(128, 222, 234, 0.48)';
    ctx.strokeStyle = '#E1F5FE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(225, 245, 254, 0.72)';
    for (let c = 0; c < 4; c++) {
      const ca = (c / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ca) * (en.radius + 7), Math.sin(ca) * (en.radius + 7));
      ctx.lineTo(Math.cos(ca - 0.28) * (en.radius - 2), Math.sin(ca - 0.28) * (en.radius - 2));
      ctx.lineTo(Math.cos(ca + 0.28) * (en.radius - 2), Math.sin(ca + 0.28) * (en.radius - 2));
      ctx.closePath();
      ctx.fill();
    }
  }

  if (en.akainuMarkTimer > 0) {
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -en.radius - 22, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (en.aokijiMarkTimer > 0) {
    ctx.strokeStyle = '#80DEEA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -en.radius - 27);
    ctx.lineTo(5, -en.radius - 22);
    ctx.lineTo(0, -en.radius - 17);
    ctx.lineTo(-5, -en.radius - 22);
    ctx.closePath();
    ctx.stroke();
  }
  if (en.fearTimer > 0) {
    ctx.strokeStyle = 'rgba(186, 104, 200, 0.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, en.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (en.parasiteTimer > 0) {
    ctx.strokeStyle = '#F48FB1';
    ctx.lineWidth = 1.6;
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.moveTo(s * 6, -en.radius);
      ctx.lineTo(s * 10, -en.radius - 32);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function easeOutQuart(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - u, 4);
}

export function easeOutBack(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export function drawTaperedCrescent(
  r: number,
  startAng: number,
  endAng: number,
  thickness: number,
  outerColor: string,
  coreColor: string | null = null
): void {
  if (!ensureRenderContext()) return;
  const span = endAng - startAng;
  if (Math.abs(span) < 0.03 || r <= 2) return;
  const segs = 14;
  const traceCrescent = (thickScale: number, radialOffset: number) => {
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = startAng + span * u;
      const rOut = r + radialOffset + Math.sin(u * Math.PI) * (thickness * 0.22 * thickScale);
      const x = Math.cos(a) * rOut;
      const y = Math.sin(a) * rOut;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = segs; i >= 0; i--) {
      const u = i / segs;
      const a = startAng + span * u;
      const taper = Math.pow(Math.sin(u * Math.PI), 0.78);
      const rIn = Math.max(2, r + radialOffset - thickness * thickScale * taper);
      ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    }
    ctx.closePath();
  };
  traceCrescent(1.0, 0);
  ctx.fillStyle = outerColor;
  ctx.fill();
  if (coreColor) {
    traceCrescent(0.45, -thickness * 0.14);
    ctx.fillStyle = coreColor;
    ctx.fill();
  }
}

export function drawTaperedSlashLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxW: number,
  outerColor: string,
  coreColor: string | null,
  progress: number
): void {
  if (!ensureRenderContext()) return;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ext = easeOutQuart(Math.min(1, progress / 0.32));
  const ex = x1 + dx * ext;
  const ey = y1 + dy * ext;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const mx = (x1 + ex) * 0.5, my = (y1 + ey) * 0.5;
  const w = Math.max(3, maxW * 0.5);

  const drawDiamond = (halfThick: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx + nx * halfThick, my + ny * halfThick);
    ctx.lineTo(ex, ey);
    ctx.lineTo(mx - nx * halfThick, my - ny * halfThick);
    ctx.closePath();
    ctx.fill();
  };
  drawDiamond(w, outerColor);
  if (coreColor) {
    drawDiamond(Math.max(1.5, w * 0.42), coreColor);
  }
}

export function drawSlashEffect(ef: any): void {
  if (!ensureRenderContext()) return;
  const alpha = Math.max(0, ef.life / ef.maxLife);
  const progress = 1 - alpha;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (ef.type === 'impact_flare') {
    const snap = easeOutQuart(Math.min(1, progress / 0.45));
    const r = ef.range * (0.55 + snap * 0.55);
    const w = Math.max(2, r * 0.22 * alpha);
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    ctx.fillStyle = ef.color || '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w, w);
    ctx.lineTo(0, r * 0.72); ctx.lineTo(-w, w);
    ctx.lineTo(-r, 0); ctx.lineTo(-w, -w);
    ctx.lineTo(0, -r * 0.72); ctx.lineTo(w, -w);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'finisher_flash') {
    const snap = Math.min(1, progress / 0.35);
    const r = (ef.range || 90) * (0.4 + snap * 0.9);
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    ctx.fillStyle = ef.color || '#FFD54F';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const outerR = i % 2 === 0 ? r : r * 0.45;
      const px = Math.cos(ang) * outerR;
      const py = Math.sin(ang) * outerR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'ring') {
    ctx.strokeStyle = ef.color;
    ctx.lineWidth = 6 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, ef.range * (0.35 + progress * 0.65), 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'shambles_cut') {
    drawTaperedSlashLine(ef.x, ef.y - ef.range, ef.x, ef.y + ef.range, 10 * alpha, '#26C6DA', ef.color || '#FFFFFF', progress);
  } else if (ef.type === 'gamma_room_burst') {
    ctx.fillStyle = 'rgba(224, 64, 251, 0.32)';
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, ef.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8 * alpha;
    ctx.stroke();
  } else if (ef.type === 'magnetic_pull') {
    const prog = 1 - alpha;
    const col = ef.color || '#D32F2F';
    ctx.strokeStyle = col;
    ctx.lineWidth = 5.5 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, ef.range * (1 - prog * 0.72), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, ef.range * (0.65 - prog * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    // Líneas de succión hacia el centro
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6 * alpha;
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2 + prog * 1.4;
      const rOut = ef.range * (0.92 - prog * 0.45);
      const rIn = Math.max(18, rOut - 50);
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(a) * rOut, ef.y + Math.sin(a) * rOut);
      ctx.lineTo(ef.x + Math.cos(a) * rIn, ef.y + Math.sin(a) * rIn);
      ctx.stroke();
    }
  } else if (ef.type === 'kid_ground_sweep') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (60 * Math.PI) / 180;
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.25) / 0.75)) * 0.65;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;
    ctx.fillStyle = 'rgba(255, 193, 7, 0.24)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ef.range, -hAng, endA);
    ctx.closePath();
    ctx.fill();
    drawTaperedCrescent(ef.range, startA, endA, 14 * Math.max(0.4, alpha), '#BDBDBD', '#FFF59D');
  } else if (ef.type === 'sonic_wave_cone') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (30 * Math.PI) / 180;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ef.range, -hAng, hAng);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ef.color || '#9FA8DA';
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, ef.range, -hAng, hAng);
    ctx.stroke();
  } else if (ef.type === 'radical_beam') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const now = performance.now() * 0.001;
    const ext = easeOutQuart(Math.min(1, progress / 0.16));
    const len = ef.range * ext;
    const widthScale = (0.75 + Math.sin(progress * Math.PI) * 0.45) * (0.45 + alpha * 0.55);
    const baseHalfW = (ef.width || 40) * 0.5 * widthScale;

    // Aura cyan exterior + cuerpo del láser con gradiente
    const auraGrad = ctx.createLinearGradient(0, -baseHalfW * 1.4, 0, baseHalfW * 1.4);
    auraGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    auraGrad.addColorStop(0.25, `rgba(0, 229, 255, ${0.55 * alpha})`);
    auraGrad.addColorStop(0.5, `rgba(132, 255, 255, ${0.95 * alpha})`);
    auraGrad.addColorStop(0.75, `rgba(0, 229, 255, ${0.55 * alpha})`);
    auraGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(0, -baseHalfW * 1.4, len, baseHalfW * 2.8);

    // Núcleo blanco candente
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(0, -baseHalfW * 0.34, len, baseHalfW * 0.68, baseHalfW * 0.34);
    ctx.fill();

    // Anillos de energía propulsándose por el rayo
    for (let r = 0; r < 5; r++) {
      const u = (now * 4.5 + r / 5) % 1;
      const rx = u * len;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - u) * alpha * 0.9})`;
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.ellipse(rx, 0, 7, baseHalfW * (0.95 + u * 0.35), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Arcos eléctricos alrededor del haz
    ctx.strokeStyle = `rgba(178, 255, 255, ${0.9 * alpha})`;
    ctx.lineWidth = 2.4 * alpha;
    ctx.beginPath();
    const segs = 14;
    for (let s = 0; s <= segs; s++) {
      const sx = (s / segs) * len;
      const sy = Math.sin(s * 2.1 - now * 42) * baseHalfW * 0.9;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Destello de boca (muzzle flare)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, baseHalfW * 1.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (ef.type === 'strong_right_chain') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    ctx.strokeStyle = '#B0BEC5';
    ctx.lineWidth = 6;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ef.range, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#616161';
    ctx.beginPath();
    ctx.arc(ef.range, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (ef.type === 'coup_de_vent') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const prog = 1 - alpha;
    const currR = ef.range * (0.45 + prog * 0.55);
    ctx.fillStyle = 'rgba(132, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, currR, -ef.halfAngle, ef.halfAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, currR, -ef.halfAngle, ef.halfAngle);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, currR * 0.65, -ef.halfAngle * 0.9, ef.halfAngle * 0.9);
    ctx.stroke();
  } else if (ef.type === 'robin_hands') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const count = ef.count || 1;
    const ext = easeOutQuart(Math.min(1, progress / 0.42));
    const drawAnatomicalArm = (armLen: number, thickness: number, bend: number) => {
      const startX = 12;
      const tipX = startX + (armLen - startX) * ext;
      const wristX = Math.max(startX + 10, tipX - thickness * 1.15);
      const midX = (startX + wristX) * 0.5;
      // Antebrazo estilizado con curva
      ctx.fillStyle = '#F3C1A0';
      ctx.strokeStyle = '#4A148C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, -thickness * 0.55);
      ctx.quadraticCurveTo(midX, -thickness * 0.48 + bend, wristX, -thickness * 0.36);
      ctx.lineTo(wristX, thickness * 0.36);
      ctx.quadraticCurveTo(midX, thickness * 0.48 + bend, startX, thickness * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Aura floral púrpura en la base del brote
      ctx.fillStyle = 'rgba(186, 104, 200, 0.8)';
      ctx.beginPath();
      ctx.arc(startX + 2, 0, thickness * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Palma + 4 dedos + pulgar abierto
      ctx.fillStyle = '#F6C9AB';
      ctx.strokeStyle = '#4A148C';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(wristX + thickness * 0.45, 0, thickness * 0.55, thickness * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (let f = -1.5; f <= 1.5; f += 1) {
        const fy = f * (thickness * 0.30);
        const fLen = thickness * (Math.abs(f) < 1 ? 0.92 : 0.76);
        ctx.beginPath();
        ctx.roundRect(wristX + thickness * 0.72, fy - thickness * 0.11, fLen, thickness * 0.22, 3);
        ctx.fill();
        ctx.stroke();
      }
      // Pulgar
      ctx.beginPath();
      ctx.roundRect(wristX + thickness * 0.35, -thickness * 0.9, thickness * 0.52, thickness * 0.24, 3);
      ctx.fill();
      ctx.stroke();
    };

    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * 0.72;
      const crossBend = count === 2 ? (i === 0 ? 12 : -12) : 0;
      ctx.save();
      ctx.rotate(spread);
      drawAnatomicalArm(ef.range, count >= 4 ? 11 : 13, crossBend);
      ctx.restore();
    }
    // Pétalos Hana Hana flotando
    ctx.fillStyle = '#F48FB1';
    for (let pIdx = 0; pIdx < count * 2; pIdx++) {
      const px = 22 + ((pIdx * 29) % Math.max(24, ef.range * 0.7)) * ext;
      const py = Math.sin(pIdx * 2.3 + progress * 6) * 22;
      ctx.beginPath();
      ctx.ellipse(px, py, 4.5, 2.2, pIdx + progress * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ef.type === 'robin_clutch' || ef.type === 'mil_fleur') {
    const count = ef.count || 6;
    const isClutch = ef.type === 'robin_clutch';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (isClutch ? progress * 0.5 : 0);
      const dist = isClutch ? 24 * (1 - progress * 0.35) : (26 + (i % 4) * 30);
      const armLen = isClutch ? 26 : 30;
      const bx = ef.x + Math.cos(a) * dist;
      const by = ef.y + Math.sin(a) * dist;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(isClutch ? a + Math.PI * 0.72 : a);
      // Brazo y mano brotando
      ctx.fillStyle = '#F3C1A0';
      ctx.strokeStyle = '#4A148C';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-armLen * 0.55, -4, armLen * 0.7, 8, 4);
      ctx.fill();
      ctx.stroke();
      // Mano + dedos
      ctx.beginPath();
      ctx.arc(armLen * 0.25, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.roundRect(armLen * 0.42, f * 3.2 - 1.2, 6, 2.4, 1);
        ctx.fill();
        ctx.stroke();
      }
      // Pétalo rosa junto al brote
      ctx.fillStyle = '#F48FB1';
      ctx.beginPath();
      ctx.ellipse(-armLen * 0.45, -7, 4, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (ef.type === 'gigantesco_impact') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const slamExt = easeOutQuart(Math.min(1, progress / 0.28));
    const armLen = ef.range * (0.55 + 0.45 * slamExt);
    const w = ef.width || 140;
    const wristX = armLen * 0.68;

    // Onda de choque debajo del impacto gigante
    ctx.strokeStyle = `rgba(225, 190, 231, ${alpha * 0.9})`;
    ctx.lineWidth = 6 * alpha;
    ctx.beginPath();
    ctx.ellipse(armLen * 0.76, 0, w * (0.55 + progress * 0.35), w * (0.45 + progress * 0.3), 0, 0, Math.PI * 2);
    ctx.stroke();

    // Antebrazo colosal Hana Hana
    ctx.fillStyle = '#F3C1A0';
    ctx.strokeStyle = '#4A148C';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.26);
    ctx.lineTo(wristX, -w * 0.20);
    ctx.lineTo(wristX, w * 0.20);
    ctx.lineTo(0, w * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sombra/detalle muscular púrpura-rosa
    ctx.fillStyle = 'rgba(156, 39, 176, 0.22)';
    ctx.beginPath();
    ctx.roundRect(12, -w * 0.14, wristX - 24, w * 0.28, 12);
    ctx.fill();

    // Palma gigante
    ctx.fillStyle = '#F6C9AB';
    ctx.beginPath();
    ctx.ellipse(wristX + w * 0.18, 0, w * 0.28, w * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4 dedos gigantes + pulgar gigante
    for (let f = -1.5; f <= 1.5; f += 1) {
      const fy = f * (w * 0.16);
      const fLen = w * (Math.abs(f) < 1 ? 0.42 : 0.34);
      ctx.beginPath();
      ctx.roundRect(wristX + w * 0.30, fy - w * 0.06, fLen, w * 0.12, 10);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(wristX + w * 0.08, -w * 0.50, w * 0.26, w * 0.13, 10);
    ctx.fill();
    ctx.stroke();

    // Pétalos alrededor del impacto gigante
    ctx.fillStyle = '#F48FB1';
    for (let pt = 0; pt < 14; pt++) {
      const pa = (pt / 14) * Math.PI * 2 + progress * 2;
      const pr = w * (0.45 + progress * 0.4);
      ctx.beginPath();
      ctx.ellipse(wristX + Math.cos(pa) * pr, Math.sin(pa) * pr * 0.7, 7, 3.5, pa, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ef.type === 'shanks_electric_arc') {
    // Shanks Golpe 5: Arco rojo eléctrico colosal con barrido dinámico y núcleo de Haki
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const currR = ef.range * (0.42 + easeOutQuart(progress) * 0.58);
    const hAng = (90 * Math.PI) / 180;
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.28) / 0.72)) * 0.58;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;
    drawTaperedCrescent(currR, startA, endA, 22 * Math.max(0.45, alpha), '#FF1744', '#111111');
    // Rayos eléctricos rojos y blancos chisporroteando a lo largo del filo
    ctx.strokeStyle = Math.floor(progress * 12) % 2 === 0 ? '#FF5252' : '#FFFFFF';
    ctx.lineWidth = 3.2 * alpha;
    for (let k = -3; k <= 3; k++) {
      const a = (k / 4) * hAng;
      if (a < startA || a > endA) continue;
      const r1 = currR - 18;
      const r2 = currR + 22;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + 0.08) * (currR + 6), Math.sin(a + 0.08) * (currR + 6));
      ctx.lineTo(Math.cos(a - 0.05) * r2, Math.sin(a - 0.05) * r2);
      ctx.stroke();
    }
  } else if (ef.type === 'shanks_haki_burst') {
    // Shanks H1: Círculo rojo vibrante 360° con ondas concéntricas y deformación de borde
    const prog = 1 - alpha;
    const curR = ef.range * (0.25 + prog * 0.75);
    ctx.fillStyle = `rgba(255, 23, 68, ${0.28 * alpha})`;
    ctx.beginPath();
    // Borde vibrante deformado
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
      const vib = Math.sin(a * 12 + prog * 20) * 4.5 * alpha;
      const r = curR + vib;
      const px = ef.x + Math.cos(a) * r;
      const py = ef.y + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 7 * alpha;
    ctx.stroke();
    // Ondas concéntricas internas
    ctx.strokeStyle = '#D50000';
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'wb_fissure_wide') {
    // Barbablanca Golpe 1: Grieta ancha blanca con detalles rojos y roca levantándose (legacy - ya no se usa en v1.9e+)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = (ef.width || 60) * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ef.x, ef.y);
    ctx.lineTo(ef.endX, ef.endY);
    ctx.stroke();
    ctx.strokeStyle = ef.subColor || '#D50000';
    ctx.lineWidth = 8 * alpha;
    ctx.stroke();
  } else if (ef.type === 'wb_seaquake_crack') {
    // Barbablanca Seaquake (combo hit 1 y H1): Grieta irregular gris en el suelo (v1.9e)
    // Dibuja una línea principal quebrada con grosor variable y fracturas secundarias
    // color = núcleo oscuro (profundidad), subColor = bordes grises medios
    const cx = ef.x, cy = ef.y;
    const ex = ef.endX, ey = ef.endY;
    const dx = ex - cx, dy = ey - cy;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const px = -uy, py = ux; // perpendicular
    const baseWidth = (ef.width || 60) * alpha;
    const coreColor = ef.color || '#263238';
    const edgeColor = ef.subColor || '#78909C';
    const segments = 18; // tramos para irregularidad
    // Dibuja borde irregular (lado A)
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = Math.max(2, baseWidth * 0.15);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const bx = cx + ux * len * t;
      const by = cy + uy * len * t;
      // Grosor variable: más grueso en centro (t=0.5), más fino en extremos
      const widthMult = 0.6 + 0.8 * (1 - Math.abs(t - 0.5) * 2);
      const offset = (baseWidth * 0.55) * widthMult;
      // Jitter irregular en perpendicular
      const jitter = (Math.sin(t * Math.PI * 7) * 0.35 + Math.random() * 0.15) * offset;
      const px1 = bx + px * (offset + jitter);
      const py1 = by + py * (offset + jitter);
      if (i === 0) ctx.moveTo(px1, py1);
      else ctx.lineTo(px1, py1);
    }
    ctx.stroke();
    // Dibuja borde irregular (lado B - simétrico)
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const bx = cx + ux * len * t;
      const by = cy + uy * len * t;
      const widthMult = 0.6 + 0.8 * (1 - Math.abs(t - 0.5) * 2);
      const offset = (baseWidth * 0.55) * widthMult;
      const jitter = (Math.sin(t * Math.PI * 7 + 1.3) * 0.35 + Math.random() * 0.15) * offset;
      const px1 = bx - px * (offset + jitter);
      const py1 = by - py * (offset + jitter);
      if (i === 0) ctx.moveTo(px1, py1);
      else ctx.lineTo(px1, py1);
    }
    ctx.stroke();
    // Rellena el interior con color núcleo (profundidad)
    ctx.fillStyle = coreColor;
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const bx = cx + ux * len * t;
      const by = cy + uy * len * t;
      const widthMult = 0.6 + 0.8 * (1 - Math.abs(t - 0.5) * 2);
      const offset = (baseWidth * 0.55) * widthMult;
      const jitter = (Math.sin(t * Math.PI * 7) * 0.35 + Math.random() * 0.15) * offset;
      const px1 = bx + px * (offset + jitter);
      const py1 = by + py * (offset + jitter);
      if (i === 0) ctx.moveTo(px1, py1);
      else ctx.lineTo(px1, py1);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const bx = cx + ux * len * t;
      const by = cy + uy * len * t;
      const widthMult = 0.6 + 0.8 * (1 - Math.abs(t - 0.5) * 2);
      const offset = (baseWidth * 0.55) * widthMult;
      const jitter = (Math.sin(t * Math.PI * 7 + 1.3) * 0.35 + Math.random() * 0.15) * offset;
      const px1 = bx - px * (offset + jitter);
      const py1 = by - py * (offset + jitter);
      ctx.lineTo(px1, py1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha;
    // Fracturas secundarias cortas ("raíces") saliendo del tronco principal
    const numFractures = 5 + Math.floor(Math.random() * 4);
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = Math.max(1.5, baseWidth * 0.07);
    for (let f = 0; f < numFractures; f++) {
      const t = 0.15 + Math.random() * 0.7; // posición a lo largo de la grieta
      const fx = cx + ux * len * t;
      const fy = cy + uy * len * t;
      const side = Math.random() < 0.5 ? 1 : -1;
      const angle = Math.atan2(uy, ux) + side * (Math.PI / 2 + (Math.random() - 0.5) * 0.6);
      const flen = 15 + Math.random() * (baseWidth * 0.6);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(angle) * flen, fy + Math.sin(angle) * flen);
      ctx.stroke();
      // Sub-fractura
      if (Math.random() < 0.4) {
        const mx = fx + Math.cos(angle) * flen * 0.5;
        const my = fy + Math.sin(angle) * flen * 0.5;
        const angle2 = angle + side * (Math.random() - 0.5) * 0.8;
        const flen2 = flen * 0.4;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(angle2) * flen2, my + Math.sin(angle2) * flen2);
        ctx.stroke();
      }
    }
  } else if (ef.type === 'shanks_h2_haki_circle') {
    // Shanks H2 v1.9f: Círculo de Haki retardado - aura difusa tipo Conqueror's Haki
    // Sin línea de borde: gradiente radial difuso desde centro (intenso) → bordes (tenue)
    // Radio fijo 140px, cortes cruzados rojos/negros rotando, hit-stops por tick
    const prog = 1 - alpha; // 0→1 durante 2s
    const curR = ef.range; // 140px fijo
    const rotation = prog * Math.PI * 4; // 2 vueltas completas en 2s

    // Gradiente radial difuso: centro intenso → bordes transparentes (sin stroke/border)
    const grad = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, curR);
    grad.addColorStop(0, `rgba(255, 23, 68, ${0.45 * alpha})`);      // centro: rojo Haki intenso
    grad.addColorStop(0.35, `rgba(255, 23, 68, ${0.28 * alpha})`);   // medio: rojo medio
    grad.addColorStop(0.65, `rgba(213, 0, 0, ${0.18 * alpha})`);      // externo: carmesí tenue
    grad.addColorStop(1, `rgba(17, 17, 17, 0)`);                      // borde: transparente total
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    // Anillos concéntricos sutiles (solo fill, sin stroke) para profundidad
    for (let ring = 0; ring < 2; ring++) {
      const ringR = curR * (0.45 + ring * 0.3);
      const ringGrad = ctx.createRadialGradient(ef.x, ef.y, ringR * 0.6, ef.x, ef.y, ringR);
      ringGrad.addColorStop(0, `rgba(255, 23, 68, ${0.12 * alpha * (1 - ring * 0.4)})`);
      ringGrad.addColorStop(1, `rgba(213, 0, 0, 0)`);
      ctx.fillStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ringR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cortes cruzados rotando (efecto "carne siendo cortada") - trazos rojos/negros
    ctx.strokeStyle = `rgba(255, 23, 68, ${0.85 * alpha})`;
    ctx.lineWidth = 2.2 * alpha;
    const numCuts = 10;
    for (let c = 0; c < numCuts; c++) {
      const baseAngle = rotation + (c / numCuts) * Math.PI * 2;
      const len = curR * (0.75 + Math.random() * 0.2);
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(baseAngle) * curR * 0.15, ef.y + Math.sin(baseAngle) * curR * 0.15);
      ctx.lineTo(ef.x + Math.cos(baseAngle) * len, ef.y + Math.sin(baseAngle) * len);
      ctx.stroke();
    }
    // Cortes secundarios negros para contraste (estilo Haki avanzado)
    ctx.strokeStyle = `rgba(17, 17, 17, ${0.5 * alpha})`;
    ctx.lineWidth = 1.5 * alpha;
    for (let c = 0; c < numCuts; c++) {
      const baseAngle = rotation + Math.PI / numCuts + (c / numCuts) * Math.PI * 2;
      const len = curR * (0.5 + Math.random() * 0.25);
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(baseAngle) * curR * 0.25, ef.y + Math.sin(baseAngle) * curR * 0.25);
      ctx.lineTo(ef.x + Math.cos(baseAngle) * len, ef.y + Math.sin(baseAngle) * len);
      ctx.stroke();
    }
    // NO hay borde exterior (stroke en el perímetro) - aura difusa sin frontera definida
  } else if (ef.type === 'shanks_h2_haki_explosion') {
    // Shanks H2 v1.9e: Explosión final onda expansiva roja de Haki
    const prog = 1 - alpha; // 0→1 durante 0.35s
    const maxR = ef.range; // 210px (140 + 70)
    const curR = maxR * prog;
    // Onda expansiva principal
    ctx.strokeStyle = `rgba(255, 23, 68, ${alpha})`;
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();
    // Ondas secundarias
    for (let w = 1; w <= 3; w++) {
      const waveR = curR - w * 18;
      if (waveR > 0) {
        ctx.strokeStyle = `rgba(213, 0, 0, ${alpha * (0.6 - w * 0.15)})`;
        ctx.lineWidth = Math.max(2, 4 - w) * alpha;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, waveR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Estela interna negra (profundidad)
    ctx.strokeStyle = `rgba(17, 17, 17, ${0.5 * alpha})`;
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'wb_haki_sweep') {
    // Barbablanca Golpe 3: Barrido rojo Haki en abanico 240° con media luna cónica animada
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const curR = ef.range * (0.45 + easeOutQuart(progress) * 0.55);
    const hAng = ef.halfAngle || ((240 * Math.PI) / 180 / 2);
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.25) / 0.75)) * 0.55;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;
    drawTaperedCrescent(curR, startA, endA, 20 * Math.max(0.45, alpha), '#D50000', '#111111');
    drawTaperedCrescent(curR * 0.88, startA * 0.92, endA * 0.92, 6 * alpha, 'rgba(255, 255, 255, 0.7)', null);
  } else if (ef.type === 'wb_fissure_ring') {
    // Barbablanca H2 Aterrizaje: Onda circular y grieta sísmica
    const prog = 1 - alpha;
    const curR = ef.range * (0.35 + prog * 0.65);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ef.subColor || '#D50000';
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'expanding_red_arc') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const prog = 1 - alpha;
    const currR = ef.range * (0.35 + prog * 0.65);
    const hAng = ef.halfAngle || (75 * Math.PI) / 180;
    ctx.strokeStyle = ef.color || '#FF1744';
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, currR, -hAng, hAng);
    ctx.stroke();
    if (ef.subColor) {
      ctx.strokeStyle = ef.subColor;
      ctx.lineWidth = 3.5 * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, currR * 0.9, -hAng * 0.9, hAng * 0.9);
      ctx.stroke();
    }
  } else if (ef.type === 'fissure_line') {
    ctx.strokeStyle = ef.color || '#FFFFFF';
    ctx.lineWidth = (ef.width || 40) * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ef.x, ef.y);
    ctx.lineTo(ef.endX, ef.endY);
    ctx.stroke();
  } else if (ef.type === 'electric_slash') {
    ctx.strokeStyle = ef.color || '#FF1744';
    ctx.lineWidth = 12 * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ef.x, ef.y);
    ctx.lineTo(ef.endX, ef.endY);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4 * alpha;
    ctx.stroke();
  } else if (ef.type === 'massive_seaquake') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = (ef.width || 80) * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ef.x, ef.y);
    ctx.lineTo(ef.endX, ef.endY);
    ctx.stroke();
    ctx.strokeStyle = ef.subColor || '#FF1744';
    ctx.lineWidth = 6 * alpha;
    ctx.stroke();
  } else if (ef.type === 'divine_x') {
    ctx.strokeStyle = ef.color || '#FF1744';
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.moveTo(ef.x - ef.range, ef.y - ef.range);
    ctx.lineTo(ef.x + ef.range, ef.y + ef.range);
    ctx.moveTo(ef.x + ef.range, ef.y - ef.range);
    ctx.lineTo(ef.x - ef.range, ef.y + ef.range);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3 * alpha;
    ctx.stroke();
  } else if (ef.type === 'red_hawk_explosion') {
    // Explosión ígnea de Red Hawk (escala completa 300px en H1, escala reducida 130px en Jet Bazooka)
    const prog = 1 - alpha;
    const curR = ef.range * (0.35 + prog * 0.65);

    // Halo de llamas exterior con gradiente radial
    const flameGrad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.15, ef.x, ef.y, curR);
    flameGrad.addColorStop(0, `rgba(255, 245, 157, ${0.95 * alpha})`);
    flameGrad.addColorStop(0.45, `rgba(255, 87, 34, ${0.85 * alpha})`);
    flameGrad.addColorStop(0.8, `rgba(213, 0, 0, ${0.55 * alpha})`);
    flameGrad.addColorStop(1, 'rgba(213, 0, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    // Puntas de llamas radiales escaladas proporcionalmente
    ctx.strokeStyle = `rgba(255, 145, 0, ${0.9 * alpha})`;
    ctx.lineWidth = Math.max(3, ef.range * 0.035) * alpha;
    ctx.lineCap = 'round';
    for (let s = 0; s < 10; s++) {
      const sa = (s / 10) * Math.PI * 2 + prog * 0.6;
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(sa) * curR * 0.42, ef.y + Math.sin(sa) * curR * 0.42);
      ctx.lineTo(ef.x + Math.cos(sa) * curR * 0.96, ef.y + Math.sin(sa) * curR * 0.96);
      ctx.stroke();
    }

    // Núcleo compacto de Haki Busoshoku + anillo expansivo naranja-rojo
    ctx.fillStyle = `rgba(24, 24, 27, ${0.88 * alpha})`;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = Math.max(3, ef.range * 0.028) * alpha;
    ctx.stroke();

    ctx.strokeStyle = '#FFEB3B';
    ctx.lineWidth = Math.max(2, ef.range * 0.02) * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.92, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'kkg_impact') {
    // Explosión King Kong Gun: onda expansiva Haki Busoshoku + rayos Haoshoku + destello central
    const prog = 1 - alpha;
    const curR = ef.range * (0.32 + easeOutQuart(prog) * 0.68);
    const col = ef.color || '#111111';
    const sub = ef.subColor || '#FF1744';

    // Halo radial carmesí-negro (sin tapar todo con un disco negro sólido)
    const auraGrad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    auraGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * alpha})`);
    auraGrad.addColorStop(0.28, `rgba(255, 23, 68, ${0.68 * alpha})`);
    auraGrad.addColorStop(0.62, `rgba(20, 20, 24, ${0.55 * alpha})`);
    auraGrad.addColorStop(1, 'rgba(17, 17, 17, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    // Puntas de onda expansiva radiales
    ctx.strokeStyle = sub;
    ctx.lineWidth = 4.5 * alpha;
    ctx.beginPath();
    for (let s = 0; s < 16; s++) {
      const a = (s / 16) * Math.PI * 2 + prog * 0.35;
      const rIn = curR * 0.30;
      const rOut = curR * (s % 2 === 0 ? 0.96 : 0.72);
      ctx.moveTo(ef.x + Math.cos(a) * rIn, ef.y + Math.sin(a) * rIn);
      ctx.lineTo(ef.x + Math.cos(a) * rOut, ef.y + Math.sin(a) * rOut);
    }
    ctx.stroke();

    // Rayos negros y rojos de Haki del Rey
    for (let b = 0; b < 10; b++) {
      const ba = (b / 10) * Math.PI * 2 - prog * 0.45;
      ctx.strokeStyle = b % 2 === 0 ? col : sub;
      ctx.lineWidth = (b % 2 === 0 ? 5 : 3.5) * alpha;
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(ba) * 18, ef.y + Math.sin(ba) * 18);
      ctx.lineTo(ef.x + Math.cos(ba + 0.16) * curR * 0.54, ef.y + Math.sin(ba + 0.16) * curR * 0.54);
      ctx.lineTo(ef.x + Math.cos(ba - 0.10) * curR * 0.94, ef.y + Math.sin(ba - 0.10) * curR * 0.94);
      ctx.stroke();
    }

    // Doble anillo de choque exterior
    ctx.strokeStyle = sub;
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.76, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'kkg_punch') {
    // Brazo gigante inflado + puño colosal de Haki disparado hacia el impacto
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    const ext = easeOutQuart(Math.min(1, progress / 0.34));
    const reach = (ef.range || 175) * ext;
    const fistR = (ef.width || 58) * (0.72 + 0.28 * ext);
    const sub = ef.subColor || '#FF1744';

    // Brazo de goma-Haki (blanco en G5 o piel en PTS -> negro Busoshoku)
    const armGrad = ctx.createLinearGradient(12, 0, reach, 0);
    armGrad.addColorStop(0, ef.isG5 ? '#FFFFFF' : '#FFCC80');
    armGrad.addColorStop(0.28, ef.isG5 ? '#E0E0E0' : '#FFCC80');
    armGrad.addColorStop(0.45, '#1C1C22');
    armGrad.addColorStop(1, '#0E0E12');
    ctx.fillStyle = armGrad;
    ctx.strokeStyle = sub;
    ctx.lineWidth = 3.5 * alpha;
    ctx.beginPath();
    ctx.moveTo(12, -fistR * 0.28);
    ctx.quadraticCurveTo(reach * 0.5, -fistR * 0.42, reach - fistR * 0.35, -fistR * 0.56);
    ctx.lineTo(reach - fistR * 0.35, fistR * 0.56);
    ctx.quadraticCurveTo(reach * 0.5, fistR * 0.42, 12, fistR * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Estela de velocidad alrededor del brazo gigante
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * alpha})`;
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.ellipse(reach * 0.55, 0, 10, fistR * 0.72, 0, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();

    // Puño colosal King Kong Gun
    ctx.save();
    ctx.translate(reach, 0);
    ctx.fillStyle = '#111116';
    ctx.strokeStyle = sub;
    ctx.lineWidth = 4.2 * alpha;
    ctx.beginPath();
    ctx.roundRect(-fistR * 0.65, -fistR * 0.85, fistR * 1.35, fistR * 1.7, fistR * 0.42);
    ctx.fill();
    ctx.stroke();

    // Brillo rojo de Haki y nudillos
    ctx.fillStyle = '#2B2B34';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.arc(fistR * 0.44, k * fistR * 0.44, fistR * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  } else if (ef.type === 'red_hawk_punch') {
    // Finisher de Red Hawk: brazo Busoshoku envuelto en llamas + puño ígneo impactando
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    const ext = easeOutQuart(Math.min(1, progress / 0.32));
    const reach = (ef.range || 160) * ext;
    const fistR = (ef.width || 46) * (0.75 + 0.25 * ext);

    // Estela de fuego envolviendo todo el golpe
    const flameTrail = ctx.createLinearGradient(10, 0, reach + fistR, 0);
    flameTrail.addColorStop(0, 'rgba(255, 87, 34, 0)');
    flameTrail.addColorStop(0.4, `rgba(255, 87, 34, ${0.65 * alpha})`);
    flameTrail.addColorStop(0.85, `rgba(255, 235, 59, ${0.9 * alpha})`);
    flameTrail.addColorStop(1, 'rgba(255, 235, 59, 0)');
    ctx.fillStyle = flameTrail;
    ctx.beginPath();
    ctx.moveTo(10, -fistR * 0.55);
    ctx.quadraticCurveTo(reach * 0.6, -fistR * 0.95, reach + fistR * 0.4, 0);
    ctx.quadraticCurveTo(reach * 0.6, fistR * 0.95, 10, fistR * 0.55);
    ctx.closePath();
    ctx.fill();

    // Brazo de goma -> Haki negro -> fuego
    const armGrad = ctx.createLinearGradient(12, 0, reach, 0);
    armGrad.addColorStop(0, '#FFCC80');
    armGrad.addColorStop(0.32, '#FFCC80');
    armGrad.addColorStop(0.55, '#1C1C1C');
    armGrad.addColorStop(1, '#BF360C');
    ctx.fillStyle = armGrad;
    ctx.strokeStyle = '#FF5722';
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.moveTo(12, -fistR * 0.26);
    ctx.quadraticCurveTo(reach * 0.5, -fistR * 0.38, reach - fistR * 0.3, -fistR * 0.52);
    ctx.lineTo(reach - fistR * 0.3, fistR * 0.52);
    ctx.quadraticCurveTo(reach * 0.5, fistR * 0.38, 12, fistR * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Puño ígneo de Red Hawk
    ctx.save();
    ctx.translate(reach, 0);
    ctx.fillStyle = '#D50000';
    ctx.strokeStyle = '#FFEB3B';
    ctx.lineWidth = 3.8 * alpha;
    ctx.beginPath();
    ctx.roundRect(-fistR * 0.6, -fistR * 0.78, fistR * 1.25, fistR * 1.56, fistR * 0.38);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF9100';
    ctx.beginPath();
    ctx.roundRect(-fistR * 0.32, -fistR * 0.48, fistR * 0.72, fistR * 0.96, fistR * 0.24);
    ctx.fill();
    ctx.restore();
  } else if (ef.type === 'gomu_ono') {
    // Luffy inicio finisher: pierna gigante estirada cayendo como hacha + cráter
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    const slam = easeOutQuart(Math.min(1, progress / 0.32));
    const impactDist = Math.hypot((ef.endX ?? ef.x + 72) - ef.x, (ef.endY ?? ef.y) - ef.y);
    const liftY = (1 - slam) * -44;

    // Pierna estirándose desde Luffy hasta el punto de caída
    ctx.fillStyle = ef.armColor || '#FFCC80';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.quadraticCurveTo(impactDist * 0.5, liftY * 0.6 - 7, impactDist - 8, liftY - 12);
    ctx.lineTo(impactDist - 8, liftY + 12);
    ctx.quadraticCurveTo(impactDist * 0.5, liftY * 0.6 + 7, 10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sandalia / pie grande golpeando el suelo
    ctx.save();
    ctx.translate(impactDist, liftY);
    ctx.fillStyle = '#FFCC80';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-14, -18, 28, 36, 9);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#C8102E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-6, -15);
    ctx.lineTo(8, 0);
    ctx.lineTo(-6, 15);
    ctx.stroke();
    ctx.restore();

    // Onda dorada en arco descendente
    if (slam > 0.4) {
      ctx.strokeStyle = ef.color || '#F5C518';
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.arc(impactDist, 0, 42 + progress * 48, -Math.PI * 0.65, Math.PI * 0.65);
      ctx.stroke();
    }
  } else if (ef.type === 'bazooka_blast') {
    // Onda expansiva direccional de choque tras impactar ambas palmas (Bazooka / Jet Bazooka)
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    const hAng = ef.halfAngle || Math.PI / 3.2;
    const curR = ef.range * (0.35 + easeOutQuart(progress) * 0.65);
    ctx.fillStyle = ef.color === '#FF5722'
      ? `rgba(255, 87, 34, ${0.28 * alpha})`
      : `rgba(245, 197, 24, ${0.26 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, curR, -hAng, hAng);
    ctx.closePath();
    ctx.fill();

    drawTaperedCrescent(curR, -hAng, hAng, 16 * alpha, ef.color || '#F5C518', '#FFFFFF');
    drawTaperedCrescent(curR * 0.68, -hAng * 0.85, hAng * 0.85, 8 * alpha, '#FFFFFF', null);
  } else if (ef.type === 'sanji_kick_thrust') {
    // Patada recta de Sanji (pantalón oscuro + zapato + estela cinética / fuego Diable Jambe)
    const prog = Math.max(0, Math.min(1, 1 - alpha));
    const ext = prog < 0.55 ? 1 - Math.pow(1 - prog / 0.55, 2.2) : (prog < 0.72 ? 1 : 1 - ((prog - 0.72) / 0.28) * 0.7);
    const startDist = 14;
    const curLen = startDist + (ef.range - startDist) * ext;
    const perp = ef.angle + Math.PI / 2;
    const ox = (ef.followPlayer && STATE.player)
      ? STATE.player.x + Math.cos(perp) * (ef.armOffset || 0)
      : ef.x;
    const oy = (ef.followPlayer && STATE.player)
      ? STATE.player.y + Math.sin(perp) * (ef.armOffset || 0)
      : ef.y;

    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);

    // Aura o estela de fuego/viento de la patada
    if (ef.isFire) {
      const fireGrad = ctx.createLinearGradient(startDist, 0, curLen + 14, 0);
      fireGrad.addColorStop(0, 'rgba(255, 152, 0, 0.15)');
      fireGrad.addColorStop(0.55, `rgba(255, 87, 34, ${0.75 * alpha})`);
      fireGrad.addColorStop(1, `rgba(255, 235, 59, ${0.95 * alpha})`);
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.ellipse((startDist + curLen) * 0.55, 0, curLen * 0.52, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.75)';
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.moveTo(startDist, -9);
      ctx.lineTo(curLen - 4, -4);
      ctx.moveTo(startDist, 9);
      ctx.lineTo(curLen - 4, 4);
      ctx.stroke();
    }

    // Pierna de traje negro
    ctx.fillStyle = '#1C2833';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(startDist, -6.5);
    ctx.lineTo(curLen - 12, -5.2);
    ctx.lineTo(curLen - 12, 5.2);
    ctx.lineTo(startDist, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Zapato elegante negro (brillando en rojo/oro si es Diable Jambe)
    ctx.fillStyle = ef.isFire ? '#BF360C' : '#111111';
    ctx.strokeStyle = ef.isFire ? '#FFEB3B' : '#000000';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(curLen - 14, -7.5);
    ctx.lineTo(curLen + 8, -4.5);
    ctx.lineTo(curLen + 12, 0);
    ctx.lineTo(curLen + 6, 7.5);
    ctx.lineTo(curLen - 14, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (ext > 0.85) {
      ctx.strokeStyle = ef.isFire ? '#FFEB3B' : '#FFFFFF';
      ctx.lineWidth = 2.8 * alpha;
      ctx.beginPath();
      ctx.arc(curLen + 4, 0, 14, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
  } else if (ef.type === 'sanji_kick_arc') {
    // Patada giratoria en arco de Sanji (con llamas si es Diable Jambe)
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 3.4;
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.24) / 0.76)) * 0.58;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;

    if (ef.isFire) {
      drawTaperedCrescent(ef.range, startA, endA, 22 * Math.max(0.45, alpha), '#FF5722', '#FFEB3B');
      drawTaperedCrescent(ef.range * 0.82, startA * 0.9, endA * 0.9, 10 * alpha, '#FF9100', '#FFFFFF');
    } else {
      drawTaperedCrescent(ef.range, startA, endA, 15 * Math.max(0.45, alpha), '#FFA726', '#FFFFFF');
    }

    // Pierna y zapato barriendo en el borde de avance del arco
    ctx.save();
    ctx.rotate(endA);
    ctx.fillStyle = '#1C2833';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(14, -5, Math.max(22, ef.range - 30), 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ef.isFire ? '#D84315' : '#111111';
    ctx.strokeStyle = ef.isFire ? '#FFEB3B' : '#000000';
    ctx.beginPath();
    ctx.roundRect(ef.range - 20, -6.5, 18, 13, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (ef.type === 'sanji_heel_drop') {
    // Patada descendente / Concasse: impacto de talón + ondas concéntricas (oro o fuego Diable)
    const prog = 1 - alpha;
    const curR = ef.range * (0.35 + easeOutQuart(prog) * 0.65);
    const outerCol = ef.isFire ? '#FF5722' : '#FFA726';
    const innerCol = ef.isFire ? '#FFEB3B' : '#FFFFFF';

    const grad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    grad.addColorStop(0, ef.isFire ? `rgba(255, 235, 59, ${0.72 * alpha})` : `rgba(255, 255, 255, ${0.55 * alpha})`);
    grad.addColorStop(0.55, ef.isFire ? `rgba(255, 87, 34, ${0.42 * alpha})` : `rgba(255, 167, 38, ${0.28 * alpha})`);
    grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    // Anillo principal + onda secundaria
    ctx.strokeStyle = outerCol;
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = innerCol;
    ctx.lineWidth = 3.2 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // Estela vertical del taconazo descendente + zapato impactando
    ctx.save();
    ctx.translate(ef.x, ef.y);
    const dropOffset = (1 - easeOutQuart(Math.min(1, prog / 0.35))) * -42;
    ctx.strokeStyle = outerCol;
    ctx.lineWidth = 10 * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, dropOffset - 46);
    ctx.lineTo(0, dropOffset);
    ctx.stroke();
    ctx.fillStyle = ef.isFire ? '#D84315' : '#111111';
    ctx.strokeStyle = innerCol;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-11, dropOffset - 8, 22, 16, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (ef.type === 'black_haki_ball') {
    const prog = 1 - alpha;
    const curR = ef.range * (0.35 + prog * 0.65);
    ctx.fillStyle = ef.color || '#111111';
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ef.subColor || '#FF1744';
    ctx.lineWidth = 6 * alpha;
    ctx.stroke();
  } else if (ef.type === 'marine_saber_arc') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 3.5;
    const headT = easeOutQuart(Math.min(1, progress / 0.38));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.28) / 0.72)) * 0.6;
    drawTaperedCrescent(ef.range, -hAng + (2 * hAng) * tailT, -hAng + (2 * hAng) * headT, 9 * Math.max(0.4, alpha), '#CFD8DC', '#FFFFFF');
  } else if (ef.type === 'sanzen_final') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (60 * Math.PI) / 180;
    const headT = easeOutQuart(Math.min(1, progress / 0.34));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.25) / 0.75)) * 0.55;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;
    ctx.fillStyle = 'rgba(165, 214, 167, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ef.range, -hAng, endA);
    ctx.closePath();
    ctx.fill();
    drawTaperedCrescent(ef.range, startA, endA, 18 * Math.max(0.45, alpha), '#66BB6A', '#FFFFFF');
    drawTaperedCrescent(ef.range * 0.78, startA * 0.9, endA * 0.9, 8 * alpha, '#FFFFFF', null);
  } else if (ef.type === 'stretch') {
    const prog = Math.max(0, Math.min(1, 1 - alpha));
    let ext: number;
    if (prog < 0.55) {
      const tOut = prog / 0.55;
      ext = 1 - Math.pow(1 - tOut, 2.2);
    } else if (prog < 0.72) {
      ext = 1.0;
    } else {
      const tBack = (prog - 0.72) / 0.28;
      ext = 1.0 - tBack * 0.76;
    }
    const startDist = 14;
    const curLen = startDist + (ef.range - startDist) * ext;
    const perp = ef.angle + Math.PI / 2;
    const ox = (ef.followPlayer && STATE.player)
      ? STATE.player.x + Math.cos(perp) * (ef.armOffset || 0)
      : ef.x;
    const oy = (ef.followPlayer && STATE.player)
      ? STATE.player.y + Math.sin(perp) * (ef.armOffset || 0)
      : ef.y;

    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);

    if (ef.isRubberArm) {
      const baseHalfW = 7.5;
      const midHalfW = Math.max(3.6, 6.2 - ext * 2.3);
      const wristHalfW = 6.8;
      const midLen = startDist + (curLen - startDist) * 0.52;

      ctx.beginPath();
      ctx.moveTo(startDist, -baseHalfW);
      ctx.quadraticCurveTo(midLen, -midHalfW, curLen - 6, -wristHalfW);
      ctx.lineTo(curLen - 6, wristHalfW);
      ctx.quadraticCurveTo(midLen, midHalfW, startDist, baseHalfW);
      ctx.closePath();

      if (ef.hakiArm) {
        const armGrad = ctx.createLinearGradient(startDist, 0, curLen, 0);
        armGrad.addColorStop(0, ef.armColor || '#FFCC80');
        armGrad.addColorStop(0.55, ef.armColor || '#FFCC80');
        armGrad.addColorStop(0.72, '#212121');
        armGrad.addColorStop(1, ef.isRedHawk ? '#B71C1C' : '#111111');
        ctx.fillStyle = armGrad;
      } else {
        ctx.fillStyle = ef.armColor || '#FFCC80';
      }
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Estela sutil de velocidad/goma alrededor del brazo estirado
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 2.0;
      ctx.globalAlpha = alpha * 0.65;
      ctx.beginPath();
      ctx.moveTo(startDist + 6, 0);
      ctx.lineTo(curLen - 8, 0);
      ctx.stroke();
      ctx.globalAlpha = alpha;

      // Puño o palma abierta Bazooka al extremo del estiramiento
      ctx.save();
      ctx.translate(curLen, 0);
      ctx.fillStyle = ef.isRedHawk ? '#FF3D00' : (ef.hakiArm ? '#1C1C1C' : (ef.armColor || '#FFCC80'));
      ctx.strokeStyle = ef.isRedHawk ? '#FFEB3B' : '#111111';
      ctx.lineWidth = 2.5;
      if (ef.isBazookaPalm) {
        ctx.beginPath();
        ctx.roundRect(-7, -14, 18, 28, 7);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.roundRect(-8, -10.5, 18, 21, 6);
        ctx.fill();
        ctx.stroke();

        // Nudillos / dedo pulgar para leerlo como puño y no círculo
        ctx.fillStyle = ef.hakiArm ? '#333333' : '#FFE0B2';
        ctx.beginPath();
        ctx.arc(4, -5.5, 2.5, 0, Math.PI * 2);
        ctx.arc(4, 0, 2.5, 0, Math.PI * 2);
        ctx.arc(4, 5.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (ext >= 0.85) {
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = ef.isBazookaPalm ? 3.4 : 2.6;
        ctx.beginPath();
        ctx.arc(4, 0, (ef.isBazookaPalm ? 18 : 14) + (1 - ext) * 20, -Math.PI * 0.58, Math.PI * 0.58);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startDist, 0);
      ctx.lineTo(curLen, 0);
      ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(curLen, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ef.type === 'kaido_kanabo_arc') {
    // Swing pesado del kanabo con arco carmesí oscuro, Haki negro y chispas Haoshoku
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (75 * Math.PI) / 180;
    const curR = ef.range * (0.48 + easeOutQuart(progress) * 0.52);
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.24) / 0.76)) * 0.58;
    const dir = ef.reverse ? -1 : 1;
    const startA = dir * (-hAng + (2 * hAng) * tailT);
    const endA = dir * (-hAng + (2 * hAng) * headT);

    drawTaperedCrescent(curR, Math.min(startA, endA), Math.max(startA, endA), 22 * Math.max(0.45, alpha), '#8E0000', '#111116');
    drawTaperedCrescent(curR * 0.86, Math.min(startA, endA) * 0.92, Math.max(startA, endA) * 0.92, 7 * alpha, '#FF1744', null);

    // Chispas negras y carmesí de Haki del Conquistador en el filo
    for (let s = 0; s < 5; s++) {
      const sa = startA + (endA - startA) * (s / 4);
      const rMid = curR * 0.92;
      ctx.strokeStyle = s % 2 === 0 ? '#FF1744' : '#111116';
      ctx.lineWidth = 2.6 * alpha;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * (rMid - 10), Math.sin(sa) * (rMid - 10));
      ctx.lineTo(Math.cos(sa + 0.08 * dir) * (rMid + 12), Math.sin(sa + 0.08 * dir) * (rMid + 12));
      ctx.stroke();
    }
  } else if (ef.type === 'kaido_slam') {
    // Impacto vertical del kanabo con grieta compacta y onda expansiva oscura-carmesí
    const prog = 1 - alpha;
    const curR = ef.range * (0.32 + easeOutQuart(prog) * 0.68);
    const grad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    grad.addColorStop(0, `rgba(255, 23, 68, ${0.48 * alpha})`);
    grad.addColorStop(0.55, `rgba(24, 14, 18, ${0.42 * alpha})`);
    grad.addColorStop(1, 'rgba(17, 17, 17, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111116';
    ctx.lineWidth = 9 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    for (let r = 0; r < 6; r++) {
      const ra = (r / 6) * Math.PI * 2 + 0.25;
      ctx.strokeStyle = r % 2 === 0 ? '#111116' : '#B71C1C';
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(ra) * 10, ef.y + Math.sin(ra) * 10);
      ctx.lineTo(ef.x + Math.cos(ra + 0.14) * curR * 0.52, ef.y + Math.sin(ra + 0.14) * curR * 0.52);
      ctx.lineTo(ef.x + Math.cos(ra - 0.08) * curR * 0.88, ef.y + Math.sin(ra - 0.08) * curR * 0.88);
      ctx.stroke();
    }
  } else if (ef.type === 'kaido_thunder_bagua') {
    // Thunder Bagua: estallido de alta velocidad con rayos negros y carmesí de Haki del Conquistador
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle || 0);
    const ext = easeOutQuart(Math.min(1, progress / 0.25));
    const len = (ef.range || 280) * ext;
    const hw = ef.width || 56;

    // Estela cónica explosiva oscura y carmesí
    const beamGrad = ctx.createLinearGradient(0, 0, len, 0);
    beamGrad.addColorStop(0, `rgba(17, 17, 22, ${0.82 * alpha})`);
    beamGrad.addColorStop(0.55, `rgba(183, 28, 28, ${0.78 * alpha})`);
    beamGrad.addColorStop(1, `rgba(255, 23, 68, 0)`);
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(0, -hw * 0.35);
    ctx.lineTo(len, -hw * 0.95);
    ctx.lineTo(len * 1.08, 0);
    ctx.lineTo(len, hw * 0.95);
    ctx.lineTo(0, hw * 0.35);
    ctx.closePath();
    ctx.fill();

    // Núcleo negro sólido de Haki + borde blanco-carmesí
    drawTaperedSlashLine(0, 0, len, 0, hw * 0.85 * alpha, '#111116', '#FF1744', progress);

    // Rayos negros y carmesí en zig-zag disparados hacia adelante
    for (let b = -2; b <= 2; b++) {
      const yOff = b * (hw * 0.32);
      ctx.strokeStyle = Math.abs(b) % 2 === 0 ? '#FF1744' : '#111116';
      ctx.lineWidth = (b === 0 ? 4.5 : 3) * alpha;
      ctx.beginPath();
      ctx.moveTo(10, yOff * 0.3);
      ctx.lineTo(len * 0.35, yOff + (b % 2 === 0 ? 12 : -12));
      ctx.lineTo(len * 0.7, yOff - (b % 2 === 0 ? 10 : -10));
      ctx.lineTo(len * 1.02, yOff * 1.25);
      ctx.stroke();
    }

    // Explosión frontal del golpe del kanabo
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 6 * alpha;
    ctx.beginPath();
    ctx.arc(len * 0.88, 0, hw * (0.65 + progress * 0.45), -Math.PI * 0.65, Math.PI * 0.65);
    ctx.stroke();
  } else if (ef.type === 'kaido_ragnaraku_impact') {
    // Ragnaraku: cúpula de Haki carmesí y negro + relámpagos Haoshoku
    const prog = 1 - alpha;
    const curR = ef.range * (0.3 + easeOutQuart(prog) * 0.7);
    const domeGrad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    domeGrad.addColorStop(0, `rgba(255, 255, 255, ${0.75 * alpha})`);
    domeGrad.addColorStop(0.28, `rgba(255, 23, 68, ${0.65 * alpha})`);
    domeGrad.addColorStop(0.65, `rgba(20, 12, 18, ${0.58 * alpha})`);
    domeGrad.addColorStop(1, 'rgba(17, 17, 17, 0)');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    for (let b = 0; b < 12; b++) {
      const ba = (b / 12) * Math.PI * 2 + prog * 0.4;
      ctx.strokeStyle = b % 2 === 0 ? '#111116' : '#FF1744';
      ctx.lineWidth = (b % 2 === 0 ? 5.5 : 3.8) * alpha;
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(ba) * 16, ef.y + Math.sin(ba) * 16);
      ctx.lineTo(ef.x + Math.cos(ba + 0.18) * curR * 0.55, ef.y + Math.sin(ba + 0.18) * curR * 0.55);
      ctx.lineTo(ef.x + Math.cos(ba - 0.12) * curR * 0.98, ef.y + Math.sin(ba - 0.12) * curR * 0.98);
      ctx.stroke();
    }

    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#111116';
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.78, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'kaido_dragon_claw') {
    // 3 garras dracónicas azur y Haki carmesí-negro
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (75 * Math.PI) / 180;
    const headT = easeOutQuart(Math.min(1, progress / 0.34));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.22) / 0.78)) * 0.55;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;

    for (let c = 0; c < 3; c++) {
      const rScale = 0.76 + c * 0.12;
      drawTaperedCrescent(ef.range * rScale, startA, endA, 13 * Math.max(0.42, alpha), c === 1 ? '#00B0FF' : '#FF1744', '#E1F5FE');
    }
  } else if (ef.type === 'kaido_dragon_tail') {
    // Coletazo masivo con escamas azur y ráfagas de viento
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || (110 * Math.PI) / 180;
    const headT = easeOutQuart(Math.min(1, progress / 0.34));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.22) / 0.78)) * 0.52;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;

    drawTaperedCrescent(ef.range, startA, endA, 24 * Math.max(0.45, alpha), '#0288D1', '#FFFFFF');
    drawTaperedCrescent(ef.range * 0.85, startA * 0.9, endA * 0.9, 10 * alpha, '#FF1744', '#111116');
  } else if (ef.type === 'kaido_flame_burst') {
    // Erupción dracónica de fuego y relámpagos carmesí/oro
    const prog = 1 - alpha;
    const curR = ef.range * (0.28 + easeOutQuart(prog) * 0.72);
    const grad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.12, ef.x, ef.y, curR);
    grad.addColorStop(0, `rgba(255, 245, 157, ${0.95 * alpha})`);
    grad.addColorStop(0.35, `rgba(255, 109, 0, ${0.78 * alpha})`);
    grad.addColorStop(0.7, `rgba(213, 0, 0, ${0.52 * alpha})`);
    grad.addColorStop(1, 'rgba(213, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 4.5 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    for (let b = 0; b < 10; b++) {
      const ba = (b / 10) * Math.PI * 2 - prog * 0.5;
      ctx.strokeStyle = b % 2 === 0 ? '#40C4FF' : '#FFEB3B';
      ctx.lineWidth = 3.2 * alpha;
      ctx.beginPath();
      ctx.moveTo(ef.x + Math.cos(ba) * curR * 0.25, ef.y + Math.sin(ba) * curR * 0.25);
      ctx.lineTo(ef.x + Math.cos(ba + 0.16) * curR * 0.62, ef.y + Math.sin(ba + 0.16) * curR * 0.62);
      ctx.lineTo(ef.x + Math.cos(ba - 0.12) * curR * 0.96, ef.y + Math.sin(ba - 0.12) * curR * 0.96);
      ctx.stroke();
    }
  } else if (ef.type === 'vanguard_slam') {
    const curR = ef.range * (0.3 + easeOutQuart(progress) * 0.7);
    ctx.fillStyle = `rgba(144, 202, 249, ${0.28 * alpha})`;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 5.5 * alpha;
    ctx.stroke();
  } else if (ef.type === 'swordsman_lunge') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 3.2;
    const headT = easeOutQuart(Math.min(1, progress / 0.32));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.22) / 0.78)) * 0.6;
    drawTaperedCrescent(ef.range, -hAng + 2 * hAng * tailT, -hAng + 2 * hAng * headT, 11 * alpha, '#80D8FF', '#FFFFFF');
  } else if (ef.type === 'morgan_axe_cleave') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 2.0;
    const headT = easeOutQuart(Math.min(1, progress / 0.34));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.22) / 0.78)) * 0.52;
    const startA = -hAng + 2 * hAng * tailT;
    const endA = -hAng + 2 * hAng * headT;
    drawTaperedCrescent(ef.range, startA, endA, 22 * Math.max(0.45, alpha), ef.subColor || '#1565C0', '#FFFFFF');
    drawTaperedCrescent(ef.range * 0.82, startA * 0.88, endA * 0.88, 11 * alpha, '#CFD8DC', '#FFFFFF');
  } else if (ef.type === 'kizaru_kick_thrust') {
    // Patada recta de Kizaru: base de traje amarillo -> punta dorada envuelta en luz blanca/oro
    const prog = Math.max(0, Math.min(1, 1 - alpha));
    const ext = prog < 0.55 ? 1 - Math.pow(1 - prog / 0.55, 2.2) : (prog < 0.74 ? 1 : 1 - ((prog - 0.74) / 0.26) * 0.68);
    const startDist = 14;
    const curLen = startDist + (ef.range - startDist) * ext;
    const perp = ef.angle + Math.PI / 2;
    const ox = (ef.followPlayer && STATE.player)
      ? STATE.player.x + Math.cos(perp) * (ef.armOffset || 0)
      : ef.x;
    const oy = (ef.followPlayer && STATE.player)
      ? STATE.player.y + Math.sin(perp) * (ef.armOffset || 0)
      : ef.y;

    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);

    // Gradiente de pierna: amarillo de traje en la base hacia luz dorada/blanca en la punta
    const legGrad = ctx.createLinearGradient(startDist, 0, curLen + 12, 0);
    legGrad.addColorStop(0, '#FBC02D');
    legGrad.addColorStop(0.55, '#FFD54F');
    legGrad.addColorStop(0.85, '#FFF59D');
    legGrad.addColorStop(1, '#FFFFFF');

    ctx.fillStyle = legGrad;
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(startDist, -7.2);
    ctx.lineTo(curLen - 12, -5.5);
    ctx.lineTo(curLen - 12, 5.5);
    ctx.lineTo(startDist, 7.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Zapato / punta envuelta en aura luminosa dorada
    ctx.fillStyle = 'rgba(255, 245, 157, 0.55)';
    ctx.beginPath();
    ctx.arc(curLen + 2, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(curLen, 0, 13, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (ext > 0.78) {
      ctx.strokeStyle = '#FFF59D';
      ctx.lineWidth = 2.6 * alpha;
      ctx.beginPath();
      ctx.arc(curLen + 6, 0, 16, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
    }

    if (ef.hasLightTrail) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
      ctx.lineWidth = 4 * alpha;
      ctx.beginPath();
      ctx.moveTo(startDist, 0);
      ctx.lineTo(curLen + 8, 0);
      ctx.stroke();
    }
  } else if (ef.type === 'kizaru_kick_swipe') {
    // Barrido de pierna (NO arco de espada) con gradiente amarillo de traje a punta luminosa + abanico de luz en el remate
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 3;
    const dir = ef.swingDir || 1;
    const headT = easeOutQuart(Math.min(1, progress / 0.36));
    const curAng = dir * (-hAng + 2 * hAng * headT);

    if (ef.isFinisher) {
      // Onda en abanico de luz dorada (fan shockwave) al final del combo
      const fanR = ef.range * (0.45 + easeOutQuart(progress) * 0.55);
      const fanGrad = ctx.createRadialGradient(0, 0, 18, 0, 0, fanR);
      fanGrad.addColorStop(0, `rgba(255, 255, 255, ${0.75 * alpha})`);
      fanGrad.addColorStop(0.55, `rgba(255, 245, 157, ${0.42 * alpha})`);
      fanGrad.addColorStop(1, 'rgba(251, 192, 45, 0)');
      ctx.fillStyle = fanGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, fanR, -hAng, hAng);
      ctx.closePath();
      ctx.fill();

      // Rayos radiales del abanico de luz
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.88 * alpha})`;
      ctx.lineWidth = 3.2 * alpha;
      for (let rIdx = -3; rIdx <= 3; rIdx++) {
        const ra = (rIdx / 3) * hAng * 0.9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ra) * 26, Math.sin(ra) * 26);
        ctx.lineTo(Math.cos(ra) * fanR, Math.sin(ra) * fanR);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255, 213, 79, ${0.95 * alpha})`;
      ctx.lineWidth = 6 * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, fanR * 0.94, -hAng, hAng);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255, 245, 157, ${0.58 * alpha})`;
      ctx.lineWidth = 10 * alpha;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, ef.range * 0.78, Math.min(-hAng * dir, curAng), Math.max(-hAng * dir, curAng));
      ctx.stroke();
    }

    // Pierna barriendo (traje amarillo en la base -> luz dorada en la punta)
    ctx.save();
    ctx.rotate(curAng);
    const legLen = Math.min(ef.range - 16, 104);
    const legGrad = ctx.createLinearGradient(14, 0, legLen + 14, 0);
    legGrad.addColorStop(0, '#FBC02D');
    legGrad.addColorStop(0.52, '#FFD54F');
    legGrad.addColorStop(0.84, '#FFF59D');
    legGrad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = legGrad;
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.roundRect(14, -6.5, legLen, 13, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 245, 157, 0.72)';
    ctx.beginPath();
    ctx.arc(legLen + 10, 0, ef.isFinisher ? 18 : 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(legLen + 12, 0, 12, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (ef.type === 'kizaru_ground_stomp') {
    // Patadón fuerte al suelo de Kizaru: onda de choque concéntrica dorada y destello luminoso
    const prog = 1 - alpha;
    const curR = ef.range * (0.32 + easeOutQuart(prog) * 0.68);
    const grad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.75 * alpha})`);
    grad.addColorStop(0.5, `rgba(255, 213, 79, ${0.45 * alpha})`);
    grad.addColorStop(1, 'rgba(251, 192, 45, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 213, 79, ${0.9 * alpha})`;
    ctx.lineWidth = 6 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.lineWidth = 3.2 * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'kizaru_light_blink') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const len = ef.range || 230;
    ctx.strokeStyle = `rgba(255, 245, 157, ${0.85 * alpha})`;
    ctx.lineWidth = 14 * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.lineWidth = 5 * alpha;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  } else if (ef.type === 'kizaru_light_strike') {
    const prog = Math.max(0, Math.min(1, 1 - alpha));
    const ext = prog < 0.5 ? 1 - Math.pow(1 - prog / 0.5, 2.2) : 1 - ((prog - 0.5) / 0.5) * 0.55;
    const startDist = 16;
    const curLen = startDist + (ef.range - startDist) * ext;
    const perp = ef.angle + Math.PI / 2;
    const ox = (ef.followPlayer && STATE.player)
      ? STATE.player.x + Math.cos(perp) * (ef.armOffset || 0)
      : ef.x;
    const oy = (ef.followPlayer && STATE.player)
      ? STATE.player.y + Math.sin(perp) * (ef.armOffset || 0)
      : ef.y;

    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);

    ctx.strokeStyle = `rgba(255, 213, 79, ${0.72 * alpha})`;
    ctx.lineWidth = (ef.hasLightTrail ? 9 : 7) * Math.max(0.45, alpha);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startDist, 0);
    ctx.lineTo(curLen, 0);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.96 * alpha})`;
    ctx.lineWidth = (ef.hasLightTrail ? 3.8 : 2.8) * Math.max(0.5, alpha);
    ctx.beginPath();
    ctx.moveTo(startDist, 0);
    ctx.lineTo(curLen + 6, 0);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(curLen + 4, 0, 5.5 * Math.max(0.45, alpha), 0, Math.PI * 2);
    ctx.fill();
  } else if (ef.type === 'kizaru_finger_glint') {
    const ox = (ef.followPlayer && STATE.player) ? STATE.player.x : ef.x;
    const oy = (ef.followPlayer && STATE.player) ? STATE.player.y : ef.y;
    const ang = (ef.followPlayer && STATE.player) ? STATE.player.facingAngle : ef.angle;
    const tipX = (STATE.player ? STATE.player.radius : 18) + 8;
    const glintScale = 0.5 + Math.sin(progress * Math.PI) * 0.9;

    ctx.translate(ox, oy);
    ctx.rotate(ang);
    ctx.translate(tipX, 7);

    ctx.fillStyle = 'rgba(255, 245, 157, 0.52)';
    ctx.beginPath();
    ctx.arc(0, 0, 14 * glintScale, 0, Math.PI * 2);
    ctx.fill();

    // Destello de estrella de 4 puntas en el dedo antes de disparar el rayo
    const rayLen = 22 * glintScale;
    const crossLen = 10 * glintScale;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(rayLen, 0);
    ctx.lineTo(2.4, -2.4);
    ctx.lineTo(0, -rayLen);
    ctx.lineTo(-2.4, -2.4);
    ctx.lineTo(-rayLen, 0);
    ctx.lineTo(-2.4, 2.4);
    ctx.lineTo(0, rayLen);
    ctx.lineTo(2.4, 2.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-crossLen, -crossLen);
    ctx.lineTo(crossLen, crossLen);
    ctx.moveTo(-crossLen, crossLen);
    ctx.lineTo(crossLen, -crossLen);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2 * glintScale, 0, Math.PI * 2);
    ctx.fill();
  } else if (ef.type === 'kizaru_sword_summon') {
    const ox = (ef.followPlayer && STATE.player) ? STATE.player.x : ef.x;
    const oy = (ef.followPlayer && STATE.player) ? STATE.player.y : ef.y;
    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);
    const r = (ef.range || 72) * (0.4 + easeOutQuart(progress) * 0.6);
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 8 * alpha;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5 * alpha;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(r * 1.06, 0);
    ctx.stroke();
  } else if (ef.type === 'kizaru_sword_swipe') {
    const ox = (ef.followPlayer && STATE.player) ? STATE.player.x : ef.x;
    const oy = (ef.followPlayer && STATE.player) ? STATE.player.y : ef.y;
    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 2.4;
    const dir = ef.swingDir || 1;
    const headT = easeOutQuart(Math.min(1, progress / 0.34));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.2) / 0.8)) * 0.56;
    const sA = dir * (-hAng + 2 * hAng * tailT);
    const eA = dir * (-hAng + 2 * hAng * headT);
    const minA = Math.min(sA, eA);
    const maxA = Math.max(sA, eA);
    drawTaperedCrescent(ef.range, minA, maxA, (ef.isLightBoosted ? 24 : 18) * Math.max(0.42, alpha), '#FFD54F', '#FFFFFF');
    drawTaperedCrescent(ef.range * 0.78, minA * 0.9, maxA * 0.9, 10 * alpha, '#FFFFFF', null);
  } else if (ef.type === 'kizaru_sword_line') {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const len = ef.range || 270;
    const w = (ef.width || 34) * Math.max(0.35, alpha);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.6, '#FFF59D');
    grad.addColorStop(1, 'rgba(251, 192, 45, 0.25)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.lineWidth = Math.max(3, w * 0.36);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  } else if (ef.type === 'kizaru_sword_finisher') {
    const ox = (ef.followPlayer && STATE.player) ? STATE.player.x : ef.x;
    const oy = (ef.followPlayer && STATE.player) ? STATE.player.y : ef.y;
    ctx.translate(ox, oy);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 2.2;
    const prog = easeOutQuart(progress);
    const curR = ef.range * (0.42 + prog * 0.58);
    drawTaperedCrescent(curR, -hAng, hAng, (ef.isLightBoosted ? 30 : 24) * Math.max(0.45, alpha), '#FFD54F', '#FFFFFF');
    drawTaperedCrescent(curR * 0.74, -hAng * 0.86, hAng * 0.86, 13 * alpha, '#FFFFFF', null);
    ctx.strokeStyle = `rgba(255, 245, 157, ${0.8 * alpha})`;
    ctx.lineWidth = 4 * alpha;
    ctx.beginPath();
    ctx.arc(0, 0, curR * 1.04, -hAng * 0.9, hAng * 0.9);
    ctx.stroke();
  } else if (ef.type === 'kizaru_light_burst' || ef.type === 'kizaru_light_explosion') {
    const prog = 1 - alpha;
    const curR = (ef.range || 60) * (0.3 + easeOutQuart(prog) * 0.7);
    const grad = ctx.createRadialGradient(ef.x, ef.y, curR * 0.1, ef.x, ef.y, curR);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * alpha})`);
    grad.addColorStop(0.5, `rgba(255, 213, 79, ${0.48 * alpha})`);
    grad.addColorStop(1, 'rgba(251, 192, 45, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 245, 157, ${0.9 * alpha})`;
    ctx.lineWidth = (ef.type === 'kizaru_light_explosion' ? 5.5 : 3.5) * alpha;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, curR, 0, Math.PI * 2);
    ctx.stroke();
  } else if (ef.type === 'line' || ef.type === 'onigiri') {
    const w = (ef.width || (ef.type === 'onigiri' ? 18 : 11)) * Math.max(0.35, alpha);
    drawTaperedSlashLine(ef.x, ef.y, ef.endX, ef.endY, w, ef.color, ef.subColor || '#FFFFFF', progress);
  } else {
    ctx.translate(ef.x, ef.y);
    ctx.rotate(ef.angle);
    const hAng = ef.halfAngle || Math.PI / 3;
    const headT = easeOutQuart(Math.min(1, progress / 0.35));
    const tailT = easeOutQuart(Math.max(0, (progress - 0.24) / 0.76)) * 0.62;
    const startA = -hAng + (2 * hAng) * tailT;
    const endA = -hAng + (2 * hAng) * headT;
    drawTaperedCrescent(ef.range, startA, endA, 13 * Math.max(0.42, alpha), ef.color || '#FFFFFF', '#FFFFFF');

    if (ef.type === 'arc_cross') {
      drawTaperedCrescent(ef.range * 0.78, startA * 0.85, endA * 0.85, 8 * Math.max(0.4, alpha), ef.subColor || '#FFFFFF', '#FFFFFF');
    }
  }

  ctx.restore();
}
