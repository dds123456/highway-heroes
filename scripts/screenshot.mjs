import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const port = 5213;
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
if (!existsSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)))) {
  execFileSync(process.execPath, [viteBin, 'build'], { stdio: 'inherit' });
}
const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite server did not start in time')), 30000);
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Local:')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (data) => process.stderr.write(data));
    server.on('exit', (code) => reject(new Error(`Vite exited early with code ${code}`)));
  });
}

await waitForServer();
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForFunction(() => !!window.__RACE_DEBUG__, undefined, { timeout: 90000 });
  await page.evaluate(() => window.__RACE_DEBUG__.start());
  await page.keyboard.down('w');
  await page.waitForTimeout(4600);
  await page.evaluate(() => window.__RACE_DEBUG__.jumpTo(180));
  await page.waitForTimeout(1200);
  console.log('state:', await page.evaluate(() => window.__RACE_DEBUG__.getState()));
  mkdirSync('screenshots', { recursive: true });
  const shots = [
    ['chase', 'chase'],
    ['hood', 'hood'],
    ['side', 'side'],
    ['far', 'far'],
  ];
  for (const [name, mode] of shots) {
    await page.evaluate((m) => window.__RACE_DEBUG__.setCamera(m), mode);
    await page.waitForTimeout(900);
    console.log(`${name} state:`, await page.evaluate(() => window.__RACE_DEBUG__.getState()));
    await page.screenshot({ path: `screenshots/${name}.png`, type: 'png' });
    console.log(`saved screenshots/${name}.png`);
  }
  for (const [name, mode] of [
    ['rain', 'rain'],
    ['storm', 'storm'],
    ['snow', 'snow'],
  ]) {
    await page.evaluate(() => window.__RACE_DEBUG__.setCamera('chase'));
    await page.evaluate((m) => window.__RACE_DEBUG__.setWeather(m), mode);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots/${name}.png`, type: 'png' });
    console.log(`saved screenshots/${name}.png`);
  }
} finally {
  await browser.close();
  server.kill();
}
