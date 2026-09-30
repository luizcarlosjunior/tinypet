"use client";
import { useEffect, useState } from "react";
import { AtSign, ExternalLink, Facebook, Instagram, Twitter, Youtube, type LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PET_SOCIAL_NETWORKS, parsePetSocialUsername, petSocialProfileUrl, type PetSocialNetworkKey } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { Button, Empty, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";

type Profile = { network: PetSocialNetworkKey; username: string; updatedAt: string };

const ICON: Partial<Record<PetSocialNetworkKey, LucideIcon>> = { INSTAGRAM: Instagram, FACEBOOK: Facebook, YOUTUBE: Youtube, X: Twitter };

/** Keys under ["pets", petId, …] so the tutor-side `usePetMutation` invalidations reach it too. */
export function usePetSocial(petId: string, partnerId: string | null) {
  return useQuery({ queryKey: ["pets", petId, "social", partnerId], queryFn: () => api<Profile[]>(`/pets/${petId}/social`, { partnerId }), enabled: !!petId });
}

/**
 * "Redes sociais" tab. Users paste a profile URL or the @username; only the username is stored (the API normalizes
 * it too) and links are rebuilt with `petSocialProfileUrl`. `partnerId` = partner panel context (null in the tutor area).
 */
export function PetSocial({ petId, canEdit, partnerId = null }: { petId: string; canEdit: boolean; partnerId?: string | null }) {
  const q = usePetSocial(petId, partnerId);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (q.data) setValues(Object.fromEntries(q.data.map((p) => [p.network, `@${p.username}`])));
  }, [q.data]);

  const save = useMutation({
    mutationFn: (profiles: { network: PetSocialNetworkKey; username: string }[]) => api<Profile[]>(`/pets/${petId}/social`, { method: "PUT", partnerId, json: { profiles } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pets", petId, "social"] }),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <Empty title="Não foi possível carregar as redes sociais" description={errorMessage(q.error)} />;
  const profiles = q.data ?? [];

  const errors: Record<string, string> = {};
  for (const n of PET_SOCIAL_NETWORKS) {
    const v = values[n.key]?.trim();
    if (!v) continue;
    const r = parsePetSocialUsername(n.key, v);
    if (!r.ok) errors[n.key] = r.message;
  }

  /** On blur, a pasted URL becomes "@username" so the user sees exactly what will be saved. */
  function normalize(key: PetSocialNetworkKey) {
    const v = values[key]?.trim();
    if (!v) return;
    const r = parsePetSocialUsername(key, v);
    if (r.ok) setValues((s) => ({ ...s, [key]: `@${r.username}` }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(errors).length) return;
    try {
      await save.mutateAsync(PET_SOCIAL_NETWORKS.map((n) => ({ network: n.key, username: values[n.key]?.trim() ?? "" })).filter((p) => p.username));
      toast("Redes sociais salvas.", "success");
      setEditing(false);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (!editing) {
    return (
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Redes sociais</h3>
          {canEdit && (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              {profiles.length ? "Editar" : "Adicionar redes sociais"}
            </Button>
          )}
        </div>
        {profiles.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{canEdit ? "Nenhuma rede social cadastrada. Adicione o Instagram, TikTok ou outras redes do pet." : "Nenhuma rede social cadastrada."}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {profiles.map((p) => {
              const net = PET_SOCIAL_NETWORKS.find((n) => n.key === p.network)!;
              const Icon = ICON[p.network] ?? AtSign;
              return (
                <li key={p.network}>
                  <a href={petSocialProfileUrl(p.network, p.username)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 rounded-lg border p-3 hover:bg-ink-50 dark:hover:bg-ink-800">
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-[var(--muted)]">{net.label}</span>
                      <span className="block truncate font-medium">@{p.username}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-label="Abrir perfil em nova aba" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <form className="card space-y-4" onSubmit={submit} noValidate>
      <div>
        <h3 className="text-sm font-semibold">Redes sociais</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">Digite o @usuário ou cole o link do perfil — guardamos só o nome de usuário. Deixe em branco para remover.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PET_SOCIAL_NETWORKS.map((n) => (
          <Input
            key={n.key}
            label={n.label}
            placeholder={n.placeholder}
            value={values[n.key] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [n.key]: e.target.value }))}
            onBlur={() => normalize(n.key)}
            error={errors[n.key]}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={500}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.isPending} disabled={Object.keys(errors).length > 0}>
          Salvar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValues(Object.fromEntries(profiles.map((p) => [p.network, `@${p.username}`])));
            setEditing(false);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
