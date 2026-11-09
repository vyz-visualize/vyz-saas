import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY as C } from "@/features/legal/company";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a VYZ coleta, usa, guarda e protege seus dados, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
};

export default function Privacidade() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p>Atualizada em {C.updatedAt}.</p>
      <p>
        Esta política explica como a {C.legalName}, inscrita no CNPJ {C.cnpj}, com sede em {C.address} (&quot;{C.name}&quot;, &quot;nós&quot;), trata os
        dados pessoais de quem usa o site {C.site}, o painel e o aplicativo {C.name} (o &quot;Serviço&quot;), de acordo com a Lei nº 13.709/2018
        (Lei Geral de Proteção de Dados, &quot;LGPD&quot;).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail, senha (guardada apenas como hash) e, se você entrar com Google ou Apple, o identificador e o e-mail fornecidos por esses serviços.</li>
        <li><strong>Empresa e cobrança:</strong> razão social ou nome, CPF ou CNPJ, endereço de cobrança, plano contratado e histórico de faturas. Os dados de pagamento são processados pelo parceiro de pagamentos ou pela loja de aplicativos; não armazenamos os dados completos do meio de pagamento.</li>
        <li><strong>Contas de anúncio conectadas:</strong> quando você autoriza, recebemos das plataformas de anúncio (como Meta e Google) tokens de acesso e métricas das campanhas (investimento, impressões, cliques, conversões e receita). Com esses tokens fazemos a leitura e as alterações autorizadas por você (pausar campanha ou ajustar orçamento diário), e cada alteração fica registrada. Os tokens ficam cifrados.</li>
        <li><strong>Conteúdo:</strong> dashboards, landing pages, logotipos e configurações que você cria.</li>
        <li><strong>Uso e segurança:</strong> endereço IP, tipo de navegador ou aparelho, data e hora de acesso, ações realizadas no Serviço e registros de login, mantidos para segurança e auditoria.</li>
        <li><strong>Aplicativo:</strong> token de notificação do aparelho (se você permitir notificações) e o registro das compras feitas pela loja de aplicativos.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e prestar o Serviço contratado (execução de contrato).</li>
        <li>Gerar seus dashboards com as métricas das contas que você conectou (execução de contrato).</li>
        <li>Cobrar, emitir faturas e cumprir obrigações fiscais (obrigação legal).</li>
        <li>Proteger a conta, prevenir fraudes e abuso, e manter registros de acesso exigidos pelo Marco Civil da Internet (obrigação legal e legítimo interesse).</li>
        <li>Enviar avisos sobre a conta, o plano e o Serviço, e notificações no aplicativo que você autorizou (execução de contrato e consentimento).</li>
      </ul>
      <p>
        Não vendemos seus dados. Não usamos seus dados para publicidade de terceiros nem rastreamos você em outros apps ou sites.
      </p>

      <h2>3. Com quem compartilhamos</h2>
      <p>Apenas com fornecedores necessários para operar o Serviço, que tratam os dados em nosso nome e sob contrato:</p>
      <ul>
        <li>hospedagem e banco de dados (infraestrutura em nuvem);</li>
        <li>processamento de pagamentos e gestão de assinaturas da loja de aplicativos;</li>
        <li>envio de e-mails e de notificações;</li>
        <li>as plataformas de anúncio que você mesmo conectou, para a leitura e as alterações autorizadas por você.</li>
      </ul>
      <p>Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.</p>

      <h2>4. Transferência internacional</h2>
      <p>
        Alguns fornecedores mantêm servidores fora do Brasil. Nesses casos, adotamos as salvaguardas previstas na LGPD, como cláusulas contratuais
        que garantem nível de proteção adequado.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta: enquanto ela existir.</li>
        <li>Registros de acesso: no mínimo 6 meses, como exige o Marco Civil da Internet.</li>
        <li>Faturas e dados fiscais: pelo prazo da legislação tributária (em geral, 5 anos), sem vínculo com seu perfil depois da exclusão da conta.</li>
        <li>Métricas de anúncios: enquanto a conta de anúncio estiver conectada ou até a exclusão do workspace.</li>
      </ul>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade, informação sobre compartilhamento e eliminação
        dos seus dados, além de revogar consentimentos. Escreva para <a href={`mailto:${C.privacyEmail}`}>{C.privacyEmail}</a>; respondemos em até
        15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>7. Excluir sua conta</h2>
      <p>
        No aplicativo, abra <strong>Conta → Excluir conta</strong>. No site, peça pelo e-mail acima. A exclusão apaga seu perfil e seus acessos. Se
        você for o dono de um workspace com outros membros, a propriedade passa a outro membro; sem equipe, o workspace e a assinatura são
        encerrados. Ficam apenas os registros que a lei nos obriga a guardar.
      </p>
      <p>
        Você também pode desconectar a qualquer momento as contas de anúncio vinculadas, pelo painel ou nas configurações da própria plataforma.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Usamos conexão cifrada (HTTPS), senhas com hash, tokens de integração cifrados, isolamento de dados por workspace no banco de dados e
        registros de auditoria. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente relevante, avisaremos você e a ANPD.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos apenas cookies necessários para manter você conectado, lembrar o workspace aberto e o tema escolhido. Não usamos cookies de
        publicidade.
      </p>

      <h2>10. Crianças</h2>
      <p>O Serviço é destinado a empresas e profissionais e não é direcionado a menores de 18 anos.</p>

      <h2>11. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. Mudanças relevantes serão avisadas por e-mail ou no Serviço. Veja também os{" "}
        <Link href="/termos">Termos de Uso</Link>.
      </p>

      <h2>12. Contato</h2>
      <p>
        Encarregado de dados (DPO): <a href={`mailto:${C.privacyEmail}`}>{C.privacyEmail}</a>.
      </p>
    </>
  );
}
