/**
 * Robot select (app): four archetypes with different stats, three of them
 * unlocked by play (total kills, longest survival). Styled to match the title
 * screen. Layout is pure so drawing and hit-testing share it.
 */
import type { Archetype } from "../game/archetypes";
import { unlockProgress, type Profile } from "../game/profile";
import { DISPLAY, SANS, THEME, divider, framePanel, hexA, socket, trackedText } from "./ornate";
import { pointInRect, type Rect } from "./screens";

/** Card rects: one row of four on wide screens, a 2x2 grid on narrow ones. */
export function archetypeSelectLayout(w: number, h: number): Rect[] {
  const n = 4;
  const gap = 14;
  const grid = w < 640;
  const cols = grid ? 2 : 4;
  const rows = grid ? 2 : 1;
  const top = Math.max(96, h * 0.2);
  const availH = h - top - 24;
  const cardW = Math.min(220, (w - 40 - gap * (cols - 1)) / cols);
  const cardH = Math.min(grid ? 210 : 300, (availH - gap * (rows - 1)) / rows);
  const totalW = cardW * cols + gap * (cols - 1);
  const totalH = cardH * rows + gap * (rows - 1);
  const x0 = w / 2 - totalW / 2;
  const y0 = top + Math.max(0, (availH - totalH) / 2);
  const rects: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    rects.push({ x: x0 + c * (cardW + gap), y: y0 + r * (cardH + gap), w: cardW, h: cardH });
  }
  return rects;
}

/** Back button for the select screen (top-left). */
export function archetypeBackRect(): Rect {
  return { x: 16, y: 16, w: 88, h: 36 };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number, maxLines: number): void {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

const lockGlyph = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.25, s * 0.42, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x - s * 0.62, y - s * 0.25, s * 1.24, s * 0.95);
};

const iconGlyph = (icon: string) => (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void => {
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(s * 1.5)}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x, y + 1);
};

export function drawArchetypeSelect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  archetypes: Archetype[],
  profile: Profile,
  pointer: { x: number; y: number } | null,
  selected: string,
): void {
  ctx.fillStyle = "rgba(3,4,8,0.74)";
  ctx.fillRect(0, 0, w, h);

  const titleY = Math.max(40, h * 0.09);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(Math.min(34, w * 0.06))}px ${DISPLAY}`;
  ctx.fillStyle = THEME.gold;
  trackedText(ctx, "CHOOSE YOUR ROBOT", w / 2, titleY, 3, "center");
  divider(ctx, w / 2, titleY + 24, Math.min(200, w * 0.3));
  ctx.font = `500 13px ${SANS}`;
  ctx.fillStyle = "rgba(236,228,212,0.6)";
  ctx.fillText("Tap a robot to start. Locked ones show how to earn them.", w / 2, titleY + 46);

  const rects = archetypeSelectLayout(w, h);
  const compact = rects[0].h < 240;
  archetypes.forEach((a, i) => {
    const r = rects[i];
    const unlocked = profile.unlocked.includes(a.id);
    const hot = unlocked && (a.id === selected || (!!pointer && pointInRect(pointer.x, pointer.y, r)));
    framePanel(ctx, r.x, r.y, r.w, r.h);
    if (hot) {
      ctx.save();
      const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h, 0, r.x + r.w / 2, r.y + r.h, r.w);
      g.addColorStop(0, hexA(a.color, 0.22));
      g.addColorStop(1, hexA(a.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.6;
    const sy = r.y + (compact ? 40 : 58);
    socket(ctx, r.x + r.w / 2, sy, compact ? 24 : 30, unlocked ? a.color : "#8c8c8c", unlocked ? iconGlyph(a.icon) : lockGlyph, { active: hot });
    ctx.font = `700 ${compact ? 15 : 18}px ${DISPLAY}`;
    ctx.fillStyle = unlocked ? a.color : THEME.ash;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    trackedText(ctx, a.name.toUpperCase(), r.x + r.w / 2, sy + (compact ? 42 : 54), 2, "center");
    ctx.font = `500 ${compact ? 11.5 : 12.5}px ${SANS}`;
    ctx.fillStyle = "rgba(236,228,212,0.78)";
    const body = unlocked ? a.tagline : `Locked: ${unlockProgress(profile, a).label}`;
    wrap(ctx, body, r.x + r.w / 2, sy + (compact ? 66 : 84), r.w - 24, compact ? 15 : 17, compact ? 4 : 5);
    ctx.restore();
  });

  // Back
  const b = archetypeBackRect();
  ctx.save();
  ctx.strokeStyle = THEME.goldDim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = THEME.bone;
  ctx.font = `700 12px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  trackedText(ctx, "‹ BACK", b.x + b.w / 2, b.y + b.h / 2 + 1, 1.5, "center");
  ctx.restore();
}

/** "NEW ROBOT UNLOCKED" banner, faded in and out by `alpha`. */
export function drawUnlockToast(ctx: CanvasRenderingContext2D, w: number, h: number, a: Archetype, alpha: number): void {
  if (alpha <= 0) return;
  const bw = Math.min(360, w * 0.8);
  const bh = 66;
  const x = w / 2 - bw / 2;
  const y = h * 0.1;
  ctx.save();
  ctx.globalAlpha = alpha;
  framePanel(ctx, x, y, bw, bh);
  socket(ctx, x + 38, y + bh / 2, 20, a.color, iconGlyph(a.icon), { active: true });
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = THEME.gold;
  ctx.font = `700 11px ${DISPLAY}`;
  trackedText(ctx, "NEW ROBOT UNLOCKED", x + 70, y + 23, 2, "left");
  ctx.fillStyle = a.color;
  ctx.font = `700 19px ${DISPLAY}`;
  ctx.fillText(a.name.toUpperCase(), x + 70, y + 45);
  ctx.restore();
}
