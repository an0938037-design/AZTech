import type {
  ContentBlock,
  LegacyLesson,
  Lesson,
  LessonArtifacts,
  SandboxArtifact,
} from "./types";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeArtifact(
  value: unknown,
  kind: "mindmap" | "interactive"
): SandboxArtifact | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (item.kind !== kind || typeof item.html !== "string") return undefined;
  return {
    kind,
    title: asString(
      item.title,
      kind === "mindmap" ? "Sơ đồ tư duy" : "Mô hình tương tác"
    ),
    html: item.html,
    css: asString(item.css),
    js: asString(item.js),
    meta:
      item.meta && typeof item.meta === "object"
        ? (item.meta as Record<string, unknown>)
        : undefined,
  };
}

function normalizeArtifacts(value: unknown): LessonArtifacts {
  if (!value || typeof value !== "object") return {};
  const item = value as Record<string, unknown>;
  return {
    mindmap: normalizeArtifact(item.mindmap, "mindmap"),
    interactive: normalizeArtifact(item.interactive, "interactive"),
  };
}

function markdownToBlocks(markdown: string): ContentBlock[] {
  if (!markdown.trim()) return [];
  return [{ type: "markdown", text: markdown }];
}

export function normalizeLesson(raw: unknown): Lesson {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const legacy =
    value.legacy && typeof value.legacy === "object"
      ? value.legacy
      : value.lecture || value.graph_nodes || value.model_3d
        ? {
            lecture: value.lecture,
            graph_nodes: value.graph_nodes,
            graph_edges: value.graph_edges,
            model_3d: value.model_3d,
          }
        : undefined;

  const legacyMarkdown = asString(legacy?.lecture?.content_markdown);
  const blocks = Array.isArray(value.blocks)
    ? (value.blocks as ContentBlock[])
    : markdownToBlocks(legacyMarkdown);

  return {
    subject: asString(value.subject, "Chung"),
    topic: asString(value.topic, "Bài học"),
    summary: asString(
      value.summary,
      asString(legacy?.lecture?.summary, "Bài học chưa có tóm tắt.")
    ),
    blocks,
    artifacts: normalizeArtifacts(value.artifacts),
    quiz: Array.isArray(value.quiz) ? value.quiz : [],
    quizSource:
      value.quizSource === "ai" || value.quizSource === "fallback"
        ? value.quizSource
        : undefined,
    legacy: legacy
      ? {
          lecture: legacy.lecture,
          graph_nodes: legacy.graph_nodes,
          graph_edges: legacy.graph_edges,
          model_3d: legacy.model_3d,
        }
      : undefined,
  };
}

export function legacyToLesson(legacy: LegacyLesson): Lesson {
  return normalizeLesson(legacy);
}
