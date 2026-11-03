function text(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function list(value, fallback = []) {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : fallback;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function validateAnalysis(value, fallback) {
  const data = object(value);
  const subject = text(data.subject, fallback.subject);
  const topic = text(data.topic, fallback.topic);
  const brief = object(data.lecture_brief);
  const mindmap = object(data.mindmap_brief);
  const interactive = object(data.interactive_brief);

  const concepts = Array.isArray(brief.concepts)
    ? brief.concepts
        .map((item) => ({
          name: text(item?.name),
          definition: text(item?.definition),
        }))
        .filter((item) => item.name)
    : [];

  const formulas = Array.isArray(brief.formulas)
    ? brief.formulas
        .map((item) => ({
          name: text(item?.name),
          expression: text(item?.expression),
          variants: list(item?.variants),
        }))
        .filter((item) => item.expression)
    : [];

  const branches = Array.isArray(mindmap.branches)
    ? mindmap.branches
        .map((branch) => ({
          title: text(branch?.title),
          children: list(branch?.children),
        }))
        .filter((branch) => branch.title)
    : [];

  const fallbackBranches =
    branches.length > 0
      ? branches
      : concepts.slice(0, 6).map((concept) => ({
          title: concept.name,
          children: [concept.definition].filter(Boolean),
        }));

  return {
    subject,
    topic,
    objectives: list(data.objectives),
    lecture_brief: {
      outline: list(brief.outline, [
        "Tổng quan",
        "Khái niệm cốt lõi",
        "Công thức",
        "Ví dụ",
        "Ôn tập",
      ]),
      concepts,
      formulas,
      examples: list(brief.examples),
      warnings: list(brief.warnings),
    },
    mindmap_brief: {
      root: text(mindmap.root, topic),
      branches: fallbackBranches,
    },
    interactive_brief: {
      kind: text(interactive.kind, "generic"),
      goal: text(interactive.goal, `Mô hình tương tác cho ${topic}.`),
      inputs: list(interactive.inputs),
      outputs: list(interactive.outputs),
      constraints: list(interactive.constraints),
    },
  };
}

function validateBlock(value) {
  const block = object(value);
  const type = text(block.type);
  if (type === "heading") {
    const level = Number(block.level);
    return {
      type,
      level: level >= 1 && level <= 3 ? level : 2,
      text: text(block.text),
    };
  }
  if (type === "paragraph") {
    return { type, text: text(block.text) };
  }
  if (type === "concept") {
    return { type, title: text(block.title), body: text(block.body) };
  }
  if (type === "formula") {
    const variables = Array.isArray(block.variables)
      ? block.variables
          .map((item) => ({
            symbol: text(item?.symbol),
            meaning: text(item?.meaning),
          }))
          .filter((item) => item.symbol)
      : [];
    const variants = Array.isArray(block.variants)
      ? block.variants
          .map((item) => ({
            label: text(item?.label),
            expression: text(item?.expression),
          }))
          .filter((item) => item.expression)
      : [];
    return {
      type,
      name: text(block.name),
      expression: text(block.expression),
      variables,
      variants,
      note: text(block.note),
    };
  }
  if (type === "warning") {
    return { type, title: text(block.title), body: text(block.body) };
  }
  if (type === "example") {
    return {
      type,
      title: text(block.title),
      problem: text(block.problem),
      steps: list(block.steps),
      answer: text(block.answer),
    };
  }
  if (type === "list") {
    return {
      type,
      items: list(block.items),
      ordered: !!block.ordered,
    };
  }
  if (type === "markdown") {
    return { type, text: text(block.text) };
  }
  return null;
}

function validateLecture(value) {
  const data = object(value);
  const blocks = Array.isArray(data.blocks)
    ? data.blocks.map(validateBlock).filter(Boolean)
    : [];
  const safeBlocks =
    blocks.length > 0
      ? blocks
      : [{ type: "paragraph", text: text(data.summary, "Chưa có nội dung.") }];
  return {
    summary: text(data.summary),
    blocks: safeBlocks,
  };
}

function validateArtifact(value, expectedKind) {
  const data = object(value);
  const kind = text(data.kind);
  if (kind !== expectedKind) {
    throw new Error(
      `Artifact sai kênh: nhận "${kind || "(trống)"}", cần "${expectedKind}".`
    );
  }
  const html = text(data.html);
  const css = text(data.css);
  const js = text(data.js);
  if (!html) throw new Error("Artifact thiếu html.");
  const total = html.length + css.length + js.length;
  if (total > 600_000) {
    throw new Error("Artifact quá lớn (giới hạn 600KB).");
  }
  return {
    kind: expectedKind,
    title: text(data.title, expectedKind === "mindmap" ? "Sơ đồ tư duy" : "Mô hình tương tác"),
    html,
    css,
    js,
    meta: object(data.meta),
  };
}

function validateQuiz(value) {
  const data = object(value);
  const quiz = Array.isArray(data.quiz)
    ? data.quiz
        .map((item) => {
          const options = list(item?.options);
          const correct = Number(item?.correct_answer);
          if (options.length !== 4) return null;
          if (!Number.isInteger(correct) || correct < 0 || correct > 3) return null;
          return {
            question: text(item?.question),
            options,
            correct_answer: correct,
            explanation: text(item?.explanation),
          };
        })
        .filter((item) => item && item.question)
    : [];
  if (quiz.length < 3) throw new Error("Cần ít nhất 3 câu hỏi hợp lệ.");
  return quiz;
}

function validateLessonForSave(value) {
  const lesson = object(value);
  const subject = text(lesson.subject, "Chung");
  const topic = text(lesson.topic, "Bài học");
  const blocks = Array.isArray(lesson.blocks)
    ? lesson.blocks.map(validateBlock).filter(Boolean)
    : [];
  const artifacts = object(lesson.artifacts);
  const mindmap = artifacts.mindmap
    ? validateArtifact(artifacts.mindmap, "mindmap")
    : undefined;
  const interactive = artifacts.interactive
    ? validateArtifact(artifacts.interactive, "interactive")
    : undefined;
  const quiz = Array.isArray(lesson.quiz)
    ? lesson.quiz
        .map((item) => {
          const options = list(item?.options);
          const correct = Number(item?.correct_answer);
          if (options.length !== 4) return null;
          if (!Number.isInteger(correct) || correct < 0 || correct > 3) return null;
          return {
            question: text(item?.question),
            options,
            correct_answer: correct,
            explanation: text(item?.explanation),
          };
        })
        .filter((item) => item && item.question)
    : [];

  return {
    subject,
    topic,
    summary: text(lesson.summary),
    blocks,
    artifacts: { mindmap, interactive },
    quiz,
  };
}

module.exports = {
  validateAnalysis,
  validateLecture,
  validateArtifact,
  validateQuiz,
  validateLessonForSave,
};
