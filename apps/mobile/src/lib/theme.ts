import { useColorScheme } from "react-native";

export const brand = {
  orange: "#f95d16",
  orangeDark: "#d94a0b",
  orangeSoft: "#fff1ea",
  orangeSoftDark: "#3a1d0f",
};

export type Theme = {
  scheme: "light" | "dark";
  bg: string; surface: string; surfaceAlt: string; border: string;
  ink: string; inkMuted: string; inkFaint: string;
  primary: string; primaryPressed: string; primarySoft: string; onPrimary: string;
  success: string; successSoft: string; warning: string; warningSoft: string;
  danger: string; dangerSoft: string; info: string; infoSoft: string; tabBar: string;
};

const light: Theme = {
  scheme: "light",
  bg: "#f7f7f8",
  surface: "#ffffff",
  surfaceAlt: "#f1f1f3",
  border: "#e4e4e7",
  ink: "#18181b",
  inkMuted: "#52525b",
  inkFaint: "#a1a1aa",
  primary: brand.orange,
  primaryPressed: brand.orangeDark,
  primarySoft: brand.orangeSoft,
  onPrimary: "#ffffff",
  success: "#16a34a",
  successSoft: "#dcfce7",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  info: "#2563eb",
  infoSoft: "#dbeafe",
  tabBar: "#ffffff",
};
const dark: Theme = {
  scheme: "dark",
  bg: "#0f0f11",
  surface: "#1b1b1f",
  surfaceAlt: "#26262b",
  border: "#33333a",
  ink: "#f4f4f5",
  inkMuted: "#b4b4bb",
  inkFaint: "#6f6f78",
  primary: brand.orange,
  primaryPressed: "#ff7a3c",
  primarySoft: brand.orangeSoftDark,
  onPrimary: "#ffffff",
  success: "#4ade80",
  successSoft: "#14532d",
  warning: "#fbbf24",
  warningSoft: "#451a03",
  danger: "#f87171",
  dangerSoft: "#450a0a",
  info: "#60a5fa",
  infoSoft: "#1e3a8a",
  tabBar: "#141416",
};


export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const font = {
  title: { fontSize: 24, fontWeight: "700" as const },
  h2: { fontSize: 18, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  tiny: { fontSize: 11, fontWeight: "500" as const },
};
