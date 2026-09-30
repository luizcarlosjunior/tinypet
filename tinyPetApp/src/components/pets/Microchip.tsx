import React, { useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { MICROCHIP_DIGITS, MICROCHIP_INFO, MICROCHIP_LOOKUPS, MICROCHIP_PROBLEM_MESSAGE, isValidMicrochip, microchipParts, microchipProblem, normalizeMicrochip } from "@tinypet/shared";
import { openExternal } from "@/lib/links";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Input, Text } from "@/components/ui";

/** "Possui microchip" switch (off while empty) + 15-digit field; a valid number shows the lookup links. */
export function MicrochipField({ value, onChange, error }: { value: string | null | undefined; onChange: (v: string | null) => void; error?: string }) {
  const t = useTheme();
  const digits = normalizeMicrochip(value);
  // live feedback once the 15 digits are typed (e.g. a 900… test chip)
  const problem = digits.length === MICROCHIP_DIGITS ? microchipProblem(digits) : null;
  const liveProblem = problem ? MICROCHIP_PROBLEM_MESSAGE[problem] : null;
  const parts = !problem ? microchipParts(digits) : null;
  const [enabled, setEnabled] = useState(digits.length > 0);
  useEffect(() => {
    if (digits.length > 0) setEnabled(true);
  }, [digits.length]);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "600" }}>Possui microchip</Text>
        <Switch
          accessibilityLabel="Possui microchip"
          value={enabled}
          onValueChange={(on) => {
            setEnabled(on);
            if (!on) onChange(null);
          }}
          trackColor={{ true: t.primary, false: t.border }}
        />
      </View>
      {enabled ? (
        <View style={{ marginTop: spacing.sm }}>
          <Input
            label={`Número do microchip (${MICROCHIP_DIGITS} dígitos)`}
            keyboardType="number-pad"
            maxLength={MICROCHIP_DIGITS}
            placeholder="Ex.: 981020000123456"
            value={digits}
            onChangeText={(v: string) => onChange(v.replace(/\D/g, "").slice(0, MICROCHIP_DIGITS) || null)}
            error={error ?? liveProblem ?? undefined}
            hint={error || liveProblem ? undefined : parts ? `${parts.code} · ${parts.serial} — ${parts.label}, número de série único` : `${digits.length}/${MICROCHIP_DIGITS} dígitos`}
          />
          <MicrochipInfo />
          {isValidMicrochip(digits) ? <MicrochipLookupLinks chip={digits} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Lookup services grouped (national, global, private) with copy-to-clipboard; the services don't accept the number in the URL. */
export function MicrochipLookupLinks({ chip }: { chip: string }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  if (!isValidMicrochip(chip)) return null;
  const number = normalizeMicrochip(chip);
  const copy = async () => {
    await Clipboard.setStringAsync(number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const groups = Array.from(new Set(MICROCHIP_LOOKUPS.map((l) => l.group)));
  return (
    <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "600" }}>Consultar o chip</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Copiar número do microchip" onPress={() => void copy()} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }}>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={t.ink} />
          <Text variant="small">{copied ? "Copiado" : "Copiar número"}</Text>
        </Pressable>
      </View>
      <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
        {number} · copie e cole na busca do serviço.
      </Text>
      {groups.map((g) => {
        const items = MICROCHIP_LOOKUPS.filter((l) => l.group === g);
        return (
          <View key={g} style={{ marginTop: spacing.md }}>
            <Text variant="small" style={{ fontWeight: "700" }}>
              {g}
            </Text>
            <Text variant="small" tone="muted">
              {items[0]?.groupDescription}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {items.map((l) => (
                <Pressable
                  key={l.key}
                  accessibilityRole="link"
                  accessibilityLabel={`Abrir ${l.name}`}
                  onPress={async () => {
                    await copy();
                    await openExternal(l.url);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: t.surfaceAlt }}
                >
                  <Text variant="small">{l.name}</Text>
                  <Ionicons name="open-outline" size={12} color={t.inkMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Collapsible "Sobre o número do microchip" help. */
export function MicrochipInfo() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="information-circle-outline" size={16} color={t.inkMuted} />
        <Text variant="small" style={{ flex: 1, fontWeight: "600" }}>
          Sobre o número do microchip
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={t.inkMuted} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Text variant="small" tone="muted">
            {MICROCHIP_INFO.intro}
          </Text>
          {MICROCHIP_INFO.parts.map((p) => (
            <Text key={p.title} variant="small" tone="muted">
              <Text variant="small" style={{ fontWeight: "600" }}>
                {p.title}:
              </Text>{" "}
              {p.text}
            </Text>
          ))}
          <Text variant="small" style={{ fontWeight: "600", color: t.warning }}>
            {MICROCHIP_INFO.invalidTitle}
          </Text>
          {MICROCHIP_INFO.invalid.map((x) => (
            <Text key={x} variant="small" tone="muted">
              • {x}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
