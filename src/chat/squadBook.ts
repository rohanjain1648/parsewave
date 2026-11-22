/**
 * What this browser remembers about squads and players, for the Squads inbox.
 * Nexconn stores the messages; this only stores the names to show for them,
 * since players have no accounts and callsigns change every visit.
 */
const SQUADS_KEY = "novaswarm.squads";
const USERS_KEY = "novaswarm.chatNames";
const MAX_SQUADS = 50;
const MAX_USERS = 500;

export interface SquadRecord {
  id: string;
  names: string[];
  at: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the inbox just shows generic names.
  }
}

export function rememberSquad(id: string, names: string[], now = Date.now()): void {
  const list = read<SquadRecord[]>(SQUADS_KEY, []).filter((s) => s.id !== id);
  list.unshift({ id, names: names.map((n) => String(n).slice(0, 12)).slice(0, 4), at: now });
  write(SQUADS_KEY, list.slice(0, MAX_SQUADS));
}

export function squads(): SquadRecord[] {
  return read<SquadRecord[]>(SQUADS_KEY, []);
}

export function squadName(id: string): string {
  const s = squads().find((x) => x.id === id);
  if (!s) return "Squad";
  const day = new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Squad · ${s.names.join(", ")} · ${day}`.slice(0, 64);
}

export function rememberUser(userId: string, name: string): void {
  if (!userId || !name) return;
  const map = read<Record<string, string>>(USERS_KEY, {});
  if (map[userId] === name) return;
  map[userId] = String(name).slice(0, 12);
  const keys = Object.keys(map);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_USERS))) delete map[k];
  write(USERS_KEY, map);
}

export function userName(userId: string): string {
  return read<Record<string, string>>(USERS_KEY, {})[userId] ?? "Player";
}
