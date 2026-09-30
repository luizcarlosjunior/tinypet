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

/** Pet microchips follow ISO 11784/11785: exactly 15 digits. */
export const MICROCHIP_DIGITS = 15;

/** "Sobre o microchip" help shown next to the field (web and app). */
export const MICROCHIP_INFO = {
  intro: "O número do microchip (também chamado de transponder) segue o padrão internacional ISO 11784/11785 e tem 15 dígitos numéricos.",
  parts: [
    { title: "3 primeiros dígitos — fabricante ou país", text: "Identificam quem produziu o chip ou o país de origem. Ex.: 981 é o código de um fabricante homologado (Datamars); 076 é o código oficial do Brasil (embora a maioria use o código do fabricante)." },
    { title: "Códigos de país (001 a 899)", text: "Seguem o padrão ISO 3166-1 numérico e são usados quando a autoridade do país regulamenta e distribui os códigos nacionalmente. Ex.: 076 Brasil, 840 Estados Unidos, 124 Canadá, 276 Alemanha, 250 França, 724 Espanha, 620 Portugal, 032 Argentina, 858 Uruguai." },
    { title: "Códigos de fabricante (900 a 998)", text: "Registrados no ICAR. Ex.: 933 Avid, 941 Datamars/Felixcan, 953 Allflex/MSD, 956 Trovan, 972 Planet ID, 977 Virbac, 981 Datamars, 982 Allflex, 985 Destron Fearing, 990 RealTrace, 991 FDX-B genérico." },
    { title: "12 dígitos seguintes — número de série", text: "É a identificação exclusiva do seu animal: essa combinação garante que nenhum outro animal no mundo tenha o mesmo número." },
  ],
  invalidTitle: "O que torna um microchip inválido?",
  invalid: [
    "Ter mais ou menos de 15 dígitos.",
    "Conter letras ou caracteres especiais (deve ser só numérico).",
    "Começar com 900: essa numeração é reservada para testes de fábrica e chips de teste, então o número pode estar repetido em outros animais pelo mundo.",
  ],
} as const;

export type MicrochipLookup = { key: string; group: string; groupDescription: string; name: string; description?: string; url: string };

/**
 * Where a microchip number can be checked. None of these services accepts the number in the URL, so clients open the
 * page and offer a one-tap "copy number" next to the link.
 */
export const MICROCHIP_LOOKUPS: readonly MicrochipLookup[] = [
  {
    key: "sinpatinhas",
    group: "Nacional (Brasil)",
    groupDescription: "Cadastro oficial do governo federal.",
    name: "SinPatinhas (MMA)",
    description: "Base do Sistema do Cadastro Nacional de Animais Domésticos. Acesso com a conta gov.br.",
    url: "https://sinpatinhas.mma.gov.br/",
  },
  {
    key: "aaha",
    group: "Internacional / Global",
    groupDescription: "Ferramenta que varre os principais registros do mundo para checar onde o chip está cadastrado.",
    name: "AAHA Universal Pet Microchip Lookup",
    url: "https://www.aaha.org/for-veterinary-professionals/microchip-registry-lookup-tool-aaha-find-your-pets-microchip-registry/",
  },
  {
    key: "tagmeupet",
    group: "Bancos privados",
    groupDescription: "Úteis para checar o prontuário privado fornecido pelo fabricante ou por clínicas integradas.",
    name: "Tag MeuPet",
    url: "https://tagmeupet.com.br/buscar-chip/",
  },
  {
    key: "petlink",
    group: "Bancos privados",
    groupDescription: "Úteis para checar o prontuário privado fornecido pelo fabricante ou por clínicas integradas.",
    name: "PetLink",
    url: "https://www.petlink.net/microchip-search/",
  },
  {
    key: "animalltag",
    group: "Bancos privados",
    groupDescription: "Úteis para checar o prontuário privado fornecido pelo fabricante ou por clínicas integradas.",
    name: "Animalltag",
    url: "https://animalltag.com.br/pet/",
  },
];

export type PetSocialNetworkKey = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "FACEBOOK" | "X" | "THREADS" | "PINTEREST";

export type PetSocialNetwork = {
  key: PetSocialNetworkKey;
  label: string;
  /** Hosts accepted when the user pastes a profile URL (without "www."). */
  hosts: readonly string[];
  /** Short-link hosts that cannot be resolved offline (the user must paste the profile link or the @). */
  shortHosts?: readonly string[];
  /** Allowed username, already lowercased and without "@". */
  pattern: RegExp;
  /** Profile URL paths prefix the username with "@" (TikTok, YouTube, Threads). */
  atInPath: boolean;
  /** First path segments that are not profiles (posts, pages, settings…). */
  reserved: readonly string[];
  /** Base used to rebuild the profile URL from the stored username. */
  profileBase: string;
  placeholder: string;
};

/**
 * Pet social networks. Only the username is stored; the profile URL is rebuilt with `petSocialProfileUrl()`.
 * Users may paste either the @username or a profile URL — `parsePetSocialUsername()` extracts the username.
 */
export const PET_SOCIAL_NETWORKS: readonly PetSocialNetwork[] = [
  {
    key: "INSTAGRAM",
    label: "Instagram",
    hosts: ["instagram.com", "m.instagram.com", "instagr.am"],
    pattern: /^[a-z0-9._]{1,30}$/,
    atInPath: false,
    reserved: ["p", "reel", "reels", "tv", "explore", "accounts", "direct", "stories"],
    profileBase: "https://www.instagram.com/",
    placeholder: "@rex.dog ou instagram.com/rex.dog",
  },
  {
    key: "TIKTOK",
    label: "TikTok",
    hosts: ["tiktok.com", "m.tiktok.com"],
    shortHosts: ["vm.tiktok.com", "vt.tiktok.com"],
    pattern: /^[a-z0-9._]{2,24}$/,
    atInPath: true,
    reserved: ["video", "discover", "tag", "music", "search", "foryou", "following", "live"],
    profileBase: "https://www.tiktok.com/@",
    placeholder: "@rexdog ou tiktok.com/@rexdog",
  },
  {
    key: "YOUTUBE",
    label: "YouTube",
    hosts: ["youtube.com", "m.youtube.com"],
    shortHosts: ["youtu.be"],
    pattern: /^[a-z0-9._-]{3,30}$/,
    atInPath: true,
    reserved: ["watch", "shorts", "channel", "c", "user", "playlist", "results", "feed", "live", "embed"],
    profileBase: "https://www.youtube.com/@",
    placeholder: "@canaldorex ou youtube.com/@canaldorex",
  },
  {
    key: "FACEBOOK",
    label: "Facebook",
    hosts: ["facebook.com", "m.facebook.com", "web.facebook.com", "fb.com"],
    shortHosts: ["fb.me", "fb.watch"],
    pattern: /^[a-z0-9.]{5,50}$/,
    atInPath: false,
    reserved: ["profile.php", "people", "pages", "groups", "watch", "share", "photo", "photo.php", "events", "story.php", "reel", "permalink.php", "marketplace", "gaming"],
    profileBase: "https://www.facebook.com/",
    placeholder: "rex.dog ou facebook.com/rex.dog",
  },
  {
    key: "X",
    label: "X (Twitter)",
    hosts: ["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"],
    shortHosts: ["t.co"],
    pattern: /^[a-z0-9_]{1,15}$/,
    atInPath: false,
    reserved: ["home", "i", "intent", "search", "hashtag", "share", "explore", "settings", "messages", "notifications", "compose"],
    profileBase: "https://x.com/",
    placeholder: "@rexdog ou x.com/rexdog",
  },
  {
    key: "THREADS",
    label: "Threads",
    hosts: ["threads.net", "threads.com"],
    pattern: /^[a-z0-9._]{1,30}$/,
    atInPath: true,
    reserved: ["search", "activity", "settings"],
    profileBase: "https://www.threads.com/@",
    placeholder: "@rex.dog ou threads.com/@rex.dog",
  },
  {
    key: "PINTEREST",
    label: "Pinterest",
    hosts: ["pinterest.com", "br.pinterest.com", "pinterest.com.br"],
    shortHosts: ["pin.it"],
    pattern: /^[a-z0-9_]{3,30}$/,
    atInPath: false,
    reserved: ["pin", "search", "ideas", "today", "settings", "business"],
    profileBase: "https://www.pinterest.com/",
    placeholder: "rexdog ou pinterest.com/rexdog",
  },
];

export type MediaReportReasonKey = "NUDITY_SEXUAL" | "VIOLENCE_CRUELTY" | "HATE_HARASSMENT" | "SPAM_SCAM" | "PERSONAL_DATA" | "NOT_PET_RELATED" | "OTHER";

/** Community-rules reasons a user can pick when reporting a photo or video (see /regras-da-comunidade). */
export const MEDIA_REPORT_REASONS: readonly { key: MediaReportReasonKey; label: string; description: string }[] = [
  { key: "NUDITY_SEXUAL", label: "Nudez ou conteúdo sexual", description: "Nudez, atos sexuais ou conteúdo sexualizado." },
  { key: "VIOLENCE_CRUELTY", label: "Violência ou maus-tratos", description: "Violência, sangue, animais feridos ou maltratados." },
  { key: "HATE_HARASSMENT", label: "Ódio ou assédio", description: "Discurso de ódio, ofensas, ameaças ou perseguição." },
  { key: "SPAM_SCAM", label: "Spam ou golpe", description: "Propaganda enganosa, golpes, venda ilegal de animais." },
  { key: "PERSONAL_DATA", label: "Dados pessoais expostos", description: "Documentos, endereços, telefones ou rostos de terceiros sem consentimento." },
  { key: "NOT_PET_RELATED", label: "Fora do tema", description: "Conteúdo sem relação com pets ou com o serviço." },
  { key: "OTHER", label: "Outro motivo", description: "Descreva o problema." },
];

/** Sanction lengths offered to admins after a media audit. */
export const SANCTION_DURATIONS = [7, 15, 30, "PERMANENT"] as const;
export type SanctionDuration = (typeof SANCTION_DURATIONS)[number];
/** IP blocks always last 7 days. */
export const IP_BLOCK_DAYS = 7;
