import { revalidatePath } from "next/cache";
import { reviewSchema } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, serialize } from "@/server";
import { upsertItemReview } from "@/server/ratings";

export const POST = handler<{ itemId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const input = await parseBody(req, reviewSchema);
  const review = await upsertItemReview(user.id, params.itemId, input);
  // public partner/item pages fetch through the Next data cache (serverApi, 60 s): show the new rating now
  revalidatePath("/p/[slug]", "layout");
  return ok(serialize(review), { status: 201 });
});
