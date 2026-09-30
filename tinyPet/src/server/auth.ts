import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { verify } from "@node-rs/argon2";
import type { NextRequest } from "next/server";
import { prisma } from "@/db";
import { Errors } from "./errors";
import { ensureDefaultSubscription } from "./plans";
import { rateLimit, clientIpFromHeaders, bumpCounter, readCounter, resetCounter } from "./api";
import { captchaEnabled, checkCaptcha } from "./captcha";
import { ApiError } from "./errors";
import { accountSuspendedError, assertNotSuspended, ipBlockedError, isIpBlocked, rememberIp } from "./sanctions";

// ───────────────────────────── secrets ─────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";
const PLACEHOLDER_SECRETS = new Set(["change-me-jwt", "change-me-nextauth", "dev-secret", "secret", "changeme"]);

function assertStrongSecret(name: string, value: string | undefined) {
  if (!value) throw new Error(`[auth] ${name} ausente em produção`);
  if (value.length < 32) throw new Error(`[auth] ${name} deve ter pelo menos 32 caracteres em produção`);
  if (PLACEHOLDER_SECRETS.has(value)) throw new Error(`[auth] ${name} usa um valor de exemplo; gere um segredo (ex.: openssl rand -base64 48)`);
}

// During `next build` (NEXT_PHASE=phase-production-build) runtime env may be absent; enforce when serving.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
if (IS_PROD && !IS_BUILD) {
  assertStrongSecret("JWT_SECRET", process.env.JWT_SECRET);
  assertStrongSecret("NEXTAUTH_SECRET", process.env.NEXTAUTH_SECRET);
}

function jwtSecret() {
  const local = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || IS_BUILD;
  const s = process.env.JWT_SECRET || (local ? "dev-secret-only-for-local-development" : "");
  if (!s) throw new Error("[auth] JWT_SECRET não configurado");
  return new TextEncoder().encode(s);
}
const JWT_SECRET = jwtSecret();
const JWT_ISSUER = "tinypet";
const JWT_AUDIENCE = "tinypet-mobile";

/** Argon2id hash of a random string, used to equalize timing when the user doesn't exist. */
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$aYtS2xXhef3OynR6F7+o8Q$iOCDuH1BGdeoA6SqrQnVKbRD+zCuU/UJbzGKsV8UlRc";

const LOGIN_WINDOW = 15 * 60 * 1000;

/**
 * Password check shared by NextAuth (web) and mobile login, with constant-ish timing.
 * Only FAILED attempts are counted (a victim can't be locked out by someone else's attempts as easily): after 3
 * failures for the e-mail (or 10 for the IP) reCAPTCHA becomes mandatory; a hard block remains as a backstop
 * (50 failures with reCAPTCHA on, 10 without). A reCAPTCHA token that is sent is always verified.
 */
export async function verifyPasswordLogin(emailRaw: string, password: string, ip: string, captchaToken?: string | null) {
  const email = emailRaw.trim().toLowerCase();
  const failKeyEmail = `login:fail:email:${email}`;
  const failKeyIp = `login:fail:ip:${ip}`;
  await rateLimit(`login:ip:${ip}`, 100, LOGIN_WINDOW);
  const [failsEmail, failsIp] = await Promise.all([readCounter(failKeyEmail), readCounter(failKeyIp)]);
  const hardLimit = captchaEnabled() ? 50 : 10;
  if (failsEmail >= hardLimit) throw new ApiError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em alguns minutos.");
  await checkCaptcha(captchaToken ?? null, "login", ip, failsEmail >= 3 || failsIp >= 10);
  const fail = async () => {
    await Promise.all([bumpCounter(failKeyEmail, LOGIN_WINDOW), bumpCounter(failKeyIp, LOGIN_WINDOW)]);
    return null;
  };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.deletedAt) {
    await verify(DUMMY_HASH, password).catch(() => false);
    return fail();
  }
  const okPwd = await verify(user.passwordHash, password).catch(() => false);
  if (!okPwd) return fail();
  await resetCounter(failKeyEmail);
  // Only after a correct password, so the suspension state doesn't leak which e-mails exist.
  assertNotSuspended(user);
  await rememberIp(user.id, ip);
  return user;
}

// ───────────────────────────── NextAuth ─────────────────────────────

type DbUser = { id: string; name: string; email: string; avatarUrl: string | null; emailVerifiedAt: Date | null };
function toAdapterUser<T extends DbUser | null | undefined>(u: T): AdapterUser | null {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, image: u.avatarUrl, emailVerified: u.emailVerifiedAt };
}
function fromAdapterUser(data: Partial<AdapterUser>) {
  const out: { name?: string; email?: string; avatarUrl?: string | null; emailVerifiedAt?: Date | null } = {};
  if (data.name !== undefined && data.name !== null) out.name = data.name;
  if (data.email !== undefined) out.email = data.email.toLowerCase();
  if (data.image !== undefined) out.avatarUrl = data.image;
  if (data.emailVerified !== undefined) out.emailVerifiedAt = data.emailVerified;
  return out;
}

/**
 * PrismaAdapter maps to `image`/`emailVerified`; our User model has `avatarUrl`/`emailVerifiedAt`.
 * OAuth users are created WITHOUT terms acceptance (consent must be explicit — see sessionContext().termsAccepted).
 */
function tinyPetAdapter(): Adapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = PrismaAdapter(prisma as any) as unknown as Adapter;
  return {
    ...base,
    async createUser(data: Omit<AdapterUser, "id">) {
      const mapped = fromAdapterUser(data);
      const email = mapped.email ?? "";
      const u = await prisma.user.create({
        data: { ...mapped, email, name: mapped.name || email.split("@")[0] || "Usuário", emails: email ? { create: { address: email, isPrimary: true, verifiedAt: mapped.emailVerifiedAt ?? null } } : undefined },
      });
      return toAdapterUser(u)!;
    },
    async getUser(id) {
      return toAdapterUser(await prisma.user.findFirst({ where: { id, deletedAt: null } }));
    },
    async getUserByEmail(email) {
      return toAdapterUser(await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } }));
    },
    async getUserByAccount(provider_providerAccountId) {
      const acc = await prisma.account.findUnique({ where: { provider_providerAccountId }, include: { user: true } });
      if (!acc || acc.user.deletedAt) return null;
      return toAdapterUser(acc.user);
    },
    async updateUser({ id, ...data }) {
      return toAdapterUser(await prisma.user.update({ where: { id }, data: fromAdapterUser(data) }))!;
    },
  };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "E-mail e senha",
    credentials: { email: { label: "E-mail", type: "email" }, password: { label: "Senha", type: "password" }, captchaToken: { label: "captcha", type: "text" } },
    async authorize(creds, req) {
      if (!creds?.email || !creds.password) return null;
      const ip = clientIpFromHeaders((req?.headers ?? {}) as Record<string, string | string[] | undefined>);
      if (await isIpBlocked(ip)) throw new Error(ipBlockedError().message);
      try {
        const user = await verifyPasswordLogin(creds.email, creds.password, ip, creds.captchaToken || null);
        if (!user) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.avatarUrl };
      } catch (e) {
        if (e instanceof Error && (e as { status?: number }).status === 429) throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
        if (e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED") throw new Error(e.message);
        // the login page reacts to these codes (runs reCAPTCHA / shows the message)
        if (e instanceof ApiError && (e.code === "CAPTCHA_REQUIRED" || e.code === "CAPTCHA_FAILED" || e.code === "CAPTCHA_UNAVAILABLE")) throw new Error(e.code);
        throw e;
      }
    },
  }),
];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(AppleProvider({ clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET }));
}

const WEB_SESSION_DAYS = 30;

/** Client IP inside NextAuth callbacks (they get no request object; the App Router route has request headers). */
async function requestIp() {
  try {
    const { headers } = await import("next/headers");
    return clientIpFromHeaders(headers());
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: tinyPetAdapter(),
  // JWT cookie (rolling, 14 days idle) bound to a `sessions` row (`sid`): sign-out, account deletion and suspension
  // delete the row, so a copied cookie stops working server-side. The row caps a login at WEB_SESSION_DAYS.
  session: { strategy: "jwt", maxAge: 14 * 24 * 60 * 60 },
  pages: { signIn: "/entrar" },
  providers,
  callbacks: {
    /** OAuth sign-in of a suspended account is refused (credentials login throws its own message). */
    async signIn({ user, account, profile }) {
      if (!user?.id) return true;
      if (account?.provider && account.provider !== "credentials") {
        // OAuth: same IP block as the password login; remember the IP for audit sanctions
        const ip = await requestIp();
        if (ip && (await isIpBlocked(ip))) return "/entrar?erro=bloqueado";
        await rememberIp(user.id, ip);
      }
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { suspendedUntil: true, emailVerifiedAt: true, email: true } });
      if (u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now()) return "/entrar?erro=suspensa";
      // Google/Apple assert the e-mail: mark it verified (e-mail invites require a verified address)
      const verifiedByProvider = account?.provider === "apple" || (account?.provider === "google" && (profile as { email_verified?: boolean } | undefined)?.email_verified === true);
      if (u && !u.emailVerifiedAt && verifiedByProvider && profile?.email?.toLowerCase() === u.email.toLowerCase()) {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        await prisma.email.updateMany({ where: { userId: user.id, address: u.email, verifiedAt: null }, data: { verifiedAt: new Date() } });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sid = randomUUID();
        await prisma.session.create({ data: { sessionToken: token.sid as string, userId: user.id, expires: new Date(Date.now() + WEB_SESSION_DAYS * 86_400_000) } });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) Object.assign(session.user, { id: token.uid as string, sid: token.sid as string | undefined });
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      const sid = (token as { sid?: unknown } | null)?.sid;
      if (typeof sid === "string") await prisma.session.deleteMany({ where: { sessionToken: sid } });
    },
    async createUser({ user }) {
      if (user.id) await ensureDefaultSubscription("OWNER", user.id);
    },
  },
};

export type AuthUser = { id: string; name: string; email: string; role: "USER" | "ADMIN" | "EDITOR"; avatarUrl: string | null };

// ───────────────────────────── mobile JWT ─────────────────────────────

/** Issues a 30-day JWT for the mobile app, bound to the user's current tokenVersion. */
export async function issueMobileToken(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  if (!u) throw Errors.unauthorized();
  return new SignJWT({ typ: "mobile", tv: u.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

/** Invalidates every mobile token of the user (logout everywhere / account deletion / password change). */
export async function revokeMobileTokens(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

type ResolvedUser = AuthUser & { suspendedUntil: Date | null };

async function userFromBearer(req: NextRequest): Promise<ResolvedUser | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(h.slice(7), JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithms: ["HS256"] });
    if (!payload.sub || payload.typ !== "mobile" || typeof payload.tv !== "number") return null;
    const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, deletedAt: true, tokenVersion: true, suspendedUntil: true } });
    if (!u || u.deletedAt || u.tokenVersion !== payload.tv) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl, suspendedUntil: u.suspendedUntil };
  } catch {
    return null;
  }
}

async function userFromSession(): Promise<ResolvedUser | null> {
  const session = await getServerSession(authOptions);
  const su = session?.user as { id?: string; sid?: string } | undefined;
  if (!su?.id || !su.sid) return null;
  const row = await prisma.session.findUnique({ where: { sessionToken: su.sid }, select: { expires: true, user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, deletedAt: true, suspendedUntil: true } } } });
  const u = row?.user;
  if (!row || row.expires.getTime() < Date.now() || !u || u.id !== su.id || u.deletedAt) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl, suspendedUntil: u.suspendedUntil };
}

async function resolveUser(req?: NextRequest): Promise<ResolvedUser | null> {
  // A Bearer header means "mobile client": never fall back to the cookie session for it.
  if (req?.headers.get("authorization")?.startsWith("Bearer ")) return userFromBearer(req);
  return userFromSession();
}

const isSuspended = (u: ResolvedUser) => !!u.suspendedUntil && u.suspendedUntil.getTime() > Date.now();
const strip = ({ suspendedUntil: _s, ...u }: ResolvedUser): AuthUser => u;

/** Resolves the current user from Bearer JWT (mobile) or NextAuth cookie (web). Suspended accounts resolve to null. */
export async function getUser(req?: NextRequest): Promise<AuthUser | null> {
  const u = await resolveUser(req);
  return u && !isSuspended(u) ? strip(u) : null;
}

/** 401 without a session; 403 ACCOUNT_SUSPENDED (with the end date) for suspended accounts. */
export async function requireUser(req?: NextRequest): Promise<AuthUser> {
  const u = await resolveUser(req);
  if (!u) throw Errors.unauthorized();
  if (isSuspended(u)) throw accountSuspendedError(u.suspendedUntil!);
  return strip(u);
}

export async function requireAdmin(req?: NextRequest): Promise<AuthUser> {
  const u = await requireUser(req);
  if (u.role !== "ADMIN") throw Errors.forbidden();
  return u;
}

export type PartnerCtx = {
  user: AuthUser;
  partnerId: string;
  membershipId: string;
  role: "OWNER" | "STAFF";
  canSeeFinance: boolean;
};

/**
 * Partner context: partner id comes from the `X-Partner-Id` header, `?partnerId=` or route param.
 * Every partner-panel query MUST filter by ctx.partnerId.
 */
export async function requirePartner(req: NextRequest, partnerIdFromRoute?: string, opts?: { ownerOnly?: boolean; finance?: boolean }): Promise<PartnerCtx> {
  const user = await requireUser(req);
  const partnerId = partnerIdFromRoute ?? req.headers.get("x-partner-id") ?? req.nextUrl.searchParams.get("partnerId") ?? "";
  if (!partnerId) throw Errors.badRequest("Informe o parceiro (X-Partner-Id)");
  const m = await prisma.membership.findUnique({ where: { userId_partnerId: { userId: user.id, partnerId } }, include: { partner: { select: { deletedAt: true } } } });
  if (!m || m.partner.deletedAt) throw Errors.forbidden("Você não faz parte deste parceiro");
  if (opts?.ownerOnly && m.role !== "OWNER") throw Errors.forbidden("Apenas o dono do parceiro pode fazer isso");
  if (opts?.finance && m.role !== "OWNER" && !m.canSeeFinance) throw Errors.forbidden("Sem acesso ao financeiro");
  return { user, partnerId, membershipId: m.id, role: m.role, canSeeFinance: m.role === "OWNER" || m.canSeeFinance };
}

/**
 * Owner (tutor) access to a pet: primary owner, PetAccess (shared account), or a partner membership that serves the pet.
 * Access levels: `VIEW` (read), `TASK` (mark routine tasks as done) and `EDIT` (any other change).
 * Shared accounts (PetAccess, `via: "family"`) are read-only: they get VIEW and TASK, never EDIT — only the owner
 * changes the pet's registration. `PetAccess.level` is deprecated and ignored.
 */
export type PetAccessLevel = "VIEW" | "TASK" | "EDIT";

export async function assertPetAccess(userId: string, petId: string, level: PetAccessLevel = "VIEW") {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      accesses: { where: { userId } },
      // partner access only through live links: client and partner not soft-deleted
      clients: { where: { client: { deletedAt: null, partner: { deletedAt: null } } }, select: { client: { select: { partnerId: true } } } },
    },
  });
  if (!pet) throw Errors.notFound("Pet não encontrado");
  if (pet.ownerId === userId) return { pet, via: "owner" as const };
  const access = pet.accesses[0];
  if (access && level !== "EDIT") return { pet, via: "family" as const };
  const partnerIds = pet.clients.map((c) => c.client.partnerId);
  if (partnerIds.length) {
    const m = await prisma.membership.findFirst({ where: { userId, partnerId: { in: partnerIds } } });
    if (m) return { pet, via: "partner" as const, partnerId: m.partnerId };
  }
  if (access) throw Errors.forbidden("Conta compartilhada: apenas o tutor dono do pet pode fazer alterações");
  throw Errors.forbidden("Sem acesso a este pet");
}

export async function sessionContext(user: AuthUser) {
  const [dbUser, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, include: { ownerTerm: true, subscription: { include: { plan: true } } } }),
    prisma.membership.findMany({ where: { userId: user.id, partner: { deletedAt: null } }, include: { partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true, plan: true, published: true } } } }),
  ]);
  return {
    user: {
      id: user.id,
      name: dbUser?.name ?? user.name,
      email: user.email,
      role: user.role,
      avatarUrl: dbUser?.avatarUrl ?? null,
      ownerTerm: dbUser?.ownerTerm?.label ?? "Tutor",
      ownerTermId: dbUser?.ownerTermId ?? null,
      /** Public @handle (lowercase) or null. Others find the account by it to share a pet. */
      username: dbUser?.username ?? null,
      emailVerified: !!dbUser?.emailVerifiedAt,
      /** false for OAuth sign-ups that haven't explicitly accepted the terms yet — UI must ask. */
      termsAccepted: !!dbUser?.termsAcceptedAt,
      /** false for Google/Apple-only accounts: sensitive actions are then confirmed with an e-mail code. */
      hasPassword: !!dbUser?.passwordHash,
      termsVersion: dbUser?.termsVersion ?? null,
      plan: dbUser?.subscription?.plan.key ?? "owner_free",
      marketingConsent: dbUser?.marketingConsent ?? false,
      statsConsent: dbUser?.statsConsent ?? true,
      publicPhotosConsent: dbUser?.publicPhotosConsent ?? false,
      birthDate: dbUser?.birthDate ? dbUser.birthDate.toISOString().slice(0, 10) : null,
    },
    memberships: memberships.map((m) => ({
      membershipId: m.id,
      partnerId: m.partnerId,
      partnerName: m.partner.tradeName,
      slug: m.partner.slug,
      logoUrl: m.partner.logoUrl,
      role: m.role,
      canSeeFinance: m.role === "OWNER" || m.canSeeFinance,
      plan: m.partner.plan,
      published: m.partner.published,
    })),
  };
}
