"use client";
import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

/** Share bar: native share sheet when available, WhatsApp / Facebook / X / LinkedIn / copy link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
  const btn = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-ink-800";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Compartilhar">
      {canShare && (
        <button type="button" className={btn} onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <Share2 className="h-4 w-4" aria-hidden />
          Compartilhar
        </button>
      )}
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={btn}>
          {l.label}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ))}
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* ignore */
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        <span aria-live="polite">{copied ? "Link copiado" : "Copiar link"}</span>
      </button>
    </div>
  );
}
