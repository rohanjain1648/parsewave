import { PALETTE } from "../game/config";
import type { UpgradeCard } from "../game/upgrades";
import type { RunStats } from "../game/world";
import { formatTime } from "./hud";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const pointInRect = (px: number, py: number, r: Rect): boolean =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function dim(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  ctx.fillStyle = `rgba(3,4,8,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Font size <= maxSize (and >= minSize) such that `text` at `weight`-weight
 * Segoe UI fits within `maxWidth`. Font metrics scale linearly with size, so
 * one measurement at maxSize gives the exact fit — no shrink-and-remeasure
 * loop needed. This guards against real-device font-metric variance that a
 * fixed `size = f(viewportWidth)` formula can't account for.
 */
export function fitFontSize(ctx: CanvasRenderingContext2D, text: string, weight: number, maxWidth: number, maxSize: number, minSize = 10): number {
  ctx.font = `${weight} ${maxSize}px 'Segoe UI', system-ui, sans-serif`;
  const measured = ctx.measureText(text).width;
  if (measured <= maxWidth || measured === 0) return maxSize;
  return Math.max(minSize, Math.floor((maxWidth / measured) * maxSize));
}

/** Big pulsing title text with an additive glow pass, auto-shrunk to always fit `maxWidth`. */
export function neonTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxSize: number, time: number, maxWidth: number): void {
  const size = fitFontSize(ctx, text, 900, maxWidth, maxSize);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${size}px 'Segoe UI', system-ui, sans-serif`;
  const pulse = 0.5 + Math.sin(time * 2) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 24 + pulse * 20;
  ctx.fillStyle = PALETTE.player;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.fillStyle = "#eafcff";
  ctx.fillText(text, x, y);
}

// ---- Start / restart button --------------------------------------------
export function primaryButtonRect(w: number, h: number): Rect {
  const bw = Math.min(280, w * 0.6);
  return { x: w / 2 - bw / 2, y: h * 0.62, w: bw, h: 56 };
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  time: number,
  color: string = PALETTE.player,
  fontPx = 20,
): void {
  const pulse = 0.5 + Math.sin(time * 4) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = `rgba(63,233,255,${0.08 + pulse * 0.06})`;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#eafcff";
  ctx.font = `800 ${fontPx}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
}

export function muteButtonRect(w: number): Rect {
  return { x: w - 52, y: 16, w: 36, h: 36 };
}

// ---- Level-up ------------------------------------------------------------
export function levelUpLayout(w: number, h: number): Rect[] {
  const n = 3;
  const gap = 18;
  const cardW = Math.min(280, (w - 60 - gap * (n - 1)) / n);
  const cardH = Math.min(340, h * 0.62);
  const totalW = cardW * n + gap * (n - 1);
  const startX = w / 2 - totalW / 2;
  const y = h / 2 - cardH / 2 + 20;
  const rects: Rect[] = [];
  for (let i = 0; i < n; i++) {
    rects.push({ x: startX + i * (cardW + gap), y, w: cardW, h: cardH });
  }
  return rects;
}

export function drawLevelUp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  choices: UpgradeCard[],
  pointer: { x: number; y: number },
  time: number,
  waitingNames: string[] = [],
): void {
  dim(ctx, w, h, 0.72);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  neonTitle(ctx, "LEVEL UP", w / 2, h * 0.16, Math.min(48, w * 0.07), time, w * 0.9);
  ctx.fillStyle = "rgba(230,244,255,0.6)";
  ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Choose an upgrade  —  click or press 1 / 2 / 3", w / 2, h * 0.16 + 40);

  const rects = levelUpLayout(w, h);
  for (let i = 0; i < choices.length; i++) {
    const u = choices[i];
    const r = rects[i];
    const hover = pointInRect(pointer.x, pointer.y, r);

    ctx.save();
    ctx.strokeStyle = u.color;
    ctx.lineWidth = hover ? 3 : 1.5;
    ctx.globalAlpha = hover ? 1 : 0.85;
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grad.addColorStop(0, "rgba(20,28,48,0.95)");
    grad.addColorStop(1, "rgba(8,10,20,0.95)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Icon
    ctx.fillStyle = u.color;
    ctx.font = "700 46px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(u.icon, r.x + r.w / 2, r.y + 64);

    // Name
    ctx.fillStyle = "#eafcff";
    ctx.font = "800 20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 118);

    // Level label
    const label = u.label;
    if (label) {
      ctx.fillStyle = u.color;
      ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(label, r.x + r.w / 2, r.y + 144);
    }

    // Description (wrapped)
    ctx.fillStyle = "rgba(230,244,255,0.75)";
    ctx.font = "500 14px 'Segoe UI', system-ui, sans-serif";
    wrapText(ctx, u.desc, r.x + r.w / 2, r.y + 176, r.w - 32, 20);

    // Number key hint
    ctx.fillStyle = u.color;
    ctx.font = "800 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`${i + 1}`, r.x + r.w / 2, r.y + r.h - 26);
  }

  if (waitingNames.length > 0) {
    ctx.fillStyle = "rgba(230,244,255,0.6)";
    ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`waiting on ${waitingNames.join(", ")}…`, w / 2, h - 24);
  }
}

// ---- Pause ---------------------------------------------------------------
// A centred stack of three buttons (resume / sound / quit), sized to fit short
// landscape phones. One slot helper so drawing and hit-testing never drift apart.
function pauseSlot(w: number, h: number, i: number): Rect {
  const bw = Math.min(280, w * 0.6);
  const bh = h < 480 ? 44 : 52;
  const gap = 12;
  const startY = h * 0.6 - (bh * 3 + gap * 2) / 2;
  return { x: w / 2 - bw / 2, y: startY + i * (bh + gap), w: bw, h: bh };
}

export function resumeButtonRect(w: number, h: number): Rect {
  return pauseSlot(w, h, 0);
}

export function pauseMuteButtonRect(w: number, h: number): Rect {
  return pauseSlot(w, h, 1);
}

export function quitButtonRect(w: number, h: number): Rect {
  return pauseSlot(w, h, 2);
}

export function drawPause(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, muted = false, showKeys = true): void {
  dim(ctx, w, h, 0.6);
  neonTitle(ctx, "PAUSED", w / 2, h * 0.24, Math.min(52, w * 0.08), time, w * 0.9);
  if (showKeys) {
    ctx.fillStyle = "rgba(230,244,255,0.6)";
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ESC / SPACE to resume  •  M sound  •  Q to quit to menu", w / 2, h * 0.24 + 40);
  }
  drawButton(ctx, resumeButtonRect(w, h), "▶  RESUME", time, PALETTE.player);
  drawButton(ctx, pauseMuteButtonRect(w, h), muted ? "SOUND: OFF" : "SOUND: ON", time, muted ? PALETTE.danger : PALETTE.xp);
  drawButton(ctx, quitButtonRect(w, h), "✕  QUIT TO MENU", time, PALETTE.danger);
}

// ---- Game over -----------------------------------------------------------
export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stats: RunStats,
  best: RunStats | null,
  newBest: boolean,
  time: number,
): void {
  dim(ctx, w, h, 0.78);
  neonTitle(ctx, "SWARMED", w / 2, h * 0.24, Math.min(64, w * 0.1), time, w * 0.9);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eafcff";
  ctx.font = "900 40px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(formatTime(stats.time), w / 2, h * 0.42);
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(230,244,255,0.7)";
  ctx.fillText(`survived  •  ${stats.kills} kills  •  reached Lv ${stats.level}`, w / 2, h * 0.42 + 34);

  if (newBest) {
    ctx.fillStyle = PALETTE.xp;
    ctx.font = "800 18px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("★ NEW BEST ★", w / 2, h * 0.52);
  } else if (best) {
    ctx.fillStyle = "rgba(230,244,255,0.5)";
    ctx.font = "600 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`best  ${formatTime(best.time)}  •  ${best.kills} kills`, w / 2, h * 0.52);
  }

  drawButton(ctx, primaryButtonRect(w, h), "↻  PLAY AGAIN", time, PALETTE.danger);
}

// ---- helpers -------------------------------------------------------------
function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number): void {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
