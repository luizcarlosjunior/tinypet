"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { api, setActivePartnerId } from "@/lib/api-client";
import { Button, PageHeader } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, FieldGroup, QueryState, Tabs } from "@/components/painel/ui";
import { ContactsEditor } from "@/components/forms/ContactsEditor";
import { PublishCard } from "@/components/painel/PublishCard";
import { PartnerDataForm } from "@/components/painel/perfil/PartnerDataForm";
import { LogoCard, VenuePhotosCard } from "@/components/painel/perfil/LogoAndPhotos";
import { BusinessHoursCard, SocialLinksCard } from "@/components/painel/perfil/SocialAndHours";
import { VerifyButton } from "@/components/painel/perfil/VerifyContacts";
import { useActivePartner } from "@/hooks/use-partner";
import { sessionContextKey } from "@/hooks/use-session-context";
import { errorMessage } from "@/lib/errors";

type Tab = "dados" | "midia" | "contatos" | "horarios" | "publicacao";

export default function PerfilPage() {
  const { partnerId, partner, partnerQuery, isOwner, refresh } = useActivePartner();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("dados");
  const [missing, setMissing] = useState<string[] | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const canEdit = true; // OWNER and STAFF can edit the profile; deletion is owner-only

  const publish = useMutation({
    mutationFn: () => api<{ published: boolean; missing: string[] }>(`/partners/${partnerId}/publish`, { method: "POST" }),
    onSuccess: (r) => {
      setMissing(r.missing ?? []);
      if (r.published) toast("Página publicada!", "success");
      else toast("Ainda faltam itens para publicar", "info");
      refresh();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: () => api(`/partners/${partnerId}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast("Parceiro excluído", "success");
      setActivePartnerId(null);
      await qc.invalidateQueries({ queryKey: sessionContextKey });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "ref" });
      router.replace("/painel");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Perfil e página pública"
        description="Dados do negócio, mídia, contatos e publicação."
        actions={
          partner?.slug && (
            <Link href={`/p/${partner.slug}`} target="_blank" className="btn-secondary">
              <ExternalLink className="h-4 w-4" aria-hidden /> Ver página pública
            </Link>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[
          { key: "dados", label: "Dados" },
          { key: "midia", label: "Logo e fotos" },
          { key: "contatos", label: "Contatos e endereços" },
          { key: "horarios", label: "Horários e redes" },
          { key: "publicacao", label: "Publicação" },
        ]}
      />
      <QueryState isLoading={partnerQuery.isLoading} error={partnerQuery.error} retry={() => partnerQuery.refetch()}>
        {partner && (
          <>
            {tab === "dados" && <PartnerDataForm partner={partner} onSaved={refresh} canEdit={canEdit} />}
            {tab === "midia" && (
              <div className="space-y-6">
                <LogoCard partner={partner} onSaved={refresh} canEdit={canEdit} />
                <VenuePhotosCard partner={partner} onSaved={refresh} canEdit={canEdit} />
              </div>
            )}
            {tab === "contatos" && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">E-mail e celular precisam estar verificados para publicar a página. O endereço principal aparece no mapa.</p>
                <ContactsEditor
                  base={`/partners/${partner.id}`}
                  phones={partner.phones ?? []}
                  emails={partner.emails ?? []}
                  addresses={partner.addresses ?? []}
                  invalidateKey={["partner", partner.id]}
                  extraPhone={(p) => (p.isPrimary || (partner.phones ?? []).length === 1 ? <VerifyButton partnerId={partner.id} channel="PHONE" target={p.number} verified={!!partner.phoneVerifiedAt || !!p.verifiedAt} onVerified={refresh} /> : null)}
                  extraEmail={(e) => (e.isPrimary || (partner.emails ?? []).length === 1 ? <VerifyButton partnerId={partner.id} channel="EMAIL" target={e.address} verified={!!partner.emailVerifiedAt || !!e.verifiedAt} onVerified={refresh} /> : null)}
                />
              </div>
            )}
            {tab === "horarios" && (
              <div className="space-y-6">
                <BusinessHoursCard partner={partner} onSaved={refresh} canEdit={canEdit} />
                <SocialLinksCard partner={partner} onSaved={refresh} canEdit={canEdit} />
              </div>
            )}
            {tab === "publicacao" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <PublishCard published={partner.published} slug={partner.slug} missing={missing} onPublish={() => publish.mutate()} loading={publish.isPending} />
                <FieldGroup title="Checklist para publicar">
                  <ul className="space-y-2 text-sm">
                    <CheckItem ok={!!partner.emailVerifiedAt} label="E-mail verificado" />
                    <CheckItem ok={!!partner.phoneVerifiedAt} label="Celular verificado" />
                    <CheckItem ok={!!partner.logoUrl || (partner.addresses ?? []).length > 0 || !!partner.serviceRadiusKm} label="Logo, endereço ou área de atendimento" />
                    <CheckItem ok={(partner.usage?.catalog_items ?? 0) > 0} label="Ao menos um item publicado no catálogo" hint="Confira em Catálogo" />
                  </ul>
                </FieldGroup>
                {isOwner && (
                  <FieldGroup title="Zona de perigo" description="Excluir o parceiro remove a página pública e o acesso da equipe. Os dados ficam retidos conforme a política de privacidade.">
                    <Button type="button" variant="danger" onClick={() => setDelOpen(true)}>
                      Excluir parceiro
                    </Button>
                    <ConfirmDialog open={delOpen} onClose={() => setDelOpen(false)} onConfirm={() => remove.mutate()} title={`Excluir ${partner.tradeName}?`} description="Esta ação não pode ser desfeita pelo painel." confirmLabel="Excluir parceiro" danger loading={remove.isPending} />
                  </FieldGroup>
                )}
              </div>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

function CheckItem({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={ok ? "h-2.5 w-2.5 rounded-full bg-emerald-500" : "h-2.5 w-2.5 rounded-full bg-amber-500"} />
      <span>
        {label}
        <span className="sr-only">{ok ? " (ok)" : " (pendente)"}</span>
      </span>
      {!ok && hint && <span className="text-xs text-[var(--muted)]">· {hint}</span>}
    </li>
  );
}
