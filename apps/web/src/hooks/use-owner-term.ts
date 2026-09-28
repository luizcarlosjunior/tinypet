"use client";
import { useSessionContext } from "./use-session-context";

/** The user's preferred term ("Tutor", "Dono", "Mãe de pet"…) with fallback "Tutor". */
export function useOwnerTerm(): string {
  const { user } = useSessionContext();
  return user?.ownerTerm?.trim() || "Tutor";
}
