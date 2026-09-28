import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-store";
import { Loading } from "@/components/ui";

export default function Index() {
  const { ready, token, activePartnerId } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/entrar" />;
  return <Redirect href={activePartnerId ? "/(parceiro)/agenda" : "/(tutor)/inicio"} />;
}
