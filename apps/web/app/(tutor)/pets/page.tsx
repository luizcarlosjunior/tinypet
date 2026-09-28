"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useCreatePet, usePets } from "@/hooks/use-pets";
import { useMyPlan } from "@/hooks/use-me";
import { Button, Empty, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { PetForm } from "@/components/pets/pet-form";
import { PetCard } from "@/components/pets/pet-card";
import { PlanLimitNotice } from "@/components/pets/plan-limit-notice";
import { errorMessage, planLimitOf } from "@/lib/errors";
import type { PlanLimitError } from "@tinypet/shared";

export default function PetsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Pets />
    </Suspense>
  );
}

function Pets() {
  const sp = useSearchParams();
  const router = useRouter();
  const [showDeceased, setShowDeceased] = useState(false);
  const pets = usePets({ includeDeceased: showDeceased });
  const plan = useMyPlan();
  const create = useCreatePet();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState<PlanLimitError | null>(null);

  useEffect(() => {
    if (sp.get("new") === "1") setOpen(true);
  }, [sp]);

  const usage = plan.data?.usage?.owner_pets;
  const cap = plan.data?.limits?.owner_pets?.quantity;

  return (
    <div>
      <PageHeader
        title="Meus pets"
        description={cap != null && usage != null ? `${usage} de ${cap} pets no seu plano` : undefined}
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Novo pet
          </Button>
        }
      />
      {limit && (
        <div className="mb-4">
          <PlanLimitNotice limit={limit} title="Você atingiu o limite de pets" />
        </div>
      )}
      {pets.isLoading && <Spinner />}
      {pets.isError && <Empty title="Não foi possível carregar seus pets" description={errorMessage(pets.error)} />}
      {pets.data && pets.data.length === 0 && <Empty title="Nenhum pet ainda" description="Cadastre seu primeiro pet para acompanhar saúde, rotina e conquistas." action={<Button onClick={() => setOpen(true)}>Cadastrar pet</Button>} />}
      {pets.data && pets.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pets.data.map((p) => (
            <PetCard key={p.id} pet={p} />
          ))}
        </div>
      )}
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--muted)]">
        <input type="checkbox" checked={showDeceased} onChange={(e) => setShowDeceased(e.target.checked)} className="h-4 w-4 accent-brand-500" /> Mostrar pets em memória
      </label>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo pet" className="sm:max-w-2xl">
        <PetForm
          loading={create.isPending}
          onCancel={() => setOpen(false)}
          onSubmit={async (v) => {
            try {
              const created = await create.mutateAsync(v);
              toast(`${v.name} cadastrado(a)!`, "success");
              setOpen(false);
              const next = sp.get("next");
              router.push(next && next.startsWith("/") ? next : `/pets/${created.id}`);
            } catch (e) {
              const pl = planLimitOf(e);
              if (pl) {
                setLimit(pl);
                setOpen(false);
              } else toast(errorMessage(e), "error");
            }
          }}
        />
      </Modal>
    </div>
  );
}
