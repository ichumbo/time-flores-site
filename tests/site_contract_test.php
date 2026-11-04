<?php
declare(strict_types=1);

function fail_contract(string $message): never
{
    fwrite(STDERR, "FAIL {$message}\n");
    exit(1);
}

function assert_contract(bool $condition, string $message): void
{
    if (!$condition) fail_contract($message);
}

$root = dirname(__DIR__);
$html = file_get_contents($root . '/public/index.html');
$privacy = file_get_contents($root . '/public/privacidade.html');
$css = file_get_contents($root . '/public/assets/css/style.css');
if (!is_string($html) || !is_string($privacy) || !is_string($css)) fail_contract('site files are readable');

$document = new DOMDocument();
libxml_use_internal_errors(true);
$document->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR);
$xpath = new DOMXPath($document);

// Break caught: the former identity or icon returns to user-facing pages.
assert_contract(!str_contains(mb_strtolower($html . $privacy, 'UTF-8'), 'time flores'), 'former brand is absent from public pages');
assert_contract(str_contains($html, '<title>Léo Nery — Nutrição Esportiva</title>'), 'home title uses Léo Nery');
assert_contract($xpath->query('//link[@rel="icon" and @href="/assets/images/favicon.png" and @type="image/png"]')->length === 1, 'PNG favicon is active');
$brandLogos = $xpath->query('//img[contains(concat(" ", normalize-space(@class), " "), " brand-logo ") and @src="/assets/images/logo.png"]');
assert_contract($brandLogos !== false && $brandLogos->length === 2, 'logo appears in header and footer');
assert_contract($xpath->query('//*[@data-brand-placeholder]')->length === 3, 'three remaining provisional media slots in athletes use the new identity cover');
assert_contract(str_contains($css, '[data-brand-placeholder]::before'), 'brand placeholder cover is styled');
assert_contract(str_contains($css, "background-image: url('/assets/images/logo.png')"), 'full logo is used in large placeholders');
assert_contract(str_contains($css, "background-image: url('/assets/images/favicon.png')"), 'brand mark is used in compact placeholders');

// Break caught: the supplied athlete photograph is replaced by the former hero placeholder.
$heroImage = $xpath->query('//*[contains(concat(" ", normalize-space(@class), " "), " hero-visual ") and not(@data-brand-placeholder)]/img[@src="/assets/images/hero-2.jpg" and @width="819" and @height="1024"]');
assert_contract($heroImage !== false && $heroImage->length === 1, 'hero uses the supplied athlete photograph');
assert_contract(is_file($root . '/public/assets/images/hero-2.jpg'), 'hero photograph asset exists');
assert_contract(!str_contains($css, '.hero-visual img'), 'hero photograph is not forced into grayscale');
assert_contract((bool) preg_match('/\.hero-outline\s*\{[^}]*right:\s*16px;\s*bottom:\s*-14px;\s*left:\s*-13px;[^}]*117px/i', $css), 'hero PERFORMANCE outline uses the requested 117px and offset configuration');
$aboutImage = $xpath->query('//*[@id="sobre"]//*[contains(concat(" ", normalize-space(@class), " "), " image-frame ") and not(@data-brand-placeholder)]/img[@src="/assets/images/sobre-1.jpg"]');
assert_contract($aboutImage !== false && $aboutImage->length === 1, 'about section uses the supplied athlete photograph');
assert_contract(is_file($root . '/public/assets/images/sobre-1.jpg'), 'about photograph asset exists');
assert_contract(str_contains($html, 'AJUDO VOCÊ A') && str_contains($html, 'Você fala diretamente comigo durante todo processo!'), 'about section uses the requested headline and copy');
$marqueeSpans = $xpath->query('//*[contains(concat(" ", normalize-space(@class), " "), " marquee-track ")]/span');
assert_contract($marqueeSpans !== false && $marqueeSpans->length >= 6 && $marqueeSpans->length % 2 === 0, 'marquee repeats enough even copies for seamless infinite loop on wide screens');
$marqueeSpans = $xpath->query('//*[contains(concat(" ", normalize-space(@class), " "), " marquee-track ")]/span');
assert_contract($marqueeSpans !== false && $marqueeSpans->length >= 6 && $marqueeSpans->length % 2 === 0, 'marquee repeats enough even copies for seamless infinite loop on wide screens');

// Break caught: config executes after main and links initialize without their source of truth.
$configPosition = strpos($html, '/assets/js/site-config.js');
$mainPosition = strpos($html, '/assets/js/main.js');
assert_contract($configPosition !== false && $mainPosition !== false && $configPosition < $mainPosition, 'site config loads before main');

// Break caught: plan count, period, or price diverges from the commercial brief.
$planNodes = $xpath->query('//*[@data-plan-months and @data-plan-value]');
assert_contract($planNodes !== false && $planNodes->length === 5, 'exactly five plan cards');
$expectedPlans = [
    '1' => 'R$ 385,00', '2' => 'R$ 700,00', '3' => 'R$ 899,00',
    '4' => 'R$ 1.120,00', '5' => 'R$ 1.250,00',
];
foreach ($planNodes as $node) {
    $months = $node->getAttribute('data-plan-months');
    assert_contract(($expectedPlans[$months] ?? null) === $node->getAttribute('data-plan-value'), "plan {$months} value");
}

// Break caught: requested questions or accessible controls disappear from the accordion.
$faqButtons = $xpath->query('//*[@id="faq"]//button[contains(concat(" ", normalize-space(@class), " "), " faq-question ")]');
assert_contract($faqButtons !== false && $faqButtons->length === 9, 'nine FAQ buttons');
foreach ($faqButtons as $button) {
    assert_contract($button->hasAttribute('aria-expanded') && $button->hasAttribute('aria-controls'), 'FAQ button ARIA contract');
}

// Break caught: methodology section loses its 5-step process cards, SVG step icons, or support/delivery cards.
$methodCards = $xpath->query('//*[@id="metodo"]//*[contains(concat(" ", normalize-space(@class), " "), " method-card ")]');
$methodIcons = $xpath->query('//*[@id="metodo"]//*[contains(concat(" ", normalize-space(@class), " "), " method-step-icon ")]/svg');
$methodSegs = $xpath->query('//*[@id="metodo"]//*[contains(concat(" ", normalize-space(@class), " "), " method-segs ")]');
$methodExtras = $xpath->query('//*[@id="metodo"]//*[contains(concat(" ", normalize-space(@class), " "), " method-extras ")]/*');
assert_contract($methodCards !== false && $methodCards->length === 5, 'five methodology step cards');
assert_contract($methodIcons !== false && $methodIcons->length === 5, 'each methodology step card has an SVG icon');
assert_contract($methodSegs !== false && $methodSegs->length === 5, 'each methodology step card has progress segments');
assert_contract($methodExtras !== false && $methodExtras->length === 2, 'methodology includes support and delivery extra cards');
assert_contract(str_contains($html, 'PASSO A PASSO DE') && str_contains($html, 'COMO TUDO FUNCIONA'), 'methodology heading matches the step-by-step reference');
assert_contract(str_contains($html, '6h–18h') && str_contains($html, 'dias úteis'), 'methodology extras show support hours and delivery SLA');
assert_contract(str_contains($css, '.section .method-big-figure'), 'methodology big figures override generic section paragraph font size');

// Break caught: results section loses the reference layout, category jump buttons, or carousel controls.
$resultCards = $xpath->query('//*[@id="resultados"]//*[contains(concat(" ", normalize-space(@class), " "), " result-card ")]');
$commonCards = $xpath->query('//*[@id="res-comuns"]//*[contains(concat(" ", normalize-space(@class), " "), " result-card ") and not(@data-brand-placeholder)]/img');
$athleteCards = $xpath->query('//*[@id="res-atletas"]//*[contains(concat(" ", normalize-space(@class), " "), " result-card ") and not(contains(concat(" ", normalize-space(@class), " "), " is-square "))]/img[@width="800" and @height="1036"]');
$resultJumpBtns = $xpath->query('//*[@id="resultados"]//*[contains(concat(" ", normalize-space(@class), " "), " results-jump-btn ")]');
$resultArrows = $xpath->query('//*[@id="resultados"]//*[contains(concat(" ", normalize-space(@class), " "), " results-arrow ")]');
assert_contract($resultCards !== false && $resultCards->length === 8, 'eight result cards across common people and athletes');
assert_contract($commonCards !== false && $commonCards->length === 5, 'five artwork result cards in #res-comuns');
assert_contract($athleteCards !== false && $athleteCards->length === 3, 'three 800x1036 artwork result cards in #res-atletas');
foreach (range(1, 5) as $i) {
    assert_contract(is_file($root . "/public/assets/images/comum-{$i}.jpg"), "common result image comum-{$i}.jpg exists");
}
assert_contract($xpath->query('//*[@id="resultados"]//figcaption')->length === 0, 'result cards do not cover the bottom of the artwork with a figcaption bar');
assert_contract($resultJumpBtns !== false && $resultJumpBtns->length === 2, 'two results category buttons (Pessoas comuns and Atletas)');
assert_contract($resultArrows !== false && $resultArrows->length === 4, 'results carousel prev and next arrow buttons for both blocks');
assert_contract(str_contains($html, 'RESULTADOS DE QUEM') && str_contains($html, 'FAZ PARTE DO TIME'), 'results heading matches reference');
assert_contract(str_contains($html, 'PESSOAS COMUNS') && str_contains($html, 'Rotina normal, resultados reais: sem extremismo, sem restrição.'), 'results subheader matches reference');
assert_contract(str_contains($html, 'ATLETAS') && str_contains($html, 'Atletas acompanhados pela equipe nos palcos do fisiculturismo.'), 'athletes subheader matches reference');

// Break caught: testimonials carousel section or its 3-per-view card layout is missing.
$testimonialCards = $xpath->query('//*[@id="depoimentos"]//*[contains(concat(" ", normalize-space(@class), " "), " testimonial-card ")]');
$testimonialArrows = $xpath->query('//*[@id="depoimentos"]//*[@data-testimonials-prev or @data-testimonials-next]');
assert_contract($testimonialCards !== false && $testimonialCards->length === 6, 'six testimonial cards in #depoimentos carousel');
assert_contract($testimonialArrows !== false && $testimonialArrows->length === 2, 'testimonials carousel prev and next controls');
assert_contract(str_contains($html, 'POR DENTRO DO') && str_contains($html, 'ACOMPANHAMENTO'), 'testimonials heading matches reference');
assert_contract(str_contains($css, 'calc((100% - 48px) / 3)'), 'testimonials carousel shows 3 cards at a time on desktop');
$planWatermarks = $xpath->query('//*[@id="planos"]//*[contains(concat(" ", normalize-space(@class), " "), " plan-card ")]/*[contains(concat(" ", normalize-space(@class), " "), " method-bignum ")]');
assert_contract($planWatermarks !== false && $planWatermarks->length === 5, 'all five plan cards use the unified card visual with watermark numbers');
assert_contract(!str_contains($css, 'border: 1px dashed'), 'all cards use the unified solid border standard instead of dashed borders');

// Break caught: section numbering/order contradicts the requested conversion flow.
$faqText = $xpath->evaluate('string(//*[@id="faq"]//*[contains(@class,"section-kicker")][1])');
$contactText = $xpath->evaluate('string(//*[@id="contato"]//*[contains(@class,"section-kicker")][1])');
assert_contract(str_contains($faqText, '05 /'), 'FAQ is section 05');
assert_contract($xpath->query('//*[@id="equipe"]')->length === 0, 'team section #equipe is removed');
assert_contract(str_contains($contactText, '06 /'), 'contact is section 06');
assert_contract(strpos($html, 'id="faq"') < strpos($html, 'id="contato"'), 'FAQ precedes contact');

// Break caught: the direct form is replaced by or hidden behind the wizard.
foreach (['name', 'email', 'phone', 'goal', 'message', 'privacy'] as $fieldId) {
    assert_contract($xpath->query('//*[@id="contact-form"]//*[@id="' . $fieldId . '"]')->length === 1, "direct form field {$fieldId}");
}
$dialog = $xpath->query('//*[@id="assessment-dialog" and @aria-labelledby="assessment-title"]');
$steps = $xpath->query('//*[@id="assessment-form"]//*[contains(concat(" ", normalize-space(@class), " "), " assessment-step ")]');
assert_contract($dialog !== false && $dialog->length === 1, 'assessment dialog exists');
assert_contract($steps !== false && $steps->length === 3, 'assessment has three steps');

// Break caught: a required conversion point lacks a config-driven WhatsApp hook.
foreach (['header', 'hero', 'faq', 'contact', 'footer', 'floating'] as $context) {
    assert_contract($xpath->query('//*[@data-whatsapp-context="' . $context . '"]')->length >= 1, "WhatsApp context {$context}");
}
assert_contract($xpath->query('//*[@data-whatsapp-context="plan"]')->length === 5, 'five plan WhatsApp links');
$footerInstagram = $xpath->query('//footer//a[@href="https://www.instagram.com/nutri.leonery/"]');
$footerIconButtons = $xpath->query('//footer//a[contains(concat(" ", normalize-space(@class), " "), " footer-icon-btn ")]');
assert_contract($footerInstagram !== false && $footerInstagram->length === 1, 'footer contains official Instagram link');
assert_contract($footerIconButtons !== false && $footerIconButtons->length === 2 && trim($footerInstagram->item(0)->textContent) === '', 'footer social links are minimalist icon-only buttons');

// Break caught: generic diagonal arrows return or WhatsApp CTAs lose their distinct chat cue.
assert_contract(!str_contains($html . $privacy, '↗'), 'diagonal arrow glyphs are absent');
$whatsappLinks = $xpath->query('//*[@data-whatsapp-context and @data-whatsapp-context!="floating"]');
assert_contract($whatsappLinks !== false && $whatsappLinks->length === 11, 'eleven text WhatsApp conversion links');
foreach ($whatsappLinks as $link) {
    $icons = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " cta-icon ")]', $link);
    assert_contract($icons !== false && $icons->length === 1, 'each text WhatsApp CTA has one chat icon');
}
assert_contract(str_contains($css, '.cta-icon'), 'CTA icon system is styled');
assert_contract(str_contains($css, '[data-whatsapp-context] .cta-icon::before'), 'WhatsApp chat icon is styled');
assert_contract(str_contains($css, 'mask-image:'), 'CTA icons use crisp vector SVG masks');
assert_contract(!str_contains($html, '>WA<'), 'floating WhatsApp button uses an icon instead of WA text');

assert_contract(str_contains(mb_strtolower($privacy, 'UTF-8'), 'pré-avaliação'), 'privacy explains pre-assessment');

// Break caught: visual tokens drift back to the former green/yellow identity.
foreach (['#050B18', '#091529', '#0D1D36', '#087CFF', '#249DFF', '#64BCFF', '#24415F', '#F5F9FF', '#A8B9CC'] as $color) {
    assert_contract(str_contains(strtoupper($css), strtoupper($color)), "palette contains {$color}");
}
assert_contract(!preg_match('/(?:linear|radial)-gradient\s*\(/i', $css), 'design has no gradients');
assert_contract(str_contains($css, '.section::before') && str_contains($css, '.section::after') && str_contains($css, 'filter: blur('), 'sections have illuminated blue ambient background glows');

// Break caught: responsive/accessible component styling is accidentally removed.
assert_contract((bool) preg_match('/\.plans-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(5\s*,\s*1fr\)/s', $css), 'wide plans use five columns');
assert_contract((bool) preg_match('/scroll-snap-type\s*:\s*x\s+mandatory/i', $css), 'mobile plans use scroll snap');
assert_contract(str_contains($css, '.assessment-dialog'), 'assessment dialog is styled');
assert_contract(str_contains($css, ':focus-visible'), 'visible focus is styled');
assert_contract((bool) preg_match('/:focus-visible[^}]*outline\s*:\s*3px\s+solid\s+var\(--blue\)/s', $css), 'focus indicator uses the AA-safe primary blue');
assert_contract((bool) preg_match('/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/i', $css), 'reduced motion override exists');
assert_contract((bool) preg_match('/filter\s*:\s*grayscale\(1\)/i', $css), 'provisional photography cannot reintroduce the former green accent');

echo "site contract tests: ok\n";
