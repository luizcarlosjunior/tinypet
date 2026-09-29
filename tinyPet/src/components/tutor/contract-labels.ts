import type { Contract } from "@/hooks/use-me";

export const CONTRACT_STATUS_LABEL: Record<Contract["status"], string> = { DRAFT: "Aguardando aceite", ACTIVE: "Ativo", COMPLETED: "Concluído", CANCELED: "Cancelado" };
export const CONTRACT_TYPE_LABEL: Record<Contract["type"], string> = { PACKAGE: "Pacote", RECURRING: "Recorrente", SINGLE: "Avulso", COURSE: "Curso" };
