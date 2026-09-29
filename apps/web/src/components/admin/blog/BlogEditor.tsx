"use client";
import "./editor.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Youtube from "@tiptap/extension-youtube";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  SquareCode,
  Strikethrough,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo,
  Unlink,
  Youtube as YoutubeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSafeLinkUrl, normalizeLinkUrl, youtubeId } from "@/lib/blog-utils";
import { useToast } from "@/components/ui/toast";
import {
  ResizableImage,
  IMAGE_WIDTHS,
  type ImageAlign,
} from "./ResizableImage";
import { EditorImageModal } from "./EditorImageModal";

export type EditorStats = { words: number; characters: number };

function ToolButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm transition disabled:opacity-40",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          : "hover:bg-ink-100 dark:hover:bg-ink-800",
      )}
    >
      {children}
    </button>
  );
}
const Sep = () => (
  <span className="mx-0.5 h-5 w-px bg-ink-200 dark:bg-ink-700" aria-hidden />
);

/**
 * TipTap editor (reference `NotionEditor`, trimmed): StarterKit (H2–H4), safe links, ResizableImage (width/align),
 * text align, placeholder, word count, YouTube (nocookie). Emits HTML (server sanitizes).
 */
export function BlogEditor({
  value,
  onChange,
  onStats,
  placeholder = "Escreva o conteúdo do post…",
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  onStats?: (s: EditorStats) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [imageOpen, setImageOpen] = useState(false);
  const [panel, setPanel] = useState<null | "link" | "youtube">(null);
  const [panelValue, setPanelValue] = useState("");
  const panelRef = useRef<HTMLInputElement>(null);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        isAllowedUri: (url) => isSafeLinkUrl(url),
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      ResizableImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Youtube.configure({
        nocookie: true,
        width: 640,
        height: 360,
        modestBranding: true,
        controls: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "tp-prose",
        "aria-label": "Conteúdo do post",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onCreate: ({ editor }) => emitStats(editor),
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
      emitStats(editor);
    },
  });

  function emitStats(ed: Editor) {
    const s = ed.storage.characterCount as
      { words: () => number; characters: () => number } | undefined;
    onStatsRef.current?.({
      words: s?.words() ?? 0,
      characters: s?.characters() ?? 0,
    });
  }

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (panel) setTimeout(() => panelRef.current?.focus(), 20);
  }, [panel]);

  if (!editor)
    return (
      <div className="card min-h-[480px] animate-pulse" aria-busy="true" />
    );

  const openLink = () => {
    setPanelValue((editor.getAttributes("link").href as string) || "");
    setPanel(panel === "link" ? null : "link");
  };
  const applyPanel = () => {
    const v = panelValue.trim();
    if (panel === "link") {
      if (!v) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setPanel(null);
        return;
      }
      const href = normalizeLinkUrl(v);
      if (!isSafeLinkUrl(href)) {
        toast("Link inválido: use http, https ou mailto.", "error");
        return;
      }
      if (editor.state.selection.empty && !editor.isActive("link")) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: v,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    } else if (panel === "youtube") {
      const id = youtubeId(v);
      if (!id) {
        toast("URL do YouTube inválida.", "error");
        return;
      }
      editor
        .chain()
        .focus()
        .setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${id}` })
        .run();
    }
    setPanel(null);
    setPanelValue("");
  };

  const heading = (level: 2 | 3 | 4) =>
    editor.chain().focus().toggleHeading({ level }).run();
  const align = (a: "left" | "center" | "right" | "justify") =>
    editor.chain().focus().setTextAlign(a).run();
  const img = editor.getAttributes("image") as {
    align?: ImageAlign;
    width?: string;
    alt?: string;
  };
  const setImg = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("image", attrs).run();

  return (
    <div
      className={cn(
        "tp-editor overflow-hidden rounded-2xl border bg-[var(--card)]",
        disabled && "opacity-70",
      )}
    >
      <div className="sticky top-14 z-10 bg-[var(--card)]">
        <div
          className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
          role="toolbar"
          aria-label="Formatação"
        >
          <ToolButton
            title="Desfazer"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Refazer"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </ToolButton>
          <Sep />
          <ToolButton
            title="Parágrafo"
            onClick={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive("paragraph")}
          >
            <Type className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Título 2"
            onClick={() => heading(2)}
            active={editor.isActive("heading", { level: 2 })}
          >
            <Heading2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Título 3"
            onClick={() => heading(3)}
            active={editor.isActive("heading", { level: 3 })}
          >
            <Heading3 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Título 4"
            onClick={() => heading(4)}
            active={editor.isActive("heading", { level: 4 })}
          >
            <Heading4 className="h-4 w-4" />
          </ToolButton>
          <Sep />
          <ToolButton
            title="Negrito"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Itálico"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Sublinhado"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Tachado"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Código"
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
          >
            <Code className="h-4 w-4" />
          </ToolButton>
          <Sep />
          <ToolButton
            title="Lista"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            <List className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Lista numerada"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Citação"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            <Quote className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Bloco de código"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
          >
            <SquareCode className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Divisor"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-4 w-4" />
          </ToolButton>
          <Sep />
          <ToolButton
            title="Alinhar à esquerda"
            onClick={() => align("left")}
            active={editor.isActive({ textAlign: "left" })}
          >
            <AlignLeft className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Centralizar"
            onClick={() => align("center")}
            active={editor.isActive({ textAlign: "center" })}
          >
            <AlignCenter className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Alinhar à direita"
            onClick={() => align("right")}
            active={editor.isActive({ textAlign: "right" })}
          >
            <AlignRight className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Justificar"
            onClick={() => align("justify")}
            active={editor.isActive({ textAlign: "justify" })}
          >
            <AlignJustify className="h-4 w-4" />
          </ToolButton>
          <Sep />
          <ToolButton
            title="Link"
            onClick={openLink}
            active={editor.isActive("link") || panel === "link"}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Remover link"
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
            disabled={!editor.isActive("link")}
          >
            <Unlink className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="Inserir imagem" onClick={() => setImageOpen(true)}>
            <ImageIcon className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Inserir vídeo do YouTube"
            onClick={() => {
              setPanelValue("");
              setPanel(panel === "youtube" ? null : "youtube");
            }}
            active={panel === "youtube"}
          >
            <YoutubeIcon className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            title="Limpar formatação"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <Eraser className="h-4 w-4" />
          </ToolButton>
        </div>

        {panel && (
          <form
            className="flex flex-wrap items-center gap-2 border-b bg-ink-50/60 p-2 dark:bg-ink-900/40"
            onSubmit={(e) => {
              e.preventDefault();
              applyPanel();
            }}
          >
            <label
              htmlFor="editor-panel-input"
              className="text-xs font-medium text-[var(--muted)]"
            >
              {panel === "link"
                ? "URL do link (http, https ou mailto)"
                : "URL do vídeo no YouTube"}
            </label>
            <input
              id="editor-panel-input"
              ref={panelRef}
              className="input min-w-[220px] flex-1 py-1.5"
              value={panelValue}
              onChange={(e) => setPanelValue(e.target.value)}
              placeholder={
                panel === "link"
                  ? "https://…"
                  : "https://www.youtube.com/watch?v=…"
              }
              onKeyDown={(e) => e.key === "Escape" && setPanel(null)}
            />
            <button type="submit" className="btn-primary py-1.5">
              {panel === "link" ? "Aplicar" : "Inserir"}
            </button>
            <button
              type="button"
              className="btn-ghost py-1.5"
              onClick={() => setPanel(null)}
            >
              Cancelar
            </button>
          </form>
        )}

        {editor.isActive("image") && (
          <div
            className="flex flex-wrap items-center gap-0.5 border-b bg-brand-50/60 p-1.5 dark:bg-brand-900/20"
            role="toolbar"
            aria-label="Imagem selecionada"
          >
            <span className="px-1.5 text-xs font-medium text-[var(--muted)]">
              Imagem:
            </span>
            <ToolButton
              title="Imagem à esquerda"
              onClick={() => setImg({ align: "left" })}
              active={img.align === "left"}
            >
              <AlignLeft className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              title="Imagem centralizada"
              onClick={() => setImg({ align: "center" })}
              active={!img.align || img.align === "center"}
            >
              <AlignCenter className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              title="Imagem à direita"
              onClick={() => setImg({ align: "right" })}
              active={img.align === "right"}
            >
              <AlignRight className="h-4 w-4" />
            </ToolButton>
            <Sep />
            {IMAGE_WIDTHS.map((w) => (
              <ToolButton
                key={w}
                title={`Largura ${w}`}
                onClick={() => setImg({ width: w })}
                active={(img.width || "100%") === w}
              >
                <span className="text-xs font-medium">{w}</span>
              </ToolButton>
            ))}
            <Sep />
            <ToolButton
              title="Editar texto alternativo"
              onClick={() => {
                const alt = window.prompt(
                  "Texto alternativo da imagem",
                  img.alt ?? "",
                );
                if (alt !== null) setImg({ alt: alt.slice(0, 300) });
              }}
            >
              <span className="text-xs font-medium">alt</span>
            </ToolButton>
            <ToolButton
              title="Substituir imagem"
              onClick={() => setImageOpen(true)}
            >
              <ImageIcon className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              title="Remover imagem"
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </ToolButton>
          </div>
        )}
      </div>

      <EditorContent editor={editor} />

      <EditorImageModal
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onSelect={({ src, alt }) => {
          if (editor.isActive("image"))
            editor
              .chain()
              .focus()
              .updateAttributes("image", { src, alt })
              .run();
          else editor.chain().focus().setImage({ src, alt }).run();
        }}
      />
    </div>
  );
}
