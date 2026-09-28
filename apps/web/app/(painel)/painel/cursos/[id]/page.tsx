"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { courseSchema, safeHref } from "@tinypet/shared";
import { Badge, Button, Empty, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Checkbox, ChipSelect, ConfirmDialog, FieldGroup, QueryState, Table, Tabs, td, th } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { UploadButton } from "@/components/media/UploadButton";
import { useActivePartner } from "@/hooks/use-partner";
import { useCategories, useSpecies } from "@/hooks/use-ref";
import { useCourse, useDeleteCourse, useDeleteLesson, useDeleteModule, useLessons, useSaveCourse, useSaveLesson, useSaveModule, useStudents } from "@/hooks/use-courses";
import { COURSE_LEVEL_LABEL, COURSE_STATUS_LABEL, COURSE_STATUS_TONE } from "@/components/painel/cursos/helpers";
import { LessonModal } from "@/components/painel/cursos/LessonModal";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import { fmtDate, fmtMinutes } from "@/lib/format";
import type { Lesson } from "@/types/api";

type CourseInput = z.input<typeof courseSchema>;
type Tab = "curso" | "conteudo" | "alunos";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "novo";
  const router = useRouter();
  const sp = useSearchParams();
  const tab = ((sp.get("tab") as Tab) || "curso") as Tab;
  const setTab = (t: Tab) => router.replace(`/painel/cursos/${id}?tab=${t}`);
  const { partnerId } = useActivePartner();
  const course = useCourse(partnerId, isNew ? null : id);
  const del = useDeleteCourse();
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/painel/cursos" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Cursos
      </Link>
      <PageHeader
        title={isNew ? "Novo curso" : course.data?.title ?? "Curso"}
        description={course.data ? `${COURSE_LEVEL_LABEL[course.data.level]} · ${COURSE_STATUS_LABEL[course.data.status]}` : undefined}
        actions={
          !isNew && (
            <Button type="button" variant="danger" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Excluir
            </Button>
          )
        }
      />
      {!isNew && <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ key: "curso", label: "Curso" }, { key: "conteudo", label: "Conteúdo" }, { key: "alunos", label: "Alunos" }]} />}
      <QueryState isLoading={!isNew && course.isLoading} error={course.error} retry={() => course.refetch()}>
        {(isNew || tab === "curso") && <CourseForm id={isNew ? null : id} />}
        {!isNew && tab === "conteudo" && <ContentTab courseId={id} />}
        {!isNew && tab === "alunos" && <StudentsTab courseId={id} />}
      </QueryState>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={() => del.mutate(id, { onSuccess: () => router.push("/painel/cursos") })} title="Excluir este curso?" description="Alunos matriculados perdem o acesso ao conteúdo." confirmLabel="Excluir" danger loading={del.isPending} />
    </div>
  );
}

function CourseForm({ id }: { id: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const { partnerId } = useActivePartner();
  const course = useCourse(partnerId, id);
  const categories = useCategories();
  const species = useSpecies();
  const save = useSaveCourse();
  const [free, setFree] = useState(true);
  const form = useForm<CourseInput>({ resolver: zodResolver(courseSchema), defaultValues: { title: "", description: "", coverUrl: null, categoryId: null, speciesKeys: [], level: "BEGINNER", price: null, status: "DRAFT" } });
  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = form;

  useEffect(() => {
    if (!course.data) return;
    const c = course.data;
    reset({ title: c.title, description: c.description ?? "", coverUrl: c.coverUrl ?? null, categoryId: c.categoryId ?? null, speciesKeys: c.speciesKeys ?? [], level: c.level, price: c.price != null ? Number(c.price) : null, status: c.status });
    setFree(c.price == null || Number(c.price) === 0);
  }, [course.data, reset]);

  const coverUrl = watch("coverUrl");

  async function onSubmit(v: CourseInput) {
    const body = { ...v, categoryId: v.categoryId || null, price: free ? null : v.price ?? null };
    try {
      const saved = await save.mutateAsync({ id: id ?? undefined, body });
      toast("Curso salvo", "success");
      if (!id) router.replace(`/painel/cursos/${saved.id}?tab=conteudo`);
    } catch (e) {
      if (!isPlanLimit(e)) toast(errorMessage(e), "error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <PlanLimitNotice error={save.error} />
      <FieldGroup title="Sobre o curso">
        <div className="space-y-3">
          <Input id="c-title" label="Título" {...register("title")} error={errors.title?.message} />
          <Textarea id="c-desc" label="Descrição" {...register("description")} />
          <div>
            <span className="label">Capa</span>
            <div className="flex flex-wrap items-center gap-3">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeHref(coverUrl)} alt="Capa do curso" className="h-24 w-40 rounded-xl object-cover" />
              ) : (
                <div className="flex h-24 w-40 items-center justify-center rounded-xl bg-ink-100 text-xs text-[var(--muted)] dark:bg-ink-900">Sem capa</div>
              )}
              <UploadButton purpose="COURSE" partnerId={partnerId} accept="image/*" label={coverUrl ? "Trocar capa" : "Enviar capa"} onUploaded={(m) => setValue("coverUrl", m.url)} />
              {coverUrl && (
                <Button type="button" variant="ghost" onClick={() => setValue("coverUrl", null)}>
                  Remover
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="c-cat" label="Categoria" {...register("categoryId")}>
              <option value="">—</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select id="c-level" label="Nível" {...register("level")}>
              {(Object.keys(COURSE_LEVEL_LABEL) as (keyof typeof COURSE_LEVEL_LABEL)[]).map((k) => (
                <option key={k} value={k}>
                  {COURSE_LEVEL_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <Controller control={control} name="speciesKeys" render={({ field }) => <ChipSelect label="Espécies-alvo" options={(species.data ?? []).map((s) => ({ key: s.key, label: s.label }))} value={field.value ?? []} onChange={field.onChange} />} />
        </div>
      </FieldGroup>
      <FieldGroup title="Preço e publicação">
        <div className="space-y-3">
          <Checkbox label="Curso gratuito" checked={free} onChange={(e) => setFree(e.target.checked)} />
          {!free && (
            <div>
              <Input id="c-price" label="Preço (R$)" type="number" step="0.01" min={0} inputMode="decimal" {...register("price")} error={errors.price?.message} />
              <p className="mt-1 text-xs text-[var(--muted)]">Cursos pagos exigem plano com esse recurso liberado e geram contrato no Financeiro na matrícula.</p>
            </div>
          )}
          <Select id="c-status" label="Status" {...register("status")}>
            {(Object.keys(COURSE_STATUS_LABEL) as (keyof typeof COURSE_STATUS_LABEL)[]).map((k) => (
              <option key={k} value={k}>
                {COURSE_STATUS_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Link href="/painel/cursos" className="btn-secondary">
          Cancelar
        </Link>
        <Button type="submit" loading={save.isPending}>
          {id ? "Salvar" : "Criar curso"}
        </Button>
      </div>
    </form>
  );
}

function ContentTab({ courseId }: { courseId: string }) {
  const { partnerId } = useActivePartner();
  const course = useCourse(partnerId, courseId);
  const lessonsQ = useLessons(partnerId, courseId);
  const saveModule = useSaveModule();
  const deleteModule = useDeleteModule();
  const saveLesson = useSaveLesson();
  const deleteLesson = useDeleteLesson();
  const { toast } = useToast();
  const [moduleModal, setModuleModal] = useState<{ open: boolean; id?: string; title: string }>({ open: false, title: "" });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; lesson?: Lesson | null; moduleId?: string | null }>({ open: false });
  const [delTarget, setDelTarget] = useState<{ kind: "module" | "lesson"; id: string; title: string } | null>(null);

  const modules = useMemo(() => (course.data?.modules ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [course.data]);
  const lessons = useMemo(() => (lessonsQ.data ?? course.data?.lessons ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [lessonsQ.data, course.data]);
  const groups = useMemo(() => {
    const byModule = new Map<string | null, Lesson[]>();
    for (const l of lessons) {
      const k = l.moduleId && modules.some((m) => m.id === l.moduleId) ? l.moduleId : null;
      byModule.set(k, [...(byModule.get(k) ?? []), l]);
    }
    return [...modules.map((m) => ({ id: m.id as string | null, title: m.title, lessons: byModule.get(m.id) ?? [] })), { id: null, title: "Sem módulo", lessons: byModule.get(null) ?? [] }];
  }, [modules, lessons]);

  function moveLesson(list: Lesson[], i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    const updates = next.map((l, idx) => ({ l, idx })).filter(({ l, idx }) => l.sortOrder !== idx);
    Promise.all(updates.map(({ l, idx }) => saveLesson.mutateAsync({ courseId, id: l.id, body: { sortOrder: idx } }))).catch((e) => toast(errorMessage(e), "error"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setModuleModal({ open: true, title: "" })}>
          <Plus className="h-4 w-4" aria-hidden /> Módulo
        </Button>
        <Button type="button" onClick={() => setLessonModal({ open: true, lesson: null, moduleId: null })}>
          <Plus className="h-4 w-4" aria-hidden /> Nova aula
        </Button>
      </div>
      <QueryState isLoading={lessonsQ.isLoading && !course.data?.lessons} error={lessonsQ.error && !course.data?.lessons ? lessonsQ.error : undefined} retry={() => lessonsQ.refetch()}>
        {lessons.length === 0 && modules.length === 0 && <Empty title="Sem conteúdo ainda" description="Crie módulos (opcional) e aulas com vídeo, texto, anexos e exercício." />}
        {groups
          .filter((g) => g.id !== null || g.lessons.length > 0)
          .map((g) => (
            <section key={g.id ?? "none"} className="card" aria-labelledby={`mod-${g.id ?? "none"}`}>
              <header className="mb-2 flex items-center justify-between gap-2">
                <h3 id={`mod-${g.id ?? "none"}`} className="font-semibold">
                  {g.title} <span className="text-xs font-normal text-[var(--muted)]">({g.lessons.length} aulas)</span>
                </h3>
                {g.id && (
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={() => setLessonModal({ open: true, lesson: null, moduleId: g.id })}>
                      <Plus className="h-4 w-4" aria-hidden /> Aula
                    </button>
                    <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Renomear módulo ${g.title}`} onClick={() => setModuleModal({ open: true, id: g.id!, title: g.title })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Excluir módulo ${g.title}`} onClick={() => setDelTarget({ kind: "module", id: g.id!, title: g.title })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </header>
              {g.lessons.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Nenhuma aula neste módulo.</p>
              ) : (
                <ol className="divide-y">
                  {g.lessons.map((l, i) => (
                    <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="w-6 text-center text-xs text-[var(--muted)]">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{l.title}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {[l.durationMinutes ? fmtMinutes(l.durationMinutes) : null, l.videoUrl ? "vídeo" : null, l.attachments?.length ? `${l.attachments.length} anexo(s)` : null, l.exerciseTitle ? `exercício: ${l.exerciseTitle}` : null].filter(Boolean).join(" · ") || "sem mídia"}
                        </span>
                      </span>
                      <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Mover para cima" disabled={i === 0} onClick={() => moveLesson(g.lessons, i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Mover para baixo" disabled={i === g.lessons.length - 1} onClick={() => moveLesson(g.lessons, i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Editar aula ${l.title}`} onClick={() => setLessonModal({ open: true, lesson: l })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-ghost h-8 w-8 p-0 text-red-600" aria-label={`Excluir aula ${l.title}`} onClick={() => setDelTarget({ kind: "lesson", id: l.id, title: l.title })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
      </QueryState>

      <Modal open={moduleModal.open} onClose={() => setModuleModal({ open: false, title: "" })} title={moduleModal.id ? "Renomear módulo" : "Novo módulo"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveModule.mutate({ courseId, id: moduleModal.id, title: moduleModal.title }, { onSuccess: () => setModuleModal({ open: false, title: "" }) });
          }}
        >
          <Input id="mod-title" label="Título do módulo" value={moduleModal.title} onChange={(e) => setModuleModal((m) => ({ ...m, title: e.target.value }))} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModuleModal({ open: false, title: "" })}>
              Cancelar
            </Button>
            <Button type="submit" loading={saveModule.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <LessonModal open={lessonModal.open} onClose={() => setLessonModal({ open: false })} courseId={courseId} partnerId={partnerId} modules={modules} lesson={lessonModal.lesson} defaultModuleId={lessonModal.moduleId} nextSortOrder={lessons.length ? Math.max(...lessons.map((l) => l.sortOrder)) + 1 : 0} />

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => {
          if (!delTarget) return;
          const opts = { onSuccess: () => setDelTarget(null) };
          if (delTarget.kind === "module") deleteModule.mutate({ courseId, id: delTarget.id }, opts);
          else deleteLesson.mutate({ courseId, id: delTarget.id }, opts);
        }}
        title={`Excluir ${delTarget?.kind === "module" ? "módulo" : "aula"} "${delTarget?.title}"?`}
        description={delTarget?.kind === "module" ? "As aulas do módulo passam para \"Sem módulo\"." : "O progresso dos alunos nesta aula é perdido."}
        confirmLabel="Excluir"
        danger
        loading={deleteModule.isPending || deleteLesson.isPending}
      />
    </div>
  );
}

function StudentsTab({ courseId }: { courseId: string }) {
  const { partnerId } = useActivePartner();
  const q = useStudents(partnerId, courseId);
  const rows = q.data ?? [];
  return (
    <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} isEmpty={rows.length === 0} empty={<Empty title="Nenhum aluno matriculado" description="Publique o curso para que tutores possam se matricular." />}>
      <Table>
        <thead>
          <tr>
            <th className={th}>Aluno</th>
            <th className={th}>Pets</th>
            <th className={th}>Progresso</th>
            <th className={th}>Matrícula</th>
            <th className={th}>Dúvidas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const pct = s.progressPct ?? s.progress ?? (s.totalLessons ? Math.round(((s.completedLessons ?? 0) / s.totalLessons) * 100) : 0);
            return (
              <tr key={s.id}>
                <td className={td}>
                  <span className="block font-medium">{s.user?.name ?? "—"}</span>
                  {s.user?.email && <span className="text-xs text-[var(--muted)]">{s.user.email}</span>}
                </td>
                <td className={td}>{(s.pets ?? []).map((p) => ("pet" in p ? p.pet.name : p.name)).join(", ") || "—"}</td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs">{pct}%</span>
                    {pct >= 100 && <Badge tone="green">Concluído</Badge>}
                  </div>
                </td>
                <td className={td}>{fmtDate(s.enrolledAt ?? s.createdAt)}</td>
                <td className={td}>
                  {s.questions?.length ? (
                    <ul className="space-y-1 text-xs">
                      {s.questions.map((qq, i) => (
                        <li key={i}>
                          {qq.lessonTitle && <span className="font-medium">{qq.lessonTitle}: </span>}
                          {qq.question}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </QueryState>
  );
}
