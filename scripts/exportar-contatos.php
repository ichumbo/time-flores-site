<?php
declare(strict_types=1);
// Executar APENAS via terminal: php scripts/exportar-contatos.php > contatos.csv
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$file = dirname(__DIR__) . '/storage/contacts.jsonl';
if (!is_file($file)) { fwrite(STDERR, "Nenhum contato encontrado.\n"); exit(1); }
$out = fopen('php://stdout', 'w');
fputcsv($out, ['data', 'nome', 'email', 'whatsapp', 'objetivo', 'mensagem'], ';');
$in = fopen($file, 'rb');
while (($line = fgets($in)) !== false) {
    $v = json_decode($line, true);
    if (!is_array($v)) continue;
    $cols = [];
    foreach (['created_at', 'name', 'email', 'phone', 'goal', 'message'] as $key) {
        $value = (string) ($v[$key] ?? '');
        // Impede fórmula injetada ao abrir o CSV em planilhas.
        if (preg_match('/^[\s]*[=+\-@]/u', $value)) $value = "'" . $value;
        $cols[] = $value;
    }
    fputcsv($out, $cols, ';');
}
fclose($in);
fclose($out);
