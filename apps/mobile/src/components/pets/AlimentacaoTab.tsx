import React, { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { formatBRL } from "@tinypet/shared";
import { useFoodMutations, useFoodSuggestions, useFoods } from "@/hooks/use-pets";
import { useBrands } from "@/hooks/use-ref";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtDay } from "@/lib/format";
import { spacing } from "@/lib/theme";
import type { PetFood } from "@/lib/types";
import { Avatar, Button, Card, Checkbox, Empty, ErrorState, Input, ListItem, Loading, Section, Select, Sheet, Text } from "@/components/ui";

const TYPE_LABEL: Record<PetFood["type"], string> = { DRY: "Ração seca", WET: "Ração úmida", NATURAL: "Alimentação natural", TREAT: "Petisco", SUPPLEMENT: "Suplemento" };

/** Alimentação: foods list + nearby store suggestions with active promos. */
export function AlimentacaoTab({ petId, canEdit }: { petId: string; canEdit: boolean }) {
  const router = useRouter();
  const foods = useFoods(petId);
  const brands = useBrands();
  const sugg = useFoodSuggestions(petId, (foods.data?.length ?? 0) > 0);
  const { create, remove } = useFoodMutations(petId);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ type: PetFood["type"]; brandId: string | null; productLineId: string | null; brandOther: string; packageSizeG: string; dailyGrams: string; lastPurchaseAt: string; offersEnabled: boolean }>({ type: "DRY", brandId: null, productLineId: null, brandOther: "", packageSizeG: "", dailyGrams: "", lastPurchaseAt: "", offersEnabled: true });
  const lines = useMemo(() => brands.data?.find((b) => b.id === f.brandId)?.lines ?? [], [brands.data, f.brandId]);

  const save = async () => {
    try {
      await create.mutateAsync({ type: f.type, brandId: f.brandId, productLineId: f.productLineId, brandOther: f.brandOther || null, packageSizeG: f.packageSizeG ? Number(f.packageSizeG) : null, dailyGrams: f.dailyGrams ? Number(f.dailyGrams) : null, lastPurchaseAt: f.lastPurchaseAt || null, offersEnabled: f.offersEnabled });
      setOpen(false);
    } catch (e) {
      Alert.alert("Erro", errorMessage(e));
    }
  };

  if (foods.isLoading) return <Loading />;
  if (foods.error) return <ErrorState error={foods.error} onRetry={foods.refetch} />;
  const items = foods.data ?? [];

  return (
    <View>
      <Section title="O que ele come" right={canEdit ? <Button title="Adicionar" size="sm" onPress={() => setOpen(true)} /> : undefined}>
        {items.length === 0 ? <Empty icon="restaurant-outline" title="Nenhum alimento cadastrado" description="Informe ração, petiscos e suplementos para receber indicações de lojas próximas." /> : null}
        {items.map((it) => {
          const brand = it.brand?.name ?? it.brandOther ?? "Marca não informada";
          const line = it.productLine?.name;
          const days = it.packageSizeG && it.dailyGrams ? Math.floor(it.packageSizeG / it.dailyGrams) : null;
          return (
            <ListItem
              key={it.id}
              title={`${brand}${line ? ` · ${line}` : ""}`}
              subtitle={[TYPE_LABEL[it.type], it.packageSizeG ? `${(it.packageSizeG / 1000).toLocaleString("pt-BR")} kg` : null, it.dailyGrams ? `${it.dailyGrams} g/dia` : null, runsOut(it.lastPurchaseAt, days) ? `acaba em ~${runsOut(it.lastPurchaseAt, days)}` : days ? `dura ~${days} dias` : null].filter(Boolean).join(" · ")}
              chevron={false}
              right={canEdit ? <Button title="Remover" variant="ghost" size="sm" onPress={() => remove.mutateAsync(it.id).catch((e) => Alert.alert("Erro", errorMessage(e)))} /> : undefined}
            />
          );
        })}
      </Section>
      {items.length ? (
        <Section title="Onde comprar perto de você">
          {sugg.isLoading ? <Loading /> : null}
          {sugg.data?.length === 0 ? (
            <Text variant="small" tone="muted">
              Nenhuma loja próxima com essas marcas ainda.
            </Text>
          ) : null}
          {(sugg.data ?? []).map((s, i) => (
            <Card key={`${s.partner.id}-${i}`} onPress={() => router.push(`/(tutor)/p/${s.partner.slug}`)} accessibilityLabel={`Abrir ${s.partner.tradeName}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar uri={s.partner.logoUrl} name={s.partner.tradeName} size={40} square />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{s.partner.tradeName}</Text>
                  <Text variant="small" tone="muted">
                    {[Array.from(new Set(s.items.map((x) => x.brand?.name).filter(Boolean))).join(", "), s.distanceKm != null ? `${s.distanceKm.toFixed(1).replace(".", ",")} km` : s.partner.city].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
              {s.offers?.map((p) => (
                <Text key={p.id} variant="small" tone="primary" style={{ marginTop: 6 }}>
                  Oferta: {p.name} {p.promoPrice != null ? `por ${formatBRL(p.promoPrice)}` : ""}
                </Text>
              ))}
            </Card>
          ))}
        </Section>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Novo alimento">
        <Select label="Tipo" value={f.type} onChange={(v) => setF({ ...f, type: (v ?? "DRY") as PetFood["type"] })} options={(Object.keys(TYPE_LABEL) as PetFood["type"][]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))} />
        <Select label="Marca" value={f.brandId} onChange={(v) => setF({ ...f, brandId: v, productLineId: null })} options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} searchable allowClear placeholder="Selecionar marca" />
        {lines.length ? <Select label="Linha / produto" value={f.productLineId} onChange={(v) => setF({ ...f, productLineId: v })} options={lines.map((l) => ({ value: l.id, label: l.name }))} allowClear /> : null}
        {!f.brandId ? <Input label="Outra marca" value={f.brandOther} onChangeText={(v) => setF({ ...f, brandOther: v })} hint="Sugerimos ao admin para aprovação" /> : null}
        <Input label="Tamanho da embalagem (g)" keyboardType="number-pad" value={f.packageSizeG} onChangeText={(v) => setF({ ...f, packageSizeG: v })} />
        <Input label="Quantidade diária (g)" keyboardType="number-pad" value={f.dailyGrams} onChangeText={(v) => setF({ ...f, dailyGrams: v })} />
        <Input label="Última compra" placeholder="AAAA-MM-DD" value={f.lastPurchaseAt} onChangeText={(v) => setF({ ...f, lastPurchaseAt: v })} />
        <Checkbox checked={f.offersEnabled} onChange={(v) => setF({ ...f, offersEnabled: v })} label="Receber ofertas desta marca" />
        <Button title="Salvar" onPress={save} loading={create.isPending} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

/** Estimated end of the package: last purchase + package / daily grams (dd/MM), or null. */
function runsOut(lastPurchaseAt: string | null | undefined, days: number | null): string | null {
  if (!lastPurchaseAt || !days) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(lastPurchaseAt);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return fmtDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, "dd/MM");
}
