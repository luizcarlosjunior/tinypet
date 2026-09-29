"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentSchema, LocationTypeEnum, LOCATION_TYPE_LABEL, RecurrenceEnum, type AppointmentInput, type AddressInput } from "@tinypet/shared";
import { Modal, Button, Input, Select, Textarea } from "@/components/ui";
import { Checkbox } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { ClientSearch, clientPets } from "@/components/forms/ClientSearch";
import { AddressForm } from "@/components/forms/AddressFields";
import { api, ApiClientError } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { fmtAddress, isoToLocal, localToISO, todayISO } from "@/lib/format";
import { useClientDetail, useMembers, useSaveAppointment, useServices } from "@/hooks/use-schedule";
import { useActivePartner } from "@/hooks/use-partner";
import type { Appointment, Client } from "@/types/api";
import { RECURRENCE_LABEL, memberName } from "./shared";

type FormValues = AppointmentInput;

export function AppointmentModal({ open, onClose, editing, initialDate, initialMembershipId, initialClientId, onSaved }: { open: boolean; onClose: () => void; editing?: Appointment | null; initialDate?: string; initialMembershipId?: string | null; initialClientId?: string | null; onSaved?: (a: Appointment) => void }) {
  const { partnerId, membershipId: myMembershipId } = useActivePartner();
  const members = useMembers(partnerId);
  const services = useServices();
  const save = useSaveAppointment();
  const qc = useQueryClient();
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [time, setTime] = useState("09:00");
  const [newAddr, setNewAddr] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { petIds: [], durationMinutes: 60, locationType: "PARTNER_VENUE", recurrence: "NONE", startsAt: "" },
  });
  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = form;
  const locationType = watch("locationType");
  const recurrence = watch("recurrence");
  const clientId = watch("clientId");
  const clientDetail = useClientDetail(clientId ?? null);
  const addresses = clientDetail.data?.addresses ?? client?.addresses ?? [];
  const pets = useMemo(() => clientPets(clientDetail.data ?? client), [clientDetail.data, client]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewAddr(false);
    if (editing) {
      const local = isoToLocal(editing.startsAt);
      setDate(local.slice(0, 10));
      setTime(local.slice(11, 16));
      setClient(editing.client ? ({ id: editing.client.id, name: editing.client.name } as Client) : null);
      reset({
        clientId: editing.clientId ?? null,
        petIds: (editing.pets ?? []).map((p) => ("pet" in p ? p.pet.id : p.id)),
        itemId: editing.itemId ?? null,
        membershipId: editing.membershipId ?? null,
        title: editing.title ?? "",
        startsAt: editing.startsAt,
        durationMinutes: editing.durationMinutes,
        locationType: editing.locationType,
        addressId: editing.addressId ?? null,
        locationNotes: editing.locationNotes ?? "",
        notes: editing.notes ?? "",
        recurrence: "NONE",
      });
    } else {
      setDate(initialDate ?? todayISO());
      setTime("09:00");
      setClient(null);
      reset({ clientId: initialClientId ?? null, petIds: [], itemId: null, membershipId: initialMembershipId ?? myMembershipId ?? null, title: "", startsAt: "", durationMinutes: 60, locationType: "PARTNER_VENUE", addressId: null, locationNotes: "", notes: "", recurrence: "NONE", occurrences: undefined });
    }
  }, [open, editing, initialDate, initialMembershipId, initialClientId, myMembershipId, reset]);

  // Preselected client (e.g. from the client page): hydrate the search box once the detail loads.
  useEffect(() => {
    if (open && !editing && initialClientId && clientDetail.data && clientDetail.data.id === initialClientId) setClient(clientDetail.data);
  }, [open, editing, initialClientId, clientDetail.data]);

  useEffect(() => {
    setValue("startsAt", date && time ? localToISO(`${date}T${time}`) : "");
  }, [date, time, setValue]);

  const addAddress = useMutation({
    mutationFn: (v: AddressInput) => api<{ id: string }>(`/clients/${clientId}/addresses`, { method: "POST", json: v }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["clients", clientId] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      setValue("addressId", a.id);
      setNewAddr(false);
    },
    onError: (e) => setError(e),
  });

  function onPickService(id: string) {
    setValue("itemId", id || null);
    const s = services.data?.find((x) => x.id === id);
    if (s) {
      if (s.durationMinutes) setValue("durationMinutes", s.durationMinutes);
      if (s.defaultLocation) setValue("locationType", s.defaultLocation);
      if (!watch("title")) setValue("title", s.name);
    }
  }

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const body: Partial<AppointmentInput> = { ...v };
    if (v.locationType !== "CLIENT_HOME") body.addressId = null;
    if (v.recurrence === "NONE" || editing) {
      delete body.occurrences;
      if (editing) delete body.recurrence;
    }
    try {
      const a = await save.mutateAsync({ id: editing?.id, body });
      onSaved?.(a);
      onClose();
    } catch (e) {
      setError(e);
    }
  });

  const conflict = error instanceof ApiClientError && error.status === 409;

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar agendamento" : "Novo agendamento"} className="sm:max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <PlanLimitNotice error={error} />
        {!!error && !conflict && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
            {errorMessage(error)}
          </p>
        )}
        {conflict && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
            <strong>Conflito de horário:</strong> {errorMessage(error)} Verifique a disponibilidade, bloqueios e deslocamentos do profissional.
          </p>
        )}

        <Controller
          control={control}
          name="clientId"
          render={({ field }) => (
            <ClientSearch
              value={client}
              onChange={(c) => {
                setClient(c);
                field.onChange(c?.id ?? null);
                setValue("petIds", []);
                setValue("addressId", null);
              }}
            />
          )}
        />

        {pets.length > 0 ? (
          <fieldset>
            <legend className="label">Pets</legend>
            <div className="flex flex-wrap gap-3">
              {pets.map((p) => (
                <Controller
                  key={p.id}
                  control={control}
                  name="petIds"
                  render={({ field }) => <Checkbox label={p.name} checked={field.value.includes(p.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, p.id] : field.value.filter((x) => x !== p.id))} />}
                />
              ))}
            </div>
            {errors.petIds && <p className="mt-1 text-xs text-red-600">{errors.petIds.message}</p>}
          </fieldset>
        ) : (
          clientId && <p className="text-xs text-[var(--muted)]">Este cliente ainda não tem pets cadastrados. {errors.petIds && <span className="text-red-600">{errors.petIds.message}</span>}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="ap-item" label="Serviço do catálogo" value={watch("itemId") ?? ""} onChange={(e) => onPickService(e.target.value)}>
            <option value="">— sem serviço —</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.durationMinutes ? ` (${s.durationMinutes} min)` : ""}
              </option>
            ))}
          </Select>
          <Input id="ap-title" label="Título" placeholder="Ex.: Aula de obediência" {...register("title")} error={errors.title?.message} />
          <Select id="ap-member" label="Profissional" {...register("membershipId", { setValueAs: (v) => v || null })} error={errors.membershipId?.message}>
            <option value="">— sem profissional —</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberName(m)}
              </option>
            ))}
          </Select>
          <Input id="ap-duration" type="number" min={5} max={1440} step={5} label="Duração (min)" {...register("durationMinutes")} error={errors.durationMinutes?.message} />
          <Input id="ap-date" type="date" label="Data" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input id="ap-time" type="time" label="Hora" value={time} onChange={(e) => setTime(e.target.value)} required error={errors.startsAt?.message} />
        </div>

        <fieldset>
          <legend className="label">Local do atendimento</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LocationTypeEnum.options.map((lt) => (
              <label key={lt} className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/20">
                <input type="radio" value={lt} {...register("locationType")} className="accent-brand-500" />
                {LOCATION_TYPE_LABEL[lt]}
              </label>
            ))}
          </div>
        </fieldset>

        {locationType === "CLIENT_HOME" && (
          <div className="rounded-xl border p-3">
            {!clientId && <p className="text-sm text-[var(--muted)]">Escolha o cliente para selecionar o endereço.</p>}
            {clientId && (
              <>
                <span className="label">Endereço do cliente</span>
                {addresses.length === 0 && !newAddr && <p className="text-sm text-[var(--muted)]">Nenhum endereço cadastrado.</p>}
                <div className="space-y-1">
                  {addresses.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="radio" value={a.id} {...register("addressId")} className="mt-1 accent-brand-500" />
                      <span>
                        {a.label && <span className="font-medium">{a.label} · </span>}
                        {fmtAddress(a)}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.addressId && <p className="mt-1 text-xs text-red-600">{errors.addressId.message}</p>}
                {!newAddr ? (
                  <Button type="button" variant="ghost" className="mt-2 h-8 text-xs" onClick={() => setNewAddr(true)}>
                    + Novo endereço
                  </Button>
                ) : (
                  <div className="mt-3 border-t pt-3">
                    <AddressForm compact nested submitting={addAddress.isPending} onCancel={() => setNewAddr(false)} onSubmit={(v) => addAddress.mutate(v)} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {(locationType === "OTHER" || locationType === "ONLINE") && <Input id="ap-locnotes" label={locationType === "ONLINE" ? "Link / instruções" : "Local combinado"} {...register("locationNotes")} />}

        <Textarea id="ap-notes" label="Observações" {...register("notes")} />

        {!editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="ap-rec" label="Recorrência" {...register("recurrence")}>
              {RecurrenceEnum.options.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </Select>
            {recurrence && recurrence !== "NONE" && <Input id="ap-occ" type="number" min={1} max={52} label={recurrence === "PACKAGE" ? "Número de sessões" : "Quantidade de ocorrências"} {...register("occurrences", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })} error={errors.occurrences?.message} />}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {editing ? "Salvar" : "Agendar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
