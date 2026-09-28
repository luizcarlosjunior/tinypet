"use client";
import { useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Button, Empty, Input, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";

type Access = { id?: string; userId: string; level: "VIEW" | "EDIT"; user?: { id: string; name: string; email: string; avatarUrl: string | null } | null };

export function PetFamily({ petId, isOwner }: { petId: string; isOwner: boolean }) {
  const q = usePetResource<Access[]>(petId, "access");
  const add = usePetMutation<{ email: string; level: "VIEW" | "EDIT" }>(petId, "access", "POST", ["access"]);
  const remove = usePetMutation(petId, "access", "DELETE", ["access"]);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"VIEW" | "EDIT">("VIEW");

  if (q.isLoading) return <Spinner />;
  const list = q.data ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">Compartilhe a ficha com familiares. Quem tem acesso vê (ou edita) o pet na própria conta tinyPet.</p>
      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutateAsync({ body: { email: email.trim().toLowerCase(), level } })
              .then(() => {
                toast("Acesso concedido.", "success");
                setEmail("");
              })
              .catch((err) => toast(errorMessage(err, "Não encontramos uma conta com este e-mail."), "error"));
          }}
          className="card grid gap-3 sm:grid-cols-[1fr_160px_auto]"
        >
          <Input id="fam-email" type="email" label="E-mail do familiar" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Select id="fam-level" label="Permissão" value={level} onChange={(e) => setLevel(e.target.value as "VIEW" | "EDIT")}>
            <option value="VIEW">Ver</option>
            <option value="EDIT">Editar</option>
          </Select>
          <div className="flex items-end">
            <Button type="submit" loading={add.isPending}>
              <UserPlus className="h-4 w-4" aria-hidden /> Convidar
            </Button>
          </div>
        </form>
      )}
      {list.length === 0 ? (
        <Empty title="Ninguém mais tem acesso" description="Adicione familiares pelo e-mail da conta tinyPet deles." />
      ) : (
        <ul className="divide-y rounded-2xl border">
          {list.map((a) => (
            <li key={a.userId} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Avatar src={a.user?.avatarUrl} name={a.user?.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.user?.name ?? a.userId}</p>
                <p className="truncate text-xs text-[var(--muted)]">{a.user?.email}</p>
              </div>
              <Badge tone={a.level === "EDIT" ? "brand" : "gray"}>{a.level === "EDIT" ? "Edita" : "Vê"}</Badge>
              {isOwner && (
                <button type="button" onClick={() => remove.mutateAsync({ path: `/${a.userId}` }).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label={`Remover acesso de ${a.user?.name ?? "usuário"}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
        <Users className="h-3.5 w-3.5" aria-hidden /> Tarefas marcadas por familiares aparecem no histórico com o nome de quem fez.
      </p>
    </div>
  );
}
