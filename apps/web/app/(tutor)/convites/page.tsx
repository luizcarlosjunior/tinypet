"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Users } from "lucide-react";
import { useMyPetInvites, useRespondPetInvite, type IncomingItem } from "@/hooks/use-sharing";
import { Avatar } from "@/components/ui/avatar";
import { Button, Empty, PageHeader, Spinner } from "@/components/ui";
import { PlanLimitNotice } from "@/components/pets/plan-limit-notice";
import { useToast } from "@/components/ui/toast";
import { errorMessage, planLimitOf } from "@/lib/errors";
import { fmtDate } from "@/lib/format";
import type { PlanLimitError } from "@tinypet/shared";

/** Pending pet share invites and ownership transfer requests addressed to the signed-in account. */
export default function ConvitesPage() {
  const q = useMyPetInvites();
  const [limit, setLimit] = useState<PlanLimitError | null>(null);
  const shares = q.data?.shares ?? [];
  const transfers = q.data?.transfers ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Convites" description="Compartilhamentos de pets e transferências de propriedade que aguardam a sua resposta." />
      {limit && <PlanLimitNotice limit={limit} title="Você atingiu o limite de pets do seu plano" />}
      {q.isLoading && <Spinner />}
      {q.isError && <Empty title="Não foi possível carregar os convites" description={errorMessage(q.error)} />}
      {q.data && shares.length === 0 && transfers.length === 0 && (
        <Empty title="Nenhum convite pendente" description="Quando alguém compartilhar um pet com você, o convite aparece aqui." action={<Link href="/pets" className="btn-secondary">Meus pets</Link>} />
      )}
      {transfers.length > 0 && (
        <section className="space-y-2" aria-labelledby="transfers">
          <h2 id="transfers" className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4 text-amber-500" aria-hidden /> Transferências de propriedade
          </h2>
          <ul className="space-y-2">
            {transfers.map((t) => (
              <InviteRow key={t.id} kind="transfer" item={t} onPlanLimit={setLimit} />
            ))}
          </ul>
        </section>
      )}
      {shares.length > 0 && (
        <section className="space-y-2" aria-labelledby="shares">
          <h2 id="shares" className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" aria-hidden /> Compartilhamentos
          </h2>
          <ul className="space-y-2">
            {shares.map((s) => (
              <InviteRow key={s.id} kind="share" item={s} onPlanLimit={setLimit} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InviteRow({ kind, item, onPlanLimit }: { kind: "share" | "transfer"; item: IncomingItem; onPlanLimit: (l: PlanLimitError | null) => void }) {
  const respond = useRespondPetInvite();
  const { toast } = useToast();
  const router = useRouter();
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const from = item.from.username ? `${item.from.name} (@${item.from.username})` : item.from.name;

  function go(a: "accept" | "decline") {
    setAction(a);
    onPlanLimit(null);
    respond
      .mutateAsync({ kind, id: item.id, action: a })
      .then((r) => {
        if (a === "decline") toast(kind === "share" ? "Convite recusado." : "Transferência recusada.", "info");
        else {
          toast(kind === "share" ? `${item.pet.name} agora aparece nos seus pets.` : `Você agora é o tutor de ${item.pet.name}.`, "success");
          router.push(`/pets/${r.petId}`);
        }
      })
      .catch((e) => {
        const l = planLimitOf(e);
        if (l) onPlanLimit(l);
        else toast(errorMessage(e), "error");
      })
      .finally(() => setAction(null));
  }

  return (
    <li className="card flex flex-wrap items-center gap-3 text-sm">
      <Avatar src={item.pet.avatarUrl} name={item.pet.name} size={48} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {kind === "share" ? `${from} quer compartilhar ${item.pet.name} com você` : `${from} quer transferir ${item.pet.name} para você`}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {kind === "share"
            ? "Você poderá ver tudo sobre o pet e marcar as tarefas da rotina. Só o tutor dono altera o cadastro."
            : `Ao aceitar, você vira o tutor dono e ${item.from.name} continua com o pet compartilhado. O pet conta no limite do seu plano.`}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {[item.pet.species?.label, `enviado em ${fmtDate(item.createdAt)}`, `expira em ${fmtDate(item.expiresAt)}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" loading={action === "decline"} disabled={respond.isPending} onClick={() => go("decline")}>
          Recusar
        </Button>
        <Button type="button" loading={action === "accept"} disabled={respond.isPending} onClick={() => go("accept")}>
          Aceitar
        </Button>
      </div>
    </li>
  );
}
