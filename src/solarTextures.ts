import * as THREE from "three";
import type { MoonKind, PlanetId } from "./solar";

/* ==========================================================================
   AZTEACH · SOLAR TEXTURES
   Sinh texture thiên văn bằng canvas 2D, deterministic, có cache + LOD.
   Mỗi hành tinh có vật liệu / bề mặt riêng — không dùng cầu màu phẳng.
   ========================================================================== */

export type Detail = "far" | "near";

interface PlanetTextures {
  map: THREE.Texture;
  bump: THREE.Texture;
  roughness: THREE.Texture;
  clouds: THREE.Texture | null;
  emissive: THREE.Texture | null;
  ring: THREE.Texture | null;
}

interface CanvasPair {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function makeCanvas(w: number, h: number): CanvasPair {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D không khả dụng");
  return { canvas, ctx };
}

/* ---------------------------------- math --------------------------------- */

function rng(seed: number): () => number {
  let state = (seed | 0) || 0x9e3779b9;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Nhiễu 1 chiều mượt, dùng cho biên dải khí quyển. */
function noise1d(random: () => number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(random() * 2 - 1);
  return out;
}

function sampleNoise(noise: number[], t: number): number {
  const x = ((t % 1) + 1) % 1;
  const scaled = x * (noise.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = noise[i] ?? 0;
  const b = noise[Math.min(noise.length - 1, i + 1)] ?? 0;
  const smooth = f * f * (3 - 2 * f);
  return a + (b - a) * smooth;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToCss(r: number, g: number, b: number, alpha = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function mix(a: string, b: string, t: number): [number, number, number] {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t);
  return [
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ];
}

/* ------------------------------- kết cấu nền ------------------------------ */

/** Thêm nhiễu hạt mịn trên toàn ảnh để bề mặt không bị "nhựa". */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const random = rng(seed);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * amount;
    data[i] = clamp(data[i] + n, 0, 255);
    data[i + 1] = clamp(data[i + 1] + n, 0, 255);
    data[i + 2] = clamp(data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(image, 0, 0);
}

/** Vết loang mềm (địa hình, mây, biển). */
function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.5,
  squash = 1
) {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  const [r, g, b] = hexToRgb(color);
  gradient.addColorStop(0, rgbToCss(r, g, b, alpha));
  gradient.addColorStop(0.62, rgbToCss(r, g, b, alpha * 0.55));
  gradient.addColorStop(1, rgbToCss(r, g, b, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.translate(-x, -y);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrapBlob(
  ctx: CanvasRenderingContext2D,
  w: number,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.5,
  squash = 1
) {
  blob(ctx, x, y, radius, color, alpha, squash);
  if (x - radius < 0) blob(ctx, x + w, y, radius, color, alpha, squash);
  if (x + radius > w) blob(ctx, x - w, y, radius, color, alpha, squash);
}

/** Hố va chạm: lòng tối, vành sáng, đổ bóng lệch hướng mặt trời. */
function craters(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  seed: number,
  scale = 1,
  tint = "#8b867e"
) {
  const random = rng(seed);
  for (let i = 0; i < count; i += 1) {
    const x = random() * w;
    const y = h * (0.08 + random() * 0.84);
    const radius = (0.5 + Math.pow(random(), 2.4) * 14) * scale;
    const squash = 0.72 + random() * 0.5;
    const draw = (cx: number) => {
      const [r, g, b] = hexToRgb(tint);
      const gradient = ctx.createRadialGradient(cx, y, radius * 0.1, cx, y, radius);
      gradient.addColorStop(0, rgbToCss(r * 0.42, g * 0.42, b * 0.42, 0.5));
      gradient.addColorStop(0.58, rgbToCss(r * 0.6, g * 0.6, b * 0.6, 0.28));
      gradient.addColorStop(0.86, rgbToCss(r * 1.16, g * 1.16, b * 1.16, 0.3));
      gradient.addColorStop(1, rgbToCss(r, g, b, 0));
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(1, squash);
      ctx.translate(-cx, -y);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = rgbToCss(r * 1.25, g * 1.25, b * 1.25, 0.28);
      ctx.lineWidth = Math.max(0.4, radius * 0.1);
      ctx.beginPath();
      ctx.ellipse(cx, y, radius * 0.92, radius * 0.92 * squash, 0, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();
    };
    draw(x);
    if (x - radius < 0) draw(x + w);
    if (x + radius > w) draw(x - w);
  }
}

function deriveBump(source: HTMLCanvasElement, contrast = 1.5): THREE.Texture {
  const { canvas, ctx } = makeCanvas(source.width, source.height);
  ctx.filter = `grayscale(1) contrast(${contrast}) brightness(1.05)`;
  ctx.drawImage(source, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

function deriveRoughness(source: HTMLCanvasElement): THREE.Texture {
  const { canvas, ctx } = makeCanvas(source.width, source.height);
  ctx.filter = "grayscale(1) contrast(0.85) brightness(1.22)";
  ctx.drawImage(source, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

function toTexture(canvas: HTMLCanvasElement, srgb = true): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

/* -------------------------------- Mercury -------------------------------- */

function mercury(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#6d6a64";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 34; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.02 + random() * 0.09), "#4d4b47", 0.28, 0.6);
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.015 + random() * 0.07), "#8d8981", 0.2, 0.7);
  }
  craters(ctx, w, h, Math.floor(w / 3.6), seed + 1, Math.max(0.7, w / 520), "#948f86");
  craters(ctx, w, h, Math.floor(w / 16), seed + 7, Math.max(1, w / 260), "#a19b91");
  grain(ctx, w, h, 18, seed + 2);
  return canvas;
}

/* --------------------------------- Venus --------------------------------- */

function venus(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#d5ac63";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i += 1) {
    const y = random() * h;
    const amplitude = h * (0.02 + random() * 0.05);
    const alpha = 0.06 + random() * 0.12;
    const color = random() > 0.5 ? "#f0d9a0" : "#b98a45";
    ctx.strokeStyle = rgbToCss(...hexToRgb(color), alpha);
    ctx.lineWidth = Math.max(1, h * (0.004 + random() * 0.02));
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 16) {
      const wave =
        Math.sin((x / w) * Math.PI * 3 + random() * 0.2) * amplitude +
        Math.sin((x / w) * Math.PI * 7 + y * 0.02) * amplitude * 0.35;
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 70; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.01 + random() * 0.05), random() > 0.4 ? "#f6e4b8" : "#c1924f", 0.18, 0.45);
  }
  ctx.fillStyle = "rgba(120, 82, 35, 0.16)";
  ctx.fillRect(0, 0, w, h * 0.07);
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
  grain(ctx, w, h, 10, seed + 4);
  return canvas;
}

function venusClouds(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  for (let i = 0; i < 90; i += 1) {
    wrapBlob(ctx, w, random() * w, h * (0.05 + random() * 0.9), w * (0.03 + random() * 0.1), "#fff1c9", 0.16 + random() * 0.16, 0.3);
  }
  return canvas;
}

/* --------------------------------- Earth --------------------------------- */

interface GeoPoint {
  x: number;
  y: number;
}

function polygon(ctx: CanvasRenderingContext2D, points: GeoPoint[]) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

const LANDMASSES: [number, number][][] = [
  // Bắc Mỹ
  [[-168, 66], [-152, 70], [-128, 71], [-104, 73], [-82, 71], [-62, 58], [-55, 48], [-68, 43], [-80, 30], [-97, 25], [-110, 29], [-118, 34], [-124, 48], [-136, 58], [-152, 60], [-168, 66]],
  // Greenland
  [[-45, 60], [-22, 69], [-18, 80], [-42, 84], [-58, 78], [-56, 66]],
  // Nam Mỹ
  [[-80, 9], [-62, 11], [-50, 1], [-35, -6], [-38, -22], [-47, -28], [-57, -38], [-68, -53], [-75, -50], [-72, -31], [-78, -15], [-80, 0]],
  // Châu Phi
  [[-17, 15], [-11, 28], [0, 35], [12, 33], [25, 32], [34, 28], [43, 12], [51, 11], [48, -2], [41, -13], [38, -23], [31, -30], [24, -34], [18, -34], [12, -18], [9, -1], [6, 5], [-8, 4], [-17, 10]],
  // Eurasia
  [[-10, 36], [-2, 43], [6, 52], [12, 58], [22, 70], [40, 72], [62, 74], [92, 76], [122, 74], [146, 62], [162, 60], [180, 66], [180, 54], [152, 45], [140, 35], [122, 31], [120, 22], [108, 12], [100, 8], [94, 17], [80, 8], [72, 21], [60, 25], [48, 30], [36, 36], [28, 36], [12, 44], [-4, 36]],
  // Ấn Độ
  [[68, 22], [78, 30], [88, 25], [91, 18], [80, 8], [72, 18]],
  // Australia
  [[114, -22], [130, -12], [143, -11], [151, -22], [154, -28], [147, -38], [135, -35], [124, -33], [115, -34], [113, -26]],
  // Nam Cực
  [[-180, -72], [-120, -76], [-60, -74], [0, -78], [60, -73], [120, -75], [180, -72], [180, -90], [-180, -90]],
  // Madagascar
  [[43, -13], [50, -16], [48, -25], [44, -22]],
  // Nhật Bản
  [[130, 32], [136, 35], [142, 40], [145, 44], [141, 40], [137, 35], [132, 31]],
  // Indonesia
  [[95, 5], [110, 2], [125, 0], [140, -3], [138, -8], [120, -9], [105, -7], [96, -2]],
  // New Zealand
  [[166, -46], [174, -41], [178, -37], [173, -34], [168, -44]],
  // Anh
  [[-6, 50], [1, 52], [-1, 58], [-5, 57], [-7, 53]],
];

function earth(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, "#0b2740");
  ocean.addColorStop(0.32, "#0d3d63");
  ocean.addColorStop(0.5, "#0f4f7c");
  ocean.addColorStop(0.7, "#0c3a5d");
  ocean.addColorStop(1, "#0a2338");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 50; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.02 + random() * 0.08), random() > 0.5 ? "#155f88" : "#082742", 0.1, 0.5);
  }

  const toPoint = (lon: number, lat: number): GeoPoint => ({
    x: ((lon + 180) / 360) * w,
    y: ((90 - lat) / 180) * h,
  });

  const drawLand = (polygonPoints: GeoPoint[], fill: string) => {
    ctx.save();
    for (const offset of [-w, 0, w]) {
      ctx.translate(offset, 0);
      polygon(ctx, polygonPoints);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = Math.max(1, w * 0.0012);
      ctx.strokeStyle = "rgba(10, 34, 30, 0.45)";
      ctx.stroke();
    }
    ctx.restore();
  };

  for (const shape of LANDMASSES) {
    drawLand(shape.map(([lon, lat]) => toPoint(lon, lat)), "#3f6b3f");
  }

  // Địa hình khô / rừng / núi
  const biome = (lon: number, lat: number, radius: number, color: string, alpha = 0.45) => {
    const point = toPoint(lon, lat);
    wrapBlob(ctx, w, point.x, point.y, (radius / 360) * w, color, alpha, 0.7);
  };
  biome(15, 22, 26, "#c2a268", 0.7); // Sahara
  biome(45, 23, 16, "#c9a86c", 0.55); // Ả Rập
  biome(65, 35, 12, "#b79a62", 0.4); // Trung Á
  biome(135, -25, 14, "#b26b40", 0.55); // Australia outback
  biome(-110, 35, 10, "#b08a58", 0.5); // tây Hoa Kỳ
  biome(-60, -5, 18, "#2f5c33", 0.55); // Amazon
  biome(20, 0, 15, "#2c5a30", 0.5); // Congo
  biome(105, 55, 20, "#375c36", 0.5); // Siberia
  biome(80, 25, 10, "#6d6a4a", 0.5); // Himalaya foothills
  biome(-70, -45, 8, "#d7dde0", 0.6); // Patagonia ice
  biome(90, 33, 12, "#8f7f62", 0.5); // Tibet

  // Vết địa hình nhỏ để phá vỡ mảng màu phẳng
  /* Đọc cả canvas một lần: 900 lần getImageData(1x1) buộc đồng bộ GPU->CPU
     từng lượt và chặn main thread ngay lúc khởi động. */
  const pixels = ctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < 900; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const at = ((y | 0) * w + (x | 0)) * 4;
    if (pixels[at + 2] > pixels[at] + 8) continue;
    const shade = random() > 0.5 ? "rgba(24, 52, 24, 0.35)" : "rgba(150, 142, 100, 0.25)";
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + random() * w * 0.004, 1 + random() * h * 0.006, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chỏm băng
  const north = ctx.createLinearGradient(0, 0, 0, h * 0.12);
  north.addColorStop(0, "rgba(244, 250, 255, 0.98)");
  north.addColorStop(0.55, "rgba(225, 240, 250, 0.8)");
  north.addColorStop(1, "rgba(225, 240, 250, 0)");
  ctx.fillStyle = north;
  ctx.fillRect(0, 0, w, h * 0.12);

  const south = ctx.createLinearGradient(0, h, 0, h * 0.86);
  south.addColorStop(0, "rgba(246, 251, 255, 0.99)");
  south.addColorStop(0.7, "rgba(230, 242, 250, 0.85)");
  south.addColorStop(1, "rgba(230, 242, 250, 0)");
  ctx.fillStyle = south;
  ctx.fillRect(0, h * 0.855, w, h * 0.145);

  grain(ctx, w, h, 9, seed + 11);
  return canvas;
}

function earthClouds(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  for (let band = 0; band < 7; band += 1) {
    const baseY = h * (0.1 + band * 0.13);
    const puffs = 22 + Math.floor(random() * 18);
    for (let i = 0; i < puffs; i += 1) {
      const x = random() * w;
      const y = baseY + (random() - 0.5) * h * 0.1;
      const radius = w * (0.012 + random() * 0.045);
      wrapBlob(ctx, w, x, y, radius, "#ffffff", 0.34 + random() * 0.34, 0.34 + random() * 0.2);
    }
  }
  // Xoáy mây lớn
  for (let i = 0; i < 8; i += 1) {
    const cx = random() * w;
    const cy = h * (0.25 + random() * 0.5);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.12) {
      const r = (a / (Math.PI * 4)) * w * 0.05;
      const px = cx + Math.cos(a) * r * 1.8;
      const py = cy + Math.sin(a) * r * 0.5;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  return canvas;
}

const CITIES: [number, number, number][] = [
  [-74, 40.7, 10], [-118, 34, 8], [-87, 41.9, 6], [-99, 19.4, 7], [-46.6, -23.5, 7], [-58, -34.6, 5],
  [-0.1, 51.5, 6], [2.3, 48.8, 6], [13.4, 52.5, 5], [12.5, 41.9, 4], [37.6, 55.7, 6], [28.9, 41, 5],
  [31.2, 30, 6], [3.4, 6.5, 5], [28, -26, 4], [36.8, -1.3, 3], [55.3, 25.2, 4], [72.8, 19, 7],
  [77.2, 28.6, 8], [88.4, 22.6, 6], [100.5, 13.8, 5], [106.8, 10.8, 5], [116.4, 39.9, 8], [121.5, 31.2, 9],
  [139.7, 35.7, 9], [127, 37.6, 6], [151.2, -33.9, 4], [144.9, -37.8, 3], [174.8, -36.9, 2],
  [-43, -22.9, 5], [-70.7, -33.4, 4], [-77, -12, 4], [-66.1, 18.5, 3], [-82.4, 23.1, 3],
  [30.3, 59.9, 4], [24, 60.2, 3], [18.1, 59.3, 4], [10.7, 59.9, 3], [4.9, 52.4, 4], [-3.7, 40.4, 5],
  [9.2, 45.5, 4], [19, 47.5, 3], [21, 52.2, 3], [14.4, 50.1, 3], [16.4, 48.2, 3], [23.7, 37.9, 4],
  [32.9, 39.9, 4], [51.4, 35.7, 4], [46.7, 24.7, 3], [103.8, 1.3, 4], [101.7, 3.1, 4], [106.7, -6.2, 5],
  [121, 14.6, 4], [120.98, 23.6, 4], [114.1, 22.3, 6], [113.3, 23.1, 6], [108.9, 34.3, 4], [117.2, 39.1, 4],
];

function earthLights(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  for (const [lon, lat, weight] of CITIES) {
    const x = ((lon + 180) / 360) * w;
    const y = ((90 - lat) / 180) * h;
    for (let i = 0; i < weight * 2.4; i += 1) {
      const ox = (random() - 0.5) * w * 0.018;
      const oy = (random() - 0.5) * h * 0.026;
      const radius = Math.max(0.7, (w / 1024) * (0.6 + random() * 1.5));
      const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius * 3);
      gradient.addColorStop(0, "rgba(255, 214, 140, 0.95)");
      gradient.addColorStop(0.4, "rgba(255, 180, 90, 0.5)");
      gradient.addColorStop(1, "rgba(255, 160, 60, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

/* ---------------------------------- Mars --------------------------------- */

function mars(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#a34a2c";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.015 + random() * 0.1), random() > 0.45 ? "#7d3520" : "#c1764a", 0.3, 0.55);
  }
  // Valles Marineris
  ctx.strokeStyle = "rgba(74, 30, 20, 0.65)";
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.beginPath();
  for (let x = w * 0.18; x < w * 0.46; x += w * 0.01) {
    const y = h * 0.52 + Math.sin(x * 0.03) * h * 0.015;
    if (x === w * 0.18) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Olympus Mons
  const ox = w * 0.63;
  const oy = h * 0.36;
  const gradient = ctx.createRadialGradient(ox, oy, 1, ox, oy, w * 0.045);
  gradient.addColorStop(0, "rgba(214, 158, 110, 0.55)");
  gradient.addColorStop(0.55, "rgba(140, 70, 40, 0.4)");
  gradient.addColorStop(1, "rgba(140, 70, 40, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ox, oy, w * 0.045, 0, Math.PI * 2);
  ctx.fill();
  craters(ctx, w, h, Math.floor(w / 7), seed + 3, Math.max(0.7, w / 560), "#c08a63");
  // Bụi mịn
  for (let i = 0; i < 160; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.008 + random() * 0.03), "#d39a6b", 0.12, 0.4);
  }
  // Chỏm băng
  ctx.fillStyle = "rgba(238, 244, 248, 0.92)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, 0, w * 0.14, h * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h, w * 0.1, h * 0.026, 0, 0, Math.PI * 2);
  ctx.fill();
  grain(ctx, w, h, 14, seed + 9);
  return canvas;
}

/* -------------------------------- Gas giants ------------------------------ */

interface BandSpec {
  stops: [number, string][];
  turbulence: number;
  spot?: { lon: number; lat: number; rx: number; ry: number; color: string; core: string };
  stormColor?: string;
}

function bandColor(stops: [number, string][], t: number): [number, number, number] {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) return mix(c0, c1, (t - t0) / Math.max(0.0001, t1 - t0));
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

function gasGiant(w: number, h: number, seed: number, spec: BandSpec): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  const wobble = noise1d(random, 24);
  const wobble2 = noise1d(random, 40);

  for (let y = 0; y < h; y += 1) {
    const t = y / h;
    const shift = sampleNoise(wobble, t * 5.5) * spec.turbulence * 0.5;
    for (let x = 0; x < w; x += 4) {
      const local = clamp(t + sampleNoise(wobble2, (x / w) * 2 + t * 3) * spec.turbulence * 0.045 + shift * 0.02);
      const [r, g, b] = bandColor(spec.stops, local);
      const bright = 1 + sampleNoise(wobble2, x / w + t * 8) * 0.035;
      ctx.fillStyle = rgbToCss(r * bright, g * bright, b * bright);
      ctx.fillRect(x, y, 4, 1);
    }
  }

  // Xoáy khí quyển
  const swirls = Math.floor(w / 7);
  for (let i = 0; i < swirls; i += 1) {
    const t = random();
    const [r, g, b] = bandColor(spec.stops, t);
    const x = random() * w;
    const y = t * h;
    const rx = w * (0.008 + random() * 0.035);
    const ry = h * (0.003 + random() * 0.012);
    ctx.fillStyle = rgbToCss(r * 1.12, g * 1.12, b * 1.12, 0.16 + random() * 0.14);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (spec.spot) {
    const spot = spec.spot;
    const cx = ((spot.lon + 180) / 360) * w;
    const cy = ((90 - spot.lat) / 180) * h;
    const rx = spot.rx * w;
    const ry = spot.ry * h;
    const [r, g, b] = hexToRgb(spot.color);
    for (const offset of [-w, 0, w]) {
      const px = cx + offset;
      ctx.save();
      ctx.translate(px, cy);
      const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      gradient.addColorStop(0, rgbToCss(...hexToRgb(spot.core), 0.95));
      gradient.addColorStop(0.5, rgbToCss(r, g, b, 0.82));
      gradient.addColorStop(0.85, rgbToCss(r * 0.85, g * 0.85, b * 0.85, 0.45));
      gradient.addColorStop(1, rgbToCss(r, g, b, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgbToCss(255, 240, 220, 0.25);
      for (let ring = 0.35; ring < 1; ring += 0.16) {
        ctx.lineWidth = Math.max(1, h * 0.003);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * ring, ry * ring, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  if (spec.stormColor) {
    for (let i = 0; i < 26; i += 1) {
      const x = random() * w;
      const y = h * (0.2 + random() * 0.6);
      ctx.strokeStyle = spec.stormColor;
      ctx.globalAlpha = 0.1 + random() * 0.14;
      ctx.lineWidth = Math.max(1, h * 0.004);
      ctx.beginPath();
      ctx.ellipse(x, y, w * (0.01 + random() * 0.03), h * (0.004 + random() * 0.012), 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  grain(ctx, w, h, 7, seed + 5);
  return canvas;
}

function jupiter(w: number, h: number, seed: number): HTMLCanvasElement {
  return gasGiant(w, h, seed, {
    turbulence: 1.1,
    stops: [
      [0, "#8b7c6a"],
      [0.08, "#c3ab8b"],
      [0.16, "#e3d3b8"],
      [0.26, "#b99570"],
      [0.34, "#e8dcc4"],
      [0.42, "#c9ab86"],
      [0.5, "#efe4cd"],
      [0.58, "#b78d68"],
      [0.66, "#e4d2b4"],
      [0.76, "#c2a17c"],
      [0.86, "#d8c5a5"],
      [0.95, "#a08b74"],
      [1, "#7e7365"],
    ],
    spot: { lon: -75, lat: -20, rx: 0.085, ry: 0.052, color: "#a44d33", core: "#d9774f" },
  });
}

function saturn(w: number, h: number, seed: number): HTMLCanvasElement {
  return gasGiant(w, h, seed, {
    turbulence: 0.65,
    stops: [
      [0, "#9f8f72"],
      [0.1, "#cfb98f"],
      [0.2, "#e5d3ac"],
      [0.3, "#d8c19a"],
      [0.42, "#efe0bd"],
      [0.52, "#dcc79e"],
      [0.62, "#e9d8b2"],
      [0.72, "#c9b085"],
      [0.82, "#e2cfa6"],
      [0.92, "#b6a07c"],
      [1, "#8c7d66"],
    ],
  });
}

function uranus(w: number, h: number, seed: number): HTMLCanvasElement {
  return gasGiant(w, h, seed, {
    turbulence: 0.3,
    stops: [
      [0, "#7fbcc4"],
      [0.16, "#a4dbe0"],
      [0.36, "#b6e5e8"],
      [0.5, "#a9dde2"],
      [0.66, "#bce8ea"],
      [0.84, "#93cbd3"],
      [1, "#6fa6b0"],
    ],
  });
}

function neptune(w: number, h: number, seed: number): HTMLCanvasElement {
  return gasGiant(w, h, seed, {
    turbulence: 0.55,
    stormColor: "rgba(205, 225, 255, 0.55)",
    stops: [
      [0, "#21386f"],
      [0.14, "#2b4f9b"],
      [0.3, "#3768bf"],
      [0.44, "#2c56a3"],
      [0.56, "#3f77cf"],
      [0.7, "#2b4f97"],
      [0.84, "#3564b5"],
      [1, "#1a2a58"],
    ],
    spot: { lon: 30, lat: -24, rx: 0.06, ry: 0.04, color: "#152a5c", core: "#0e1e44" },
  });
}

/* ---------------------------------- Moons -------------------------------- */

function moonSurface(w: number, h: number, seed: number, base: string, tint: string): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.02 + random() * 0.1), random() > 0.5 ? "#3b3a39" : tint, 0.22, 0.6);
  }
  craters(ctx, w, h, Math.floor(w / 4.4), seed + 2, Math.max(0.7, w / 280), tint);
  grain(ctx, w, h, 16, seed + 3);
  return canvas;
}

function europa(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#d9d3c6";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.03 + random() * 0.1), random() > 0.5 ? "#efece2" : "#b9c6cc", 0.3, 0.6);
  }
  for (let i = 0; i < 110; i += 1) {
    const x0 = random() * w;
    const y0 = random() * h;
    ctx.strokeStyle = `rgba(${120 + random() * 60}, ${80 + random() * 40}, ${55 + random() * 30}, ${0.18 + random() * 0.3})`;
    ctx.lineWidth = Math.max(0.6, w * (0.001 + random() * 0.0025));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let x = x0;
    let y = y0;
    for (let s = 0; s < 5; s += 1) {
      x += (random() - 0.5) * w * 0.12;
      y += (random() - 0.45) * h * 0.16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grain(ctx, w, h, 7, seed + 6);
  return canvas;
}

function io(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#d4b54e";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.012 + random() * 0.075), random() > 0.5 ? "#e8d67e" : "#b06b30", 0.34, 0.6);
  }
  for (let i = 0; i < 30; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const radius = w * (0.004 + random() * 0.014);
    ctx.fillStyle = "rgba(72, 34, 18, 0.6)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 180, 80, 0.5)";
    ctx.lineWidth = Math.max(0.6, radius * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  grain(ctx, w, h, 12, seed + 4);
  return canvas;
}

function titan(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#c58a3e";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.03 + random() * 0.12), random() > 0.5 ? "#dcae62" : "#a56b2c", 0.16, 0.42);
  }
  ctx.fillStyle = "rgba(238, 190, 120, 0.2)";
  ctx.fillRect(0, 0, w, h * 0.09);
  ctx.fillRect(0, h * 0.91, w, h * 0.09);
  grain(ctx, w, h, 8, seed + 2);
  return canvas;
}

function phobos(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#5c5751";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.02 + random() * 0.09), random() > 0.5 ? "#3f3b37" : "#7a746b", 0.3, 0.6);
  }
  // Rãnh dài đặc trưng
  for (let i = 0; i < 14; i += 1) {
    const y = random() * h;
    ctx.strokeStyle = "rgba(30, 28, 26, 0.4)";
    ctx.lineWidth = Math.max(0.8, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + h * 0.05, w * 0.6, y - h * 0.04, w, y + h * 0.01);
    ctx.stroke();
  }
  craters(ctx, w, h, Math.floor(w / 5), seed + 1, Math.max(0.8, w / 240), "#837d73");
  grain(ctx, w, h, 18, seed + 3);
  return canvas;
}

function triton(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  ctx.fillStyle = "#c6bcbc";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i += 1) {
    wrapBlob(ctx, w, random() * w, random() * h, w * (0.006 + random() * 0.03), random() > 0.5 ? "#e0d4cf" : "#9c8b8c", 0.28, 0.8);
  }
  for (let i = 0; i < 40; i += 1) {
    const x = random() * w;
    const y = random() * h;
    ctx.strokeStyle = "rgba(255, 235, 240, 0.16)";
    ctx.lineWidth = Math.max(0.6, h * 0.004);
    ctx.beginPath();
    ctx.arc(x, y, w * (0.004 + random() * 0.012), 0, Math.PI * 2);
    ctx.stroke();
  }
  grain(ctx, w, h, 10, seed + 2);
  return canvas;
}

/* --------------------------- Rings & helpers ----------------------------- */

function ringCanvas(w: number, h: number, id: PlanetId, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(w, h);
  const random = rng(seed);
  const isSaturn = id === "saturn";
  const base = isSaturn ? [216, 198, 158] : [150, 190, 196];
  ctx.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x += 1) {
    const t = x / w;
    let alpha = isSaturn ? 0.72 + Math.sin(t * 120) * 0.06 : 0.22;
    if (isSaturn) {
      if (t < 0.05) alpha *= t / 0.05;
      if (t > 0.97) alpha *= (1 - t) / 0.03;
      // Cassini division
      if (t > 0.62 && t < 0.655) alpha *= 0.08;
      // Encke gap
      if (t > 0.885 && t < 0.895) alpha *= 0.1;
      // Vành mờ
      if (t > 0.73 && t < 0.75) alpha *= 0.35;
    }
    const shade = 0.82 + Math.sin(t * 260 + random() * 0.2) * 0.09 + random() * 0.05;
    const [r, g, b] = base;
    ctx.fillStyle = rgbToCss(r * shade, g * shade, b * shade, clamp(alpha));
    ctx.fillRect(x, 0, 1, h);
  }
  return canvas;
}

const planetCache = new Map<string, PlanetTextures>();
const moonCache = new Map<string, THREE.Texture>();

function buildPlanetTextures(id: PlanetId, detail: Detail): PlanetTextures {
  const near = detail === "near";
  const w = near ? 1024 : 512;
  const h = near ? 512 : 256;
  const seed = PLANET_SEEDS[id];
  let surface: HTMLCanvasElement;
  let clouds: HTMLCanvasElement | null = null;
  let emissive: HTMLCanvasElement | null = null;

  switch (id) {
    case "mercury":
      surface = mercury(w, h, seed);
      break;
    case "venus":
      surface = venus(w, h, seed);
      clouds = venusClouds(w, h, seed + 1);
      break;
    case "earth":
      surface = earth(w, h, seed);
      clouds = earthClouds(w, h, seed + 2);
      emissive = earthLights(w, h, seed + 3);
      break;
    case "mars":
      surface = mars(w, h, seed);
      break;
    case "jupiter":
      surface = jupiter(w, h, seed);
      break;
    case "saturn":
      surface = saturn(w, h, seed);
      break;
    case "uranus":
      surface = uranus(w, h, seed);
      break;
    case "neptune":
      surface = neptune(w, h, seed);
      break;
  }

  const ring = PLANETS_WITH_RINGS.has(id)
    ? toTexture(ringCanvas(near ? 1024 : 512, 12, id, seed + 5))
    : null;

  return {
    map: toTexture(surface),
    bump: deriveBump(surface, id === "earth" ? 2.1 : 1.5),
    roughness: deriveRoughness(surface),
    clouds: clouds ? toTexture(clouds) : null,
    emissive: emissive ? toTexture(emissive) : null,
    ring,
  };
}

const PLANET_SEEDS: Record<PlanetId, number> = {
  mercury: 137,
  venus: 241,
  earth: 311,
  mars: 419,
  jupiter: 523,
  saturn: 631,
  uranus: 743,
  neptune: 857,
};

const PLANETS_WITH_RINGS = new Set<PlanetId>(["saturn", "uranus"]);

export function planetTextures(id: PlanetId, detail: Detail = "far"): PlanetTextures {
  const key = `${id}:${detail}`;
  const cached = planetCache.get(key);
  if (cached) return cached;
  const built = buildPlanetTextures(id, detail);
  planetCache.set(key, built);
  return built;
}

export function moonTexture(kind: MoonKind, seed: number): THREE.Texture {
  const key = `${kind}:${seed}`;
  const cached = moonCache.get(key);
  if (cached) return cached;
  const w = 256;
  const h = 128;
  let canvas: HTMLCanvasElement;
  switch (kind) {
    case "europa":
      canvas = europa(w, h, seed);
      break;
    case "io":
      canvas = io(w, h, seed);
      break;
    case "titan":
      canvas = titan(w, h, seed);
      break;
    case "phobos":
      canvas = phobos(w, h, seed);
      break;
    case "triton":
      canvas = triton(w, h, seed);
      break;
    default:
      canvas = moonSurface(w, h, seed, "#8b8781", "#b3ada3");
      break;
  }
  const texture = toTexture(canvas);
  moonCache.set(key, texture);
  return texture;
}

/* ------------------------------- Vũ trụ nền ------------------------------ */

export function skyStars(count: number): { positions: Float32Array; colors: Float32Array; sizes: Float32Array } {
  const random = rng(90210);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const radius = 90 + random() * 220;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    const warm = random();
    const tint = warm > 0.86 ? [1, 0.82, 0.68] : warm > 0.7 ? [0.78, 0.86, 1] : [0.94, 0.95, 1];
    const brightness = 0.45 + random() * 0.55;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;
    sizes[i] = 0.5 + Math.pow(random(), 3) * 2.1;
  }
  return { positions, colors, sizes };
}

export function radialTexture(
  inner: string,
  outer: string,
  stops: [number, string, number][],
  size = 256
): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color, alpha] of stops) {
    const [r, g, b] = hexToRgb(color);
    gradient.addColorStop(offset, rgbToCss(r, g, b, alpha));
  }
  if (!stops.some((stop) => stop[0] === 0)) {
    const [r, g, b] = hexToRgb(inner);
    gradient.addColorStop(0, rgbToCss(r, g, b, 1));
  }
  if (!stops.some((stop) => stop[0] === 1)) {
    const [r, g, b] = hexToRgb(outer);
    gradient.addColorStop(1, rgbToCss(r, g, b, 0));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let starTextureCache: THREE.Texture | null = null;

/** Chấm sao tròn mềm — tránh cảm giác "ô vuông" của PointsMaterial mặc định. */
export function starTexture(): THREE.Texture {
  if (starTextureCache) return starTextureCache;
  const size = 64;
  const { canvas, ctx } = makeCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.22, "rgba(255, 255, 255, 0.86)");
  gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.28)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  starTextureCache = texture;
  return texture;
}

export function sunTexture(): THREE.Texture {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size / 2);
  const random = rng(4242);
  const gradient = ctx.createLinearGradient(0, 0, 0, size / 2);
  gradient.addColorStop(0, "#ffca6b");
  gradient.addColorStop(0.3, "#ffe49a");
  gradient.addColorStop(0.5, "#fff8d9");
  gradient.addColorStop(0.7, "#ffe49a");
  gradient.addColorStop(1, "#ffb85a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size / 2);
  // Hạt plasma li ti: nhiều chấm nhỏ, độ tương phản thấp để không thành "đốm phô mai".
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * size;
    const y = random() * (size / 2);
    const radius = 0.7 + random() * 2.4;
    const bright = random();
    ctx.fillStyle =
      bright > 0.72
        ? `rgba(255, 253, 240, ${0.1 + random() * 0.16})`
        : bright > 0.34
          ? `rgba(255, 226, 160, ${0.08 + random() * 0.12})`
          : `rgba(196, 104, 24, ${0.05 + random() * 0.09})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vài vết tối rất nhẹ gợi vùng hoạt động.
  for (let i = 0; i < 14; i += 1) {
    const x = random() * size;
    const y = size * 0.18 + random() * size * 0.64;
    const radius = 4 + random() * 9;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, "rgba(180, 82, 18, 0.16)");
    spot.addColorStop(1, "rgba(180, 82, 18, 0)");
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function disposeSolarTextures() {
  planetCache.forEach((set) => {
    set.map.dispose();
    set.bump.dispose();
    set.roughness.dispose();
    set.clouds?.dispose();
    set.emissive?.dispose();
    set.ring?.dispose();
  });
  planetCache.clear();
  moonCache.forEach((texture) => texture.dispose());
  moonCache.clear();
}
