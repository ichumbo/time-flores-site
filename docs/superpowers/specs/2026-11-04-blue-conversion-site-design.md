# Time Flores — reestruturação azul orientada a conversão

**Data:** 4 de novembro de 2026  
**Status:** aprovado por direção autônoma do cliente  
**Base visual:** requisitos textuais fornecidos. As quatro capturas citadas não estavam presentes no anexo, portanto a fidelidade será aferida contra a composição, hierarquia, paleta e proporções descritas.

## Objetivo

Reestruturar a landing page existente sem trocar a stack HTML/CSS/JavaScript/PHP e sem remover seções úteis. O resultado deve deixar dois caminhos primários inequívocos — formulário direto e WhatsApp — enquanto a pré-avaliação de três etapas permanece um fluxo secundário, voluntário e visualmente separado.

## Decisões de experiência

1. O formulário direto continua exposto na seção `07 / FAÇA PARTE` e é o principal mecanismo de captura no site.
2. WhatsApp é a alternativa imediata. O número centralizado será `5521992803268`, exibido como `+55 21 99280-3268`.
3. A pré-avaliação será criada como modal acessível de três etapas, aberta somente por botões secundários identificados como “Iniciar pré-avaliação”. Ela não aparecerá como um segundo formulário completo na página.
4. Os cinco planos abrem o WhatsApp com plano e valor preenchidos automaticamente. Não haverá checkout.
5. O conteúdo existente de quem somos, metodologia, resultados e equipe será preservado. A ordem será ajustada para manter a sequência: planos `04`, FAQ `05`, equipe `06`, contato `07`.

## Design visual

- Paleta exclusiva em azul, centralizada em variáveis CSS: `#050B18`, `#091529`, `#0D1D36`, `#087CFF`, `#249DFF`, `#64BCFF`, `#24415F`, `#F5F9FF`, `#A8B9CC`.
- Fundos sólidos, bordas discretas, sem gradientes e sem efeitos neon.
- `Barlow Condensed` permanece nos títulos expressivos; `DM Sans` permanece na interface e no texto corrido.
- Componentes usam cantos discretos, foco visível, contraste AA, áreas de toque de pelo menos 44 px e animação restrita a `opacity` e `transform`.
- A página continuará responsiva. Os planos formarão cinco colunas em telas largas, grade em tablets e carrossel horizontal com `scroll-snap` e indicação visual no celular.

## Estrutura da página

### Header e hero

O header mantém a marca e navegação. O CTA principal vai para o contato; um CTA de WhatsApp também fica disponível no desktop e no menu móvel. No hero, o botão primário leva ao formulário direto e o secundário abre WhatsApp. A linguagem visual atual é preservada, convertida para azul.

### Planos

Nova seção `04 / PLANOS E INVESTIMENTO` com cinco cards:

- 1 mês — R$ 385,00
- 2 meses — R$ 700,00
- 3 meses — R$ 899,00
- 4 meses — R$ 1.120,00
- 5 meses — R$ 1.250,00

Cada card inclui cinco segmentos de duração, preço e CTA. O CTA recebe dados do próprio card e delega a montagem da URL ao módulo central de WhatsApp. A faixa de pagamento informa PIX e cartão e alerta sobre possíveis juros sem prometer condições.

### FAQ

Layout em duas colunas. À esquerda ficam título, descrição e card de WhatsApp. À direita ficam nove itens de accordion. Respostas existentes serão reaproveitadas quando aplicáveis; onde faltarem informações comerciais, a resposta orientará confirmação com a equipe sem inventar prazo, cobertura ou promessa. Somente um item permanecerá aberto, com `aria-expanded`, controle por teclado e transição de altura.

### Contato principal

Composição em duas colunas. À esquerda ficam o título “PRONTO PARA O PRÓXIMO PASSO?”, explicação, divisor e botões para WhatsApp e pré-avaliação. À direita permanece o formulário direto com nome, e-mail, WhatsApp, objetivo, mensagem opcional e consentimento.

O endpoint atual `/api/contact.php` será preservado e reforçado. O frontend continuará obtendo CSRF de `/api/csrf.php`, bloqueará envio duplicado, mostrará carregamento e só exibirá sucesso após confirmação do servidor.

### Pré-avaliação em três etapas

Modal com diálogo semântico, fechamento por botão, `Escape` e clique no backdrop, foco inicial e restauração de foco ao fechar. O fluxo coleta apenas:

1. objetivo e experiência;
2. rotina semanal e local de treino;
3. nome, e-mail, WhatsApp e consentimento.

Cada etapa valida seus próprios campos. A última etapa exibe claramente que o envio ocorrerá. O endpoint separado `/api/pre-assessment.php` usará o mesmo CSRF, proteção de origem, honeypot, rate limit, armazenamento privado e notificação SMTP do contato. O registro terá `source: pre_assessment` e campos próprios; o contato direto terá `source: contact`.

## Configuração de WhatsApp

`public/assets/js/site-config.js` será a única fonte pública do número e das mensagens. Todos os links usarão `https://wa.me/`, `encodeURIComponent`, `target="_blank"` e `rel="noopener noreferrer"`. O script desabilitará/ocultará CTAs se o número configurado não for válido; no estado atual ele estará válido.

## Backend, dados e segurança

- Extrair validações de requisição repetidas para funções pequenas em `private/bootstrap.php`, sem quebrar o endpoint atual.
- Validar telefone brasileiro com 10 ou 11 dígitos no navegador e no PHP.
- Manter limite de corpo, cabeçalhos JSON, verificação de origem, CSRF, honeypot, rate limit, logs sem dados sensíveis e arquivos privados com permissões restritas.
- Não enviar credenciais ao navegador. SMTP continua opcional em `config/settings.php`.
- O formulário de pré-avaliação será salvo em `storage/pre-assessments.jsonl`; o contato continua em `storage/contacts.jsonl`.
- Atualizar a política para descrever os dados adicionais da pré-avaliação sem declarar informações empresariais ainda não fornecidas.

## JavaScript

O script continuará sem dependências. Responsabilidades:

- progresso, estado do header, navegação móvel e reveals;
- configuração e abertura segura do WhatsApp;
- accordion de abertura única;
- formulário direto e máscara de telefone;
- modal e estado do wizard;
- submissão dos dois fluxos com CSRF renovável e bloqueio de duplicação.

Funções comuns de telefone, status, CSRF e POST JSON serão reutilizadas para evitar duplicação.

## Tratamento de erro

- Falha ao buscar CSRF: mensagem no respectivo formulário, sem falsa confirmação.
- Erro 403: renovar token e pedir nova tentativa.
- Erro 422: manter dados e indicar revisão.
- Erro 429: informar limite temporário.
- Erro 500 ou rede: mensagem genérica; detalhes somente no log do servidor.
- WhatsApp inválido: CTAs não ficam ativos.

## Testes e critérios de aceite

- Lint de sintaxe PHP em todos os arquivos PHP e validação básica de HTML/JS.
- Testes HTTP locais para CSRF, contato válido/inválido e pré-avaliação válida/inválida.
- Conferência dos cinco links de plano e suas mensagens.
- Teste de accordion, modal, navegação por teclado, foco e `prefers-reduced-motion`.
- Verificação visual em larguras de desktop, tablet e celular, sem overflow horizontal.
- Auditoria final com `21st review` quando suportado pela ferramenta.
- Nenhum botão fictício, link quebrado, erro de console ou perda do fluxo atual.

## Fora de escopo

- Checkout, cobrança e integração com provedor financeiro.
- Promessas de prazo, resultado ou cobertura não fornecidas.
- Substituição das imagens provisórias.
- Preenchimento dos dados legais do controlador na política de privacidade.
