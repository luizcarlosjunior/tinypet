/** Loose client-side types for API entities consumed by the partner panel and admin. */
export type Id = string;

export type PhoneRow = { id: Id; type: "MOBILE" | "LANDLINE" | "WHATSAPP"; number: string; isPrimary: boolean; verifiedAt?: string | null };
export type EmailRow = { id: Id; address: string; isPrimary: boolean; verifiedAt?: string | null };
export type AddressRow = {
  id: Id;
  label?: string | null;
  zipCode: string;
  street: string;
  number?: string | null;
  complement?: string | null;
  reference?: string | null;
  accessNotes?: string | null;
  district?: string | null;
  city: string;
  state: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isPrimary: boolean;
};
export type FamilyMemberRow = { id: Id; name: string; relationship?: string | null; phone?: string | null; email?: string | null; canAuthorize: boolean; canPickUp: boolean };

export type Membership = {
  membershipId: Id;
  partnerId: Id;
  partnerName: string;
  slug: string;
  logoUrl: string | null;
  role: "OWNER" | "STAFF";
  canSeeFinance: boolean;
  plan?: string;
  published?: boolean;
};
export type SessionUser = { id: Id; name: string; email: string; role: "USER" | "ADMIN" | "EDITOR"; avatarUrl: string | null; ownerTerm?: string; plan?: string };
export type SessionData = { user: SessionUser; memberships: Membership[] };

export type PartnerTypeRef = { id: Id; key: string; label: string };
export type Partner = {
  id: Id;
  slug: string;
  tradeName: string;
  legalName?: string | null;
  description?: string | null;
  documentType?: "CNPJ" | "CPF" | null;
  document?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  plan?: string;
  serviceRadiusKm?: number | null;
  cancellationHours?: number;
  bufferMinutes?: number;
  travelSlackMinutes?: number;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  published: boolean;
  featured?: boolean;
  ratingAvg?: number | string | null;
  ratingCount?: number;
  types?: (PartnerTypeRef | { type: PartnerTypeRef })[];
  socialLinks?: { id?: Id; network: string; url: string }[];
  businessHours?: { id?: Id; weekday: number; opensAt: string; closesAt: string; closed: boolean }[];
  venuePhotos?: VenuePhoto[];
  phones?: PhoneRow[];
  emails?: EmailRow[];
  addresses?: AddressRow[];
  usage?: Record<string, number>;
};
export type VenuePhoto = { id: Id; url: string; thumbUrl?: string | null; caption?: string | null; sortOrder: number };

export type TeamMember = {
  id: Id;
  userId: Id;
  role: "OWNER" | "STAFF";
  canSeeFinance: boolean;
  jobTitle?: string | null;
  baseAddressId?: string | null;
  costPerKm?: number | string | null;
  navApp?: string | null;
  calendarToken?: string | null;
  user?: { id: Id; name: string; email: string; avatarUrl?: string | null };
};

export type PlanLimit = { enabled: boolean; quantity: number | null };
export type PlanInfo = { planKey: string; limits: Record<string, PlanLimit>; usage: Record<string, number> };

export type Species = { id: Id; key: string; label: string; breeds: { id: Id; name: string; isMixed?: boolean; isOther?: boolean }[] };
export type Category = { id: Id; key: string; label: string; subcategories: { id: Id; key: string; label: string; categoryId?: Id }[] };
export type Brand = { id: Id; name: string; status?: string; lines: { id: Id; name: string; status?: string; imageUrl?: string | null; flavors?: { id: Id; name: string; imageUrl: string | null }[] }[] };

export type PetSummary = {
  id: Id;
  name: string;
  avatarUrl?: string | null;
  species?: { key: string; label: string } | null;
  speciesKey?: string;
  breed?: { id: Id; name: string } | null;
  status?: "ACTIVE" | "DECEASED";
};
export type Pet = PetSummary & {
  speciesId?: Id;
  breedId?: Id | null;
  breedOther?: string | null;
  color?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  size?: "SMALL" | "MEDIUM" | "LARGE" | "GIANT" | null;
  birthDate?: string | null;
  approxAgeMonths?: number | null;
  neutered?: boolean | null;
  microchip?: string | null;
  temperament?: string | null;
  specialCare?: string | null;
  feedingNotes?: string | null;
  ownerId?: Id | null;
  createdByPartnerId?: Id | null;
  deceasedAt?: string | null;
  memorialNote?: string | null;
};

export type Client = {
  id: Id;
  name: string;
  notes?: string | null;
  tags?: string[] | null;
  source?: string | null;
  birthDate?: string | null;
  userId?: Id | null;
  user?: { id: Id; name: string; email: string } | null;
  phones?: PhoneRow[];
  emails?: EmailRow[];
  addresses?: AddressRow[];
  familyMembers?: FamilyMemberRow[];
  pets?: (PetSummary | { pet: PetSummary })[];
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  createdAt?: string;
};
export type ClientInvite = { id: Id; email?: string | null; phone?: string | null; status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELED"; expiresAt: string; acceptedAt?: string | null; createdAt: string; token?: string };

export type CatalogMedia = { id?: Id; kind: "IMAGE" | "VIDEO"; url: string; thumbUrl?: string | null; isCover?: boolean; sortOrder?: number };
export type CatalogItem = {
  id: Id;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description?: string | null;
  categoryId: Id;
  subcategoryId?: Id | null;
  category?: { id: Id; label: string } | null;
  subcategory?: { id: Id; label: string } | null;
  price?: number | string | null;
  promoPrice?: number | string | null;
  promoUntil?: string | null;
  durationMinutes?: number | null;
  serviceLocations?: ("PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE")[] | null;
  defaultLocation?: "PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE" | null;
  bookable?: boolean;
  speciesKeys?: string[] | null;
  brandId?: Id | null;
  productLineId?: Id | null;
  status: "DRAFT" | "PUBLISHED" | "PAUSED";
  media?: CatalogMedia[];
  ratingAvg?: number | string | null;
  ratingCount?: number;
};

export type TravelLeg = { id: Id; distanceKm: number | string; durationMinutes: number; estimated: boolean; startsAt: string; endsAt: string };
export type Appointment = {
  id: Id;
  clientId?: Id | null;
  membershipId?: Id | null;
  itemId?: Id | null;
  contractId?: Id | null;
  title?: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  locationType: "CLIENT_HOME" | "PARTNER_VENUE" | "OTHER" | "ONLINE";
  addressId?: Id | null;
  locationNotes?: string | null;
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  recurrence?: string;
  seriesId?: Id | null;
  sessionNumber?: number | null;
  notes?: string | null;
  report?: string | null;
  nextSteps?: string | null;
  reportPhotos?: string[] | null;
  cancelReason?: string | null;
  client?: { id: Id; name: string; phones?: PhoneRow[] } | null;
  membership?: { id: Id; user?: { name: string } | null; jobTitle?: string | null } | null;
  item?: { id: Id; name: string; durationMinutes?: number | null } | null;
  address?: AddressRow | null;
  pets?: (PetSummary | { pet: PetSummary })[];
  travelLeg?: TravelLeg | null;
};

export type DayRouteAlert = { delayMinutes: number; message: string };
export type DayRouteSuggestion =
  | { type: "SHIFT"; appointmentId: Id; suggestedStartsAt: string; message: string }
  | { type: "REORDER"; order: Id[]; savesKm: number; savesMinutes: number; message: string };
export type DayRoute = {
  stops: { appointmentId: Id; order: number; clientName?: string | null; title?: string | null; address?: AddressRow | null; addressText?: string | null; lat?: number | null; lng?: number | null; startsAt: string; endsAt?: string; legDistanceKm?: number | null; legMinutes?: number | null; estimated?: boolean; alert?: DayRouteAlert | null }[];
  totalKm: number;
  totalMinutes: number;
  googleMapsUrl?: string | null;
  suggestions?: DayRouteSuggestion[];
};

export type Availability = { slots: { weekday: number; startsAt: string; endsAt: string }[] };
export type TimeOff = { id: Id; membershipId: Id; startsAt: string; endsAt: string; reason?: string | null };

export type Installment = {
  id: Id;
  contractId: Id;
  number: number;
  dueDate: string;
  amount: number | string;
  paidAmount?: number | string;
  status: "PENDING" | "OVERDUE" | "PAID" | "CANCELED";
  reminderSentAt?: string | null;
  payments?: Payment[];
  contract?: { id: Id; title: string; client?: { id: Id; name: string } | null; installmentsCount?: number } | null;
  daysLate?: number;
};
export type Payment = { id: Id; paidAt: string; amount: number | string; method: string; receiptUrl?: string | null; notes?: string | null };
export type Contract = {
  id: Id;
  clientId: Id;
  client?: { id: Id; name: string } | null;
  type: "PACKAGE" | "RECURRING" | "SINGLE" | "COURSE";
  title: string;
  description?: string | null;
  totalAmount: number | string;
  discount: number | string;
  installmentsCount: number;
  firstDueDate: string;
  periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  sessionsCount?: number | null;
  terms?: string | null;
  acceptedAt?: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED";
  items?: { id: Id; itemId?: Id | null; description: string; quantity: number; unitPrice: number | string }[];
  pets?: (PetSummary | { pet: PetSummary })[];
  installments?: Installment[];
  appointments?: Appointment[];
  netAmount?: number;
  paidAmount?: number;
  balance?: number;
  createdAt?: string;
};
export type Transaction = { id: Id; kind: "INCOME" | "EXPENSE"; category: string; description?: string | null; amount: number | string; occurredAt: string; method?: string | null };
export type FinanceSummary = {
  period?: { from: string; to: string };
  receivable: { total: number; count: number; from: string; to: string };
  overdue: (Installment & { contractTitle?: string; clientName?: string; remaining?: number; daysLate?: number })[];
  overdueTotal?: number;
  receivedByMonth: { month: string; total: number | string }[];
  receivedByMethod: { method: string; label?: string; total: number | string }[];
  receivedByService: { service: string; total: number | string }[];
  cashflow: { month: string; income: number | string; expense: number | string; net?: number | string }[];
  receivedThisMonth?: number | string;
};

export type Lesson = {
  id: Id;
  moduleId?: Id | null;
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  body?: string | null;
  durationMinutes?: number | null;
  exerciseTitle?: string | null;
  exerciseRule?: { freq: "daily" | "weekly"; days?: number[]; times?: string[] } | null;
  sortOrder: number;
  attachments?: { id?: Id; name: string; url: string }[];
};
export type CourseModule = { id: Id; title: string; sortOrder: number; lessons?: Lesson[] };
export type Course = {
  id: Id;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  categoryId?: Id | null;
  speciesKeys?: string[] | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  price?: number | string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  modules?: CourseModule[];
  lessons?: Lesson[];
  ratingAvg?: number | string | null;
  ratingCount?: number;
  _count?: { enrollments?: number; lessons?: number };
};

export type NotificationRow = { id: Id; type: string; title: string; body?: string | null; data?: Record<string, unknown> | null; readAt?: string | null; createdAt: string };

export type Dashboard = {
  today: Appointment[];
  receivable30d: number | string;
  overdue: (Installment & { contractTitle?: string; clientId?: string; clientName?: string; daysLate?: number })[];
  counts: { clients: number; pets: number; appointmentsWeek: number };
};

export type PetHistoryEvent = {
  id: Id;
  type: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  attachments?: { url: string; name: string; type?: string }[] | null;
  partner?: { tradeName: string } | null;
  source?: string;
};
export type Measurement = { id: Id; measuredAt: string; weightG: number; heightCm?: number | string | null; lengthCm?: number | string | null; neckCm?: number | string | null; chestCm?: number | string | null; abdomenCm?: number | string | null; bodyScore?: number | null; notes?: string | null; vetVerified?: boolean; partnerId?: Id | null };
export type Vaccination = { id: Id; kind: "VACCINE" | "DEWORMING"; name: string; appliedAt: string; nextDueAt?: string | null; notes?: string | null; partnerId?: Id | null; measurement?: { id: Id; weightG: number } | null };
export type PetSkillRow = { id?: Id; skillId: Id; name: string; level: "LEARNING" | "SOMETIMES" | "MASTERED"; masteredAt?: string | null; validated: boolean; markedBy?: string | null };
