# VYZ · Pendências (fase 1: só front-end)

O que hoje funciona só no navegador e depende de backend, de integração ou de uma decisão. No produto, cada item aparece com um aviso discreto (`PendingChip`).

## Precisa de backend (Supabase)

| Item | Como está hoje | Aviso no produto |
|---|---|---|
| Login real (link mágico + Google) e proteção de `/painel` | Login real (link mágico + Google) e proteção de `/painel` via `proxy.ts` precisam do Supabase. Hoje `/painel` é aberto: `/entrar` só avisa e leva ao painel de demonstração; "Sair" volta para `/entrar` | "Login precisa do Supabase" (`/entrar`) e "Modo demonstração · dados neste navegador" (topo do painel) |
| Login, workspace e membros da equipe | Workspace único, salvo no navegador | "Precisa conectar Supabase" (topo do painel e Configurações) |
| Plano real da conta | Seletor "Simular plano" (Base, Pro, Avançado, Personalizado) | "Precisa conectar Supabase · o plano real virá da conta" |
| Persistência | `LocalStore` (localStorage, `vyz:v1:`). Trocar por `SupabaseStore` com a mesma interface `Store` (`src/lib/store/store.ts`) | — |
| Links compartilhados com dados reais | `/r/[id]#payload`: configuração comprimida no fragmento, dados de amostra | "Links com dados reais e revogação precisam do Supabase" |
| Revogar link | Vale só no navegador de quem revogou | idem |
| Relatórios agendados (PDF por e-mail, resumo no WhatsApp) | Agendamento salvo localmente, sem envio | "Envio agendado precisa de backend" |
| Histórico de exportações entre aparelhos | Só neste navegador | — |
| Dashboards e LPs em outro aparelho | Só neste navegador (o link público e a prévia de LP funcionam em qualquer um) | Estado vazio explica |

## Assistente VYZ

| Item | Como está hoje | Aviso no produto |
|---|---|---|
| `LlmEngine` (respostas abertas, via route handler no servidor) | Só o `LocalEngine`: intenções por palavra-chave, sem API. O ponto de troca está pronto em `features/agent/engine/index.ts` | "Motor local · dados da demo" no drawer |
| Persistência da conversa | Só na memória da aba; fechar a aba ou "limpar" apaga | — |
| Reconhecimento de voz em todos os navegadores | Web Speech API: funciona no Chrome e no Edge; no Firefox e em parte do Safari o microfone some e fica o texto | — |
| Dados reais nas respostas | Mesmos dados de amostra do painel (`datasetFor`) | "Amostra · dados fictícios" nos dashboards |

## Precisa de integração com as plataformas

| Item | Como está hoje | Aviso no produto |
|---|---|---|
| Conexão das contas (OAuth Meta, Google Ads, GA4, TikTok, LinkedIn, Mercado Ads, Shopee, CRMs) | Cadastro por ID com validação de formato; status "Aguardando conexão" | "Conexão automática (OAuth) em breve" |
| Dados reais nos widgets | `MockSource` determinística (seed por dashboard). Criar `DbSource` com a interface `DataSource` (`src/features/metrics/source.ts`) | "Dados reais precisam de conexão" + "Amostra · dados fictícios" |
| Venda deduplicada, CTR ponderado e maturação | Regras prontas em `features/metrics/compute.ts`, aplicadas aos dados de amostra | — |
| Análise por áudio | Página "em breve" | "em breve" |

## Métricas do dashboard ("Personalizar")

| Item | Como está hoje | O que falta |
|---|---|---|
| Alcance único do período (Meta) | "Alcance médio por dia": a média do alcance diário. A frequência é a média por dia (impressões ÷ alcance, dia a dia), coerente com ele | Pedir à Meta o alcance pelo intervalo inteiro: pessoas únicas não somam entre dias. Com isso dá para mostrar também a frequência do período |
| App mobile | Mostra os cards padrão e não respeita a personalização nem esconde as colunas | Ler `metric_prefs` em `/api/v1/dashboards/:id` e no app |
| Reordenar os cards | A ordem segue o padrão do template, e soltar um card só adiciona | Guardar a ordem no `metric_prefs` (hoje `normalizeSection` regrava na ordem do catálogo) |

## Precisa de hospedagem

| Item | Como está hoje | Aviso no produto |
|---|---|---|
| Publicar LP no subdomínio (`slug.vyz.app`) | Só a prévia em `/p/[id]#conteúdo` | "Publicação precisa de hospedagem" |
| Teste do disparo de GTM, Pixel e conversões | Só validação de formato dos IDs | "Teste do disparo precisa de publicação" |
| Domínio do site (`metadataBase`) | Não definido: a URL da imagem Open Graph sai relativa ao host | — |

## Decisões em aberto

- **Limites de quantidade por plano** (em `features/pricing/entitlements.ts`), definidos provisoriamente:
  - Dashboards: Base 2 (como na LP), Pro 10, Avançado 20, Personalizado 50.
  - Landing pages publicadas: Base 1, Pro 3, Avançado 10, Personalizado 10.
  - Contas contratadas: vêm do plano simulado (padrão 2, como na simulação da LP).
- **Subdomínio das LPs**: o painel mostra `slug.vyz.app` como exemplo; o domínio real ainda não existe.
- **Número de WhatsApp**: provisório (`WHATSAPP_NUMBER` em `features/pricing/pricing.ts`).
- **`robots: noindex`**: segue ligado em todas as áreas, com o `// TODO: remover no lançamento`.
- **Lighthouse mobile ≥ 90 na LP**: as medições locais oscilaram entre 83 e 93 (máquina carregada). O LCP real acontece na primeira pintura; a nota é puxada pelo JavaScript (React, runtime do Next e motion). Medir no PageSpeed depois do deploy.

## Criativos

- **Visitas ao perfil**: `insights_ad_daily.profile_visits` existe, mas o campo real na API da Meta ainda vai ser confirmado. Hoje só o gerador simulado preenche.
- **Fonte real**: as colunas novas de `insights_ad_daily`, `insights_campaign_daily` e `ads.post_url` só têm dados simulados até a importação real existir (`liveSource`, em `server/sync/source.ts`). Ao ligar: usar `readMetaActions` e confirmar se os percentuais de topo do Google vêm como fração (a coluna só aceita de 0 a 1).
- **Data de início do anúncio**: o banco não guarda. "Dias veiculados" e "Dia 1" valem dentro do período selecionado.

## Privacidade e exclusão de dados

| Item | Como está hoje | O que falta |
|---|---|---|
| Retenção dos eventos de pagamento | `billing_events` (Stripe) e `store_events` (App Store e Play Store) guardam o `payload` inteiro de cada webhook, que pode ter nome, e-mail e endereço de quem pagou. Não há prazo: nada apaga essas linhas, nem a exclusão de conta | Definir o prazo (o fiscal, 5 anos, ou menos se o payload não for prova fiscal) e incluir na rotina de manutenção, ou guardar só os campos necessários |
| "Excluir conta" no app | `prepare_account_deletion` passa a propriedade (ou encerra a assinatura) e tira a pessoa dos workspaces. Não apaga os workspaces de que ela era o único membro, nem revoga o acesso na Meta e no Google, nem remove os arquivos do Storage | Fazer o app seguir o mesmo caminho do script interno (`scripts/admin/delete-account-data.ts`): lógica em `server/admin/account-deletion.ts` e revogação em `server/admin/revoke-access.ts` |
| Prazo do aceite dos termos | A página `/exclusao-de-dados` diz que o aceite fica por até 5 anos, mas `legal_acceptances` não é particionada e nenhuma rotina apaga as linhas antigas (auditoria: 5 anos; atividade: 13 meses; acessos: 2 anos) | Apagar os aceites com mais de 5 anos na rotina de manutenção, ou ajustar o texto |
