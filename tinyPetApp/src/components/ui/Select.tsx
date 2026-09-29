import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Input } from "./Input";
import { ListItem } from "./ListItem";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

export type Option<V extends string = string> = { value: V; label: string; subtitle?: string };

/** Picker rendered as a bottom sheet with optional search. */
export function Select<V extends string>({ label, value, options, onChange, placeholder = "Selecionar", error, searchable, disabled, allowClear }: { label?: string; value: V | null | undefined; options: Option<V>[]; onChange: (v: V | null) => void; placeholder?: string; error?: string; searchable?: boolean; disabled?: boolean; allowClear?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text variant="small" tone="muted" style={{ marginBottom: 6, fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selected?.label ?? placeholder}` : selected?.label ?? placeholder}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: t.surface, borderColor: error ? t.danger : t.border, opacity: disabled ? 0.6 : 1 }]}
      >
        <Text style={{ flex: 1, color: selected ? t.ink : t.inkFaint }}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={t.inkFaint} />
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Selecionar"}>
        {searchable ? <Input placeholder="Buscar…" value={q} onChangeText={setQ} autoFocus accessibilityLabel="Buscar opção" /> : null}
        {allowClear && value ? (
          <ListItem
            title="Limpar seleção"
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            chevron={false}
          />
        ) : null}
        {filtered.map((o) => (
          <ListItem
            key={o.value}
            title={o.label}
            subtitle={o.subtitle}
            chevron={false}
            right={o.value === value ? <Ionicons name="checkmark" size={20} color={t.primary} /> : undefined}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
              setQ("");
            }}
          />
        ))}
        {filtered.length === 0 ? (
          <Text tone="muted" style={{ paddingVertical: spacing.lg, textAlign: "center" }}>
            Nenhuma opção encontrada
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", minHeight: 46, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
});
