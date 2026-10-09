// Records the QuoteDrive product demo by driving a real browser (Playwright), with a visible
// cursor, click ripples and captions burned into the page. Optional voice-over uses macOS `say`.
// Story and captions follow docs/product/demo-video-script.md.
//
//   npm run demo:record                 # silent, captions on screen -> demo/out/quotedrive-demo.mp4
//   npm run demo:record -- --voice      # adds a macOS voice-over
//   DEMO_FAST=1 npm run demo:record     # shorter pauses, for trying the script out
//
// Needs the docker compose stack running with demo data (seed_demo + seed_demo_history) and
// ffmpeg on the PATH. Never run it against a stack with real data: it creates records.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const VOICE = process.argv.includes("--voice");
const FAST = process.env.DEMO_FAST === "1";
const W = 1440;
const H = 900;
const k = FAST ? 0.35 : 1;

const MANAGER = "manager@northstar.example";
const APPROVER = "approver@northstar.example";
const VIEWER = "viewer@northstar.example";
const ADMIN = "admin@northstar.example";
const stamp =
  new Date().toISOString().slice(5, 10) +
  " " +
  new Date().toTimeString().slice(0, 5);
const TITLE = `Fleet Renewal ${stamp}`;
const CUSTOMER = "Lombarda Studio Group";
const NOTES =
  "Call with Elena Marchetti, Operations Director. They move staff and clients between three offices in Milan, Turin and Rome. Today 12 vehicles, mostly diesel. Want to go electric on short routes, a hybrid account manager for the day-to-day, and long-distance cover for client visits. Decision by end of quarter. Budget is not fixed yet.";

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * k));

// ---- voice-over: one clip per caption, so each caption stays up as long as it is spoken ----
const clips = [];
function speak(text) {
  if (!VOICE) return 0;
  const file = path.join(OUT, `vo-${clips.length}.aiff`);
  execFileSync("say", ["-v", "Samantha", "-r", "175", "-o", file, text]);
  const seconds = Number(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ])
      .toString()
      .trim(),
  );
  clips.push({ file, at: 0 });
  return seconds * 1000;
}

// ---- overlay: cursor, click ripple and caption, re-created on every page load ----
const OVERLAY = () => {
  const css = `
  #qd-cursor{position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;pointer-events:none;
    transition:transform .05s linear;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
  .qd-ripple{position:fixed;z-index:2147483646;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;
    border:3px solid #a6e22e;animation:qd-r .55s ease-out forwards}
  @keyframes qd-r{from{transform:scale(.6);opacity:1}to{transform:scale(3.4);opacity:0}}
  #qd-cap{position:fixed;z-index:2147483645;left:50%;bottom:34px;transform:translateX(-50%);max-width:1240px;padding:14px 26px;
    border-radius:14px;background:rgba(6,11,19,.88);border:1px solid rgba(166,226,46,.35);color:#fff;font:600 24px/1.3 -apple-system,Inter,sans-serif;
    text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5);pointer-events:none;transition:opacity .25s}
  #qd-cap:empty{opacity:0}`;
  const mount = () => {
    if (document.getElementById("qd-cursor")) return;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.append(st);
    const c = document.createElement("div");
    c.id = "qd-cursor";
    c.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 3-8 8-3z" fill="#fff" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const pos = JSON.parse(sessionStorage.getItem("qd-pos") ?? "[80,80]");
    c.style.left = pos[0] + "px";
    c.style.top = pos[1] + "px";
    const cap = document.createElement("div");
    cap.id = "qd-cap";
    cap.textContent = sessionStorage.getItem("qd-cap") ?? "";
    document.body.append(c, cap);
  };
  document.addEventListener("DOMContentLoaded", mount);
  if (document.readyState !== "loading") mount();
  addEventListener(
    "mousemove",
    (e) => {
      mount();
      const c = document.getElementById("qd-cursor");
      c.style.left = e.clientX + "px";
      c.style.top = e.clientY + "px";
      sessionStorage.setItem("qd-pos", JSON.stringify([e.clientX, e.clientY]));
    },
    true,
  );
  addEventListener(
    "mousedown",
    (e) => {
      const r = document.createElement("div");
      r.className = "qd-ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.append(r);
      setTimeout(() => r.remove(), 700);
    },
    true,
  );
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
await context.addInitScript(OVERLAY);
const t0 = Date.now();
const page = await context.newPage();
await page.setDefaultTimeout(20_000);
if (process.env.DEMO_DEBUG)
  page.on(
    "response",
    (r) =>
      r.url().includes("8010") &&
      r.status() >= 400 &&
      console.log("HTTP", r.status(), r.url()),
  );
process.on("exit", () => {});

// ---- helpers: human-paced actions ----
async function caption(text, minMs = 2200) {
  const spoken = speak(text);
  if (VOICE) clips[clips.length - 1].at = Date.now() - t0;
  await page.evaluate((t) => {
    sessionStorage.setItem("qd-cap", t ?? "");
    const el = document.getElementById("qd-cap");
    if (el) el.textContent = t ?? "";
  }, text);
  // Without a voice, hold long enough to read: about 3 words a second plus a beat.
  const reading = text.split(/\s+/).length * 330 + 900;
  await sleep(Math.max(minMs, spoken / k + 500, VOICE ? 0 : reading));
}
// Real model waits are long. They are recorded for real, then played back faster (silent takes only),
// with a subtitle saying so, so nobody thinks the AI is instant.
const SPEEDUP = 8;
const spans = [];
async function aiWait(label, wait) {
  await page.evaluate((t) => {
    sessionStorage.setItem("qd-cap", t);
    const el = document.getElementById("qd-cap");
    if (el) el.textContent = t;
  }, `${label} (sped up ${SPEEDUP}x)`);
  const a = Date.now() - t0;
  await wait();
  const b = Date.now() - t0;
  if (b - a > 4000) spans.push([a + 1200, b]);
  await page.evaluate(() => {
    sessionStorage.removeItem("qd-cap");
    const el = document.getElementById("qd-cap");
    if (el) el.textContent = "";
  });
}
const clearCaption = () =>
  page.evaluate(() => {
    sessionStorage.removeItem("qd-cap");
    const el = document.getElementById("qd-cap");
    if (el) el.textContent = "";
  });

async function glide(locator) {
  await locator.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await sleep(250);
  const box = await locator.boundingBox();
  if (!box) throw new Error("no box for " + locator);
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 24);
  await page.mouse.move(x, y, { steps: FAST ? 8 : 28 });
  await sleep(250);
  return [x, y];
}
async function click(locator) {
  await glide(locator);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(500);
}
async function typeInto(locator, text, delay = 28) {
  await click(locator);
  await locator.press("ControlOrMeta+a");
  await locator.pressSequentially(text, { delay: delay * k });
  await sleep(400);
}
async function login(email) {
  await page.goto(BASE + "/");
  await sleep(900);
  await click(page.getByRole("button", { name: new RegExp(email) }));
  await page.getByRole("button", { name: "Log out" }).waitFor();
  await sleep(900);
  // Every user gets their own first-visit tour; only the manager's is part of the story.
  const skip = page
    .getByRole("dialog")
    .getByRole("button", { name: "Skip tour" });
  if (
    await skip.waitFor({ timeout: 4000 }).then(
      () => true,
      () => false,
    )
  )
    await click(skip);
}
async function logout() {
  await click(page.getByRole("button", { name: "Log out" }));
  await page.getByText("Sign in as a demo user").waitFor();
  await sleep(500);
}
const nav = (name) =>
  page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name })
    .first();
const step = (n, label) =>
  console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${n}. ${label}`);

// 1. Sign-in
step(1, "sign-in");
await page.goto(BASE + "/");
await sleep(1200);
await caption(
  "QuoteDrive: a multi-tenant proposal workspace where AI drafts and people decide. Everything you'll see is synthetic.",
  4200,
);

// 2. Manager signs in; first-visit tour
step(2, "tour");
await click(page.getByRole("button", { name: new RegExp(MANAGER) }));
await page.getByRole("button", { name: "Log out" }).waitFor();
await caption("First visit? A one-minute tour, replayable from Help.", 2600);
const tourNext = page.getByRole("dialog").getByRole("button", { name: "Next" });
if (await tourNext.count()) {
  await sleep(1800);
  await click(tourNext);
  await sleep(2200);
  await click(tourNext);
  await sleep(1600);
  await click(
    page.getByRole("dialog").getByRole("button", { name: /Skip tour|Close/ }),
  );
}
await clearCaption();

// 3. Dashboard
step(3, "dashboard");
await click(nav("Dashboard"));
await sleep(1500);
await caption(
  "Everything on one screen. Hover any chart for detail, or switch the range.",
  3000,
);
const weekly = page.locator('[aria-label="Weekly activity"]').first();
if (await weekly.count()) {
  const b = await weekly.boundingBox();
  if (b) {
    await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.6, {
      steps: 20,
    });
    await page.mouse.move(b.x + b.width * 0.85, b.y + b.height * 0.55, {
      steps: FAST ? 20 : 90,
    });
  }
}
await sleep(600);
const stage = page.getByRole("button", { name: /^Approved/ }).first();
if (await stage.count()) await click(stage);
await sleep(900);
await page.keyboard.press("Escape");
await click(page.getByRole("button", { name: "4 weeks" }));
await sleep(1400);
await click(page.getByRole("button", { name: "12 weeks" }));
await clearCaption();

// 4. Opportunities list -> side panel
step(4, "opportunities");
await click(nav("Opportunities"));
await page.getByRole("table").waitFor();
await sleep(1200);
await caption(
  "Click a row and the details open beside the list. The panel always says what to do next.",
  3200,
);
const chip = page.getByRole("button", { name: /Needs attention/ });
if (await chip.count()) {
  await click(chip.first());
  await sleep(1000);
  await click(chip.first());
}
// Create the opportunity the rest of the story follows.
await click(page.getByRole("button", { name: "New opportunity" }));
const dlg = page.getByRole("dialog", { name: "New opportunity" });
await dlg.getByLabel("Customer").selectOption({ label: CUSTOMER });
await sleep(500);
await typeInto(dlg.getByLabel("Title"), TITLE);
await click(dlg.getByRole("button", { name: "Create opportunity" }));
const panel = page.getByRole("dialog", { name: TITLE });
await panel.waitFor();
await sleep(2200);
await clearCaption();

// 5. Discovery brief with AI
step(5, "discovery brief");
await caption(
  "AI drafts the brief. A person edits and saves. Nothing is saved automatically.",
  3000,
);
await typeInto(
  panel.getByPlaceholder(/Paste call or meeting notes/),
  NOTES,
  12,
);
await click(panel.getByRole("button", { name: /Draft brief with AI/ }));
await aiWait("The local AI is reading the call notes", () =>
  panel
    .getByRole("button", { name: "Save brief" })
    .waitFor({ timeout: 90_000 }),
);
await sleep(2600);
await click(panel.getByRole("button", { name: "Save brief" }));
await sleep(1600);
await clearCaption();

// 6. Proposal builder
step(6, "builder");
await click(panel.getByRole("tab", { name: /^Proposals/ }));
await click(
  panel
    .getByRole("tabpanel")
    .getByRole("button", { name: "Create draft version" }),
);
await page.waitForURL(/\/versions\/\d+$/);
await sleep(1200);
await caption(
  "Five steps, and the AI step is right there. The numbers come from the server's catalogue, never the model.",
  4200,
);
const LINES = [
  ["Electric City · $649.00/mo", "4"],
  ["Hybrid Account Manager · $549.00/mo", "5"],
  ["Long Distance · $729.00/mo", "3"],
];
for (const [i, [option, qty]] of LINES.entries()) {
  const select = page.getByRole("combobox", { name: "Package to add" });
  await glide(select);
  await select.selectOption({ label: option });
  await sleep(500);
  await click(page.getByRole("button", { name: "Add package line" }));
  await typeInto(page.getByLabel("Quantity").nth(i), qty);
}
await page.getByText("Total: $7528.00").waitFor();
await sleep(1500);
await click(page.getByRole("button", { name: "Save", exact: true }).first());
await sleep(1500);
await clearCaption();

// 7. Narrative, finalize, submit
step(7, "narrative + submit");
await caption(
  "The draft passes a schema and an output guard before a person sees it. Submitting assigns one approver.",
  3600,
);
const narrative = page.locator("#ai-narrative");
await click(narrative.getByRole("button", { name: "Draft with AI" }));
const summary = page.locator("#narrative-executive-summary");
await aiWait("The local AI is writing the narrative", () =>
  summary.waitFor({ timeout: 90_000 }),
);
await sleep(2400);
await click(summary);
await page.keyboard.press("ControlOrMeta+End");
await page.keyboard.type(" Delivery starts after sign-off.", { delay: 35 * k });
await sleep(800);
await click(narrative.getByRole("button", { name: "Save", exact: true }));
await sleep(1400);
await click(page.getByRole("button", { name: "Finalize", exact: true }));
await click(page.getByRole("button", { name: "Finalize version" }));
await page.getByText("Proposal drafted").first().waitFor();
await sleep(1200);
await click(page.getByRole("button", { name: "Submit for approval" }));
const approverSelect = page.getByLabel("Approver");
const approverOption = approverSelect.locator("option", {
  hasText: "(Approver)",
});
await approverOption
  .first()
  .waitFor({ state: "attached" })
  .catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, "debug.png") });
    throw e;
  });
await glide(approverSelect);
await approverSelect.selectOption({
  label: (await approverOption.first().textContent()).trim(),
});
await sleep(1000);
await click(
  page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Submit for approval" }),
);
await page.getByText("Awaiting approval").first().waitFor();
await sleep(1500);
const versionUrl = page.url();
await clearCaption();
await logout();

// 8. Approver
step(8, "approval");
await login(APPROVER);
await caption(
  "The approver sees what changed, then approves or requests changes.",
  3000,
);
await click(nav("Approvals"));
await page
  .getByRole("button", { name: /^View / })
  .first()
  .waitFor({ timeout: 30_000 })
  .catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, "debug.png") });
    throw e;
  });
await sleep(1200);
await typeInto(page.getByPlaceholder("Search proposal or person"), TITLE, 20);
await sleep(800);
await click(
  page.getByRole("button", { name: new RegExp(`^View ${TITLE}`) }).first(),
);
await sleep(2200);
await click(page.getByRole("button", { name: "Approve" }));
await click(page.getByRole("button", { name: "Confirm approve" }));
await page.getByText("Proposal version approved successfully.").waitFor();
await sleep(1800);
await clearCaption();
await logout();

// 9. Share, outcome, client preview
step(9, "share + preview");
await login(MANAGER);
await caption(
  "An approved version becomes a client-ready preview. QuoteDrive sends nothing; it records what happened.",
  4000,
);
await page.goto(versionUrl);
await sleep(1500);
await click(page.getByRole("button", { name: "Mark as shared" }));
await click(
  page.getByRole("alertdialog").getByRole("button", { name: "Mark as shared" }),
);
await sleep(1200);
await click(page.getByRole("button", { name: "Record outcome" }));
const outcome = page.getByRole("alertdialog");
await outcome.getByRole("radio", { name: /^Won/ }).check();
await sleep(700);
await click(outcome.getByRole("button", { name: "Record outcome" }));
await sleep(1200);
await click(page.getByRole("link", { name: /Client preview/ }).first());
await page
  .getByText(/Illustrative planning estimate only/)
  .first()
  .waitFor();
await sleep(1500);
await page.mouse.wheel(0, 700);
await sleep(2600);
await clearCaption();

// 10. Customers, roles
step(10, "customers + roles");
// The client preview has its own top bar, so leave it by URL.
await page.goto(BASE + "/customers");
await page.getByRole("table").waitFor();
await sleep(800);
await caption(
  "Each customer has a profile the AI reads: industry, size, contact. Viewers read, admins manage.",
  3600,
);
await click(page.getByRole("row", { name: new RegExp(CUSTOMER) }));
const modal = page.getByRole("dialog", { name: CUSTOMER });
await modal.waitFor();
await sleep(2400);
const list = modal.locator("ul").first();
if (await list.count()) {
  const lb = await list.boundingBox();
  if (lb) await page.mouse.move(lb.x + lb.width / 2, lb.y + 60, { steps: 12 });
  await page.mouse.wheel(0, 260);
}
await sleep(1400);
await click(modal.getByRole("button", { name: new RegExp(TITLE) }));
await sleep(2400);
await page.keyboard.press("Escape");
await sleep(900);
await page.keyboard.press("Escape");
await sleep(900);
await logout();
await login(VIEWER);
await click(nav("Customers"));
await page.getByRole("table").waitFor();
await sleep(2600);
await logout();
await login(ADMIN);
await click(nav("Settings"));
await click(page.getByRole("tab", { name: "Members" }));
await sleep(2600);
await clearCaption();

// 11. End card
step(11, "end card");
await page.setContent(`<body style="margin:0;height:100vh;display:grid;place-items:center;background:#060b13;color:#fff;font-family:-apple-system,Inter,sans-serif;text-align:center">
<div><p style="color:#a6e22e;letter-spacing:.14em;text-transform:uppercase;font-weight:700;font-size:22px">QuoteDrive</p>
<h1 style="font-size:64px;margin:12px 0">AI drafts. People decide.</h1>
<p style="font-size:28px;color:#9fb0c6">React · FastAPI · Postgres · 8 ADRs · tenant-isolation tests · scored AI evals</p>
<p style="font-size:26px;color:#a6e22e;margin-top:28px">github.com/dorkian/QuoteDrive</p></div></body>`);
if (VOICE) {
  const spoken = speak(
    "React, FastAPI and Postgres. 8 A D Rs, tenant-isolation tests, scored AI evals. Code and case study linked below.",
  );
  clips[clips.length - 1].at = Date.now() - t0;
  await sleep(Math.max(4500, spoken / k + 600));
} else await sleep(4500);

const videoPath = await page.video().path();
await context.close();
await browser.close();

// ---- assemble ----
const webm = path.join(OUT, "quotedrive-demo.webm");
rmSync(webm, { force: true });
renameSync(videoPath, webm);
for (const f of readdirSync(OUT))
  if (f.endsWith(".webm") && f !== "quotedrive-demo.webm")
    rmSync(path.join(OUT, f));
const mp4 = path.join(OUT, "quotedrive-demo.mp4");
if (VOICE && clips.length) {
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const filter =
    clips
      .map(
        (c, i) =>
          `[${i + 1}:a]adelay=${Math.round(c.at)}|${Math.round(c.at)}[a${i}]`,
      )
      .join(";") +
    ";" +
    clips.map((_, i) => `[a${i}]`).join("") +
    `amix=inputs=${clips.length}:normalize=0[aud]`;
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      ...inputs,
      "-filter_complex",
      filter,
      "-map",
      "0:v",
      "-map",
      "[aud]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-shortest",
      mp4,
    ],
    { stdio: "ignore" },
  );
} else {
  // Silent take: play each recorded AI wait faster, everything else at normal speed.
  const fast = spans.filter(([a, b]) => b > a);
  const cuts = [];
  let from = 0;
  for (const [a, b] of fast) {
    cuts.push({ a: from / 1000, b: a / 1000, speed: 1 });
    cuts.push({ a: a / 1000, b: b / 1000, speed: SPEEDUP });
    from = b;
  }
  cuts.push({ a: from / 1000, b: null, speed: 1 });
  const parts = cuts.map((c, i) => {
    const trim = c.b === null ? `start=${c.a}` : `start=${c.a}:end=${c.b}`;
    return `[0:v]trim=${trim},setpts=(PTS-STARTPTS)/${c.speed}[v${i}]`;
  });
  const filter = `${parts.join(";")};${cuts.map((_, i) => `[v${i}]`).join("")}concat=n=${cuts.length}:v=1:a=0[out]`;
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      mp4,
    ],
    { stdio: "ignore" },
  );
}
writeFileSync(path.join(OUT, ".gitignore"), "*\n");
console.log(`\nDone: ${mp4}`);
