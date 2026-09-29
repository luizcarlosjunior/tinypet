"use client";
import { useEffect, useRef } from "react";

/** Registers one view per page load (skipped in preview). Fire-and-forget, keepalive. */
export function ViewBeacon({ postId, disabled = false }: { postId: string; disabled?: boolean }) {
  const sent = useRef(false);
  useEffect(() => {
    if (disabled || sent.current) return;
    sent.current = true;
    fetch(`/api/v1/blog/posts/${encodeURIComponent(postId)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenWidth: window.screen.width, screenHeight: window.screen.height, referrer: document.referrer || null }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }, [postId, disabled]);
  return null;
}
