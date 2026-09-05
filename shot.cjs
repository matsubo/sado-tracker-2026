const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const pages = [['/', 'home3'], ['/athletes/1597', 'athlete3'], ['/map', 'map3'], ['/divisions/A?discipline=swim', 'division3']];
  for (const [path, name] of pages) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2 });
    if (name === 'home3') {
      await page.addInitScript(() => {
        localStorage.setItem('sado2026.bookmarks', JSON.stringify(['1597', '3047', '3080']));
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
