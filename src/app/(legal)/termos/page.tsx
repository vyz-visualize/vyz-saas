import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY as C } from "@/features/legal/company";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso do site, do painel e do aplicativo VYZ, incluindo planos e assinaturas.",
  alternates: { canonical: "/termos" },
};

export default function Termos() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p>Atualizados em {C.updatedAt}.</p>
      <p>
        Estes termos regem o uso do site {C.site}, do painel e do aplicativo {C.name} (o &quot;Serviço&quot;), oferecidos pela {C.legalName}, CNPJ{" "}
        {C.cnpj}, com sede em {C.address}. Ao criar uma conta ou usar o Serviço, você concorda com estes termos e com a{" "}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>1. O Serviço</h2>
      <p>
        O {C.name} reúne métricas de plataformas de anúncio que você conecta e as apresenta em dashboards, além de permitir criar landing pages.
        Os recursos disponíveis dependem do plano contratado.
      </p>

      <h2>2. Conta</h2>
      <ul>
        <li>Você precisa ter 18 anos ou mais e informar dados verdadeiros.</li>
        <li>Você é responsável pela senha e por tudo o que acontece na sua conta. Avise-nos se suspeitar de acesso indevido.</li>
        <li>O dono do workspace decide quem participa e com qual papel, dentro do limite de usuários do plano.</li>
      </ul>

      <h2>3. Planos e assinaturas</h2>
      <ul>
        <li>Os planos são assinaturas mensais ou anuais, com preço por quantidade de contas de anúncio, conforme mostrado antes da contratação.</li>
        <li><strong>Renovação automática:</strong> a assinatura se renova ao fim de cada período pelo mesmo valor, até ser cancelada.</li>
        <li>
          <strong>Assinaturas feitas no aplicativo</strong> são cobradas pela conta da loja de aplicativos e se renovam automaticamente, salvo se
          canceladas pelo menos 24 horas antes do fim do período. Você gerencia e cancela nas configurações de assinaturas da sua conta da loja.
          Reembolsos dessas compras seguem as regras da loja.
        </li>
        <li>
          <strong>Assinaturas feitas no site</strong> podem ser alteradas ou canceladas no painel, em Plano. O cancelamento vale ao fim do período já
          pago, e o acesso continua até lá.
        </li>
        <li>Para contratações pela internet, você pode desistir em até 7 dias da primeira contratação, com reembolso integral (art. 49 do CDC).</li>
        <li>Se o pagamento falhar, o acesso aos recursos pagos pode ser suspenso até a regularização.</li>
        <li>Mudanças de preço serão avisadas com antecedência e valem a partir da renovação seguinte.</li>
      </ul>

      <h2>4. Créditos</h2>
      <p>
        Créditos comprados no aplicativo são de uso no próprio Serviço, valem no app e no site, não expiram enquanto a conta existir e não podem ser
        trocados por dinheiro nem transferidos.
      </p>

      <h2>5. Integrações</h2>
      <p>
        Ao conectar uma conta de anúncio, você declara ter autorização para acessá-la e nos permite a leitura e as alterações autorizadas por
        você: ler as métricas necessárias e, quando você aplicar uma otimização ou ligar o automático, pausar campanhas e ajustar o orçamento
        diário. Você pode desconectá-la a qualquer momento. Não respondemos por indisponibilidade, mudanças ou limites impostos por essas plataformas.
      </p>

      <h2>6. Uso aceitável</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>usar o Serviço para atividades ilegais, fraudulentas ou que violem direitos de terceiros;</li>
        <li>publicar landing pages com conteúdo enganoso, ofensivo, ilegal ou que colete dados sem o devido aviso;</li>
        <li>tentar acessar dados de outros clientes, burlar limites do plano ou atacar a infraestrutura;</li>
        <li>copiar, revender ou fazer engenharia reversa do Serviço.</li>
      </ul>
      <p>Podemos suspender ou encerrar contas que descumpram estas regras.</p>

      <h2>7. Seu conteúdo</h2>
      <p>
        Os dados e o conteúdo que você coloca no Serviço continuam seus. Você nos autoriza a armazená-los e processá-los apenas para prestar o
        Serviço. Você é responsável pelo conteúdo das landing pages que publicar.
      </p>

      <h2>8. Propriedade intelectual</h2>
      <p>A marca {C.name}, o software, os layouts e os templates pertencem a nós. O plano dá direito de uso, não de propriedade.</p>

      <h2>9. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para manter o Serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. As métricas
        exibidas dependem dos dados fornecidos pelas plataformas de anúncio e servem de apoio à decisão. Na máxima extensão permitida pela lei,
        nossa responsabilidade se limita ao valor pago por você nos 12 meses anteriores ao fato.
      </p>

      <h2>10. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento (no aplicativo, em Conta → Excluir conta). Excluir a conta não cancela automaticamente
        uma assinatura feita pela loja de aplicativos; cancele também por lá.
      </p>

      <h2>11. Alterações</h2>
      <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas por e-mail ou no Serviço com antecedência razoável.</p>

      <h2>12. Lei e foro</h2>
      <p>
        Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor, quando aplicável o Código de Defesa do Consumidor, ou
        o da sede da {C.name} nos demais casos.
      </p>

      <h2>13. Contato</h2>
      <p>
        <a href={`mailto:${C.supportEmail}`}>{C.supportEmail}</a>
      </p>
    </>
  );
}
