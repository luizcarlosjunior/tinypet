import { revalidatePath } from "next/cache";

/** Refreshes the cached public blog pages (list, posts, categories, tags, RSS, sitemap) after an admin change. */
export function revalidateBlog() {
  try {
    revalidatePath("/blog", "layout");
    revalidatePath("/sitemap.xml");
  } catch (e) {
    console.warn("[blog] revalidate failed", e);
  }
}
