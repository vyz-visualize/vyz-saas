import { permanentRedirect } from "next/navigation";

// "Projetos" virou "Workspaces": o endereço antigo continua levando para o novo.
export default function Page() {
  permanentRedirect("/painel/workspaces");
}
