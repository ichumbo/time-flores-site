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

test('mobile section headings stay inside the 390px viewport', { timeout: 20000 }, async t => {
  if (!fs.existsSync(chromeBinary)) {
    t.skip('Google Chrome is not available');
    return;
  }
  const phpPort = 18183;
  const debugPort = 19333;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'time-flores-chrome-'));
  const php = spawn('php', ['-S', `127.0.0.1:${phpPort}`, '-t', 'public'], { cwd: projectRoot, stdio: 'ignore' });
  const chrome = spawn(chromeBinary, [
    '--headless', '--disable-gpu', `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await waitForUrl(`http://127.0.0.1:${phpPort}/`);
    const targetsResponse = await waitForUrl(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await targetsResponse.json();
    const page = targets.find(target => target.type === 'page');
    assert.ok(page, 'Chrome page target is available');
    const cdp = createCdpClient(page.webSocketDebuggerUrl);
    try {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${phpPort}/` });
      const evaluated = await cdp.send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
          while (document.readyState !== 'complete') await new Promise(resolve => setTimeout(resolve, 25));
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 1000));
          const selectors = ['#resultados h2', '#planos h2'];
          return {
            viewport: document.documentElement.clientWidth,
            pageScrollWidth: document.documentElement.scrollWidth,
            offenders: [...document.querySelectorAll('body *')].map(element => {
              const rect = element.getBoundingClientRect();
              return { tag: element.tagName, className: element.className || '', id: element.id || '', left: rect.left, right: rect.right, width: rect.width };
            }).filter(item => item.left < -1 || item.right > document.documentElement.clientWidth + 1).slice(0, 20),
            headings: selectors.map(selector => {
              const rect = document.querySelector(selector).getBoundingClientRect();
              const element = document.querySelector(selector);
              return { selector, left: rect.left, right: rect.right, width: rect.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
            }),
            resultCaptions: [...document.querySelectorAll('.result-card')].map(card => {
              const cardRect = card.getBoundingClientRect();
              const labelRect = card.querySelector('figcaption strong').getBoundingClientRect();
              return { cardLeft: cardRect.left, cardRight: cardRect.right, labelLeft: labelRect.left, labelRight: labelRect.right };
            }),
            contrastSamples: ['.btn-primary', '#faq .section-kicker'].map(selector => {
              const element = document.querySelector(selector);
              const style = getComputedStyle(element);
              let backgroundElement = element;
              let background = style.backgroundColor;
              while (backgroundElement.parentElement && (background === 'transparent' || background.endsWith(', 0)'))) {
                backgroundElement = backgroundElement.parentElement;
                background = getComputedStyle(backgroundElement).backgroundColor;
              }
              return { selector, color: style.color, background };
            })
          };
        })()`
      });
      const layout = evaluated.result.value;
      assert.equal(layout.viewport, 390);
      assert.ok(layout.pageScrollWidth <= 390, `page scroll width is ${layout.pageScrollWidth}; headings: ${JSON.stringify(layout.headings)}; offenders: ${JSON.stringify(layout.offenders)}`);
      for (const heading of layout.headings) {
        assert.ok(heading.left >= 0, `${heading.selector} starts at ${heading.left}`);
        assert.ok(heading.right <= 390, `${heading.selector} ends at ${heading.right}`);
        assert.ok(heading.scrollWidth <= heading.clientWidth, `${heading.selector} text width is ${heading.scrollWidth} inside ${heading.clientWidth}`);
      }
      for (const caption of layout.resultCaptions) {
        assert.ok(caption.labelLeft >= caption.cardLeft, `result caption starts at ${caption.labelLeft} before card ${caption.cardLeft}`);
        assert.ok(caption.labelRight <= caption.cardRight, `result caption ends at ${caption.labelRight} after card ${caption.cardRight}`);
      }
      for (const sample of layout.contrastSamples) {
        assert.ok(contrastRatio(sample.color, sample.background) >= 4.5, `${sample.selector} contrast is ${contrastRatio(sample.color, sample.background).toFixed(2)}:1 (${sample.color} on ${sample.background})`);
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
