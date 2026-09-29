import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Cover image. Uses next/image (S3 host is in images.remotePatterns); local dev uploads (`/uploads/…`) and GIFs are
 * served unoptimized so rendering never depends on the optimizer.
 */
export function BlogImage({ src, alt, className, sizes, priority = false }: { src: string; alt: string; className?: string; sizes: string; priority?: boolean }) {
  const unoptimized = /\/uploads\//.test(src) || /\.gif(\?|$)/i.test(src);
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} className={cn("object-cover", className)} />;
}
