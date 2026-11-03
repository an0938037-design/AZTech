import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Cloud, Search, WifiOff } from "lucide-react";
import { useStore } from "../store";
import type { SavedLesson } from "../storage";

export default function Library() {
  const lessons = useStore((s) => s.lessons);
  const account = useStore((s) => s.account);
  const setView = useStore((s) => s.setView);
  const openLesson = useStore((s) => s.openLesson);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const subjects = useMemo(() => {
    const set = new Set(lessons.map((l) => l.subject));
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "vi"))];
  }, [lessons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((lesson) => {
      if (subjectFilter !== "all" && lesson.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        lesson.subject.toLowerCase().includes(q) ||
        lesson.topic.toLowerCase().includes(q) ||
        (lesson.summary || "").toLowerCase().includes(q)
      );
    });
  }, [lessons, query, subjectFilter]);

  const grouped = useMemo(() => {
    const result: Record<string, SavedLesson[]> = {};
    for (const lesson of filtered) {
      (result[lesson.subject] ??= []).push(lesson);
    }
    return result;
  }, [filtered]);

  const groupKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "vi"));

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <span className="kicker">THƯ VIỆN</span>
          <h1>Bài học đã lưu</h1>
        </div>
        <div className="library-account">
          {account ? <Cloud size={13} /> : <WifiOff size={13} />}
          <span>{account ? `CLOUD · ${account.code}` : "LOCAL"}</span>
        </div>
      </header>

      <div className="library-toolbar">
        <label className="search-box">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm môn hoặc chủ đề…"
            aria-label="Tìm bài học"
          />
        </label>
        <select
          className="filter-select"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Lọc theo môn"
        >
          {subjects.map((s) => (
            <option value={s} key={s}>
              {s === "all" ? "Tất cả môn" : s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-panel">
          <BookOpen size={20} />
          <p>Không có bài học nào khớp. Tạo bài mới để bắt đầu.</p>
          <button type="button" className="btn btn-primary" onClick={() => setView("create")}>
            TẠO BÀI HỌC
          </button>
        </div>
      ) : (
        <div className="library-groups">
          {groupKeys.map((subject) => (
            <section className="library-group" key={subject}>
              <div className="library-group-head">
                <span>{subject}</span>
                <span>{grouped[subject].length}</span>
              </div>
              <div className="library-list">
                {grouped[subject].map((lesson) => (
                  <button
                    type="button"
                    className="library-row"
                    key={lesson.id}
                    onClick={() => void openLesson(lesson.id)}
                  >
                    <span className="library-index">{lesson.id.slice(0, 4)}</span>
                    <span className="library-copy">
                      <strong>{lesson.topic}</strong>
                      <span>{lesson.summary || "Chưa có tóm tắt"}</span>
                    </span>
                    <span className="library-meta">
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
