<?php
declare(strict_types=1);

function build_notification_message(array $record): array
{
    $isAssessment = ($record['source'] ?? '') === 'pre_assessment';
    $subject = $isAssessment
        ? 'Nova pré-avaliação pelo site — Léo Nery'
        : 'Novo contato pelo site — Léo Nery';

    $lines = [
        $isAssessment ? 'Nova pré-avaliação recebida' : 'Novo formulário recebido',
        '',
        'Nome: ' . ($record['name'] ?? ''),
        'E-mail: ' . ($record['email'] ?? ''),
        'WhatsApp: ' . ($record['phone'] ?? ''),
    ];
    if ($isAssessment) {
        $lines[] = 'Objetivo: ' . ($record['objective'] ?? '');
        $lines[] = 'Experiência: ' . ($record['experience'] ?? '');
        $lines[] = 'Frequência semanal: ' . ($record['weekly_frequency'] ?? '');
        $lines[] = 'Local de treino: ' . ($record['training_place'] ?? '');
    } else {
        $lines[] = 'Objetivo: ' . ($record['goal'] ?? '');
        $lines[] = 'Mensagem: ' . ($record['message'] ?? '');
    }
    $lines[] = 'Data UTC: ' . ($record['created_at'] ?? '');

    return ['subject' => $subject, 'body' => implode("\n", $lines) . "\n"];
}
