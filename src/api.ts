import type {
  AccountInfo,
  AiProvider,
  Analysis,
  Lesson,
  QuizQuestion,
  SandboxArtifact,
} from "./types";
import type { SavedLesson } from "./storage";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "api_error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  deviceCode?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(deviceCode ? { "X-Device-CODE": deviceCode } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || `Lỗi HTTP ${response.status}`,
      response.status,
      data?.error || "api_error"
    );
  }
  return data as T;
}

export function getAccount(deviceCode: string) {
  return request<{ account: AccountInfo | null }>(
    `/api/account?deviceCode=${encodeURIComponent(deviceCode)}`,
    {},
    deviceCode
  );
}

export function createAccount(deviceCode: string) {
  return request<{ account: AccountInfo }>(
    "/api/account/create",
    { method: "POST", body: "{}" },
    deviceCode
  );
}

export function bindAccount(deviceCode: string, code: string) {
  return request<{ account: AccountInfo }>(
    "/api/account/bind",
    { method: "POST", body: JSON.stringify({ code }) },
    deviceCode
  );
}

export function saveAiSettings(
  deviceCode: string,
  provider: AiProvider,
  key: string | undefined,
  model: string
) {
  return request<{ account: AccountInfo }>(
    "/api/ai/settings",
    {
      method: "PUT",
      body: JSON.stringify({ provider, key, model }),
    },
    deviceCode
  );
}

export function setActiveProvider(deviceCode: string, provider: AiProvider) {
  return request<{ account: AccountInfo }>(
    "/api/ai/active-provider",
    { method: "POST", body: JSON.stringify({ provider }) },
    deviceCode
  );
}

export function testAi(
  deviceCode: string,
  provider: AiProvider,
  key: string | undefined,
  model: string
) {
  return request<{ ok: boolean; message: string; models?: string[] }>(
    "/api/ai/test",
    {
      method: "POST",
      body: JSON.stringify({ provider, key, model }),
    },
    deviceCode
  );
}

export function listModels(deviceCode: string, provider: AiProvider) {
  return request<{
    models: { id: string; name: string; context_length: number | null }[];
  }>(
    `/api/ai/models?provider=${encodeURIComponent(provider)}`,
    {},
    deviceCode
  );
}

export function analyze(
  deviceCode: string,
  input: { subject: string; topic: string; prompt: string; notes: string },
  signal?: AbortSignal
) {
  return request<{ analysis: Analysis }>(
    "/api/ai/analyze",
    { method: "POST", body: JSON.stringify(input), signal },
    deviceCode
  );
}

export function generateLecture(
  deviceCode: string,
  input: { subject: string; topic: string; analysis: Analysis },
  signal?: AbortSignal
) {
  return request<{ lecture: { summary: string; blocks: Lesson["blocks"] } }>(
    "/api/ai/lecture",
    { method: "POST", body: JSON.stringify(input), signal },
    deviceCode
  );
}

export function generateMindmap(
  deviceCode: string,
  input: { subject: string; topic: string; analysis: Analysis },
  signal?: AbortSignal
) {
  return request<{ artifact: SandboxArtifact }>(
    "/api/ai/mindmap",
    { method: "POST", body: JSON.stringify(input), signal },
    deviceCode
  );
}

export function generateInteractive(
  deviceCode: string,
  input: { subject: string; topic: string; analysis: Analysis },
  signal?: AbortSignal
) {
  return request<{ artifact: SandboxArtifact }>(
    "/api/ai/interactive",
    { method: "POST", body: JSON.stringify(input), signal },
    deviceCode
  );
}

export function generateQuiz(
  deviceCode: string,
  input: {
    subject: string;
    topic: string;
    analysis: Analysis;
    lecture: { summary: string; blocks: Lesson["blocks"] };
  },
  signal?: AbortSignal
) {
  return request<{ quiz: QuizQuestion[] }>(
    "/api/ai/quiz",
    { method: "POST", body: JSON.stringify(input), signal },
    deviceCode
  );
}

export function listLessons(deviceCode: string) {
  return request<{
    lessons: {
      id: string;
      subject: string;
      topic: string;
      summary: string;
      createdAt: string | number;
      sizeBytes?: number;
      version?: number;
    }[];
  }>("/api/lessons", {}, deviceCode);
}

export function getLesson(deviceCode: string, id: string) {
  return request<{ lesson: SavedLesson }>(
    `/api/lessons/${encodeURIComponent(id)}`,
    {},
    deviceCode
  );
}

export function saveLesson(deviceCode: string, lesson: Lesson) {
  return request<{
    lesson: { id: string; createdAt: string | number; version: number; sizeBytes: number };
  }>(
    "/api/lessons",
    { method: "POST", body: JSON.stringify({ lesson }) },
    deviceCode
  );
}

export function deleteLesson(deviceCode: string, id: string) {
  return request<{ ok: boolean }>(
    `/api/lessons/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    deviceCode
  );
}

export function importLessons(deviceCode: string, lessons: Lesson[]) {
  return request<{ count: number }>(
    "/api/lessons/import",
    { method: "POST", body: JSON.stringify({ lessons }) },
    deviceCode
  );
}
