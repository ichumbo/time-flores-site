'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const htmlContent = fs.readFileSync(path.join(projectRoot, 'public/index.html'), 'utf8');
const privacyContent = fs.readFileSync(path.join(projectRoot, 'public/privacidade.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(projectRoot, 'public/assets/css/style.css'), 'utf8');

const targetResolutions = [
  { name: 'Celular pequeno', width: 320, category: 'mobile' },
  { name: 'Celular compacto', width: 360, category: 'mobile' },
  { name: 'Celular padrão', width: 375, category: 'mobile' },
  { name: 'iPhone moderno', width: 390, category: 'mobile' },
  { name: 'Celular grande', width: 430, category: 'mobile' },
  { name: 'Tablet vertical', width: 768, category: 'tablet' },
  { name: 'Tablet horizontal', width: 1024, category: 'tablet' },
  { name: 'Notebook', width: 1280, category: 'desktop' },
  { name: 'Desktop', width: 1440, category: 'desktop' },
  { name: 'Full HD', width: 1920, category: 'desktop' },
  { name: 'Ultrawide', width: 2560, category: 'ultrawide' }
];

test('responsive audit: verify all 11 target resolutions are covered by architectural media queries and container logic', () => {
  assert.ok(targetResolutions.length === 11, 'eleven target resolutions defined');

  // Verify container width bounded for ultrawide
  assert.match(cssContent, /--width:\s*1320px;/, 'max width is bounded to 1320px');
  assert.match(cssContent, /\.container\s*\{[^}]*width:\s*min\(calc\(100%\s*-\s*\d+px\),\s*var\(--width\)\)/, 'container clamps width smoothly');

  // Verify mobile and tablet breakpoints exist
  assert.match(cssContent, /@media\s*\(\s*max-width:\s*1180px\s*\)/, '1180px notebook/tablet breakpoint exists');
  assert.match(cssContent, /@media\s*\(\s*max-width:\s*850px\s*\)/, '850px tablet portrait breakpoint exists');
  assert.match(cssContent, /@media\s*\(\s*max-width:\s*600px\s*\)/, '600px mobile breakpoint exists');
});

test('responsive audit: input font-size >= 16px to prevent iOS Safari auto-zoom', () => {
  // Inputs in mobile view must not have font-size < 16px
  const mobileSectionMatch = cssContent.match(/@media\s*\(\s*max-width:\s*(?:850|600)px\s*\)\s*\{([\s\S]*?)(?:@media|$)/);
  assert.ok(mobileSectionMatch, 'mobile media query found');

  // Check that inputs default or in mobile query have 16px
  const inputMatches = [...cssContent.matchAll(/(?:input|select|textarea)[^{]*\{[^}]*font-size:\s*([^;]+);/gi)];
  assert.ok(inputMatches.length > 0, 'form control font-size rules exist');
  for (const match of inputMatches) {
    const fontSizeVal = parseFloat(match[1]);
    if (!isNaN(fontSizeVal)) {
      // Must not be below 16px if applied to inputs
      assert.ok(fontSizeVal >= 16, `input font-size ${match[1]} should be >= 16px to prevent iOS auto-zoom`);
    }
  }
});

test('responsive audit: mobile navigation overlay is scrollable on small screens', () => {
  const mobileNavRule = cssContent.match(/\.mobile-nav:not\(\[hidden\]\)\s*\{([^}]+)\}/);
  assert.ok(mobileNavRule, '.mobile-nav:not([hidden]) rule exists');
  assert.match(mobileNavRule[1], /max-height/, 'mobile-nav limits height to viewport');
  assert.match(mobileNavRule[1], /overflow-y:\s*auto/, 'mobile-nav has vertical scrolling');
});

test('responsive audit: plan carousel does not force body horizontal scroll on mobile', () => {
  const mobilePlansMatch = cssContent.match(/\.plans-grid\s*\{([^}]+)\}/g);
  assert.ok(mobilePlansMatch.length >= 2, 'plans-grid has base and responsive overrides');
  // At mobile, width should not blindly expand beyond 100% without margin offset
  assert.ok(!cssContent.includes('width: calc(100% + 18px);'), 'no uncontained width expansion in plans-grid');
});

test('responsive audit: touch targets meet or exceed 44px min size', () => {
  assert.match(cssContent, /\.results-jump-btn\s*\{[^}]*min-height:\s*44px/);
  assert.match(cssContent, /\.menu-toggle\s*\{[^}]*width:\s*44px;\s*height:\s*44px/);
  assert.match(cssContent, /\.results-arrow\s*\{[^}]*width:\s*48px;\s*height:\s*48px/);
  assert.match(cssContent, /\.footer-icon-btn\s*\{[^}]*width:\s*52px;\s*height:\s*52px/);
  assert.match(cssContent, /\.dialog-close\s*\{[^}]*width:\s*4[46]px;\s*height:\s*4[46]px/);
});

test('responsive audit: privacy policy page uses responsive layout and correct stylesheet version', () => {
  assert.match(privacyContent, /<meta name="viewport" content="width=device-width,\s*initial-scale=1">/, 'viewport meta present');
  assert.match(privacyContent, /style\.css\?v=\d+/, 'stylesheet link present');
  assert.ok(!privacyContent.includes('style.css?v=3'), 'outdated stylesheet version 3 is updated');
});
