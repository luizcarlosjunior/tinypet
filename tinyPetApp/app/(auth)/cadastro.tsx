import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@tinypet/shared";
import { useAuth } from "@/lib/auth-store";
import { errorMessage } from "@/lib/api";
import { useOwnerTerms } from "@/hooks/use-ref";
import { spacing } from "@/lib/theme";
import { Button, Checkbox, Input, Screen, Select, Text } from "@/components/ui";

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const terms = useOwnerTerms();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setValue, watch } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", ownerTermId: undefined, acceptTerms: undefined as unknown as true, marketingConsent: false },
  });
  const ownerTermId = watch("ownerTermId");

  useEffect(() => {
    if (!ownerTermId && terms.data?.length) {
      const def = terms.data.find((x) => x.isDefault) ?? terms.data[0];
      if (def) setValue("ownerTermId", def.id);
    }
  }, [terms.data, ownerTermId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values);
      router.replace("/(auth)/verificar");
    } catch (e) {
      setError(errorMessage(e, "Não foi possível criar a conta"));
    }
  });

  return (
    <Screen keyboard title="Criar conta" subtitle="Leva menos de um minuto">
      <Controller control={control} name="name" render={({ field, fieldState }) => <Input label="Nome" autoComplete="name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      <Controller control={control} name="email" render={({ field, fieldState }) => <Input label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      <Controller control={control} name="password" render={({ field, fieldState }) => <Input label="Senha" secureTextEntry autoComplete="new-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} hint="Mínimo de 8 caracteres" />} />
      <Controller
        control={control}
        name="ownerTermId"
        render={({ field }) => (
          <Select label="Como você quer ser chamado?" value={field.value ?? null} onChange={(v) => field.onChange(v ?? undefined)} options={(terms.data ?? []).map((o) => ({ value: o.id, label: o.label }))} placeholder={terms.isLoading ? "Carregando…" : "Tutor"} />
        )}
      />
      <Controller control={control} name="acceptTerms" render={({ field, fieldState }) => (
        <View>
          <Checkbox checked={field.value === true} onChange={(v) => field.onChange(v ? true : undefined)} label="Li e aceito os Termos de uso e a Política de privacidade" />
          {fieldState.error ? <Text variant="small" tone="danger">{fieldState.error.message}</Text> : null}
        </View>
      )} />
      <Controller control={control} name="marketingConsent" render={({ field }) => <Checkbox checked={!!field.value} onChange={field.onChange} label="Quero receber ofertas e novidades" description="Você pode mudar isso a qualquer momento" />} />
      {error ? (
        <Text tone="danger" style={{ marginVertical: spacing.md }}>
          {error}
        </Text>
      ) : null}
      <Button title="Criar conta" onPress={onSubmit} loading={formState.isSubmitting} size="lg" style={{ marginTop: spacing.lg }} />
      <View style={{ alignItems: "center", marginTop: spacing.xl }}>
        <Link href="/(auth)/entrar" accessibilityRole="link">
          <Text tone="primary" style={{ fontWeight: "600" }}>
            Já tenho conta
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
