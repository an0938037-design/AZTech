import type { View } from "./store";

/* Ba thế giới giả tưởng nằm trong vành đai tiểu hành tinh — mỗi thế giới một
   phong cách riêng, không mô phỏng thiên văn thật. */
export interface SimWorld {
  id: "crystal" | "ember" | "circuit";
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
    orbit: 8.7,
    size: 0.3,
    phase: 0.4,
    speed: 0.055,
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
    orbit: 9.2,
    size: 0.34,
    phase: 2.4,
    speed: 0.047,
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
    orbit: 9.7,
    size: 0.28,
    phase: 4.3,
    speed: 0.041,
  },
];

export const BELT_INNER = 8.35;
export const BELT_OUTER = 10.05;
