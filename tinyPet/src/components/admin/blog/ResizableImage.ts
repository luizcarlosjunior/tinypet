import Image from "@tiptap/extension-image";

export type ImageAlign = "left" | "center" | "right";
export const IMAGE_WIDTHS = ["25%", "50%", "75%", "100%"] as const;

function alignStyle(align: ImageAlign) {
  if (align === "left") return "float: left; margin: 0 1.5rem 1rem 0";
  if (align === "right") return "float: right; margin: 0 0 1rem 1.5rem";
  return "display: block; margin: 0 auto 1rem auto";
}

/** Image node with `width` (%) and `align` (data-align + float/margin style) — same markup as the reference blog. */
export const ResizableImage = Image.extend({
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (el) => {
          const w = (el as HTMLElement).style.width || el.getAttribute("width") || "100%";
          return /^\d{1,3}%$/.test(w) ? w : "100%";
        },
        renderHTML: (attrs) => ({ style: `width: ${attrs.width || "100%"}` }),
      },
      align: {
        default: "center",
        parseHTML: (el) => {
          const a = el.getAttribute("data-align");
          return a === "left" || a === "right" ? a : "center";
        },
        renderHTML: (attrs) => {
          const a = (attrs.align as ImageAlign) || "center";
          return { "data-align": a, style: alignStyle(a) };
        },
      },
    };
  },
}).configure({ inline: false, allowBase64: false });
