import { beforeEach, describe, expect, it } from "vitest";
import { archetypeBackRect, archetypeSelectLayout } from "../../src/ui/archetypeSelect";
import { dashButtonRect, pauseButtonRect } from "../../src/ui/touchControls";
import { dashMeterRect, pingButtonRect, radarRect, teammateRowRect } from "../../src/ui/hud";
import { loadProfile, recordRunEnd } from "../../src/game/profile";
import { platform } from "../../src/platform";
import type { Rect } from "../../src/ui/screens";

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, w: number, h: number): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const PHONES = [[800, 360], [915, 412], [667, 375], [390, 844], [1280, 800]] as const;

describe("robot select layout", () => {
  for (const [w, h] of PHONES) {
    it(`four cards fit on screen without overlapping at ${w}x${h}`, () => {
      const r = archetypeSelectLayout(w, h);
      expect(r).toHaveLength(4);
      for (const c of r) {
        expect(inside(c, w, h), JSON.stringify(c)).toBe(true);
        expect(c.w).toBeGreaterThan(100);
        expect(c.h).toBeGreaterThan(100);
        expect(overlaps(c, archetypeBackRect())).toBe(false);
      }
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(overlaps(r[i], r[j])).toBe(false);
    });
  }
});

describe("touch buttons", () => {
  for (const [w, h] of PHONES) {
    it(`pause, dash, ping and the orbit radar don't collide at ${w}x${h}`, () => {
      const pause = pauseButtonRect(w, NO_INSETS);
      const dashSolo = dashButtonRect(w, h, NO_INSETS, false);
      const dashCoop = dashButtonRect(w, h, NO_INSETS, true);
      const ping = pingButtonRect(w, h);
      const radar = radarRect(w, h, true, true);
      for (const r of [pause, dashSolo, dashCoop, ping, radar]) expect(inside(r, w, h), JSON.stringify(r)).toBe(true);
      expect(overlaps(dashCoop, ping)).toBe(false);
      expect(overlaps(radar, pause)).toBe(false);
      expect(overlaps(radar, dashSolo)).toBe(false);
      expect(overlaps(radar, dashCoop)).toBe(false);
      // dash sits in the right (aim) half, where the right thumb is
      expect(dashSolo.x).toBeGreaterThan(w / 2);
    });
  }

  it("respect the safe area", () => {
    const insets = { top: 30, right: 44, bottom: 20, left: 44 };
    const pause = pauseButtonRect(800, insets);
    const dash = dashButtonRect(800, 360, insets, false);
    expect(pause.y).toBeGreaterThanOrEqual(30);
    expect(pause.x + pause.w).toBeLessThanOrEqual(800 - 44);
    expect(dash.x + dash.w).toBeLessThanOrEqual(800 - 44);
    expect(dash.y + dash.h).toBeLessThanOrEqual(360 - 20);
  });
});

describe("co-op HUD", () => {
  it("teammate rows sit below the dash meter and its label, never on top of them", () => {
    for (const w of [360, 390, 800, 1280, 1920]) {
      const dash = dashMeterRect(w);
      for (let row = 0; row < 3; row++) {
        expect(overlaps(teammateRowRect(row), dash), `w=${w} row=${row}`).toBe(false);
        expect(teammateRowRect(row).y, `w=${w} row=${row}`).toBeGreaterThanOrEqual(dash.y + dash.h + 4);
      }
    }
  });
});

describe("robot unlocks", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  it("starts with only the Vanguard, unlocks Striker at 50 total kills and Recon after a 3-minute run", () => {
    let p = loadProfile();
    expect(p.unlocked).toEqual(["vanguard"]);
    let r = recordRunEnd(p, 30, 60);
    expect(r.newlyUnlocked).toEqual([]);
    r = recordRunEnd(r.profile, 25, 90);
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("striker");
    r = recordRunEnd(r.profile, 1, 200);
    expect(r.newlyUnlocked.map((a) => a.id)).toContain("recon");
    p = loadProfile();
    expect(p.unlocked).toEqual(expect.arrayContaining(["vanguard", "striker", "recon"]));
    expect(p.totalRuns).toBe(3);
  });
});

describe("platform", () => {
  it("the website build is not native and its hooks are harmless no-ops", () => {
    expect(platform.native).toBe(false);
    expect(() => {
      platform.haptic("hit");
      platform.onBack(() => {});
      platform.ready();
      platform.exitApp();
    }).not.toThrow();
  });
});
