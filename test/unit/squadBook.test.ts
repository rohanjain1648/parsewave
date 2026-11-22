import { beforeEach, expect, test } from "vitest";
import { rememberSquad, rememberUser, squadName, squads, userName } from "../../src/chat/squadBook";

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
});

test("squads are listed newest first, a replayed squad moves to the top, and names are capped", () => {
  rememberSquad("sq1", ["ARC-1", "BOLT-7"], 1000);
  rememberSquad("sq2", ["ION-2"], 2000);
  rememberSquad("sq1", ["ARC-1", "BOLT-7", "x".repeat(40)], 3000);
  expect(squads().map((s) => s.id)).toEqual(["sq1", "sq2"]);
  expect(squadName("sq1")).toContain("ARC-1, BOLT-7");
  expect(squadName("sq1").length).toBeLessThanOrEqual(64);
  expect(squadName("unknown")).toBe("Squad");
});

test("player names are remembered by chat id, with a fallback", () => {
  rememberUser("u1", "NOVA-6");
  expect(userName("u1")).toBe("NOVA-6");
  expect(userName("u2")).toBe("Player");
});

test("unreadable storage never throws", () => {
  localStorage.setItem("novaswarm.squads", "{not json");
  expect(squads()).toEqual([]);
});
