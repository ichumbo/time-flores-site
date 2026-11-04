'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function waitForUrl(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Chrome DevTools connection failed'));
  });
  return {
    async send(method, params = {}) {
      await ready;
      const id = ++sequence;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() { socket.close(); }
  };
}

function rgbChannels(value) {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color ${value}`);
  return channels;
}

function contrastRatio(foreground, background) {
  const luminance = value => {
    const channels = rgbChannels(value).map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('layout audit across all 11 target resolutions (320px to 2560px)', { timeout: 60000 }, async t => {
  if (!fs.existsSync(chromeBinary)) {
    t.skip('Google Chrome is not available');
    return;
  }
  const phpPort = 18183;
  const debugPort = 19333;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'time-flores-chrome-'));
  const php = spawn('php', ['-S', `127.0.0.1:${phpPort}`, '-t', 'public'], { cwd: projectRoot, stdio: 'ignore' });
  const chrome = spawn(chromeBinary, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox',
    `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });

  const viewports = [
    { width: 320, height: 568, name: 'Celular pequeno' },
    { width: 360, height: 740, name: 'Celular compacto' },
    { width: 375, height: 667, name: 'Celular padrão' },
    { width: 390, height: 844, name: 'iPhone moderno' },
    { width: 430, height: 932, name: 'Celular grande' },
    { width: 768, height: 1024, name: 'Tablet vertical' },
    { width: 1024, height: 768, name: 'Tablet horizontal' },
    { width: 1280, height: 800, name: 'Notebook' },
    { width: 1440, height: 900, name: 'Desktop' },
    { width: 1920, height: 1080, name: 'Full HD' },
    { width: 2560, height: 1440, name: 'Ultrawide' }
  ];

  try {
    await waitForUrl(`http://127.0.0.1:${phpPort}/`);
    const targetsResponse = await waitForUrl(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await targetsResponse.json();
    const page = targets.find(target => target.type === 'page');
    assert.ok(page, 'Chrome page target is available');
    const cdp = createCdpClient(page.webSocketDebuggerUrl);
    try {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

      for (const vp of viewports) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width <= 768
        });
        await cdp.send('Page.navigate', { url: `http://127.0.0.1:${phpPort}/` });

        const evaluated = await cdp.send('Runtime.evaluate', {
          awaitPromise: true,
          returnByValue: true,
          expression: `(async () => {
            while (document.readyState !== 'complete') await new Promise(resolve => setTimeout(resolve, 25));
            await document.fonts.ready;
            await new Promise(resolve => setTimeout(resolve, 300));
            const clientWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const offenders = [...document.querySelectorAll('body *')].map(element => {
              const rect = element.getBoundingClientRect();
              return { tag: element.tagName, className: element.className || '', id: element.id || '', left: rect.left, right: rect.right, width: rect.width };
            }).filter(item => item.left < -2 || item.right > clientWidth + 2).slice(0, 10);

            return {
              viewport: clientWidth,
              scrollWidth: scrollWidth,
              hasHorizontalOverflow: scrollWidth > clientWidth,
              offenderCount: offenders.length,
              offenders
            };
          })()`
        });

        const layout = evaluated.result.value;
        assert.equal(layout.viewport, vp.width, `viewport width for ${vp.name}`);
        assert.ok(!layout.hasHorizontalOverflow, `horizontal overflow detected at ${vp.name} (${vp.width}px): scrollWidth=${layout.scrollWidth}, offenders=${JSON.stringify(layout.offenders)}`);
      }
    } finally {
      cdp.close();
    }
  } finally {
    php.kill('SIGTERM');
    chrome.kill('SIGTERM');
    await Promise.all([once(php, 'exit'), once(chrome, 'exit')]);
    await new Promise(resolve => setTimeout(resolve, 250));
    await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }).catch(() => {});
  }
});
