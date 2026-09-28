import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  return <AdminShell userName={user.name}>{children}</AdminShell>;
}
