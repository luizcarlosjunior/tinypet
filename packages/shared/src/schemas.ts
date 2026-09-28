import { z } from "zod";

// ───────── primitives ─────────
export const id = z.string().min(1);
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");
export const money = z.coerce.number().min(0).multipleOf(0.01);
export const email = z.string().email("E-mail inválido").toLowerCase();
export const phone = z.string().min(8, "Telefone inválido");
export const cep = z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido");
export const uf = z.string().length(2).toUpperCase();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const SexEnum = z.enum(["MALE", "FEMALE", "UNKNOWN"]);
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
  "PARTNER_LOGO", "USER_AVATAR", "PET_AVATAR", "VENUE_PHOTO", "PET_GALLERY", "CATALOG", "COURSE", "ATTACHMENT", "RECEIPT",
]);
export const AccessLevelEnum = z.enum(["VIEW", "EDIT"]);
export const VaccinationKindEnum = z.enum(["VACCINE", "DEWORMING"]);

// ───────── auth ─────────
export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email,
  password: z.string().min(8, "Mínimo de 8 caracteres"),
  ownerTermId: id.optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
  marketingConsent: z.boolean().optional().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1) });
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyCodeSchema = z.object({
  channel: z.enum(["EMAIL", "PHONE"]),
  code: z.string().length(6),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  birthDate: dateString.nullable().optional(),
  ownerTermId: id.nullable().optional(),
  marketingConsent: z.boolean().optional(),
  publicPhotosConsent: z.boolean().optional(),
  statsConsent: z.boolean().optional(),
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
  street: z.string().min(1),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  accessNotes: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().min(1),
  state: uf,
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});
export type PhoneInput = z.infer<typeof phoneSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type AddressInput = z.infer<typeof addressSchema>;

export const familyMemberSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: email.optional().nullable(),
  canAuthorize: z.boolean().optional().default(false),
  canPickUp: z.boolean().optional().default(false),
});

// ───────── partner ─────────
export const createPartnerSchema = z.object({
  tradeName: z.string().min(2),
  typeKeys: z.array(z.string()).min(1, "Escolha ao menos um tipo"),
  description: z.string().max(2000).optional().nullable(),
  documentType: z.enum(["CNPJ", "CPF"]).optional().nullable(),
  document: z.string().optional().nullable(),
});
export const updatePartnerSchema = createPartnerSchema.partial().extend({
  legalName: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  logoUrl: z.string().url().optional().nullable(),
  serviceRadiusKm: z.coerce.number().int().min(0).max(500).optional().nullable(),
  cancellationHours: z.coerce.number().int().min(0).max(720).optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(240).optional(),
  travelSlackMinutes: z.coerce.number().int().min(0).max(120).optional(),
  socialLinks: z.array(z.object({ network: SocialNetworkEnum, url: z.string().min(1) })).optional(),
  businessHours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: timeString, closesAt: timeString, closed: z.boolean().default(false) }))
    .optional(),
});
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

export const venuePhotoSchema = z.object({ url: z.string().url(), thumbUrl: z.string().url().optional().nullable(), caption: z.string().max(140).optional().nullable(), sortOrder: z.number().int().optional() });

export const inviteMemberSchema = z.object({
  email,
  role: MembershipRoleEnum.default("STAFF"),
  canSeeFinance: z.boolean().default(false),
  jobTitle: z.string().optional().nullable(),
});

export const partnerSearchQuery = paginationQuery.extend({
  q: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  species: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional(),
});
export type PartnerSearchQuery = z.infer<typeof partnerSearchQuery>;

// ───────── pets ─────────
export const petSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  speciesKey: z.string().min(1),
  breedId: id.optional().nullable(),
  breedOther: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sex: SexEnum.optional().nullable(),
  size: PetSizeEnum.optional().nullable(),
  birthDate: dateString.optional().nullable(),
  approxAgeMonths: z.coerce.number().int().min(0).optional().nullable(),
  neutered: z.boolean().optional().nullable(),
  microchip: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  temperament: z.string().optional().nullable(),
  specialCare: z.string().optional().nullable(),
  feedingNotes: z.string().optional().nullable(),
});
export type PetInput = z.infer<typeof petSchema>;
export const updatePetSchema = petSchema.partial();

export const markDeceasedSchema = z.object({ deceasedAt: dateString, memorialNote: z.string().max(1000).optional().nullable() });

export const petAccessSchema = z.object({ email, level: AccessLevelEnum.default("VIEW") });

export const petMediaSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  url: z.string().url(),
  thumbUrl: z.string().url().optional().nullable(),
  title: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  takenAt: isoDateTime,
  isStory: z.boolean().optional().default(false),
  visibility: MediaVisibilityEnum.optional().default("PRIVATE"),
  sizeBytes: z.number().int().min(0).optional().default(0),
});

export const petFoodSchema = z.object({
  type: FoodTypeEnum,
  brandId: id.optional().nullable(),
  productLineId: id.optional().nullable(),
  brandOther: z.string().optional().nullable(),
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
  notes: z.string().optional().nullable(),
});

export const petSkillSchema = z.object({
  skillId: id.optional(),
  customName: z.string().min(1).optional(),
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
  name: z.string().min(1),
  appliedAt: dateString,
  nextDueAt: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const historyEventSchema = z.object({
  type: z.enum(["VISIT", "VACCINE", "DEWORMING", "WEIGHT", "ACHIEVEMENT", "MILESTONE", "SKILL", "NOTE", "ATTACHMENT"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  occurredAt: isoDateTime,
  attachments: z.array(z.object({ url: z.string().url(), name: z.string(), type: z.string().optional() })).optional(),
});

export const taskRuleSchema = z.object({
  freq: z.enum(["daily", "weekly"]),
  days: z.array(z.number().int().min(0).max(6)).optional(),
  times: z.array(timeString).optional(),
});
export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  rule: taskRuleSchema.optional().nullable(),
  dueAt: isoDateTime.optional().nullable(),
});
export const taskCompleteSchema = z.object({ forDate: dateString.optional() });

// ───────── catalog ─────────
export const catalogItemSchema = z.object({
  type: ItemTypeEnum,
  name: z.string().min(2),
  description: z.string().max(4000).optional().nullable(),
  categoryId: id,
  subcategoryId: id.optional().nullable(),
  price: money.optional().nullable(),
  promoPrice: money.optional().nullable(),
  promoUntil: isoDateTime.optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).optional().nullable(),
  serviceLocations: z.array(ServiceLocationEnum).optional(),
  defaultLocation: ServiceLocationEnum.optional().nullable(),
  bookable: z.boolean().optional().default(false),
  speciesKeys: z.array(z.string()).optional(),
  brandId: id.optional().nullable(),
  productLineId: id.optional().nullable(),
  status: ItemStatusEnum.optional().default("DRAFT"),
  media: z
    .array(z.object({ kind: z.enum(["IMAGE", "VIDEO"]), url: z.string().url(), thumbUrl: z.string().url().optional().nullable(), isCover: z.boolean().optional(), sortOrder: z.number().int().optional() }))
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
  name: z.string().min(2),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional().nullable(),
  birthDate: dateString.optional().nullable(),
  emails: z.array(emailSchema).optional(),
  phones: z.array(phoneSchema).optional(),
  addresses: z.array(addressSchema).optional(),
  familyMembers: z.array(familyMemberSchema).optional(),
});
export type ClientInput = z.infer<typeof clientSchema>;
export const updateClientSchema = clientSchema.partial();

export const clientSearchQuery = paginationQuery.extend({
  q: z.string().optional(),
  tag: z.string().optional(),
  species: z.string().optional(),
  birthdayMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const clientInviteSchema = z.object({ email: email.optional(), phone: z.string().optional() }).refine((v) => v.email || v.phone, {
  message: "Informe e-mail ou telefone",
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  petMerges: z.array(z.object({ partnerPetId: id, ownerPetId: id.nullable() })).optional(),
});

// ───────── scheduling ─────────
export const availabilitySchema = z.object({
  slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), startsAt: timeString, endsAt: timeString })),
});
export const timeOffSchema = z.object({ startsAt: isoDateTime, endsAt: isoDateTime, reason: z.string().optional().nullable() });

export const appointmentSchema = z.object({
  clientId: id.optional().nullable(),
  petIds: z.array(id).min(1, "Escolha ao menos um pet"),
  itemId: id.optional().nullable(),
  membershipId: id.optional().nullable(),
  title: z.string().optional().nullable(),
  startsAt: isoDateTime,
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  locationType: LocationTypeEnum,
  addressId: id.optional().nullable(),
  locationNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recurrence: RecurrenceEnum.optional().default("NONE"),
  occurrences: z.coerce.number().int().min(1).max(52).optional(),
  contractId: id.optional().nullable(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export const updateAppointmentSchema = appointmentSchema.partial();

export const appointmentStatusSchema = z.object({
  status: AppointmentStatusEnum,
  cancelReason: z.string().optional().nullable(),
  report: z.string().optional().nullable(),
  nextSteps: z.string().optional().nullable(),
  reportPhotos: z.array(z.string().url()).optional(),
});

export const bookingRequestSchema = z.object({
  partnerId: id,
  itemId: id,
  petIds: z.array(id).min(1),
  startsAt: isoDateTime,
  locationType: LocationTypeEnum.optional(),
  addressId: id.optional().nullable(),
  notes: z.string().optional().nullable(),
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
  status: AppointmentStatusEnum.optional(),
  locationType: LocationTypeEnum.optional(),
});

// ───────── finance ─────────
export const contractSchema = z.object({
  clientId: id,
  petIds: z.array(id).optional(),
  type: ContractTypeEnum.default("SINGLE"),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  items: z.array(z.object({ itemId: id.optional().nullable(), description: z.string().min(1), quantity: z.coerce.number().int().min(1).default(1), unitPrice: money })).min(1),
  discount: money.optional().default(0),
  installmentsCount: z.coerce.number().int().min(1).max(60),
  firstDueDate: dateString,
  periodicity: PeriodicityEnum.default("MONTHLY"),
  sessionsCount: z.coerce.number().int().min(1).max(200).optional().nullable(),
  terms: z.string().optional().nullable(),
  generateAppointments: z
    .object({ startsAt: isoDateTime, durationMinutes: z.coerce.number().int().min(5), recurrence: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]), locationType: LocationTypeEnum, addressId: id.optional().nullable(), membershipId: id.optional().nullable(), itemId: id.optional().nullable() })
    .optional(),
});
export type ContractInput = z.infer<typeof contractSchema>;

export const contractStatusSchema = z.object({ status: ContractStatusEnum });
export const contractAcceptSchema = z.object({ accept: z.literal(true) });

export const paymentSchema = z.object({
  paidAt: dateString,
  amount: money.positive(),
  method: PaymentMethodEnum,
  receiptUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const transactionSchema = z.object({
  kind: TransactionKindEnum,
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: money.positive(),
  occurredAt: dateString,
  method: PaymentMethodEnum.optional().nullable(),
});

export const financeReportQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

// ───────── courses ─────────
export const courseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  categoryId: id.optional().nullable(),
  speciesKeys: z.array(z.string()).optional(),
  level: CourseLevelEnum.default("BEGINNER"),
  price: money.optional().nullable(),
  status: CourseStatusEnum.optional().default("DRAFT"),
});
export const lessonSchema = z.object({
  moduleId: id.optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  body: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  exerciseTitle: z.string().optional().nullable(),
  exerciseRule: taskRuleSchema.optional().nullable(),
  sortOrder: z.number().int().optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional(),
});
export const enrollSchema = z.object({ petIds: z.array(id).min(1) });
export const lessonProgressSchema = z.object({ completed: z.boolean().optional(), question: z.string().optional().nullable() });

// ───────── media ─────────
export const uploadRequestSchema = z.object({
  purpose: MediaPurposeEnum,
  mimeType: z.string(),
  sizeBytes: z.number().int().min(1),
  fileName: z.string().min(1),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  durationSeconds: z.number().optional(),
});
export const uploadCompleteSchema = z.object({ assetId: id, crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional() });

// ───────── admin ─────────
export const ownerTermSchema = z.object({ label: z.string().min(2), isDefault: z.boolean().optional(), active: z.boolean().optional(), sortOrder: z.number().int().optional() });
export const categorySchema = z.object({ key: z.string().min(1), label: z.string().min(1), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
export const subcategorySchema = categorySchema.extend({ categoryId: id });
export const speciesSchema = z.object({ key: z.string().min(1), label: z.string().min(1), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
export const breedSchema = z.object({ speciesId: id, name: z.string().min(1), isMixed: z.boolean().optional(), isOther: z.boolean().optional() });
export const brandSchema = z.object({ name: z.string().min(1), status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() });
export const productLineSchema = z.object({ brandId: id, name: z.string().min(1) });
export const planSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  audience: z.enum(["OWNER", "PARTNER"]),
  priceMonthly: money.optional().nullable(),
  priceYearly: money.optional().nullable(),
  trialDays: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  limits: z.array(z.object({ featureKey: z.string(), enabled: z.boolean().default(true), quantity: z.number().int().nullable().optional() })).optional(),
});
export const assignPlanSchema = z.object({ planKey: z.string().min(1) });
export const moderationSchema = z.object({ action: z.enum(["HIDE", "RESTORE", "DISMISS"]) });
export const badgeSchema = z.object({ key: z.string().min(1), name: z.string().min(1), description: z.string().optional().nullable(), iconUrl: z.string().url().optional().nullable() });
export const grantBadgeSchema = z.object({ petId: id });
export const skillAdminSchema = z.object({ speciesKey: z.string().optional().nullable(), name: z.string().min(1), key: z.string().optional() });
export const lifeStageRuleSchema = z.object({ speciesId: id, size: PetSizeEnum.optional().nullable(), puppyUntilMonths: z.number().int().min(0), seniorFromMonths: z.number().int().min(0) });

export const petReportQuery = paginationQuery.extend({
  species: z.string().optional(),
  breedId: id.optional(),
  lifeStage: z.enum(["PUPPY", "ADULT", "SENIOR"]).optional(),
  bornFrom: dateString.optional(),
  bornTo: dateString.optional(),
  birthMonth: z.coerce.number().int().min(1).max(12).optional(),
  ageMinMonths: z.coerce.number().int().optional(),
  ageMaxMonths: z.coerce.number().int().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  sex: SexEnum.optional(),
  size: PetSizeEnum.optional(),
  neutered: z.coerce.boolean().optional(),
  status: PetStatusEnum.optional(),
  tag: z.string().optional(),
  groupBy: z.enum(["state", "city", "species", "breed", "lifeStage", "birthMonth", "createdMonth"]).optional(),
});
