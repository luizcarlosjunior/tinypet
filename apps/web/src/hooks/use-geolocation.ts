"use client";
import { useCallback, useState } from "react";

export type Coords = { lat: number; lng: number };

/** On-demand browser geolocation with pt-BR error messages. */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(
    () =>
      new Promise<Coords | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setError("Seu navegador não permite localização.");
          resolve(null);
          return;
        }
        setLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords(c);
            setLoading(false);
            resolve(c);
          },
          () => {
            setError("Não conseguimos acessar sua localização.");
            setLoading(false);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
      }),
    [],
  );

  return { coords, loading, error, locate, clear: () => setCoords(null) };
}
