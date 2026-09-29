// Response shapes as documented in docs/api-contract.md. Kept intentionally loose (optional fields)
// because the API is implemented concurrently by other agents.

export type Membership = {
  membershipId: string;
  partnerId: string;
  partnerName: string;
  slug: string;
  logoUrl: string | null;
  role: "OWNER" | "STAFF";
  canSeeFinance: boolean;
  plan?: string;
  published?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "EDITOR";
  avatarUrl: string | null;
  ownerTerm: string;
  ownerTermId?: string | null;
  emailVerified?: boolean | string | null;
  phoneVerified?: boolean | string | null;
  plan?: string;
  marketingConsent?: boolean;
  statsConsent?: boolean;
  publicPhotosConsent?: boolean;
  birthDate?: string | null;
  /** false for Google/Apple-only accounts: sensitive actions are confirmed with an e-mail code. */
  hasPassword?: boolean;
  /** Public handle (lowercase, 3–30 chars) used to find the account when sharing pets. */
  username?: string | null;
};

export type AuthPayload = { token: string; user: User; memberships: Membership[] };

export type Species = { id?: string; key: string; label: string; breeds?: Breed[] };
export type Breed = { id: string; name: string; isMixed?: boolean; isOther?: boolean };
export type OwnerTerm = { id: string; label: string; isDefault?: boolean };
export type Brand = { id: string; name: string; lines?: { id: string; name: string }[] };

export type Pet = {
  id: string;
  name: string;
  speciesKey: string;
  species?: { key: string; label: string } | null;
  breedId?: string | null;
  breed?: { id: string; name: string } | null;
  breedOther?: string | null;
  color?: string | null;
  sex?: "MALE" | "FEMALE" | null;
  size?: "SMALL" | "MEDIUM" | "LARGE" | "GIANT" | null;
  birthDate?: string | null;
  approxAgeMonths?: number | null;
  neutered?: boolean | null;
  microchip?: string | null;
  avatarUrl?: string | null;
  temperament?: string | null;
  specialCare?: string | null;
  feedingNotes?: string | null;
  status: "ACTIVE" | "DECEASED";
  deceasedAt?: string | null;
  memorialNote?: string | null;
  ownerId?: string | null;
  createdByPartnerId?: string | null;
  /** @deprecated legacy field (never sent by the API) — use `role`. */
  accessLevel?: "OWNER" | "VIEW" | "EDIT";
  /** Legacy access marker returned by the API ("OWNER" | "PARTNER" | "VIEW" | "EDIT"). */
  access?: string;
  /** Caller's relationship with the pet (tutor side). Shared accounts are read-only except completing routine tasks. */
  role?: PetRole;
  streakDays?: number;
};

// ── pet sharing & ownership transfer ──
export type PetRole = "owner" | "shared";
export type AccountRef = { id: string; name: string; username?: string | null; avatarUrl?: string | null };
export type PetShare = {
  userId: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  since: string;
  transferEligibleAt?: string | null;
  canTransferNow: boolean;
};
export type PetShareInviteOut = { id: string; to: AccountRef; createdAt: string; expiresAt?: string | null };
export type PetSharing = {
  role: PetRole;
  owner: AccountRef;
  ownerSince?: string | null;
  /** When the current owner may transfer again (null = no restriction from a previous transfer). */
  canTransferFrom?: string | null;
  shares: PetShare[];
  invites?: PetShareInviteOut[];
  pendingTransfer?: { id: string; to: AccountRef; createdAt: string; expiresAt?: string | null } | null;
};
export type PetInviteIn = {
  id: string;
  pet: { id: string; name: string; avatarUrl?: string | null; species?: string | { key: string; label: string } | null };
  from: AccountRef;
  createdAt: string;
  expiresAt?: string | null;
};
export type MyPetInvites = { shares: PetInviteIn[]; transfers: PetInviteIn[] };
export type UsernameAvailability = { available: boolean; reason?: string };

export type PetMedia = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  takenAt: string;
  isStory?: boolean;
  expiresAt?: string | null;
  visibility: "PRIVATE" | "FAMILY" | "PARTNERS" | "PUBLIC";
};

export type HistoryEvent = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  partner?: { id: string; tradeName: string } | null;
  attachments?: { url: string; name: string; type?: string }[];
  photos?: string[];
};

export type Vaccination = {
  id: string;
  kind: "VACCINE" | "DEWORMING";
  name: string;
  appliedAt: string;
  nextDueAt?: string | null;
  notes?: string | null;
  partner?: { tradeName: string } | null;
};

export type Measurement = {
  id: string;
  measuredAt: string;
  weightG: number;
  heightCm?: number | null;
  lengthCm?: number | null;
  neckCm?: number | null;
  chestCm?: number | null;
  abdomenCm?: number | null;
  bodyScore?: number | null;
  notes?: string | null;
  vetVerified?: boolean;
  recordedBy?: "OWNER" | "PARTNER" | string;
  partnerId?: string | null;
  partner?: { tradeName: string } | null;
};
export type MeasurementsResponse = {
  items: Measurement[];
  lifeStage?: "PUPPY" | "ADULT" | "SENIOR" | null;
  reference?: { minG: number; maxG: number } | null;
  alerts?: { message: string; pct?: number }[];
};

export type PetSkill = {
  skillId: string;
  name: string;
  level: "LEARNING" | "SOMETIMES" | "MASTERED";
  masteredAt?: string | null;
  validated?: boolean;
  markedBy?: string | null;
  custom?: boolean;
};
export type SkillsResponse = { skills: PetSkill[]; available: { id: string; name: string }[] };
export type SkillComparison = {
  scope: string;
  groupSize: number;
  widened: boolean;
  perSkill: { skillId: string; name: string; pct: number }[];
  summary: { mastered: number; percentile: number };
};

export type TaskRule = { freq: "daily" | "weekly"; days?: number[]; times?: string[] };
export type PetTask = {
  id: string;
  title: string;
  description?: string | null;
  rule?: TaskRule | null;
  dueAt?: string | null;
  status: "ACTIVE" | "PROPOSED" | "PAUSED" | "DONE" | string;
  completedToday?: boolean;
  lastCompletedAt?: string | null;
  proposedBy?: { tradeName: string } | null;
  petId?: string;
  pet?: { id: string; name: string; avatarUrl?: string | null } | null;
};

export type PetFood = {
  id: string;
  type: "DRY" | "WET" | "NATURAL" | "TREAT" | "SUPPLEMENT";
  brand?: { id: string; name: string } | null;
  brandId?: string | null;
  productLine?: { id: string; name: string } | null;
  productLineId?: string | null;
  brandOther?: string | null;
  packageSizeG?: number | null;
  dailyGrams?: number | null;
  lastPurchaseAt?: string | null;
  offersEnabled?: boolean;
  runsOutAt?: string | null;
};
export type FoodSuggestion = {
  partner: { id: string; slug: string; tradeName: string; logoUrl?: string | null; distanceKm?: number | null };
  brand?: { name: string } | null;
  promos?: { id: string; name: string; price?: number | null; promoPrice?: number | null }[];
};

export type Badge = {
  id?: string;
  key: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  earnedAt?: string | null;
  partner?: { tradeName: string } | null;
};

export type Address = {
  id: string;
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
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
};
export type Phone = { id: string; type: "MOBILE" | "LANDLINE" | "WHATSAPP"; number: string; isPrimary?: boolean; verifiedAt?: string | null };
export type Email = { id: string; address: string; isPrimary?: boolean; verifiedAt?: string | null };

export type PartnerSummary = {
  id: string;
  slug: string;
  tradeName: string;
  logoUrl?: string | null;
  types?: { key: string; label: string }[] | string[];
  ratingAvg?: number | null;
  ratingCount?: number;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  featured?: boolean;
  categories?: { key: string; label: string }[] | string[];
  cancellationHours?: number;
};

export type CatalogItem = {
  id: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description?: string | null;
  price?: number | string | null;
  promoPrice?: number | string | null;
  promoUntil?: string | null;
  durationMinutes?: number | null;
  serviceLocations?: ("PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE")[];
  defaultLocation?: "PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE" | null;
  bookable?: boolean;
  speciesKeys?: string[];
  status?: string;
  ratingAvg?: number | null;
  ratingCount?: number;
  media?: { kind: "IMAGE" | "VIDEO"; url: string; thumbUrl?: string | null; isCover?: boolean }[];
  category?: { key: string; label: string } | null;
  partner?: PartnerSummary | null;
  partnerId?: string;
};

export type Review = {
  id: string;
  rating: number;
  comment?: string | null;
  verified?: boolean;
  createdAt: string;
  user?: { name: string; avatarUrl?: string | null } | null;
  reply?: { body: string; createdAt: string } | null;
};

export type PublicPartner = PartnerSummary & {
  description?: string | null;
  items?: CatalogItem[];
  catalogItems?: CatalogItem[];
  venuePhotos?: { id: string; url: string; thumbUrl?: string | null; caption?: string | null }[];
  reviews?: Review[];
  businessHours?: { weekday: number; opensAt: string; closesAt: string; closed?: boolean }[];
  addresses?: Address[];
  address?: Address | null;
  socialLinks?: { network: string; url: string }[];
  phones?: Phone[];
  website?: string | null;
};

export type TravelLeg = { distanceKm?: number | null; minutes?: number | null; estimated?: boolean; alert?: string | null };

export type Appointment = {
  id: string;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  durationMinutes: number;
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  locationType: "CLIENT_HOME" | "PARTNER_VENUE" | "OTHER" | "ONLINE";
  locationNotes?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  report?: string | null;
  nextSteps?: string | null;
  reportPhotos?: string[];
  seriesId?: string | null;
  pets?: { id: string; name: string; avatarUrl?: string | null; speciesKey?: string }[];
  client?: { id: string; name: string; phone?: string | null } | null;
  item?: { id: string; name: string; durationMinutes?: number | null; price?: number | string | null } | null;
  membership?: { id: string; user?: { name: string } | null; name?: string } | null;
  address?: Address | null;
  partner?: PartnerSummary | null;
  travelLeg?: TravelLeg | null;
};

export type Contract = {
  id: string;
  title: string;
  description?: string | null;
  type: "PACKAGE" | "RECURRING" | "SINGLE" | "COURSE";
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED";
  total: number | string;
  discount?: number | string;
  installmentsCount: number;
  sessionsCount?: number | null;
  terms?: string | null;
  acceptedAt?: string | null;
  createdAt?: string;
  partner?: PartnerSummary | null;
  pets?: { id: string; name: string }[];
  items?: { id?: string; description: string; quantity: number; unitPrice: number | string }[];
  installments?: Installment[];
};

export type Installment = {
  id: string;
  number: number;
  dueDate: string;
  amount: number | string;
  paidAmount?: number | string | null;
  status: "PENDING" | "OVERDUE" | "PAID" | "CANCELED";
  contractId?: string;
  contract?: { id: string; title: string; partner?: { tradeName: string } | null } | null;
  partner?: { tradeName: string } | null;
};

export type HomeData = {
  tasksToday: PetTask[];
  upcomingAppointments: Appointment[];
  recentBadges: (Badge & { pet?: { id: string; name: string } | null })[];
  pets: Pet[];
  overdueInstallments: Installment[];
  /** Pending share invites + ownership transfer requests addressed to me. */
  pendingPetInvites?: number;
};

export type Notification = {
  id: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
  data?: { route?: string; [k: string]: unknown } | null;
};

export type Client = {
  id: string;
  name: string;
  notes?: string | null;
  tags?: string[];
  birthDate?: string | null;
  userId?: string | null;
  user?: { id: string; name: string; email: string } | null;
  phones?: Phone[];
  emails?: Email[];
  addresses?: Address[];
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  pets?: Pet[];
  familyMembers?: { id: string; name: string; relationship?: string | null; phone?: string | null }[];
  invites?: ClientInvite[];
};
export type ClientInvite = { id: string; token?: string; email?: string | null; phone?: string | null; acceptedAt?: string | null; createdAt: string };

export type InvitePreview = {
  partner: { id: string; tradeName: string; logoUrl?: string | null; slug?: string };
  clientName: string;
  pets: Pet[];
};

export type DayRoute = {
  stops: {
    appointmentId: string;
    order: number;
    address?: Address | string | null;
    lat?: number | null;
    lng?: number | null;
    startsAt: string;
    legDistanceKm?: number | null;
    legMinutes?: number | null;
    estimated?: boolean;
    alert?: string | null;
    petNames?: string[];
    clientName?: string;
  }[];
  totalKm: number;
  totalMinutes: number;
  googleMapsUrl?: string | null;
  suggestions?: { message: string; savesKm?: number; savesMinutes?: number }[];
};

export type PlanInfo = {
  planKey: string;
  planName?: string;
  limits: { featureKey: string; enabled: boolean; quantity: number | null }[] | Record<string, { enabled: boolean; quantity: number | null }>;
  usage: Record<string, number>;
};

// ───────────────────────────── Blog (docs/blog-contract.md → Public API) ─────────────────────────────

/** Active category tree from `GET /blog/categories` (max depth 2). */
export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  parentId?: string | null;
  postCount?: number;
  children?: BlogCategory[];
};

export type BlogCategoryRef = { id?: string; name: string; slug: string; parentId?: string | null };

/** List item from `GET /blog/posts`. */
export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  coverImageRect?: string | null;
  coverImageSquare?: string | null;
  coverAlt?: string | null;
  publishDate?: string | null;
  readingMinutes?: number | null;
  categories?: BlogCategoryRef[];
  author?: { id?: string; name: string } | null;
  heartsCount?: number;
  commentsCount?: number;
};

/** Full post from `GET /blog/posts/:slug`. `content` is server-sanitized HTML. */
export type BlogPost = BlogPostSummary & {
  content: string;
  tags?: string[] | string | null;
  coverOgImage?: string | null;
  commentsEnabled?: boolean;
  featured?: boolean;
  updatedAt?: string | null;
  /** Present when logged in. */
  viewerHearted?: boolean;
};

/** Old slug → the API answers with the new slug instead of the post. */
export type BlogPostRedirect = { redirectTo: string };
export type BlogPostResponse = BlogPost | BlogPostRedirect;

export type BlogHeartResult = { hearted: boolean; heartsCount: number };

export type BlogComment = {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  parentId?: string | null;
  user: { id: string; name: string; username?: string | null; avatarUrl?: string | null };
  heartsCount: number;
  viewerHearted?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Top-level only (one level of replies, oldest first). */
  replies?: BlogComment[];
};

export type BlogCommentsPage = { items: BlogComment[]; nextCursor: string | null; commentsEnabled?: boolean };
