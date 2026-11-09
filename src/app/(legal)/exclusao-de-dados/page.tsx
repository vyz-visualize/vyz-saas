import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY as C } from "@/features/legal/company";

export const metadata: Metadata = {
  title: "Exclusão de dados",
  description: "Como remover o app Vyzualize do Facebook e pedir a exclusão total dos seus dados.",
  alternates: { canonical: "/exclusao-de-dados" },
};

export default function ExclusaoDeDados() {
  return (
    <>
      <h1>Exclusão de dados</h1>
      <p>Última atualização: {C.updatedAt}.</p>
      <p>
        Veja como tirar o acesso do app Vyzualize à sua conta do Facebook e como pedir a exclusão total dos seus dados. São duas etapas diferentes: a
        primeira interrompe o acesso; a segunda apaga o que já foi guardado.
      </p>

      <h2>1. Remover o app Vyzualize do Facebook</h2>
      <ol>
        <li>Entre no Facebook e abra <strong>Configurações e privacidade → Configurações</strong>.</li>
        <li>Abra <strong>Apps e sites</strong>. Se o app não estiver lá, veja em <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">Integrações comerciais</a>.</li>
        <li>Encontre o <strong>Vyzualize</strong> e clique em <strong>Remover</strong>.</li>
      </ol>
      <p>A partir daí, o Vyzualize não recebe mais dados da sua conta. O que já foi importado continua guardado até você pedir a exclusão total, abaixo.</p>

      <h2>2. Pedir a exclusão total</h2>
      <ol>
        <li>Envie um e-mail para <a href={`mailto:${C.supportEmail}?subject=Exclus%C3%A3o%20de%20dados`}>{C.supportEmail}</a>, com o assunto &quot;Exclusão de dados&quot;.</li>
        <li>Informe o <strong>e-mail da sua conta</strong> no Vyzualize. Se escrever de outro endereço, podemos pedir uma confirmação de que a conta é sua.</li>
      </ol>

      <h2>3. Prazo</h2>
      <p>Atendemos o pedido em até <strong>30 dias</strong> e confirmamos por e-mail quando terminar.</p>

      <h2>4. O que é apagado</h2>
      <ul>
        <li>Seu perfil e seu login.</li>
        <li>Os tokens de acesso às plataformas conectadas.</li>
        <li>Os dados das contas de anúncio conectadas: métricas, campanhas, anúncios e prévias.</li>
        <li>Os dashboards, os projetos, as landing pages e as configurações dos workspaces de que você é o único membro.</li>
        <li>O histórico de otimizações e as tarefas desses workspaces.</li>
        <li>O número de WhatsApp cadastrado e os tokens de notificação do aparelho.</li>
      </ul>

      <h2>5. O que pode ficar</h2>
      <ul>
        <li><strong>Obrigações legais:</strong> faturas e dados fiscais, pelo prazo da legislação tributária (em geral, 5 anos), e registros de acesso, por no mínimo 6 meses, como exige o Marco Civil da Internet.</li>
        <li>
          <strong>Segurança:</strong> guardamos por até 5 anos o histórico de auditoria (o registro do que foi alterado e por quem), o histórico de atividade e o
          registro de que você aceitou os termos.
        </li>
        <li><strong>Workspaces com outros membros:</strong> seu acesso é removido e a propriedade passa a outro membro. Os dados do workspace continuam, porque também são da equipe; o novo dono pode pedir a exclusão deles.</li>
      </ul>
      <p>
        Mais detalhes na <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </>
  );
}
