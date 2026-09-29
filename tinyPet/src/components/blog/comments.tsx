"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Flag, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Avatar } from "@/components/ui/avatar";
import { Button, Modal, Spinner } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime } from "@/lib/format";
import { COMMENT_MAX, COMMENT_MIN, commentBodyError, normalizeCommentBody } from "@/server/blog/text";
import { CommentText } from "./comment-text";
import { HeartButton } from "./heart-button";

export type BlogComment = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  parentId: string | null;
  user: { id: string; name: string; username: string | null; avatarUrl: string | null };
  heartsCount: number;
  viewerHearted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  replies?: BlogComment[];
};
type Page = { items: BlogComment[]; nextCursor: string | null; commentsEnabled: boolean };

function errMsg(e: unknown) {
  if (e instanceof ApiClientError) return e.message;
  return "Algo deu errado. Tente novamente.";
}

function Composer({ onSubmit, initial = "", submitLabel, placeholder, onCancel, autoFocus = false }: { onSubmit: (body: string) => Promise<void>; initial?: string; submitLabel: string; placeholder: string; onCancel?: () => void; autoFocus?: boolean }) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const normalized = normalizeCommentBody(body);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = commentBodyError(normalized);
        if (err) return setError(err);
        setBusy(true);
        setError(null);
        try {
          await onSubmit(normalized);
          setBody("");
        } catch (e2) {
          setError(errMsg(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        maxLength={COMMENT_MAX}
        rows={3}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={`${id}-help`}
        className="input min-h-[84px] resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-help`} className={error ? "text-xs text-red-600" : "text-xs text-[var(--muted)]"} role={error ? "alert" : undefined}>
          {error ?? `${normalized.length}/${COMMENT_MAX} · texto simples, até 2 links`}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" loading={busy} disabled={normalized.length < COMMENT_MIN}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function CommentView({ c, postId, slug, loggedIn, isReply, commentsEnabled, onChanged }: { c: BlogComment; postId: string; slug: string; loggedIn: boolean; isReply: boolean; commentsEnabled: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const nextPath = `/blog/${slug}#comentarios`;

  return (
    <li className="flex gap-3">
      <Avatar src={c.user.avatarUrl} name={c.user.name} size={isReply ? 32 : 40} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-ink-50 px-3 py-2 dark:bg-ink-800/60">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-semibold">{c.user.name}</span>
            {c.user.username && <span className="text-xs text-[var(--muted)]">@{c.user.username}</span>}
          </p>
          {editing ? (
            <div className="mt-2">
              <Composer
                initial={c.body}
                submitLabel="Salvar"
                placeholder="Edite seu comentário"
                autoFocus
                onCancel={() => setEditing(false)}
                onSubmit={async (body) => {
                  await api(`/blog/comments/${c.id}`, { method: "PATCH", json: { body } });
                  setEditing(false);
                  onChanged();
                }}
              />
            </div>
          ) : (
            <CommentText body={c.body} />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-xs text-[var(--muted)]">
          <time dateTime={c.createdAt}>{fmtDateTime(c.createdAt)}</time>
          {c.editedAt && <span title={`Editado em ${fmtDateTime(c.editedAt)}`}>(editado)</span>}
          <HeartButton endpoint={`/blog/comments/${c.id}/heart`} initialHearted={c.viewerHearted} initialCount={c.heartsCount} loggedIn={loggedIn} nextPath={nextPath} size="sm" label="Coração para este comentário" />
          {!isReply && commentsEnabled && loggedIn && (
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--fg)]" onClick={() => setReplying((v) => !v)} aria-expanded={replying}>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Responder
            </button>
          )}
          {c.canEdit && !editing && (
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--fg)]" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
            </button>
          )}
          {c.canDelete && (
            <button type="button" className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
            </button>
          )}
          {loggedIn && !c.canEdit && (
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--fg)]" onClick={() => setReporting(true)}>
              <Flag className="h-3.5 w-3.5" aria-hidden /> Denunciar
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-3">
            <Composer
              submitLabel="Responder"
              placeholder={`Responder a ${c.user.name}`}
              autoFocus
              onCancel={() => setReplying(false)}
              onSubmit={async (body) => {
                await api(`/blog/posts/${postId}/comments`, { method: "POST", json: { body, parentId: c.id } });
                setReplying(false);
                onChanged();
              }}
            />
          </div>
        )}

        {!!c.replies?.length && (
          <ul className="mt-3 space-y-3" aria-label={`Respostas a ${c.user.name}`}>
            {c.replies.map((r) => (
              <CommentView key={r.id} c={r} postId={postId} slug={slug} loggedIn={loggedIn} isReply commentsEnabled={commentsEnabled} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir comentário?"
        description={isReply ? "A resposta será removida." : "O comentário e as respostas deixarão de aparecer."}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/blog/comments/${c.id}`, { method: "DELETE" });
            setConfirmDelete(false);
            toast("Comentário excluído", "success");
            onChanged();
          } catch (e) {
            toast(errMsg(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Modal open={reporting} onClose={() => setReporting(false)} title="Denunciar comentário">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/blog/comments/${c.id}/report`, { method: "POST", json: { reason: reason.trim() } });
              setReporting(false);
              setReason("");
              toast("Obrigado! A equipe vai analisar.", "success");
            } catch (e2) {
              toast(errMsg(e2), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`reason-${c.id}`} className="label">
            Motivo
          </label>
          <textarea id={`reason-${c.id}`} className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required minLength={3} placeholder="Ex.: ofensivo, spam, informação falsa…" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReporting(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={reason.trim().length < 3}>
              Enviar denúncia
            </Button>
          </div>
        </form>
      </Modal>
    </li>
  );
}

/** Comments thread: logged-out readers see comments and a login CTA. */
export function Comments({ postId, slug, commentsEnabled, initialCount }: { postId: string; slug: string; commentsEnabled: boolean; initialCount: number }) {
  const { status } = useSession();
  const loggedIn = status === "authenticated";
  const qc = useQueryClient();
  const key = ["blog", "comments", postId, loggedIn] as const;
  const q = useInfiniteQuery<Page, Error, InfiniteData<Page>, typeof key, string | null>({
    queryKey: key,
    initialPageParam: null,
    queryFn: ({ pageParam }) => api<Page>(`/blog/posts/${postId}/comments?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (last) => last.nextCursor,
    enabled: status !== "loading",
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["blog", "comments", postId] });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const enabled = q.data?.pages[0]?.commentsEnabled ?? commentsEnabled;
  const [count, setCount] = useState(initialCount);

  return (
    <section id="comentarios" aria-labelledby="comentarios-titulo" className="scroll-mt-24 space-y-5">
      <h2 id="comentarios-titulo" className="text-xl font-bold">
        Comentários <span className="text-[var(--muted)]">({count})</span>
      </h2>

      {enabled ? (
        loggedIn ? (
          <Composer
            submitLabel="Comentar"
            placeholder="Escreva um comentário"
            onSubmit={async (body) => {
              await api(`/blog/posts/${postId}/comments`, { method: "POST", json: { body } });
              setCount((c) => c + 1);
              refresh();
            }}
          />
        ) : status === "loading" ? null : (
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">Entre na sua conta para comentar e dar corações.</p>
            <div className="flex gap-2">
              <Link href={`/entrar?next=${encodeURIComponent(`/blog/${slug}#comentarios`)}`} className="btn-primary">
                Entrar
              </Link>
              <Link href={`/cadastro?next=${encodeURIComponent(`/blog/${slug}#comentarios`)}`} className="btn-secondary">
                Criar conta
              </Link>
            </div>
          </div>
        )
      ) : (
        <p className="text-sm text-[var(--muted)]">Os comentários estão desativados neste post.</p>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : q.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Não foi possível carregar os comentários.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ainda não há comentários. {enabled ? "Seja o primeiro!" : ""}</p>
      ) : (
        <ul className="space-y-5">
          {items.map((c) => (
            <CommentView
              key={c.id}
              c={c}
              postId={postId}
              slug={slug}
              loggedIn={loggedIn}
              isReply={false}
              commentsEnabled={enabled}
              onChanged={() => {
                refresh();
                api<{ commentsCount: number }>(`/blog/posts/${postId}`)
                  .then((p) => setCount(p.commentsCount))
                  .catch(() => undefined);
              }}
            />
          ))}
        </ul>
      )}
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
            Carregar mais comentários
          </Button>
        </div>
      )}
    </section>
  );
}
