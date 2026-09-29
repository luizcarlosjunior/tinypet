"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientInviteSchema } from "@tinypet/shared";
import type { z } from "zod";
import { Copy, Link2, MessageCircle, Send } from "lucide-react";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useApiMutation, useClientInvites } from "@/hooks/use-crm";
import { fmtDate, fmtPhone, whatsappLink } from "@/lib/format";
import type { Client, ClientInvite } from "@/types/api";

type InviteInput = z.infer<typeof clientInviteSchema>;
const STATUS: Record<ClientInvite["status"], { label: string; tone: "amber" | "green" | "gray" | "red" }> = {
  PENDING: { label: "Pendente", tone: "amber" },
  ACCEPTED: { label: "Aceito", tone: "green" },
  EXPIRED: { label: "Expirado", tone: "gray" },
  CANCELED: { label: "Cancelado", tone: "red" },
};

export function InviteTab({ client }: { client: Client }) {
  const { toast } = useToast();
  const invites = useClientInvites(client.id);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const primaryEmail = client.emails?.find((e) => e.isPrimary)?.address ?? client.emails?.[0]?.address ?? client.primaryEmail ?? "";
  const primaryPhone = client.phones?.find((p) => p.type === "WHATSAPP")?.number ?? client.phones?.find((p) => p.isPrimary)?.number ?? client.phones?.[0]?.number ?? client.primaryPhone ?? "";
  const { register, handleSubmit, formState: { errors } } = useForm<InviteInput>({ resolver: zodResolver(clientInviteSchema), defaultValues: { email: primaryEmail || undefined, phone: primaryPhone || undefined } });
  const send = useApiMutation<InviteInput, ClientInvite & { token?: string }>({
    path: () => `/clients/${client.id}/invite`,
    body: (v) => ({ email: v.email || undefined, phone: v.phone || undefined }),
    invalidate: [["client", client.id, "invites"]],
    success: "Convite enviado",
    onSuccess: (d) => setLastToken(d?.token ?? null),
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = lastToken ? `${origin}/convite/${lastToken}` : null;

  if (client.userId) {
    return (
      <div className="card flex items-start gap-3">
        <Link2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
        <div>
          <p className="font-medium">Vinculado à conta do tutor</p>
          <p className="text-sm text-[var(--muted)]">{client.user ? `${client.user.name} · ${client.user.email}` : "Este cliente já aceitou o convite; os pets estão unificados com a conta dele."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card">
        <h3 className="mb-1 text-sm font-semibold">Convidar para o tinyPet</h3>
        <p className="mb-3 text-sm text-[var(--muted)]">O tutor recebe um link para criar a conta e vincular os pets. Notas internas continuam privadas.</p>
        <form noValidate className="space-y-3" onSubmit={handleSubmit((v) => send.mutate(v))}>
          <Input id="inv-email" type="email" label="E-mail" {...register("email", { setValueAs: (v) => (v ? String(v).trim() : undefined) })} error={errors.email?.message} />
          <Input id="inv-phone" inputMode="tel" label="WhatsApp" {...register("phone", { setValueAs: (v) => (v ? String(v).trim() : undefined) })} error={errors.phone?.message} />
          {errors.root?.message && <p className="text-xs text-red-600">{errors.root.message}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={send.isPending}>
              <Send className="h-4 w-4" aria-hidden /> Enviar convite
            </Button>
          </div>
        </form>
        {link && (
          <div className="mt-4 rounded-xl border p-3 text-sm">
            <p className="mb-2 font-medium">Link do convite</p>
            <p className="break-all text-xs text-[var(--muted)]">{link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => navigator.clipboard.writeText(link).then(() => toast("Link copiado", "success"))}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar
              </Button>
              {primaryPhone && (
                <a href={whatsappLink(primaryPhone, `Olá ${client.name}! Aceite o convite para acompanhar seus pets no tinyPet: ${link}`)} target="_blank" rel="noreferrer" className="btn-secondary h-8 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Enviar por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <h3 className="mb-3 text-sm font-semibold">Convites enviados</h3>
        {invites.isLoading ? (
          <Spinner />
        ) : (invites.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhum convite ainda.</p>
        ) : (
          <ul className="divide-y text-sm">
            {(invites.data ?? []).map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{[i.email, i.phone ? fmtPhone(i.phone) : null].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="text-xs text-[var(--muted)]">
                    Enviado em {fmtDate(i.createdAt)} · expira em {fmtDate(i.expiresAt)}
                    {i.acceptedAt ? ` · aceito em ${fmtDate(i.acceptedAt)}` : ""}
                  </span>
                </span>
                <Badge tone={STATUS[i.status]?.tone ?? "gray"}>{STATUS[i.status]?.label ?? i.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
