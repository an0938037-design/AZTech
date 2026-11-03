import type { ContentBlock, LegacyLesson, Lesson } from "./types";
import { normalizeLesson } from "./normalize";

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const cellLesson: LegacyLesson = {
  subject: "Sinh học",
  topic: "Cấu trúc tế bào",
  lecture: {
    summary:
      "Tế bào là đơn vị cơ bản của sự sống, gồm màng tế bào, tế bào chất và nhân, mỗi phần đảm nhiệm chức năng riêng biệt.",
    content_markdown: `# Cấu trúc tế bào

> [!NOTE]
> Tế bào là đơn vị cấu trúc và chức năng nhỏ nhất của cơ thể sống.

## Tổng quan
Một tế bào điển hình gồm ba phần chính: [[Màng tế bào]], [[Tế bào chất]] và [[Nhân tế bào]]. Mỗi bộ phận có vai trò riêng nhưng phối hợp nhịp nhàng.

> [!IMPORTANT]
> [[Màng tế bào]] điều hòa trao đổi chất giữa tế bào và môi trường.

## Các khái niệm chính
- **[[Tế bào]]**: Đơn vị cơ bản của sự sống.
- **[[Màng tế bào]]**: Lớp phospholipid kép bao bọc tế bào, kiểm soát vận chuyển.
- **[[Tế bào chất]]**: Môi trường gel chứa các bào quan.
- **[[Nhân tế bào]]**: Chứa DNA, điều khiển hoạt động tế bào.
- **[[Bào quan]]**: Các cơ quan nhỏ thực hiện chức năng chuyên biệt (ti thể, lạp lục...).
- **[[Ti thể]]**: "Nhà máy năng lượng" sản xuất ATP.

## Mô hình 3D
Xem tab Mô hình 3D để quan sát các bộ phận.

## Ôn tập
- So sánh [[Màng tế bào]] và [[Nhân tế bào]].
`,
  },
  graph_nodes: [
    { id: "te_bao", label: "Tế bào", type: "topic", description: "Đơn vị cơ bản của sự sống." },
    { id: "mang_te_bao", label: "Màng tế bào", type: "concept", description: "Lớp phospholipid kép bao bọc tế bào." },
    { id: "te_bao_chat", label: "Tế bào chất", type: "concept", description: "Môi trường gel chứa các bào quan." },
    { id: "nhan_te_bao", label: "Nhân tế bào", type: "concept", description: "Chứa DNA, điều khiển hoạt động." },
    { id: "bao_quan", label: "Bào quan", type: "concept", description: "Cơ quan nhỏ thực hiện chức năng chuyên biệt." },
    { id: "ti_the", label: "Ti thể", type: "concept", description: "Sản xuất ATP cho tế bào." },
  ],
  graph_edges: [
    { source: "te_bao", target: "mang_te_bao", relation: "chứa" },
    { source: "te_bao", target: "te_bao_chat", relation: "chứa" },
    { source: "te_bao", target: "nhan_te_bao", relation: "chứa" },
    { source: "te_bao_chat", target: "bao_quan", relation: "chứa" },
    { source: "bao_quan", target: "ti_the", relation: "bao gồm" },
  ],
  model_3d: {
    title: "Mô hình 3D: Tế bào",
    description: "Mô hình minh họa cấu trúc tế bào động vật.",
    components: [
      { id: "membrane", name: "Màng tế bào", color: "#3B82F6", function: "Lớp phospholipid kép bảo vệ và điều hòa trao đổi chất." },
      { id: "cytoplasm", name: "Tế bào chất", color: "#10B981", function: "Môi trường gel chứa các bào quan." },
      { id: "nucleus", name: "Nhân tế bào", color: "#F59E0B", function: "Chứa DNA, trung tâm điều khiển." },
      { id: "mitochondria", name: "Ti thể", color: "#EF4444", function: "Sản xuất ATP." },
    ],
  },
  quiz: [
    {
      question: "Bộ phận nào chứa DNA và điều khiển hoạt động tế bào?",
      options: ["Màng tế bào", "Tế bào chất", "Nhân tế bào", "Ti thể"],
      correct_answer: 2,
      explanation: "Nhân tế bào chứa DNA và là trung tâm điều khiển.",
    },
    {
      question: "Ti thể có chức năng gì?",
      options: ["Quang hợp", "Sản xuất ATP", "Lưu trữ nước", "Bảo vệ tế bào"],
      correct_answer: 1,
      explanation: "Ti thể là nhà máy năng lượng, sản xuất ATP.",
    },
    {
      question: "Màng tế bào được cấu tạo chủ yếu từ?",
      options: ["Protein đơn", "Phospholipid kép", "Cellulose", "Chitin"],
      correct_answer: 1,
      explanation: "Màng tế bào là lớp phospholipid kép.",
    },
  ],
};

const ohmLesson: LegacyLesson & { blocks: ContentBlock[] } = {
  subject: "Vật lý",
  topic: "Định luật Ohm",
  lecture: {
    summary:
      "Định luật Ohm mô tả mối quan hệ giữa điện áp, cường độ dòng điện và điện trở: U = I·R.",
    content_markdown: `# Định luật Ohm

> [!NOTE]
> U = I × R, trong đó U (V), I (A), R (Ω).

## Tổng quan
[[Định luật Ohm]] liên hệ ba đại lượng: [[Điện áp]], [[Cường độ dòng điện]] và [[Điện trở]].

> [!IMPORTANT]
> Khi [[Điện trở]] tăng, [[Cường độ dòng điện]] giảm nếu [[Điện áp]] không đổi.

## Các khái niệm chính
- **[[Điện áp]]**: Hiệu điện thế giữa hai điểm.
- **[[Cường độ dòng điện]]**: Lượng điện tích qua tiết diện mỗi giây.
- **[[Điện trở]]**: Khả năng cản trở dòng điện.
- **[[Mạch điện]]**: Mạng các linh kiện dẫn điện.

## Ôn tập
- Tính I khi U=12V, R=4Ω.
`,
  },
  blocks: [
    { type: "heading", level: 1, text: "Định luật Ohm" },
    {
      type: "paragraph",
      text: "Định luật Ohm liên hệ ba đại lượng cơ bản của mạch điện: điện áp U, cường độ dòng điện I và điện trở R. Khi biết hai đại lượng, ta tính được đại lượng còn lại.",
    },
    {
      type: "formula",
      name: "Định luật Ohm",
      expression: "U = I × R",
      variables: [
        {
          symbol: "U",
          meaning: "Điện áp giữa hai đầu đoạn mạch, đơn vị vôn (V).",
        },
        {
          symbol: "I",
          meaning: "Cường độ dòng điện qua đoạn mạch, đơn vị ampe (A).",
        },
        {
          symbol: "R",
          meaning: "Điện trở của đoạn mạch, đơn vị ohm (Ω).",
        },
      ],
      variants: [
        { label: "Tính dòng điện", expression: "I = U / R" },
        { label: "Tính điện trở", expression: "R = U / I" },
        { label: "Tính điện áp", expression: "U = I × R" },
      ],
      note: "Chỉ áp dụng cho đoạn mạch có điện trở thuần và nhiệt độ gần như không đổi.",
    },
    { type: "heading", level: 2, text: "Các khái niệm chính" },
    {
      type: "concept",
      title: "Điện áp (U)",
      body: "Hiệu điện thế giữa hai điểm trong mạch, tạo ra lực đẩy điện tích. Đo bằng vôn kế mắc song song với đoạn mạch.",
    },
    {
      type: "concept",
      title: "Cường độ dòng điện (I)",
      body: "Lượng điện tích đi qua tiết diện dây dẫn trong một giây. Đo bằng ampe kế mắc nối tiếp trong mạch.",
    },
    {
      type: "concept",
      title: "Điện trở (R)",
      body: "Mức cản trở dòng điện của vật dẫn, phụ thuộc vào vật liệu, chiều dài và tiết diện của dây.",
    },
    {
      type: "concept",
      title: "Mạch điện",
      body: "Tập hợp nguồn điện, dây dẫn và các linh kiện nối với nhau thành đường kín cho dòng điện chạy qua.",
    },
    {
      type: "warning",
      title: "Quan hệ tỉ lệ nghịch",
      body: "Với U không đổi, R tăng gấp đôi thì I giảm một nửa. Không nhầm U = I × R với công thức công suất P = U × I.",
    },
    {
      type: "example",
      title: "Tính cường độ dòng điện",
      problem:
        "Cho điện áp U = 12 V đặt vào hai đầu điện trở R = 4 Ω. Tính cường độ dòng điện I trong mạch.",
      steps: [
        "Áp dụng hệ thức I = U / R.",
        "Thay số: I = 12 / 4.",
        "Tính được I = 3 A.",
      ],
      answer: "I = 3 A.",
    },
    { type: "heading", level: 2, text: "Ôn tập" },
    {
      type: "list",
      ordered: true,
      items: [
        "Tính I khi U = 12 V và R = 4 Ω.",
        "Nếu R tăng gấp ba lần và U giữ nguyên, I thay đổi thế nào?",
        "Nêu đơn vị của U, I và R.",
      ],
    },
  ],
  graph_nodes: [
    { id: "dinh_luat_ohm", label: "Định luật Ohm", type: "topic", description: "U = I·R." },
    { id: "dien_ap", label: "Điện áp", type: "concept", description: "Hiệu điện thế giữa hai điểm." },
    { id: "cuong_do", label: "Cường độ dòng điện", type: "concept", description: "Lượng điện tích qua tiết diện mỗi giây." },
    { id: "dien_tro", label: "Điện trở", type: "concept", description: "Khả năng cản trở dòng điện." },
    { id: "mach_dien", label: "Mạch điện", type: "concept", description: "Mạng các linh kiện dẫn điện." },
  ],
  graph_edges: [
    { source: "dinh_luat_ohm", target: "dien_ap", relation: "bao gồm" },
    { source: "dinh_luat_ohm", target: "cuong_do", relation: "bao gồm" },
    { source: "dinh_luat_ohm", target: "dien_tro", relation: "bao gồm" },
    { source: "dien_ap", target: "cuong_do", relation: "quyết định" },
    { source: "dien_tro", target: "cuong_do", relation: "cản trở" },
  ],
  model_3d: {
    title: "Mô hình 3D: Mạch điện đơn giản",
    description: "Mô hình minh họa mạch điện với nguồn, điện trở và ampe kế.",
    components: [
      { id: "source", name: "Nguồn điện", color: "#F59E0B", function: "Cung cấp điện áp cho mạch." },
      { id: "resistor", name: "Điện trở", color: "#EF4444", function: "Cản trở dòng điện." },
      { id: "ammeter", name: "Ampe kế", color: "#3B82F6", function: "Đo cường độ dòng điện." },
      { id: "wire", name: "Dây dẫn", color: "#10B981", function: "Dẫn dòng điện." },
    ],
  },
  quiz: [
    {
      question: "Công thức định luật Ohm là?",
      options: ["U = I·R", "P = U·I", "Q = C·U", "F = m·a"],
      correct_answer: 0,
      explanation: "Định luật Ohm: U = I·R.",
    },
    {
      question: "Nếu điện trở tăng gấp đôi và điện áp không đổi, cường độ dòng điện?",
      options: ["Tăng gấp đôi", "Giảm một nửa", "Không đổi", "Tăng gấp bốn"],
      correct_answer: 1,
      explanation: "I = U/R, R tăng gấp đôi → I giảm một nửa.",
    },
    {
      question: "Đơn vị của điện trở là?",
      options: ["Volt", "Ampere", "Ohm", "Watt"],
      correct_answer: 2,
      explanation: "Điện trở đo bằng Ohm (Ω).",
    },
  ],
};

const PRESETS: Record<string, LegacyLesson> = {
  [norm("Cấu trúc tế bào")]: cellLesson,
  [norm("Định luật Ohm")]: ohmLesson,
};

export function getPreset(subject: string, topic: string): Lesson | null {
  const key = norm(topic);
  const lesson = PRESETS[key];
  if (!lesson) return null;
  const clone = JSON.parse(JSON.stringify(lesson)) as LegacyLesson;
  if (subject) clone.subject = subject;
  return normalizeLesson(clone);
}