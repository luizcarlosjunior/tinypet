import { PublicHeader } from "@/components/layout/public-header";
import { Footer } from "@/components/layout/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-[60vh] w-full max-w-6xl px-4 py-6">{children}</main>
      <Footer />
    </>
  );
}
