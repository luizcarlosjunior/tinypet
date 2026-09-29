export const APP_NAME = "tinyPet";
export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const CURRENCY = "BRL";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const LOGO_MAX_PX = 1000;
export const AVATAR_PX = 512;
export const GALLERY_MAX_PX = 1920;
export const VENUE_PHOTOS_MAX = 10;
export const CATALOG_MEDIA_MAX = 10;
export const VIDEO_ASPECT_TOLERANCE = 0.02;

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
/** Accepted as SOURCE on the device. Every video is transcoded on the client (web/app) to VIDEO_OUTPUT before upload. */
export const VIDEO_SOURCE_MIME = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/3gpp"] as const;
/** The only video format the API accepts for upload: the client-side transcoder output. */
export const VIDEO_MIME = ["video/mp4"] as const;

/**
 * Client-side video transcoding target (web and app), enforced again by the API on the uploaded file.
 * - Container MP4, video H.264 (avc1), audio AAC (mp4a).
 * - 1080p when the source short side is ≥ 1080 px, else 720p. Landscape sources → 16:9, portrait → 9:16
 *   (center crop when the source aspect differs).
 * - Video bitrate ≤ 1 Mbps, audio bitrate ≤ 128 kbps.
 */
export const VIDEO_OUTPUT = {
  mimeType: "video/mp4",
  videoCodec: "avc",
  audioCodec: "aac",
  maxVideoBitrate: 1_000_000,
  maxAudioBitrate: 128_000,
  /** Allowed output frame sizes [width, height]. */
  sizes: {
    "1080p": { landscape: [1920, 1080], portrait: [1080, 1920] },
    "720p": { landscape: [1280, 720], portrait: [720, 1280] },
  },
  /** Server tolerance on the measured average bitrate (container overhead, VBR peaks). */
  bitrateTolerance: 0.1,
} as const;

export type VideoOutputSize = { width: number; height: number; label: "1080p" | "720p"; orientation: "landscape" | "portrait" };

/** Picks the output frame for a source video, following VIDEO_OUTPUT rules. */
export function videoOutputSize(sourceWidth: number, sourceHeight: number): VideoOutputSize {
  const orientation = sourceWidth >= sourceHeight ? "landscape" : "portrait";
  const shortSide = Math.min(sourceWidth, sourceHeight);
  const label = shortSide >= 1080 ? "1080p" : "720p";
  const [width, height] = VIDEO_OUTPUT.sizes[label][orientation];
  return { width, height, label, orientation };
}

/** True when width×height is one of the allowed VIDEO_OUTPUT frame sizes. */
export function isAllowedVideoFrame(width: number, height: number): boolean {
  return Object.values(VIDEO_OUTPUT.sizes).some((s) => (s.landscape[0] === width && s.landscape[1] === height) || (s.portrait[0] === width && s.portrait[1] === height));
}

/** Video cover images are cropped to the video aspect (16:9 or 9:16) and stored with this long side. */
export const VIDEO_COVER_MAX_PX = 1280;

export const SPECIES = [
  { key: "dog", label: "Cachorro" },
  { key: "cat", label: "Gato" },
  { key: "bird", label: "Pássaro" },
  { key: "turtle", label: "Tartaruga" },
  { key: "fish", label: "Peixe" },
  { key: "rodent", label: "Roedor" },
  { key: "reptile", label: "Réptil" },
  { key: "other", label: "Outro" },
] as const;
export type SpeciesKey = (typeof SPECIES)[number]["key"];

export const PARTNER_TYPES = [
  { key: "trainer", label: "Treinador / adestrador" },
  { key: "vet_clinic", label: "Clínica veterinária" },
  { key: "specialty_store", label: "Loja especializada" },
  { key: "pet_shop", label: "Pet shop" },
] as const;
export type PartnerTypeKey = (typeof PARTNER_TYPES)[number]["key"];

export const OWNER_TERMS = ["Tutor", "Dono", "Pai de pet", "Mãe de pet", "Responsável"] as const;

export const LIFE_STAGES = ["PUPPY", "ADULT", "SENIOR"] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];
export const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  PUPPY: "Filhote",
  ADULT: "Adulto",
  SENIOR: "Idoso",
};

/** Feature keys used by the plan-limit engine. */
export const FEATURES = {
  // partner
  courses: "courses",
  lessons_per_course: "lessons_per_course",
  paid_courses: "paid_courses",
  catalog_items: "catalog_items",
  crm_clients: "crm_clients",
  team_members: "team_members",
  online_booking: "online_booking",
  active_contracts: "active_contracts",
  storage_mb: "storage_mb",
  whatsapp_reminders: "whatsapp_reminders",
  custom_badges: "custom_badges",
  search_highlight: "search_highlight",
  advanced_reports: "advanced_reports",
  videos_per_day: "videos_per_day",
  video_max_seconds: "video_max_seconds",
  // owner
  owner_pets: "owner_pets",
  owner_gallery: "owner_gallery",
  owner_stories: "owner_stories",
  owner_storage_mb: "owner_storage_mb",
  owner_videos_per_day: "owner_videos_per_day",
  owner_video_max_seconds: "owner_video_max_seconds",
} as const;
export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const APPOINTMENT_STATUS_LABEL = {
  REQUESTED: "Solicitada",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
  NO_SHOW: "Não compareceu",
} as const;

export const LOCATION_TYPE_LABEL = {
  CLIENT_HOME: "Na casa do cliente",
  PARTNER_VENUE: "No estabelecimento",
  OTHER: "Outro local",
  ONLINE: "Online",
} as const;

export const INSTALLMENT_STATUS_LABEL = {
  PENDING: "A vencer",
  OVERDUE: "Vencida",
  PAID: "Paga",
  CANCELED: "Cancelada",
} as const;

export const PAYMENT_METHOD_LABEL = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CARD: "Cartão",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
  GATEWAY: "Online",
} as const;

export const SYSTEM_BADGES = [
  { key: "first_steps", name: "Primeiros passos", description: "Completa o perfil do pet com avatar" },
  { key: "vaccines_up_to_date", name: "Vacinas em dia", description: "Nenhuma dose atrasada por 6 meses" },
  { key: "iron_routine", name: "Rotina de ferro", description: "30 dias seguidos com tarefas concluídas" },
  { key: "graduated", name: "Formado", description: "Conclui um pacote de adestramento" },
  { key: "photographer", name: "Fotógrafo", description: "50 itens na galeria" },
  { key: "community_voice", name: "Voz da comunidade", description: "5 avaliações publicadas" },
  { key: "five_commands", name: "5 comandos", description: "Primeiros 5 comandos dominados" },
  { key: "ten_commands", name: "10 comandos", description: "10 comandos dominados" },
] as const;

export const WEIGHT_ALERT_PCT = 10;
export const WEIGHT_ALERT_DAYS = 30;
export const COMPARISON_MIN_GROUP = 20;
export const COMPARISON_DEFAULT_RADIUS_KM = 10;

/** Plan-limit feature keys for videos, per audience (quantities come from PlanFeatureLimit; admin-editable). */
export const VIDEO_LIMIT_FEATURES = {
  PARTNER: { perDay: "videos_per_day", maxSeconds: "video_max_seconds" },
  OWNER: { perDay: "owner_videos_per_day", maxSeconds: "owner_video_max_seconds" },
} as const;
/** Tolerance on the measured duration vs the plan limit (encoder rounding). */
export const VIDEO_DURATION_TOLERANCE_SECONDS = 0.5;
