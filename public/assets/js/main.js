'use strict';

(function exposeFrontend(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.initialize(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : window, function createFrontend() {
  function formatPhoneValue(value) {
    const original = String(value || '');
    const trimmed = original.trim();
    if (!/^[0-9\s().-]*$/.test(trimmed)) return original;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length > 11) return original;
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    const area = digits.slice(0, 2);
    const local = digits.slice(2);
    if (local.length <= 4) return `(${area}) ${local}`;
    if (local.length <= 8) return `(${area}) ${local.slice(0, 4)}-${local.slice(4)}`;
    return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`;
  }

  function resolveWhatsAppMessage(context, dataset, messages) {
    if (context === 'plan') return messages.plan(dataset.planMonths, dataset.planValue);
    return messages[context] || messages.floating || '';
  }

  function createSubmissionLock() {
    let locked = false;
    return {
      async run(button, task) {
        if (locked) return null;
        locked = true;
        if (button) button.disabled = true;
        try {
          return await task();
        } finally {
          if (button) button.disabled = false;
          locked = false;
        }
      }
    };
  }

  function readFaqExpanded(entry) {
    return entry.button ? entry.button.getAttribute('aria-expanded') === 'true' : Boolean(entry.expanded);
  }

  function writeFaqState(entry, expanded) {
    if (entry.button) {
      entry.button.setAttribute('aria-expanded', String(expanded));
      entry.answer.hidden = !expanded;
      entry.icon.textContent = expanded ? '×' : '+';
      entry.answer.classList.toggle('is-open', expanded);
    } else {
      entry.expanded = expanded;
      entry.hidden = !expanded;
      entry.icon = expanded ? '×' : '+';
    }
  }

  function applyFaqSelection(entries, selectedIndex) {
    const shouldOpen = !readFaqExpanded(entries[selectedIndex]);
    entries.forEach((entry, index) => writeFaqState(entry, shouldOpen && index === selectedIndex));
  }

  function advanceAssessmentStep(current, direction) {
    return Math.max(1, Math.min(3, current + direction));
  }

  function closeAssessmentDialog(dialog, opener) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  function createApiClient(fetchImpl) {
    let tokenPromise = null;
    function getToken() {
      if (!tokenPromise) {
        tokenPromise = fetchImpl('/api/csrf.php', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        }).then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.token) throw new Error('Não foi possível iniciar o formulário.');
          return data.token;
        }).catch(error => {
          tokenPromise = null;
          throw error;
        });
      }
      return tokenPromise;
    }

    async function postForm(endpoint, payload) {
      const token = await getToken();
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ ...payload, csrf_token: token })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        if (response.status === 403) tokenPromise = null;
        throw new Error(result.message || 'Não foi possível enviar. Tente novamente.');
      }
      tokenPromise = null;
      return result;
    }

    return { getToken, postForm };
  }

  function initialize(document, window) {
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress = $('#progress');
    const header = $('.site-header');
    const menuButton = $('.menu-toggle');
    const menu = $('#mobile-menu');
    const apiClient = createApiClient(window.fetch.bind(window));

    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    let scrollQueued = false;
    function updateScrollState() {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const percent = available > 0 ? Math.max(0, Math.min(100, window.scrollY / available * 100)) : 0;
      if (progress) progress.style.width = `${percent}%`;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
      scrollQueued = false;
    }
    window.addEventListener('scroll', () => {
      if (!scrollQueued) {
        scrollQueued = true;
        window.requestAnimationFrame(updateScrollState);
      }
    }, { passive: true });
    updateScrollState();

    if ('IntersectionObserver' in window && !reducedMotion) {
      const revealObserver = new window.IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -35px 0px', threshold: 0.12 });
      $$('.reveal').forEach(item => revealObserver.observe(item));

      const navObserver = new window.IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          $$('.desktop-nav a').forEach(anchor => anchor.classList.toggle('active', anchor.hash === `#${entry.target.id}`));
        });
      }, { rootMargin: '-22% 0px -60% 0px' });
      $$('main section[id]').forEach(section => navObserver.observe(section));
    } else {
      $$('.reveal').forEach(item => item.classList.add('is-visible'));
    }

    function closeMenu() {
      if (!menu || !menuButton) return;
      menu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menu');
      document.body.classList.remove('menu-open');
    }
    if (menuButton && menu) {
      menuButton.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        menuButton.setAttribute('aria-expanded', String(opening));
        menuButton.setAttribute('aria-label', opening ? 'Fechar menu' : 'Abrir menu');
        document.body.classList.toggle('menu-open', opening);
      });
      $$('#mobile-menu a').forEach(anchor => anchor.addEventListener('click', closeMenu));
      window.addEventListener('resize', () => { if (window.innerWidth > 850) closeMenu(); });
    }

    const config = window.TIME_FLORES_CONFIG;
    $$('[data-whatsapp-context]').forEach(anchor => {
      const context = anchor.dataset.whatsappContext;
      const card = anchor.closest('[data-plan-months]');
      const dataset = card ? card.dataset : anchor.dataset;
      const message = config ? resolveWhatsAppMessage(context, dataset, config.messages) : '';
      const url = config ? config.buildWhatsAppUrl(message) : null;
      if (!url) {
        anchor.removeAttribute('target');
        anchor.removeAttribute('rel');
        anchor.setAttribute('aria-disabled', 'true');
        anchor.classList.add('is-disabled');
        anchor.addEventListener('click', event => event.preventDefault());
        return;
      }
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    });

    const faqEntries = $$('.faq-item').map(item => ({
      button: $('.faq-question', item),
      answer: $('.faq-answer', item),
      icon: $('.faq-question span', item)
    }));
    faqEntries.forEach((entry, index) => {
      entry.button.addEventListener('click', () => applyFaqSelection(faqEntries, index));
    });

    const resultsCategoryBtns = $$('[data-results-category]');
    const resultsTitle = $('#results-category-title');
    const resultsDesc = $('#results-category-desc');
    const resultsPrev = $('[data-results-prev]');
    const resultsNext = $('[data-results-next]');
    const resultsBar = $('[data-results-bar]');
    const resultsCards = $$('#resultados .result-card');
    let resultsIndex = 0;

    function updateResultsView() {
      const total = Math.max(1, resultsCards.length);
      if (resultsBar) {
        const width = 100 / total;
        resultsBar.style.width = `${width}%`;
        resultsBar.style.left = `${resultsIndex * width}%`;
      }
      if (resultsPrev) resultsPrev.disabled = resultsIndex <= 0;
      if (resultsNext) resultsNext.disabled = resultsIndex >= total - 1;
    }

    if (resultsPrev && resultsNext && resultsCards.length) {
      updateResultsView();
      resultsPrev.addEventListener('click', () => {
        resultsIndex = Math.max(0, resultsIndex - 1);
        updateResultsView();
        resultsCards[resultsIndex].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
      });
      resultsNext.addEventListener('click', () => {
        resultsIndex = Math.min(resultsCards.length - 1, resultsIndex + 1);
        updateResultsView();
        resultsCards[resultsIndex].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }

    resultsCategoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.resultsCategory;
        resultsCategoryBtns.forEach(item => item.classList.toggle('is-active', item === btn));
        if (resultsTitle && resultsDesc) {
          if (category === 'atletas') {
            resultsTitle.textContent = 'ATLETAS';
            resultsDesc.textContent = 'Atletas acompanhados pela equipe nos palcos do fisiculturismo.';
          } else {
            resultsTitle.textContent = 'PESSOAS COMUNS';
            resultsDesc.textContent = 'Rotina normal, resultados reais: sem extremismo, sem restrição.';
          }
        }
      });
    });

    $$('#phone, #assessment-phone').forEach(input => {
      input.addEventListener('input', () => { input.value = formatPhoneValue(input.value); });
    });

    function setFormStatus(element, message, type = '') {
      if (!element) return;
      element.textContent = message;
      element.className = type;
    }

    const contactForm = $('#contact-form');
    const contactButton = $('#submit-button');
    const contactStatus = $('#form-status');
    const contactLock = createSubmissionLock();
    if (contactForm && contactButton) {
      contactForm.addEventListener('submit', event => {
        event.preventDefault();
        setFormStatus(contactStatus, '');
        if (!contactForm.reportValidity()) return;
        contactLock.run(contactButton, async () => {
          const original = contactButton.innerHTML;
          contactButton.textContent = 'ENVIANDO...';
          try {
            const result = await apiClient.postForm('/api/contact.php', {
              name: $('#name').value.trim(),
              email: $('#email').value.trim(),
              phone: $('#phone').value.trim(),
              goal: $('#goal').value,
              message: $('#message').value.trim(),
              privacy: $('#privacy').checked,
              company_website: $('#company_website').value
            });
            contactForm.reset();
            setFormStatus(contactStatus, result.message || 'Mensagem recebida com sucesso!', 'success');
          } catch (error) {
            setFormStatus(contactStatus, error.message || 'Falha na conexão. Tente novamente.', 'error');
          } finally {
            contactButton.innerHTML = original;
          }
        });
      });
    }

    const dialog = $('#assessment-dialog');
    const assessmentForm = $('#assessment-form');
    const assessmentStatus = $('#assessment-status');
    const assessmentCounter = $('#assessment-counter');
    const assessmentBack = $('[data-assessment-back]');
    const assessmentNext = $('[data-assessment-next]');
    const assessmentSubmit = $('#assessment-submit');
    const assessmentSteps = $$('.assessment-step');
    const progressSteps = $$('.assessment-progress span');
    const assessmentLock = createSubmissionLock();
    let currentStep = 1;
    let assessmentOpener = null;

    function showAssessmentStep(step) {
      currentStep = step;
      assessmentSteps.forEach((item, index) => { item.hidden = index + 1 !== currentStep; });
      progressSteps.forEach((item, index) => item.classList.toggle('is-current', index < currentStep));
      if (assessmentCounter) assessmentCounter.textContent = `Etapa ${currentStep} de 3`;
      if (assessmentBack) assessmentBack.hidden = currentStep === 1;
      if (assessmentNext) assessmentNext.hidden = currentStep === 3;
      if (assessmentSubmit) assessmentSubmit.hidden = currentStep !== 3;
    }

    function currentStepIsValid() {
      const step = assessmentSteps[currentStep - 1];
      if (!step) return false;
      const controls = $$('input, select, textarea', step).filter(control => control.required);
      const invalid = controls.find(control => !control.checkValidity());
      if (!invalid) return true;
      invalid.reportValidity();
      invalid.focus();
      return false;
    }

    function openAssessment(event) {
      if (!dialog) return;
      assessmentOpener = event.currentTarget;
      setFormStatus(assessmentStatus, '');
      showAssessmentStep(1);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('dialog-open');
      const firstControl = $('select, input, button', assessmentSteps[0]);
      window.setTimeout(() => firstControl && firstControl.focus(), 0);
    }

    function closeAssessment() {
      if (!dialog) return;
      closeAssessmentDialog(dialog, assessmentOpener);
      document.body.classList.remove('dialog-open');
    }

    $$('[data-open-assessment]').forEach(button => button.addEventListener('click', openAssessment));
    $$('[data-close-assessment]').forEach(button => button.addEventListener('click', closeAssessment));
    if (dialog) {
      dialog.addEventListener('click', event => { if (event.target === dialog) closeAssessment(); });
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeAssessment(); });
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMenu();
        if (dialog && dialog.hasAttribute('open')) closeAssessment();
      }
    });
    if (assessmentNext) {
      assessmentNext.addEventListener('click', () => {
        if (!currentStepIsValid()) return;
        showAssessmentStep(advanceAssessmentStep(currentStep, 1));
      });
    }
    if (assessmentBack) assessmentBack.addEventListener('click', () => showAssessmentStep(advanceAssessmentStep(currentStep, -1)));

    if (assessmentForm && assessmentSubmit) {
      assessmentForm.addEventListener('submit', event => {
        event.preventDefault();
        setFormStatus(assessmentStatus, '');
        if (currentStep !== 3 || !assessmentForm.reportValidity()) return;
        assessmentLock.run(assessmentSubmit, async () => {
          const original = assessmentSubmit.innerHTML;
          assessmentSubmit.textContent = 'ENVIANDO...';
          try {
            const result = await apiClient.postForm('/api/pre-assessment.php', {
              objective: $('#assessment-objective').value,
              experience: $('#assessment-experience').value,
              weekly_frequency: $('#assessment-frequency').value,
              training_place: $('#assessment-place').value,
              name: $('#assessment-name').value.trim(),
              email: $('#assessment-email').value.trim(),
              phone: $('#assessment-phone').value.trim(),
              privacy: $('#assessment-privacy').checked,
              company_website: $('#assessment-company').value
            });
            assessmentForm.reset();
            showAssessmentStep(1);
            setFormStatus(assessmentStatus, result.message || 'Pré-avaliação recebida com sucesso!', 'success');
          } catch (error) {
            setFormStatus(assessmentStatus, error.message || 'Falha na conexão. Tente novamente.', 'error');
          } finally {
            assessmentSubmit.innerHTML = original;
          }
        });
      });
    }

    apiClient.getToken().catch(() => null);
  }

  return {
    formatPhoneValue,
    resolveWhatsAppMessage,
    createSubmissionLock,
    applyFaqSelection,
    advanceAssessmentStep,
    closeAssessmentDialog,
    createApiClient,
    initialize
  };
});
