import { chromium } from "playwright";

const output = process.argv[2] || "patient-administration-smoke.png";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await page.goto("http://127.0.0.1:5173/demo/login", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/demo/dashboard");
await page.goto("http://127.0.0.1:5173/demo/patient-administration", { waitUntil: "networkidle" });
await page.screenshot({ path: output, fullPage: true });
const result = {
  title: await page.locator("h1").first().innerText(),
  patientRows: await page.locator(".command-table tbody tr").count(),
  visibleErrors: await page.locator(".error").count(),
  consoleErrors,
};
console.log(JSON.stringify(result));
await browser.close();
