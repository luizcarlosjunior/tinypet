import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BlogListScreen } from "@/components/blog/BlogListScreen";

export default function PartnerBlog() {
  const { category, tag } = useLocalSearchParams<{ category?: string; tag?: string }>();
  return <BlogListScreen basePath="/(parceiro)/mais/blog" fallback="/(parceiro)/mais" initialCategory={category || undefined} initialTag={tag || undefined} />;
}
