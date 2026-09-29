import { cn } from "@/lib/utils";

/**
 * Renders post HTML that was sanitized on save AND again right before render (see sanitizeBlogHtml).
 * Never pass unsanitized HTML here.
 */
export function PostBody({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "blog-body max-w-none break-words text-base leading-relaxed text-[var(--fg)] sm:text-[1.0625rem]",
        "[&_p]:my-4 [&_h1]:mb-3 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:font-semibold",
        "[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-brand-400",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
        "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--muted)]",
        "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-ink-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-ink-50 [&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1 [&_code]:text-[0.9em] dark:[&_code]:bg-ink-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_hr]:my-8 [&_mark]:rounded [&_mark]:bg-amber-200 [&_mark]:px-0.5 dark:[&_mark]:bg-amber-500/40 dark:[&_mark]:text-[var(--fg)]",
        "[&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img[data-align=center]]:mx-auto [&_img[data-align=right]]:ml-auto",
        "[&_figure]:my-6 [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-[var(--muted)]",
        "[&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-ink-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:bg-ink-800",
        "[&_iframe]:my-6 [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:rounded-xl",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
