"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { Button, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { FieldGroup, Table, th, td, ErrorBox } from "@/components/painel/ui";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtDateTime, localToISO, WEEKDAYS } from "@/lib/format";
import { useActivePartner } from "@/hooks/use-partner";
import { useAvailability, useCreateTimeOff, useDeleteTimeOff, useMembers, useSaveAvailability, useTimeOffs } from "@/hooks/use-schedule";
import { memberName } from "@/components/painel/agenda/shared";

type Slot = { weekday: number; startsAt: string; endsAt: string };

export default function DisponibilidadePage() {
  const { partnerId, partner, membershipId: mine, isOwner, refresh } = useActivePartner();
  const members = useMembers(partnerId);
  const [membershipId, setMembershipId] = useState<string>("");
  useEffect(() => {
    if (!membershipId && mine) setMembershipId(mine);
  }, [mine, membershipId]);

  return (
    <div>
      <PageHeader
        title="Disponibilidade e bloqueios"
        description="Horários de trabalho por profissional, folgas e intervalo entre atendimentos."
        actions={
          <Link href="/painel/agenda" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar à agenda
          </Link>
        }
      />
      <div className="mb-4 max-w-sm">
        <Select id="prof" label="Profissional" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
          {(members.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {memberName(m)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AvailabilityEditor membershipId={membershipId || null} />
        <div className="space-y-4">
          <TimeOffs membershipId={membershipId || null} />
          <PartnerSettings partnerId={partnerId} isOwner={isOwner} initial={{ bufferMinutes: partner?.bufferMinutes ?? 0, cancellationHours: partner?.cancellationHours ?? 24, travelSlackMinutes: partner?.travelSlackMinutes ?? 10 }} onSaved={refresh} />
          <IcalCard membershipId={membershipId || null} />
        </div>
      </div>
    </div>
  );
}

function AvailabilityEditor({ membershipId }: { membershipId: string | null }) {
  const q = useAvailability(membershipId);
  const save = useSaveAvailability(membershipId);
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => {
    if (!q.data) return;
    const s = Array.isArray(q.data) ? q.data : q.data.slots ?? [];
    setSlots(s.map((x) => ({ weekday: x.weekday, startsAt: x.startsAt, endsAt: x.endsAt })));
  }, [q.data]);
  const byDay = useMemo(() => WEEKDAYS.map((_, d) => slots.map((s, i) => ({ ...s, i })).filter((s) => s.weekday === d)), [slots]);
  const update = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const copyToWeekdays = () => {
    const mon = slots.filter((s) => s.weekday === 1);
    setSlots((s) => [...s.filter((x) => x.weekday === 0 || x.weekday === 6 || x.weekday === 1), ...[2, 3, 4, 5].flatMap((d) => mon.map((m) => ({ ...m, weekday: d })))]);
  };
  return (
    <FieldGroup
      title="Horários de trabalho"
      description="Janelas semanais em que o profissional atende."
      actions={
        <Button type="button" variant="ghost" className="h-8 text-xs" onClick={copyToWeekdays} title="Copiar segunda-feira para terça a sexta">
          <Copy className="h-3 w-3" aria-hidden /> Copiar seg → sex
        </Button>
      }
    >
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} retry={() => q.refetch()} />}
      <div className="space-y-3">
        {WEEKDAYS.map((name, d) => (
          <div key={d} className="rounded-xl border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{name}</span>
              <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSlots((s) => [...s, { weekday: d, startsAt: "08:00", endsAt: "18:00" }])} aria-label={`Adicionar janela em ${name}`}>
                <Plus className="h-3 w-3" aria-hidden /> Janela
              </Button>
            </div>
            {byDay[d]!.length === 0 && <p className="text-xs text-[var(--muted)]">Não atende</p>}
            {byDay[d]!.map((s) => (
              <div key={s.i} className="mt-1 flex items-center gap-2">
                <input type="time" aria-label={`Início ${name}`} value={s.startsAt} onChange={(e) => update(s.i, { startsAt: e.target.value })} className="input h-8 w-auto py-0" />
                <span className="text-xs">até</span>
                <input type="time" aria-label={`Fim ${name}`} value={s.endsAt} onChange={(e) => update(s.i, { endsAt: e.target.value })} className="input h-8 w-auto py-0" />
                <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover janela" onClick={() => setSlots((x) => x.filter((_, j) => j !== s.i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" loading={save.isPending} disabled={!membershipId} onClick={() => save.mutate(slots.filter((s) => s.startsAt < s.endsAt))}>
          Salvar horários
        </Button>
      </div>
    </FieldGroup>
  );
}

function TimeOffs({ membershipId }: { membershipId: string | null }) {
  const q = useTimeOffs(membershipId);
  const create = useCreateTimeOff(membershipId);
  const del = useDeleteTimeOff(membershipId);
  const [form, setForm] = useState({ startsAt: "", endsAt: "", reason: "" });
  return (
    <FieldGroup title="Bloqueios (folgas, feriados)" description="Períodos indisponíveis para novos agendamentos.">
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.startsAt || !form.endsAt) return;
          create.mutate({ startsAt: localToISO(form.startsAt), endsAt: localToISO(form.endsAt), reason: form.reason || null }, { onSuccess: () => setForm({ startsAt: "", endsAt: "", reason: "" }) });
        }}
      >
        <Input id="to-start" type="datetime-local" label="Início" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
        <Input id="to-end" type="datetime-local" label="Fim" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} required />
        <Input id="to-reason" label="Motivo" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Folga, feriado…" />
        <Button type="submit" loading={create.isPending} disabled={!membershipId}>
          Bloquear
        </Button>
      </form>
      {q.error && <ErrorBox error={q.error} className="mt-3" />}
      <div className="mt-3">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhum bloqueio.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Início</th>
                <th className={th}>Fim</th>
                <th className={th}>Motivo</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className={td}>{fmtDateTime(t.startsAt)}</td>
                  <td className={td}>{fmtDateTime(t.endsAt)}</td>
                  <td className={td}>{t.reason ?? "—"}</td>
                  <td className={td}>
                    <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label="Remover bloqueio" onClick={() => del.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </FieldGroup>
  );
}

function PartnerSettings({ partnerId, isOwner, initial, onSaved }: { partnerId: string | null; isOwner: boolean; initial: { bufferMinutes: number; cancellationHours: number; travelSlackMinutes: number }; onSaved: () => void }) {
  const { toast } = useToast();
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial.bufferMinutes, initial.cancellationHours, initial.travelSlackMinutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => api(`/partners/${partnerId}`, { method: "PATCH", json: v }),
    onSuccess: () => {
      toast("Configurações salvas", "success");
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <FieldGroup title="Regras da agenda" description={isOwner ? "Valem para todos os profissionais do parceiro." : "Somente o dono pode alterar."}>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Input id="st-buffer" type="number" min={0} max={240} label="Intervalo entre atendimentos (min)" value={v.bufferMinutes} onChange={(e) => setV({ ...v, bufferMinutes: Number(e.target.value) })} disabled={!isOwner} />
        <Input id="st-cancel" type="number" min={0} max={720} label="Prazo de cancelamento (h)" value={v.cancellationHours} onChange={(e) => setV({ ...v, cancellationHours: Number(e.target.value) })} disabled={!isOwner} />
        <Input id="st-slack" type="number" min={0} max={120} label="Folga no deslocamento (min)" value={v.travelSlackMinutes} onChange={(e) => setV({ ...v, travelSlackMinutes: Number(e.target.value) })} disabled={!isOwner} />
        {isOwner && (
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Salvar regras
            </Button>
          </div>
        )}
      </form>
    </FieldGroup>
  );
}

function IcalCard({ membershipId }: { membershipId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["schedule", "ical", membershipId ?? ""];
  const current = useQuery({ queryKey: key, queryFn: () => api<{ url: string | null }>(`/schedule/ical?membershipId=${encodeURIComponent(membershipId ?? "")}`), enabled: !!membershipId, retry: 0 });
  const url = current.data?.url ?? null;
  const gen = useMutation({
    // Generating a new link rotates the token (old subscriptions stop working).
    mutationFn: () => api<{ url: string; calendarToken: string }>(`/schedule/ical?membershipId=${encodeURIComponent(membershipId ?? "")}`, { method: "POST" }),
    onSuccess: (d) => {
      qc.setQueryData(key, { url: d.url });
      toast("Link iCal gerado", "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  return (
    <FieldGroup title="Google Calendar / iCal" description="Link de assinatura da agenda deste profissional.">
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly aria-label="Link iCal" value={url} className="input min-w-0 flex-1 text-xs" onFocus={(e) => e.target.select()} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => toast("Link copiado", "success"));
            }}
          >
            <Copy className="h-4 w-4" aria-hidden /> Copiar
          </Button>
          <Button
            type="button"
            variant="ghost"
            loading={gen.isPending}
            onClick={() => {
              if (window.confirm("Gerar um novo link? O link atual deixará de funcionar nos calendários já inscritos.")) gen.mutate();
            }}
          >
            Gerar novo link
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" loading={gen.isPending || current.isLoading} disabled={!membershipId} onClick={() => gen.mutate()}>
          Gerar link iCal
        </Button>
      )}
    </FieldGroup>
  );
}
