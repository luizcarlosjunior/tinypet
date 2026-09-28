import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { PanelShell } from "@/components/painel/Shell";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/entrar?next=/painel");
  return <PanelShell>{children}</PanelShell>;
}
