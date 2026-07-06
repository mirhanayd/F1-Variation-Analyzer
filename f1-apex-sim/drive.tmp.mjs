import puppeteer from 'puppeteer-core';

const SCRATCH = 'C:/Users/mirha/AppData/Local/Temp/claude/c--Users-mirha-OneDrive-Belgeler-GitHub-F1-Variation-Analyzer/6be8500d-1cbb-4a72-aec3-3e20b5723127/scratchpad';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const errors = [];
const page = await browser.newPage();
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
const go = (p, url) => p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

// --- 1. Simulation end-to-end run ---
await page.setViewport({ width: 1440, height: 1100 });
await go(page, 'http://localhost:5173/simulation?circuit=monza&corner=monza-rettifilo');
await page.waitForSelector('.pw-button.launch', { timeout: 20000 });
await new Promise(r => setTimeout(r, 2500));
await page.click('.pw-button.launch');
console.log('clicked start');
await page.waitForSelector('.start-lights', { timeout: 5000 });
console.log('start lights shown');
await page.waitForSelector('.sim-hud', { timeout: 15000 });
console.log('hud shown - run in progress');
await page.screenshot({ path: `${SCRATCH}/sim-running.png` });
await page.waitForSelector('.sim-result-overlay', { timeout: 60000 });
console.log('result overlay shown');
const resultTime = await page.$eval('.sim-result-time', el => el.textContent);
const rating = await page.$eval('.sim-result-rating', el => el.textContent);
console.log(`RESULT: time=${resultTime} rating=${rating}`);
await page.screenshot({ path: `${SCRATCH}/sim-finished.png` });

await page.click('.sim-result-actions .pw-button');
await page.waitForSelector('.start-lights', { timeout: 5000 });
console.log('run-again restarts countdown');

// --- 2. Mobile home page ---
const mobile = await browser.newPage();
mobile.on('pageerror', (err) => errors.push(`mobile pageerror: ${err.message}`));
await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await go(mobile, 'http://localhost:5173/');
await mobile.waitForSelector('.next-grand-prix', { timeout: 25000 });
await new Promise(r => setTimeout(r, 800));
await mobile.screenshot({ path: `${SCRATCH}/home-mobile.png` });
const tabbarVisible = await mobile.$eval('.pw-tabbar', el => getComputedStyle(el).display !== 'none');
console.log('mobile tabbar visible:', tabbarVisible);
const hasHorizScroll = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('mobile horizontal overflow:', hasHorizScroll);

await mobile.click('.upcoming-round-card');
await mobile.waitForSelector('.detail-stats-grid', { timeout: 25000 });
console.log('card click navigated to circuit detail');
await new Promise(r => setTimeout(r, 1500));
await mobile.screenshot({ path: `${SCRATCH}/detail-mobile.png` });
const overflowDetail = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('mobile detail overflow:', overflowDetail);

// --- 3. Mobile simulation page ---
await go(mobile, 'http://localhost:5173/simulation');
await mobile.waitForSelector('.pw-button.launch', { timeout: 20000 });
await new Promise(r => setTimeout(r, 1500));
await mobile.screenshot({ path: `${SCRATCH}/sim-mobile.png` });
const overflowSim = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log('mobile sim overflow:', overflowSim);

// --- 4. Circuits search on mobile ---
await go(mobile, 'http://localhost:5173/circuits');
await mobile.waitForSelector('.circuit-card', { timeout: 25000 });
await mobile.type('.catalog-toolbar input', 'istanbul');
await new Promise(r => setTimeout(r, 600));
const cardCount = await mobile.$$eval('.circuit-card', els => els.length);
const firstCard = await mobile.$eval('.circuit-card h3', el => el.textContent);
console.log(`search "istanbul" -> ${cardCount} card(s), first: ${firstCard}`);
await mobile.screenshot({ path: `${SCRATCH}/circuits-mobile.png` });
await mobile.click('.circuit-card');
await mobile.waitForSelector('.lap-record-time', { timeout: 25000 });
const lapRecord = await mobile.$eval('.lap-record-time', el => el.textContent);
console.log('istanbul detail lap record:', lapRecord);
await mobile.screenshot({ path: `${SCRATCH}/istanbul-mobile.png` });

console.log('---');
console.log('JS errors:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
