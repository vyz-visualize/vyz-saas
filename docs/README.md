# VYZ · Documentação

Comece pela **ARQUITETURA**. O código é a fonte da verdade: se um documento discordar dele, corrija o documento.

| Documento | O que cobre | Quando ler |
|---|---|---|
| [ARQUITETURA.md](ARQUITETURA.md) | Produtos e planos, rotas, pastas, interface do painel, cobrança, variáveis e comandos | Antes de mexer em qualquer coisa |
| [BANCO.md](BANCO.md) | Todas as migrations, RLS, limites do plano no banco, histórico, jobs e segurança | Antes de criar migration ou tabela |
| [PLATAFORMAS.md](PLATAFORMAS.md) | Situação de cada plataforma (no ar ou em desenvolvimento), como configurar cada login, importação por planilha e otimizações | Ao ligar uma plataforma ou mudar `connection-modes.ts` |
| [TEMPLATES.md](TEMPLATES.md) | Como um dashboard é montado (visual × objetivo), criar visual, objetivo ou template de LP, orgânico e Fachada | Ao criar ou mudar modelos |
| [MOBILE.md](MOBILE.md) | App nativo: arquitetura, planos na loja, builds locais e checklist de envio | Antes de mexer no app ou enviar build |
| [WHATSAPP.md](WHATSAPP.md) | Relatórios pelo WhatsApp: templates do Meta, configuração e funcionamento | Ao configurar ou mudar os relatórios |
| [LANCAMENTO.md](LANCAMENTO.md) | Checklist para ligar a Stripe no modo live e o que muda no lançamento | No dia do lançamento da cobrança |
| [EXCLUSAO-DE-DADOS.md](EXCLUSAO-DE-DADOS.md) | Passo a passo para atender um pedido de exclusão total de dados | Ao receber um pedido de exclusão |
| [MMM.md](MMM.md) | Desenho do armazém de dados de mídia para o MMM, decisões e o que falta decidir | Antes de mexer no schema `mmm` ou na carga do histórico |
| [PENDENCIAS.md](PENDENCIAS.md) | O que ainda falta: aprovações, credenciais, decisões e código | Para saber o que está aberto; apague o item quando ficar pronto |
| [SIDEBAR-MODELO.md](SIDEBAR-MODELO.md) | Referência histórica da sidebar de vidro do CAP Manager (não é a do VYZ) | Só por curiosidade; o menu atual está na ARQUITETURA |

Fora desta pasta:

- `apps/mobile/README.md`: como rodar o app.
- `apps/mobile/store/LOJAS.md`: tudo para publicar nas lojas.
- `.env.example`: todas as variáveis de ambiente, comentadas.

Regras para escrever aqui: português, curto, sem segredo nem conteúdo de chave, e sem fato que não esteja no código ou confirmado.
