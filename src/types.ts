export type AiProvider = "gemini" | "openrouter";

export interface AiConfigInfo {
  provider: AiProvider;
  model: string;
  hasKey: boolean;
  keyHint: string | null;
}

export interface AccountInfo {
  code: string;
  createdAt: string | number;
  activeProvider: AiProvider;
  ai: Record<AiProvider, AiConfigInfo>;
}

export type NodeType = "concept" | "topic";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  relation: string;
}

export interface ModelComponent {
  id: string;
  name: string;
  color: string;
  function: string;
}

export interface Model3D {
  title: string;
  description: string;
  components: ModelComponent[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

export interface FormulaVariable {
  symbol: string;
  meaning: string;
}

export interface FormulaVariant {
  label: string;
  expression: string;
}

export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "concept"; title: string; body: string }
  | {
      type: "formula";
      name: string;
      expression: string;
      variables: FormulaVariable[];
      variants: FormulaVariant[];
      note: string;
    }
  | { type: "warning"; title: string; body: string }
  | {
      type: "example";
      title: string;
      problem: string;
      steps: string[];
      answer: string;
    }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "markdown"; text: string };

export interface SandboxArtifact {
  kind: "mindmap" | "interactive";
  title: string;
  html: string;
  css: string;
  js: string;
  meta?: Record<string, unknown>;
}

export interface LessonArtifacts {
  mindmap?: SandboxArtifact;
  interactive?: SandboxArtifact;
}

export interface LessonLegacy {
  lecture?: { summary: string; content_markdown: string };
  graph_nodes?: GraphNode[];
  graph_edges?: GraphEdge[];
  model_3d?: Model3D;
}

export interface Lesson {
  subject: string;
  topic: string;
  summary: string;
  blocks: ContentBlock[];
  artifacts: LessonArtifacts;
  quiz: QuizQuestion[];
  quizSource?: "ai" | "fallback";
  legacy?: LessonLegacy;
}

export interface LegacyLesson {
  subject: string;
  topic: string;
  lecture: { summary: string; content_markdown: string };
  graph_nodes: GraphNode[];
  graph_edges: GraphEdge[];
  model_3d: Model3D;
  quiz: QuizQuestion[];
}

export interface AnalysisConcept {
  name: string;
  definition: string;
}

export interface AnalysisFormula {
  name: string;
  expression: string;
  variants: string[];
}

export interface Analysis {
  subject: string;
  topic: string;
  objectives: string[];
  lecture_brief: {
    outline: string[];
    concepts: AnalysisConcept[];
    formulas: AnalysisFormula[];
    examples: string[];
    warnings: string[];
  };
  mindmap_brief: {
    root: string;
    branches: { title: string; children: string[] }[];
  };
  interactive_brief: {
    kind: string;
    goal: string;
    inputs: string[];
    outputs: string[];
    constraints: string[];
  };
}
