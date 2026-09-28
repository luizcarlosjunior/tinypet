"use client";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SocialNetworkEnum } from "@tinypet/shared";
import { api } from "@/lib/api-client";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { FieldGroup } from "@/components/painel/ui";
import { errorMessage } from "@/lib/errors";
import { WEEKDAYS } from "@/lib/format";
import type { Partner } from "@/types/api";

const NETWORKS: { key: (typeof SocialNetworkEnum.options)[number]; label: string; placeholder: string }[] = [
  { key: "INSTAGRAM", label: "Instagram", placeholder: "https://instagram.com/seunegocio" },
  { key: "FACEBOOK", label: "Facebook", placeholder: "https://facebook.com/seunegocio" },
  { key: "TIKTOK", label: "TikTok", placeholder: "https://tiktok.com/@seunegocio" },
  { key: "YOUTUBE", label: "YouTube", placeholder: "https://youtube.com/@seunegocio" },
  { key: "WHATSAPP", label: "WhatsApp", placeholder: "https://wa.me/5511999999999" },
  { key: "LINKEDIN", label: "LinkedIn", placeholder: "https://linkedin.com/company/seunegocio" },
];

export function SocialLinksCard({ partner, onSaved, canEdit }: { partner: Partner; onSaved: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const initial = Object.fromEntries(NETWORKS.map((n) => [n.key, partner.socialLinks?.find((s) => s.network === n.key)?.url ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  useEffect(() => setValues(Object.fromEntries(NETWORKS.map((n) => [n.key, partner.socialLinks?.find((s) => s.network === n.key)?.url ?? ""]))), [partner.socialLinks]);
  const save = useMutation({
    mutationFn: () => api(`/partners/${partner.id}`, { method: "PATCH", json: { socialLinks: NETWORKS.filter((n) => values[n.key]?.trim()).map((n) => ({ network: n.key, url: values[n.key]!.trim() })) } }),
    onSuccess: () => {
      toast("Redes sociais salvas", "success");
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <FieldGroup title="Site e redes sociais">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3"
      >
        <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
          {NETWORKS.map((n) => (
            <Input key={n.key} id={`social-${n.key}`} label={n.label} type="url" placeholder={n.placeholder} value={values[n.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [n.key]: e.target.value }))} />
          ))}
        </fieldset>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Salvar redes
            </Button>
          </div>
        )}
      </form>
    </FieldGroup>
  );
}

type Hours = { weekday: number; opensAt: string; closesAt: string; closed: boolean };
const DEFAULT_HOURS: Hours[] = Array.from({ length: 7 }, (_, i) => ({ weekday: i, opensAt: "08:00", closesAt: "18:00", closed: i === 0 }));

export function BusinessHoursCard({ partner, onSaved, canEdit }: { partner: Partner; onSaved: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const fromPartner = () => DEFAULT_HOURS.map((d) => partner.businessHours?.find((h) => h.weekday === d.weekday) ?? d);
  const [hours, setHours] = useState<Hours[]>(fromPartner);
  useEffect(() => setHours(fromPartner()), [partner.businessHours]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => api(`/partners/${partner.id}`, { method: "PATCH", json: { businessHours: hours } }),
    onSuccess: () => {
      toast("Horário de funcionamento salvo", "success");
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const set = (i: number, patch: Partial<Hours>) => setHours((h) => h.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const copyToAll = (i: number) => setHours((h) => h.map((x) => ({ ...x, opensAt: h[i]!.opensAt, closesAt: h[i]!.closesAt })));
  return (
    <FieldGroup title="Horário de funcionamento">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={!canEdit}>
          <ul className="divide-y">
            {hours.map((h, i) => (
              <li key={h.weekday} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-24 font-medium">{WEEKDAYS[h.weekday]}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-brand-500" checked={!h.closed} onChange={(e) => set(i, { closed: !e.target.checked })} /> Aberto
                </label>
                <input type="time" aria-label={`Abre ${WEEKDAYS[h.weekday]}`} className="input w-auto" value={h.opensAt} disabled={h.closed} onChange={(e) => set(i, { opensAt: e.target.value })} />
                <span aria-hidden>às</span>
                <input type="time" aria-label={`Fecha ${WEEKDAYS[h.weekday]}`} className="input w-auto" value={h.closesAt} disabled={h.closed} onChange={(e) => set(i, { closesAt: e.target.value })} />
                {canEdit && !h.closed && (
                  <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-300" onClick={() => copyToAll(i)}>
                    Aplicar a todos
                  </button>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
        {canEdit && (
          <div className="mt-3 flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Salvar horários
            </Button>
          </div>
        )}
      </form>
    </FieldGroup>
  );
}
