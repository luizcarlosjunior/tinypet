"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Pencil, Plus, ShoppingBag, Trash2, Utensils } from "lucide-react";
import { petFoodSchema, formatBRL } from "@tinypet/shared";
import { usePetMutation, usePetResource } from "@/hooks/use-pets";
import { useBrands } from "@/hooks/use-ref";
import { api } from "@/lib/api-client";
import { Button, Empty, Input, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { fmtDate, fmtKm } from "@/lib/format";

type FoodInput = z.infer<typeof petFoodSchema>;
type Food = { id: string; type: FoodInput["type"]; brandId: string | null; productLineId: string | null; brandOther: string | null; packageSizeG: number | null; dailyGrams: number | null; lastPurchaseAt: string | null; offersEnabled: boolean; brand?: { name: string } | null; productLine?: { name: string } | null };
type Suggestion = { partner: { id: string; slug: string; tradeName: string; logoUrl: string | null; distanceKm?: number | null }; item?: { id: string; name: string; price: string | number | null; promoPrice: string | number | null } | null; brand?: { name: string } | null; promo?: boolean };

const TYPE_LABEL: Record<FoodInput["type"], string> = { DRY: "Ração seca", WET: "Ração úmida", NATURAL: "Alimentação natural", TREAT: "Petisco", SUPPLEMENT: "Suplemento" };

function daysLeft(f: Food): number | null {
  if (!f.packageSizeG || !f.dailyGrams || !f.lastPurchaseAt) return null;
  const total = Math.floor(f.packageSizeG / f.dailyGrams);
  const elapsed = Math.floor((Date.now() - new Date(f.lastPurchaseAt.length === 10 ? `${f.lastPurchaseAt}T12:00:00` : f.lastPurchaseAt).getTime()) / 86_400_000);
  return total - elapsed;
}

export function PetFoods({ petId, deceased }: { petId: string; deceased: boolean }) {
  const q = usePetResource<Food[]>(petId, "foods");
  const sug = usePetResource<Suggestion[]>(petId, "foods/suggestions");
  const brands = useBrands();
  const create = usePetMutation<FoodInput>(petId, "foods", "POST", ["foods"]);
  const update = usePetMutation<FoodInput>(petId, "foods", "PATCH", ["foods"]);
  const remove = usePetMutation(petId, "foods", "DELETE", ["foods"]);
  const { toast } = useToast();
  const [editing, setEditing] = useState<Food | "new" | null>(null);
  const [suggestBrand, setSuggestBrand] = useState("");
  const form = useForm<FoodInput>({ resolver: zodResolver(petFoodSchema), defaultValues: { type: "DRY", offersEnabled: true } });
  const brandId = form.watch("brandId");
  const lines = brands.data?.find((b) => b.id === brandId)?.lines ?? [];
  const empty = (v: unknown) => (v === "" ? null : v);

  function openNew() {
    form.reset({ type: "DRY", brandId: null, productLineId: null, brandOther: null, packageSizeG: null, dailyGrams: null, lastPurchaseAt: null, offersEnabled: true });
    setEditing("new");
  }
  function openEdit(f: Food) {
    form.reset({ type: f.type, brandId: f.brandId, productLineId: f.productLineId, brandOther: f.brandOther, packageSizeG: f.packageSizeG, dailyGrams: f.dailyGrams, lastPurchaseAt: f.lastPurchaseAt?.slice(0, 10) ?? null, offersEnabled: f.offersEnabled });
    setEditing(f);
  }
  async function submit(v: FoodInput) {
    try {
      if (editing === "new") await create.mutateAsync({ body: v });
      else if (editing) await update.mutateAsync({ path: `/${editing.id}`, body: v });
      toast("Alimentação salva.", "success");
      setEditing(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function suggest() {
    if (!suggestBrand.trim()) return;
    try {
      await api("/ref/brands", { method: "POST", json: { name: suggestBrand.trim() } });
      toast("Sugestão enviada! O admin vai aprovar em breve.", "success");
      setSuggestBrand("");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  if (q.isLoading) return <Spinner />;
  const foods = q.data ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 font-semibold">
          <Utensils className="h-4 w-4" aria-hidden /> O que este pet come
        </h3>
        {!deceased && (
          <Button type="button" variant="secondary" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar
          </Button>
        )}
      </div>
      {foods.length === 0 ? (
        <Empty title="Nenhum alimento cadastrado" description="Informe a ração e marcas para receber indicações de lojas e ofertas perto de você." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {foods.map((f) => {
            const left = daysLeft(f);
            return (
              <li key={f.id} className="card">
                <p className="text-xs text-[var(--muted)]">{TYPE_LABEL[f.type]}</p>
                <p className="font-medium">{f.brand?.name ?? f.brandOther ?? "Marca não informada"}{f.productLine?.name ? ` · ${f.productLine.name}` : ""}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {f.packageSizeG ? `Embalagem ${f.packageSizeG >= 1000 ? `${f.packageSizeG / 1000} kg` : `${f.packageSizeG} g`}` : ""}
                  {f.dailyGrams ? ` · ${f.dailyGrams} g/dia` : ""}
                  {f.lastPurchaseAt ? ` · comprada em ${fmtDate(f.lastPurchaseAt)}` : ""}
                </p>
                {left != null && <p className={`mt-1 text-xs ${left <= 5 ? "font-semibold text-amber-700 dark:text-amber-300" : "text-[var(--muted)]"}`}>{left > 0 ? `Acaba em cerca de ${left} ${left === 1 ? "dia" : "dias"}` : "Provavelmente acabou — hora de repor!"}</p>}
                {!f.offersEnabled && <p className="mt-1 text-xs text-[var(--muted)]">Ofertas desligadas para este item</p>}
                {!deceased && (
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={() => openEdit(f)} className="btn-ghost h-8 w-8 px-0" aria-label="Editar">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => remove.mutateAsync({ path: `/${f.id}` }).catch((e) => toast(errorMessage(e), "error"))} className="btn-ghost h-8 w-8 px-0 text-red-600" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="indicacoes">
        <h3 id="indicacoes" className="mb-2 inline-flex items-center gap-2 font-semibold">
          <ShoppingBag className="h-4 w-4" aria-hidden /> Onde encontrar perto de você
        </h3>
        {sug.isLoading ? (
          <Spinner />
        ) : (sug.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhuma indicação por enquanto. Cadastre as marcas que seu pet usa e um endereço em Conta.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(sug.data ?? []).map((s, i) => (
              <li key={`${s.partner.id}-${s.item?.id ?? i}`} className="card text-sm">
                <p className="font-medium">
                  <Link href={`/p/${s.partner.slug}`} className="hover:underline">
                    {s.partner.tradeName}
                  </Link>
                  {s.partner.distanceKm != null && <span className="text-xs text-[var(--muted)]"> · {fmtKm(s.partner.distanceKm)}</span>}
                </p>
                {s.item && (
                  <p className="text-xs text-[var(--muted)]">
                    {s.item.name} · {s.item.promoPrice != null ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatBRL(s.item.promoPrice)} (oferta)</span> : formatBRL(s.item.price)}
                  </p>
                )}
                {s.brand?.name && <p className="text-xs text-[var(--muted)]">Marca: {s.brand.name}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Adicionar alimento" : "Editar alimento"}>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Select id="f-type" label="Tipo" {...form.register("type")}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
          <Select id="f-brand" label="Marca" {...form.register("brandId", { setValueAs: empty })}>
            <option value="">Outra / não listada</option>
            {(brands.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {brandId ? (
            <Select id="f-line" label="Linha / produto" {...form.register("productLineId", { setValueAs: empty })}>
              <option value="">—</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="f-brand-other" label="Qual marca?" {...form.register("brandOther", { setValueAs: empty })} />
          )}
          <Input id="f-pack" type="number" min={0} label="Embalagem (g)" {...form.register("packageSizeG", { setValueAs: (v) => (v === "" ? null : Number(v)) })} />
          <Input id="f-daily" type="number" min={0} label="Quantidade diária (g)" {...form.register("dailyGrams", { setValueAs: (v) => (v === "" ? null : Number(v)) })} />
          <Input id="f-last" type="date" label="Última compra" {...form.register("lastPurchaseAt", { setValueAs: empty })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...form.register("offersEnabled")} className="h-4 w-4 accent-brand-500" /> Receber ofertas desta marca (requer consentimento de marketing em Conta)
          </label>
          {!brandId && (
            <div className="flex gap-2 sm:col-span-2">
              <Input id="f-suggest" aria-label="Sugerir nova marca" placeholder="Sugerir marca para o catálogo" value={suggestBrand} onChange={(e) => setSuggestBrand(e.target.value)} className="h-9" />
              <Button type="button" variant="secondary" className="h-9 shrink-0" onClick={suggest} disabled={!suggestBrand.trim()}>
                Sugerir
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
