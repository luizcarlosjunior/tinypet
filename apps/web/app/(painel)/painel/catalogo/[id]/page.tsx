"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Trash2 } from "lucide-react";
import { catalogItemSchema, type CatalogItemInput } from "@tinypet/shared";
import { Button, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Checkbox, ChipSelect, ConfirmDialog, FieldGroup, QueryState, Switch } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { MediaGrid, type MediaItem } from "@/components/media/MediaGrid";
import { useActivePartner } from "@/hooks/use-partner";
import { useBrands, useCategories, useSpecies } from "@/hooks/use-ref";
import { useCatalogItem, useDeleteCatalogItem, useSaveCatalogItem } from "@/hooks/use-catalog";
import { SERVICE_LOCATIONS, SERVICE_LOCATION_LABEL } from "@/components/painel/catalogo/helpers";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import { isoToLocal, localToISO } from "@/lib/format";

type FormValues = CatalogItemInput;

const blank = (v: unknown) => v === "" || v == null || (typeof v === "number" && Number.isNaN(v));
function cleanItem(v: FormValues): FormValues {
  return {
    ...v,
    subcategoryId: v.subcategoryId || null,
    brandId: v.brandId || null,
    productLineId: v.productLineId || null,
    defaultLocation: v.defaultLocation || null,
    price: blank(v.price) ? null : v.price,
    promoPrice: blank(v.promoPrice) ? null : v.promoPrice,
    durationMinutes: blank(v.durationMinutes) ? null : v.durationMinutes,
  };
}

export default function CatalogItemPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === "novo";
  const router = useRouter();
  const { toast } = useToast();
  const { partnerId } = useActivePartner();
  const item = useCatalogItem(partnerId, isNew ? null : id);
  const categories = useCategories();
  const species = useSpecies();
  const brands = useBrands();
  const save = useSaveCatalogItem();
  const del = useDeleteCatalogItem();
  const [confirmDel, setConfirmDel] = useState(false);
  const [onRequest, setOnRequest] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [promoLocal, setPromoLocal] = useState("");

  const form = useForm<FormValues>({
    // "—" selects and cleared number inputs give "" → null (otherwise the schema fails silently, or `money` coerces "" to 0)
    resolver: (values, ctx, opts) => zodResolver(catalogItemSchema)(cleanItem(values), ctx, opts),
    defaultValues: { type: "SERVICE", name: "", description: "", categoryId: "", subcategoryId: null, price: null, promoPrice: null, promoUntil: null, durationMinutes: 60, serviceLocations: ["PARTNER_VENUE"], defaultLocation: "PARTNER_VENUE", bookable: false, speciesKeys: [], brandId: null, productLineId: null, status: "DRAFT", media: [] },
  });
  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = form;

  useEffect(() => {
    if (!item.data) return;
    const d = item.data;
    reset({
      type: d.type,
      name: d.name,
      description: d.description ?? "",
      categoryId: d.categoryId,
      subcategoryId: d.subcategoryId ?? null,
      price: d.price != null ? Number(d.price) : null,
      promoPrice: d.promoPrice != null ? Number(d.promoPrice) : null,
      promoUntil: d.promoUntil ?? null,
      durationMinutes: d.durationMinutes ?? null,
      serviceLocations: d.serviceLocations ?? [],
      defaultLocation: d.defaultLocation ?? null,
      bookable: !!d.bookable,
      speciesKeys: d.speciesKeys ?? [],
      brandId: d.brandId ?? null,
      productLineId: d.productLineId ?? null,
      status: d.status,
    });
    setOnRequest(d.price == null);
    setPromoLocal(isoToLocal(d.promoUntil));
    setMedia((d.media ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((m) => ({ kind: m.kind, url: m.url, thumbUrl: m.thumbUrl, isCover: m.isCover, sortOrder: m.sortOrder })));
  }, [item.data, reset]);

  const type = watch("type");
  const categoryId = watch("categoryId");
  const brandId = watch("brandId");
  const serviceLocations = watch("serviceLocations") ?? [];
  const subcats = useMemo(() => categories.data?.find((c) => c.id === categoryId)?.subcategories ?? [], [categories.data, categoryId]);
  const lines = useMemo(() => brands.data?.find((b) => b.id === brandId)?.lines ?? [], [brands.data, brandId]);

  useEffect(() => {
    const dl = form.getValues("defaultLocation");
    if (dl && !serviceLocations.includes(dl)) setValue("defaultLocation", serviceLocations[0] ?? null);
  }, [serviceLocations, setValue, form]);

  async function onSubmit(v: FormValues) {
    const body: Partial<CatalogItemInput> = {
      ...v,
      price: onRequest ? null : v.price ?? null,
      promoPrice: onRequest ? null : v.promoPrice ?? null,
      promoUntil: promoLocal ? localToISO(promoLocal) : null,
      subcategoryId: v.subcategoryId || null,
      brandId: type === "PRODUCT" ? v.brandId || null : null,
      productLineId: type === "PRODUCT" ? v.productLineId || null : null,
      durationMinutes: type === "SERVICE" ? v.durationMinutes ?? null : null,
      serviceLocations: type === "SERVICE" ? v.serviceLocations ?? [] : [],
      defaultLocation: type === "SERVICE" ? v.defaultLocation ?? null : null,
      bookable: type === "SERVICE" ? !!v.bookable : false,
      media: undefined,
    };
    try {
      const saved = await save.mutateAsync({ id: isNew ? undefined : id, body, media: media.map((m, i) => ({ kind: m.kind, url: m.url, thumbUrl: m.thumbUrl ?? null, isCover: !!m.isCover, sortOrder: i })) });
      if (isNew) router.replace(`/painel/catalogo/${saved.id}`);
    } catch (e) {
      if (!isPlanLimit(e)) toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/painel/catalogo" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Catálogo
      </Link>
      <PageHeader
        title={isNew ? "Novo item" : item.data?.name ?? "Editar item"}
        actions={
          !isNew && (
            <Button type="button" variant="danger" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Excluir
            </Button>
          )
        }
      />
      <PlanLimitNotice error={save.error} className="mb-4" />
      <QueryState isLoading={!isNew && item.isLoading} error={item.error} retry={() => item.refetch()}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FieldGroup title="Informações básicas">
            <div className="space-y-3">
              <fieldset>
                <legend className="label">Tipo</legend>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="SERVICE" {...register("type")} className="accent-brand-500" /> Serviço
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="PRODUCT" {...register("type")} className="accent-brand-500" /> Produto
                  </label>
                </div>
              </fieldset>
              <Input id="name" label="Nome" {...register("name")} error={errors.name?.message} />
              <Textarea id="description" label="Descrição" {...register("description")} error={errors.description?.message} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select id="categoryId" label="Categoria" {...register("categoryId", { onChange: () => setValue("subcategoryId", null) })} error={errors.categoryId?.message}>
                  <option value="">Selecione…</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Select id="subcategoryId" label="Subcategoria" {...register("subcategoryId")} disabled={!subcats.length}>
                  <option value="">—</option>
                  {subcats.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Controller
                control={control}
                name="speciesKeys"
                render={({ field }) => <ChipSelect label="Espécies atendidas" options={(species.data ?? []).map((s) => ({ key: s.key, label: s.label }))} value={field.value ?? []} onChange={field.onChange} />}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Preço">
            <div className="space-y-3">
              <Checkbox label="Sob consulta" description="Não exibe preço na página pública" checked={onRequest} onChange={(e) => setOnRequest(e.target.checked)} />
              {!onRequest && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input id="price" label="Preço (R$)" type="number" step="0.01" min={0} inputMode="decimal" {...register("price")} error={errors.price?.message} />
                  <Input id="promoPrice" label="Preço promocional (R$)" type="number" step="0.01" min={0} inputMode="decimal" {...register("promoPrice")} error={errors.promoPrice?.message} />
                  <Input id="promoUntil" label="Promoção válida até" type="datetime-local" value={promoLocal} onChange={(e) => setPromoLocal(e.target.value)} />
                </div>
              )}
            </div>
          </FieldGroup>

          {type === "SERVICE" && (
            <FieldGroup title="Serviço" description="Duração, local de atendimento e agendamento pelo app.">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input id="durationMinutes" label="Duração (minutos)" type="number" min={5} max={1440} {...register("durationMinutes")} error={errors.durationMinutes?.message} />
                  <Select id="defaultLocation" label="Local padrão" {...register("defaultLocation")}>
                    <option value="">—</option>
                    {serviceLocations.map((l) => (
                      <option key={l} value={l}>
                        {SERVICE_LOCATION_LABEL[l]}
                      </option>
                    ))}
                  </Select>
                </div>
                <fieldset>
                  <legend className="label">Onde atende</legend>
                  <div className="flex flex-wrap gap-4">
                    {SERVICE_LOCATIONS.map((l) => (
                      <Checkbox key={l} label={SERVICE_LOCATION_LABEL[l]} value={l} {...register("serviceLocations")} />
                    ))}
                  </div>
                </fieldset>
                <Controller
                  control={control}
                  name="bookable"
                  render={({ field }) => (
                    <div className="flex items-center gap-3 text-sm">
                      <Switch checked={!!field.value} onChange={field.onChange} label="Agendável pelo app" />
                      <span>Tutores podem solicitar horário pelo app</span>
                    </div>
                  )}
                />
              </div>
            </FieldGroup>
          )}

          {type === "PRODUCT" && (
            <FieldGroup title="Produto" description="Marca e linha cruzam com a alimentação dos pets para sugerir ofertas.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select id="brandId" label="Marca" {...register("brandId", { onChange: () => setValue("productLineId", null) })}>
                  <option value="">—</option>
                  {(brands.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Select id="productLineId" label="Linha" {...register("productLineId")} disabled={!lines.length}>
                  <option value="">—</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
            </FieldGroup>
          )}

          <FieldGroup title="Mídia" description="Até 10 fotos ou vídeos (16:9 ou 9:16). Escolha a capa.">
            <MediaGrid items={media} onChange={setMedia} purpose="CATALOG" partnerId={partnerId} max={10} />
          </FieldGroup>

          <FieldGroup title="Publicação">
            <Select id="status" label="Status" {...register("status")}>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="PAUSED">Pausado</option>
            </Select>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Link href="/painel/catalogo" className="btn-secondary">
              Cancelar
            </Link>
            <Button type="submit" loading={save.isPending}>
              {isNew ? "Criar item" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </QueryState>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={() => del.mutate(id, { onSuccess: () => router.push("/painel/catalogo") })} title="Excluir este item?" description="O item deixa de aparecer na página pública." confirmLabel="Excluir" danger loading={del.isPending} />
    </div>
  );
}
