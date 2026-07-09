/**
 * Role-wise demo video: logs in as each demo role and captures allowed screens.
 * Output: docs/SUMAYA_Care_360_Roles_Demo.mp4
 */
import { chromium } from "playwright";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "output-roles");
const FFMPEG = ffmpegInstaller.path;

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const TENANT = "demo";

const ROLE_TOURS = [
  {
    role: "TENANT_ADMIN",
    email: "admin@demo.sumaya",
    password: "TenantAdmin@360",
    intro:
      "Tenant Admin has full hospital access. You see every module in the sidebar, all dashboard KPIs from the live database, patients, billing, reports, and masters.",
    routes: ["/dashboard", "/patients", "/appointments", "/billing", "/reports", "/masters", "/module-map"],
  },
  {
    role: "BRANCH_ADMIN",
    email: "branch@demo.sumaya",
    password: "BranchAdmin@360",
    intro:
      "Branch Admin manages front-office operations for a campus. Navigation is limited to patients, appointments, providers, and read-only billing — no lab or pharmacy write access.",
    routes: ["/dashboard", "/patients", "/appointments", "/providers", "/billing"],
  },
  {
    role: "DOCTOR",
    email: "doctor@demo.sumaya",
    password: "Doctor@360",
    intro:
      "Doctor sees clinical workflows: patient charts, encounters, telemedicine, and order views. Dashboard KPIs are filtered to clinical metrics pulled from the database.",
    routes: ["/dashboard", "/patients", "/encounters", "/telemedicine", "/laboratory", "/pharmacy"],
  },
  {
    role: "NURSE",
    email: "nurse@demo.sumaya",
    password: "Nurse@360",
    intro:
      "Nurse focuses on inpatient care, nursing tasks, vitals, and encounters. Sidebar hides billing administration and tenant settings.",
    routes: ["/dashboard", "/patients", "/nursing", "/inpatient", "/encounters"],
  },
  {
    role: "RECEPTIONIST",
    email: "reception@demo.sumaya",
    password: "Reception@360",
    intro:
      "Receptionist registers patients, books appointments, and manages the queue. Clinical modules like laboratory and radiology are hidden.",
    routes: ["/dashboard", "/patients", "/appointments", "/emergency"],
  },
  {
    role: "BILLING_STAFF",
    email: "billing@demo.sumaya",
    password: "Billing@360",
    intro:
      "Billing staff works invoices, payments, revenue cycle, and insurance claims. Patient list is read-only; clinical order screens are not in the menu.",
    routes: ["/dashboard", "/billing", "/insurance-claims", "/revenue-cycle", "/reports"],
  },
  {
    role: "PHARMACIST",
    email: "pharmacist@demo.sumaya",
    password: "Pharmacist@360",
    intro:
      "Pharmacist lands on the pharmacy dispense queue with medicine masters from the database. Other hospital modules are restricted by role permissions.",
    routes: ["/pharmacy", "/patients", "/masters"],
  },
  {
    role: "LAB_TECH",
    email: "labtech@demo.sumaya",
    password: "LabTech@360",
    intro:
      "Lab technician sees only the laboratory workbench: orders, statuses, and results loaded from API — no hardcoded test lists.",
    routes: ["/laboratory", "/patients"],
  },
  {
    role: "RADIOLOGIST",
    email: "radiologist@demo.sumaya",
    password: "Radiologist@360",
    intro:
      "Radiologist accesses imaging orders and reporting. Study codes come from radiology tariffs and existing orders in the database.",
    routes: ["/radiology", "/patients"],
  },
  {
    role: "PATIENT",
    email: "patient@demo.sumaya",
    password: "Patient@360",
    intro:
      "Patient portal user sees only the self-service portal: appointments, bills, and care summary linked to their patient record in the database.",
    routes: ["/portal"],
  },
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sanitizeTts(text) {
  return text
    .replace(/[—–]/g, "-")
    .replace(/['']/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 480);
}

function silentWav(outPath, seconds = 10) {
  runFfmpeg(`-y -f lavfi -i anullsrc=r=22050:cl=mono -t ${seconds} "${outPath}"`);
}

function ttsWav(text, outPath) {
  const safe = sanitizeTts(text);
  try {
    const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
$s.SetOutputToWaveFile('${outPath.replace(/\\/g, "\\\\")}')
$s.Speak('${safe.replace(/'/g, "''")}')
$s.Dispose()
`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", timeout: 180000 });
    if (r.status !== 0) console.warn(`  TTS status ${r.status}`);
  } catch (e) {
    console.warn(`  TTS error: ${e.message}`);
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 200) {
    console.warn(`  Using silent audio for: ${safe.slice(0, 50)}…`);
    silentWav(outPath, 10);
  }
}

function wavDurationSec(wavPath) {
  try {
    const out = execSync(`"${FFMPEG}" -i "${wavPath}" 2>&1`, { encoding: "utf8" });
    const m = out.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]) + 0.5;
  } catch (e) {
    const msg = e.stdout?.toString() || e.message || "";
    const m = msg.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]) + 0.5;
  }
  return 12;
}

function runFfmpeg(args) {
  execSync(`"${FFMPEG}" ${args}`, { stdio: "inherit", timeout: 300000 });
}

async function gotoRetry(page, url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(2000);
      return;
    } catch (e) {
      await page.waitForTimeout(3000 * (i + 1));
    }
  }
  throw new Error(`Failed to load ${url}`);
}

async function loginAs(page, cred) {
  await gotoRetry(page, `${BASE}/${TENANT}/login`);
  await page.locator('label:has-text("Tenant")').locator("..").locator("input").fill(TENANT);
  await page.locator('label:has-text("Email")').locator("..").locator("input").fill(cred.email);
  await page.locator('label:has-text("Password")').locator("..").locator("input").fill(cred.password);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector(".sidebar, h1.page-title", { timeout: 120000 });
  await page.waitForTimeout(2500);
}

async function logout(page) {
  const btn = page.locator('button:has-text("Sign out"), button:has-text("Log out")');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
  } else {
    await page.evaluate(() => localStorage.removeItem("sc360_session"));
    await gotoRetry(page, `${BASE}/${TENANT}/login`);
  }
}

async function makeSegment(page, sceneId, title, narration, pngPath, wavPath, segPath) {
  const wav = wavPath;
  const seg = segPath;
  if (fs.existsSync(seg) && !process.env.FORCE) {
    console.log(`  Skip existing: ${path.basename(seg)}`);
    return seg;
  }
  console.log(`  Scene: ${title}`);
  ttsWav(`${title}. ${narration}`, wav);
  if (fs.existsSync(wav) && fs.statSync(wav).size > 200) {
    runFfmpeg(
      `-y -loop 1 -i "${pngPath}" -i "${wav}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest "${seg}"`
    );
  } else {
    console.warn(`  No audio — encoding video only`);
    runFfmpeg(
      `-y -loop 1 -i "${pngPath}" -c:v libx264 -tune stillimage -t 12 -pix_fmt yuv420p "${seg}"`
    );
  }
  return seg;
}

async function main() {
  ensureDir(path.join(OUT, "frames"));
  ensureDir(path.join(OUT, "segments"));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const segmentFiles = [];
  let sceneIdx = 0;

  // Opening title
  await gotoRetry(page, `${BASE}/${TENANT}/login`);
  const titlePng = path.join(OUT, "frames", "00_title.png");
  await page.screenshot({ path: titlePng, fullPage: false });
  const titleWav = path.join(OUT, "segments", "00.wav");
  const titleSeg = path.join(OUT, "segments", "00.mp4");
  await makeSegment(
    page,
    "title",
    "SUMAYA Care 360 Role-Based Access Tour",
    "This video demonstrates what each hospital role sees after login. Every screen loads live data from the database. Ten roles, ten tailored experiences.",
    titlePng,
    titleWav,
    titleSeg
  );
  segmentFiles.push(titleSeg);

  for (const tour of ROLE_TOURS) {
    console.log(`\n=== ${tour.role} ===`);
    await loginAs(page, tour);

    sceneIdx += 1;
    const introPng = path.join(OUT, "frames", `${String(sceneIdx).padStart(3, "0")}_${tour.role}_intro.png`);
    await page.screenshot({ path: introPng });
    const introWav = path.join(OUT, "segments", `${String(sceneIdx).padStart(3, "0")}.wav`);
    const introSeg = path.join(OUT, "segments", `${String(sceneIdx).padStart(3, "0")}.mp4`);
    try {
      await makeSegment(
        page,
        `${tour.role}-intro`,
        `${tour.role.replace(/_/g, " ")} login`,
        tour.intro,
        introPng,
        introWav,
        introSeg
      );
      segmentFiles.push(introSeg);
    } catch (e) {
      console.error(`  Intro failed (${tour.role}): ${e.message}`);
      if (fs.existsSync(introSeg)) segmentFiles.push(introSeg);
    }

    for (const route of tour.routes) {
      sceneIdx += 1;
      const url = `${BASE}/${TENANT}${route}`;
      await gotoRetry(page, url);
      if (route === "/dashboard") {
        const btn = page.locator('button:has-text("Load demo data")');
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(5000);
        }
      }
      const png = path.join(OUT, "frames", `${String(sceneIdx).padStart(3, "0")}_${tour.role}${route.replace(/\//g, "_")}.png`);
      await page.screenshot({ path: png });
      const label = route.replace(/^\//, "").replace(/-/g, " ") || "home";
      const wav = path.join(OUT, "segments", `${String(sceneIdx).padStart(3, "0")}.wav`);
      const seg = path.join(OUT, "segments", `${String(sceneIdx).padStart(3, "0")}.mp4`);
      try {
        await makeSegment(
          page,
          `${tour.role}${route}`,
          `${tour.role.replace(/_/g, " ")} - ${label}`,
          `As ${tour.role.replace(/_/g, " ").toLowerCase()}, the ${label} screen shows database-backed lists, search, pagination, and export where your role has permission.`,
          png,
          wav,
          seg
        );
        segmentFiles.push(seg);
      } catch (e) {
        console.error(`  Scene failed (${tour.role}${route}): ${e.message}`);
        if (fs.existsSync(seg)) segmentFiles.push(seg);
      }
    }

    await logout(page);
  }

  await browser.close();

  const allSegments = fs
    .readdirSync(path.join(OUT, "segments"))
    .filter((f) => f.endsWith(".mp4"))
    .sort()
    .map((f) => path.join(OUT, "segments", f));

  const listPath = path.join(OUT, "concat.txt");
  fs.writeFileSync(listPath, allSegments.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  const finalPath = path.join(OUT, "SUMAYA_Care_360_Roles_Demo.mp4");
  const docsCopy = path.join(__dirname, "../../docs/SUMAYA_Care_360_Roles_Demo.mp4");
  runFfmpeg(`-y -f concat -safe 0 -i "${listPath}" -c copy "${finalPath}"`);
  fs.copyFileSync(finalPath, docsCopy);
  console.log(`\nDone: ${docsCopy} (${(fs.statSync(finalPath).size / 1024 / 1024).toFixed(1)} MB, ${allSegments.length} scenes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
