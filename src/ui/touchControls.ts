/**
 * The app's on-screen touch controls: the two floating thumbsticks, a pause
 * button (top-right) and a DASH button (bottom-right, under the right thumb).
 * Purely visual plus layout; the input logic lives in core/input.ts.
 */
import type { StickView } from "../core/input";
import { PALETTE, PLAYER } from "../game/config";
import { DISPLAY, THEME, hexA, hexPath } from "./ornate";
import type { Rect } from "./screens";

/** Safe-area insets in CSS px (notches, rounded corners). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Pause button: top-right, clear of the notch. */
export function pauseButtonRect(w: number, insets: Insets): Rect {
  const size = 46;
  const m = 12;
  return { x: w - insets.right - m - size, y: insets.top + m, w: size, h: size };
}

/**
 * DASH button: bottom-right where the right thumb rests. In co-op the HUD's
 * ping button owns the very corner, so dash sits just to its left.
 */
export function dashButtonRect(w: number, h: number, insets: Insets, coop: boolean): Rect {
  const size = 78;
  const m = 22;
  const shift = coop ? 64 + 16 : 0;
  return { x: w - insets.right - m - size - shift, y: h - insets.bottom - m - size, w: size, h: size };
}

function drawStick(ctx: CanvasRenderingContext2D, s: StickView, color: string): void {
  if (!s.active) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(s.baseX, s.baseY, s.radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.stroke();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s.knobX, s.knobY, s.radius * 0.44, 0, Math.PI * 2);
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Both sticks; call once per frame during play, after the HUD. */
export function drawTouchSticks(ctx: CanvasRenderingContext2D, left: StickView, right: StickView): void {
  drawStick(ctx, left, PALETTE.player); // move
  drawStick(ctx, right, PALETTE.danger); // aim + fire
}

export function drawPauseButton(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  hexPath(ctx, cx, cy, r.w / 2);
  ctx.fillStyle = "rgba(5,6,10,0.55)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = THEME.gold;
  ctx.stroke();
  ctx.fillStyle = THEME.bone;
  const bw = r.w * 0.12;
  const bh = r.h * 0.34;
  const gap = r.w * 0.08;
  ctx.fillRect(cx - gap - bw, cy - bh / 2, bw, bh);
  ctx.fillRect(cx + gap, cy - bh / 2, bw, bh);
  ctx.restore();
}

/** DASH button with a cooldown sweep: dim and filling while recharging, lit when ready. */
export function drawDashButton(ctx: CanvasRenderingContext2D, r: Rect, cooldownLeft: number): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rad = r.w / 2;
  const ready = cooldownLeft <= 0;
  const frac = ready ? 1 : 1 - cooldownLeft / PLAYER.dash.cooldown;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = ready ? hexA(PALETTE.player, 0.18) : "rgba(5,6,10,0.5)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ready ? PALETTE.player : "rgba(63,233,255,0.3)";
  ctx.stroke();
  if (!ready) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad - 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = hexA(PALETTE.player, 0.75);
    ctx.stroke();
  }
  if (ready) {
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = ready ? "#eafcff" : "rgba(234,252,255,0.45)";
  ctx.font = `700 15px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DASH", cx, cy + 1);
  ctx.restore();
}
