"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Check, ChevronLeft, Home, MapPin, PawPrint, Video } from "lucide-react";
import { useSessionContext } from "@/hooks/use-session-context";
import { canEditPet, usePets } from "@/hooks/use-pets";
import { useCreateBooking, useSlots } from "@/hooks/use-appointments";
import { useContacts, useContactMutation, type Address } from "@/hooks/use-me";
import { AddressForm } from "@/components/forms/address-form";
import { Avatar } from "@/components/ui/avatar";
import { Button, Empty, Modal, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { addressLine, fmtDateTime, fmtLong, fmtTime, toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatBRL, type AddressInput } from "@tinypet/shared";
import type { PublicItem } from "./types";
import { PriceTag } from "./catalog";

type Loc = "PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE";
const LOC = { PARTNER_VENUE: { icon: MapPin, label: "No estabelecimento" }, CLIENT_HOME: { icon: Home, label: "Na minha casa" }, ONLINE: { icon: Video, label: "Online" } } as const;

export function BookingWizard({ item, slug, partnerId, partnerName }: { item: PublicItem; slug: string; partnerId: string; partnerName: string }) {
  const { isLoggedIn, sessionStatus } = useSessionContext();
  const pathname = usePathname();
  const { toast } = useToast();
  const pets = usePets({ enabled: isLoggedIn });
  const locations = useMemo<Loc[]>(() => (item.serviceLocations?.length ? item.serviceLocations : [item.defaultLocation ?? "PARTNER_VENUE"]), [item]);
  const needsLocation = locations.length > 1 || locations.includes("CLIENT_HOME");

  const [step, setStep] = useState(0);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [date, setDate] = useState<string>(toDateKey());
  const [slot, setSlot] = useState<{ startsAt: string; endsAt: string; membershipId: string } | null>(null);
  const [loc, setLoc] = useState<Loc>(item.defaultLocation && locations.includes(item.defaultLocation) ? item.defaultLocation : locations[0]!);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<{ id?: string; startsAt: string } | null>(null);

  const slots = useSlots(slug, item.id, step >= 1 ? date : null);
  const addresses = useContacts<Address>("addresses", isLoggedIn && loc === "CLIENT_HOME");
  const addrMut = useContactMutation("addresses");
  const [addrOpen, setAddrOpen] = useState(false);
  const booking = useCreateBooking();

  const steps = ["Pet", "Data e horário", ...(needsLocation ? ["Local"] : []), "Confirmar"];
  const confirmStep = steps.length - 1;

  if (sessionStatus === "loading") return <Spinner />;
  if (!isLoggedIn) {
    return (
      <Empty
        title="Entre para agendar"
        description={`Você precisa de uma conta tinyPet para agendar ${item.name} com ${partnerName}.`}
        action={
          <div className="flex gap-2">
            <Link href={`/entrar?next=${encodeURIComponent(pathname)}`} className="btn-primary">
              Entrar
            </Link>
            <Link href={`/cadastro?next=${encodeURIComponent(pathname)}`} className="btn-secondary">
              Criar conta
            </Link>
          </div>
        }
      />
    );
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <CalendarCheck className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold">Solicitação enviada!</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {partnerName} vai confirmar seu horário de <strong>{fmtDateTime(done.startsAt)}</strong>. Você recebe um aviso assim que for confirmado.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/agenda" className="btn-primary">
            Ver minha agenda
          </Link>
          <Link href={`/p/${slug}`} className="btn-secondary">
            Voltar ao parceiro
          </Link>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!slot) return;
    try {
      const r = await booking.mutateAsync({ partnerId, itemId: item.id, petIds, startsAt: slot.startsAt, locationType: loc, addressId: loc === "CLIENT_HOME" ? addressId : null, notes: notes || null });
      setDone({ id: r?.id, startsAt: slot.startsAt });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  // one button per time: the API returns a slot per free professional, but POST /bookings picks the professional itself
  const uniqueSlots = (slots.data ?? []).filter((s, i, all) => all.findIndex((o) => o.startsAt === s.startsAt) === i);
  const canNext = step === 0 ? petIds.length > 0 : step === 1 ? !!slot : needsLocation && step === 2 ? loc !== "CLIENT_HOME" || !!addressId : true;
  // only the owner books: pets shared with me (read-only) are rejected by POST /bookings (403)
  const activePets = (pets.data ?? []).filter((p) => p.status !== "DECEASED" && canEditPet(p));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Etapas">
          {steps.map((s, i) => (
            <li key={s} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1", i === step ? "bg-brand-500 text-white" : i < step ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="h-3 w-3" aria-hidden /> : <span>{i + 1}.</span>} {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="card" aria-labelledby="s-pet">
            <h2 id="s-pet" className="font-semibold">
              Para qual pet?
            </h2>
            {pets.isLoading ? (
              <Spinner className="mt-3" />
            ) : activePets.length === 0 ? (
              <Empty title="Você ainda não tem pets" description="Cadastre seu pet para poder agendar." action={<Link href={`/pets?new=1&next=${encodeURIComponent(pathname)}`} className="btn-primary">Cadastrar pet</Link>} />
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {activePets.map((p) => {
                  const on = petIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3", on && "border-brand-500 bg-brand-50 dark:bg-brand-900/20")}>
                        <input type="checkbox" checked={on} onChange={() => setPetIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="h-4 w-4 accent-brand-500" />
                        <Avatar src={p.avatarUrl} name={p.name} size={36} />
                        <span className="text-sm font-medium">{p.name}</span>
                        <PawPrint className="ml-auto h-4 w-4 text-[var(--muted)]" aria-hidden />
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="card space-y-3" aria-labelledby="s-date">
            <h2 id="s-date" className="font-semibold">
              Quando?
            </h2>
            <div className="max-w-xs">
              <label htmlFor="bk-date" className="label">
                Data
              </label>
              <input id="bk-date" type="date" min={toDateKey()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} className="input" />
            </div>
            <p className="text-sm capitalize text-[var(--muted)]">{fmtLong(date)}</p>
            {slots.isLoading ? (
              <Spinner />
            ) : slots.isError ? (
              <p className="text-sm text-red-600">Não foi possível carregar os horários. Tente outra data.</p>
            ) : uniqueSlots.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sem horários livres nesta data. Escolha outro dia.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Horários disponíveis">
                {uniqueSlots.map((s) => {
                  const on = slot?.startsAt === s.startsAt;
                  return (
                    <li key={s.startsAt}>
                      <button type="button" onClick={() => setSlot(s)} aria-pressed={on} className={cn("rounded-xl border px-3 py-2 text-sm", on ? "border-brand-500 bg-brand-500 text-white" : "hover:bg-ink-100 dark:hover:bg-ink-800")}>
                        {fmtTime(s.startsAt)}
                        {s.membershipName ? <span className="block text-[10px] opacity-80">{s.membershipName}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {needsLocation && step === 2 && (
          <section className="card space-y-3" aria-labelledby="s-loc">
            <h2 id="s-loc" className="font-semibold">
              Onde será o atendimento?
            </h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Local">
              {locations.map((l) => {
                const Icon = LOC[l].icon;
                return (
                  <button key={l} type="button" role="radio" aria-checked={loc === l} onClick={() => setLoc(l)} className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", loc === l ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "")}>
                    <Icon className="h-4 w-4" aria-hidden /> {LOC[l].label}
                  </button>
                );
              })}
            </div>
            {loc === "CLIENT_HOME" && (
              <div>
                <p className="label">Endereço</p>
                {addresses.isLoading ? (
                  <Spinner />
                ) : (
                  <ul className="space-y-2">
                    {(addresses.data ?? []).map((a) => (
                      <li key={a.id}>
                        <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", addressId === a.id && "border-brand-500 bg-brand-50 dark:bg-brand-900/20")}>
                          <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-brand-500" />
                          <span>
                            {a.label && <span className="font-medium">{a.label} · </span>}
                            {addressLine(a)}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" variant="secondary" className="mt-2" onClick={() => setAddrOpen(true)}>
                  Adicionar endereço
                </Button>
                <Modal open={addrOpen} onClose={() => setAddrOpen(false)} title="Novo endereço">
                  <AddressForm
                    loading={addrMut.isPending}
                    onCancel={() => setAddrOpen(false)}
                    onSubmit={async (v: AddressInput) => {
                      try {
                        const created = (await addrMut.mutateAsync({ method: "POST", body: v })) as { id?: string };
                        if (created?.id) setAddressId(created.id);
                        setAddrOpen(false);
                      } catch (e) {
                        toast(errorMessage(e), "error");
                      }
                    }}
                  />
                </Modal>
              </div>
            )}
          </section>
        )}

        {step === confirmStep && (
          <section className="card space-y-3" aria-labelledby="s-confirm">
            <h2 id="s-confirm" className="font-semibold">
              Confirme os detalhes
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--muted)]">Serviço</dt>
              <dd>{item.name}</dd>
              <dt className="text-[var(--muted)]">Pets</dt>
              <dd>{activePets.filter((p) => petIds.includes(p.id)).map((p) => p.name).join(", ")}</dd>
              <dt className="text-[var(--muted)]">Quando</dt>
              <dd>{slot ? fmtDateTime(slot.startsAt) : "—"}</dd>
              <dt className="text-[var(--muted)]">Local</dt>
              <dd>
                {LOC[loc].label}
                {loc === "CLIENT_HOME" && addressId ? ` · ${addressLine(addresses.data?.find((a) => a.id === addressId))}` : ""}
              </dd>
            </dl>
            <Textarea id="bk-notes" label="Observações para o parceiro (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: meu pet fica ansioso com barulho" />
            <p className="text-xs text-[var(--muted)]">O parceiro precisa confirmar a solicitação. Você será avisado.</p>
          </section>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Voltar
          </Button>
          {step < confirmStep ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={submit} loading={booking.isPending}>
              Solicitar agendamento
            </Button>
          )}
        </div>
      </div>

      <aside className="card h-fit space-y-2 text-sm" aria-label="Resumo">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Resumo</p>
        <p className="font-semibold">{item.name}</p>
        <p className="text-[var(--muted)]">{partnerName}</p>
        {item.durationMinutes ? <p>{item.durationMinutes} min</p> : null}
        <PriceTag item={item} />
        {item.price == null ? null : <p className="text-xs text-[var(--muted)]">Valor de referência: {formatBRL(item.price)}</p>}
      </aside>
    </div>
  );
}
