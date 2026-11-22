import type { Archetype, ArchetypeId } from "./archetypes";
import { ARCHETYPE_LIST } from "./archetypes";

const PROFILE_KEY = "novaswarm.profile";

/** Persistent cross-run progress — separate from the single best-run `RunStats`
 * in main.ts, which only tracks the single best time. This accumulates across
 * every run ever played, win or quit, and drives archetype unlocks. */
export interface Profile {
  totalKills: number;
  totalRuns: number;
  bestSurviveSeconds: number;
  unlocked: ArchetypeId[];
  lastSelected: ArchetypeId;
}

function defaultProfile(): Profile {
  return { totalKills: 0, totalRuns: 0, bestSurviveSeconds: 0, unlocked: ["vanguard"], lastSelected: "vanguard" };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    // Merge over defaults so a future field addition never crashes on an old save.
    return { ...defaultProfile(), ...parsed, unlocked: parsed.unlocked?.length ? parsed.unlocked : ["vanguard"] };
  } catch {
    return defaultProfile();
  }
}

function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable in private mode; unlocks are non-critical */
  }
}

function isUnlocked(profile: Profile, archetype: Archetype): boolean {
  switch (archetype.unlock.kind) {
    case "default":
      return true;
    case "totalKills":
      return profile.totalKills >= archetype.unlock.count;
    case "survive":
      return profile.bestSurviveSeconds >= archetype.unlock.seconds;
  }
}

/** How close the profile is to meeting an archetype's unlock condition, for
 * progress text on locked cards (e.g. "32 / 50 kills"). */
export function unlockProgress(profile: Profile, archetype: Archetype): { have: number; need: number; label: string } {
  switch (archetype.unlock.kind) {
    case "default":
      return { have: 1, need: 1, label: "unlocked" };
    case "totalKills":
      return { have: profile.totalKills, need: archetype.unlock.count, label: `${profile.totalKills} / ${archetype.unlock.count} kills` };
    case "survive": {
      const m = Math.floor(archetype.unlock.seconds / 60);
      return { have: profile.bestSurviveSeconds, need: archetype.unlock.seconds, label: `survive ${m} min (best ${Math.floor(profile.bestSurviveSeconds)}s)` };
    }
  }
}

/** Fold one finished run's stats into the profile, persist, and return any
 * archetypes that just crossed their unlock threshold (for a toast). */
export function recordRunEnd(profile: Profile, kills: number, surviveSeconds: number): { profile: Profile; newlyUnlocked: Archetype[] } {
  const before = new Set(profile.unlocked);
  const next: Profile = {
    ...profile,
    totalKills: profile.totalKills + kills,
    totalRuns: profile.totalRuns + 1,
    bestSurviveSeconds: Math.max(profile.bestSurviveSeconds, surviveSeconds),
    unlocked: profile.unlocked,
  };
  next.unlocked = ARCHETYPE_LIST.filter((a) => isUnlocked(next, a)).map((a) => a.id);
  const newlyUnlocked = ARCHETYPE_LIST.filter((a) => !before.has(a.id) && next.unlocked.includes(a.id));
  saveProfile(next);
  return { profile: next, newlyUnlocked };
}

export function setLastSelected(profile: Profile, id: ArchetypeId): Profile {
  const next = { ...profile, lastSelected: id };
  saveProfile(next);
  return next;
}
