import { BELT } from "./solar";
import type { View } from "./store";

/* Bốn thế giới giả tưởng nằm trong vành đai tiểu hành tinh — mỗi thế giới một
   phong cách riêng, không mô phỏng thiên văn thật. */
export interface SimWorld {
  id: "crystal" | "ember" | "circuit" | "polyglot";
  name: string;
  latin: string;
  designation: string;
  view: View;
  tagline: string;
  traits: string[];
  color: string;
  glow: string;
  surface: string;
  orbit: number;
  size: number;
  phase: number;
  speed: number;
}

export const BELT_INNER = BELT.inner;
export const BELT_OUTER = BELT.outer;
export const BELT_CENTER = BELT.center;
export const BELT_SPAN = BELT.outer - BELT.inner;

/* Bốn thế giới cùng chạy trên một vòng tròn ở giữa vành đai, cách nhau đúng 90°
   và quay cùng một tốc độ — đội hình chữ thập không bao giờ đổi. */
export const WORLD_RING_SPEED = 0.035;

export const SIM_WORLDS: SimWorld[] = [
  {
    id: "crystal",
    name: "Thạch Anh",
    latin: "Kepler-01 · Tinh Thể",
    designation: "MÔ PHỎNG HÌNH HỌC",
    view: "geometry",
    tagline: "Một khối tinh thể trôi lơ lửng, mọi mặt phẳng và góc đều cắt được.",
    traits: ["Mặt cắt phẳng", "Lưới toạ độ", "Đa diện"],
    color: "#b9a6ff",
    glow: "#6d4aff",
    surface: "crystal",
    orbit: BELT.center,
    size: 0.56,
    phase: 0,
    speed: WORLD_RING_SPEED,
  },
  {
    id: "ember",
    name: "Lưu Huỳnh",
    latin: "Vulcan-9 · Lửa",
    designation: "MÔ PHỎNG HOÁ HỌC",
    view: "lab",
    tagline: "Quả cầu dung nham sủi bọt, phản ứng cháy sáng cả vành đai.",
    traits: ["Phản ứng", "Khí cụ", "Nhiệt"],
    color: "#ffb347",
    glow: "#ff5c1a",
    surface: "ember",
    orbit: BELT.center,
    size: 0.62,
    phase: Math.PI / 2,
    speed: WORLD_RING_SPEED,
  },
  {
    id: "circuit",
    name: "Mạch Cổ",
    latin: "Circuit-Ω · Điện Tử",
    designation: "MÔ PHỎNG ARDUINO",
    view: "arduino",
    tagline: "Tiểu hành tinh được khắc mạch in, đèn LED nhấp nháy theo nhịp xung.",
    traits: ["GPIO", "Serial", "Servo"],
    color: "#5eead4",
    glow: "#0891b2",
    surface: "circuit",
    orbit: BELT.center,
    size: 0.54,
    phase: Math.PI,
    speed: WORLD_RING_SPEED,
  },
  {
    id: "polyglot",
    name: "Vạn Ngôn",
    latin: "Polyglot-Σ · Ngữ Liệu",
    designation: "MÔ PHỎNG ĐA NGÔN NGỮ",
    view: "vanlab",
    tagline: "Quả cầu đá nguội bọc kín chữ: hàng chục thứ tiếng cùng cháy trong một lò.",
    traits: ["Đa ngôn ngữ", "WebAssembly", "Máy từ xa"],
    color: "#f2748c",
    glow: "#a3284a",
    surface: "polyglot",
    orbit: BELT.center,
    size: 0.54,
    phase: (Math.PI * 3) / 2,
    speed: WORLD_RING_SPEED,
  },
];
