import { MICROCHIP_PROBLEM_MESSAGE, microchipProblem, normalizeMicrochip, normalizeUsername, parsePetSocialUsername, usernameProblem } from "./utils";
import { z } from "zod";

// ───────── primitives ─────────
export const id = z.string().min(1).max(64);
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");
export const money = z.coerce.number().min(0).multipleOf(0.01);
export const email = z.string().trim().max(254, "E-mail muito longo").email("E-mail inválido").toLowerCase();
/** http(s)-only URL. Use for EVERY user-provided URL field (blocks javascript:, data:, etc.). */
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url("URL inválida")
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === "https:" || p === "http:";
    } catch {
      return false;
    }
  }, "URL inválida");
export const phone = z.string().min(8, "Telefone inválido").max(30, "Telefone inválido");
export const cep = z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido");
export const uf = z.string().length(2).toUpperCase();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const SexEnum = z.enum(["MALE", "FEMALE"]);
export const PetSizeEnum = z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]);
export const PetStatusEnum = z.enum(["ACTIVE", "DECEASED"]);
export const PhoneTypeEnum = z.enum(["MOBILE", "LANDLINE", "WHATSAPP"]);
export const MediaVisibilityEnum = z.enum(["PRIVATE", "FAMILY", "PARTNERS", "PUBLIC"]);
export const ItemTypeEnum = z.enum(["PRODUCT", "SERVICE"]);
export const ItemStatusEnum = z.enum(["DRAFT", "PUBLISHED", "PAUSED"]);
export const ServiceLocationEnum = z.enum(["PARTNER_VENUE", "CLIENT_HOME", "ONLINE"]);
export const LocationTypeEnum = z.enum(["CLIENT_HOME", "PARTNER_VENUE", "OTHER", "ONLINE"]);
export const AppointmentStatusEnum = z.enum(["REQUESTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELED", "NO_SHOW"]);
export const RecurrenceEnum = z.enum(["NONE", "WEEKLY", "BIWEEKLY", "MONTHLY", "PACKAGE"]);
export const ContractTypeEnum = z.enum(["PACKAGE", "RECURRING", "SINGLE", "COURSE"]);
export const ContractStatusEnum = z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELED"]);
export const PeriodicityEnum = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]);
export const InstallmentStatusEnum = z.enum(["PENDING", "OVERDUE", "PAID", "CANCELED"]);
export const PaymentMethodEnum = z.enum(["PIX", "CASH", "CARD", "BOLETO", "TRANSFER", "GATEWAY"]);
export const TransactionKindEnum = z.enum(["INCOME", "EXPENSE"]);
export const SkillLevelEnum = z.enum(["LEARNING", "SOMETIMES", "MASTERED"]);
export const FoodTypeEnum = z.enum(["DRY", "WET", "NATURAL", "TREAT", "SUPPLEMENT"]);
export const CourseLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const CourseStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const MembershipRoleEnum = z.enum(["OWNER", "STAFF"]);
export const SocialNetworkEnum = z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "WHATSAPP", "LINKEDIN"]);
export const MediaPurposeEnum = z.enum([
  "PARTNER_LOGO", "USER_AVATAR", "PET_AVATAR", "VENUE_PHOTO", "PET_GALLERY", "CATALOG", "COURSE", "ATTACHMENT", "RECEIPT", "VIDEO_COVER", "PRODUCT_IMAGE",
]);
export const AccessLevelEnum = z.enum(["VIEW", "EDIT"]);
export const VaccinationKindEnum = z.enum(["VACCINE", "DEWORMING"]);

// ───────── auth ─────────
/** Public @handle (see USERNAME_RE). Accepts a leading "@" and any case; stored lowercase. */
export const usernameSchema = z
  .string()
  .max(31)
  .transform(normalizeUsername)
  .superRefine((v, ctx) => {
    const p = usernameProblem(v);
    if (p === "INVALID") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Usuário inválido: use 3 a 30 letras minúsculas, números, ponto ou sublinhado" });
    if (p === "RESERVED") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Este nome de usuário é reservado" });
  });

export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome").max(120),
  email,
  password: z.string().min(8, "Mínimo de 8 caracteres").max(200),
  ownerTermId: id.optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
  marketingConsent: z.boolean().optional().default(false),
  /** Optional public @handle (others can find the account by it to share a pet). */
  username: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), usernameSchema.optional()),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyCodeSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE"]),
  code: z.string().length(6),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  avatarUrl: httpUrl.nullable().optional(),
  birthDate: dateString.nullable().optional(),
  ownerTermId: id.nullable().optional(),
  marketingConsent: z.boolean().optional(),
  publicPhotosConsent: z.boolean().optional(),
  statsConsent: z.boolean().optional(),
  /** Public @handle; null removes it. 409 when taken. */
  username: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), usernameSchema.nullable().optional()),
  /** Explicit acceptance of the current terms/privacy (used by OAuth sign-ups). */
  acceptTerms: z.literal(true).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ───────── contacts ─────────
export const phoneSchema = z.object({
  type: PhoneTypeEnum.default("MOBILE"),
  number: phone,
  isPrimary: z.boolean().optional().default(false),
});
export const emailSchema = z.object({ address: email, isPrimary: z.boolean().optional().default(false) });
export const addressSchema = z.object({
  label: z.string().max(40).optional().nullable(),
  zipCode: cep,
  street: z.string().min(1).max(200),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  accessNotes: z.string().max(1000).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().min(1).max(120),
  state: uf,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});
export type PhoneInput = z.infer<typeof phoneSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type AddressInput = z.infer<typeof addressSchema>;

export const familyMemberSchema = z.object({
  name: z.string().min(1).max(120),
  relationship: z.string().max(60).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: email.optional().nullable(),
  canAuthorize: z.boolean().optional().default(false),
  canPickUp: z.boolean().optional().default(false),
});

// ───────── partner ─────────
export const createPartnerSchema = z.object({
  tradeName: z.string().min(2).max(120),
  typeKeys: z.array(z.string().max(40)).min(1, "Escolha ao menos um tipo").max(20),
  description: z.string().max(2000).optional().nullable(),
  documentType: z.enum(["CNPJ", "CPF"]).optional().nullable(),
  document: z.string().max(20).optional().nullable(),
});
export const updatePartnerSchema = createPartnerSchema.partial().extend({
  legalName: z.string().max(200).optional().nullable(),
  website: httpUrl.optional().nullable().or(z.literal("")),
  logoUrl: httpUrl.optional().nullable(),
  serviceRadiusKm: z.coerce.number().int().min(0).max(500).optional().nullable(),
  cancellationHours: z.coerce.number().int().min(0).max(720).optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(240).optional(),
  travelSlackMinutes: z.coerce.number().int().min(0).max(120).optional(),
  socialLinks: z.array(z.object({ network: SocialNetworkEnum, url: httpUrl })).max(6).optional(),
  businessHours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: timeString, closesAt: timeString, closed: z.boolean().default(false) }))
    .max(14)
    .optional(),
});
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export const venuePhotoSchema = z.object({ url: httpUrl, thumbUrl: httpUrl.optional().nullable(), caption: z.string().max(140).optional().nullable(), sortOrder: z.number().int().optional() });

export const inviteMemberSchema = z.object({
  email,
  role: MembershipRoleEnum.default("STAFF"),
  canSeeFinance: z.boolean().default(false),
  jobTitle: z.string().max(120).optional().nullable(),
});

export const partnerSearchQuery = paginationQuery.extend({
  q: z.string().max(200).optional(),
  type: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  species: z.string().max(60).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional(),
});
export type PartnerSearchQuery = z.infer<typeof partnerSearchQuery>;

// ───────── pets ─────────
export const petSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(120),
  speciesKey: z.string().min(1).max(40),
  breedId: id.optional().nullable(),
  breedOther: z.string().max(120).optional().nullable(),
  color: z.string().max(60).optional().nullable(),
  /** Required when creating a pet; on update it may be changed but not cleared. */
  sex: z.enum(["MALE", "FEMALE"], { errorMap: () => ({ message: "Informe o sexo do pet" }) }),
  size: PetSizeEnum.optional().nullable(),
  birthDate: dateString.optional().nullable(),
  approxAgeMonths: z.coerce.number().int().min(0).max(600).optional().nullable(),
  neutered: z.boolean().optional().nullable(),
  /** Null when the pet has no microchip; otherwise exactly 15 digits (spaces, dots and dashes are ignored). */
  microchip: z.preprocess(
    (v) => (typeof v === "string" ? normalizeMicrochip(v) || null : v),
    z
      .string()
      .superRefine((v, ctx) => {
        const p = microchipProblem(v);
        if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: MICROCHIP_PROBLEM_MESSAGE[p] });
      })
      .nullable(),
  ).optional(),
  avatarUrl: httpUrl.optional().nullable(),
  /** Owner opt-in: public page /pet/<slug> (basic info, PUBLIC gallery items, badges/skills, social profiles). */
  publicProfile: z.boolean().optional(),
  temperament: z.string().max(2000).optional().nullable(),
  specialCare: z.string().max(5000).optional().nullable(),
  feedingNotes: z.string().max(5000).optional().nullable(),
});
export type PetInput = z.infer<typeof petSchema>;
export const updatePetSchema = petSchema.partial();

/** Registering a death is irreversible and must be confirmed with the user's password (or an e-mail code for accounts without a password). */
export const markDeceasedSchema = z.object({
  deceasedAt: dateString,
  memorialNote: z.string().max(1000).optional().nullable(),
  password: z.string().min(1).max(200).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
});

export const petAccessSchema = z.object({ email, level: AccessLevelEnum.default("VIEW") });

/** Pet sharing: the owner invites another account by @username or e-mail. */
export const shareInviteSchema = z.object({ handle: z.string().trim().min(1, "Informe o usuário ou e-mail").max(254) });
/** Ownership transfer: the owner confirms with the password (or an e-mail code for OAuth-only accounts). */
export const ownershipTransferSchema = z.object({
  toUserId: id,
  password: z.string().max(200).optional().nullable(),
  code: z.string().max(12).optional().nullable(),
});

export const petMediaSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  url: httpUrl,
  thumbUrl: httpUrl.optional().nullable(),
  title: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  takenAt: isoDateTime,
  isStory: z.boolean().optional().default(false),
  visibility: MediaVisibilityEnum.optional().default("PRIVATE"),
  sizeBytes: z.number().int().min(0).max(100 * 1024 * 1024).optional().default(0),
});

export const petFoodSchema = z.object({
  type: FoodTypeEnum,
  brandId: id.optional().nullable(),
  productLineId: id.optional().nullable(),
  flavorId: id.optional().nullable(),
  brandOther: z.string().max(120).optional().nullable(),
  packageSizeG: z.coerce.number().int().min(0).optional().nullable(),
  dailyGrams: z.coerce.number().int().min(0).optional().nullable(),
  lastPurchaseAt: dateString.optional().nullable(),
  offersEnabled: z.boolean().optional().default(true),
});

export const bodyMeasurementSchema = z.object({
  measuredAt: dateString,
  weightG: z.coerce.number().int().min(1, "Peso obrigatório"),
  heightCm: z.coerce.number().min(0).optional().nullable(),
  lengthCm: z.coerce.number().min(0).optional().nullable(),
  neckCm: z.coerce.number().min(0).optional().nullable(),
  chestCm: z.coerce.number().min(0).optional().nullable(),
  abdomenCm: z.coerce.number().min(0).optional().nullable(),
  bodyScore: z.coerce.number().int().min(1).max(9).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const petSkillSchema = z.object({
  skillId: id.optional(),
  customName: z.string().min(1).max(120).optional(),
  level: SkillLevelEnum,
  masteredAt: dateString.optional().nullable(),
}).refine((v) => v.skillId || v.customName, { message: "Informe o comando" });

export const skillComparisonQuery = z.object({
  breed: z.coerce.boolean().optional(),
  state: z.coerce.boolean().optional(),
  city: z.coerce.boolean().optional(),
  nearMe: z.coerce.boolean().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

export const vaccinationSchema = z.object({
  kind: VaccinationKindEnum.default("VACCINE"),
  name: z.string().min(1).max(200),
  appliedAt: dateString,
  nextDueAt: dateString.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  /** Optional weight at the dose, in grams (recorded as a body measurement on `appliedAt`). null on update removes it. */
  weightG: z.coerce.number().int().min(1, "Peso inválido").max(1_000_000, "Peso inválido").optional().nullable(),
});

export const historyEventSchema = z.object({
  type: z.enum(["VISIT", "VACCINE", "DEWORMING", "WEIGHT", "ACHIEVEMENT", "MILESTONE", "SKILL", "NOTE", "ATTACHMENT"]),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
  occurredAt: isoDateTime,
  attachments: z.array(z.object({ url: httpUrl, name: z.string().max(200), type: z.string().max(100).optional() })).max(10).optional(),
});

export const taskRuleSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  /** For monthly tasks (1–31; clamps to the last day of shorter months). Defaults to the creation day. */
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  times: z.array(timeString).max(24).optional(),
});
export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  rule: taskRuleSchema.optional().nullable(),
  dueAt: isoDateTime.optional().nullable(),
});
export const taskCompleteSchema = z.object({ forDate: dateString.optional() });
/** POST /pets/:id/tasks/:tid/skip — "não deu hoje" with the reason (e.g. "Estava chovendo"). */
export const taskSkipSchema = z.object({ forDate: dateString.optional(), note: z.string().trim().min(2, "Conte o motivo").max(500) });

// ───────── catalog ─────────
export const catalogItemSchema = z.object({
  type: ItemTypeEnum,
  name: z.string().min(2).max(200),
  description: z.string().max(4000).optional().nullable(),
  categoryId: id,
  subcategoryId: id.optional().nullable(),
  price: money.optional().nullable(),
  promoPrice: money.optional().nullable(),
  promoUntil: isoDateTime.optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional().nullable(),
  serviceLocations: z.array(ServiceLocationEnum).max(3).optional(),
  defaultLocation: ServiceLocationEnum.optional().nullable(),
  bookable: z.boolean().optional().default(false),
  speciesKeys: z.array(z.string().max(40)).max(20).optional(),
  brandId: id.optional().nullable(),
  productLineId: id.optional().nullable(),
  status: ItemStatusEnum.optional().default("DRAFT"),
  media: z
    .array(z.object({ kind: z.enum(["IMAGE", "VIDEO"]), url: httpUrl, thumbUrl: httpUrl.optional().nullable(), isCover: z.boolean().optional(), sortOrder: z.number().int().optional() }))
    .max(10)
    .optional(),
});
export type CatalogItemInput = z.infer<typeof catalogItemSchema>;
export const updateCatalogItemSchema = catalogItemSchema.partial();

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});
export const reviewReplySchema = z.object({ body: z.string().min(1).max(2000) });
export const reportSchema = z.object({ reason: z.string().min(3).max(500) });

// ───────── CRM ─────────
export const clientSchema = z.object({
  name: z.string().min(2).max(200),
  notes: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  source: z.string().max(120).optional().nullable(),
  birthDate: dateString.optional().nullable(),
  emails: z.array(emailSchema).max(10).optional(),
  phones: z.array(phoneSchema).max(10).optional(),
  addresses: z.array(addressSchema).max(10).optional(),
  familyMembers: z.array(familyMemberSchema).max(20).optional(),
});
export type ClientInput = z.infer<typeof clientSchema>;
export const updateClientSchema = clientSchema.partial();

export const clientSearchQuery = paginationQuery.extend({
  q: z.string().max(200).optional(),
  tag: z.string().max(40).optional(),
  species: z.string().max(60).optional(),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const clientInviteSchema = z.object({ email: email.optional(), phone: z.string().max(30).optional() }).refine((v) => v.email || v.phone, {
  message: "Informe e-mail ou telefone",
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1).max(512),
  petMerges: z.array(z.object({ partnerPetId: id, ownerPetId: id.nullable() })).max(50).optional(),
});

// ───────── scheduling ─────────
export const availabilitySchema = z.object({
  slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), startsAt: timeString, endsAt: timeString })).max(50),
});
export const timeOffSchema = z.object({ startsAt: isoDateTime, endsAt: isoDateTime, reason: z.string().max(500).optional().nullable() });

export const appointmentSchema = z.object({
  clientId: id.optional().nullable(),
  petIds: z.array(id).min(1, "Escolha ao menos um pet").max(20),
  itemId: id.optional().nullable(),
  membershipId: id.optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  startsAt: isoDateTime,
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  locationType: LocationTypeEnum,
  addressId: id.optional().nullable(),
  locationNotes: z.string().max(1000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  recurrence: RecurrenceEnum.optional().default("NONE"),
  occurrences: z.coerce.number().int().min(1).max(52).optional(),
  contractId: id.optional().nullable(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export const updateAppointmentSchema = appointmentSchema.partial();

export const appointmentStatusSchema = z.object({
  status: AppointmentStatusEnum,
  cancelReason: z.string().max(500).optional().nullable(),
  report: z.string().max(10000).optional().nullable(),
  nextSteps: z.string().max(5000).optional().nullable(),
  reportPhotos: z.array(httpUrl).max(10).optional(),
});

export const bookingRequestSchema = z.object({
  partnerId: id,
  itemId: id,
  petIds: z.array(id).min(1).max(20),
  startsAt: isoDateTime,
  locationType: LocationTypeEnum.optional(),
  addressId: id.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const slotsQuery = z.object({
  itemId: id,
  date: dateString,
  membershipId: id.optional(),
});

export const agendaQuery = z.object({
  from: isoDateTime.or(dateString),
  to: isoDateTime.or(dateString),
  membershipId: id.optional(),
  clientId: id.optional(),
  status: AppointmentStatusEnum.optional(),
  locationType: LocationTypeEnum.optional(),
});

// ───────── finance ─────────
export const contractSchema = z.object({
  clientId: id,
  petIds: z.array(id).max(20).optional(),
  type: ContractTypeEnum.default("SINGLE"),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional().nullable(),
  items: z.array(z.object({ itemId: id.optional().nullable(), description: z.string().min(1).max(500), quantity: z.coerce.number().int().min(1).max(10000).default(1), unitPrice: money })).min(1).max(50),
  discount: money.optional().default(0),
  installmentsCount: z.coerce.number().int().min(1).max(60),
  firstDueDate: dateString,
  periodicity: PeriodicityEnum.default("MONTHLY"),
  sessionsCount: z.coerce.number().int().min(1).max(200).optional().nullable(),
  terms: z.string().max(20000).optional().nullable(),
  generateAppointments: z
    .object({ startsAt: isoDateTime, durationMinutes: z.coerce.number().int().min(5).max(1440), recurrence: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]), locationType: LocationTypeEnum, addressId: id.optional().nullable(), membershipId: id.optional().nullable(), itemId: id.optional().nullable() })
    .optional(),
});
export type ContractInput = z.infer<typeof contractSchema>;

export const contractStatusSchema = z.object({ status: ContractStatusEnum });
export const contractAcceptSchema = z.object({ accept: z.literal(true) });

export const paymentSchema = z.object({
  paidAt: dateString,
  amount: money.positive(),
  method: PaymentMethodEnum,
  receiptUrl: httpUrl.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const transactionSchema = z.object({
  kind: TransactionKindEnum,
  category: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  amount: money.positive(),
  occurredAt: dateString,
  method: PaymentMethodEnum.optional().nullable(),
});

export const financeReportQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

// ───────── courses ─────────
export const courseSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10000).optional().nullable(),
  coverUrl: httpUrl.optional().nullable(),
  categoryId: id.optional().nullable(),
  speciesKeys: z.array(z.string().max(40)).max(20).optional(),
  level: CourseLevelEnum.default("BEGINNER"),
  price: money.optional().nullable(),
  status: CourseStatusEnum.optional().default("DRAFT"),
});
export const lessonSchema = z.object({
  moduleId: id.optional().nullable(),
  title: z.string().min(1, "Informe o título da aula").max(200),
  description: z.string().max(5000).optional().nullable(),
  videoUrl: httpUrl.optional().nullable(),
  body: z.string().max(20000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  exerciseTitle: z.string().max(200).optional().nullable(),
  exerciseRule: taskRuleSchema.optional().nullable(),
  sortOrder: z.number().int().optional(),
  attachments: z.array(z.object({ name: z.string().max(200), url: httpUrl })).max(10).optional(),
});
export const enrollSchema = z.object({ petIds: z.array(id).min(1).max(20) });
export const lessonProgressSchema = z.object({ completed: z.boolean().optional(), question: z.string().max(2000).optional().nullable() });

// ───────── media ─────────
export const uploadRequestSchema = z.object({
  purpose: MediaPurposeEnum,
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1),
  fileName: z.string().min(1).max(255),
  width: z.number().int().min(1).max(20000).optional(),
  height: z.number().int().min(1).max(20000).optional(),
  durationSeconds: z.number().min(0).max(86400).optional(),
});
export const uploadCompleteSchema = z.object({
  assetId: id,
  crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  /** For videos: a finalized VIDEO_COVER image asset (already cropped to the video aspect) used as the cover/poster. */
  coverAssetId: id.optional(),
});

// ───────── admin ─────────
export const ownerTermSchema = z.object({ label: z.string().min(2).max(120), isDefault: z.boolean().optional(), active: z.boolean().optional(), sortOrder: z.number().int().optional() });
export const categorySchema = z.object({ key: z.string().min(1).max(60), label: z.string().min(1).max(120), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
export const subcategorySchema = categorySchema.extend({ categoryId: id });
export const speciesSchema = z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(120), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
export const breedSchema = z.object({ speciesId: id, name: z.string().min(1).max(120), isMixed: z.boolean().optional(), isOther: z.boolean().optional(), externalName: z.string().trim().max(120).optional().nullable() });
export const brandSchema = z.object({ name: z.string().min(1).max(120), status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() });
export const productLineSchema = z.object({ brandId: id, name: z.string().min(1).max(120), imageUrl: httpUrl.optional().nullable() });
export const productFlavorSchema = z.object({ lineId: id, name: z.string().min(1).max(120), imageUrl: httpUrl.optional().nullable(), status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() });
export const planSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  audience: z.enum(["OWNER", "PARTNER"]),
  priceMonthly: money.optional().nullable(),
  priceYearly: money.optional().nullable(),
  trialDays: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  limits: z.array(z.object({ featureKey: z.string().max(60), enabled: z.boolean().default(true), quantity: z.number().int().nullable().optional() })).max(100).optional(),
});
export const assignPlanSchema = z.object({ planKey: z.string().min(1).max(60) });
export const moderationSchema = z.object({ action: z.enum(["HIDE", "RESTORE", "DISMISS"]) });
export const badgeSchema = z.object({ key: z.string().min(1).max(60), name: z.string().min(1).max(120), description: z.string().max(2000).optional().nullable(), iconUrl: httpUrl.optional().nullable() });
export const grantBadgeSchema = z.object({ petId: id });
export const skillAdminSchema = z.object({ speciesKey: z.string().max(40).optional().nullable(), name: z.string().min(1).max(120), key: z.string().max(60).optional() });
export const lifeStageRuleSchema = z.object({ speciesId: id, size: PetSizeEnum.optional().nullable(), puppyUntilMonths: z.number().int().min(0), seniorFromMonths: z.number().int().min(0) });

export const petReportQuery = paginationQuery.extend({
  species: z.string().max(60).optional(),
  breedId: id.optional(),
  lifeStage: z.enum(["PUPPY", "ADULT", "SENIOR"]).optional(),
  bornFrom: dateString.optional(),
  bornTo: dateString.optional(),
  birthMonth: z.coerce.number().int().min(1).max(12).optional(),
  ageMinMonths: z.coerce.number().int().optional(),
  ageMaxMonths: z.coerce.number().int().optional(),
  state: z.string().max(40).optional(),
  city: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  sex: SexEnum.optional(),
  size: PetSizeEnum.optional(),
  // query strings: "false" must be false (z.coerce.boolean would turn any non-empty string into true)
  neutered: z.preprocess((v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : v === "" ? undefined : v), z.boolean().optional()),
  status: PetStatusEnum.optional(),
  tag: z.string().max(40).optional(),
  groupBy: z.enum(["state", "city", "species", "breed", "lifeStage", "birthMonth", "createdMonth"]).optional(),
});

export const PetSocialNetworkEnum = z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "X", "THREADS", "PINTEREST"]);

/**
 * PUT /pets/:id/social — replaces the pet's social profiles. `username` accepts "@user", "user" or a profile URL and is
 * normalized to the bare lowercase username (only that is stored). Empty usernames are dropped (= remove).
 */
export const petSocialProfilesSchema = z.object({
  profiles: z
    .array(z.object({ network: PetSocialNetworkEnum, username: z.string().max(500) }))
    .max(PetSocialNetworkEnum.options.length)
    .transform((items, ctx) => {
      const out: { network: z.infer<typeof PetSocialNetworkEnum>; username: string }[] = [];
      items.forEach((item, i) => {
        if (!item.username.trim()) return;
        if (out.some((o) => o.network === item.network)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "network"], message: "Rede social repetida" });
          return;
        }
        const r = parsePetSocialUsername(item.network, item.username);
        if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "username"], message: r.message });
        else out.push({ network: item.network, username: r.username });
      });
      return out;
    }),
});

export const MediaReportReasonEnum = z.enum(["NUDITY_SEXUAL", "VIOLENCE_CRUELTY", "HATE_HARASSMENT", "SPAM_SCAM", "PERSONAL_DATA", "NOT_PET_RELATED", "OTHER"]);

/** POST /media/report — `url` is the photo/video URL shown on screen (or its thumbnail). */
export const mediaReportSchema = z
  .object({
    url: z.string().url().max(2000),
    reason: MediaReportReasonEnum,
    details: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => v.reason !== "OTHER" || (v.details?.length ?? 0) >= 5, { path: ["details"], message: "Descreva o motivo da denúncia" });

export const SanctionDurationEnum = z.union([z.literal(7), z.literal(15), z.literal(30), z.literal("PERMANENT")]);

/**
 * POST /admin/media-audit/:assetId — DELETE removes the media everywhere (storage + references) and may sanction the
 * uploader; DISMISS keeps it and may sanction reporters for false reports.
 */
export const mediaAuditDecisionSchema = z
  .object({
    action: z.enum(["DELETE", "DISMISS"]),
    reason: z.string().trim().min(5, "Informe o motivo (será registrado e enviado ao usuário)").max(1000),
    uploader: z
      .object({
        blockIp: z.boolean().default(false),
        account: SanctionDurationEnum.nullable().default(null),
      })
      .optional(),
    /** False reports: per reporter, block the account or only the ability to report. */
    reporters: z
      .array(z.object({ userId: z.string().min(1), type: z.enum(["ACCOUNT", "REPORTS"]), duration: SanctionDurationEnum }))
      .max(100)
      .default([]),
  })
  .refine((v) => v.action === "DELETE" || !v.uploader || (!v.uploader.blockIp && v.uploader.account == null), { path: ["uploader"], message: "Sanção de quem enviou só ao excluir a mídia" })
  .refine((v) => v.action === "DISMISS" || v.reporters.length === 0, { path: ["reporters"], message: "Sanção por denúncia falsa só ao descartar" });
