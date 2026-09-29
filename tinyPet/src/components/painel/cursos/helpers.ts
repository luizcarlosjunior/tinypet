import type { Course } from "@/types/api";

export const COURSE_LEVEL_LABEL: Record<Course["level"], string> = { BEGINNER: "Iniciante", INTERMEDIATE: "Intermediário", ADVANCED: "Avançado" };
export const COURSE_STATUS_LABEL: Record<Course["status"], string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", ARCHIVED: "Arquivado" };
export const COURSE_STATUS_TONE: Record<Course["status"], "gray" | "green" | "amber"> = { DRAFT: "gray", PUBLISHED: "green", ARCHIVED: "amber" };
