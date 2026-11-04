<?php
declare(strict_types=1);

require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/notifications.php';

// Este arquivo NÃO pode ficar dentro de public/ ou public_html/.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.cookie_secure', $https ? '1' : '0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, private');
header('Content-Security-Policy: default-src \'none\'; frame-ancestors \'none\'; base-uri \'none\'');
header('Content-Type: application/json; charset=UTF-8');
session_start();

function answer(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function assert_json_post_request(int $maxBytes = 12000): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        answer(405, ['ok' => false, 'message' => 'Método não permitido.']);
    }
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        answer(415, ['ok' => false, 'message' => 'Formato inválido.']);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $maxBytes) {
        answer(413, ['ok' => false, 'message' => 'Mensagem muito grande.']);
    }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') {
        answer(403, ['ok' => false, 'message' => 'Requisição não autorizada.']);
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $source = parse_url($origin, PHP_URL_HOST);
        $host = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
        if (!$source || strcasecmp((string) $source, $host) !== 0) {
            answer(403, ['ok' => false, 'message' => 'Origem não autorizada.']);
        }
    }
    $body = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($body === false || strlen($body) > $maxBytes) {
        answer(413, ['ok' => false, 'message' => 'Mensagem muito grande.']);
    }
    $data = json_decode($body, true);
    if (!is_array($data) || array_is_list($data)) {
        answer(400, ['ok' => false, 'message' => 'Dados inválidos.']);
    }
    return $data;
}

function assert_csrf_token(array $data): void {
    $token = $data['csrf_token'] ?? null;
    $expected = $_SESSION['csrf_token'] ?? null;
    if (!is_string($token) || !is_string($expected) || !hash_equals($expected, $token)) {
        answer(403, ['ok' => false, 'message' => 'Sessão expirada. Atualize a página e tente novamente.']);
    }
}

function settings(): array {
    $path = dirname(__DIR__) . '/config/settings.php';
    if (is_file($path)) {
        $value = require $path;
        return is_array($value) ? $value : [];
    }
    return [];
}

function private_storage(): string {
    $path = dirname(__DIR__) . '/storage';
    if (!is_dir($path)) {
        if (!mkdir($path, 0700, true) && !is_dir($path)) {
            throw new RuntimeException('Storage unavailable');
        }
    }
    return $path;
}

function app_secret(): string {
    $path = private_storage() . '/secret.key';
    if (!is_file($path)) {
        $handle = @fopen($path, 'x');
        if ($handle !== false) {
            try { fwrite($handle, bin2hex(random_bytes(32))); }
            finally { fclose($handle); @chmod($path, 0600); }
        }
    }
    $secret = @file_get_contents($path);
    if (!is_string($secret) || strlen($secret) < 64) throw new RuntimeException('Secret unavailable');
    return trim($secret);
}

function limit_by_ip(string $ip): bool {
    $key = hash_hmac('sha256', $ip, app_secret());
    $filename = private_storage() . '/rate-limit.json';
    $handle = fopen($filename, 'c+');
    if ($handle === false) throw new RuntimeException('Rate limit unavailable');
    try {
        if (!flock($handle, LOCK_EX)) throw new RuntimeException('Rate lock unavailable');
        $content = stream_get_contents($handle);
        $data = json_decode($content ?: '{}', true);
        if (!is_array($data)) $data = [];
        $now = time();
        foreach ($data as $hash => $times) {
            if (!is_array($times)) { unset($data[$hash]); continue; }
            $data[$hash] = array_values(array_filter($times, static fn ($t) => is_int($t) && $t >= $now - 86400));
            if (!$data[$hash]) unset($data[$hash]);
        }
        $times = $data[$key] ?? [];
        $recent = array_filter($times, static fn ($t) => $t > $now - 900);
        $allowed = count($recent) < 5 && count($times) < 20;
        if ($allowed) $data[$key][] = $now;
        rewind($handle);
        if (!ftruncate($handle, 0)) throw new RuntimeException('Rate truncate failed');
        if (fwrite($handle, json_encode($data)) === false) throw new RuntimeException('Rate write failed');
        fflush($handle);
        return $allowed;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
        @chmod($filename, 0600);
    }
}

function store_json_line(string $filename, array $record): void {
    if (!preg_match('/^[a-z0-9-]+\.jsonl$/', $filename)) {
        throw new InvalidArgumentException('Invalid storage filename');
    }
    $path = private_storage() . '/' . $filename;
    $handle = fopen($path, 'ab');
    if ($handle === false) throw new RuntimeException('Cannot open contacts store');
    try {
        if (!flock($handle, LOCK_EX)) throw new RuntimeException('Contacts lock unavailable');
        $entry = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        $written = fwrite($handle, $entry);
        if ($written === false || $written !== strlen($entry)) throw new RuntimeException('Contacts write failed');
        fflush($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
        @chmod($path, 0600);
    }
}

function store_contact(array $contact): void {
    store_json_line('contacts.jsonl', $contact);
}

function text_length(string $value): int {
    if (function_exists('mb_strlen')) return mb_strlen($value, 'UTF-8');
    $matched = preg_match_all('/./us', $value);
    return $matched === false ? 999999 : $matched;
}

function clean_line(string $value): string {
    return trim((string) preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value));
}

function notify_via_smtp(array $contact): void {
    $config = settings()['smtp'] ?? [];
    if (empty($config['enabled'])) return;
    $autoload = dirname(__DIR__) . '/vendor/autoload.php';
    if (!is_file($autoload)) {
        error_log('LeoNery: SMTP enabled but dependencies are not installed. Contact retained locally.');
        return;
    }
    require_once $autoload;
    try {
        $mailer = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mailer->isSMTP();
        $mailer->Host = (string) ($config['host'] ?? '');
        $mailer->SMTPAuth = true;
        $mailer->Username = (string) ($config['username'] ?? '');
        $mailer->Password = (string) ($config['password'] ?? '');
        $mailer->Port = (int) ($config['port'] ?? 587);
        $mailer->SMTPSecure = $mailer->Port === 465
            ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mailer->CharSet = 'UTF-8';
        $mailer->Timeout = 12;
        $mailer->setFrom((string) ($config['from_email'] ?? ''), (string) ($config['from_name'] ?? 'Site Léo Nery'));
        $mailer->addAddress((string) ($config['to_email'] ?? ''));
        $mailer->addReplyTo($contact['email'], $contact['name']);
        $mailer->isHTML(false);
        $notification = build_notification_message($contact);
        $mailer->Subject = $notification['subject'];
        $mailer->Body = $notification['body'];
        $mailer->send();
    } catch (Throwable $error) {
        // Evite mostrar detalhes SMTP, credenciais ou mensagens da exceção ao usuário.
        error_log('LeoNery: SMTP notification failed; contact stored safely.');
    }
}
