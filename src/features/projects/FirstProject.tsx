"use client";

// Primeiro projeto: a pessoa dá o nome (o cliente ou a marca que vai acompanhar). Sem isso o
// banco criaria um projeto com o nome da empresa do cadastro, que não é o que ela quer.

import { FolderPlus, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { btn } from "@/components/ui/styles";
import { createProject } from "@/server/projects/actions";

export function FirstProject({ onCreated, compact = false }: { onCreated?: (id: string, name: string) => void; compact?: boolean }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createProject(name);
      if (r.ok) onCreated?.(r.data.id, name.trim());
      else setError(r.error.message);
    });
  return (
    <div className={`rounded-card border border-accent/50 bg-accent-soft/40 ${compact ? "p-3" : "p-4"}`}>
      <p className="flex items-center gap-2 font-semibold text-fg">
        <FolderPlus size={17} aria-hidden className="text-accent" /> Crie seu primeiro workspace
      </p>
      <p className="mt-1 text-[13px] text-fg-2">Um workspace é o cliente ou a marca que você acompanha. As contas e os dashboards ficam dentro dele.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) submit();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Loja da Ana, Clínica Sol"
          aria-label="Nome do workspace"
          maxLength={80}
          className="h-10 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-[14px] outline-none focus:border-accent"
        />
        <button type="submit" className={btn.small} disabled={pending || !name.trim()}>
          {pending && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
          Criar workspace
        </button>
      </form>
      {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}
    </div>
  );
}
