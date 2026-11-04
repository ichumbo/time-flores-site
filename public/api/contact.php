<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/private/bootstrap.php';
$data = assert_json_post_request();
assert_csrf_token($data);
if (!empty($data['company_website'])) {
    // Honeypot: resposta genérica para não fornecer feedback a robôs.
    answer(200, ['ok' => true, 'message' => 'Recebido.']);
}
try {
    $validated = validate_contact_payload($data);
} catch (InvalidArgumentException $error) {
    answer(422, ['ok' => false, 'message' => $error->getMessage()]);
}
try {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!limit_by_ip($ip)) {
        header('Retry-After: 900');
        answer(429, ['ok' => false, 'message' => 'Muitas tentativas. Aguarde um pouco e tente novamente.']);
    }
    $contact = [
        'id' => bin2hex(random_bytes(12)),
        'created_at' => gmdate('c'),
        'source' => 'contact',
        'name' => $validated['name'],
        'email' => $validated['email'],
        'phone' => $validated['phone'],
        'goal' => $validated['goal'],
        'message' => $validated['message'],
        'privacy_consent' => $validated['privacy_consent'],
        'ip_hash' => hash_hmac('sha256', $ip, app_secret())
    ];
    store_contact($contact);
    unset($_SESSION['csrf_token']);
    session_write_close();
    notify_via_smtp($contact);
    answer(200, ['ok' => true, 'message' => 'Mensagem recebida com sucesso!']);
} catch (Throwable $error) {
    error_log('LeoNery: Contact form storage failure.');
    answer(500, ['ok' => false, 'message' => 'Não conseguimos registrar sua mensagem agora. Tente novamente.']);
}
