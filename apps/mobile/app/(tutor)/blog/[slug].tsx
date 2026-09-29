import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BlogPostScreen } from "@/components/blog/BlogPostScreen";

export default function TutorBlogPost() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BlogPostScreen slug={slug} basePath="/(tutor)/blog" />;
}
