/**
 * The title screen: a dark-fantasy shell (gunmetal plates, trim, hex sockets, angular
 * display type) around the game's cyan energy colour. Layout is a pure function of the
 * viewport, so hit-testing (`titleButtonRects`) and drawing can never drift apart.
 *
 * Wide screens: nav tabs across the top, title + play buttons on the left, an item/foe
 * socket panel on the right, and the live 3D hero left clear in the middle.
 * Narrow screens: one centred column with the buttons stacked underneath.
 */
import { BOSS, CAPITAL, ENEMIES, PALETTE, SPACE_ENEMIES } from "../game/config";
import type { RunStats } from "../game/world";
import { formatTime } from "./hud";
import {
  diamond, divider, drawEmbers, drawVignette, framePanel, plateButton, sectionHeading, SANS, DISPLAY, socket, THEME,
  trackedText, trackedWidth,
} from "./ornate";
import { muteButtonRect, pointInRect, roundRect, type Rect } from "./screens";


export interface TitleForge {
  /** False while a forge is running (the button is shown dimmed). */
  enabled: boolean;
  status: string | null;
}

export type CoopAvailability = "ready" | "waking" | "unavailable";

export interface TitleRects {
  solo: Rect;
  orbit: Rect;
  host: Rect;
  join: Rect;
  hangar: Rect;
  forge: Rect;
}

export type FooterId = "begin" | "orbit" | "hangar" | "forge" | "mute";

/** One clickable key hint in the footer (chip + label). */
export interface FooterItem {
  id: FooterId;
  key: string;
  label: string;
  chipW: number;
  rect: Rect;
}

const FOOTER_KEYS: readonly (readonly [string, string, FooterId])[] = [
  ["ENTER", "Begin", "begin"],
  ["O", "Orbit", "orbit"],
  ["H", "Hangar", "hangar"],
  ["F", "Forge", "forge"],
  ["M", "Mute", "mute"],
];

/** Footer hit boxes, with fixed chip widths and estimated label widths so drawing and hit-testing agree. */
function footerItems(w: number, footerY: number): FooterItem[] {
  let x = Math.min(90, Math.max(24, w * 0.05));
  return FOOTER_KEYS.map(([key, label, id]) => {
    const chipW = key === "ENTER" ? 50 : 22;
    const itemW = chipW + 7 + label.length * 6.6 + 2;
    const item: FooterItem = { id, key, label, chipW, rect: { x: x - 7, y: footerY - 15, w: itemW + 14, h: 30 } };
    x += itemW + 26;
    return item;
  });
}

export interface TitleLayout {
  wide: boolean;
  u: number;
  rects: TitleRects;
  /** Item/foe panel (wide screens only): its screen rect, content scale and design size. */
  panel: { rect: Rect; k: number } | null;
  cx: number;
  /** Width available to the centred left/main column. */
  colW: number;
  eyebrowY: number;
  title: { size: number; lines: string[]; ys: number[] };
  dividerY: number;
  taglineY: number;
  hintY: number;
  bestY: number;
  statusY: number;
  footerY: number | null;
  /** Clickable key hints along the bottom (wide screens that are tall enough). */
  footer: FooterItem[];
  /** Wide: the nav row's centre y. */
  navY: number;
}

const PANEL_W = 300;
const PANEL_H = 586;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** All title geometry for a viewport. Pure: no canvas needed. */
export function titleLayout(w: number, h: number): TitleLayout {
  const wide = w >= 720;
  const showPanel = w >= 900 && h >= 440;
  const pad = clamp(w * 0.05, 24, 90);
  const eyebrowH = 18;

  if (wide) {
    const colW = clamp(w * 0.34, 300, 540);
    const pw = clamp(w * 0.27, 270, 340);
    const navBottom = 92;
    const footerH = h >= 480 ? 54 : 24;
    const avail = h - navBottom - footerH;
    // Height of the left block at unit scale: eyebrow, 2 title lines, divider, tagline, hints, buttons, best.
    const blockAt = (u: number) => eyebrowH * u + 12 + 1.84 * Math.min(112 * u, (colW * 0.96) / 3.8) + 44 * u + 26 * u + 40 * u + 60 * u + 70 * u;
    let u = clamp(h / 760, 0.55, 1);
    while (u > 0.5 && blockAt(u) > avail) u -= 0.02;
    const size = Math.min(112 * u, (colW * 0.96) / 3.8);
    const total = blockAt(u);
    let y = navBottom + Math.max(0, (avail - total) / 2) - 6;
    const cx = pad + colW / 2;
    const eyebrowY = y + (eyebrowH * u) / 2;
    y += eyebrowH * u + 12;
    const y1 = y + size * 0.46;
    const y2 = y1 + size * 0.92;
    y += size * 1.84;
    const dividerY = y + 14 * u;
    const taglineY = dividerY + 30 * u;
    y = taglineY + 22 * u;
    const btnH = clamp(60 * u, 46, 64);
    const bw = Math.min(colW, 430);
    const gap = 12;
    const soloW = (bw - gap) * 0.62;
    const btnY = y + 8 * u;
    const solo = { x: cx - bw / 2, y: btnY, w: soloW, h: btnH };
    const orbit = { x: cx - bw / 2 + soloW + gap, y: btnY, w: bw - soloW - gap, h: btnH };
    const hintY = btnY + btnH + 24 * u;
    const bestY = hintY + 48 * u;

    // Nav tabs: HANGAR / FORGE / HOST CO-OP / JOIN, centred, separated by diamonds.
    const tw = clamp(w * 0.105, 112, 150);
    const sep = 26;
    const navW = tw * 4 + sep * 3;
    const nx = w / 2 - navW / 2;
    const tab = (i: number): Rect => ({ x: nx + i * (tw + sep), y: 16, w: tw, h: 40 });
    const rects: TitleRects = { solo, orbit, hangar: tab(0), forge: tab(1), host: tab(2), join: tab(3) };

    let panel: TitleLayout["panel"] = null;
    if (showPanel) {
      const availH = h - 84 - 30 - (h >= 480 ? 24 : 0);
      const k = Math.min(1, availH / PANEL_H, pw / PANEL_W);
      const ph = PANEL_H * k;
      const px = w - pad - PANEL_W * k;
      const py = 84 + Math.max(0, (availH - ph) / 2);
      panel = { rect: { x: px, y: py, w: PANEL_W * k, h: ph }, k };
    }
    return {
      wide, u, rects, panel, cx, colW, eyebrowY,
      title: { size, lines: ["NOVA", "SWARM"], ys: [y1, y2] },
      dividerY, taglineY, hintY, bestY, statusY: 78, footerY: h >= 480 ? h - 30 : null, navY: 36,
      footer: h >= 480 ? footerItems(w, h - 30) : [],
    };
  }

  // ---- Compact: one centred column, buttons stacked underneath.
  const colW = w * 0.92;
  const rowH = (u: number) => clamp(46 * u, 38, 48);
  const totalAt = (u: number) => Math.min(84 * u, (colW * 0.96) / 6.6) * 1.1 + 40 * u + 24 * u + 34 * u + 60 * u + 10 + rowH(u) * 2 + 20 + 28 * u;
  let u = clamp(h / 760, 0.55, 1);
  while (u > 0.45 && totalAt(u) > h - 28) u -= 0.02;
  const size = Math.min(84 * u, (colW * 0.96) / 6.6);
  const total = totalAt(u);
  let y = Math.max(14, (h - total) / 2);
  const cx = w / 2;
  const ty = y + size * 0.55;
  y += size * 1.1;
  const dividerY = y + 14 * u;
  const taglineY = dividerY + 26 * u;
  const hintY = taglineY + 30 * u;
  y = hintY + 30 * u;
  const bw = Math.min(w * 0.88, 420);
  const gap = 10;
  const soloW = (bw - gap) * 0.62;
  const btnH = clamp(58 * u, 44, 60);
  const solo = { x: cx - bw / 2, y, w: soloW, h: btnH };
  const orbit = { x: cx - bw / 2 + soloW + gap, y, w: bw - soloW - gap, h: btnH };
  y += btnH + gap;
  const half = (bw - gap) / 2;
  const rh = rowH(u);
  const host = { x: cx - bw / 2, y, w: half, h: rh };
  const join = { x: cx - bw / 2 + half + gap, y, w: half, h: rh };
  y += rh + gap;
  const hangar = { x: cx - bw / 2, y, w: half, h: rh };
  const forge = { x: cx - bw / 2 + half + gap, y, w: half, h: rh };
  y += rh;
  return {
    wide, u, rects: { solo, orbit, host, join, hangar, forge }, panel: null, cx, colW,
    eyebrowY: -100,
    title: { size, lines: ["NOVA SWARM"], ys: [ty] },
    dividerY, taglineY, hintY, bestY: y + 24, statusY: y + 22, footerY: null, navY: -100, footer: [],
  };
}

/** Screen-space bounds of the six title buttons (also exposed to the smoke tests). */
export const titleButtonRects = (w: number, h: number): TitleRects => titleLayout(w, h).rects;

/** Which footer key hint (if any) is at a point; the footer is clickable. */
export function titleFooterHit(w: number, h: number, x: number, y: number): FooterId | null {
  for (const f of titleLayout(w, h).footer) if (pointInRect(x, y, f.rect)) return f.id;
  return null;
}

/** The right-hand info panel (so clicks on it don't start a run). Null when it isn't shown. */
export const titlePanelHit = (w: number, h: number): Rect | null => titleLayout(w, h).panel?.rect ?? null;

// ---- Item sockets --------------------------------------------------------

type Glyph = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) => void;

interface Item {
  id: string;
  name: string;
  short: string;
  desc: string;
  color: string;
  glyph: Glyph;
}

const stroke = (ctx: CanvasRenderingContext2D, color: string, lw = 2): void => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
};

const G: Record<string, Glyph> = {
  blaster: (c, x, y, s, col) => {
    stroke(c, col);
    c.beginPath();
    c.moveTo(x - s, y - s * 0.55);
    c.lineTo(x + s, y);
    c.lineTo(x - s, y + s * 0.55);
    c.lineTo(x - s * 0.4, y);
    c.closePath();
    c.fill();
  },
  orbital: (c, x, y, s, col) => {
    stroke(c, col, 1.6);
    c.beginPath();
    c.arc(x, y, s * 0.28, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y, s * 0.85, 0, Math.PI * 2);
    c.globalAlpha = 0.5;
    c.stroke();
    c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      c.beginPath();
      c.arc(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85, s * 0.2, 0, Math.PI * 2);
      c.fill();
    }
  },
  nova: (c, x, y, s, col) => {
    stroke(c, col, 2);
    for (const [r, a] of [[0.3, 1], [0.62, 0.7], [0.95, 0.4]] as const) {
      c.globalAlpha = a;
      c.beginPath();
      c.arc(x, y, s * r, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  },
  chain: (c, x, y, s, col) => {
    stroke(c, col, 2.2);
    c.beginPath();
    c.moveTo(x - s * 0.1, y - s);
    c.lineTo(x + s * 0.4, y - s * 0.1);
    c.lineTo(x - s * 0.35, y + s * 0.1);
    c.lineTo(x + s * 0.15, y + s);
    c.stroke();
  },
  lance: (c, x, y, s, col) => {
    stroke(c, col, 2.6);
    c.beginPath();
    c.moveTo(x - s, y);
    c.lineTo(x + s * 0.6, y);
    c.stroke();
    c.beginPath();
    c.moveTo(x + s * 0.55, y - s * 0.38);
    c.lineTo(x + s, y);
    c.lineTo(x + s * 0.55, y + s * 0.38);
    c.closePath();
    c.fill();
    c.lineWidth = 1.2;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(x - s * 0.8, y - s * 0.3);
    c.lineTo(x + s * 0.1, y - s * 0.3);
    c.moveTo(x - s * 0.8, y + s * 0.3);
    c.lineTo(x + s * 0.1, y + s * 0.3);
    c.stroke();
    c.globalAlpha = 1;
  },
  grunt: (c, x, y, s, col) => {
    stroke(c, col);
    c.beginPath();
    c.arc(x, y, s * 0.78, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, y, s * 0.24, 0, Math.PI * 2);
    c.fill();
  },
  fast: (c, x, y, s, col) => {
    stroke(c, col, 2.4);
    for (const dx of [-s * 0.45, s * 0.2]) {
      c.beginPath();
      c.moveTo(x + dx - s * 0.2, y - s * 0.7);
      c.lineTo(x + dx + s * 0.45, y);
      c.lineTo(x + dx - s * 0.2, y + s * 0.7);
      c.stroke();
    }
  },
  tank: (c, x, y, s, col) => {
    stroke(c, col);
    c.strokeRect(x - s * 0.75, y - s * 0.75, s * 1.5, s * 1.5);
    c.fillRect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6);
  },
  splitter: (c, x, y, s, col) => {
    stroke(c, col);
    diamond(c, x, y, s * 0.95);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y - s * 0.95);
    c.lineTo(x, y + s * 0.95);
    c.stroke();
  },
  shooter: (c, x, y, s, col) => {
    stroke(c, col);
    c.beginPath();
    c.arc(x, y, s * 0.55, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      c.moveTo(x + dx * s * 0.7, y + dy * s * 0.7);
      c.lineTo(x + dx * s * 1.05, y + dy * s * 1.05);
    }
    c.stroke();
    c.beginPath();
    c.arc(x, y, s * 0.12, 0, Math.PI * 2);
    c.fill();
  },
  boss: (c, x, y, s, col) => {
    stroke(c, col, 2);
    c.beginPath();
    c.moveTo(x - s, y + s * 0.65);
    c.lineTo(x - s, y - s * 0.35);
    c.lineTo(x - s * 0.5, y + s * 0.1);
    c.lineTo(x, y - s * 0.75);
    c.lineTo(x + s * 0.5, y + s * 0.1);
    c.lineTo(x + s, y - s * 0.35);
    c.lineTo(x + s, y + s * 0.65);
    c.closePath();
    c.globalAlpha = 0.28;
    c.fill();
    c.globalAlpha = 1;
    c.stroke();
  },
  interceptor: (c, x, y, s, col) => {
    stroke(c, col, 2);
    c.beginPath();
    c.moveTo(x, y - s);
    c.lineTo(x + s * 0.7, y + s * 0.85);
    c.lineTo(x, y + s * 0.4);
    c.lineTo(x - s * 0.7, y + s * 0.85);
    c.closePath();
    c.stroke();
  },
  bomber: (c, x, y, s, col) => {
    stroke(c, col, 2);
    c.beginPath();
    c.moveTo(x, y - s * 0.65);
    c.lineTo(x + s, y + s * 0.7);
    c.lineTo(x - s, y + s * 0.7);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(x - s * 0.5, y + s * 0.2);
    c.lineTo(x + s * 0.5, y + s * 0.2);
    c.stroke();
  },
  kamikaze: (c, x, y, s, col) => {
    stroke(c, col, 2);
    c.beginPath();
    c.moveTo(x, y - s);
    c.lineTo(x + s * 0.45, y + s * 0.5);
    c.lineTo(x - s * 0.45, y + s * 0.5);
    c.closePath();
    c.fill();
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - s * 0.25, y + s * 0.7);
    c.lineTo(x, y + s);
    c.lineTo(x + s * 0.25, y + s * 0.7);
    c.stroke();
  },
  capital: (c, x, y, s, col) => {
    stroke(c, col, 2);
    c.strokeRect(x - s, y - s * 0.32, s * 2, s * 0.64);
    c.fillRect(x + s * 0.3, y - s * 0.72, s * 0.45, s * 0.4);
    c.beginPath();
    c.moveTo(x - s * 0.55, y);
    c.lineTo(x + s * 0.1, y);
    c.stroke();
  },
};

const ARSENAL: Item[] = [
  { id: "blaster", name: "Blaster", short: "BLASTER", color: PALETTE.bullet, glyph: G.blaster, desc: "Your starting gun. It fires where you aim; every third upgrade adds another projectile." },
  { id: "orbital", name: "Orbital Shards", short: "SHARDS", color: PALETTE.orbital, glyph: G.orbital, desc: "Crystals circle your robot and shred anything that touches them." },
  { id: "nova", name: "Pulse Nova", short: "NOVA", color: PALETTE.nova, glyph: G.nova, desc: "A periodic shockwave that damages and knocks back everything around you." },
  { id: "chain", name: "Chain Lightning", short: "CHAIN", color: PALETTE.chain, glyph: G.chain, desc: "Lightning arcs from the nearest enemy to its neighbours. More levels, more arcs." },
  { id: "lance", name: "Rail Lance", short: "LANCE", color: PALETTE.lance, glyph: G.lance, desc: "A piercing beam through everything in a line. Upgrades make it longer, wider and faster to recharge." },
];

const SWARM: Item[] = [
  { id: "grunt", name: "Grunt", short: "GRUNT", color: ENEMIES.grunt.color, glyph: G.grunt, desc: "The basic swarm: slow, numerous and easy to kite. There are always more of them." },
  { id: "fast", name: "Fast", short: "FAST", color: ENEMIES.fast.color, glyph: G.fast, desc: "Quick and fragile. Dash through them rather than running away." },
  { id: "tank", name: "Tank", short: "TANK", color: ENEMIES.tank.color, glyph: G.tank, desc: "Heavy and slow with plenty of health. Keep your distance and keep firing." },
  { id: "splitter", name: "Splitter", short: "SPLITTER", color: ENEMIES.splitter.color, glyph: G.splitter, desc: "Breaks into fast enemies when destroyed, so don't fight it in a corner." },
  { id: "shooter", name: "Shooter", short: "SHOOTER", color: ENEMIES.shooter.color, glyph: G.shooter, desc: "Holds its distance and fires at you. Close the gap or break line of sight." },
  { id: "boss", name: "The Warden", short: "WARDEN", color: BOSS.color, glyph: G.boss, desc: "The land boss, arriving at 2:00. Defeat it and your squad launches into orbit." },
];

const FLEET: Item[] = [
  { id: "interceptor", name: "Interceptor", short: "INTERCEPTOR", color: SPACE_ENEMIES.interceptor.color, glyph: G.interceptor, desc: "Fast orbit fighter that weaves around you and fires from range." },
  { id: "kamikaze", name: "Kamikaze", short: "KAMIKAZE", color: SPACE_ENEMIES.kamikaze.color, glyph: G.kamikaze, desc: "Fragile but fast. It detonates on contact, so shoot it before it arrives." },
  { id: "bomber", name: "Bomber", short: "BOMBER", color: SPACE_ENEMIES.bomber.color, glyph: G.bomber, desc: "Slow, heavily armoured and long-ranged. Worth the XP." },
  { id: "capital", name: "Capital Ship", short: "CAPITAL", color: CAPITAL.color, glyph: G.capital, desc: "The orbit boss. At half health its bridge breaks off and it fights faster." },
];

const ALL_ITEMS = [...ARSENAL, ...SWARM, ...FLEET];
let selectedId = "blaster";

interface Placed { item: Item; x: number; y: number; r: number }

/** Socket centres in panel design coordinates (0..PANEL_W, 0..PANEL_H). */
function placeSockets(): { placed: Placed[]; headings: { y: number; text: string }[]; captionY: number } {
  const r = 22;
  const rowPitch = 68;
  const placed: Placed[] = [];
  const headings: { y: number; text: string }[] = [];
  const section = (y0: number, text: string, items: Item[], perRow: number, spacing: number): number => {
    headings.push({ y: y0 + 8, text });
    const rows = Math.ceil(items.length / perRow);
    for (let row = 0; row < rows; row++) {
      const inRow = items.slice(row * perRow, row * perRow + perRow);
      inRow.forEach((item, i) => {
        placed.push({ item, x: PANEL_W / 2 + (i - (inRow.length - 1) / 2) * spacing, y: y0 + 34 + row * rowPitch + r, r });
      });
    }
    return y0 + 34 + rows * rowPitch;
  };
  let y = 16;
  y = section(y, "ARSENAL", ARSENAL, 3, 84) + 8;
  y = section(y, "THE SWARM", SWARM, 3, 84) + 8;
  y = section(y, "ORBIT FLEET", FLEET, 4, 74) + 10;
  return { placed, headings, captionY: y };
}
const SOCKETS = placeSockets();

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawPanel(ctx: CanvasRenderingContext2D, lay: NonNullable<TitleLayout["panel"]>, pointer: { x: number; y: number } | null): void {
  const { rect, k } = lay;
  framePanel(ctx, rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.scale(k, k);
  const dx = pointer ? (pointer.x - rect.x) / k : -1000;
  const dy = pointer ? (pointer.y - rect.y) / k : -1000;

  for (const hd of SOCKETS.headings) sectionHeading(ctx, PANEL_W / 2, hd.y, PANEL_W - 36, hd.text);

  let hovered: string | null = null;
  for (const p of SOCKETS.placed) {
    if ((dx - p.x) ** 2 + (dy - p.y) ** 2 <= (p.r + 8) ** 2) hovered = p.item.id;
  }
  if (hovered) selectedId = hovered;

  for (const p of SOCKETS.placed) {
    const active = p.item.id === selectedId;
    socket(ctx, p.x, p.y, p.r, p.item.color, p.item.glyph, { active, hover: p.item.id === hovered });
    ctx.font = `700 10px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = active ? THEME.gold : THEME.ash;
    trackedText(ctx, p.item.short, p.x, p.y + p.r + 14, 0.7, "center");
  }

  // Detail caption: the selected item's name and a one-line description (like the skill card in the reference).
  const sel = ALL_ITEMS.find((i) => i.id === selectedId) ?? ARSENAL[0];
  const cy = SOCKETS.captionY;
  ctx.strokeStyle = "rgba(255,157,77,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, cy);
  ctx.lineTo(PANEL_W - 24, cy);
  ctx.stroke();
  ctx.font = `800 15px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = sel.color;
  trackedText(ctx, sel.name.toUpperCase(), PANEL_W / 2, cy + 20, 2, "center");
  ctx.font = `500 12.5px ${SANS}`;
  ctx.fillStyle = "rgba(236,228,212,0.78)";
  ctx.textAlign = "center";
  wrap(ctx, sel.desc, PANEL_W - 44).slice(0, 4).forEach((line, i) => ctx.fillText(line, PANEL_W / 2, cy + 44 + i * 17));
  ctx.restore();
}

// ---- Pieces --------------------------------------------------------------

function drawSpeaker(ctx: CanvasRenderingContext2D, cx: number, cy: number, muted: boolean, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 3);
  ctx.lineTo(cx - 3, cy - 3);
  ctx.lineTo(cx + 1, cy - 7);
  ctx.lineTo(cx + 1, cy + 7);
  ctx.lineTo(cx - 3, cy + 3);
  ctx.lineTo(cx - 7, cy + 3);
  ctx.closePath();
  ctx.fill();
  if (muted) {
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 4);
    ctx.lineTo(cx + 11, cy + 4);
    ctx.moveTo(cx + 11, cy - 4);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.stroke();
  } else {
    for (const r of [5, 9]) {
      ctx.beginPath();
      ctx.arc(cx + 1, cy, r, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function keyChip(ctx: CanvasRenderingContext2D, x: number, cy: number, key: string, lit = false, fixedW?: number): number {
  ctx.save();
  ctx.font = `800 10px ${SANS}`;
  const kw = fixedW ?? Math.max(18, ctx.measureText(key).width + 12);
  roundRect(ctx, x, cy - 9, kw, 18, 4);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = lit ? THEME.gold : "rgba(255,157,77,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = lit ? THEME.gold : THEME.bone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(key, x + kw / 2, cy + 0.5);
  ctx.restore();
  return kw;
}

/** One nav tab: key chip + tracked small caps, a brass underline brush when hovered. */
function drawTab(ctx: CanvasRenderingContext2D, r: Rect, label: string, key: string | null, o: { hover: boolean; dim: boolean; accent: string }): void {
  ctx.save();
  if (o.dim) ctx.globalAlpha = 0.4;
  ctx.font = `700 13px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  const tw = trackedWidth(ctx, label, 2.6);
  const chip = key ? 18 + 10 : 0;
  const startX = r.x + r.w / 2 - (tw + chip) / 2;
  const cy = r.y + r.h / 2;
  if (key) keyChip(ctx, startX, cy, key, o.hover);
  ctx.fillStyle = o.hover ? "#fff7e4" : THEME.bone;
  if (o.hover) {
    ctx.shadowColor = o.accent;
    ctx.shadowBlur = 10;
  }
  trackedText(ctx, label, startX + chip, cy + 1, 2.6, "left");
  ctx.shadowBlur = 0;
  const ux = r.x + r.w / 2;
  const half = (o.hover ? 0.5 : 0.34) * r.w;
  const g = ctx.createLinearGradient(ux - half, 0, ux + half, 0);
  g.addColorStop(0, "rgba(255,157,77,0)");
  g.addColorStop(0.5, o.hover ? o.accent : THEME.goldDim);
  g.addColorStop(1, "rgba(255,157,77,0)");
  ctx.fillStyle = g;
  ctx.fillRect(ux - half, r.y + r.h - 2, half * 2, o.hover ? 2 : 1);
  ctx.restore();
}

function fitSerif(ctx: CanvasRenderingContext2D, text: string, weight: number, maxW: number, maxSize: number): number {
  ctx.font = `${weight} ${maxSize}px ${DISPLAY}`;
  const m = ctx.measureText(text).width;
  return m <= maxW || m === 0 ? maxSize : Math.max(12, Math.floor((maxW / m) * maxSize));
}

// ---- Draw ----------------------------------------------------------------

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  best: RunStats | null,
  muted: boolean,
  coop: CoopAvailability = "unavailable",
  forge: TitleForge | null = null,
  pointer: { x: number; y: number } | null = null,
  /** App build: touch wording, no keyboard footer. */
  touch = false,
): void {
  const L = titleLayout(w, h);
  const hover = (r: Rect): boolean => !!pointer && pointInRect(pointer.x, pointer.y, r);

  drawVignette(ctx, w, h);
  drawEmbers(ctx, w, h, time, w < 720 ? 18 : 34);

  // ---- Top nav (wide) -------------------------------------------------
  if (L.wide) {
    const { hangar, forge: fg, host, join } = L.rects;
    const ready = coop === "ready";
    drawTab(ctx, hangar, "HANGAR", touch ? null : "H", { hover: hover(hangar), dim: false, accent: "#9d7bff" });
    drawTab(ctx, fg, "FORGE", touch ? null : "F", { hover: hover(fg) && !!forge?.enabled, dim: !forge || !forge.enabled, accent: "#ffb44d" });
    drawTab(ctx, host, "HOST CO-OP", null, { hover: hover(host) && ready, dim: !ready, accent: "#5dffb0" });
    drawTab(ctx, join, "JOIN", null, { hover: hover(join) && ready, dim: !ready, accent: "#5b7bff" });
    ctx.fillStyle = THEME.goldDim;
    for (const [a, b] of [[hangar, fg], [fg, host], [host, join]] as const) {
      diamond(ctx, (a.x + a.w + b.x) / 2, L.navY, 2.6);
      ctx.fill();
    }
    // hairline under the nav
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,157,77,0)");
    g.addColorStop(0.5, "rgba(255,157,77,0.45)");
    g.addColorStop(1, "rgba(255,157,77,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 64, w, 1);
  }

  // ---- Title block ----------------------------------------------------
  const cx = L.cx;
  if (!L.wide) {
    // One column over the live scene: knock the hero back so the buttons stay legible.
    const y0 = L.title.ys[0] - L.title.size;
    const y1 = L.rects.forge.y + L.rects.forge.h + 44;
    const sg = ctx.createLinearGradient(0, y0, 0, y1);
    sg.addColorStop(0, "rgba(3,4,8,0)");
    sg.addColorStop(0.18, "rgba(3,4,8,0.62)");
    sg.addColorStop(0.9, "rgba(3,4,8,0.62)");
    sg.addColorStop(1, "rgba(3,4,8,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, y0, w, y1 - y0);
  }
  if (L.wide) {
    ctx.font = `700 ${Math.round(11 * Math.max(0.85, L.u))}px ${DISPLAY}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = THEME.gold;
    const eyebrow = "A  ROGUELITE  FROM  SURFACE  TO  ORBIT";
    const base = trackedWidth(ctx, eyebrow, 0);
    const track = clamp((L.colW * 0.98 - base) / (eyebrow.length - 1), 0.8, 3);
    trackedText(ctx, eyebrow, cx, L.eyebrowY, track, "center");
  }
  let size = L.title.size;
  for (const line of L.title.lines) size = Math.min(size, fitSerif(ctx, line, 900, L.colW * 0.98, size));
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.6);
  L.title.lines.forEach((line, i) => {
    const y = L.title.ys[i];
    ctx.save();
    ctx.font = `900 ${size}px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // energy under-glow
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = THEME.energy;
    ctx.shadowBlur = 26 + pulse * 14;
    ctx.fillStyle = "rgba(63,233,255,0.16)";
    ctx.fillText(line, cx, y);
    ctx.restore();
    ctx.save();
    ctx.font = `900 ${size}px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // engraved gold: bone at the top, brass at the bottom, dark outline for weight
    const fill = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    fill.addColorStop(0, "#fff1dc");
    fill.addColorStop(0.5, THEME.gold);
    fill.addColorStop(1, "#b4501f");
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.strokeStyle = "rgba(10,8,4,0.85)";
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = fill;
    ctx.fillText(line, cx, y);
    ctx.restore();
  });

  divider(ctx, cx, L.dividerY, Math.min(L.colW * 0.46, 210));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(236,228,212,0.8)";
  const tag = "Outlast the swarm. Level up. Build a deadly run.";
  const tagSize = Math.min(L.wide ? 16 : 15, fitSans(ctx, tag, L.colW));
  ctx.font = `600 ${tagSize}px ${SANS}`;
  ctx.fillText(tag, cx, L.taglineY);

  // ---- Buttons --------------------------------------------------------
  plateButton(ctx, L.rects.solo, "BEGIN THE RUN", { primary: true, hover: hover(L.rects.solo), time, fontPx: Math.round(clamp(L.rects.solo.h * 0.3, 13, 20)) });
  plateButton(ctx, L.rects.orbit, "ORBIT", { hover: hover(L.rects.orbit), accent: "#9d7bff", fontPx: Math.round(clamp(L.rects.orbit.h * 0.26, 12, 17)), time });
  if (!L.wide) {
    const { host, join, hangar, forge: fg } = L.rects;
    const ready = coop === "ready";
    const fp = Math.round(clamp(host.h * 0.3, 11, 14));
    plateButton(ctx, host, "HOST CO-OP", { hover: hover(host) && ready, disabled: !ready, accent: "#5dffb0", fontPx: fp, time });
    plateButton(ctx, join, "JOIN", { hover: hover(join) && ready, disabled: !ready, accent: "#5b7bff", fontPx: fp, time });
    plateButton(ctx, hangar, "HANGAR", { hover: hover(hangar), accent: "#9d7bff", fontPx: fp, time });
    plateButton(ctx, fg, "FORGE", { hover: hover(fg) && !!forge?.enabled, disabled: !forge || !forge.enabled, accent: "#ffb44d", fontPx: fp, time });
  }

  // How to play, in two quiet lines.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hint1 = touch
    ? "Left thumb moves  ·  right thumb aims and fires  ·  DASH button dodges"
    : "WASD move  ·  hold click to aim and fire  ·  SHIFT / E dash  ·  touch: drag";
  const hint2 = "Beat the Warden at 2:00 to launch into orbit. ORBIT jumps straight there.";
  const hs = Math.min(fitSans(ctx, hint1, L.colW, 13, 600), fitSans(ctx, hint2, L.colW, 13, 600));
  ctx.font = `500 ${hs}px ${SANS}`;
  ctx.fillStyle = "rgba(236,228,212,0.55)";
  ctx.fillText(hint1, cx, L.hintY);
  ctx.fillStyle = "rgba(255,157,77,0.75)";
  ctx.fillText(hint2, cx, L.hintY + hs + 8);

  if (best) {
    const t = `BEST RUN   ${formatTime(best.time)}   ·   ${best.kills} KILLS   ·   LV ${best.level}`;
    ctx.font = `700 12px ${DISPLAY}`;
    ctx.fillStyle = PALETTE.xp;
    const bs = Math.min(12, fitSans(ctx, t, L.colW, 12, 700));
    ctx.font = `700 ${bs}px ${DISPLAY}`;
    trackedText(ctx, t, cx, L.bestY, 1.5, "center");
  }

  // ---- Status line (co-op wake-up, Forge progress) ---------------------
  const status: { text: string; color: string }[] = [];
  if (coop === "waking") status.push({ text: "WAKING CO-OP SERVER…", color: "rgba(236,228,212,0.55)" });
  else if (coop === "unavailable") status.push({ text: "CO-OP UNAVAILABLE", color: "rgba(236,228,212,0.45)" });
  if (forge?.status) status.push({ text: forge.status, color: "rgba(255,210,150,0.92)" });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  status.forEach((s, i) => {
    ctx.font = `600 12px ${SANS}`;
    const size = fitSans(ctx, s.text, w * 0.92, 12, 600);
    ctx.font = `600 ${size}px ${SANS}`;
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, w / 2, L.statusY + i * 18);
  });

  // ---- Info panel (wide) -----------------------------------------------
  if (L.panel) drawPanel(ctx, L.panel, pointer);

  // ---- Footer: clickable key hints ---------------------------------------
  if (L.footerY !== null && !touch) {
    for (const f of L.footer) {
      const hot = hover(f.rect) && (f.id !== "forge" || !!forge?.enabled);
      const x = f.rect.x + 7;
      keyChip(ctx, x, L.footerY, f.key, hot, f.chipW);
      ctx.font = `${hot ? 700 : 500} 11.5px ${SANS}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hot ? "#fff7ee" : THEME.ash;
      ctx.fillText(f.label, x + f.chipW + 7, L.footerY + 0.5);
      if (hot) {
        ctx.fillStyle = THEME.gold;
        ctx.fillRect(x, L.footerY + 12, f.rect.w - 14, 1.5);
      }
    }
  }

  // ---- Mute -----------------------------------------------------------
  const mb = muteButtonRect(w);
  socket(ctx, mb.x + mb.w / 2, mb.y + mb.h / 2, 19, THEME.energy, (c, x, y, _s, col) => drawSpeaker(c, x, y, muted, col), { hover: hover(mb) });
}

/** Font size (<= max) at which `text` fits `maxW` in the UI sans face. */
function fitSans(ctx: CanvasRenderingContext2D, text: string, maxW: number, max = 16, weight = 600): number {
  ctx.font = `${weight} ${max}px ${SANS}`;
  const m = ctx.measureText(text).width;
  return m <= maxW || m === 0 ? max : Math.max(9, Math.floor((maxW / m) * max));
}
