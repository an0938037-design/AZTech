import { useEffect, useState } from "react";
import { create } from "zustand";

export interface Palette {
  id: string;
  name: string;
  bg: string;
  primary: string;
  accent: string;
}

/* Bảng màu lấy theo hành tinh chủ quản trong hệ mặt trời. */
export const PALETTES: Palette[] = [
  { id: "1", name: "Sao Thuỷ", bg: "#F6F5F2", primary: "#3C3A38", accent: "#6E6862" },
  { id: "2", name: "Sao Kim", bg: "#FAF3E7", primary: "#574231", accent: "#9A6B38" },
  { id: "3", name: "Trái Đất", bg: "#EDF6F4", primary: "#123F38", accent: "#1F7A57" },
  { id: "4", name: "Sao Hoả", bg: "#FAF0E9", primary: "#4E2616", accent: "#A64C22" },
  { id: "5", name: "Sao Mộc", bg: "#F8F1E7", primary: "#42301F", accent: "#8F6132" },
  { id: "6", name: "Sao Thổ", bg: "#FAF6EA", primary: "#4A4023", accent: "#8A7638" },
  { id: "7", name: "Sao Thiên Vương", bg: "#EEF9F8", primary: "#123F41", accent: "#1E7A80" },
  { id: "8", name: "Sao Hải Vương", bg: "#EEF1FB", primary: "#101F42", accent: "#2F4CC4" },
  { id: "9", name: "Mặt Trời", bg: "#FFF9E6", primary: "#3F2B07", accent: "#B45309" },
  { id: "10", name: "Tinh Vân", bg: "#0a0a1a", primary: "#c4b5fd", accent: "#7c3aed" },
];

const shade = (hex: string, amount: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const mixHex = (hex: string, base: string, amount: number) => {
  const a = parseInt(hex.replace("#", ""), 16);
  const b = parseInt(base.replace("#", ""), 16);
  const channels = [16, 8, 0].map((shift) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * amount);
  });
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

export function applyPalette(pal: Palette, isDark: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-palette", pal.id);
  if (isDark) {
    if (pal.id === "10") {
      root.style.setProperty("--bg", "#05060f");
      root.style.setProperty("--bg-raised", "#0b0c1a");
      root.style.setProperty("--bg-hover", "#12142a");
      root.style.setProperty("--bg-active", "#191c38");
      root.style.setProperty("--line", "#262a4d");
      root.style.setProperty("--line-strong", "#3d4370");
      root.style.setProperty("--line-soft", "#171a33");
      root.style.setProperty("--ink", "#ece9ff");
      root.style.setProperty("--ink-2", "#cfc9f5");
      root.style.setProperty("--ink-3", "#a49dd4");
      root.style.setProperty("--ink-4", "#7a73ab");
      root.style.setProperty("--ink-5", "#565080");
      root.style.setProperty("--accent", "#8b5cf6");
      root.style.setProperty("--accent-2", "#22d3ee");
    } else {
      root.style.setProperty("--bg", "#1a1a24");
      root.style.setProperty("--bg-raised", "#22222e");
      root.style.setProperty("--bg-hover", "#2a2a38");
      root.style.setProperty("--bg-active", "#32323e");
      root.style.setProperty("--line", "#3a3a4a");
      root.style.setProperty("--line-strong", "#4a4a5a");
      root.style.setProperty("--line-soft", "#252530");
      root.style.setProperty("--ink", shade(pal.accent, 110));
      root.style.setProperty("--ink-2", shade(pal.accent, 95));
      root.style.setProperty("--ink-3", shade(pal.accent, 80));
      root.style.setProperty("--ink-4", shade(pal.accent, 62));
      root.style.setProperty("--ink-5", shade(pal.accent, 45));
      root.style.setProperty("--accent", shade(pal.primary, 100));
      root.style.setProperty("--accent-2", shade(pal.accent, 90));
    }
  } else if (pal.id === "10") {
    root.style.setProperty("--bg", "#eef0ff");
    root.style.setProperty("--bg-raised", "#e4e6fb");
    root.style.setProperty("--bg-hover", "#d9dcf6");
    root.style.setProperty("--bg-active", "#cbcfef");
    root.style.setProperty("--line", "#c3c7e8");
    root.style.setProperty("--line-strong", "#9ea4d0");
    root.style.setProperty("--line-soft", "#dcdef4");
    root.style.setProperty("--ink", "#241f4d");
    root.style.setProperty("--ink-2", "#332e5e");
    root.style.setProperty("--ink-3", "#4a4378");
    root.style.setProperty("--ink-4", "#5f5988");
    root.style.setProperty("--ink-5", "#7d76a8");
    root.style.setProperty("--accent", "#6d4aff");
    root.style.setProperty("--accent-2", "#0891b2");
  } else {
    root.style.setProperty("--bg", pal.bg);
    root.style.setProperty("--bg-raised", shade(pal.bg, -8));
    root.style.setProperty("--bg-hover", shade(pal.bg, -16));
    root.style.setProperty("--bg-active", shade(pal.bg, -24));
    root.style.setProperty("--line", shade(pal.bg, -40));
    root.style.setProperty("--line-strong", shade(pal.bg, -80));
    root.style.setProperty("--line-soft", shade(pal.bg, -20));
    root.style.setProperty("--ink", pal.primary);
    root.style.setProperty("--ink-2", mixHex(pal.primary, pal.bg, 0.05));
    root.style.setProperty("--ink-3", mixHex(pal.primary, pal.bg, 0.08));
    root.style.setProperty("--ink-4", mixHex(pal.primary, pal.bg, 0.2));
    root.style.setProperty("--ink-5", mixHex(pal.primary, pal.bg, 0.3));
    root.style.setProperty("--accent", pal.accent);
    root.style.setProperty("--accent-2", pal.primary);
  }
}

const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // bộ nhớ trình duyệt không khả dụng
  }
};

interface AppearanceState {
  theme: string;
  palette: string;
  toggleTheme: () => void;
  setPalette: (id: string) => void;
}

/* Trạng thái giao diện để dùng chung: Cài đặt đổi, mọi nơi khác nhận cùng lúc. */
export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: read("theme", "dark"),
  palette: read("palette", "1"),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  setPalette: (palette) => set({ palette }),
}));

export function AppearanceProvider() {
  const theme = useAppearanceStore((state) => state.theme);
  const palette = useAppearanceStore((state) => state.palette);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    write("theme", theme);
    write("palette", palette);
    const pal = PALETTES.find((item) => item.id === palette) || PALETTES[0];
    applyPalette(pal, theme === "dark");
  }, [theme, palette]);

  return null;
}

export function useLocalToggle(key: string, initial = false) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return initial;
    }
  });
  const toggle = () =>
    setValue((current) => {
      const next = !current;
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // bỏ qua
      }
      return next;
    });
  return [value, toggle] as const;
}
