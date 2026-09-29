"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Play, XCircle, UserX, Pencil, Trash2, Info } from "lucide-react";
import { Button, Textarea, Badge } from "@/components/ui";
import { Drawer, ConfirmDialog, Avatar } from "@/components/painel/ui";
import { UploadButton } from "@/components/media/UploadButton";
import { fmtAddress, fmtDate, fmtDateTime, fmtPhone, fmtTime, whatsappLink } from "@/lib/format";
import { useActivePartner } from "@/hooks/use-partner";
import { useAppointment, useAppointmentStatus, useDeleteAppointment } from "@/hooks/use-schedule";
import type { Appointment, TeamMember } from "@/types/api";
import { LocationChip, NavLinks, StatusBadge, apptPets, apptTitle, memberName, RECURRENCE_LABEL } from "./shared";
import { safeHref } from "@tinypet/shared";

export function AppointmentDrawer({ appointment, onClose, onEdit, members }: { appointment: Appointment | null; onClose: () => void; onEdit: (a: Appointment) => void; members: TeamMember[] }) {
  const { partnerId } = useActivePartner();
  const detail = useAppointment(appointment?.id ?? null);
  const a = detail.data ?? appointment;
  const status = useAppointmentStatus();
  const del = useDeleteAppointment();
  const [mode, setMode] = useState<"none" | "complete" | "cancel" | "delete">("none");
  const [report, setReport] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const close = () => {
    setMode("none");
    setReport("");
    setNextSteps("");
    setPhotos([]);
    setReason("");
    onClose();
  };
  if (!a) return null;
  const pets = apptPets(a);
  const member = members.find((m) => m.id === a.membershipId);
  const isFinal = a.status === "COMPLETED" || a.status === "CANCELED" || a.status === "NO_SHOW";
  const phone = a.client?.phones?.find((p) => p.isPrimary)?.number ?? a.client?.phones?.[0]?.number;
  const run = (body: Parameters<typeof status.mutate>[0]["body"]) => status.mutate({ id: a.id, body }, { onSuccess: () => setMode("none") });

  return (
    <Drawer open={!!appointment} onClose={close} title={<span className="flex flex-wrap items-center gap-2">{apptTitle(a)} <StatusBadge status={a.status} /></span>}>
      <div className="space-y-4 text-sm">
        <section className="card space-y-1">
          <p className="text-lg font-semibold">
            {fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}
          </p>
          <p className="text-[var(--muted)]">
            {a.durationMinutes} min · {memberName(member) || "Sem profissional"}
            {a.sessionNumber ? ` · Sessão ${a.sessionNumber}` : ""}
            {a.recurrence && a.recurrence !== "NONE" ? ` · ${RECURRENCE_LABEL[a.recurrence] ?? a.recurrence}` : ""}
          </p>
          <LocationChip type={a.locationType} />
        </section>

        <section className="card">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Cliente e pets</h3>
          {a.client ? (
            <Link href={`/painel/clientes/${a.client.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
              {a.client.name}
            </Link>
          ) : (
            <p className="text-[var(--muted)]">Sem cliente</p>
          )}
          {phone && (
            <p className="text-xs">
              {fmtPhone(phone)} ·{" "}
              <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-300">
                WhatsApp
              </a>
            </p>
          )}
          <ul className="mt-2 flex flex-wrap gap-2">
            {pets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-2 text-xs">
                <Avatar src={p.avatarUrl} name={p.name} size={22} /> {p.name}
              </li>
            ))}
          </ul>
        </section>

        {(a.address || a.locationNotes) && (
          <section className="card">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Como chegar</h3>
            {a.address && (
              <>
                <p>{fmtAddress(a.address)}</p>
                {a.address.complement && <p className="text-xs text-[var(--muted)]">Complemento: {a.address.complement}</p>}
                {a.address.reference && <p className="text-xs text-[var(--muted)]">Referência: {a.address.reference}</p>}
                {a.address.accessNotes && <p className="text-xs text-[var(--muted)]">Acesso: {a.address.accessNotes}</p>}
                {a.locationType === "CLIENT_HOME" && <NavLinks address={a.address} className="mt-2" />}
                {a.travelLeg && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Deslocamento reservado: {fmtTime(a.travelLeg.startsAt)}–{fmtTime(a.travelLeg.endsAt)} · {Number(a.travelLeg.distanceKm).toFixed(1)} km{a.travelLeg.estimated ? " (estimativa)" : ""}
                  </p>
                )}
              </>
            )}
            {a.locationNotes && <p className="mt-1">{a.locationNotes}</p>}
          </section>
        )}

        {a.notes && (
          <section className="card">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Observações</h3>
            <p className="whitespace-pre-wrap">{a.notes}</p>
          </section>
        )}
        {a.cancelReason && (
          <section className="card border-red-200">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Motivo do cancelamento</h3>
            <p>{a.cancelReason}</p>
          </section>
        )}
        {a.status === "COMPLETED" && (a.report || a.nextSteps || a.reportPhotos?.length) && (
          <section className="card">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Relato do atendimento</h3>
            {a.report && <p className="whitespace-pre-wrap">{a.report}</p>}
            {a.nextSteps && (
              <p className="mt-2">
                <strong>Próximos passos:</strong> {a.nextSteps}
              </p>
            )}
            {a.reportPhotos && a.reportPhotos.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {a.reportPhotos.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={safeHref(u)} alt="Foto do atendimento" className="aspect-square rounded-lg object-cover" />
                ))}
              </div>
            )}
          </section>
        )}

        {mode === "complete" && (
          <section className="card space-y-3 border-brand-300">
            <h3 className="font-semibold">Concluir atendimento</h3>
            <Textarea id="ap-report" label="Relato do atendimento" value={report} onChange={(e) => setReport(e.target.value)} />
            <Textarea id="ap-next" label="Próximos passos" className="min-h-[60px]" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} />
            <div>
              <span className="label">Fotos</span>
              {photos.length > 0 && (
                <div className="mb-2 grid grid-cols-4 gap-2">
                  {photos.map((u) => (
                    <div key={u} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={safeHref(u)} alt="" className="aspect-square rounded-lg object-cover" />
                      <button type="button" className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remover foto" onClick={() => setPhotos((p) => p.filter((x) => x !== u))}>
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <UploadButton purpose="ATTACHMENT" partnerId={partnerId} multiple label="Adicionar fotos" onUploaded={(m) => setPhotos((p) => [...p, m.url])} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("none")}>
                Voltar
              </Button>
              <Button type="button" loading={status.isPending} onClick={() => run({ status: "COMPLETED", report: report || null, nextSteps: nextSteps || null, reportPhotos: photos })}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Concluir
              </Button>
            </div>
          </section>
        )}
        {mode === "cancel" && (
          <section className="card space-y-3 border-red-300">
            <h3 className="font-semibold">Cancelar agendamento</h3>
            <Textarea id="ap-reason" label="Motivo" className="min-h-[60px]" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode("none")}>
                Voltar
              </Button>
              <Button type="button" variant="danger" loading={status.isPending} onClick={() => run({ status: "CANCELED", cancelReason: reason || null })}>
                Confirmar cancelamento
              </Button>
            </div>
          </section>
        )}

        {mode === "none" && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {a.status === "REQUESTED" && (
              <Button type="button" loading={status.isPending} onClick={() => run({ status: "CONFIRMED" })}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Confirmar
              </Button>
            )}
            {a.status === "CONFIRMED" && (
              <Button type="button" loading={status.isPending} onClick={() => run({ status: "IN_PROGRESS" })}>
                <Play className="h-4 w-4" aria-hidden /> Iniciar
              </Button>
            )}
            {(a.status === "IN_PROGRESS" || a.status === "CONFIRMED") && (
              <Button type="button" variant={a.status === "IN_PROGRESS" ? "primary" : "secondary"} onClick={() => setMode("complete")}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Concluir
              </Button>
            )}
            {(a.status === "CONFIRMED" || a.status === "IN_PROGRESS") && (
              <Button type="button" variant="secondary" loading={status.isPending} onClick={() => run({ status: "NO_SHOW" })}>
                <UserX className="h-4 w-4" aria-hidden /> Não compareceu
              </Button>
            )}
            {!isFinal && (
              <Button type="button" variant="secondary" onClick={() => setMode("cancel")}>
                <XCircle className="h-4 w-4" aria-hidden /> Cancelar
              </Button>
            )}
            {!isFinal && (
              <Button type="button" variant="ghost" onClick={() => onEdit(a)}>
                <Pencil className="h-4 w-4" aria-hidden /> Editar
              </Button>
            )}
            <Button type="button" variant="ghost" className="text-red-600" onClick={() => setMode("delete")}>
              <Trash2 className="h-4 w-4" aria-hidden /> Excluir
            </Button>
          </div>
        )}
        <p className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
          <Info className="h-3 w-3" aria-hidden /> Criado em {fmtDateTime((a as { createdAt?: string }).createdAt)}
          {a.contractId && (
            <>
              {" · "}
              <Link href={`/painel/financeiro/contratos/${a.contractId}`} className="underline">
                contrato
              </Link>
            </>
          )}
        </p>
        {a.status === "REQUESTED" && <Badge tone="amber">Solicitado pelo tutor — confirme para reservar o horário.</Badge>}
      </div>
      <ConfirmDialog open={mode === "delete"} onClose={() => setMode("none")} onConfirm={() => del.mutate(a.id, { onSuccess: close })} title="Excluir agendamento?" description="O agendamento será removido da agenda. Prefira cancelar quando o tutor precisar ser avisado." confirmLabel="Excluir" danger loading={del.isPending} />
    </Drawer>
  );
}
