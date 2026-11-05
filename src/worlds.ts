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

/* Bốn thế giới nằm rải trong dải vành đai đã chừa sẵn giữa Sao Hoả và Sao Mộc. */
const beltSpan = BELT.outer - BELT.inner;
const beltAt = (fraction: number) => BELT.inner + beltSpan * fraction;

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
    orbit: beltAt(0.11),
    size: 0.56,
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
    orbit: beltAt(0.37),
    size: 0.62,
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
    orbit: beltAt(0.63),
    size: 0.54,
    phase: 4.3,
    speed: 0.041,
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
    orbit: beltAt(0.89),
    size: 0.54,
    phase: 5.9,
    speed: 0.038,
  },
];
