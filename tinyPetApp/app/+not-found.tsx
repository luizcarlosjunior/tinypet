import { useRouter } from "expo-router";
import { Empty, Screen } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Empty icon="help-circle-outline" title="Página não encontrada" description="O link que você abriu não existe ou expirou." action="Ir para o início" onAction={() => router.replace("/")} />
    </Screen>
  );
}
