import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SignJWT, jwtVerify } from "jose";
import { verify } from "@node-rs/argon2";
import type { NextRequest } from "next/server";
import { prisma } from "@tinypet/db";
import { Errors } from "./errors";
import { ensureDefaultSubscription } from "./plans";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret");

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "E-mail e senha",
    credentials: { email: { label: "E-mail", type: "email" }, password: { label: "Senha", type: "password" } },
    async authorize(creds) {
      if (!creds?.email || !creds.password) return null;
      const user = await prisma.user.findUnique({ where: { email: creds.email.toLowerCase() } });
      if (!user || !user.passwordHash || user.deletedAt) return null;
      const okPwd = await verify(user.passwordHash, creds.password);
      if (!okPwd) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.avatarUrl };
    },
  }),
];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(AppleProvider({ clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET }));
}

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  pages: { signIn: "/entrar" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) await ensureDefaultSubscription("OWNER", user.id);
    },
  },
};

export type AuthUser = { id: string; name: string; email: string; role: "USER" | "ADMIN"; avatarUrl: string | null };

/** Issues a JWT for the mobile app. */
export async function issueMobileToken(userId: string) {
  return new SignJWT({ sub: userId, typ: "mobile" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(JWT_SECRET);
}

async function userFromBearer(req: NextRequest): Promise<AuthUser | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(h.slice(7), JWT_SECRET);
    if (!payload.sub) return null;
    const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, deletedAt: true } });
    if (!u || u.deletedAt) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl };
  } catch {
    return null;
  }
}

async function userFromSession(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, deletedAt: true } });
  if (!u || u.deletedAt) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl };
}

/** Resolves the current user from Bearer JWT (mobile) or NextAuth cookie (web). */
export async function getUser(req?: NextRequest): Promise<AuthUser | null> {
  if (req) {
    const bearer = await userFromBearer(req);
    if (bearer) return bearer;
  }
  return userFromSession();
}

export async function requireUser(req?: NextRequest): Promise<AuthUser> {
  const u = await getUser(req);
  if (!u) throw Errors.unauthorized();
  return u;
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
  const m = await prisma.membership.findUnique({ where: { userId_partnerId: { userId: user.id, partnerId } } });
  if (!m) throw Errors.forbidden("Você não faz parte deste parceiro");
  if (opts?.ownerOnly && m.role !== "OWNER") throw Errors.forbidden("Apenas o dono do parceiro pode fazer isso");
  if (opts?.finance && m.role !== "OWNER" && !m.canSeeFinance) throw Errors.forbidden("Sem acesso ao financeiro");
  return { user, partnerId, membershipId: m.id, role: m.role, canSeeFinance: m.role === "OWNER" || m.canSeeFinance };
}

/** Owner (tutor) access to a pet: primary owner, PetAccess, or a partner membership that serves the pet. */
export async function assertPetAccess(userId: string, petId: string, level: "VIEW" | "EDIT" = "VIEW") {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, deletedAt: null },
    select: { id: true, ownerId: true, accesses: { where: { userId } }, clients: { select: { client: { select: { partnerId: true } } } } },
  });
  if (!pet) throw Errors.notFound("Pet não encontrado");
  if (pet.ownerId === userId) return { pet, via: "owner" as const };
  const access = pet.accesses[0];
  if (access && (level === "VIEW" || access.level === "EDIT")) return { pet, via: "family" as const };
  const partnerIds = pet.clients.map((c) => c.client.partnerId);
  if (partnerIds.length) {
    const m = await prisma.membership.findFirst({ where: { userId, partnerId: { in: partnerIds } } });
    if (m) return { pet, via: "partner" as const, partnerId: m.partnerId };
  }
  throw Errors.forbidden("Sem acesso a este pet");
}

export async function sessionContext(user: AuthUser) {
  const [dbUser, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, include: { ownerTerm: true, subscription: { include: { plan: true } } } }),
    prisma.membership.findMany({ where: { userId: user.id }, include: { partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true, plan: true, published: true } } } }),
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
      emailVerified: !!dbUser?.emailVerifiedAt,
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
