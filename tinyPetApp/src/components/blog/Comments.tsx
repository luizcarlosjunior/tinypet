import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "@/lib/api";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { BlogComment } from "@/lib/types";
import { blogErrorMessage, useBlogComments, useCommentHeart, useCreateComment, useDeleteComment, useReportComment, useUpdateComment } from "@/hooks/use-blog";
import { Avatar, Button, Input, ListItem, Sheet, Text } from "@/components/ui";
import { HeartButton } from "./HeartButton";
import { LinkifiedText } from "./LinkifiedText";

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 2000;

const REPORT_REASONS = [
  "Spam ou propaganda",
  "Ofensivo, discurso de ódio ou assédio",
  "Informação falsa ou perigosa para os pets",
  "Conteúdo impróprio",
  "Outro motivo",
] as const;

function lengthError(body: string): string | null {
  const n = body.trim().length;
  if (n === 0) return null;
  if (n < COMMENT_MIN) return `Escreva pelo menos ${COMMENT_MIN} caracteres.`;
  if (n > COMMENT_MAX) return `Máximo de ${COMMENT_MAX} caracteres.`;
  return null;
}

function Counter({ body }: { body: string }) {
  const n = body.trim().length;
  return (
    <Text variant="tiny" tone={n > COMMENT_MAX ? "danger" : "faint"} accessibilityLabel={`${n} de ${COMMENT_MAX} caracteres`}>
      {n}/{COMMENT_MAX}
    </Text>
  );
}

export function CommentsSection({ postId, commentsEnabled = true, commentsCount }: { postId: string; commentsEnabled?: boolean; commentsCount?: number }) {
  const t = useTheme();
  const q = useBlogComments(postId);
  const create = useCreateComment(postId);
  const update = useUpdateComment(postId);
  const del = useDeleteComment(postId);
  const heart = useCommentHeart(postId);
  const report = useReportComment();
  const inputRef = useRef<TextInput>(null);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ parentId: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [disabledByApi, setDisabledByApi] = useState(false);
  const [menuFor, setMenuFor] = useState<BlogComment | null>(null);
  const [editing, setEditing] = useState<BlogComment | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<BlogComment | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [reasonDetails, setReasonDetails] = useState("");

  const enabled = commentsEnabled && q.data?.pages[0]?.commentsEnabled !== false && !disabledByApi;
  const items = (q.data?.pages ?? []).flatMap((p) => p.items ?? []);
  const trimmed = body.trim();
  const canSend = trimmed.length >= COMMENT_MIN && trimmed.length <= COMMENT_MAX && !create.isPending;

  const onApiError = (e: unknown, setErr: (s: string) => void) => {
    // 403 on create = comments disabled for this post (other 403s are permission errors on edit/delete).
    if (e instanceof ApiError && e.status === 403 && /desativad|disabled/i.test(`${e.code} ${e.message}`)) setDisabledByApi(true);
    setErr(blogErrorMessage(e));
  };

  const send = async () => {
    setFormError(null);
    try {
      await create.mutateAsync({ body: trimmed, parentId: replyTo?.parentId ?? null });
      setBody("");
      setReplyTo(null);
      inputRef.current?.blur();
    } catch (e) {
      onApiError(e, setFormError);
    }
  };

  // Replies are one level deep: replying to a reply attaches to its top-level parent.
  const startReply = (c: BlogComment, parent: BlogComment) => {
    setReplyTo({ parentId: parent.id, name: c.user?.name ?? "comentário" });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditError(null);
    const b = editBody.trim();
    if (b.length < COMMENT_MIN || b.length > COMMENT_MAX) return setEditError(lengthError(b) ?? `Escreva pelo menos ${COMMENT_MIN} caracteres.`);
    try {
      await update.mutateAsync({ id: editing.id, body: b });
      setEditing(null);
    } catch (e) {
      onApiError(e, setEditError);
    }
  };

  const confirmDelete = (c: BlogComment) =>
    Alert.alert("Excluir comentário?", c.replies?.length ? "As respostas a este comentário também deixarão de aparecer." : "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => del.mutateAsync(c.id).catch((e) => Alert.alert("Não foi possível excluir", blogErrorMessage(e))) },
    ]);

  const sendReport = async () => {
    if (!reporting || !reason) return;
    const full = reason === "Outro motivo" ? `${reason}: ${reasonDetails.trim()}` : reasonDetails.trim() ? `${reason}: ${reasonDetails.trim()}` : reason;
    try {
      await report.mutateAsync({ id: reporting.id, reason: full });
      setReporting(null);
      Alert.alert("Denúncia enviada", "Obrigado! Nossa equipe vai analisar o comentário.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setReporting(null);
        Alert.alert("Denúncia já enviada", "Você já denunciou este comentário.");
      } else Alert.alert("Não foi possível denunciar", blogErrorMessage(e));
    }
  };

  const toggleHeart = (c: BlogComment) => heart.mutate(c.id, { onError: (e) => Alert.alert("Não foi possível registrar", blogErrorMessage(e)) });

  const renderComment = (c: BlogComment, parent: BlogComment, isReply: boolean) => (
    <View key={c.id} style={{ flexDirection: "row", gap: spacing.sm, marginLeft: isReply ? 40 : 0, marginTop: spacing.md }}>
      <Avatar uri={c.user?.avatarUrl} name={c.user?.name} size={isReply ? 28 : 36} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text variant="small" style={{ fontWeight: "700" }}>
            {c.user?.name ?? "Leitor"}
          </Text>
          {c.user?.username ? (
            <Text variant="tiny" tone="faint">
              @{c.user.username}
            </Text>
          ) : null}
          <Text variant="tiny" tone="faint" accessibilityLabel={`Publicado em ${fmtDateTime(c.createdAt)}`}>
            · {fmtRelative(c.createdAt)}
            {c.editedAt ? " · editado" : ""}
          </Text>
        </View>
        <LinkifiedText body={c.body} style={{ marginTop: 2 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4 }}>
          <HeartButton size="sm" hearted={!!c.viewerHearted} count={c.heartsCount ?? 0} onPress={() => toggleHeart(c)} label="Coração no comentário" />
          {enabled ? (
            <Pressable onPress={() => startReply(c, parent)} accessibilityRole="button" accessibilityLabel={`Responder a ${c.user?.name ?? "comentário"}`} hitSlop={8}>
              <Text variant="tiny" tone="muted" style={{ fontWeight: "700" }}>
                Responder
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setMenuFor(c)} accessibilityRole="button" accessibilityLabel="Mais opções do comentário" hitSlop={8} style={{ marginLeft: "auto" }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={t.inkFaint} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const total = commentsCount ?? items.reduce((s, c) => s + 1 + (c.replies?.length ?? 0), 0);
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: spacing.md }}>
        Comentários{total ? ` (${total})` : ""}
      </Text>

      {enabled ? (
        <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
          {replyTo ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: 6 }}>
              <Ionicons name="return-down-forward" size={14} color={t.inkMuted} />
              <Text variant="small" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                Respondendo a {replyTo.name}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Cancelar resposta" hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={t.inkFaint} />
              </Pressable>
            </View>
          ) : null}
          <Input
            ref={inputRef}
            multiline
            value={body}
            onChangeText={(v: string) => {
              setBody(v);
              setFormError(null);
            }}
            maxLength={COMMENT_MAX + 200}
            placeholder={replyTo ? "Escreva sua resposta…" : "Escreva um comentário…"}
            accessibilityLabel={replyTo ? "Sua resposta" : "Seu comentário"}
            error={formError ?? lengthError(body) ?? undefined}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Counter body={body} />
            <Button title={replyTo ? "Responder" : "Comentar"} size="sm" icon="send" onPress={() => void send()} loading={create.isPending} disabled={!canSend} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: t.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
          <Ionicons name="lock-closed-outline" size={16} color={t.inkMuted} />
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            Os comentários estão desativados para este post.
          </Text>
        </View>
      )}

      {q.isLoading ? <ActivityIndicator color={t.primary} style={{ marginVertical: spacing.lg }} /> : null}
      {q.error ? (
        <View style={{ paddingVertical: spacing.md }}>
          <Text variant="small" tone="danger">
            {blogErrorMessage(q.error, "Não foi possível carregar os comentários.")}
          </Text>
          <Button title="Tentar novamente" size="sm" variant="ghost" onPress={() => q.refetch()} style={{ alignSelf: "flex-start" }} />
        </View>
      ) : null}
      {q.data && items.length === 0 ? (
        <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
          {enabled ? "Seja o primeiro a comentar." : "Nenhum comentário."}
        </Text>
      ) : null}

      {items.map((c) => (
        <View key={c.id}>
          {renderComment(c, c, false)}
          {(c.replies ?? []).map((r) => renderComment(r, c, true))}
        </View>
      ))}

      {q.hasNextPage ? <Button title="Ver mais comentários" variant="ghost" size="sm" onPress={() => q.fetchNextPage()} loading={q.isFetchingNextPage} style={{ marginTop: spacing.md }} /> : null}

      {/* Actions menu */}
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title="Comentário">
        {menuFor?.canEdit ? (
          <ListItem
            title="Editar"
            left={<Ionicons name="create-outline" size={20} color={t.ink} />}
            onPress={() => {
              const c = menuFor;
              setMenuFor(null);
              setEditBody(c.body);
              setEditError(null);
              setEditing(c);
            }}
          />
        ) : null}
        {menuFor?.canDelete ? (
          <ListItem
            title="Excluir"
            danger
            left={<Ionicons name="trash-outline" size={20} color={t.danger} />}
            onPress={() => {
              const c = menuFor;
              setMenuFor(null);
              confirmDelete(c);
            }}
          />
        ) : null}
        {menuFor && !menuFor.canEdit ? (
          <ListItem
            title="Denunciar"
            left={<Ionicons name="flag-outline" size={20} color={t.ink} />}
            onPress={() => {
              const c = menuFor;
              setMenuFor(null);
              setReason(null);
              setReasonDetails("");
              setReporting(c);
            }}
          />
        ) : null}
      </Sheet>

      {/* Edit */}
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="Editar comentário">
        <Input multiline value={editBody} onChangeText={(v: string) => { setEditBody(v); setEditError(null); }} maxLength={COMMENT_MAX + 200} accessibilityLabel="Comentário" error={editError ?? lengthError(editBody) ?? undefined} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Counter body={editBody} />
          <Button title="Salvar" onPress={() => void saveEdit()} loading={update.isPending} disabled={editBody.trim().length < COMMENT_MIN || editBody.trim().length > COMMENT_MAX} />
        </View>
      </Sheet>

      {/* Report */}
      <Sheet visible={!!reporting} onClose={() => setReporting(null)} title="Denunciar comentário">
        <Text variant="small" tone="muted" style={{ marginBottom: spacing.sm }}>
          Por que este comentário não deveria estar aqui?
        </Text>
        {REPORT_REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10 }}>
            <Ionicons name={reason === r ? "radio-button-on" : "radio-button-off"} size={20} color={reason === r ? t.primary : t.inkFaint} />
            <Text style={{ flex: 1 }}>{r}</Text>
          </Pressable>
        ))}
        <Input label={reason === "Outro motivo" ? "Conte o motivo" : "Detalhes (opcional)"} multiline value={reasonDetails} onChangeText={setReasonDetails} maxLength={400} />
        <Button title="Enviar denúncia" onPress={() => void sendReport()} loading={report.isPending} disabled={!reason || (reason === "Outro motivo" && reasonDetails.trim().length < 3)} />
      </Sheet>
    </View>
  );
}
