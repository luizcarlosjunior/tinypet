"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PawPrint } from "lucide-react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { useSessionContext } from "@/hooks/use-session-context";
import { usePets } from "@/hooks/use-pets";
import { Avatar } from "@/components/ui/avatar";
import { Button, Empty, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type Invite = {
  partner: { id: string; tradeName: string; slug: string; logoUrl: string | null };
  clientName: string;
  pets: { id: string; name: string; species?: { label: string } | null; speciesKey?: string; breed?: { name: string } | null; avatarUrl?: string | null }[];
  status?: string;
  expiresAt?: string;
};

export function InviteAccept({ token }: { token: string }) {
  const { isLoggedIn, sessionStatus } = useSessionContext();
  const router = useRouter();
  const { toast } = useToast();
  const invite = useQuery({ queryKey: ["invite", token], queryFn: () => api<Invite>(`/invites/${token}`), retry: false });
  const pets = usePets({ enabled: isLoggedIn });
  const [merges, setMerges] = useState<Record<string, string | null>>({});
  const accept = useMutation({
    mutationFn: () => api("/invites/accept", { method: "POST", json: { token, petMerges: (invite.data?.pets ?? []).map((p) => ({ partnerPetId: p.id, ownerPetId: merges[p.id] ?? null })) } }),
    onSuccess: () => {
      toast("Convite aceito! Seus pets já aparecem na sua conta.", "success");
      router.push("/pets");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (invite.isLoading || sessionStatus === "loading") return <Spinner />;
  if (invite.isError || !invite.data) return <Empty title="Convite inválido ou expirado" description="Peça ao parceiro para enviar um novo convite." action={<Link href="/" className="btn-secondary">Ir para o início</Link>} />;
  const inv = invite.data;
  const next = `/convite/${token}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card flex items-center gap-4">
        <Avatar src={inv.partner.logoUrl} name={inv.partner.tradeName} size={64} square />
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Convite de</p>
          <h1 className="text-xl font-bold">{inv.partner.tradeName}</h1>
          <p className="text-sm text-[var(--muted)]">
            Olá, {inv.clientName}! Vincule sua conta para acompanhar agenda, histórico e contratos com este parceiro.
          </p>
        </div>
      </div>

      <section className="card" aria-labelledby="pets-convite">
        <h2 id="pets-convite" className="font-semibold">
          Pets cadastrados pelo parceiro
        </h2>
        {inv.pets.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nenhum pet ainda. Ao aceitar, vocês ficam vinculados.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {inv.pets.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar src={p.avatarUrl} name={p.name} size={40} />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">{[p.species?.label, p.breed?.name].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                {isLoggedIn && (
                  <div className="sm:w-64">
                    <label htmlFor={`merge-${p.id}`} className="sr-only">
                      Corresponde a qual dos seus pets?
                    </label>
                    <select id={`merge-${p.id}`} value={merges[p.id] ?? ""} onChange={(e) => setMerges((m) => ({ ...m, [p.id]: e.target.value || null }))} className="input h-9 text-sm">
                      <option value="">É um pet novo (adicionar à minha conta)</option>
                      {(pets.data ?? []).map((mine) => (
                        <option key={mine.id} value={mine.id}>
                          É o meu {mine.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--muted)]">
        Ao aceitar, {inv.partner.tradeName} continua responsável pelos dados da própria carteira de clientes e você controla o que compartilha. Veja nossa{" "}
        <Link href="/privacidade" className="underline">
          política de privacidade
        </Link>
        .
      </p>

      {isLoggedIn ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => accept.mutate()} loading={accept.isPending}>
            <PawPrint className="h-4 w-4" aria-hidden /> Aceitar convite
          </Button>
        </div>
      ) : (
        <div className="card text-center">
          <p className="text-sm">Para aceitar, entre ou crie sua conta gratuita.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="btn-primary">
              Criar conta
            </Link>
            <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="btn-secondary">
              Já tenho conta
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
