'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatPhoneValue,
  resolveWhatsAppMessage,
  createSubmissionLock,
  applyFaqSelection,
  advanceAssessmentStep,
  closeAssessmentDialog,
  createApiClient
} = require('../public/assets/js/main.js');

test('phone formatting preserves valid Brazilian mobile digits', () => {
  assert.equal(formatPhoneValue('21992803268'), '(21) 99280-3268');
  assert.equal(formatPhoneValue('2132803268'), '(21) 3280-3268');
  assert.equal(formatPhoneValue('55 21 99280-3268'), '55 21 99280-3268');
  assert.equal(formatPhoneValue('21992803268999'), '21992803268999');
  assert.equal(formatPhoneValue('+34 912 345 678'), '+34 912 345 678');
});

test('plan WhatsApp message comes from the selected card data', () => {
  const messages = {
    plan: (months, value) => `Plano ${months} / ${value}`,
    hero: 'Mensagem hero'
  };
  assert.equal(resolveWhatsAppMessage('plan', { planMonths: '4', planValue: 'R$ 1.120,00' }, messages), 'Plano 4 / R$ 1.120,00');
  assert.equal(resolveWhatsAppMessage('hero', {}, messages), 'Mensagem hero');
});

test('submission lock prevents a rapid duplicate request', async () => {
  const button = { disabled: false };
  let release;
  let calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const lock = createSubmissionLock();
  const first = lock.run(button, async () => { calls += 1; await pending; return 'ok'; });
  const duplicate = lock.run(button, async () => { calls += 1; return 'duplicate'; });
  assert.equal(button.disabled, true);
  assert.equal(await duplicate, null);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 'ok');
  assert.equal(button.disabled, false);
});

test('FAQ selection keeps only one answer expanded', () => {
  const entry = () => ({ expanded: false, hidden: true, icon: '+' });
  const entries = [entry(), entry(), entry()];
  applyFaqSelection(entries, 1);
  assert.deepEqual(entries, [
    { expanded: false, hidden: true, icon: '+' },
    { expanded: true, hidden: false, icon: '×' },
    { expanded: false, hidden: true, icon: '+' }
  ]);
  applyFaqSelection(entries, 1);
  assert.equal(entries[1].expanded, false);
});

test('assessment step movement is clamped to three steps', () => {
  assert.equal(advanceAssessmentStep(1, -1), 1);
  assert.equal(advanceAssessmentStep(1, 1), 2);
  assert.equal(advanceAssessmentStep(2, 1), 3);
  assert.equal(advanceAssessmentStep(3, 1), 3);
});

test('closing the assessment restores focus to its opener', () => {
  let closed = 0;
  let focused = 0;
  closeAssessmentDialog({ close: () => { closed += 1; } }, { focus: () => { focused += 1; } });
  assert.equal(closed, 1);
  assert.equal(focused, 1);
});

test('an expired CSRF token is discarded so the next attempt fetches a new token', async () => {
  const calls = [];
  const responses = [
    { ok: true, status: 200, json: async () => ({ token: 'token-a' }) },
    { ok: false, status: 403, json: async () => ({ message: 'Sessão expirada.' }) },
    { ok: true, status: 200, json: async () => ({ token: 'token-b' }) },
    { ok: true, status: 200, json: async () => ({ ok: true }) }
  ];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  };
  const client = createApiClient(fetchImpl);
  await assert.rejects(() => client.postForm('/api/contact.php', { name: 'Maria' }), /Sessão expirada/);
  const result = await client.postForm('/api/contact.php', { name: 'Maria' });
  assert.equal(result.ok, true);
  assert.equal(calls.filter(call => call.url === '/api/csrf.php').length, 2);
  assert.match(calls[3].options.body, /token-b/);
});
