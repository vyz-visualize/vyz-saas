import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY as C, controllerText } from "@/features/legal/company";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a Vyzualize coleta, usa, guarda e protege seus dados, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
};

// Medição de anúncios no site público: só com os IDs configurados no build.
const siteTags = !!(process.env.NEXT_PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID);

export default function Privacidade() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: {C.updatedAt}.</p>
      <p>
        Esta política explica como tratamos os dados pessoais de quem usa o site {C.site}, o painel e o aplicativo {C.name} (o &quot;Serviço&quot;), de
        acordo com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados, &quot;LGPD&quot;).
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O controlador dos dados é {controllerText()} (&quot;{C.name}&quot;, &quot;nós&quot;). Contato para qualquer assunto de privacidade, inclusive com o
        encarregado de dados: <a href={`mailto:${C.privacyEmail}`}>{C.privacyEmail}</a>.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail, senha (guardada apenas como hash) e, se você entrar com Google ou Apple, o identificador e o e-mail fornecidos por esses serviços.</li>
        <li><strong>Empresa e cobrança:</strong> razão social ou nome, CPF ou CNPJ, endereço de cobrança, plano contratado e histórico de faturas. Os dados de pagamento são processados pelo parceiro de pagamentos ou pela loja de aplicativos; não armazenamos os dados completos do meio de pagamento.</li>
        <li><strong>Contas de anúncio conectadas:</strong> quando você autoriza, pela Meta (anúncios no Facebook e no Instagram) e pelo Google Ads (GA4 em breve), recebemos tokens de acesso, os dados das contas de anúncio e as métricas das campanhas (investimento, impressões, cliques, conversões e receita), com os nomes e as prévias dos anúncios.</li>
        <li><strong>Conteúdo:</strong> dashboards, landing pages, logotipos e configurações que você cria.</li>
        <li><strong>WhatsApp:</strong> o número que você cadastrar para receber relatórios e alertas, se usar esse recurso.</li>
        <li><strong>Uso e segurança:</strong> endereço IP, tipo de navegador ou aparelho, data e hora de acesso, ações realizadas no Serviço e registros de login, mantidos para segurança e auditoria.</li>
        <li><strong>Aplicativo:</strong> token de notificação do aparelho (se você permitir notificações) e o registro das compras feitas pela loja de aplicativos.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Exibir dashboards, métricas e análises das contas conectadas ao próprio cliente (execução de contrato).</li>
        <li>Criar e manter sua conta e prestar o Serviço contratado (execução de contrato).</li>
        <li>Aplicar as otimizações que você pedir, como descrito no item 4 (execução de contrato).</li>
        <li>Cobrar, emitir faturas e cumprir obrigações fiscais (obrigação legal).</li>
        <li>Proteger a conta, prevenir fraudes e abuso, e manter registros de acesso exigidos pelo Marco Civil da Internet (obrigação legal e legítimo interesse).</li>
        <li>Enviar avisos sobre a conta, o plano e o Serviço, e as notificações que você autorizou (execução de contrato e consentimento).</li>
      </ul>

      <h2>4. Permissões nas contas conectadas</h2>
      <p>
        A conexão com a Meta e o Google autoriza leitura e alterações. O {C.name} só altera campanhas (pausar uma campanha ou ajustar o orçamento diário)
        quando você clica em <strong>Aplicar</strong>. O modo automático é opcional, do plano Avançado, e vem desligado; se você o ligar, o {C.name} aplica as
        mudanças dentro dos limites que você definir e avisa você. As mudanças ficam registradas e podem ser desfeitas em até 30 dias, se o valor não tiver
        mudado na plataforma depois.
      </p>
      <p>As permissões que o app pede são:</p>
      <ul>
        <li><strong>Meta:</strong> <code>ads_read</code> (ler os relatórios de anúncios), <code>ads_management</code> (aplicar as mudanças acima) e <code>business_management</code> (listar as contas de anúncio dos seus Business Managers).</li>
        <li><strong>Google:</strong> <code>https://www.googleapis.com/auth/adwords</code> (acessar as contas do Google Ads, para leitura e alterações) e <code>openid</code>, <code>email</code> e <code>profile</code> (mostrar qual login está conectado).</li>
      </ul>

      <h2>5. O que não fazemos</h2>
      <p>Não vendemos seus dados e não os compartilhamos com terceiros para publicidade. Os dados das contas conectadas servem só para prestar o Serviço a você.</p>

      <h2>6. Com quem compartilhamos</h2>
      <p>Apenas com fornecedores necessários para operar o Serviço, que tratam os dados em nosso nome e sob contrato:</p>
      <ul>
        <li>hospedagem e banco de dados (infraestrutura em nuvem);</li>
        <li>processamento de pagamentos e gestão de assinaturas da loja de aplicativos;</li>
        <li>envio de e-mails, de mensagens de WhatsApp e de notificações;</li>
        <li>as plataformas de anúncio que você mesmo conectou, para a leitura e as alterações autorizadas por você.</li>
      </ul>
      <p>Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.</p>

      <h2>7. Transferência internacional</h2>
      <p>
        Alguns fornecedores mantêm servidores fora do Brasil. Nesses casos, adotamos as salvaguardas previstas na LGPD, como cláusulas contratuais
        que garantem nível de proteção adequado.
      </p>

      <h2>8. Armazenamento e segurança</h2>
      <p>
        Os dados ficam em infraestrutura em nuvem. Usamos conexão cifrada (HTTPS), senhas com hash, tokens de integração cifrados, isolamento de dados por
        workspace no banco de dados e registros de auditoria. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente relevante, avisaremos
        você e a ANPD.
      </p>

      <h2>9. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta: enquanto ela existir.</li>
        <li>Tokens de acesso: até você desconectar a conta ou revogar o acesso.</li>
        <li>Métricas de anúncios já importadas: até a exclusão do workspace, mesmo depois de desconectar a conta.</li>
        <li>Registros de acesso: no mínimo 6 meses, como exige o Marco Civil da Internet.</li>
        <li>Faturas e dados fiscais: pelo prazo da legislação tributária (em geral, 5 anos), sem vínculo com seu perfil depois da exclusão da conta.</li>
      </ul>

      <h2>10. Seus direitos</h2>
      <p>
        Como titular, você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade, informação sobre compartilhamento e
        exclusão dos seus dados, além de revogar consentimentos. Escreva para <a href={`mailto:${C.privacyEmail}`}>{C.privacyEmail}</a>; respondemos em até
        15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>11. Como revogar o acesso</h2>
      <p>Você pode tirar o acesso do {C.name} às suas contas a qualquer momento, de qualquer uma destas formas:</p>
      <ul>
        <li><strong>No painel:</strong> em Contas, escolha a conexão e clique em Desconectar. O acesso é revogado na plataforma e o token é apagado.</li>
        <li><strong>No Facebook:</strong> em Configurações e privacidade → Configurações → Apps e sites, remova o app Vyzualize. Se ele não estiver lá, veja em <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">Integrações comerciais</a>.</li>
        <li><strong>No Google:</strong> em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Conta do Google → Segurança → Acesso de terceiros</a>, remova o acesso do Vyzualize.</li>
      </ul>
      <p>
        Revogar interrompe a sincronização, mas não apaga o que já foi importado. Para isso, veja a <Link href="/exclusao-de-dados">Exclusão de dados</Link>.
      </p>

      <h2>12. Excluir sua conta e seus dados</h2>
      <p>
        No aplicativo, em <strong>Conta → Excluir conta</strong>, você apaga seu perfil e seus acessos. Se você for o dono de um workspace com outros membros,
        a propriedade passa a outro membro; sem equipe, a assinatura é encerrada. Para apagar também os dados do workspace, siga as instruções de{" "}
        <Link href="/exclusao-de-dados">Exclusão de dados</Link>. Ficam apenas os registros que a lei nos obriga a guardar.
      </p>

      <h2>13. Cookies</h2>
      <p>
        No Serviço, usamos apenas cookies necessários para manter você conectado, lembrar o workspace aberto e o tema escolhido.
        {siteTags ? " No site público, usamos ferramentas de medição de anúncios (como Google Tag Manager e Meta Pixel), que registram a visita; os dados das contas conectadas não passam por elas." : " Não usamos cookies de publicidade."}
      </p>

      <h2>14. Crianças</h2>
      <p>O Serviço é destinado a empresas e profissionais e não é direcionado a menores de 18 anos.</p>

      <h2>15. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão avisadas por e-mail ou no Serviço. Veja também os{" "}
        <Link href="/termos">Termos de Uso</Link>.
      </p>

      <h2>16. Contato</h2>
      <p>
        <a href={`mailto:${C.privacyEmail}`}>{C.privacyEmail}</a>
      </p>
    </>
  );
}
