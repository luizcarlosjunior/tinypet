"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inviteMemberSchema } from "@tinypet/shared";
import type { z } from "zod";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Input, Modal, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Avatar, Checkbox, ConfirmDialog, QueryState, UsageBar } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { useActivePartner, usePartnerPlan } from "@/hooks/use-partner";
import { useMembers, useTeamMutations } from "@/hooks/use-team";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import type { TeamMember } from "@/types/api";

type InviteForm = z.infer<typeof inviteMemberSchema>;

export default function EquipePage() {
  const { partnerId, partner, isOwner, membership } = useActivePartner();
  const members = useMembers(partnerId);
  const plan = usePartnerPlan(partnerId);
  const { invite, update, remove } = useTeamMutations(partnerId);
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [edit, setEdit] = useState<TeamMember | null>(null);
  const [del, setDel] = useState<TeamMember | null>(null);
  const [inviteError, setInviteError] = useState<unknown>(null);

  const form = useForm<InviteForm>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: "", role: "STAFF", canSeeFinance: false, jobTitle: "" } });
  const limit = plan.data?.limits?.team_members;
  const used = plan.data?.usage?.team_members ?? members.data?.length ?? 0;
  const atLimit = limit?.quantity != null && used >= limit.quantity;

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Profissionais que atendem em nome do parceiro."
        actions={
          isOwner && (
            <Button type="button" onClick={() => setInviteOpen(true)} disabled={atLimit}>
              <UserPlus className="h-4 w-4" aria-hidden /> Convidar
            </Button>
          )
        }
      />
      {plan.data && (
        <div className="card mb-4">
          <UsageBar label="Profissionais na equipe" used={used} limit={limit?.quantity} enabled={limit?.enabled ?? true} />
          {atLimit && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Limite do plano atingido. Faça upgrade para adicionar mais profissionais.</p>}
        </div>
      )}
      <QueryState isLoading={members.isLoading} error={members.error} retry={() => members.refetch()}>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(members.data ?? []).map((m) => (
            <li key={m.id} className="card flex items-start gap-3">
              <Avatar src={m.user?.avatarUrl} name={m.user?.name ?? "?"} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.user?.name ?? "—"} {m.id === membership?.membershipId && <span className="text-xs text-[var(--muted)]">(você)</span>}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">{m.user?.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={m.role === "OWNER" ? "brand" : "gray"}>{m.role === "OWNER" ? "Dono" : "Equipe"}</Badge>
                  {m.jobTitle && <Badge>{m.jobTitle}</Badge>}
                  {(m.role === "OWNER" || m.canSeeFinance) && <Badge tone="green">Financeiro</Badge>}
                  {m.costPerKm != null && <Badge tone="blue">R$ {Number(m.costPerKm).toFixed(2)}/km</Badge>}
                </div>
              </div>
              {isOwner && (
                <div className="flex gap-1">
                  <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Editar ${m.user?.name ?? "membro"}`} onClick={() => setEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  {m.role !== "OWNER" && (
                    <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Remover ${m.user?.name ?? "membro"}`} onClick={() => setDel(m)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </QueryState>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar membro">
        <p className="mb-3 text-sm text-[var(--muted)]">A pessoa precisa já ter uma conta no tinyPet com este e-mail.</p>
        <PlanLimitNotice error={inviteError} className="mb-3" />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (v) => {
            setInviteError(null);
            try {
              await invite.mutateAsync({ ...v, jobTitle: v.jobTitle || null });
              setInviteOpen(false);
              form.reset();
            } catch (e) {
              setInviteError(e);
              if (!isPlanLimit(e)) toast(errorMessage(e), "error");
            }
          })}
          noValidate
        >
          <Input id="inv-email" label="E-mail" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
          <Input id="inv-job" label="Cargo (opcional)" placeholder="Ex.: Adestrador, Veterinária" {...form.register("jobTitle")} />
          <Select id="inv-role" label="Papel" {...form.register("role")}>
            <option value="STAFF">Equipe</option>
            <option value="OWNER">Dono</option>
          </Select>
          <Checkbox label="Pode ver o financeiro" {...form.register("canSeeFinance")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={invite.isPending}>
              Convidar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar membro">
        {edit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const cost = String(fd.get("costPerKm") ?? "").replace(",", ".");
              update.mutate(
                {
                  id: edit.id,
                  body: {
                    role: fd.get("role"),
                    canSeeFinance: fd.get("canSeeFinance") === "on",
                    jobTitle: String(fd.get("jobTitle") ?? "") || null,
                    baseAddressId: String(fd.get("baseAddressId") ?? "") || null,
                    costPerKm: cost ? Number(cost) : null,
                    navApp: String(fd.get("navApp") ?? "") || null,
                  },
                },
                { onSuccess: () => setEdit(null) },
              );
            }}
          >
            <p className="text-sm font-medium">{edit.user?.name}</p>
            <Input id="ed-job" name="jobTitle" label="Cargo" defaultValue={edit.jobTitle ?? ""} />
            <Select id="ed-role" name="role" label="Papel" defaultValue={edit.role} disabled={edit.id === membership?.membershipId}>
              <option value="STAFF">Equipe</option>
              <option value="OWNER">Dono</option>
            </Select>
            <Checkbox name="canSeeFinance" label="Pode ver o financeiro" defaultChecked={edit.role === "OWNER" || edit.canSeeFinance} disabled={edit.role === "OWNER"} />
            <Select id="ed-base" name="baseAddressId" label="Endereço-base (saída da rota do dia)" defaultValue={edit.baseAddressId ?? ""}>
              <option value="">— usar endereço principal do parceiro —</option>
              {(partner?.addresses ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label} · ` : ""}
                  {a.street}
                  {a.number ? `, ${a.number}` : ""} — {a.city}/{a.state}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input id="ed-cost" name="costPerKm" label="Custo por km (R$)" inputMode="decimal" defaultValue={edit.costPerKm != null ? String(edit.costPerKm) : ""} />
              <Select id="ed-nav" name="navApp" label="App de navegação" defaultValue={edit.navApp ?? ""}>
                <option value="">Perguntar</option>
                <option value="google">Google Maps</option>
                <option value="waze">Waze</option>
                <option value="apple">Apple Maps</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={update.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => setDel(null) })} title="Remover membro?" description={`${del?.user?.name ?? "Este membro"} perderá o acesso ao painel deste parceiro.`} confirmLabel="Remover" danger loading={remove.isPending} />
    </div>
  );
}
