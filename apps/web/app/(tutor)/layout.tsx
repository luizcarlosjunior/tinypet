import type { Metadata } from "next";
import { getUser } from "@/server/auth";
import { TutorShell } from "@/components/layout/tutor-shell";
import { RedirectToLogin } from "@/components/layout/redirect-to-login";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) return <RedirectToLogin />;
  return <TutorShell>{children}</TutorShell>;
}
