# Time Flores Blue Conversion Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing Time Flores landing page around a solid-blue design system, direct contact form, contextual WhatsApp CTAs, five plans, accessible FAQ, and a secondary three-step pre-assessment.

**Architecture:** Preserve the static HTML/CSS/JavaScript frontend and PHP 8.1 backend. Add a public, non-sensitive WhatsApp configuration module; reuse pure validation and private-storage helpers across two independent form endpoints; keep the direct form in-page and place pre-assessment in an accessible modal.

**Tech Stack:** HTML5, CSS custom properties, vanilla JavaScript, PHP 8.1+, PHPMailer (optional SMTP), PHP/Node/shell contract tests.

**Spec:** `docs/superpowers/specs/2026-11-04-blue-conversion-site-design.md`

## Global Constraints

- Keep HTML, CSS, JavaScript, and PHP; do not introduce a frontend framework or runtime dependency.
- Use only `#050B18`, `#091529`, `#0D1D36`, `#087CFF`, `#249DFF`, `#64BCFF`, `#24415F`, `#F5F9FF`, and `#A8B9CC` as design-system colors.
- Use no gradients, decorative transparency, fake links, checkout, or unverified commercial promises.
- Use WhatsApp number `5521992803268` from one public configuration file.
- Keep PHP credentials and submitted data outside `public/`; require CSRF, origin checks, honeypot, rate limiting, server validation, and explicit consent.
- Preserve the existing about, methodology, results, team, contact storage, optional SMTP, reduced-motion behavior, and mobile navigation.
- This directory has no Git metadata, so commit steps are recorded as skipped unless a repository is initialized externally.

## Review Focus

- Malformed or empty WhatsApp numbers must yield no active external CTA, never a fabricated URL; pin in Task 3.
- Rapid double-submit must produce one request while the button stays disabled; pin in Task 4.
- Expired CSRF must return a safe 403 and allow a fresh token on retry; pin in Tasks 1 and 4.
- Brazilian phones with punctuation must normalize to 10–11 digits, while shorter, longer, and foreign-looking input fails; pin in Task 1.
- Modal close via button, backdrop, and `Escape` must restore focus and never trap keyboard users after close; pin in Task 4.

---

### Task 1: Shared validation and private persistence

**Files:**
- Create: `private/validation.php`
- Create: `tests/validation_test.php`
- Modify: `private/bootstrap.php`
- Modify: `public/api/contact.php`

**Interfaces:**
- Produces: `normalize_brazilian_phone(string): ?string`, `validate_contact_payload(array): array`, `validate_pre_assessment_payload(array): array`, `store_json_line(string, array): void`, `assert_json_post_request(int): array`, and `assert_csrf_token(array): void`.
- Preserves: JSON response shape `{ok: boolean, message: string}` and `storage/contacts.jsonl`.

- [x] **Step 1: Write failing pure-validation tests**

Add assertions for valid formatted/unformatted phones, invalid phone lengths, allowed contact goals, missing consent, allowed pre-assessment choices, maximum lengths, and UTF-8-safe optional text.

- [x] **Step 2: Run tests and confirm the new interfaces are missing**

Run: `php tests/validation_test.php`  
Expected: non-zero exit caused by missing `private/validation.php` or undefined functions.

- [x] **Step 3: Implement pure validators**

Return normalized associative arrays on success and throw `InvalidArgumentException` with user-safe Portuguese messages on validation failure. Allowed pre-assessment values are fixed in the endpoint/task tests, not accepted from arbitrary client labels.

- [x] **Step 4: Run pure-validation tests**

Run: `php tests/validation_test.php`  
Expected: `validation tests: ok`.

- [x] **Step 5: Refactor shared request and storage helpers**

Move request-size/content-type/origin/JSON/CSRF checks into the declared bootstrap helpers. Make `contact.php` call them without changing successful storage or response behavior. Add `source: contact` to new contact records.

- [x] **Step 6: Verify compatibility**

Run: `find private public/api -name '*.php' -print0 | xargs -0 -n1 php -l && php tests/validation_test.php`  
Expected: every file reports no syntax errors and tests pass.

- [x] **Step 7: Commit**

Skipped: workspace is not a Git repository.

### Task 2: Pre-assessment endpoint

**Files:**
- Create: `public/api/pre-assessment.php`
- Create: `tests/http_forms_test.sh`
- Modify: `private/bootstrap.php`

**Interfaces:**
- Consumes: Task 1 request, CSRF, validator, storage, and phone-normalization functions.
- Produces: `POST /api/pre-assessment.php` and `storage/pre-assessments.jsonl`; success response `{ok:true,message:string}`.

- [x] **Step 1: Write failing HTTP contract tests**

Start a temporary PHP server, retain its PID for cleanup, use a cookie jar to fetch CSRF, then assert: GET gives 405; missing consent gives 422; invalid token gives 403; valid minimal data gives 200; a second use of the consumed token gives 403; stored record has `source: pre_assessment` and excludes raw IP.

- [x] **Step 2: Run the HTTP test and confirm the route is missing**

Run: `bash tests/http_forms_test.sh`  
Expected: FAIL because `/api/pre-assessment.php` does not exist or does not satisfy the contract.

- [x] **Step 3: Implement the endpoint**

Accept `objective`, `experience`, `weekly_frequency`, `training_place`, `name`, `email`, `phone`, `privacy`, `company_website`, and `csrf_token`; save normalized data privately, hash IP, consume the token, and notify through a pre-assessment-specific plain-text SMTP body.

- [x] **Step 4: Run endpoint and regression tests**

Run: `bash tests/http_forms_test.sh && php tests/validation_test.php`  
Expected: both pass and the test cleans up its temporary records/process.

- [x] **Step 5: Commit**

Skipped: workspace is not a Git repository.

### Task 3: Page structure and centralized WhatsApp contract

**Files:**
- Create: `public/assets/js/site-config.js`
- Create: `tests/site_contract_test.php`
- Create: `tests/whatsapp_config_test.js`
- Modify: `public/index.html`
- Modify: `public/privacidade.html`

**Interfaces:**
- Produces: `window.TIME_FLORES_CONFIG` with `whatsappNumber`, `messages`, `isWhatsAppConfigured()`, and `buildWhatsAppUrl(message)`; HTML hooks `[data-whatsapp]`, `[data-plan-months]`, `[data-plan-value]`, `[data-open-assessment]`, and modal/form IDs used by Task 4.
- Consumes: exact copy and section ordering from the spec.

- [x] **Step 1: Write failing configuration and HTML contract tests**

Assert number normalization and URL encoding; invalid-number contexts return `null`. Assert exactly five plan cards and values, nine FAQ items, contact before footer, FAQ `05`, team `06`, contact `07`, direct-form fields unchanged, config script loaded before `main.js`, modal three-step markup, WhatsApp hooks in header/hero/plans/FAQ/contact/footer/floating button, and updated privacy copy.

- [x] **Step 2: Run tests and confirm missing contracts**

Run: `node --test tests/whatsapp_config_test.js && php tests/site_contract_test.php`  
Expected: FAIL for missing config/module and new HTML hooks.

- [x] **Step 3: Implement the WhatsApp config module**

Use `5521992803268`, official `https://wa.me/` URLs, `encodeURIComponent`, base/contact/FAQ/footer messages, and plan message template `Olá! Tenho interesse no acompanhamento de [X] meses, no valor de R$ [VALOR]. Gostaria de saber como começar.`

- [x] **Step 4: Rebuild semantic page sections**

Preserve current images and content sections. Replace the offer section with five plan cards and payment note; move/rebuild FAQ before team; add the left-side support card; keep the direct contact form exposed; add secondary pre-assessment dialog markup; add safe external-link attributes to all WhatsApp anchors.

- [x] **Step 5: Update privacy disclosure**

Describe contact and pre-assessment fields, purposes, private storage, and rights without filling unknown controller data.

- [x] **Step 6: Run contract tests**

Run: `node --test tests/whatsapp_config_test.js && php tests/site_contract_test.php`  
Expected: all tests pass.

- [x] **Step 7: Commit**

Skipped: workspace is not a Git repository.

### Task 4: Frontend behavior and accessibility

**Files:**
- Create: `tests/frontend_contract_test.js`
- Modify: `public/assets/js/main.js`

**Interfaces:**
- Consumes: Task 3 config object and HTML hooks; Task 2 endpoint.
- Produces: initialized WhatsApp anchors, one-open FAQ accordion, direct-form submit flow, three-step modal flow, focus restoration, phone masks, status messages, and shared `postForm()` behavior.

- [x] **Step 1: Write failing JavaScript contract tests**

Assert source contracts for config-driven links, plan-specific messages, submit-button disabling before fetch, token refresh after 403/success, one-open accordion, `aria-expanded`, dialog `showModal`/fallback, three close mechanisms, focus restoration, per-step validation, and reduced-motion-safe reveals.

- [x] **Step 2: Run tests and confirm missing behavior**

Run: `node --test tests/frontend_contract_test.js`  
Expected: FAIL against the old script.

- [x] **Step 3: Implement shared form and phone utilities**

Use one cached CSRF promise, `formatPhoneInput(input)`, `setFormStatus(element,message,type)`, and `postForm(endpoint,payload)`. Disable each submit before its fetch begins and restore it in `finally`.

- [x] **Step 4: Implement WhatsApp, accordion, and scroll behavior**

Initialize configured anchors safely; derive plan messages from card datasets; enforce single-open FAQ with correct ARIA; keep IntersectionObserver, header state, progress, stagger classes, and reduced-motion fallback.

- [x] **Step 5: Implement the accessible wizard modal**

Keep step state local to the assessment form, validate visible controls before advancing, announce `Etapa X de 3`, submit only on step 3, close through button/backdrop/`Escape`, and restore the opener's focus.

- [x] **Step 6: Run JavaScript and full contract tests**

Run: `node --check public/assets/js/site-config.js && node --check public/assets/js/main.js && node --test tests/whatsapp_config_test.js tests/frontend_contract_test.js && php tests/site_contract_test.php`  
Expected: syntax checks and tests pass.

- [x] **Step 7: Commit**

Skipped: workspace is not a Git repository.

### Task 5: Blue design system and responsive implementation

**Files:**
- Create: `.21st/design.json` and/or `.21st/DESIGN.md` through `21st init --design-context`
- Modify: `public/assets/css/style.css`

**Interfaces:**
- Consumes: Task 3 classes and Task 4 state attributes/classes.
- Produces: solid-blue responsive visual system, five-plan layout, accordion transitions, dialog styling, visible focus, touch targets, reduced-motion overrides, and mobile overflow safety.

- [x] **Step 1: Initialize design context and search grounded references**

Run: `21st init --design-context`, then `21st search "dark blue fitness pricing cards contact form accordion" --context auto` and record only relevant composition guidance; do not install framework components into this static project.

- [x] **Step 2: Add a failing CSS contract check**

Extend `tests/site_contract_test.php` to assert all nine required palette tokens, absence of `linear-gradient`/`radial-gradient`, selectors for five-column plans, mobile scroll snap, dialog, visible focus, and `prefers-reduced-motion`.

- [x] **Step 3: Run the contract and confirm failure**

Run: `php tests/site_contract_test.php`  
Expected: FAIL against the old green design.

- [x] **Step 4: Implement the blue visual system**

Replace the current stylesheet using centralized tokens, preserve title/body fonts, style all existing and new sections, avoid gradients/transparency decoration, and use `opacity`/`transform` for nonessential motion.

- [x] **Step 5: Implement responsive states**

At wide desktop show five plan columns; at tablet use adaptive wrapping; at mobile use comfortable horizontal plan cards with `scroll-snap`, no page overflow, stacked contact, usable dialog, and an unobtrusive floating WhatsApp button.

- [x] **Step 6: Run contracts and 21st review**

Run: `php tests/site_contract_test.php && 21st review public/index.html public/assets/css/style.css public/assets/js/main.js`  
Expected: contract passes; apply only safe deterministic review fixes.

- [x] **Step 7: Commit**

Skipped: workspace is not a Git repository.

### Task 6: End-to-end verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-04-blue-conversion-site.md` (check completed steps)

**Interfaces:**
- Consumes: all previous deliverables.
- Produces: verified local site and accurate operator instructions.

- [x] **Step 1: Update operator documentation**

Document local startup, centralized WhatsApp configuration, both private JSONL stores, optional SMTP, production requirements, and which image paths remain replaceable.

- [x] **Step 2: Run the complete automated suite**

Run: `find private public tests -name '*.php' -print0 | xargs -0 -n1 php -l && php tests/validation_test.php && bash tests/http_forms_test.sh && node --check public/assets/js/site-config.js && node --check public/assets/js/main.js && node --test tests/whatsapp_config_test.js tests/frontend_contract_test.js && php tests/site_contract_test.php`  
Expected: zero exits, no syntax errors, and all test success markers.

- [x] **Step 3: Perform responsive/browser smoke checks**

Verify at 1440×900, 768×1024, and 390×844: no horizontal page overflow; five plans remain usable; direct form is visually primary; wizard is secondary; menu, accordion, modal, all WhatsApp links, both forms, focus, and reduced motion work; browser console has no errors.

- [x] **Step 4: Confirm runtime health**

Run: `curl -sS -I http://127.0.0.1:8000/` and submit isolated test records through both endpoints.  
Expected: page returns 200 and server confirms both records before success UI.

- [x] **Step 5: Commit**

Skipped: workspace is not a Git repository.
