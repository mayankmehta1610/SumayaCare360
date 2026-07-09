/**
 * Generates SUMAYA Care 360 demo MP4:
 * 1. Playwright screenshots of each tour scene (live production app)
 * 2. Windows SAPI TTS narration per scene
 * 3. ffmpeg slideshow segments merged into one video
 */
import { chromium } from "playwright";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output");
const FFMPEG = ffmpegInstaller.path;

const BASE = process.env.DEMO_BASE_URL || "https://sumayacare360-web.onrender.com";
const START_INDEX = parseInt(process.env.START_INDEX || "0", 10);
const TENANT = "demo";
const LOGIN = {
  email: "admin@demo.sumaya",
  password: "TenantAdmin@360",
};

async function gotoRetry(page, url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1500);
      return;
    } catch (e) {
      console.warn(`  goto retry ${i + 1}/${attempts}: ${e.message?.slice(0, 80)}`);
      await page.waitForTimeout(3000 * (i + 1));
    }
  }
  throw new Error(`Failed to load ${url}`);
}

/** Parse tour steps from frontend TS source */
function loadTourSteps() {
  const ts = fs.readFileSync(
    path.join(__dirname, "../../frontend/src/data/demoTourScript.ts"),
    "utf8"
  );
  const block = ts.match(/export const DEMO_TOUR_STEPS[^=]*=\s*\[([\s\S]*?)\];\s*export const DEMO_TOUR/)?.[1];
  if (!block) throw new Error("Could not parse DEMO_TOUR_STEPS");
  const steps = [];
  const re =
    /\{\s*id:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?route:\s*"([^"]+)"[\s\S]*?narration:\s*\n?\s*"([^"]+(?:\s*\+\s*\n?\s*"[^"]+)*)"/g;
  let m;
  while ((m = re.exec(block))) {
    const narration = m[4]
      .replace(/\s*\+\s*\n?\s*"/g, " ")
      .replace(/"/g, "")
      .replace(/\s+/g, " ")
      .trim();
    steps.push({ id: m[1], title: m[2], route: m[3], narration });
  }
  if (steps.length < 10) throw new Error(`Only parsed ${steps.length} steps`);
  return steps;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function ttsWav(text, outPath) {
  const safe = text.replace(/"/g, '""').replace(/\r?\n/g, " ");
  const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 1
$s.SetOutputToWaveFile('${outPath.replace(/\\/g, "\\\\")}')
$s.Speak('${safe.replace(/'/g, "''")}')
$s.Dispose()
`;
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", ps],
    { encoding: "utf8", timeout: 120000 }
  );
  if (r.status !== 0) throw new Error(`TTS failed: ${r.stderr || r.stdout}`);
  if (!fs.existsSync(outPath)) throw new Error("TTS wav not created");
}

function wavDurationSec(wavPath) {
  try {
    const out = execSync(`"${FFMPEG}" -i "${wavPath}" 2>&1`, { encoding: "utf8" });
    const m = out.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]) + 0.3;
  } catch (e) {
    const msg = e.stdout?.toString() || e.message || "";
    const m = msg.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]) + 0.3;
  }
  return 10;
}

function runFfmpeg(args) {
  execSync(`"${FFMPEG}" ${args}`, { stdio: "inherit", timeout: 300000 });
}

async function login(page) {
  await page.goto(`${BASE}/${TENANT}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.locator('label:has-text("Tenant")').locator("..").locator("input").fill(TENANT);
  await page.locator('label:has-text("Email")').locator("..").locator("input").fill(LOGIN.email);
  await page.locator('label:has-text("Password")').locator("..").locator("input").fill(LOGIN.password);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector("h1.page-title, h2:has-text('Welcome back'), .sidebar", { timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function captureScene(page, step, idx) {
  const url = step.route === "/login"
    ? `${BASE}/${TENANT}/login`
    : `${BASE}/${TENANT}${step.route}`;
  await gotoRetry(page, url);

  // Reload demo if dashboard and low patient count
  if (step.route === "/dashboard") {
    const btn = page.locator('button:has-text("Load demo data")');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(5000);
    }
  }

  const png = path.join(OUT, "frames", `${String(idx + 1).padStart(2, "0")}_${step.id}.png`);
  await page.screenshot({ path: png, fullPage: false });
  return png;
}

async function main() {
  ensureDir(path.join(OUT, "frames"));
  ensureDir(path.join(OUT, "segments"));
  const steps = loadTourSteps();
  console.log(`Tour: ${steps.length} scenes → ${OUT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await login(page);
  } catch (e) {
    console.warn("Login flow warning:", e.message);
    await page.goto(`${BASE}/${TENANT}/dashboard`, { timeout: 120000 });
  }

  const segmentFiles = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const wav = path.join(OUT, "segments", `${String(i + 1).padStart(2, "0")}.wav`);
    const seg = path.join(OUT, "segments", `${String(i + 1).padStart(2, "0")}.mp4`);

    if (fs.existsSync(seg) && !process.env.FORCE) {
      console.log(`\n[${i + 1}/${steps.length}] ${step.title} — skip (exists)`);
      continue;
    }

    console.log(`\n[${i + 1}/${steps.length}] ${step.title}`);

    try {
      const png = await captureScene(page, step, i);
      console.log("  TTS…");
      ttsWav(`${step.title}. ${step.narration}`, wav);
      const dur = wavDurationSec(wav);
      console.log(`  Audio ${dur.toFixed(1)}s, encoding segment…`);
      runFfmpeg(
        `-y -loop 1 -i "${png}" -i "${wav}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${seg}"`
      );
    } catch (e) {
      console.error(`  Scene failed: ${e.message}`);
      if (!fs.existsSync(seg)) continue;
    }
  }

  await browser.close();

  for (let i = 0; i < steps.length; i++) {
    const seg = path.join(OUT, "segments", `${String(i + 1).padStart(2, "0")}.mp4`);
    if (fs.existsSync(seg)) segmentFiles.push(seg);
  }
  if (segmentFiles.length === 0) throw new Error("No segments produced");
  console.log(`\nMerging ${segmentFiles.length} segments…`);

  const listPath = path.join(OUT, "concat.txt");
  fs.writeFileSync(listPath, segmentFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));

  const finalPath = path.join(OUT, "SUMAYA_Care_360_Demo.mp4");
  const docsCopy = path.join(__dirname, "../../docs/SUMAYA_Care_360_Demo.mp4");
  console.log("\nMerging segments…");
  runFfmpeg(`-y -f concat -safe 0 -i "${listPath}" -c copy "${finalPath}"`);
  fs.copyFileSync(finalPath, docsCopy);

  const stat = fs.statSync(finalPath);
  console.log(`\nDone: ${finalPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Copy: ${docsCopy}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
