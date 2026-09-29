"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { ClientForm } from "@/components/painel/clientes/ClientForm";
import type { Client } from "@/types/api";
import type { ClientInput } from "@tinypet/shared";

export default function NovoClientePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useMutation({
    mutationFn: (v: ClientInput) => api<Client>("/clients", { method: "POST", json: v }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast("Cliente criado", "success");
      router.push(`/painel/clientes/${c.id}`);
    },
    onError: (e) => {
      if (!isPlanLimit(e)) toast(errorMessage(e), "error");
    },
  });
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Clientes
      </Link>
      <PageHeader title="Novo cliente" description="Depois de salvar você pode adicionar contatos, endereços, pets e enviar o convite." />
      <PlanLimitNotice error={create.error} className="mb-4" />
      <div className="card">
        <ClientForm onSubmit={(v) => create.mutate(v)} submitting={create.isPending} submitLabel="Criar cliente" />
      </div>
    </div>
  );
}
