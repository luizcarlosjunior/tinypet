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
export const VIDEO_MIME = ["video/mp4", "video/quicktime"] as const;

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
  // owner
  owner_pets: "owner_pets",
  owner_gallery: "owner_gallery",
  owner_stories: "owner_stories",
  owner_storage_mb: "owner_storage_mb",
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
