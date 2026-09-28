import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, useTheme } from "@/lib/theme";
import { Text } from "./Text";

export function Sheet({ visible, onClose, title, children, scroll = true }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.border }]} />
          </View>
          <View style={styles.titleRow}>
            <Text variant="h2" style={{ flex: 1 }}>
              {title ?? ""}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
              <Ionicons name="close" size={22} color={t.inkMuted} />
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: "90%" },
  handleRow: { alignItems: "center", marginBottom: spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
});
