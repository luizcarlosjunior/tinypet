import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

/** Web link `/blog/tag/<tag>` → blog list filtered by tag. */
export default function BlogTagLink() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  return <Redirect href={{ pathname: "/(tutor)/blog", params: tag ? { tag } : {} }} />;
}
