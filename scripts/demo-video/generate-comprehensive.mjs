/**
 * Generate a full HD, narrated, comprehensive feature walkthrough from the
 * live SUMAYA Care 360 application.
 */
import { chromium } from "playwright";
import { execFileSync, execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-comprehensive");
const FRAMES = path.join(OUT, "frames");
const SEGMENTS = path.join(OUT, "segments");
const FFMPEG = ffmpegInstaller.path;
const BASE = process.env.DEMO_BASE_URL || "http://127.0.0.1:5173";
const API = process.env.DEMO_API_URL || "http://127.0.0.1:8000/api/v1";
const TENANT = "demo";
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const VOICE = process.env.DEMO_VOICE || "Microsoft David Desktop";
const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, "comprehensive-scenes.json"), "utf8"));

const CREDENTIALS = {
  TENANT_ADMIN: { email: "admin@demo.sumaya", password: "TenantAdmin@360" },
  DOCTOR: { email: "doctor@demo.sumaya", password: "Doctor@360" },
  NURSE: { email: "nurse@demo.sumaya", password: "Nurse@360" },
  RECEPTIONIST: { email: "reception@demo.sumaya", password: "Reception@360" },
  BILLING_STAFF: { email: "billing@demo.sumaya", password: "Billing@360" },
  PATIENT: { email: "patient@demo.sumaya", password: "Patient@360" },
};

fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(SEGMENTS, { recursive: true });

function sanitizeSpeech(text) {
  return text
    .replace(/SUMAYA/g, "Soo my ah")
    .replace(/Care 360/g, "Care three sixty")
    .replace(/IPD/g, "I P D")
    .replace(/OPD/g, "O P D")
    .replace(/ESI/g, "E S I")
    .replace(/PACS/g, "packs")
    .replace(/FHIR/g, "fire")
    .replace(/HL7/g, "H L seven")
    .replace(/MFA/g, "M F A")
    .replace(/API/g, "A P I")
    .replace(/MRN/g, "medical record number")
    .replace(/₹/g, "Indian rupees ")
    .replace(/[—–]/g, " - ")
    .replace(/→/g, " to ")
    .replace(/&/g, " and ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ttsWav(text, outPath) {
  const safe = sanitizeSpeech(text);
  // System.Speech can remove its target during finalizer cleanup after the
  // PowerShell process exits.  Let SAPI own a disposable file and copy the
  // completed wave to the stable path consumed by FFmpeg.
  const sapiPath = `${outPath}.sapi.wav`;
  fs.rmSync(sapiPath, { force: true });
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('${VOICE.replace(/'/g, "''")}')
$s.Rate = -1
$s.Volume = 100
$s.SetOutputToWaveFile('${sapiPath.replace(/\\/g, "\\\\")}')
$s.Speak('${safe.replace(/'/g, "''")}')
$s.Dispose()
`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    timeout: 240000,
  });
  if (result.status !== 0 || !fs.existsSync(sapiPath) || fs.statSync(sapiPath).size < 1000) {
    throw new Error(`Narration failed: ${result.stderr || result.stdout || "wave file missing"}`);
  }
  fs.copyFileSync(sapiPath, outPath);
  fs.rmSync(sapiPath, { force: true });
}

function mediaDuration(file) {
  try {
    execFileSync(FFMPEG, ["-i", file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  throw new Error(`Could not read duration: ${file}`);
}

function wavDuration(file) {
  const buffer = fs.readFileSync(file);
  const byteRate = buffer.readUInt32LE(28);
  const dataMarker = buffer.indexOf(Buffer.from("data"));
  if (!byteRate || dataMarker < 0 || dataMarker + 8 > buffer.length) {
    throw new Error(`Invalid WAV header: ${file}`);
  }
  return buffer.readUInt32LE(dataMarker + 4) / byteRate;
}

function encodeSegment(frame, wav, segment, audioDuration) {
  const duration = audioDuration + 1.1;
  const filter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071024";
  execSync(
    `"${FFMPEG}" -loglevel error -y -loop 1 -framerate 2 -i "${frame}" -i "${wav}" ` +
    `-vf "${filter}" -af "loudnorm=I=-16:TP=-1.5:LRA=11,apad" ` +
    `-t ${duration.toFixed(2)} -c:v libx264 -preset veryfast -crf 18 -r 2 ` +
    `-c:a aac -b:a 192k -ar 48000 -pix_fmt yuv420p -movflags +faststart "${segment}"`,
    { stdio: "inherit", timeout: 420000 },
  );
  return duration;
}

async function gotoStable(page, route) {
  const url = route === "/login" ? `${BASE}/${TENANT}/login` : `${BASE}/${TENANT}${route}`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2200);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(attempt * 2500);
    }
  }
  throw lastError;
}

async function logout(page) {
  await page.evaluate(() => localStorage.removeItem("sc360_session")).catch(() => {});
  await gotoStable(page, "/login");
}

async function loginAs(page, role) {
  const credential = CREDENTIALS[role];
  if (!credential) throw new Error(`No credentials for ${role}`);
  await logout(page);
  await page.locator('label:has-text("Tenant")').locator("..").locator("input").fill(TENANT);
  await page.locator('label:has-text("Email")').locator("..").locator("input").fill(credential.email);
  await page.locator('label:has-text("Password")').locator("..").locator("input").fill(credential.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem("sc360_session")), null, { timeout: 120000 });
  await page.waitForTimeout(1800);
}

async function ensureDemo() {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_code: TENANT, ...CREDENTIALS.TENANT_ADMIN }),
  });
  if (!login.ok) throw new Error(`Demo login failed: ${login.status}`);
  const { access_token } = await login.json();
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error(`API health failed: ${health.status}`);
  const reload = await fetch(`${API}/admin/demo-reload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "X-Tenant-Code": TENANT },
  });
  if (!reload.ok) throw new Error(`Demo reload failed: ${reload.status}`);
  const result = await reload.json();
  console.log(`Demo ready: ${result.patients} patients`);
}

async function performAction(page, action) {
  if (action === "patient360") {
    const first = page.locator(".patient-link").first();
    await first.waitFor({ state: "visible", timeout: 30000 });
    await first.click();
    await page.locator(".journey-panel").waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(1200);
  }
  if (action === "runReport") {
    const executive = page.locator(".report-card").first().getByRole("button", { name: "Run" });
    await executive.click();
    await page.locator("#report-output").waitFor({ state: "visible", timeout: 60000 });
    await page.waitForTimeout(1200);
  }
}

async function addChapterLabel(page, index, title) {
  await page.evaluate(({ index, title, total }) => {
    document.getElementById("video-chapter-label")?.remove();
    const label = document.createElement("div");
    label.id = "video-chapter-label";
    label.style.cssText = "position:fixed;right:28px;bottom:24px;z-index:99999;max-width:470px;padding:13px 17px;border:1px solid rgba(255,255,255,.24);border-radius:12px;background:rgba(7,16,36,.92);box-shadow:0 12px 38px rgba(2,6,23,.28);color:white;font-family:Arial,sans-serif;pointer-events:none";
    label.innerHTML = `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9;font-weight:700">Complete feature walkthrough &nbsp; ${String(index).padStart(2, "0")} / ${total}</div><div style="font-size:17px;line-height:1.3;margin-top:5px;font-weight:700">${title}</div>`;
    document.body.appendChild(label);
  }, { index, title, total: scenes.length });
}

async function main() {
  console.log(`Comprehensive walkthrough: ${scenes.length} scenes`);
  console.log(`Source: ${BASE}`);
  console.log(`Voice: ${VOICE}`);
  await ensureDemo();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`  Browser error: ${error.message}`));

  let currentRole = null;
  const segments = [];
  const chapters = [];
  let elapsed = 0;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const number = String(i + 1).padStart(3, "0");
    const frame = path.join(FRAMES, `${number}_${scene.id}.png`);
    const wav = path.join(SEGMENTS, `${number}.wav`);
    const segment = path.join(SEGMENTS, `${number}.mp4`);
    const desiredRole = scene.id === "welcome" ? null : (scene.role || "TENANT_ADMIN");

    console.log(`\n[${i + 1}/${scenes.length}] ${scene.title}`);
    if (desiredRole !== currentRole) {
      if (desiredRole) await loginAs(page, desiredRole);
      else await logout(page);
      currentRole = desiredRole;
    }

    if (!fs.existsSync(frame) || FORCE) {
      await gotoStable(page, scene.route);
      await performAction(page, scene.action);
      await addChapterLabel(page, i + 1, scene.title);
      const errors = await page.locator(".error").allTextContents().catch(() => []);
      if (errors.length) console.warn(`  Visible error: ${errors.join(" | ")}`);
      await page.screenshot({ path: frame, fullPage: false });
      console.log(`  Captured ${path.basename(frame)}`);
    }

    if (!fs.existsSync(wav) || FORCE) {
      ttsWav(`${scene.title}. ${scene.narration}`, wav);
      console.log(`  Narration ${(wavDuration(wav)).toFixed(1)} seconds`);
    }

    const audioDuration = wavDuration(wav);
    let duration = audioDuration + 1.1;
    if (!fs.existsSync(segment) || FORCE) {
      duration = encodeSegment(frame, wav, segment, audioDuration);
    }
    segments.push(segment);
    chapters.push({ index: i + 1, id: scene.id, title: scene.title, start_seconds: Number(elapsed.toFixed(2)), duration_seconds: Number(duration.toFixed(2)) });
    elapsed += duration;
  }

  await browser.close();

  const concat = path.join(OUT, "concat.txt");
  fs.writeFileSync(concat, segments.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"));
  const final = path.join(OUT, "SUMAYA_Care_360_Complete_Feature_Walkthrough.mp4");
  execSync(`"${FFMPEG}" -loglevel error -y -f concat -safe 0 -i "${concat}" -c copy -movflags +faststart "${final}"`, { stdio: "inherit", timeout: 900000 });

  fs.writeFileSync(path.join(OUT, "chapters.json"), JSON.stringify(chapters, null, 2));
  const chapterText = chapters.map((chapter) => {
    const minutes = Math.floor(chapter.start_seconds / 60);
    const seconds = Math.floor(chapter.start_seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}  ${chapter.title}`;
  }).join("\n");
  fs.writeFileSync(path.join(OUT, "chapters.txt"), chapterText);

  const docsVideo = path.join(__dirname, "../../docs/SUMAYA_Care_360_Complete_Feature_Walkthrough.mp4");
  const docsChapters = path.join(__dirname, "../../docs/SUMAYA_Care_360_Complete_Feature_Walkthrough_Chapters.txt");
  fs.copyFileSync(final, docsVideo);
  fs.copyFileSync(path.join(OUT, "chapters.txt"), docsChapters);

  console.log(`\nCreated: ${final}`);
  console.log(`Duration: ${(mediaDuration(final) / 60).toFixed(1)} minutes`);
  console.log(`Size: ${(fs.statSync(final).size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Documentation copy: ${docsVideo}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
