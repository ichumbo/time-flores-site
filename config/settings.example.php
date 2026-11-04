<?php
// COPIE para settings.php, preencha seus dados e NÃO envie o arquivo para repositório público.
// A pasta config/ deve ficar FORA da pasta pública do servidor.
return [
    'smtp' => [
        'enabled' => false, // true depois de preencher SMTP e executar composer install
        'host' => 'smtp.seuprovedor.com.br',
        'port' => 587, // 587 STARTTLS ou 465 TLS implícito
        'username' => 'contato@seudominio.com.br',
        'password' => 'SENHA_DE_APP_OU_SMTP',
        'from_email' => 'contato@seudominio.com.br',
        'from_name' => 'Site Léo Nery',
        'to_email' => 'contato@seudominio.com.br',
    ],
];
