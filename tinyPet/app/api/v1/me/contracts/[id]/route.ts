import { handler, ok, requireUser, serialize } from "@/server";
import { contractHtml, getOwnerContract } from "@/server/finance";

/** GET /me/contracts/:id (add `?format=html` for the printable version). */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  if (req.nextUrl.searchParams.get("format") === "html") {
    const html = await contractHtml(params.id, { userId: user.id });
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return ok(serialize(await getOwnerContract(user.id, params.id)));
});
