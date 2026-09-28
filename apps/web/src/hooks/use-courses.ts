"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import type { Course, CourseModule, Lesson } from "@/types/api";

export type Student = {
  id: string;
  user?: { id: string; name: string; email?: string } | null;
  pets?: ({ name: string } | { pet: { name: string } })[];
  progressPct?: number | null;
  progress?: number | null;
  completedLessons?: number;
  totalLessons?: number;
  createdAt?: string;
  enrolledAt?: string;
  questions?: { lessonId?: string; lessonTitle?: string; question: string; createdAt?: string }[];
};

export function useCourses(partnerId: string | null) {
  return useQuery({ queryKey: ["courses", partnerId], queryFn: () => api<Course[]>("/courses"), enabled: !!partnerId });
}
export function useCourse(partnerId: string | null, id: string | null) {
  return useQuery({ queryKey: ["courses", partnerId, "item", id], queryFn: () => api<Course>(`/courses/${id}`), enabled: !!partnerId && !!id && id !== "novo" });
}
export function useLessons(partnerId: string | null, courseId: string | null) {
  return useQuery({ queryKey: ["courses", partnerId, "lessons", courseId], queryFn: () => api<Lesson[]>(`/courses/${courseId}/lessons`), enabled: !!partnerId && !!courseId && courseId !== "novo" });
}
export function useStudents(partnerId: string | null, courseId: string | null) {
  return useQuery({ queryKey: ["courses", partnerId, "students", courseId], queryFn: () => api<Student[]>(`/courses/${courseId}/students`), enabled: !!partnerId && !!courseId && courseId !== "novo" });
}

function useCourseMutation<TVars>(fn: (v: TVars) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["partner"] });
      if (success) toast(success, "success");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
}

export function useSaveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) => (id ? api<Course>(`/courses/${id}`, { method: "PATCH", json: body }) : api<Course>("/courses", { method: "POST", json: body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["partner"] });
    },
  });
}
export function useDeleteCourse() {
  return useCourseMutation((id: string) => api(`/courses/${id}`, { method: "DELETE" }), "Curso removido");
}
export function useSaveModule() {
  return useCourseMutation(({ courseId, id, title, sortOrder }: { courseId: string; id?: string; title: string; sortOrder?: number }) => (id ? api<CourseModule>(`/courses/${courseId}/modules/${id}`, { method: "PATCH", json: { title, sortOrder } }) : api<CourseModule>(`/courses/${courseId}/modules`, { method: "POST", json: { title } })), "Módulo salvo");
}
export function useDeleteModule() {
  return useCourseMutation(({ courseId, id }: { courseId: string; id: string }) => api(`/courses/${courseId}/modules/${id}`, { method: "DELETE" }), "Módulo removido");
}
export function useSaveLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, id, body }: { courseId: string; id?: string; body: Record<string, unknown> }) => (id ? api<Lesson>(`/courses/${courseId}/lessons/${id}`, { method: "PATCH", json: body }) : api<Lesson>(`/courses/${courseId}/lessons`, { method: "POST", json: body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["partner"] });
    },
  });
}
export function useDeleteLesson() {
  return useCourseMutation(({ courseId, id }: { courseId: string; id: string }) => api(`/courses/${courseId}/lessons/${id}`, { method: "DELETE" }), "Aula removida");
}
