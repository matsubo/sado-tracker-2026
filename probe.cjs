const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const path of ['/athletes/1597', '/divisions/A?discipline=swim', '/map']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
    await page.goto('http://localhost:3111' + path, { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errors.push('NAV: ' + e.message));
    await page.waitForTimeout(3000);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
    console.log('---', path);
    console.log('  text:', text);
    console.log('  tables:', await page.locator('table').count());
    for (const e of errors.slice(0, 4)) console.log('  ERR:', e);
    await page.close();
  }
  await browser.close();
})();
