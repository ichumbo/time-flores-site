# Léo Nery — Nutrição Esportiva

## O que está pronto
- Identidade visual azul, layout responsivo desktop/tablet/mobile e Política de Privacidade.
- Seções preservadas: início, sobre, metodologia, resultados e equipe; novas áreas de planos, FAQ e contato orientado a conversão.
- Formulário direto como contato principal e pré-avaliação opcional em três etapas dentro de um modal separado.
- WhatsApp no menu, hero, planos, FAQ, contato, rodapé e botão flutuante. Cada plano abre uma mensagem com período e valor identificados.
- Efeitos de entrada em rolagem (`IntersectionObserver`), barra de progresso, texto em movimento, menu mobile, accordion acessível e respeito a `prefers-reduced-motion`.
- Dois fluxos reais com validação no navegador e servidor, token CSRF, honeypot, verificação de origem, rate limit, consentimento e armazenamento privado.
- Notificação por e-mail via SMTP opcional (PHPMailer). Sem SMTP, os contatos ficam em `storage/contacts.jsonl` e as pré-avaliações em `storage/pre-assessments.jsonl`; nenhum deles deve ser publicado.

## Testar localmente
Requisitos: PHP >= 8.1. A partir da raiz do projeto:

```bash
php -S 127.0.0.1:8000 -t public
```

Abra `http://127.0.0.1:8000` (não abra `index.html` com `file://`, porque os formulários exigem servidor PHP). Envie testes isolados e confira `storage/contacts.jsonl` e `storage/pre-assessments.jsonl`. Os arquivos são criados no primeiro envio e precisam de permissão de escrita.

## Configurar o WhatsApp

O número e as mensagens públicas ficam centralizados em `public/assets/js/site-config.js`. O número atual é `5521992803268` (`+55 21 99280-3268`). Use somente dígitos no formato internacional ao alterar. Se o número não passar pela validação brasileira do módulo, os CTAs deixam de ficar ativos em vez de abrir um link fictício.

Os preços e períodos de cada plano ficam nos atributos `data-plan-months` e `data-plan-value` dos cards em `public/index.html`; o JavaScript usa esses dados para montar a mensagem correta.

## Ativar notificação por e-mail
1. Instale o Composer no ambiente de desenvolvimento/servidor e rode `composer install --no-dev --optimize-autoloader` na raiz do projeto.
2. Copie `config/settings.example.php` para `config/settings.php`.
3. Preencha host, porta, login e senha SMTP, endereço de origem e destino. Mude `enabled` para `true`.
4. Envie um teste em cada fluxo. Se o SMTP falhar, o registro continua salvo no arquivo privado correspondente, mas o e-mail não é enviado. Confira o log de erros do PHP.
5. Nunca deixe credenciais SMTP no JavaScript ou em `public/`.

## Publicar em hospedagem/cPanel
A **document root** do site deve apontar para a pasta `public/`. Mantenha `private/`, `config/`, `storage/`, `vendor/`, `scripts/` e `composer.json` fora de `public/` e `public_html/`. Em cPanel, se não for possível mudar a raiz, coloque apenas o conteúdo de `public/` em `public_html/` e ajuste os caminhos `require_once dirname(__DIR__, 2)` de `api/*.php` para o caminho absoluto correto da pasta privada acima de `public_html`.

Ative HTTPS válido, PHP 8.1+ e permissões de escrita para `storage/`. Não faça upload do arquivo `config/settings.php` em repositórios públicos. Configure backups seguros e retenção periódica dos dados pessoais.

## Substituir as imagens
A foto principal do hero já utiliza `public/assets/images/hero-1.png` (`1080 x 1350 px`). Para os demais blocos, sobreponha as imagens `.webp` em `public/assets/images/` mantendo estes nomes (ou atualize o `src` no HTML):

- `sobre.webp` — imagem do time, recomendação 1000 x 1200 px
- `resultado-1.webp`, `resultado-2.webp`, `resultado-3.webp` — 900 x 1100 px
- `equipe-1.webp`, `equipe-2.webp` — 720 x 900 px

Os arquivos `.webp` restantes são apenas **marcadores visuais**. Enquanto as fotos definitivas não chegam, os seis blocos restantes usam a identidade Léo Nery por meio do atributo `data-brand-placeholder`. Ao substituir um marcador por uma fotografia real, remova esse atributo do bloco correspondente para revelar a foto em cores.

A logo oficial está em `public/assets/images/logo.png` e o favicon ativo em `public/assets/images/favicon.png`.

## Exportar as mensagens recebidas
No terminal da hospedagem (não pela web):

```bash
php scripts/exportar-contatos.php > contatos.csv
```

O script atual exporta apenas o formulário direto. Guarde o CSV de maneira segura: ele contém dados pessoais. As pré-avaliações permanecem em `storage/pre-assessments.jsonl` até que exista uma rotina de exportação específica.

## Rodar os testes

```bash
php tests/validation_test.php
bash tests/contact_http_test.sh
bash tests/http_forms_test.sh
node --test tests/whatsapp_config_test.js tests/frontend_contract_test.js tests/browser_layout_test.js
php tests/site_contract_test.php
```

Os testes HTTP usam uma cópia temporária do projeto e não escrevem nos arquivos reais de contatos. O teste de layout usa o Google Chrome local em modo headless quando ele está disponível.

## Pontos pendentes para publicação
- Revisar identidade visual e ordem das seções com capturas de tela do site de referência; a página original não estava acessível na data de criação.
- Trocar fotos e informações de exemplo. Não publicar resultados ou depoimentos não autorizados.
- Completar a Política de Privacidade com dados reais do controlador, canal LGPD e prazos de retenção.
- Testar SMTP no provedor final, backup, HTTPS, proteção de pastas e políticas de exclusão dos leads.
- Recomendação para campanhas públicas: configurar também Cloudflare Turnstile e WAF, se necessário.

## Segurança — observações
Uma landing page com apenas HTML, CSS e JS não pode guardar credenciais nem processar com segurança um formulário por conta própria. Por isso o formulário usa PHP server-side. Os dados não são enviados para serviços terceiros sem que você configure o SMTP. O rate limit usa o IP visto pelo servidor; caso use proxy/CDN, ajuste a identificação do IP **somente** após configurar uma lista confiável de endereços do proxy para evitar spoofing.
