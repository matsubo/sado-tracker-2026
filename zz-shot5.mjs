import { chromium } from "@playwright/test";
const out = process.argv[2];
for (let i = 0; i < 25; i++) {
  try {
    const r = await fetch("http://localhost:3111/api/race");
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 6000));
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3111/athletes/1597", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 30000 });
await page.waitForTimeout(4000);
await page.evaluate(() => { for (const el of document.querySelectorAll("nextjs-portal")) el.remove(); });
await page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((n) => n.textContent?.includes("順位推移"));
  h.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(600);
const box = await page.evaluate(() => {
  const h = [...document.querySelectorAll("h2")].find((n) => n.textContent?.includes("順位推移"));
  const b = h.nextElementSibling.getBoundingClientRect();
  return { x: 0, y: Math.max(0, Math.round(b.top) - 2), width: 390, height: Math.round(b.height) + 4 };
});
await page.screenshot({ path: `${out}/rankchart.png`, clip: box });
console.log("ok");
await browser.close();
