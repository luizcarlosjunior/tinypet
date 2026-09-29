"use client";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ui";

const MISSING_LABEL: Record<string, string> = {
  email: "E-mail verificado",
  phone: "Celular verificado",
  emailVerified: "E-mail verificado",
  phoneVerified: "Celular verificado",
  logo: "Logomarca",
  address: "Endereço",
  radius: "Área de atendimento (raio)",
  logo_or_address_or_radius: "Logo, endereço ou área de atendimento",
  catalog: "Ao menos 1 item publicado no catálogo",
  catalogItem: "Ao menos 1 item publicado no catálogo",
};

/** `canPublish=false` (STAFF): publishing is owner-only (API 403) → no button, just a hint. */
export function PublishCard({ published, slug, missing, onPublish, loading, canPublish = true }: { published: boolean; slug?: string | null; missing: string[] | null; onPublish: () => void; loading?: boolean; canPublish?: boolean }) {
  return (
    <Card title="Página pública">
      {published ? (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Publicada e visível na busca.
          </p>
          {slug && (
            <Link href={`/p/${slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-300">
              <ExternalLink className="h-4 w-4" aria-hidden /> Ver página pública
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-[var(--muted)]">Para aparecer na busca: e-mail e celular verificados; logo, endereço ou raio de atendimento; e ao menos um item publicado.</p>
          {missing && missing.length > 0 && (
            <ul className="space-y-1" aria-label="Pendências">
              {missing.map((m) => (
                <li key={m} className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {MISSING_LABEL[m] ?? m}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {canPublish ? (
              <Button type="button" onClick={onPublish} loading={loading}>
                Publicar página
              </Button>
            ) : (
              <p className="w-full text-xs text-[var(--muted)]">Apenas o dono do negócio pode publicar a página.</p>
            )}
            <Link href="/painel/perfil" className="btn-secondary">
              Completar perfil
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
