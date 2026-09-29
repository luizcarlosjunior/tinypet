import React, { forwardRef } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export type InputProps = TextInputProps & { label?: string; error?: string; hint?: string; right?: React.ReactNode };

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, hint, right, style, multiline, ...rest }, ref) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="small" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: t.surface, borderColor: error ? t.danger : t.border, minHeight: multiline ? 96 : 46 }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={t.inkFaint}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.input, { color: t.ink, paddingTop: multiline ? 12 : 0 }, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="small" tone="danger" style={styles.msg}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="faint" style={styles.msg}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { marginBottom: 6, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input: { flex: 1, fontSize: 15, paddingVertical: 10 },
  msg: { marginTop: 4 },
});
