# Exclusão de dados: passo a passo

Como atender um pedido de exclusão total que chega pela página pública `/exclusao-de-dados`
(e-mail para o suporte com o assunto "Exclusão de dados"). Prazo de resposta: **30 dias**.

O trabalho é feito pelo script `scripts/admin/delete-account-data.ts` (lógica em
`src/server/admin/account-deletion.ts`). Ele roda em dois tempos: primeiro uma **simulação**, que
só lê; depois a **exclusão**, que só acontece com o e-mail repetido e o código da simulação.

## Antes de começar

- Quem roda: alguém com acesso à senha do banco de produção e à chave de serviço do Supabase.
- O script **não lê o `.env.local`**. O banco é escolhido na hora, por variáveis só dele:

| Variável | Para quê | Obrigatória |
| --- | --- | --- |
| `DELETE_ACCOUNT_DB_URL` | conexão direta com o Postgres (a string de conexão do painel do Supabase) | sim |
| `DELETE_ACCOUNT_SUPABASE_URL` | URL do projeto, para remover os arquivos do Storage | na exclusão |
| `DELETE_ACCOUNT_SERVICE_ROLE_KEY` | chave de serviço, para o Storage | na exclusão |
| `DELETE_ACCOUNT_META_APP_SECRET` | segredo do app da Meta, para a prova (`appsecret_proof`) que a Meta exige quando "Exigir segredo do app" está ligado | na exclusão, se houver conexão Meta |

- A primeira linha da saída é sempre o endereço do banco (`Banco: ...`). Confira antes de seguir.
- Confirme a identidade: o pedido precisa vir do e-mail da conta. Se veio de outro endereço, peça
  a confirmação a partir do e-mail da conta antes de rodar qualquer coisa.

## 1. Simulação

```sh
DELETE_ACCOUNT_DB_URL='postgres://...' \
  npm run admin:delete-account -- --email pessoa@exemplo.com
```

A transação é aberta como `read only`: nada é gravado. O relatório tem cinco partes:

- **O QUE SERÁ APAGADO**: perfil e login, tokens de push, WhatsApp, créditos, convites para o
  e-mail, compras não concluídas e o e-mail/telefone da pessoa como destinatário de relatórios
  (inclusive em workspaces de outras pessoas).
- **WORKSPACES**: cada workspace de que a pessoa participa, com o destino dele (veja abaixo) e a
  contagem do que sai, por tipo: métricas e contas de anúncio, tokens e conexões, dashboards,
  projetos, landing pages e leads, otimizações, tarefas, WhatsApp, assinatura, arquivos no Storage.
- **O QUE FICA**: faturas, pagamentos e registros de acesso aparecem sempre, mesmo zerados; os
  históricos imutáveis aparecem quando há linhas. Cada item traz o motivo e o prazo.
- **ACESSO A REVOGAR NA ORIGEM**: as conexões reais (Meta e Google) dos workspaces que saem. As
  conexões simuladas ficam de fora.
- **AVISOS**: por exemplo, propriedade que vai passar a outro membro, ou uma conexão que fica com
  a equipe mas usa o acesso da pessoa (feita por ela, ou do mesmo login da Meta que será revogado:
  a Meta revoga o app para o login inteiro). Avise a equipe para reconectar com outra conta.
- **BLOQUEIOS**: o que impede a exclusão (veja o passo 2).

No fim vem o código da simulação (8 caracteres) e o comando pronto para apagar.

Uma linha **"Sem classificação (tabela)"** quer dizer que entrou no banco uma tabela nova que o
script não conhece. Não siga: classifique a tabela em `account-deletion.ts` (o teste
`a cobertura do banco` aponta qual) e rode de novo. Mesmo que alguém siga, a conferência final
acha a sobra e desfaz tudo.

## 2. Bloqueios

O script se recusa a apagar enquanto houver bloqueio, mesmo com a confirmação certa.

- **Assinatura viva num provedor real** (Stripe, App Store, Play Store) em workspace que sai junto
  com a pessoa. Apagar no banco não para a cobrança lá. Cancele no painel do provedor, espere o
  webhook marcar a assinatura como cancelada e rode a simulação de novo.

## 3. Exclusão

```sh
DELETE_ACCOUNT_DB_URL='postgres://...' \
DELETE_ACCOUNT_SUPABASE_URL='https://<projeto>.supabase.co' \
DELETE_ACCOUNT_SERVICE_ROLE_KEY='...' \
DELETE_ACCOUNT_META_APP_SECRET='...' \
  npm run admin:delete-account -- --email pessoa@exemplo.com \
    --apply --confirmar pessoa@exemplo.com --codigo abcd1234
```

- Sem `--confirmar` com o mesmo e-mail, ou com o código errado, o script recusa e não apaga nada.
- O plano é refeito dentro da transação. Se algo relevante mudou desde a simulação (um workspace
  novo, uma fatura nova, outro membro), o código muda e o script recusa: rode a simulação de novo
  e leia o que mudou. Métricas novas da sincronização não mudam o código.
- Depois da confirmação e antes de apagar os tokens, o script tenta **revogar o acesso do app na
  origem**: na Meta, `DELETE /me/permissions` com o token da conexão; no Google, o endpoint de
  revogação com o refresh token (que derruba também os de acesso). Se uma revogação falhar, a
  exclusão segue e a falha aparece no fim, em "NÃO REVOGADO", com o motivo (veja o passo 4). O
  motivo nunca mostra o token.
- Tudo no banco roda numa transação só. No fim, uma conferência procura qualquer linha que ainda
  aponte para a pessoa ou para os workspaces apagados; se achar, desfaz tudo.

### Saídas

| Código | O que quer dizer |
| --- | --- |
| 0 | Concluído: banco e Storage. |
| 1 | Recusado ou erro. **Nada foi apagado.** |
| 2 | O banco foi apagado, mas falta algo à mão: acesso não revogado na origem (passo 4) ou arquivos no Storage (a lista aparece na tela: remova no painel do Supabase, Storage → `brand-assets`). |

Se o banco desfizer a transação depois da revogação (por exemplo, a conferência final achou sobra),
o script avisa o que já foi revogado: isso não volta, mas a pessoa pediu a exclusão de qualquer
jeito. Corrija e rode de novo.

## 4. O que não foi revogado

O token já foi apagado junto com a conexão, então ninguém aqui consegue tentar de novo. Para cada
linha em "NÃO REVOGADO":

- **Meta** com `code=190` (token vencido ou já revogado): o app não tem mais acesso por esse token.
  Ainda assim, o app pode continuar listado nas configurações da pessoa. Na resposta, peça que ela
  remova o app em Configurações → Apps e sites (o passo 1 da página pública).
- **Meta** com outro código, ou sem resposta: anote o motivo e peça à pessoa que remova o app como
  acima. Se for token de usuário do sistema, a integração sai pelo Business Manager da empresa dela.
- **Google**: peça que ela remova o acesso em myaccount.google.com/permissions (Apps de terceiros
  com acesso à conta).

## 5. Fora do script

- **Provedores de pagamento**: o cliente na Stripe (e nas lojas) não é apagado pelo script. Os
  dados fiscais lá seguem a mesma regra dos daqui.

## 6. Resposta ao titular

Responda do e-mail do suporte, dentro dos 30 dias, por exemplo:

> Concluímos a exclusão dos dados da conta pessoa@exemplo.com em DD/MM/AAAA. Foram apagados o
> perfil e o login, os tokens de acesso às plataformas conectadas, os dados das contas de anúncio,
> os dashboards, projetos, landing pages, otimizações e tarefas dos workspaces de que você era o
> único membro, o WhatsApp cadastrado e os tokens de notificação. Também revogamos o acesso do
> Vyzualize às suas contas da Meta e do Google.
>
> Por obrigação legal, guardamos as faturas e os dados fiscais pelo prazo da legislação tributária
> (em geral, 5 anos), os registros de acesso pelo prazo do Marco Civil da Internet e, por
> segurança, por até 5 anos, o histórico de auditoria, o de atividade e o registro de aceite dos
> termos. Esses dados
> não são usados para nenhuma outra finalidade e são apagados ao fim dos prazos.

Se alguma revogação falhou, troque a última frase pelo pedido do passo 4. Se a pessoa era dona
de um workspace com equipe, acrescente que o acesso dela foi removido, que a
propriedade passou a outro membro e que os dados do workspace continuam com a equipe.

## O que acontece com cada workspace

| Situação | Destino |
| --- | --- |
| Tem outros membros | **Fica com a equipe.** A pessoa sai; se era a única dona, a propriedade passa ao membro mais antigo (admin antes de member), pela função `prepare_account_deletion`. |
| Único membro, sem fatura nem pagamento | **Apagado por inteiro.** O resto sai em cascata. |
| Único membro, com fatura ou pagamento | **Vira casca.** Todo o conteúdo é apagado; a linha do workspace fica, anonimizada (nome "Conta excluída", slug `excluida-...`, sem logo), segurando as faturas. |

### Por que a casca

`invoices` e `payment_transactions` apontam para `workspaces` com `on delete restrict`: o banco
não deixa apagar um workspace que tenha fatura ou pagamento, e a lei manda guardar os dois. O
script não muda essa regra nem desliga gatilho nenhum. Ele apaga, numa ordem fixa
(`SHELL_PURGE_ORDER`), tudo o que há dentro do workspace, menos o fiscal, e anonimiza a linha que
sobra. As faturas ficam ligadas à casca, não à pessoa.

### Depois do prazo fiscal

O script não trata disso. Quando vencer o prazo das faturas de uma casca, apague, nesta ordem:
`payment_transactions` do workspace, `invoices` do workspace e, por fim, o workspace (o resto sai
em cascata). Antes, confira as permissões dessas tabelas e faça uma simulação em transação com
rollback.

## O que fica, e por quê

| Tabela | Motivo | Prazo |
| --- | --- | --- |
| `invoices`, `payment_transactions` | legislação tributária | em geral, 5 anos |
| `billing_customers` (só nas cascas) | dados fiscais do contratante | idem |
| `checkout_sessions` concluídas | compra com CPF ou CNPJ; o vínculo com a pessoa vira nulo | idem |
| `auth_events` | registros de acesso, Marco Civil (mínimo de 6 meses) | apagados em 2 anos |
| `audit_events` | auditoria, com cópia das linhas apagadas (inclusive desta exclusão) | apagados em 5 anos |
| `activity_events` | histórico de atividade | apagados em 13 meses |
| `legal_acceptances` | prova de aceite dos termos | histórico imutável |
| `subscription_changes` | histórico de assinatura | histórico imutável |

Os prazos são aplicados pela rotina de manutenção, que derruba as partições antigas.

## Como foi testado

Tudo roda no `npm test`:

- `src/server/admin/account-deletion.test.ts`: classificação, confirmação, relatório e a cobertura
  do banco (toda tabela com `workspace_id` nas migrações precisa ter destino no script).
- `src/server/admin/account-deletion.db.test.ts`: num Postgres em memória (PGlite) com as migrações
  reais, os cenários de único membro com e sem fatura, dono com equipe, o mesmo login da Meta num
  workspace que fica, assinatura viva, tabela nova sem classificação (desfaz tudo), revogação que
  falha (a exclusão segue) e um terceiro que não pode ser afetado.
- `src/server/admin/revoke-access.test.ts`: as chamadas à Meta e ao Google com respostas simuladas
  (sucesso, token vencido, rede fora, tempo esgotado) e o motivo sem o token.

A CLI de ponta a ponta (com o cliente `postgres` de verdade, ligado ao Postgres em memória por um
socket) foi conferida à parte, fora do repositório: recusas, bloqueio, revogação com e sem sucesso
e falha do Storage.
- **Não testado contra o Supabase de verdade, nem contra a Meta e o Google de verdade.** O banco
  de teste simula `auth`, `vault` e `storage`; os provedores, as respostas. Na primeira vez em produção, rode só a simulação e confira as contagens à mão.
