import type {
  ContentBlock,
  GraphEdge,
  GraphNode,
  Lesson,
  ModelComponent,
  QuizQuestion,
} from "./types";

function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "node"
  );
}

function uniqId(base: string, used: Set<string>): string {
  let id = base;
  let index = 2;
  while (used.has(id)) {
    id = `${base}_${index++}`;
  }
  used.add(id);
  return id;
}

interface Concept {
  label: string;
  description: string;
}

function extractConcepts(topic: string, notes: string): Concept[] {
  const concepts: Concept[] = [];
  const seen = new Set<string>();
  const add = (label: string, description: string) => {
    const clean = label.trim();
    if (clean.length < 2 || clean.length > 70) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    concepts.push({
      label: clean,
      description:
        description.trim() || `Khái niệm liên quan đến ${topic}.`,
    });
  };

  add(topic, `Chủ đề chính của bài học: ${topic}.`);

  const lines = notes
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const cleaned = line.replace(/^[-*•]\s*/, "");
    const match = cleaned.match(/^(.+?)(?:\s*[:：]\s*|\s+[-–—]\s+)(.+)$/);
    if (match) {
      add(match[1], match[2]);
    } else if (cleaned.length <= 70) {
      add(cleaned, `Nội dung ghi chú: ${cleaned}.`);
    } else {
      cleaned.split(/[.!?]/).forEach((sentence) => {
        const value = sentence.trim();
        if (value.length >= 2 && value.length <= 70) {
          add(value, `Nội dung ghi chú: ${value}.`);
        }
      });
    }
  }

  const fallbacks = ["Định nghĩa", "Ví dụ", "Ứng dụng", "Tổng kết"];
  for (const fallback of fallbacks) {
    if (concepts.length >= 6) break;
    add(`${fallback} của ${topic}`, `Phần ${fallback.toLowerCase()} trong bài học ${topic}.`);
  }

  return concepts.slice(0, 12);
}

const GRAYSCALE = ["#f5f5f5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040"];

export function generateLesson(subject: string, topic: string, notes: string): Lesson {
  const concepts = extractConcepts(topic, notes);
  const usedIds = new Set<string>();
  const nodes: GraphNode[] = concepts.map((concept, index) => ({
    id: uniqId(slug(concept.label), usedIds),
    label: concept.label,
    type: index === 0 ? "topic" : "concept",
    description: concept.description,
  }));

  const edges: GraphEdge[] = [];
  const root = nodes[0];
  for (let index = 1; index < nodes.length; index++) {
    edges.push({ source: root.id, target: nodes[index].id, relation: "bao gồm" });
  }
  for (let index = 1; index < nodes.length - 1; index += 2) {
    edges.push({
      source: nodes[index].id,
      target: nodes[index + 1].id,
      relation: "liên quan",
    });
  }

  const blocks: ContentBlock[] = [
    { type: "heading", level: 2, text: "Tổng quan" },
    {
      type: "paragraph",
      text: `Bài học ${topic} thuộc môn ${subject}. Nội dung dưới đây được tổng hợp từ ghi chú và có thể dùng làm bản nháp để chỉnh sửa.`,
    },
    {
      type: "concept",
      title: `Khái niệm trung tâm: ${topic}`,
      body:
        concepts[0]?.description ||
        `Đây là khái niệm trung tâm của bài ${topic}.`,
    },
    { type: "heading", level: 2, text: "Các khái niệm chính" },
  ];

  for (const concept of concepts.slice(1, 6)) {
    blocks.push({
      type: "concept",
      title: concept.label,
      body: concept.description,
    });
  }

  const formulaLines = notes
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .slice(0, 3);

  if (formulaLines.length > 0) {
    blocks.push({ type: "heading", level: 2, text: "Công thức cốt lõi" });
    for (const line of formulaLines) {
      const [left, ...rest] = line.split("=");
      const expression = line.replace(/^[-*•]\s*/, "");
      blocks.push({
        type: "formula",
        name: left.trim() || "Công thức",
        expression,
        variables: [],
        variants: [],
        note: rest.length > 1 ? "Công thức lấy từ ghi chú." : "",
      });
    }
  }

  blocks.push(
    {
      type: "warning",
      title: "Lưu ý",
      body: "Bản nháp này được tạo tự động. Hãy kiểm tra lại số liệu, đơn vị và cách diễn đạt trước khi dùng để học.",
    },
    {
      type: "example",
      title: "Ví dụ tự luyện",
      problem: `Hãy giải thích ${topic} bằng lời của bạn trong 3-4 câu.`,
      steps: [
        "Nêu định nghĩa hoặc ý chính.",
        "Chỉ ra một ví dụ hoặc ứng dụng.",
        "Chỉ ra một lỗi thường gặp.",
      ],
      answer: "So sánh câu trả lời của bạn với phần tóm tắt và các khái niệm ở trên.",
    },
    { type: "heading", level: 2, text: "Ôn tập" },
    {
      type: "list",
      ordered: false,
      items: [
        `Tự giải thích ${topic} mà không nhìn tài liệu.`,
        "Vẽ lại sơ đồ tư duy từ trí nhớ.",
        "Làm lại bài kiểm tra và ghi chú lỗi sai.",
      ],
    }
  );

  const summary = `Bài học ${topic} (môn ${subject}) gồm ${concepts.length} khái niệm chính, phần tóm tắt, ví dụ và câu hỏi ôn tập.`;

  const components: ModelComponent[] = concepts.slice(0, 4).map((concept, index) => ({
    id: slug(concept.label) + "_comp",
    name: concept.label,
    color: GRAYSCALE[index % GRAYSCALE.length],
    function: concept.description,
  }));

  const quiz: QuizQuestion[] = [];
  for (let index = 0; index < Math.min(5, concepts.length); index++) {
    const concept = concepts[index];
    const options = [
      concept.label,
      ...concepts.filter((_, i) => i !== index).slice(0, 3).map((item) => item.label),
    ];
    while (options.length < 4) options.push("Phương án khác");
    const correct = options[0];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    quiz.push({
      question: `Khái niệm nào được mô tả là: "${concept.description}"?`,
      options,
      correct_answer: options.indexOf(correct),
      explanation: `Đáp án đúng là ${concept.label} vì ${concept.description}`,
    });
  }
  while (quiz.length < 3) {
    quiz.push({
      question: "Bài học này thuộc môn nào?",
      options: [subject, "Toán", "Ngữ Văn", "Tiếng Anh"],
      correct_answer: 0,
      explanation: `Bài học thuộc môn ${subject}.`,
    });
  }

  return {
    subject,
    topic,
    summary,
    blocks,
    artifacts: {},
    quiz,
    quizSource: "fallback",
    legacy: {
      graph_nodes: nodes,
      graph_edges: edges,
      model_3d: {
        title: `Mô hình: ${topic}`,
        description: `Mô hình minh họa các thành phần chính của ${topic}.`,
        components,
      },
    },
  };
}
