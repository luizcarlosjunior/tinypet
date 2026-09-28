import type { Metadata } from "next";
import { InviteAccept } from "@/components/public/invite-accept";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

export default function ConvitePage({ params }: { params: { token: string } }) {
  return <InviteAccept token={params.token} />;
}
