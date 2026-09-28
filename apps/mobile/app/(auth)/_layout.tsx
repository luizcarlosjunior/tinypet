import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="entrar" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="verificar" options={{ headerShown: true, title: "Verificação", headerTintColor: t.ink, headerStyle: { backgroundColor: t.surface } }} />
    </Stack>
  );
}
