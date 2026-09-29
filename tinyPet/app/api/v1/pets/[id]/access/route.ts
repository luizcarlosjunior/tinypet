import { fail } from "@/server";

/**
 * Removed: pets are now shared by invite (the other account accepts or declines) and shared accounts are read-only.
 * Use `GET /pets/:id/sharing`, `POST /pets/:id/share-invites`, `DELETE /pets/:id/shares/:userId`, `POST /pets/:id/leave`.
 */
const gone = async () => fail(410, "GONE", "O compartilhamento agora é feito por convite: use Compartilhamento na ficha do pet (convide pelo usuário ou e-mail).");

export const GET = gone;
export const POST = gone;
