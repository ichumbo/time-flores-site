<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/private/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    answer(405, ['ok' => false, 'message' => 'Método não permitido.']);
}
if (!isset($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
answer(200, ['ok' => true, 'token' => $_SESSION['csrf_token']]);
