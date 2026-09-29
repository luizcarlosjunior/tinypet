import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BlogListScreen } from "@/components/blog/BlogListScreen";

export default function TutorBlog() {
  const { category, tag } = useLocalSearchParams<{ category?: string; tag?: string }>();
  return <BlogListScreen basePath="/(tutor)/blog" fallback="/(tutor)/inicio" initialCategory={category || undefined} initialTag={tag || undefined} />;
}
