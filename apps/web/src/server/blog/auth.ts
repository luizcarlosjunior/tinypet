import type { NextRequest } from "next/server";
import { Errors } from "../errors";
import { requireUser, type AuthUser } from "../auth";
import { publicUrl } from "../media";
import { sanitizePostHtml } from "./sanitize";

/** ADMIN and EDITOR manage the blog. */
export function isBlogEditor(user: Pick<AuthUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "EDITOR";
}

/** 401 when logged out, 403 unless the user is ADMIN or EDITOR. */
export async function requireBlogEditor(req?: NextRequest): Promise<AuthUser> {
  const u = await requireUser(req);
  if (!isBlogEditor(u)) throw Errors.forbidden("Acesso restrito à equipe do blog");
  return u;
}

export function blogAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001").replace(/\/$/, "");
}

/** Public URL prefix of blog media (S3 public base or local /uploads in dev) — the only allowed `<img>` source. */
export function blogMediaBases(): string[] {
  return [publicUrl("blog/")];
}

/** Sanitizes post HTML with our media host / app URL. */
export function sanitizeBlogHtml(html: string, forRender = false): string {
  return sanitizePostHtml(html, { mediaBases: blogMediaBases(), appUrl: blogAppUrl(), forRender });
}
