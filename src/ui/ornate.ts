/**
 * Drawing toolkit for the title screen's dark-fantasy shell: gunmetal plates with brass
 * trim, hex sockets, engraved dividers and drifting embers. Everything is plain canvas 2D
 * and takes explicit colours, so other screens can adopt it later.
 */
import { PALETTE } from "../game/config";

export const DISPLAY = "'Chakra Petch', 'Segoe UI', system-ui, sans-serif";
export const SANS = "'Segoe UI', system-ui, sans-serif";

export const THEME = {
  gold: "#ff9d4d",
  goldDim: "#9a5a30",
  bone: "#f1ebe3",
  ash: "#9d9a9a",
  steel: "rgba(14,17,25,0.86)",
  steelLight: "rgba(30,35,48,0.9)",
  energy: PALETTE.player,
} as const;

/** Text with manual letter-spacing (ctx.letterSpacing isn't available everywhere). Returns the drawn width. */
export function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: CanvasTextAlign = "left",
): number {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + spacing;
  }
  ctx.textAlign = prev;
  return total;
}

/** Width a tracked string would take, for fitting. */
export function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = [...text];
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
}

export function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

/** An engraved rule: fades out toward both ends, with a diamond (and two dots) at the centre. */
export function divider(ctx: CanvasRenderingContext2D, cx: number, y: number, halfW: number, color: string = THEME.gold): void {
  ctx.save();
  const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
  g.addColorStop(0, "rgba(255,157,77,0)");
  g.addColorStop(0.35, color);
  g.addColorStop(0.65, color);
  g.addColorStop(1, "rgba(255,157,77,0)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y + 0.5);
  ctx.lineTo(cx - 12, y + 0.5);
  ctx.moveTo(cx + 12, y + 0.5);
  ctx.lineTo(cx + halfW, y + 0.5);
  ctx.stroke();
  ctx.fillStyle = color;
  diamond(ctx, cx, y + 0.5, 4);
  ctx.fill();
  diamond(ctx, cx - 11, y + 0.5, 1.6);
  ctx.fill();
  diamond(ctx, cx + 11, y + 0.5, 1.6);
  ctx.fill();
  ctx.restore();
}

/** A heading flanked by fading rules, like POWERS / BLESSINGS. */
export function sectionHeading(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, text: string): void {
  ctx.save();
  ctx.font = `700 13px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = THEME.bone;
  const tw = trackedWidth(ctx, text, 3);
  trackedText(ctx, text, cx, y, 3, "center");
  const gap = tw / 2 + 14;
  for (const dir of [-1, 1]) {
    const x0 = cx + dir * gap;
    const x1 = cx + dir * (width / 2);
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "rgba(255,157,77,0.7)");
    g.addColorStop(1, "rgba(255,157,77,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y + 0.5);
    ctx.lineTo(x1, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = THEME.gold;
    diamond(ctx, x0 - dir * 5, y + 0.5, 2);
    ctx.fill();
  }
  ctx.restore();
}

function platePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, notch: number): void {
  const n = Math.min(notch, h / 2, w / 3);
  ctx.beginPath();
  ctx.moveTo(x + n, y);
  ctx.lineTo(x + w - n, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - n, y + h);
  ctx.lineTo(x + n, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

export interface PlateOptions {
  /** Pointer is over it. */
  hover?: boolean;
  /** The one big call to action: brighter trim and an energy underline. */
  primary?: boolean;
  /** Dimmed and inert. */
  disabled?: boolean;
  /** Accent for the underline and hover wash (defaults to the energy cyan). */
  accent?: string;
  fontPx?: number;
  time?: number;
}

/**
 * A hexagonal-ended plate with brass trim, an inner inset line and small end flares,
 * like the ABILITY TREE button in the reference. Used for every button on the title.
 */
export function plateButton(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, o: PlateOptions = {}): void {
  const { hover = false, primary = false, disabled = false, accent = THEME.energy, time = 0 } = o;
  const notch = Math.min(r.h * 0.5, 22);
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;

  // Body
  platePath(ctx, r.x, r.y, r.w, r.h, notch);
  const body = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  body.addColorStop(0, hover ? "rgba(44,50,66,0.96)" : "rgba(30,35,48,0.94)");
  body.addColorStop(1, hover ? "rgba(20,24,34,0.97)" : "rgba(10,12,18,0.95)");
  ctx.fillStyle = body;
  ctx.fill();
  if (hover || primary) {
    ctx.save();
    ctx.clip();
    const wash = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h, 0, r.x + r.w / 2, r.y + r.h, r.w * 0.6);
    wash.addColorStop(0, hexA(accent, hover ? 0.28 : 0.16));
    wash.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  // Outer trim: bright brass at the top edge fading to dim brass.
  platePath(ctx, r.x, r.y, r.w, r.h, notch);
  const trim = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  trim.addColorStop(0, hover || primary ? "#ffd2a0" : THEME.gold);
  trim.addColorStop(1, THEME.goldDim);
  ctx.strokeStyle = trim;
  ctx.lineWidth = primary ? 2 : 1.5;
  ctx.stroke();

  // Inner inset line.
  platePath(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(2, notch - 4));
  ctx.strokeStyle = "rgba(255,157,77,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // End flares: little brass chevrons just inside each point.
  const my = r.y + r.h / 2;
  const fl = Math.min(6, r.h * 0.14);
  ctx.strokeStyle = hover || primary ? "#ffd2a0" : THEME.goldDim;
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    const fx = side < 0 ? r.x + notch * 0.55 + 8 : r.x + r.w - notch * 0.55 - 8;
    ctx.beginPath();
    ctx.moveTo(fx - side * fl * 0.5, my - fl);
    ctx.lineTo(fx + side * fl * 0.5, my);
    ctx.lineTo(fx - side * fl * 0.5, my + fl);
    ctx.stroke();
  }

  // Label
  let fontPx = o.fontPx ?? (primary ? 20 : 14);
  const weight = primary ? 800 : 700;
  ctx.font = `${weight} ${fontPx}px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  // Shrink to sit between the end flares instead of running into them.
  const room = r.w - 2 * (notch * 0.55 + 8 + fl + 10);
  const need = trackedWidth(ctx, label, Math.max(1.5, fontPx * 0.16));
  if (need > room) {
    fontPx = Math.max(9, Math.floor((fontPx * room) / need));
    ctx.font = `${weight} ${fontPx}px ${DISPLAY}`;
  }
  ctx.fillStyle = hover || primary ? "#fff7e4" : THEME.bone;
  if (primary) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10 + 6 * Math.sin(time * 2.4);
  }
  const spacing = Math.max(1.5, fontPx * 0.16);
  trackedText(ctx, label, r.x + r.w / 2, my + 1, spacing, "center");
  ctx.shadowBlur = 0;

  // Energy underline on primary / hover.
  if (primary || hover) {
    const lw = r.w * (primary ? 0.5 : 0.36);
    const g = ctx.createLinearGradient(r.x + r.w / 2 - lw / 2, 0, r.x + r.w / 2 + lw / 2, 0);
    g.addColorStop(0, hexA(accent, 0));
    g.addColorStop(0.5, hexA(accent, 0.95));
    g.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(r.x + r.w / 2 - lw / 2, r.y + r.h - 6, lw, 2);
  }
  ctx.restore();
}

/** Pointy-top hexagon path. */
export function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** An item socket: dark hex with a double brass outline; `glyph` draws the icon at its centre. */
export function socket(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  glyph: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) => void,
  o: { active?: boolean; hover?: boolean } = {},
): void {
  const lit = !!(o.active || o.hover);
  ctx.save();
  hexPath(ctx, cx, cy, r);
  const fill = ctx.createRadialGradient(cx, cy - r * 0.3, 1, cx, cy, r);
  fill.addColorStop(0, lit ? "rgba(44,50,66,0.95)" : "rgba(26,30,42,0.92)");
  fill.addColorStop(1, "rgba(6,8,13,0.96)");
  ctx.fillStyle = fill;
  ctx.fill();
  if (lit) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
  }
  ctx.strokeStyle = lit ? THEME.gold : THEME.goldDim;
  ctx.lineWidth = lit ? 2 : 1.5;
  hexPath(ctx, cx, cy, r);
  ctx.stroke();
  ctx.shadowBlur = 0;
  hexPath(ctx, cx, cy, r - 4);
  ctx.strokeStyle = "rgba(255,157,77,0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowColor = color;
  ctx.shadowBlur = lit ? 12 : 6;
  glyph(ctx, cx, cy, r * 0.52, color);
  ctx.restore();
}

/** Rising embers: a pure function of time, so there is no particle state to keep. */
export function drawEmbers(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, count = 34): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const rnd = seed - Math.floor(seed);
    const seed2 = Math.sin(i * 269.5 + 183.3) * 24634.6345;
    const rnd2 = seed2 - Math.floor(seed2);
    const speed = 0.018 + rnd2 * 0.03;
    const t = (time * speed + rnd) % 1;
    const x = rnd2 * w + Math.sin(time * 0.6 + i) * 18;
    const y = h * (1.05 - t * 1.15);
    const fade = Math.sin(t * Math.PI);
    const flick = 0.6 + 0.4 * Math.sin(time * 3 + i * 2.1);
    const size = 1 + rnd * 1.8;
    ctx.fillStyle = i % 5 === 0 ? `rgba(63,233,255,${(0.5 * fade * flick).toFixed(3)})` : `rgba(255,190,110,${(0.55 * fade * flick).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Soft dark vignette plus a darker band at top and bottom, to frame the UI over the live scene. */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, "rgba(3,4,8,0.15)");
  g.addColorStop(1, "rgba(3,4,8,0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  top.addColorStop(0, "rgba(3,4,8,0.75)");
  top.addColorStop(1, "rgba(3,4,8,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.2);
  const bot = ctx.createLinearGradient(0, h * 0.82, 0, h);
  bot.addColorStop(0, "rgba(3,4,8,0)");
  bot.addColorStop(1, "rgba(3,4,8,0.8)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
}

/** "#rrggbb" + alpha -> rgba(). Falls back to the input colour for non-hex strings. */
export function hexA(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Brass frame with cut corners and tiny corner ticks, for panels. */
export function framePanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const c = 14;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, "rgba(16,19,28,0.74)");
  fill.addColorStop(1, "rgba(7,9,14,0.82)");
  ctx.fillStyle = fill;
  ctx.fill();
  const trim = ctx.createLinearGradient(0, y, 0, y + h);
  trim.addColorStop(0, "rgba(255,157,77,0.75)");
  trim.addColorStop(1, "rgba(154,90,48,0.45)");
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // corner ticks
  ctx.strokeStyle = THEME.gold;
  ctx.lineWidth = 2;
  for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(px + dx * (c + 8), py);
    ctx.lineTo(px + dx * (c - 2), py);
    ctx.moveTo(px, py + dy * (c + 8));
    ctx.lineTo(px, py + dy * (c - 2));
    ctx.stroke();
  }
  ctx.restore();
}
