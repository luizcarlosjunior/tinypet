"use client";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { lessonSchema, safeHref } from "@tinypet/shared";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Checkbox } from "@/components/painel/ui";
import { PlanLimitNotice } from "@/components/painel/PlanLimitNotice";
import { UploadButton } from "@/components/media/UploadButton";
import { useSaveLesson } from "@/hooks/use-courses";
import { errorMessage, isPlanLimit } from "@/lib/errors";
import { WEEKDAYS_SHORT } from "@/lib/format";
import type { CourseModule, Lesson } from "@/types/api";

type LessonInput = z.input<typeof lessonSchema>;

export function LessonModal({ open, onClose, courseId, partnerId, modules, lesson, defaultModuleId, nextSortOrder }: { open: boolean; onClose: () => void; courseId: string; partnerId: string | null; modules: CourseModule[]; lesson?: Lesson | null; defaultModuleId?: string | null; nextSortOrder: number }) {
  const { toast } = useToast();
  const save = useSaveLesson();
  const [videoMode, setVideoMode] = useState<"upload" | "url">("url");
  const [hasExercise, setHasExercise] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("08:00");
  const form = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { moduleId: null, title: "", description: "", videoUrl: "", body: "", durationMinutes: null, exerciseTitle: "", exerciseRule: null, attachments: [] },
  });
  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      moduleId: lesson?.moduleId ?? defaultModuleId ?? null,
      title: lesson?.title ?? "",
      description: lesson?.description ?? "",
      videoUrl: lesson?.videoUrl ?? "",
      body: lesson?.body ?? "",
      durationMinutes: lesson?.durationMinutes ?? null,
      exerciseTitle: lesson?.exerciseTitle ?? "",
      exerciseRule: lesson?.exerciseRule ?? null,
      attachments: lesson?.attachments?.map((a) => ({ name: a.name, url: a.url })) ?? [],
      sortOrder: lesson?.sortOrder ?? nextSortOrder,
    });
    setHasExercise(!!lesson?.exerciseTitle);
    setTimes(lesson?.exerciseRule?.times ?? []);
    setVideoMode("url");
  }, [open, lesson, defaultModuleId, nextSortOrder, reset]);

  const videoUrl = watch("videoUrl");
  const attachments = watch("attachments") ?? [];
  const freq = watch("exerciseRule.freq");
  const days = watch("exerciseRule.days") ?? [];

  async function onSubmit(v: LessonInput) {
    const body = {
      ...v,
      moduleId: v.moduleId || null,
      videoUrl: v.videoUrl || null,
      exerciseTitle: hasExercise ? v.exerciseTitle || null : null,
      exerciseRule: hasExercise && v.exerciseRule?.freq ? { freq: v.exerciseRule.freq, days: v.exerciseRule.freq === "weekly" ? days : undefined, times } : null,
    };
    try {
      await save.mutateAsync({ courseId, id: lesson?.id, body });
      toast("Aula salva", "success");
      onClose();
    } catch (e) {
      if (!isPlanLimit(e)) toast(errorMessage(e), "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={lesson ? "Editar aula" : "Nova aula"} className="sm:max-w-2xl">
      <PlanLimitNotice error={save.error} className="mb-3" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="ls-module" label="Módulo" {...register("moduleId")}>
            <option value="">Sem módulo</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
          <Input id="ls-duration" label="Duração (min)" type="number" min={0} {...register("durationMinutes")} error={errors.durationMinutes?.message} />
        </div>
        <Input id="ls-title" label="Título" {...register("title")} error={errors.title?.message} />
        <Textarea id="ls-desc" label="Descrição" className="min-h-[60px]" {...register("description")} />

        <fieldset className="rounded-xl border p-3">
          <legend className="px-1 text-xs font-medium text-[var(--muted)]">Vídeo (16:9 ou 9:16)</legend>
          <div className="mb-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="videoMode" className="accent-brand-500" checked={videoMode === "url"} onChange={() => setVideoMode("url")} /> URL externa
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="videoMode" className="accent-brand-500" checked={videoMode === "upload"} onChange={() => setVideoMode("upload")} /> Enviar vídeo
            </label>
          </div>
          {videoMode === "url" ? (
            <Input id="ls-video" label="URL do vídeo" placeholder="https://youtube.com/…" {...register("videoUrl")} error={errors.videoUrl?.message} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton purpose="COURSE" partnerId={partnerId} accept="video/mp4,video/quicktime" label="Enviar vídeo (MP4/MOV)" onUploaded={(m) => setValue("videoUrl", m.url)} />
              {videoUrl && <span className="truncate text-xs text-[var(--muted)]">{videoUrl}</span>}
            </div>
          )}
        </fieldset>

        <Textarea id="ls-body" label="Texto da aula" {...register("body")} />

        <div>
          <span className="label">Anexos (PDF)</span>
          <ul className="mb-2 space-y-1 text-sm">
            {attachments.map((a, i) => (
              <li key={`${a.url}-${i}`} className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                <a href={safeHref(a.url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                  {a.name}
                </a>
                <button type="button" className="btn-ghost h-7 w-7 p-0 text-red-600" aria-label={`Remover ${a.name}`} onClick={() => setValue("attachments", attachments.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <UploadButton purpose="ATTACHMENT" partnerId={partnerId} accept="application/pdf" label="Adicionar PDF" onUploaded={(m, f) => setValue("attachments", [...attachments, { name: f.name, url: m.url }])} />
        </div>

        <fieldset className="rounded-xl border p-3">
          <legend className="px-1 text-xs font-medium text-[var(--muted)]">Exercício prático</legend>
          <Checkbox label="Esta aula tem um exercício para a rotina do pet" checked={hasExercise} onChange={(e) => setHasExercise(e.target.checked)} />
          {hasExercise && (
            <div className="mt-3 space-y-3">
              <Input id="ls-ex-title" label="Tarefa" placeholder='Ex.: "Treinar senta 3x ao dia"' {...register("exerciseTitle")} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select id="ls-ex-freq" label="Frequência" {...register("exerciseRule.freq")}>
                  <option value="">—</option>
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                </Select>
                <div>
                  <span className="label">Horários</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {times.map((t) => (
                      <span key={t} className="badge bg-ink-100 dark:bg-ink-800">
                        {t}
                        <button type="button" className="ml-1" aria-label={`Remover ${t}`} onClick={() => setTimes(times.filter((x) => x !== t))}>
                          ×
                        </button>
                      </span>
                    ))}
                    <input type="time" aria-label="Novo horário" className="input h-8 w-28 py-0" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Adicionar horário" onClick={() => newTime && !times.includes(newTime) && setTimes([...times, newTime].sort())}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              {freq === "weekly" && (
                <Controller
                  control={control}
                  name="exerciseRule.days"
                  render={({ field }) => (
                    <div>
                      <span className="label">Dias da semana</span>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS_SHORT.map((d, i) => {
                          const on = (field.value ?? []).includes(i);
                          return (
                            <button key={d} type="button" aria-pressed={on} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : ""}`} onClick={() => field.onChange(on ? (field.value ?? []).filter((x: number) => x !== i) : [...(field.value ?? []), i].sort())}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          )}
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar aula
          </Button>
        </div>
      </form>
    </Modal>
  );
}
