<?php
declare(strict_types=1);

function validation_text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    $matched = preg_match_all('/./us', $value);
    return $matched === false ? PHP_INT_MAX : $matched;
}

function validation_clean_line(string $value): string
{
    return trim((string) preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value));
}

function normalize_brazilian_phone(string $value): ?string
{
    $trimmed = trim($value);
    if ($trimmed === '' || !preg_match('/^[0-9\s().-]+$/D', $trimmed)) {
        return null;
    }
    $digits = preg_replace('/\D+/', '', $trimmed);
    if (!is_string($digits) || !preg_match('/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/', $digits)) {
        return null;
    }
    return $digits;
}

function validation_required_string(array $data, string $key): string
{
    if (!array_key_exists($key, $data) || !is_string($data[$key])) {
        throw new InvalidArgumentException('Revise os campos do formulário.');
    }
    return $data[$key];
}

function validation_identity_fields(array $data): array
{
    $name = validation_clean_line(validation_required_string($data, 'name'));
    $email = trim(validation_required_string($data, 'email'));
    $phone = normalize_brazilian_phone(validation_required_string($data, 'phone'));

    if (validation_text_length($name) < 2 || validation_text_length($name) > 120
        || !preg_match('//u', $name)
        || strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)
        || $phone === null) {
        throw new InvalidArgumentException('Verifique nome, e-mail e WhatsApp.');
    }
    if (($data['privacy'] ?? false) !== true) {
        throw new InvalidArgumentException('É necessário concordar com a Política de Privacidade.');
    }

    return ['name' => $name, 'email' => $email, 'phone' => $phone, 'privacy_consent' => true];
}

function validate_contact_payload(array $data): array
{
    $identity = validation_identity_fields($data);
    $goal = validation_required_string($data, 'goal');
    $message = trim(str_replace(["\r\n", "\r"], "\n", validation_required_string($data, 'message')));
    $allowedGoals = ['Hipertrofia', 'Condicionamento', 'Preparação esportiva', 'Qualidade de vida', 'Outro'];

    if (!in_array($goal, $allowedGoals, true) || validation_text_length($message) > 1500 || !preg_match('//u', $message)) {
        throw new InvalidArgumentException('Verifique seu objetivo e a mensagem.');
    }

    return $identity + ['goal' => $goal, 'message' => $message];
}

function validate_pre_assessment_payload(array $data): array
{
    $identity = validation_identity_fields($data);
    $objective = validation_required_string($data, 'objective');
    $experience = validation_required_string($data, 'experience');
    $weeklyFrequency = validation_required_string($data, 'weekly_frequency');
    $trainingPlace = validation_required_string($data, 'training_place');

    $allowedObjectives = ['Hipertrofia', 'Condicionamento', 'Preparação esportiva', 'Qualidade de vida', 'Outro'];
    $allowedExperience = ['Iniciante', 'Intermediário', 'Avançado'];
    $allowedFrequency = ['1 a 2 dias', '3 a 4 dias', '5 ou mais dias'];
    $allowedPlaces = ['Academia', 'Casa', 'Ao ar livre', 'Outro'];

    if (!in_array($objective, $allowedObjectives, true)
        || !in_array($experience, $allowedExperience, true)
        || !in_array($weeklyFrequency, $allowedFrequency, true)
        || !in_array($trainingPlace, $allowedPlaces, true)) {
        throw new InvalidArgumentException('Revise as respostas da pré-avaliação.');
    }

    return $identity + [
        'objective' => $objective,
        'experience' => $experience,
        'weekly_frequency' => $weeklyFrequency,
        'training_place' => $trainingPlace,
    ];
}
