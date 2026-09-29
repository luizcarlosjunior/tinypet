"use client";
import { Home, Store, MapPin, Video, Navigation } from "lucide-react";
import { mapsLinks, LOCATION_TYPE_LABEL, APPOINTMENT_STATUS_LABEL } from "@tinypet/shared";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtAddress, fmtTime } from "@/lib/format";
import type { Appointment, AddressRow, PetSummary, TeamMember } from "@/types/api";

export type LocationType = Appointment["locationType"];

export const LOCATION_STYLE: Record<LocationType, { icon: typeof Home; block: string; chip: string; dot: string; label: string }> = {
  CLIENT_HOME: { icon: Home, block: "bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:border-amber-500 dark:text-amber-100", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", dot: "bg-amber-500", label: LOCATION_TYPE_LABEL.CLIENT_HOME },
  PARTNER_VENUE: { icon: Store, block: "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900/40 dark:border-blue-500 dark:text-blue-100", chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200", dot: "bg-blue-500", label: LOCATION_TYPE_LABEL.PARTNER_VENUE },
  OTHER: { icon: MapPin, block: "bg-ink-100 border-ink-400 text-ink-900 dark:bg-ink-800 dark:border-ink-500 dark:text-ink-100", chip: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200", dot: "bg-ink-500", label: LOCATION_TYPE_LABEL.OTHER },
  ONLINE: { icon: Video, block: "bg-violet-100 border-violet-400 text-violet-900 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-100", chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200", dot: "bg-violet-500", label: LOCATION_TYPE_LABEL.ONLINE },
};

export const STATUS_TONE: Record<Appointment["status"], "gray" | "green" | "red" | "amber" | "blue" | "brand"> = {
  REQUESTED: "amber",
  CONFIRMED: "blue",
  IN_PROGRESS: "brand",
  COMPLETED: "green",
  CANCELED: "red",
  NO_SHOW: "gray",
};

export const RECURRENCE_LABEL: Record<string, string> = { NONE: "Não repete", WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal", PACKAGE: "Pacote de sessões" };

export function apptPets(a: Appointment): PetSummary[] {
  return (a.pets ?? []).map((p) => ("pet" in p ? p.pet : p));
}
export function apptTitle(a: Appointment): string {
  return a.title || a.item?.name || "Atendimento";
}
export function memberName(m: TeamMember | undefined | null): string {
  return m?.user?.name ?? m?.jobTitle ?? "Profissional";
}
export function addressLinks(addr: AddressRow | null | undefined) {
  if (!addr) return null;
  const lat = addr.latitude != null ? Number(addr.latitude) : null;
  const lng = addr.longitude != null ? Number(addr.longitude) : null;
  return mapsLinks(lat, lng, fmtAddress(addr));
}

export function LocationChip({ type, className, short }: { type: LocationType; className?: string; short?: boolean }) {
  const s = LOCATION_STYLE[type] ?? LOCATION_STYLE.OTHER;
  const Icon = s.icon;
  return (
    <span className={cn("badge gap-1", s.chip, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {short ? "" : s.label}
      {short && <span className="sr-only">{s.label}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: Appointment["status"] }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{APPOINTMENT_STATUS_LABEL[status] ?? status}</Badge>;
}

export function NavLinks({ address, className, compact }: { address: AddressRow | null | undefined; className?: string; compact?: boolean }) {
  const links = addressLinks(address);
  if (!links) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)} onClick={(e) => e.stopPropagation()}>
      <a href={links.google} target="_blank" rel="noopener noreferrer" className="badge gap-1 bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-100 dark:ring-ink-700" aria-label="Abrir rota no Google Maps">
        <Navigation className="h-3 w-3" aria-hidden /> {compact ? "Maps" : "Google Maps"}
      </a>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" className="badge gap-1 bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-100 dark:ring-ink-700" aria-label="Abrir rota no Waze">
        <Navigation className="h-3 w-3" aria-hidden /> Waze
      </a>
    </span>
  );
}

/** Compact appointment card used in list/day/week views. */
export function AppointmentCard({ a, onClick, compact, showMember, members }: { a: Appointment; onClick?: () => void; compact?: boolean; showMember?: boolean; members?: TeamMember[] }) {
  const s = LOCATION_STYLE[a.locationType] ?? LOCATION_STYLE.OTHER;
  const pets = apptPets(a);
  const member = members?.find((m) => m.id === a.membershipId);
  const finished = a.status === "CANCELED" || a.status === "NO_SHOW";
  return (
    <button type="button" onClick={onClick} className={cn("w-full rounded-xl border-l-4 px-3 py-2 text-left text-sm transition hover:brightness-95 dark:hover:brightness-110", s.block, finished && "opacity-60 line-through decoration-1")} aria-label={`${fmtTime(a.startsAt)} ${apptTitle(a)} ${a.client?.name ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}
        </span>
        <LocationChip type={a.locationType} short={compact} />
      </div>
      <p className="truncate font-medium">{apptTitle(a)}</p>
      {!compact && (
        <>
          <p className="truncate text-xs opacity-80">
            {a.client?.name ?? "Sem cliente"}
            {pets.length > 0 && ` · ${pets.map((p) => p.name).join(", ")}`}
          </p>
          {showMember && member && <p className="truncate text-xs opacity-70">{memberName(member)}</p>}
          {a.locationType === "CLIENT_HOME" && <NavLinks address={a.address} className="mt-1" compact />}
        </>
      )}
    </button>
  );
}
