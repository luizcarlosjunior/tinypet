"use client";
import { useState } from "react";
import { ArrowRightLeft, Clock, Crown, LogOut, Mail, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { usePetSharing, useSharingMutation, type PetShare } from "@/hooks/use-sharing";
import { useSessionContext } from "@/hooks/use-session-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Button, Empty, Input, Modal, Spinner } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

const handleOf = (u: { username: string | null }) => (u.username ? `@${u.username}` : null);

/** "Compartilhamento" tab: owner manages invites, shared accounts and ownership transfer; a shared account sees the owner and can leave. */
export function PetSharing({ petId, petName, deceased }: { petId: string; petName: string; deceased: boolean }) {
  const q = usePetSharing(petId);
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <Empty title="Não foi possível carregar o compartilhamento" description={errorMessage(q.error)} />;
  return q.data.role === "owner" ? <OwnerView petId={petId} petName={petName} deceased={deceased} /> : <SharedView petId={petId} petName={petName} />;
}

function OwnerView({ petId, petName, deceased }: { petId: string; petName: string; deceased: boolean }) {
  const { data } = usePetSharing(petId);
  const invite = useSharingMutation<{ handle: string }>(petId, "POST", "/share-invites");
  const cancelInvite = useSharingMutation(petId, "DELETE", (id) => `/share-invites/${id}`);
  const removeShare = useSharingMutation(petId, "DELETE", (id) => `/shares/${id}`);
  const cancelTransfer = useSharingMutation(petId, "DELETE", (id) => `/ownership-transfers/${id}`);
  const { toast } = useToast();
  const [handle, setHandle] = useState("");
  const [removing, setRemoving] = useState<PetShare | null>(null);
  const [transferTo, setTransferTo] = useState<PetShare | null>(null);
  if (!data) return null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Compartilhe {petName} com outras contas tinyPet. Quem recebe o compartilhamento vê tudo sobre o pet e pode marcar as tarefas da rotina, mas só você, que é o tutor dono, altera o cadastro.
      </p>

      {deceased ? (
        <p className="card text-sm text-[var(--muted)]">Pets em memória não podem ser compartilhados nem transferidos.</p>
      ) : (
        <form
          className="card grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const h = handle.trim();
            if (!h) return;
            invite
              .mutateAsync({ body: { handle: h } })
              .then(() => {
                toast("Convite enviado. A outra conta precisa aceitar.", "success");
                setHandle("");
              })
              .catch((err) => toast(errorMessage(err), "error"));
          }}
        >
          <Input id="share-handle" label="Usuário (@nome) ou e-mail da outra conta" placeholder="@usuario ou email@exemplo.com" autoComplete="off" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={254} required />
          <div className="flex items-end">
            <Button type="submit" loading={invite.isPending}>
              <UserPlus className="h-4 w-4" aria-hidden /> Convidar
            </Button>
          </div>
        </form>
      )}

      {data.invites.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Convites pendentes</h3>
          <ul className="divide-y rounded-2xl border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Avatar src={i.to.avatarUrl} name={i.to.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.to.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[handleOf(i.to), `expira em ${fmtDate(i.expiresAt)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone="amber">Aguardando resposta</Badge>
                <Button type="button" variant="ghost" onClick={() => cancelInvite.mutateAsync({ arg: i.id }).then(() => toast("Convite cancelado.", "info")).catch((e) => toast(errorMessage(e), "error"))}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.pendingTransfer && (
        <section className="card space-y-2 text-sm" aria-label="Transferência pendente">
          <p className="flex items-center gap-2 font-semibold">
            <ArrowRightLeft className="h-4 w-4" aria-hidden /> Transferência de propriedade pendente
          </p>
          <p className="text-[var(--muted)]">
            Aguardando {data.pendingTransfer.to.name} {handleOf(data.pendingTransfer.to) && `(${handleOf(data.pendingTransfer.to)})`} aceitar. O pedido expira em {fmtDate(data.pendingTransfer.expiresAt)}.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              loading={cancelTransfer.isPending}
              onClick={() => cancelTransfer.mutateAsync({ arg: data.pendingTransfer!.id }).then(() => toast("Transferência cancelada.", "info")).catch((e) => toast(errorMessage(e), "error"))}
            >
              Cancelar transferência
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Contas com acesso</h3>
        {data.shares.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{petName} ainda não está compartilhado com ninguém.</p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {data.shares.map((s) => {
              const blockedByPending = !!data.pendingTransfer;
              return (
                <li key={s.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <Avatar src={s.avatarUrl} name={s.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{[handleOf(s), `desde ${fmtDate(s.since)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  {!deceased && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!s.canTransferNow || blockedByPending}
                      title={!s.canTransferNow ? `A transferência para esta conta fica disponível em ${fmtDate(s.transferEligibleAt, "dd/MM")}` : blockedByPending ? "Já existe uma transferência pendente" : undefined}
                      onClick={() => setTransferTo(s)}
                    >
                      <Crown className="h-4 w-4" aria-hidden />
                      {s.canTransferNow ? "Transferir propriedade" : `Transferir: disponível em ${fmtDate(s.transferEligibleAt, "dd/MM")}`}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" className="text-red-600" onClick={() => setRemoving(s)}>
                    Remover
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Clock className="h-3.5 w-3.5" aria-hidden /> A propriedade só pode ser transferida para uma conta 7 dias depois do início do compartilhamento
          {data.canTransferFrom ? `; como você recebeu ${petName} há pouco tempo, só poderá transferir a partir de ${fmtDate(data.canTransferFrom)}` : ""}.
        </p>
      </section>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remover ${removing?.name ?? ""}?`}
        description={`${removing?.name ?? "Esta conta"} deixará de ver ${petName}. Você pode convidar de novo depois (o prazo de 7 dias para transferência recomeça).`}
        confirmLabel="Remover"
        danger
        loading={removeShare.isPending}
        onConfirm={() =>
          removing &&
          removeShare
            .mutateAsync({ arg: removing.userId })
            .then(() => {
              toast("Compartilhamento removido.", "success");
              setRemoving(null);
            })
            .catch((e) => toast(errorMessage(e), "error"))
        }
      />
      {transferTo && <TransferDialog petId={petId} petName={petName} to={transferTo} onClose={() => setTransferTo(null)} />}

      <PetPartners petId={petId} />
    </div>
  );
}

/** Confirms an ownership transfer with the password (or an e-mail code for Google/Apple-only accounts). */
function TransferDialog({ petId, petName, to, onClose }: { petId: string; petName: string; to: PetShare; onClose: () => void }) {
  const session = useSessionContext();
  const hasPassword = session.data?.user.hasPassword !== false;
  const create = useSharingMutation<{ toUserId: string; password?: string; code?: string }>(petId, "POST", "/ownership-transfers");
  const { toast } = useToast();
  const [ack, setAck] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proofOk = hasPassword ? password.length > 0 : /^\d{6}$/.test(code.trim());

  async function sendCode() {
    setError(null);
    try {
      await api(`/pets/${petId}/ownership-transfers/code`, { method: "POST", partnerId: null });
      setCodeSent(true);
      toast("Enviamos um código para o seu e-mail.", "info");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Transferir ${petName} para ${to.name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ack || !proofOk) return;
          setError(null);
          create
            .mutateAsync({ body: { toUserId: to.userId, ...(hasPassword ? { password } : { code: code.trim() }) } })
            .then(() => {
              toast(`Pedido enviado. ${to.name} precisa aceitar a transferência.`, "success");
              onClose();
            })
            .catch((err) => setError(errorMessage(err)));
        }}
      >
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <p className="font-semibold">Como funciona</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{to.name} recebe um pedido e precisa aceitar (vale por 7 dias).</li>
            <li>Ao aceitar, {to.name} vira o tutor dono de {petName} e você passa a ser uma conta compartilhada (somente leitura e rotina).</li>
            <li>Depois de uma transferência, a propriedade só pode ser passada de novo após 7 dias.</li>
          </ul>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>Entendo que deixarei de ser o tutor dono de {petName} se {to.name} aceitar.</span>
        </label>
        {hasPassword ? (
          <Input id="xfer-password" type="password" label="Sua senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">Sua conta entra com Google ou Apple. Para confirmar, enviaremos um código ao seu e-mail.</p>
            {codeSent && <Input id="xfer-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} label="Código recebido por e-mail" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />}
            <Button type="button" variant="secondary" onClick={() => void sendCode()}>
              <Mail className="h-4 w-4" aria-hidden /> {codeSent ? "Reenviar código" : "Enviar código"}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!ack || !proofOk}>
            <Crown className="h-4 w-4" aria-hidden /> Transferir propriedade
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SharedView({ petId, petName }: { petId: string; petName: string }) {
  const { data } = usePetSharing(petId);
  const leave = useSharingMutation(petId, "POST", "/leave");
  const { toast } = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (!data) return null;
  const me = data.shares[0];
  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-3 text-sm">
        <Avatar src={data.owner.avatarUrl} name={data.owner.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">Tutor dono</p>
          <p className="truncate font-medium">
            {data.owner.name} {handleOf(data.owner) && <span className="text-[var(--muted)]">{handleOf(data.owner)}</span>}
          </p>
        </div>
        <Crown className="h-5 w-5 text-amber-500" aria-hidden />
      </section>
      <div className="rounded-xl border bg-[var(--card)] p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" aria-hidden /> Você é uma conta compartilhada (somente leitura)
        </p>
        <p className="mt-1 text-[var(--muted)]">
          Você vê tudo sobre {petName} e pode marcar as tarefas da rotina como feitas. Alterações no cadastro, saúde, galeria e agendamentos são feitas só pelo tutor dono.
          {me ? ` Compartilhado com você desde ${fmtDate(me.since)}.` : ""}
        </p>
      </div>
      {data.pendingTransfer && (
        <p className="card text-sm">
          {data.owner.name} pediu para transferir {petName} para você. Responda em <Link href="/convites" className="font-medium text-brand-600 underline">Convites</Link>.
        </p>
      )}
      <Button type="button" variant="secondary" className="text-red-600" onClick={() => setConfirm(true)}>
        <LogOut className="h-4 w-4" aria-hidden /> Sair do compartilhamento
      </Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Sair do compartilhamento?"
        description={`Você deixará de ver ${petName}. Para voltar, ${data.owner.name} precisará convidar você de novo.`}
        confirmLabel="Sair"
        danger
        loading={leave.isPending}
        onConfirm={() =>
          leave
            .mutateAsync({})
            .then(() => {
              toast(`Você saiu do compartilhamento de ${petName}.`, "info");
              router.push("/pets");
            })
            .catch((e) => toast(errorMessage(e), "error"))
        }
      />
    </div>
  );
}

type LinkedPartner = { id: string; slug: string; tradeName: string; logoUrl: string | null; since?: string | null };

/** Partners (vets, trainers, shops) that can see this pet; the owner can revoke any of them. */
function PetPartners({ petId }: { petId: string }) {
  const q = usePetResource<LinkedPartner[]>(petId, "partners");
  const revoke = usePetMutation(petId, "partners", "DELETE", ["partners", "detail"]);
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<LinkedPartner | null>(null);
  const partners = q.data ?? [];
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Parceiros com acesso</h3>
      {q.isLoading ? (
        <Spinner />
      ) : partners.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nenhum parceiro acompanha este pet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {partners.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Avatar src={p.logoUrl} name={p.tradeName} size={36} />
              <p className="min-w-0 flex-1 truncate font-medium">{p.tradeName}</p>
              <Button type="button" variant="ghost" className="text-red-600" onClick={() => setConfirm(p)}>
                Remover acesso
              </Button>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <div className="card space-y-3 text-sm" role="alertdialog" aria-label="Confirmar remoção">
          <p>
            <strong>{confirm.tradeName}</strong> deixará de ver e registrar informações deste pet. O histórico já registrado por ele continua na ficha.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={revoke.isPending}
              onClick={() =>
                revoke
                  .mutateAsync({ path: `/${confirm.id}` })
                  .then(() => {
                    toast("Acesso do parceiro removido.", "success");
                    setConfirm(null);
                  })
                  .catch((e) => toast(errorMessage(e), "error"))
              }
            >
              Remover acesso
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
