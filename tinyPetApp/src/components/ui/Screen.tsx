import React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

type Props = {
  children: React.ReactNode;
  /** Scrollable (default) or a plain flex container for lists. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Extra bottom padding (tab bars are handled by the navigator). */
  bottom?: number;
  keyboard?: boolean;
};

export function Screen({ children, scroll = true, refreshing, onRefresh, title, subtitle, right, padded = true, style, bottom = 0, keyboard }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const header =
    title || right ? (
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {title ? (
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ padding: padded ? spacing.lg : 0, paddingBottom: (padded ? spacing.lg : 0) + bottom + spacing.xl }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} /> : undefined}
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: padded ? spacing.lg : 0 }, style]}>
      {header ? <View style={{ paddingTop: padded ? spacing.lg : 0 }}>{header}</View> : null}
      {children}
    </View>
  );

  const content = (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: title ? insets.top : 0 }}>{body}</View>
  );
  if (keyboard) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {content}
      </KeyboardAvoidingView>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: spacing.md },
});
