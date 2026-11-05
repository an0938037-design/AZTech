import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowUpRight,
  Atom,
  ChevronRight,
  Cloud,
  Database,
  Library,
  LibraryBig,
  NotebookPen,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "../store";
import type { View } from "../store";
import type { SavedLesson } from "../storage";
import { subjectAccent, subjectCode } from "../subjects";

interface Props {
  open: boolean;
  onClose: () => void;
}

function lessonIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

interface NavRow {
  view: View;
  label: string;
  icon: typeof Sun;
}

const GROUPS: { title: string; rows: NavRow[] }[] = [
  {
    title: "Học tập",
    rows: [
      { view: "home", label: "TRANG CHỦ", icon: Sun },
      { view: "library", label: "THƯ VIỆN", icon: LibraryBig },
      { view: "study", label: "GHI CHÚ", icon: NotebookPen },
    ],
  },
  {
    title: "Mô phỏng & đánh giá",
    rows: [
      { view: "sim", label: "MÔ PHỎNG", icon: Atom },
      { view: "assess", label: "KIỂM TRA ĐÁNH GIÁ", icon: ShieldCheck },
    ],
  },
  {
    title: "Hệ thống",
    rows: [{ view: "settings", label: "CÀI ĐẶT", icon: SettingsIcon }],
  },
];

const LAB_VIEWS: View[] = ["geometry", "lab", "arduino", "vanlab"];

export default function Sidebar({ open, onClose }: Props) {
  const lessons = useStore((s) => s.lessons);
  const activeId = useStore((s) => s.activeId);
  const account = useStore((s) => s.account);
  const view = useStore((s) => s.view);
  const openLesson = useStore((s) => s.openLesson);
  const deleteLesson = useStore((s) => s.deleteLesson);
  const setView = useStore((s) => s.setView);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      document.querySelector(".app-shell")?.classList.toggle("is-collapsed", next);
      return next;
    });
  };

  // Mở drawer trên mobile thì luôn mở rộng thanh bên
  useEffect(() => {
    if (open) setSidebarCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    document.querySelector(".app-shell")?.classList.toggle("is-collapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lessons;
    return lessons.filter(
      (lesson) =>
        lesson.subject.toLowerCase().includes(query) ||
        lesson.topic.toLowerCase().includes(query)
    );
  }, [lessons, search]);

  const grouped = useMemo(() => {
    const result: Record<string, SavedLesson[]> = {};
    for (const lesson of filtered) {
      (result[lesson.subject] ??= []).push(lesson);
    }
    return result;
  }, [filtered]);

  const subjects = useMemo(
    () => Object.keys(grouped).sort((a, b) => a.localeCompare(b, "vi")),
    [grouped]
  );

  const toggle = (subject: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  const handleOpen = (id: string) => {
    void openLesson(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xoá bài học này?")) return;
    await deleteLesson(id);
  };

  const go = (next: View) => {
    setView(next);
    onClose();
  };

  const isActive = (row: View) => row === view || (row === "sim" && LAB_VIEWS.includes(view));

  return (
    <>
      <aside
        className={`sidebar ${open ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}
      >
        <div className="sidebar-brand">
          <button
            type="button"
            className="brand-mark"
            onClick={() => {
              if (open) onClose();
              else toggleSidebarCollapse();
            }}
            aria-label={
              open
                ? "Đóng thanh điều hướng"
                : sidebarCollapsed
                  ? "Mở thanh điều hướng"
                  : "Thu gọn thanh điều hướng"
            }
            title={open ? "Đóng" : sidebarCollapsed ? "Mở" : "Thu gọn"}
          >
            {open ? <X size={18} /> : "AI"}
          </button>
          <div className="brand-copy">
            <strong>LEARNING ENGINE</strong>
            <span>PIPELINE 3 TẦNG · V2</span>
          </div>
        </div>

        <button type="button" className="btn btn-primary sidebar-new" onClick={() => go("create")}>
          <Plus size={15} /> BÀI HỌC MỚI
        </button>

        <nav className="sidebar-nav">
          {GROUPS.map((group) => (
            <div className="sidebar-group" key={group.title}>
              <p className="sidebar-group-label">{group.title}</p>
              {group.rows.map((row) => {
                const Icon = row.icon;
                const active = isActive(row.view);
                return (
                  <button
                    key={row.view}
                    type="button"
                    className={`sidebar-nav-item ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(row.view)}
                  >
                    <Icon size={14} />
                    <span>{row.label}</span>
                    <ChevronRight size={13} className="sidebar-nav-arrow" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <label className="search-box">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm môn hoặc chủ đề…"
            aria-label="Tìm bài học"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label="Xoá tìm kiếm"
            >
              ×
            </button>
          )}
        </label>

        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <span>THƯ VIỆN</span>
            <span>{lessons.length}</span>
          </div>
          <div className="sidebar-list">
            {subjects.length === 0 && (
              <div className="sidebar-empty">
                <Library size={20} />
                <p>{search ? "Không tìm thấy bài học." : "Chưa có bài học nào."}</p>
              </div>
            )}

            {subjects.map((subject) => {
              const items = grouped[subject] ?? [];
              const isOpen = !collapsed.has(subject) || Boolean(search);
              return (
                <div
                  className="subject-group"
                  key={subject}
                  style={{ "--subject-accent": subjectAccent(subject) } as CSSProperties}
                >
                  <button
                    type="button"
                    className="subject-row"
                    onClick={() => toggle(subject)}
                    aria-expanded={isOpen}
                  >
                    <ChevronRight size={13} className={isOpen ? "rotate" : ""} />
                    <span className="subject-code">{subjectCode(subject)}</span>
                    <span className="subject-name">{subject}</span>
                    <span className="subject-count">{items.length}</span>
                  </button>

                  {isOpen && (
                    <div className="lesson-list">
                      {items.map((lesson, index) => (
                        <div
                          className={`lesson-row ${activeId === lesson.id ? "is-active" : ""}`}
                          key={lesson.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpen(lesson.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpen(lesson.id);
                            }
                          }}
                        >
                          <span className="lesson-index">{lessonIndex(index)}</span>
                          <span className="lesson-copy">
                            <strong>{lesson.topic}</strong>
                            <span>{lesson.summary || "Chưa có tóm tắt"}</span>
                          </span>
                          <button
                            type="button"
                            className="lesson-delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(lesson.id);
                            }}
                            aria-label={`Xoá ${lesson.topic}`}
                            title="Xoá bài học"
                          >
                            <Trash size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          <button type="button" className="account-mini" onClick={() => go("settings")}>
            <span className="account-avatar">
              {account ? account.code.slice(0, 2) : <SettingsIcon size={13} />}
            </span>
            <span className="account-mini-copy">
              <span className="kicker">CÀI ĐẶT</span>
              <strong>{account ? `Tài khoản ${account.code}` : "Chưa kết nối cloud"}</strong>
            </span>
            {account ? <Cloud size={14} /> : <WifiOff size={14} />}
            <ArrowUpRight size={13} className="account-arrow" />
          </button>
          <p className="sidebar-note">
            <Database size={10} />
            {account ? " Đồng bộ Supabase" : " Lưu cục bộ trên máy"}
          </p>
        </div>
      </aside>

      {sidebarCollapsed && (
        <button
          type="button"
          className="sidebar-logo-btn"
          onClick={toggleSidebarCollapse}
          aria-label="Mở thanh điều hướng"
        >
          AI
        </button>
      )}
    </>
  );
}
