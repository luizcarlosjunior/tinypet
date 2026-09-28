import React, { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@tinypet/shared";
import { useAuth } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api";
import { spacing, useTheme } from "@/lib/theme";
import { Button, Input, Screen, Text } from "@/components/ui";

export default function SignIn() {
  const { signIn } = useAuth();
  const t = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      // Redirect handled by the root auth gate.
    } catch (e) {
      setError(errorMessage(e, "Não foi possível entrar"));
    }
  });

  return (
    <Screen keyboard style={{ justifyContent: "center", flexGrow: 1 }}>
      <View style={{ marginBottom: spacing.xxl, alignItems: "center" }}>
        <Text variant="title" style={{ color: t.primary, fontSize: 34 }} accessibilityRole="header">
          tinyPet
        </Text>
        <Text tone="muted" style={{ marginTop: 4 }}>
          Cuidando de quem cuida do seu pet
        </Text>
      </View>
      <Controller control={control} name="email" render={({ field, fieldState }) => <Input label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      <Controller control={control} name="password" render={({ field, fieldState }) => <Input label="Senha" secureTextEntry autoComplete="password" textContentType="password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} onSubmitEditing={onSubmit} returnKeyType="go" />} />
      {error ? (
        <Text tone="danger" style={{ marginBottom: spacing.md }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title="Entrar" onPress={onSubmit} loading={formState.isSubmitting} size="lg" />
      <View style={{ alignItems: "center", marginTop: spacing.xl }}>
        <Text tone="muted">Ainda não tem conta?</Text>
        <Link href="/(auth)/cadastro" accessibilityRole="link" style={{ marginTop: 6 }}>
          <Text tone="primary" style={{ fontWeight: "600" }}>
            Criar conta
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
