# SDD ledger — plan: docs/superpowers/plans/2026-11-04-blue-conversion-site.md

Setup: Ruling: no worktree or standard SDD scripts — the supplied folder is not a Git repository, so implementation proceeds in place with a manual ledger — cost if wrong: changes cannot be isolated or reverted through Git.
Pre-flight: Task 1 produces validators/request helpers consumed by Task 2 — signatures align.
Pre-flight: Task 3 produces HTML hooks and config consumed by Task 4 — names align.
Pre-flight: Tasks 3 and 4 produce classes/state consumed by Task 5 — selectors will be locked by the HTML contract test.
Pre-flight: Tasks 1–5 produce the suite consumed by Task 6 — commands align with the planned files.
Task 1: Ruling: added `tests/contact_http_test.sh` before the request-helper refactor — the planned pure tests could not observe endpoint compatibility or the new `source` field — cost if wrong: one additional integration test to maintain.
Task 1: complete (no commits: no Git repository; tests: `php tests/validation_test.php && bash tests/contact_http_test.sh` → 2/2 pass).
Task 2: Ruling: extracted pure notification formatting to `private/notifications.php` — this makes the pre-assessment-specific email copy observable without real SMTP — cost if wrong: one additional private module to maintain.
Task 2: complete (no commits: no Git repository; tests: `php tests/validation_test.php && bash tests/http_forms_test.sh && bash tests/contact_http_test.sh` → 3/3 pass).
Task 3: complete (no commits: no Git repository; tests: `node --test tests/whatsapp_config_test.js && php tests/site_contract_test.php` → 4 Node subtests/site contract pass).
Task 4: Ruling: exported browser-independent behavior from `main.js` while keeping automatic browser initialization — this tests real state transitions without adding a DOM test dependency — cost if wrong: the script has a small UMD-style wrapper.
Task 4: complete (no commits: no Git repository; tests: `node --test tests/whatsapp_config_test.js tests/frontend_contract_test.js && php tests/site_contract_test.php` → 10 Node subtests/site contract pass).
Task 5: Ruling: 21st inspiration search returned HTTP 401, so implementation used the approved local spec and recorded project design context — cost if wrong: no external catalog comparison informed the composition.
Task 5: Ruling: 21st review's nine hardcoded-color infos are the nine required values inside `:root`, not off-token usage, so they remain — cost if wrong: future automated audits may repeat these informational findings.
Task 5: complete (no commits: no Git repository; tests: `php tests/site_contract_test.php` → pass; `21st review` → 9 informational token-definition findings, 0 errors).
Task 6: Ruling: provisional WebP assets are rendered in grayscale — the assets themselves contained the former lime accent and are documented for later replacement — cost if wrong: future photography will remain monochrome until this rule is removed.
Task 6: fixed mobile long-heading overflow — `browser_layout_test.js` RED at 418px page width → GREEN at 390px, suite 11/11.
Task 6: complete (no commits: no Git repository; full verification: PHP lint clean, 3 PHP/shell suites pass, 11 Node subtests pass, site contract pass, local HTTP 200).
Final: fixed phone normalization changing/reinterpreting invalid input — PHP and frontend phone regressions RED→GREEN, suite 11/11.
Final: fixed malformed WhatsApp configuration generating an active URL — mixed-character config regression RED→GREEN, suite 11/11.
Final: fixed AA contrast for primary controls, light-section kickers, and focus — browser/contract regressions RED→GREEN, suite 11/11.
Final: minor (deferred): tablet result caption can clip at 768px.
Final: minor (deferred): wizard step changes do not move focus to the first field in the new step.
Final: Ruling: SMTP delivery, production HTTPS/headers, provider permissions, and backups were not judged — no deployed provider configuration exists, so these remain deployment checks — cost if wrong: production mail or hardening may fail despite local success.
Final: Ruling: exact reference-image fidelity was not judged — the four cited screenshots were absent, so the approved text specification remains the visual authority — cost if wrong: spacing may differ from the unavailable references.
Final: Ruling: placeholder authenticity and final controller/legal information remain outside implementation — the project explicitly marks them for owner completion — cost if wrong: the site is not publication-ready until real content and legal data replace placeholders.
Final: Ruling: Safari and assistive-technology-specific behavior was not judged — runtime verification used Chrome plus semantic/ARIA contracts — cost if wrong: a browser or AT-specific interaction issue may remain.
