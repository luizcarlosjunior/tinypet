import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BlogPostScreen } from "@/components/blog/BlogPostScreen";

export default function PartnerBlogPost() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BlogPostScreen slug={slug} basePath="/(parceiro)/mais/blog" />;
}
