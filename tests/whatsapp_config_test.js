'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createLeoNeryConfig, config } = require('../public/assets/js/site-config.js');

test('configured number builds an official encoded WhatsApp URL', () => {
  assert.equal(config.whatsappNumber, '5521992803268');
  assert.equal(config.isWhatsAppConfigured(), true);
  assert.equal(
    config.buildWhatsAppUrl('Olá! Quero começar.'),
    'https://wa.me/5521992803268?text=Ol%C3%A1!%20Quero%20come%C3%A7ar.'
  );
});

test('invalid numbers never produce a fabricated WhatsApp URL', () => {
  for (const number of ['', '21992803268', '5500000000000', 'abc', '5521992803268garbage']) {
    const invalid = createLeoNeryConfig(number);
    assert.equal(invalid.isWhatsAppConfigured(), false);
    assert.equal(invalid.buildWhatsAppUrl('Olá'), null);
  }
});

test('plan messages identify the selected period and price', () => {
  assert.equal(
    config.messages.plan('3', 'R$ 899,00'),
    'Olá! Tenho interesse no acompanhamento de 3 meses, no valor de R$ 899,00. Gostaria de saber como começar.'
  );
});

test('public messages use the Léo Nery identity and never the former brand', () => {
  const publicMessages = [config.messages.header, config.messages.hero, config.messages.footer, config.messages.floating].join(' ');
  assert.match(publicMessages, /Léo Nery/);
  assert.doesNotMatch(publicMessages, /Time Flores/i);
});
