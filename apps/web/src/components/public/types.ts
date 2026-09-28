export type PublicPartnerSummary = {
  id: string;
  slug: string;
  tradeName: string;
  logoUrl: string | null;
  types: { key: string; label: string }[] | string[];
  ratingAvg: number | string | null;
  ratingCount: number;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm?: number | null;
  featured: boolean;
  categories: ({ key: string; label: string } | string)[];
  description?: string | null;
};

export type PublicAddress = {
  id?: string;
  street: string;
  number: string | null;
  complement?: string | null;
  district: string | null;
  city: string;
  state: string;
  zipCode?: string;
  latitude: number | string | null;
  longitude: number | string | null;
  isPrimary?: boolean;
};

export type PublicItemMedia = { id?: string; kind: "IMAGE" | "VIDEO"; url: string; thumbUrl: string | null; isCover?: boolean; sortOrder?: number };

export type PublicItem = {
  id: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description: string | null;
  categoryId: string;
  category?: { id: string; key: string; label: string } | null;
  subcategory?: { id: string; key: string; label: string } | null;
  price: number | string | null;
  promoPrice: number | string | null;
  promoUntil: string | null;
  durationMinutes: number | null;
  serviceLocations: ("PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE")[] | null;
  defaultLocation: "PARTNER_VENUE" | "CLIENT_HOME" | "ONLINE" | null;
  bookable: boolean;
  speciesKeys: string[] | null;
  brand?: { id: string; name: string } | null;
  productLine?: { id: string; name: string } | null;
  status: string;
  ratingAvg: number | string | null;
  ratingCount: number;
  media?: PublicItemMedia[];
  partner?: PublicPartnerSummary & { addresses?: PublicAddress[]; description?: string | null };
  reviews?: PublicReview[];
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  verified: boolean;
  createdAt: string;
  userId?: string;
  user?: { id?: string; name: string; avatarUrl?: string | null } | null;
  item?: { id: string; name: string } | null;
  reply?: { body: string; createdAt: string } | null;
};

export type PublicPartner = PublicPartnerSummary & {
  description: string | null;
  website: string | null;
  serviceRadiusKm: number | null;
  cancellationHours?: number;
  businessHours: { weekday: number; opensAt: string; closesAt: string; closed: boolean }[];
  addresses: PublicAddress[];
  socialLinks: { network: string; url: string }[];
  venuePhotos: { id: string; url: string; thumbUrl: string | null; caption: string | null; sortOrder: number }[];
  catalogItems?: PublicItem[];
  items?: PublicItem[];
  reviews: PublicReview[];
  phones?: { type: string; number: string }[];
};

export type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  price: number | string | null;
  ratingAvg: number | string | null;
  ratingCount: number;
  speciesKeys?: string[] | null;
  category?: { label: string } | null;
  partner?: { id: string; tradeName: string; slug: string; logoUrl: string | null } | null;
  modules?: { id: string; title: string; lessons?: { id: string; title: string; durationMinutes: number | null }[] }[];
  lessons?: { id: string; title: string; durationMinutes: number | null; moduleId: string | null }[];
  lessonsCount?: number;
  enrollmentsCount?: number;
};

export const COURSE_LEVEL_LABEL = { BEGINNER: "Iniciante", INTERMEDIATE: "Intermediário", ADVANCED: "Avançado" } as const;
export const SOCIAL_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", YOUTUBE: "YouTube", WHATSAPP: "WhatsApp", LINKEDIN: "LinkedIn" };

export function typeLabel(t: { key: string; label: string } | string): string {
  return typeof t === "string" ? t : t.label;
}
export function typeKey(t: { key: string; label: string } | string): string {
  return typeof t === "string" ? t : t.key;
}
export function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}
export function isPromoActive(item: { promoPrice: number | string | null; promoUntil: string | null }): boolean {
  if (item.promoPrice == null) return false;
  if (!item.promoUntil) return true;
  return new Date(item.promoUntil).getTime() > Date.now();
}
