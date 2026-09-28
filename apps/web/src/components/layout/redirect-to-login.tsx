"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

/** Client-side redirect that preserves the current path in ?next= (server layouts don't know the pathname). */
export function RedirectToLogin() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/entrar?next=${encodeURIComponent(pathname || "/inicio")}`);
  }, [pathname, router]);
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
