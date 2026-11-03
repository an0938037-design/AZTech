import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  Download,
  Network,
  SlidersHorizontal,
  Trash,
} from "lucide-react";
import { useStore } from "../store";
import LectureView from "./LectureView";
import MindmapView from "./MindmapView";
import InteractiveView from "./InteractiveView";
import QuizView from "./QuizView";
import ReviewBar from "./ReviewBar";

const TABS = [
  { id: "lecture", label: "Bài giảng", icon: BookOpen },
  { id: "mindmap", label: "Sơ đồ tư duy", icon: Network },
  { id: "interactive", label: "Mô hình tương tác", icon: SlidersHorizontal },
  { id: "quiz", label: "Kiểm tra", icon: CircleCheck },
] as const;

export default function LessonViewer() {
  const lessons = useStore((s) => s.lessons);
  const activeId = useStore((s) => s.activeId);
  const activeTab = useStore((s) => s.activeTab);
  const draft = useStore((s) => s.draft);
  const account = useStore((s) => s.account);
  const lessonLoading = useStore((s) => s.lessonLoading);
  const generateError = useStore((s) => s.generateError);
  const setView = useStore((s) => s.setView);
  const setTab = useStore((s) => s.setTab);
  const deleteLesson = useStore((s) => s.deleteLesson);
  const exportJson = useStore((s) => s.exportJson);
  const ensureQuiz = useStore((s) => s.ensureQuiz);
  const approveDraft = useStore((s) => s.approveDraft);
  const rejectDraft = useStore((s) => s.rejectDraft);

  const lesson = useMemo(() => {
    if (activeId === "draft" && draft) {
      return { ...draft.lesson, id: "draft", createdAt: 0 };
    }
    return lessons.find((item) => item.id === activeId) ?? null;
  }, [activeId, draft, lessons]);

  const isDraft = activeId === "draft" && Boolean(draft);

  useEffect(() => {
    if (isDraft && activeTab === "quiz") void ensureQuiz();
  }, [isDraft, activeTab, ensureQuiz]);

  if (lessonLoading) {
    return (
      <div className="lesson-loading">
        <span className="loading-line">ĐANG TẢI BÀI HỌC…</span>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="empty-state">
        <BookOpen size={28} />
        <h2>Không tìm thấy bài học</h2>
        <p>Bài học có thể đã bị xoá hoặc chưa được tải.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setView("library")}
        >
          <ArrowLeft size={14} /> VỀ THƯ VIỆN
        </button>
      </div>
    );
  }

  const handleExport = () => {
    const json = exportJson();
    if (!json) return;
    const safeName = `${lesson.topic || "bai-hoc"}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName || "bai-hoc"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xoá bài học “${lesson.topic}”?`)) return;
    await deleteLesson(lesson.id);
  };

  const tabState = {
    lecture: (lesson.blocks?.length ?? 0) > 0,
    mindmap: lesson.artifacts?.mindmap?.kind === "mindmap",
    interactive: lesson.artifacts?.interactive?.kind === "interactive",
    quiz: (lesson.quiz?.length ?? 0) > 0,
  };

  return (
    <div className="lesson-viewer">
      <header className="lesson-header">
        <div className="lesson-breadcrumb">
          <button
            type="button"
            className="text-btn"
            onClick={() => setView("library")}
          >
            <ArrowLeft size={12} /> THƯ VIỆN
          </button>
          <span>/</span>
          <span>{lesson.subject}</span>
        </div>

        <div className="lesson-title-row">
          <div className="lesson-title-copy">
            <div className="lesson-title-kicker">
              <span className="kicker">
                {isDraft ? "BẢN NHÁP · CHƯA LƯU" : "BÀI HỌC ĐÃ LƯU"}
              </span>
              <span className={`status-pill ${account ? "is-cloud" : ""}`}>
                {isDraft
                  ? "RAM"
                  : account
                    ? "CLOUD"
                    : "LOCAL"}
              </span>
            </div>
            <h1>{lesson.topic}</h1>
            <p>{lesson.summary || "Chưa có tóm tắt cho bài học này."}</p>
          </div>

          <div className="lesson-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleExport}
            >
              <Download size={14} /> XUẤT JSON
            </button>
            {!isDraft && (
              <button
                type="button"
                className="btn btn-ghost btn-sm danger"
                onClick={() => void handleDelete()}
              >
                <Trash size={14} /> XOÁ
              </button>
            )}
          </div>
        </div>

        <nav className="lesson-tabs" role="tablist" aria-label="Nội dung bài học">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                key={tab.id}
                className={`lesson-tab ${active ? "is-active" : ""}`}
                onClick={() => setTab(tab.id)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <i
                  className={`tab-dot ${
                    tabState[tab.id] ? "is-on" : "is-off"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </nav>
      </header>

      {isDraft && (
        <ReviewBar
          hasAccount={Boolean(account)}
          error={generateError}
          onKeep={approveDraft}
          onDiscard={rejectDraft}
        />
      )}

      <main className="lesson-content">
        {activeTab === "lecture" && <LectureView lesson={lesson} />}
        {activeTab === "mindmap" && <MindmapView lesson={lesson} />}
        {activeTab === "interactive" && <InteractiveView lesson={lesson} />}
        {activeTab === "quiz" && <QuizView lesson={lesson} key={lesson.id} />}
      </main>
    </div>
  );
}
