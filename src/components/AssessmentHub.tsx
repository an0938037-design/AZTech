import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Search, ShieldCheck, X } from "lucide-react";
import { useStore } from "../store";
import { subjectAccent } from "../subjects";
import { fold } from "../subjects";

export default function AssessmentHub() {
  const lessons = useStore((s) => s.lessons);
  const account = useStore((s) => s.account);
  const openLesson = useStore((s) => s.openLesson);
  const setTab = useStore((s) => s.setTab);
  const setView = useStore((s) => s.setView);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const key = fold(query);
    return lessons
      .filter((lesson) => (lesson.quiz?.length ?? 0) > 0)
      .filter(
        (lesson) =>
          !key ||
          fold(lesson.topic).includes(key) ||
          fold(lesson.subject).includes(key)
      )
      .sort((a, b) => a.subject.localeCompare(b.subject, "vi"));
  }, [lessons, query]);

  const totalQuestions = rows.reduce((sum, lesson) => sum + (lesson.quiz?.length ?? 0), 0);
  const subjectCount = new Set(rows.map((lesson) => lesson.subject)).size;

  const start = (id: string) => {
    void openLesson(id).then(() => setTab("quiz"));
  };

  return (
    <div className="assess-page">
      <header className="page-head">
        <div className="page-head-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView("home")}
            aria-label="Về trang chủ"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <span className="kicker">VÀNH ĐAI TIỂU HÀNH TINH</span>
            <h1>Kiểm tra đánh giá</h1>
          </div>
        </div>
        <div className="page-head-meta">
          <span className={`status-pill ${account ? "is-cloud" : ""}`}>
            <ShieldCheck size={12} />
            {account ? "CLOUD" : "LOCAL"}
          </span>
        </div>
      </header>

      <div className="assess-body">
        <div className="stat-strip">
          <div className="stat-cell">
            <span className="stat-value">{String(rows.length).padStart(2, "0")}</span>
            <span className="stat-label">BÀI CÓ NGÂN HÀNG CÂU</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value">{String(totalQuestions).padStart(2, "0")}</span>
            <span className="stat-label">TỔNG SỐ CÂU HỎI</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value">{String(subjectCount).padStart(2, "0")}</span>
            <span className="stat-label">MÔN ĐÃ CÓ ĐÁNH GIÁ</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value">03</span>
            <span className="stat-label">CHẾ ĐỘ: LUYỆN · THI · SỬA</span>
          </div>
        </div>

        <div className="library-toolbar">
          <label className="search-box">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo môn hoặc chủ đề…"
              aria-label="Tìm bài kiểm tra"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery("")}
                aria-label="Xoá tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </label>
          <span className="library-result-count" aria-live="polite">
            {rows.length}/{lessons.length} bài có đánh giá
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="empty-panel">
            <ClipboardList size={20} />
            <p>
              {lessons.length === 0
                ? "Vành đai còn trống. Tạo bài học đầu tiên để hệ thống sinh ngân hàng câu hỏi."
                : "Chưa bài học nào có ngân hàng câu hỏi. Mở một bài rồi chọn tab Luyện tập để tạo đề."}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setView("create")}>
              TẠO BÀI HỌC
            </button>
          </div>
        ) : (
          <div className="assess-list">
            {rows.map((lesson) => {
              const accent = subjectAccent(lesson.subject);
              return (
                <div className="assess-row" key={lesson.id}>
                  <span
                    className="assess-dot"
                    aria-hidden="true"
                    style={{ background: accent, boxShadow: `0 0 10px -2px ${accent}` }}
                  />
                  <div className="assess-copy">
                    <strong>{lesson.topic}</strong>
                    <span>
                      {lesson.subject} · {lesson.quiz.length} câu hỏi
                      {lesson.quizSource === "ai" ? " · đề AI" : " · đề nền"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => start(lesson.id)}
                  >
                    LÀM BÀI KIỂM TRA
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
