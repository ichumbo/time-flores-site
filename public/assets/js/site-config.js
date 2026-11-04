'use strict';

(function initializeConfig(root, factory) {
  const config = factory('5521992803268');
  if (typeof module === 'object' && module.exports) {
    module.exports = { createLeoNeryConfig: factory, config };
  } else {
    root.TIME_FLORES_CONFIG = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function createLeoNeryConfig(number) {
  const rawNumber = String(number || '').trim();
  const whatsappNumber = /^\d+$/.test(rawNumber) ? rawNumber : '';
  const validNumber = /^55[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(whatsappNumber);
  const messages = Object.freeze({
    header: 'Olá! Conheci o trabalho do Léo Nery pelo site e gostaria de saber como começar.',
    hero: 'Olá! Quero conhecer o acompanhamento do Léo Nery e entender qual opção combina comigo.',
    faq: 'Olá! Ainda tenho dúvidas sobre o acompanhamento e gostaria de conversar com a equipe.',
    contact: 'Olá! Prefiro conversar diretamente pelo WhatsApp sobre o acompanhamento.',
    footer: 'Olá! Vim pelo site do Léo Nery e gostaria de mais informações.',
    floating: 'Olá! Vim pelo site do Léo Nery e gostaria de conversar.',
    plan(months, value) {
      return `Olá! Tenho interesse no acompanhamento de ${months} meses, no valor de ${value}. Gostaria de saber como começar.`;
    }
  });

  return Object.freeze({
    whatsappNumber,
    messages,
    isWhatsAppConfigured() {
      return validNumber;
    },
    buildWhatsAppUrl(message) {
      if (!validNumber) return null;
      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(String(message || ''))}`;
    }
  });
});
