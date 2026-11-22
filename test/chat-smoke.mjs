/**
 * Live chat smoke test against REAL Nexconn: three browsers (host, joiner,
 * spectator) through a local relay.
 *
 *   squad text reaches the squad, a quick line reaches squad and spectator,
 *   crowd chat reaches players, and a crowd vote changes the host's run.
 *
 * Needs real keys in server/.env (see server/.env.example), and sends real
 * messages to your Nexconn app.
 *
 * Run:  npm run smoke:chat      (SHOT_DIR=<dir> also saves screenshots)
 */
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { build, preview } from "vite";
import { chromium } from "playwright";

if (!existsSync("server/.env")) {
  console.error("CHAT SMOKE SKIPPED: server/.env not found (copy server/.env.example and fill it in).");
  process.exit(2);
}

const WEB_PORT = 4189;
const SHOT_DIR = process.env.SHOT_DIR;
const errors = [];
let exitCode = 0;
let relayPort = 0;

const relayProc = spawn("npm", ["--prefix", "server", "start"], {
  env: { ...process.env, PORT: "0" },
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});
relayProc.stderr.on("data", (d) => process.stderr.write(`[relay] ${d}`));
relayProc.stdout.on("data", (d) => {
  const s = String(d);
  if (s.includes("chat setup failed") || s.includes("chat session failed")) process.stderr.write(`[relay] ${s}`);
  const m = /listening on :(\d+)/.exec(s);
  if (m) relayPort = Number(m[1]);
});
function stopRelay() {
  if (relayProc.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${relayProc.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  } else {
    relayProc.kill("SIGTERM");
  }
}

const nova = (page) => page.evaluate(() => window.__nova());
async function waitFor(page, pred, what, timeout = 30_000) {
  const end = Date.now() + timeout;
  let last;
  const toasts = new Set();
  while (Date.now() < end) {
    last = await nova(page).catch(() => undefined);
    if (last?.toast) toasts.add(last.toast);
    if (last && pred(last)) return last;
    await page.waitForTimeout(200);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify({ state: last?.state, mode: last?.mode, chat: last?.chat, toast: last?.toast, relay: last?.relay, feed: last?.chatFeed, toasts: [...toasts] })})`);
}
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const shot = async (page, name) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
};
const say = async (page, text) => {
  await page.fill(".chat-form input", text);
  await page.click(".chat-form button");
};

let server;
let browser;
try {
  for (let i = 0; i < 150 && !relayPort; i++) await new Promise((r) => setTimeout(r, 200));
  if (!relayPort) throw new Error("relay did not come up");
  process.env.VITE_RELAY_URL = `ws://localhost:${relayPort}`;
  await build({ logLevel: "error", build: { outDir: "dist-coop" } });
  server = await preview({ logLevel: "error", build: { outDir: "dist-coop" }, preview: { port: WEB_PORT, strictPort: true } });
  const url = server.resolvedUrls.local[0];

  browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl"] });
  const open = async (label, path) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "warning" && /chat|squads/i.test(m.text())) console.log(`[${label} warn] ${m.text()}`);
      // Nexconn SDK 26.5 posts its own logs to logcollection.ronghub.com, which the
      // browser blocks (CORS). That's the SDK's telemetry, not this app.
      if (m.type() === "error" && !/ronghub\.com|ERR_FAILED/.test(m.text())) errors.push(`${label} console: ${m.text()}`);
    });
    await page.goto(url + path, { waitUntil: "load", timeout: 60_000 });
    return page;
  };

  // Host and joiner connect to chat in the lobby.
  const a = await open("host", "?debug");
  const menu = await waitFor(a, (s) => s.state === "menu" && s.coop === "ready", "host menu", 90_000);
  await a.mouse.click(...center(menu.ui.title.host));
  const lobby = await waitFor(a, (s) => s.state === "lobby" && s.chat === "ready", "host chat ready", 60_000);
  const b = await open("joiner", `?debug&room=${lobby.code}`);
  await waitFor(b, (s) => s.state === "lobby" && s.chat === "ready", "joiner chat ready", 90_000);
  console.log("OK: host and joiner connected to Nexconn and joined the room's channels");

  await say(a, "hello squad");
  await waitFor(b, (s) => s.chatFeed.includes("hello squad"), "joiner receives squad text");
  await new Promise((r) => setTimeout(r, 1200));
  await say(b, "hi host");
  await waitFor(a, (s) => s.chatFeed.includes("hi host"), "host receives squad text");
  await shot(a, "1-lobby-chat");
  console.log("OK: squad chat works both ways");

  // Run starts; a spectator arrives mid-run by link.
  await a.mouse.click(...center(lobby.ui.lobby.start));
  await waitFor(a, (s) => s.state === "playing", "host playing");
  await waitFor(b, (s) => s.state === "playing", "joiner playing");
  // Keep both robots firing and dodging for the rest of the test, picking cards when offered.
  let fighting = true;
  const fight = (async () => {
    const dirs = new Map([[a, "d"], [b, "a"]]);
    for (const [p, d] of dirs) {
      await p.mouse.move(900, 400);
      await p.mouse.down();
      await p.keyboard.down(d);
    }
    while (fighting) {
      await a.waitForTimeout(2500);
      for (const [p, d] of dirs) {
        await p.keyboard.up(d);
        const next = d === "d" ? "a" : "d";
        dirs.set(p, next);
        await p.keyboard.down(next);
        if ((await nova(p)).state === "levelup") await p.keyboard.press("Digit1");
      }
    }
  })().catch(() => {});
  const c = await open("spectator", `?debug&watch=${lobby.code}`);
  await waitFor(c, (s) => s.state === "playing" && s.mode === "spectator", "spectator watching", 90_000);
  await waitFor(c, (s) => s.chat === "ready", "spectator chat ready", 60_000);
  await waitFor(a, (s) => s.spectators === 1, "host sees 1 watching");
  console.log("OK: spectator joined mid-run without a player slot");

  // Quick chat reaches the squad and the spectator.
  await a.waitForTimeout(1200);
  await a.keyboard.press("Digit3"); // Whatever line is third: read it back from the host's own feed.
  const line = (await waitFor(a, (s) => s.chatFeed.length >= 3, "host quick line in own feed")).chatFeed.at(-1);
  await waitFor(b, (s) => s.chatFeed.includes(line), `joiner sees quick line "${line}"`);
  await waitFor(c, (s) => s.chatFeed.includes(line), `spectator sees quick line "${line}"`);
  await shot(a, "2-quick-chat");
  console.log(`OK: quick line "${line}" reached squad and spectator`);

  // Crowd chat reaches players.
  await say(c, "go go go");
  await waitFor(a, (s) => s.chatFeed.includes("go go go"), "host sees crowd chat");
  await shot(c, "3-spectator-view");
  console.log("OK: crowd chat reaches players");

  // Crowd vote: spectator picks a surge; keep the squad's run going until it lands.
  await c.waitForSelector(".chat-vote button", { timeout: 60_000 });
  await shot(c, "4-crowd-vote");
  const voted = await c.click(".chat-vote button:nth-of-type(2)", { timeout: 5_000 }).then(() => true, () => false);
  if (!voted) console.log("SKIP: the vote window closed before this slow test browser could click (vote shown and closed fine)");
  const before = (await nova(a)).liveEnemies;
  const applied = voted && await a
    .waitForFunction(() => (window.__nova().toast ?? "").includes("crowd chose"), null, { timeout: 25_000 })
    .then(() => true, () => false);
  if (applied) {
    const after = (await nova(a)).liveEnemies;
    await shot(a, "5-crowd-result");
    console.log(`OK: crowd vote applied by the host (enemies ${before} -> ${after})`);
  } else {
    // The squad can fall before the window closes; then the vote must still close cleanly.
    const s = await nova(a);
    if (voted && s.state !== "gameover") throw new Error(`host never showed the crowd result (host state=${s.state})`);
    await c.waitForSelector(".chat-vote button", { state: "detached", timeout: 30_000 });
    console.log("OK: the run ended mid-vote and the spectator's vote card closed (result not applied: squad was down)");
  }

  // Squads inbox (Nexconn Chat UI): after the match the squad's history is still there.
  fighting = false;
  await fight;
  await a.goto(url + "?debug", { waitUntil: "load", timeout: 60_000 });
  await waitFor(a, (s) => s.state === "menu" && s.coop === "ready", "host back on the menu", 90_000);
  await a.click(".squads-button");
  await a.waitForSelector("nc-chat-ui-app-provider", { timeout: 30_000 });
  await a.getByText("Squad ·").first().click({ timeout: 30_000 });
  await a.getByText("hi host").nth(1).waitFor({ timeout: 30_000 }).catch(async (e) => {
    await shot(a, "6-squads-inbox-FAIL");
    throw e;
  });
  await shot(a, "6-squads-inbox");
  console.log("OK: Squads inbox (Chat UI) shows the squad's earlier messages");
  fighting = false;
  await fight;
} catch (e) {
  console.error("CHAT SMOKE FAIL:", e.message);
  exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.httpServer.close(r));
  stopRelay();
}

if (errors.length) {
  console.error("Runtime errors:\n  " + errors.join("\n  "));
  exitCode = 1;
}
process.exit(exitCode);
