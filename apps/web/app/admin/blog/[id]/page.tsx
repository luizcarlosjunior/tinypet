"use client";
import Link from "next/link";
import { PostEditor } from "@/components/admin/blog/PostEditor";
import { BlogQueryState } from "@/components/admin/blog/common";
import { useBlogPost } from "@/hooks/use-blog-admin";

export default function EditBlogPostPage({ params }: { params: { id: string } }) {
  const post = useBlogPost(params.id);
  return (
    <BlogQueryState isLoading={post.isLoading} error={post.error} retry={() => post.refetch()}>
      {post.data ? (
        <PostEditor key={post.data.id} post={post.data} />
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Post não encontrado. <Link href="/admin/blog" className="text-brand-600 underline">Voltar</Link>
        </p>
      )}
    </BlogQueryState>
  );
}
