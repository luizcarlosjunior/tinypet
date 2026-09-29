import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  // EDITOR (blog team) gets in too; AdminShell restricts them to /admin/blog/** (APIs enforce roles server-side).
  const role = user?.role as string | undefined;
  if (!user || (role !== "ADMIN" && role !== "EDITOR")) redirect("/");
  return (
    <AdminShell userName={user.name} role={role === "EDITOR" ? "EDITOR" : "ADMIN"}>
      {children}
    </AdminShell>
  );
}
