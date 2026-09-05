const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const pages = [['/', 'home'], ['/athletes/1597', 'athlete'], ['/map', 'map'], ['/divisions/A', 'division']];
  for (const [path, name] of pages) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2 });
    if (name === 'home') {
      await page.addInitScript(() => {
        localStorage.setItem('sado2026.bookmarks', JSON.stringify(['1597', '3047', '1001']));
      });
    }
    await page.goto('http://localhost:3111' + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log(name, 'nav', e.message));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: true });
    console.log(name, 'ok');
    await page.close();
  }
  await browser.close();
})();
