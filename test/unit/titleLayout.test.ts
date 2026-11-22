import { describe, expect, it } from "vitest";
import { type Rect } from "../../src/ui/screens";
import { titleButtonRects, titleFooterHit, titleLayout, titlePanelHit } from "../../src/ui/titleScreen";

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const SIZES = [[1920, 970], [1366, 650], [1280, 720], [900, 600], [390, 700], [844, 390], [667, 375]] as const;

describe("title buttons", () => {
  for (const [w, h] of SIZES) {
    it(`don't overlap and stay on screen at ${w}x${h}`, () => {
      const r = titleButtonRects(w, h);
      const all = Object.entries(r) as [string, Rect][];
      expect(all.map(([k]) => k).sort()).toEqual(["forge", "hangar", "host", "join", "orbit", "solo"]);
      for (const [name, rect] of all) {
        expect(rect.x, name).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w, name).toBeLessThanOrEqual(w);
        expect(rect.y, name).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.h, name).toBeLessThanOrEqual(h);
        expect(rect.w, name).toBeGreaterThan(20);
        expect(rect.h, name).toBeGreaterThan(20);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(overlaps(all[i][1], all[j][1]), `${all[i][0]} vs ${all[j][0]}`).toBe(false);
        }
      }
    });
  }

  it("puts ORBIT on the begin-run row, to its right, smaller than it", () => {
    for (const [w, h] of SIZES) {
      const { solo, orbit } = titleButtonRects(w, h);
      expect(orbit.y, `${w}x${h}`).toBeCloseTo(solo.y);
      expect(orbit.h).toBeCloseTo(solo.h);
      expect(orbit.x).toBeGreaterThan(solo.x + solo.w);
      expect(orbit.w).toBeLessThan(solo.w);
    }
  });

  it("wide screens put the four secondary actions in a top nav row, in order", () => {
    const { hangar, forge, host, join } = titleButtonRects(1280, 720);
    expect(new Set([hangar.y, forge.y, host.y, join.y]).size).toBe(1);
    expect(hangar.x).toBeLessThan(forge.x);
    expect(forge.x).toBeLessThan(host.x);
    expect(host.x).toBeLessThan(join.x);
    expect(hangar.y + hangar.h).toBeLessThan(titleLayout(1280, 720).rects.solo.y);
  });

  it("narrow screens stack them under the play row", () => {
    const { solo, host, join, hangar, forge } = titleButtonRects(390, 700);
    for (const r of [host, join, hangar, forge]) expect(r.y).toBeGreaterThan(solo.y + solo.h - 1);
    expect(hangar.y).toBeGreaterThan(host.y);
  });
});

describe("title panel", () => {
  it("shows on wide screens, clear of the buttons and inside the viewport", () => {
    for (const [w, h] of [[1920, 970], [1366, 650], [1280, 720], [900, 600]] as const) {
      const panel = titlePanelHit(w, h);
      expect(panel, `${w}x${h}`).not.toBeNull();
      const p = panel as Rect;
      expect(p.x + p.w).toBeLessThanOrEqual(w);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + p.h).toBeLessThanOrEqual(h);
      for (const [name, r] of Object.entries(titleButtonRects(w, h))) {
        expect(overlaps(p, r), name).toBe(false);
      }
    }
  });

  it("is hidden on phones and short landscape screens", () => {
    expect(titlePanelHit(390, 700)).toBeNull();
    expect(titlePanelHit(844, 390)).toBeNull();
  });

  it("the left column's title never runs into the panel", () => {
    for (const [w, h] of [[1280, 720], [900, 600]] as const) {
      const L = titleLayout(w, h);
      const p = L.panel!.rect;
      expect(L.cx + L.colW / 2).toBeLessThan(p.x);
    }
  });
});

describe("title footer key hints", () => {
  it("are five clickable boxes on tall wide screens, inside the viewport and not overlapping", () => {
    for (const [w, h] of [[1920, 970], [1366, 650], [1280, 720], [900, 600]] as const) {
      const items = titleLayout(w, h).footer;
      expect(items.map((i) => i.id), `${w}x${h}`).toEqual(["begin", "orbit", "hangar", "forge", "mute"]);
      for (const it of items) {
        expect(it.rect.x).toBeGreaterThanOrEqual(0);
        expect(it.rect.x + it.rect.w).toBeLessThanOrEqual(w);
        expect(it.rect.y + it.rect.h).toBeLessThanOrEqual(h);
      }
      for (let i = 1; i < items.length; i++) {
        expect(items[i].rect.x).toBeGreaterThanOrEqual(items[i - 1].rect.x + items[i - 1].rect.w);
      }
    }
  });

  it("hit-tests to the right action", () => {
    const L = titleLayout(1280, 720);
    for (const it of L.footer) {
      expect(titleFooterHit(1280, 720, it.rect.x + it.rect.w / 2, it.rect.y + it.rect.h / 2)).toBe(it.id);
    }
    expect(titleFooterHit(1280, 720, 640, 360)).toBeNull();
  });

  it("don't exist where there is no footer (phones, very short screens)", () => {
    expect(titleLayout(390, 700).footer).toEqual([]);
    expect(titleLayout(844, 390).footer).toEqual([]);
    expect(titleFooterHit(390, 700, 100, 670)).toBeNull();
  });

  it("stay clear of the play buttons", () => {
    for (const [w, h] of [[1280, 720], [1366, 650], [900, 600]] as const) {
      const L = titleLayout(w, h);
      for (const it of L.footer) {
        for (const [name, r] of Object.entries(L.rects)) expect(overlaps(it.rect, r), `${it.id} vs ${name}`).toBe(false);
      }
    }
  });
});
