import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { parseWeightToGrams, type WeightUnit } from "@tinypet/shared";
import { radius, useTheme } from "@/lib/theme";
import { Input } from "./Input";
import { Text } from "./Text";

/**
 * Weight field with a kg / g switch: kg accepts decimals ("2,5"), g only whole numbers. `value` is the raw text;
 * callers convert with `parseWeightToGrams(value, unit)` (undefined = invalid → block saving).
 */
export function WeightInput({ label, value, unit, onChange, hint }: { label: string; value: string; unit: WeightUnit; onChange: (value: string, unit: WeightUnit) => void; hint?: string }) {
  const t = useTheme();
  const invalid = parseWeightToGrams(value, unit) === undefined;
  const [focused, setFocused] = useState(false);
  const switchUnit = (u: WeightUnit) => {
    if (u === unit) return;
    const g = parseWeightToGrams(value, unit);
    onChange(g ? (u === "g" ? String(g) : String(g / 1000).replace(".", ",")) : value, u);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Input
          label={label}
          keyboardType={unit === "g" ? "number-pad" : "decimal-pad"}
          value={value}
          onChangeText={(v) => onChange(v, unit)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={unit === "g" ? "Ex.: 250" : "Ex.: 2,5"}
          error={invalid && !focused ? (unit === "g" ? "Em gramas, use um número inteiro" : "Informe em kg (ex.: 2,5)") : undefined}
          hint={hint}
        />
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={`Unidade de ${label}`} style={{ flexDirection: "row", marginTop: 22, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, padding: 2 }}>
        {(["kg", "g"] as const).map((u) => (
          <Pressable key={u} onPress={() => switchUnit(u)} accessibilityRole="radio" accessibilityState={{ checked: unit === u }} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: unit === u ? t.primary : "transparent" }}>
            <Text style={{ fontWeight: "600", color: unit === u ? t.onPrimary : t.inkMuted }}>{u}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
