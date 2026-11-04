<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/private/validation.php';
require_once dirname(__DIR__) . '/private/notifications.php';

function assert_same(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL {$label}: expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

function assert_throws(callable $callback, string $label): void
{
    try {
        $callback();
    } catch (InvalidArgumentException) {
        return;
    }
    fwrite(STDERR, "FAIL {$label}: expected InvalidArgumentException" . PHP_EOL);
    exit(1);
}

// Break caught: punctuation in a valid Brazilian mobile number is not normalized.
assert_same('21992803268', normalize_brazilian_phone('(21) 99280-3268'), 'formatted mobile phone');
assert_same('2132803268', normalize_brazilian_phone('21 3280-3268'), 'formatted landline phone');
// Break caught: malformed or international-prefixed values reach private storage.
assert_same(null, normalize_brazilian_phone('99280-3268'), 'phone without DDD');
assert_same(null, normalize_brazilian_phone('5521992803268'), 'phone with unexpected country prefix');
assert_same(null, normalize_brazilian_phone('+34 912 345 678'), 'foreign international phone');
assert_same(null, normalize_brazilian_phone('21992803268999'), 'overlong phone is never truncated');

$contact = validate_contact_payload([
    'name' => '  Maria Flores  ',
    'email' => 'maria@example.com',
    'phone' => '(21) 99280-3268',
    'goal' => 'Hipertrofia',
    'message' => "Quero evoluir.\r\nTenho disponibilidade.",
    'privacy' => true,
]);
assert_same('Maria Flores', $contact['name'], 'trimmed contact name');
assert_same('21992803268', $contact['phone'], 'normalized contact phone');
assert_same("Quero evoluir.\nTenho disponibilidade.", $contact['message'], 'normalized message newlines');

// Break caught: arbitrary client labels bypass the server allow-list.
assert_throws(static fn () => validate_contact_payload([
    'name' => 'Maria Flores', 'email' => 'maria@example.com', 'phone' => '21992803268',
    'goal' => 'Promessa inventada', 'message' => '', 'privacy' => true,
]), 'contact goal allow-list');
// Break caught: a contact is stored without explicit consent.
assert_throws(static fn () => validate_contact_payload([
    'name' => 'Maria Flores', 'email' => 'maria@example.com', 'phone' => '21992803268',
    'goal' => 'Outro', 'message' => '', 'privacy' => false,
]), 'contact consent');
// Break caught: oversized optional text is accepted.
assert_throws(static fn () => validate_contact_payload([
    'name' => 'Maria Flores', 'email' => 'maria@example.com', 'phone' => '21992803268',
    'goal' => 'Outro', 'message' => str_repeat('á', 1501), 'privacy' => true,
]), 'contact message maximum');

$assessment = validate_pre_assessment_payload([
    'objective' => 'Qualidade de vida',
    'experience' => 'Iniciante',
    'weekly_frequency' => '3 a 4 dias',
    'training_place' => 'Academia',
    'name' => 'João Silva',
    'email' => 'joao@example.com',
    'phone' => '21 99280-3268',
    'privacy' => true,
]);
assert_same('3 a 4 dias', $assessment['weekly_frequency'], 'assessment frequency');
assert_same('21992803268', $assessment['phone'], 'assessment phone');

// Break caught: arbitrary assessment options are persisted.
assert_throws(static fn () => validate_pre_assessment_payload([
    'objective' => 'Hipertrofia', 'experience' => 'Profissional',
    'weekly_frequency' => '3 a 4 dias', 'training_place' => 'Academia',
    'name' => 'João Silva', 'email' => 'joao@example.com', 'phone' => '21992803268', 'privacy' => true,
]), 'assessment experience allow-list');
// Break caught: the wizard records data without consent.
assert_throws(static fn () => validate_pre_assessment_payload([
    'objective' => 'Hipertrofia', 'experience' => 'Iniciante',
    'weekly_frequency' => '1 a 2 dias', 'training_place' => 'Casa',
    'name' => 'João Silva', 'email' => 'joao@example.com', 'phone' => '21992803268', 'privacy' => false,
]), 'assessment consent');

// Break caught: assessment notifications use contact labels or leak technical fields.
$notification = build_notification_message([
    'source' => 'pre_assessment', 'created_at' => '2026-11-04T12:00:00Z',
    'name' => 'João Silva', 'email' => 'joao@example.com', 'phone' => '21992803268',
    'objective' => 'Qualidade de vida', 'experience' => 'Iniciante',
    'weekly_frequency' => '3 a 4 dias', 'training_place' => 'Academia', 'ip_hash' => 'secret-hash',
]);
assert_same('Nova pré-avaliação pelo site — Léo Nery', $notification['subject'], 'assessment notification subject');
assert_same(true, str_contains($notification['body'], 'Experiência: Iniciante'), 'assessment notification labels');
assert_same(false, str_contains($notification['body'], 'secret-hash'), 'assessment notification excludes IP hash');

echo "validation tests: ok\n";
