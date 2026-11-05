import { create } from "zustand";
import type {
  AccountInfo,
  AiProvider,
  Analysis,
  Lesson,
} from "./types";
import { generateLesson } from "./generator";
import { getPreset } from "./presets";
import { loadCloudCache, loadLessons, saveCloudCache, saveLessons, type SavedLesson } from "./storage";
import { normalizeLesson } from "./normalize";
import { buildFallbackArtifacts } from "./fallbackArtifacts";
import * as api from "./api";
import { SYSTEM_FOCUS, type SolarFocus } from "./solar";

export type View =
  | "home"
  | "library"
  | "lesson"
  | "create"
  | "account"
  | "study"
  | "geometry"
  | "lab"
  | "arduino"
  | "vanlab"
  | "sim"
  | "assess"
  | "settings";
type Tab = "lecture" | "mindmap" | "interactive" | "quiz";
type ChannelStatus = "idle" | "pending" | "done" | "error";

interface PipelineState {
  active: boolean;
  stage: "idle" | "analyzing" | "generating" | "done" | "error";
  lecture: ChannelStatus;
  mindmap: ChannelStatus;
  interactive: ChannelStatus;
  error: string | null;
  startedAt: number;
}

interface Draft {
  analysis: Analysis | null;
  lesson: Lesson;
}

interface AppState {
  view: View;
  solarFocus: SolarFocus;
  lessons: SavedLesson[];
  activeId: string | null;
  lessonLoading: boolean;

  subject: string;
  topic: string;
  prompt: string;
  notes: string;
  generating: boolean;
  generateError: string | null;
  activeTab: Tab;
  pipeline: PipelineState;
  draft: Draft | null;
  quizLoading: boolean;

  deviceCode: string;
  account: AccountInfo | null;
  accountLoading: boolean;
  /** Lớp mờ che màn hình khi phóng từ hành tinh phòng lab vào phòng mô phỏng. */
  sceneFade: boolean;

  setView: (view: View) => void;
  setSceneFade: (value: boolean) => void;
  setSolarFocus: (focus: SolarFocus) => void;
  setField: (key: "subject" | "topic" | "prompt" | "notes", value: string) => void;
  setDeviceCode: (code: string) => void;
  setTab: (tab: Tab) => void;
  initAccount: () => Promise<void>;
  refreshLessons: () => Promise<void>;
  createAccount: () => Promise<AccountInfo | null>;
  bindAccount: (code: string) => Promise<AccountInfo | null>;
  saveAiSettings: (
    provider: AiProvider,
    key: string | undefined,
    model: string
  ) => Promise<AccountInfo | null>;
  setActiveProvider: (provider: AiProvider) => Promise<AccountInfo | null>;
  testAi: (
    provider: AiProvider,
    key: string | undefined,
    model: string
  ) => Promise<{ ok: boolean; message: string; models?: string[] }>;
  generate: () => Promise<void>;
  cancelGenerate: () => void;
  openLesson: (id: string) => Promise<void>;
  deleteLesson: (id: string) => Promise<void>;
  loadJson: (json: string) => { ok: boolean; error?: string };
  exportJson: () => string;
  activeLesson: () => SavedLesson | null;
  importFile: (file: File) => Promise<void>;
  approveDraft: () => Promise<void>;
  rejectDraft: () => void;
  migrateLocalLessons: () => Promise<number>;
  ensureQuiz: () => Promise<void>;
}

let activeAbort: AbortController | null = null;
let fallbackTimer: number | null = null;

function clearFallbackTimer() {
  if (fallbackTimer !== null) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

function ensureFallbackArtifacts(lesson: Lesson): Lesson {
  const fallback = buildFallbackArtifacts(lesson);
  return {
    ...lesson,
    artifacts: {
      mindmap: lesson.artifacts?.mindmap ?? fallback.mindmap,
      interactive: lesson.artifacts?.interactive ?? fallback.interactive,
    },
  };
}

function genDeviceCode() {
  const value = String(Math.floor(10000000 + Math.random() * 90000000));
  try {
    localStorage.setItem("device-code", value);
  } catch {
    // ignore
  }
  return value;
}

function normalizeSaved(raw: any): SavedLesson {
  const lesson = normalizeLesson(raw);
  return {
    ...lesson,
    id: String(raw?.id || crypto.randomUUID()),
    createdAt: raw?.createdAt ?? Date.now(),
    version: raw?.version,
    sizeBytes: raw?.sizeBytes,
  };
}

const SEEDED_KEY = "ai-learning-seeded-v1";

function seedLocalLessons(): SavedLesson[] {
  const raw = loadLessons().map(normalizeSaved);
  let seededBefore = false;
  try {
    seededBefore = localStorage.getItem(SEEDED_KEY) === "1";
  } catch {
    // ignore
  }
  if (raw.length === 0 && seededBefore) return [];

  const seen = new Set<string>();
  const deduped = raw.filter((lesson) => {
    const key = `${lesson.subject}|${lesson.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const seeds = [
    { subject: "Toán", topic: "Hàm số bậc hai", notes: "- Đỉnh parabol\n- Trục đối xứng\n- Bảng biến thiên" },
    { subject: "Ngữ Văn", topic: "Phân tích tác phẩm", notes: "- Bố cục\n- Luận điểm\n- Dẫn chứng" },
    { subject: "Vật Lý", topic: "Con lắc đơn", notes: "- Chiều dài dây\n- Khối lượng\n- Chu kỳ" },
    { subject: "Hoá Học", topic: "Cấu tạo nguyên tử", notes: "- Hạt nhân\n- Electron\n- Lớp electron" },
    { subject: "Sinh Học", topic: "Cấu trúc tế bào", notes: "" },
    { subject: "Lịch Sử", topic: "Chiến dịch Điện Biên Phủ", notes: "- Thời gian\n- Lực lượng\n- Kết quả" },
    { subject: "Tin học văn phòng", topic: "Excel cơ bản", notes: "- Công thức\n- Biểu đồ\n- PivotTable" },
    { subject: "Tin học Lập Trình", topic: "Biến và kiểu dữ liệu", notes: "- int\n- float\n- string" },
    { subject: "Tiếng Anh", topic: "Present Simple", notes: "- S + V(s/es)\n- Trợ động từ do/does" },
  ];

  const existingSubjects = new Set(deduped.map((lesson) => lesson.subject));
  const missing = seeds.filter((seed) => !existingSubjects.has(seed.subject));
  const seeded = missing.map((seed) => {
    if (seed.subject === "Sinh Học") {
      const preset = getPreset("Sinh học", "Cấu trúc tế bào");
      if (preset) {
        return {
          ...ensureFallbackArtifacts({
            ...preset,
            subject: seed.subject,
            topic: seed.topic,
          }),
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
      }
    }
    return {
      ...ensureFallbackArtifacts(
        generateLesson(seed.subject, seed.topic, seed.notes)
      ),
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
  });

  const merged = [...deduped, ...seeded];
  if (merged.length !== raw.length || seeded.length > 0) {
    saveLessons(merged);
  }
  if (merged.length > 0) {
    try {
      localStorage.setItem(SEEDED_KEY, "1");
    } catch {
      // ignore
    }
  }
  return merged;
}

async function fetchServerLessons(deviceCode: string): Promise<SavedLesson[]> {
  const result = await api.listLessons(deviceCode);
  return result.lessons.map((item) =>
    normalizeSaved({
      ...item,
      blocks: [],
      artifacts: {},
      quiz: [],
    })
  );
}

const initialPipeline: PipelineState = {
  active: false,
  stage: "idle",
  lecture: "idle",
  mindmap: "idle",
  interactive: "idle",
  error: null,
  startedAt: 0,
};

export const useStore = create<AppState>((set, get) => {
  const patchPipeline = (patch: Partial<PipelineState>) =>
    set((state) => ({ pipeline: { ...state.pipeline, ...patch } }));

  const cloudCache = loadCloudCache();

  return {
    view: "home",
    solarFocus: SYSTEM_FOCUS,
    account: cloudCache?.account ?? null,
    lessons:
      cloudCache && cloudCache.lessons.length
        ? cloudCache.lessons.map(normalizeSaved)
        : seedLocalLessons(),
    activeId: null,
    lessonLoading: false,

    subject: "Toán",
    topic: "",
    prompt: "",
    notes: "",
    generating: false,
    generateError: null,
    activeTab: "lecture",
    pipeline: initialPipeline,
    draft: null,
    quizLoading: false,

    deviceCode: (() => {
      try {
        const value = localStorage.getItem("device-code");
        if (value) return value;
      } catch {
        // ignore
      }
      return genDeviceCode();
    })(),
    accountLoading: false,
    sceneFade: false,

    setView: (view) => set({ view }),
    setSceneFade: (value) => set({ sceneFade: value }),
    setSolarFocus: (solarFocus) => set({ solarFocus }),
    setField: (key, value) => set({ [key]: value } as any),
    setDeviceCode: (code) => {
      const clean = code.replace(/\D/g, "").slice(0, 8);
      try {
        localStorage.setItem("device-code", clean);
      } catch {
        // ignore
      }
      set({ deviceCode: clean });
    },
    setTab: (activeTab) => set({ activeTab }),

    initAccount: async () => {
      set({ accountLoading: true });
      const deviceCode = get().deviceCode;
      /* Gọi song song thay vì chờ tài khoản xong mới hỏi bài học (2 lượt nối
         tiếp ~2.8s trên mạng thật). */
      const [accountResult, lessonsResult] = await Promise.allSettled([
        api.getAccount(deviceCode),
        fetchServerLessons(deviceCode),
      ]);

      if (accountResult.status === "rejected") {
        /* Lỗi mạng/server: giữ dữ liệu đang hiển thị thay vì xoá sạch. */
        set({ accountLoading: false });
        return;
      }

      const account = accountResult.value.account;
      if (account) {
        const lessons =
          lessonsResult.status === "fulfilled" ? lessonsResult.value : get().lessons;
        set({ account, accountLoading: false, lessons });
        saveCloudCache(account, lessons);
        return;
      }

      set({ account: null, accountLoading: false, lessons: seedLocalLessons() });
      saveCloudCache(null, []);
    },

    refreshLessons: async () => {
      const account = get().account;
      if (!account) return;
      try {
        const lessons = await fetchServerLessons(get().deviceCode);
        set({ lessons });
        saveCloudCache(account, lessons);
      } catch {
        // keep current list
      }
    },

    createAccount: async () => {
      set({ accountLoading: true });
      try {
        const { account } = await api.createAccount(get().deviceCode);
        set({ account, accountLoading: false });
        await get().refreshLessons();
        return account;
      } catch (error: any) {
        set({ accountLoading: false });
        alert(error?.message || "Không tạo được tài khoản.");
        return null;
      }
    },

    bindAccount: async (code) => {
      set({ accountLoading: true });
      try {
        const { account } = await api.bindAccount(get().deviceCode, code);
        set({ account, accountLoading: false });
        await get().refreshLessons();
        return account;
      } catch (error: any) {
        set({ accountLoading: false });
        alert(error?.message || "Không ghép được tài khoản.");
        return null;
      }
    },

    saveAiSettings: async (provider, key, model) => {
      try {
        const { account } = await api.saveAiSettings(
          get().deviceCode,
          provider,
          key,
          model
        );
        set({ account });
        return account;
      } catch (error: any) {
        alert(error?.message || "Không lưu được cấu hình AI.");
        return null;
      }
    },

    setActiveProvider: async (provider) => {
      try {
        const { account } = await api.setActiveProvider(get().deviceCode, provider);
        set({ account });
        return account;
      } catch (error: any) {
        alert(error?.message || "Không chọn được provider.");
        return null;
      }
    },

    testAi: async (provider, key, model) => {
      return api.testAi(get().deviceCode, provider, key, model);
    },

    generate: async () => {
      const { subject, topic, prompt, notes, account, deviceCode } = get();
      if (!topic.trim()) {
        alert("Vui lòng nhập chủ đề bài học.");
        return;
      }

      const fallback =
        getPreset(subject, topic) ??
        generateLesson(subject || "Chung", topic, notes);

      activeAbort?.abort();
      activeAbort = null;
      clearFallbackTimer();

      set({
        generating: true,
        generateError: null,
        view: "create",
        activeId: null,
        draft: null,
        activeTab: "lecture",
        pipeline: {
          active: true,
          stage: "analyzing",
          lecture: "pending",
          mindmap: "pending",
          interactive: "pending",
          error: null,
          startedAt: Date.now(),
        },
      });

      if (!account) {
        fallbackTimer = window.setTimeout(() => {
          fallbackTimer = null;
          set({
            draft: { analysis: null, lesson: fallback },
            activeId: "draft",
            view: "lesson",
            activeTab: "lecture",
            generating: false,
            pipeline: {
              ...get().pipeline,
              active: false,
              stage: "done",
              lecture: "done",
              mindmap: "done",
              interactive: "done",
            },
          });
        }, 900);
        return;
      }

      const controller = new AbortController();
      activeAbort = controller;

      try {
        const { analysis } = await api.analyze(
          deviceCode,
          { subject, topic, prompt, notes },
          controller.signal
        );
        patchPipeline({ stage: "generating" });

        const lectureTask = api
          .generateLecture(deviceCode, { subject, topic, analysis }, controller.signal)
          .then((result) => {
            patchPipeline({ lecture: "done" });
            return result;
          })
          .catch((error) => {
            patchPipeline({ lecture: "error" });
            throw error;
          });

        const mindmapTask = api
          .generateMindmap(deviceCode, { subject, topic, analysis }, controller.signal)
          .then((result) => {
            patchPipeline({ mindmap: "done" });
            return result;
          })
          .catch((error) => {
            patchPipeline({ mindmap: "error" });
            throw error;
          });

        const interactiveTask = api
          .generateInteractive(deviceCode, { subject, topic, analysis }, controller.signal)
          .then((result) => {
            patchPipeline({ interactive: "done" });
            return result;
          })
          .catch((error) => {
            patchPipeline({ interactive: "error" });
            throw error;
          });

        const results = await Promise.allSettled([
          lectureTask,
          mindmapTask,
          interactiveTask,
        ]);

        let lesson: Lesson = {
          ...fallback,
          subject,
          topic,
          quizSource: "fallback",
        };
        const errors: string[] = [];

        if (results[0].status === "fulfilled") {
          lesson = {
            ...lesson,
            summary: results[0].value.lecture.summary,
            blocks: results[0].value.lecture.blocks,
          };
        } else {
          errors.push(`Bài giảng: ${results[0].reason?.message || "lỗi"}`);
        }

        if (results[1].status === "fulfilled") {
          lesson = {
            ...lesson,
            artifacts: {
              ...lesson.artifacts,
              mindmap: results[1].value.artifact,
            },
          };
        } else {
          errors.push(`Sơ đồ: ${results[1].reason?.message || "lỗi"}`);
        }

        if (results[2].status === "fulfilled") {
          lesson = {
            ...lesson,
            artifacts: {
              ...lesson.artifacts,
              interactive: results[2].value.artifact,
            },
          };
        } else {
          errors.push(`Mô hình: ${results[2].reason?.message || "lỗi"}`);
        }

        set({
          draft: { analysis, lesson },
          activeId: "draft",
          view: "lesson",
          activeTab: "lecture",
          generating: false,
          generateError: errors.length ? errors.join(" · ") : null,
          pipeline: {
            ...get().pipeline,
            active: false,
            stage: "done",
            error: errors.length ? errors.join(" · ") : null,
          },
        });
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        set({
          draft: { analysis: null, lesson: fallback },
          activeId: "draft",
          view: "lesson",
          activeTab: "lecture",
          generating: false,
          generateError: error?.message || "Không gọi được AI, đã dùng bản dự phòng.",
          pipeline: {
            ...get().pipeline,
            active: false,
            stage: "error",
            lecture: "error",
            mindmap: "error",
            interactive: "error",
            error: error?.message || "Không gọi được AI.",
          },
        });
      } finally {
        if (activeAbort === controller) activeAbort = null;
      }
    },

    cancelGenerate: () => {
      activeAbort?.abort();
      activeAbort = null;
      clearFallbackTimer();
      set({
        generating: false,
        view: "create",
        pipeline: {
          ...initialPipeline,
          stage: "error",
          error: "Đã huỷ.",
        },
      });
    },

    openLesson: async (id) => {
      const state = get();
      if (state.draft) {
        const ok = confirm(
          "Bản nháp chưa lưu sẽ bị xoá khi mở bài khác. Tiếp tục?"
        );
        if (!ok) return;
      }
      set({
        activeId: id,
        view: "lesson",
        activeTab: "lecture",
        draft: null,
        lessonLoading: true,
        generateError: null,
      });

      const existing = state.lessons.find((lesson) => lesson.id === id);
      if (existing && existing.blocks.length > 0) {
        set({ lessonLoading: false });
        return;
      }

      if (!state.account) {
        set({ lessonLoading: false });
        return;
      }

      try {
        const { lesson } = await api.getLesson(state.deviceCode, id);
        const saved = normalizeSaved({ ...lesson, id });
        set((current) => ({
          lessons: current.lessons.map((item) =>
            item.id === id ? saved : item
          ),
          lessonLoading: false,
        }));
      } catch (error: any) {
        set({ lessonLoading: false });
        alert(error?.message || "Không tải được bài học.");
      }
    },

    deleteLesson: async (id) => {
      const state = get();
      if (state.account) {
        try {
          await api.deleteLesson(state.deviceCode, id);
        } catch (error: any) {
          alert(error?.message || "Không xoá được bài học.");
          return;
        }
      }
      const lessons = state.lessons.filter((lesson) => lesson.id !== id);
      if (!state.account) saveLessons(lessons);
      set({
        lessons,
        activeId: state.activeId === id ? null : state.activeId,
        view: state.activeId === id ? "library" : state.view,
      });
    },

    loadJson: (json) => {
      try {
        const parsed = JSON.parse(json);
        const lesson = normalizeLesson(parsed);
        set({
          draft: { analysis: null, lesson },
          activeId: "draft",
          view: "lesson",
          activeTab: "lecture",
          generateError: null,
        });
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: error?.message || "JSON không hợp lệ." };
      }
    },

    exportJson: () => {
      const lesson = get().activeLesson();
      return lesson ? JSON.stringify(lesson, null, 2) : "";
    },

    activeLesson: () => {
      const { draft, lessons, activeId } = get();
      if (activeId === "draft" && draft) {
        return { ...draft.lesson, id: "draft", createdAt: Date.now() };
      }
      return lessons.find((lesson) => lesson.id === activeId) ?? null;
    },

    importFile: async (file) => {
      set({ generating: true, view: "create", generateError: null });
      try {
        const { extractFile } = await import("./fileExtract");
        const text = await extractFile(file);
        const topic = file.name.replace(/\.[^.]+$/, "");
        set({
          subject: "Chung",
          topic,
          prompt: "",
          notes: text.slice(0, 12000),
          generating: false,
        });
        await get().generate();
      } catch (error: any) {
        set({ generating: false });
        alert("Không đọc được file: " + (error?.message || error));
      }
    },

    approveDraft: async () => {
      const state = get();
      const draft = state.draft;
      if (!draft) return;

      if (state.account) {
        try {
          const { lesson } = await api.saveLesson(state.deviceCode, draft.lesson);
          const saved: SavedLesson = {
            ...draft.lesson,
            id: lesson.id,
            createdAt: lesson.createdAt,
            version: lesson.version,
            sizeBytes: lesson.sizeBytes,
          };
          set({
            lessons: [saved, ...state.lessons],
            draft: null,
            activeId: saved.id,
            view: "lesson",
            activeTab: "lecture",
          });
        } catch (error: any) {
          alert(error?.message || "Không lưu được bài học lên cloud.");
        }
        return;
      }

      const saved: SavedLesson = {
        ...draft.lesson,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      const lessons = [saved, ...state.lessons];
      saveLessons(lessons);
      set({
        lessons,
        draft: null,
        activeId: saved.id,
        view: "lesson",
        activeTab: "lecture",
      });
    },

    rejectDraft: () => {
      set({
        draft: null,
        activeId: null,
        view: "library",
        activeTab: "lecture",
        generateError: null,
      });
    },

    migrateLocalLessons: async () => {
      const state = get();
      if (!state.account) {
        alert("Hãy tạo hoặc đăng nhập tài khoản trước.");
        return 0;
      }
      const local = loadLessons().map(normalizeSaved);
      if (local.length === 0) {
        alert("Không có bài học cũ trên thiết bị này.");
        return 0;
      }

      try {
        const cloud = await fetchServerLessons(state.deviceCode);
        const cloudKeys = new Set(
          cloud.map((lesson) => `${lesson.subject}|${lesson.topic}`)
        );
        const pending = local.filter(
          (lesson) => !cloudKeys.has(`${lesson.subject}|${lesson.topic}`)
        );

        if (pending.length === 0) {
          saveLessons([]);
          alert("Các bài học local đã có trên tài khoản.");
          return 0;
        }

        const { count } = await api.importLessons(state.deviceCode, pending);
        saveLessons([]);
        await get().refreshLessons();
        alert(
          count < local.length
            ? `Đã nhập ${count} bài mới, bỏ qua ${local.length - count} bài đã có trên tài khoản.`
            : `Đã nhập ${count} bài học lên tài khoản.`
        );
        return count;
      } catch (error: any) {
        alert(error?.message || "Không nhập được bài học cũ.");
        return 0;
      }
    },

    ensureQuiz: async () => {
      const state = get();
      const draft = state.draft;
      if (!draft || !state.account || state.quizLoading) return;
      if (!draft.analysis || draft.lesson.quizSource === "ai") return;

      set({ quizLoading: true });
      try {
        const { quiz } = await api.generateQuiz(state.deviceCode, {
          subject: draft.lesson.subject,
          topic: draft.lesson.topic,
          analysis: draft.analysis,
          lecture: {
            summary: draft.lesson.summary,
            blocks: draft.lesson.blocks,
          },
        });
        set((current) =>
          current.draft
            ? {
                draft: {
                  ...current.draft,
                  lesson: {
                    ...current.draft.lesson,
                    quiz,
                    quizSource: "ai",
                  },
                },
                quizLoading: false,
              }
            : { quizLoading: false }
        );
      } catch {
        set({ quizLoading: false });
      }
    },
  };
});
