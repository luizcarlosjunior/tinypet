import { z } from "zod";
import { id } from "@tinypet/shared";
import { handler, ok, parseBody, requireUser, setVideoCover } from "@/server";

const bodySchema = z.object({ coverAssetId: id });

/** Changes the cover (`thumbUrl`) of an already READY video. Same rules as `coverAssetId` on /media/complete. */
export const POST = handler<{ assetId: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { coverAssetId } = await parseBody(req, bodySchema);
  return ok(await setVideoCover(params.assetId, coverAssetId, user.id));
});
