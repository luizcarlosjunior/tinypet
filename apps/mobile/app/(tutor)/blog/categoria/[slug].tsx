import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

/** Web link `/blog/categoria/<slug>` → blog list filtered by category. */
export default function BlogCategoryLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={{ pathname: "/(tutor)/blog", params: slug ? { category: slug } : {} }} />;
}
