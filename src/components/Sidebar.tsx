import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Box,
  ChevronRight,
  Cloud,
  Cpu,
  FlaskConical,
  Library,
  LibraryBig,
  NotebookPen,
  Plus,
  Search,
  Sun,
  Trash,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "../store";
import type { SavedLesson } from "../storage";
import { subjectCode, subjectAccent } from "../subjects";
import type { CSSProperties } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function lessonIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

const PALETTES = [
  { id: "1", name: "Sao Thuỷ", bg: "#F6F5F2", primary: "#3C3A38", accent: "#6E6862" },
  { id: "2", name: "Sao Kim", bg: "#FAF3E7", primary: "#574231", accent: "#9A6B38" },
  { id: "3", name: "Trái Đất", bg: "#EDF6F4", primary: "#123F38", accent: "#1F7A57" },
  { id: "4", name: "Sao Hoả", bg: "#FAF0E9", primary: "#4E2616", accent: "#A64C22" },
  { id: "5", name: "Sao Mộc", bg: "#F8F1E7", primary: "#42301F", accent: "#8F6132" },
  { id: "6", name: "Sao Thổ", bg: "#FAF6EA", primary: "#4A4023", accent: "#8A7638" },
  { id: "7", name: "Sao Thiên Vương", bg: "#EEF9F8", primary: "#123F41", accent: "#1E7A80" },
  { id: "8", name: "Sao Hải Vương", bg: "#EEF1FB", primary: "#101F42", accent: "#2F4CC4" },
  { id: "9", name: "Mặt Trời", bg: "#FFF9E6", primary: "#3F2B07", accent: "#B45309" },
  { id: "10", name: "Tinh Vân", bg: "#0a0a1a", primary: "#c4b5fd", accent: "#7c3aed" },
];

const shade = (hex: string, amount: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

// Trộn màu mực với nền để tạo các tầng chữ nhưng vẫn giữ tương phản.
const mixHex = (hex: string, base: string, amount: number) => {
  const a = parseInt(hex.replace("#", ""), 16);
  const b = parseInt(base.replace("#", ""), 16);
  const channels = [16, 8, 0].map((shift) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * amount);
  });
  return `#${channels
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

const applyPalette = (pal: (typeof PALETTES)[number], isDark: boolean) => {
  const root = document.documentElement;
  root.setAttribute("data-palette", pal.id);
  if (isDark) {
    if (pal.id === "10") {
      // Tinh Vân: nền tối sâu, mực lavender, accent violet + cyan
      root.style.setProperty("--bg", "#05060f");
      root.style.setProperty("--bg-raised", "#0b0c1a");
      root.style.setProperty("--bg-hover", "#12142a");
      root.style.setProperty("--bg-active", "#191c38");
      root.style.setProperty("--line", "#262a4d");
      root.style.setProperty("--line-strong", "#3d4370");
      root.style.setProperty("--line-soft", "#171a33");
      root.style.setProperty("--ink", "#ece9ff");
      root.style.setProperty("--ink-2", "#cfc9f5");
      root.style.setProperty("--ink-3", "#a49dd4");
      root.style.setProperty("--ink-4", "#7a73ab");
      root.style.setProperty("--ink-5", "#565080");
      root.style.setProperty("--accent", "#8b5cf6");
      root.style.setProperty("--accent-2", "#22d3ee");
    } else {
      // Dark mode: swap primary↔accent, soft dark base (no pure black)
      root.style.setProperty("--bg", "#1a1a24");
      root.style.setProperty("--bg-raised", "#22222e");
      root.style.setProperty("--bg-hover", "#2a2a38");
      root.style.setProperty("--bg-active", "#32323e");
      root.style.setProperty("--line", "#3a3a4a");
      root.style.setProperty("--line-strong", "#4a4a5a");
      root.style.setProperty("--line-soft", "#252530");
      root.style.setProperty("--ink", shade(pal.accent, 110));
      root.style.setProperty("--ink-2", shade(pal.accent, 95));
      root.style.setProperty("--ink-3", shade(pal.accent, 80));
      root.style.setProperty("--ink-4", shade(pal.accent, 62));
      root.style.setProperty("--ink-5", shade(pal.accent, 45));
      root.style.setProperty("--accent", shade(pal.primary, 100));
      root.style.setProperty("--accent-2", shade(pal.accent, 90));
    }
  } else {
    if (pal.id === "10") {
      // Tinh Vân — phiên bản ban ngày: nền sương tím, mực tím than, accent violet
      root.style.setProperty("--bg", "#eef0ff");
      root.style.setProperty("--bg-raised", "#e4e6fb");
      root.style.setProperty("--bg-hover", "#d9dcf6");
      root.style.setProperty("--bg-active", "#cbcfef");
      root.style.setProperty("--line", "#c3c7e8");
      root.style.setProperty("--line-strong", "#9ea4d0");
      root.style.setProperty("--line-soft", "#dcdef4");
      root.style.setProperty("--ink", "#241f4d");
      root.style.setProperty("--ink-2", "#332e5e");
      root.style.setProperty("--ink-3", "#4a4378");
      root.style.setProperty("--ink-4", "#5f5988");
      root.style.setProperty("--ink-5", "#7d76a8");
      root.style.setProperty("--accent", "#6d4aff");
      root.style.setProperty("--accent-2", "#0891b2");
      return;
    }
    root.style.setProperty("--bg", pal.bg);
    root.style.setProperty("--bg-raised", shade(pal.bg, -8));
    root.style.setProperty("--bg-hover", shade(pal.bg, -16));
    root.style.setProperty("--bg-active", shade(pal.bg, -24));
    root.style.setProperty("--line", shade(pal.bg, -40));
    root.style.setProperty("--line-strong", shade(pal.bg, -80));
    root.style.setProperty("--line-soft", shade(pal.bg, -20));
    root.style.setProperty("--ink", pal.primary);
    root.style.setProperty("--ink-2", mixHex(pal.primary, pal.bg, 0.05));
    root.style.setProperty("--ink-3", mixHex(pal.primary, pal.bg, 0.08));
    root.style.setProperty("--ink-4", mixHex(pal.primary, pal.bg, 0.2));
    root.style.setProperty("--ink-5", mixHex(pal.primary, pal.bg, 0.3));
    root.style.setProperty("--accent", pal.accent);
    root.style.setProperty("--accent-2", pal.primary);
  }
};

export default function Sidebar({ open, onClose }: Props) {
  const lessons = useStore((s) => s.lessons);
  const activeId = useStore((s) => s.activeId);
  const account = useStore((s) => s.account);
  const view = useStore((s) => s.view);
  const openLesson = useStore((s) => s.openLesson);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const [palette, setPalette] = useState(() => {
    try {
      return localStorage.getItem("palette") || "1";
    } catch {
      return "1";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
    const pal = PALETTES.find((p) => p.id === palette) || PALETTES[0];
    applyPalette(pal, theme === "dark");
  }, [theme, palette]);

  useEffect(() => {
    try {
      localStorage.setItem("palette", palette);
    } catch {
      // ignore
    }
  }, [palette]);

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

  // Apply collapsed class on mount
  useEffect(() => {
    document.querySelector(".app-shell")?.classList.toggle("is-collapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);
  const deleteLesson = useStore((s) => s.deleteLesson);
  const setView = useStore((s) => s.setView);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  return (
    <>
      <aside className={`sidebar ${open ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <button
            type="button"
            className="brand-mark"
            onClick={() => {
              if (open) onClose();
              else toggleSidebarCollapse();
            }}
            aria-label={open ? "Đóng thanh điều hướng" : sidebarCollapsed ? "Mở thanh điều hướng" : "Thu gọn thanh điều hướng"}
            title={open ? "Đóng" : sidebarCollapsed ? "Mở" : "Thu gọn"}
          >
            {open ? <X size={18} /> : "AI"}
          </button>
          <div className="brand-copy">
            <strong>LEARNING ENGINE</strong>
            <span>PIPELINE 3 TẦNG · V2</span>
          </div>
        </div>

      <button
        type="button"
        className="btn btn-primary sidebar-new"
        onClick={() => {
          setView("create");
          onClose();
        }}
      >
        <Plus size={15} /> BÀI HỌC MỚI
      </button>

      <div className="sidebar-nav">
        <button
          type="button"
          className={`sidebar-nav-item ${view === "home" ? "is-active" : ""}`}
          onClick={() => {
            setView("home");
            onClose();
          }}
        >
          <Sun size={14} />
          <span>TRANG CHỦ</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "library" ? "is-active" : ""}`}
          onClick={() => {
            setView("library");
            onClose();
          }}
        >
          <LibraryBig size={14} />
          <span>THƯ VIỆN</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "study" ? "is-active" : ""}`}
          onClick={() => {
            setView("study");
            onClose();
          }}
        >
          <NotebookPen size={14} />
          <span>GHI CHÚ</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "geometry" ? "is-active" : ""}`}
          onClick={() => {
            setView("geometry");
            onClose();
          }}
        >
          <Box size={14} />
          <span>HÌNH HỌC 3D</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "lab" ? "is-active" : ""}`}
          onClick={() => {
            setView("lab");
            onClose();
          }}
        >
          <FlaskConical size={14} />
          <span>PHÒNG LAB 3D</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "arduino" ? "is-active" : ""}`}
          onClick={() => {
            setView("arduino");
            onClose();
          }}
        >
          <Cpu size={14} />
          <span>ARDUINO</span>
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${view === "account" ? "is-active" : ""}`}
          onClick={() => {
            setView("account");
            onClose();
          }}
        >
          <Cloud size={14} />
          <span>TÀI KHOẢN</span>
        </button>
        <button
          type="button"
          className="sidebar-nav-item"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "☀" : "☾"}
          <span>{theme === "dark" ? "CHẾ ĐỘ SÁNG" : "CHẾ ĐỘ TỐI"}</span>
        </button>
        <select
          className="palette-select"
          value={palette}
          onChange={(e) => setPalette(e.target.value)}
          aria-label="Chọn bộ màu"
        >
          {PALETTES.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

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
                  <ChevronRight
                    size={13}
                    className={isOpen ? "rotate" : ""}
                  />
                  <span className="subject-code">{subjectCode(subject)}</span>
                  <span className="subject-name">{subject}</span>
                  <span className="subject-count">{items.length}</span>
                </button>

                {isOpen && (
                  <div className="lesson-list">
                    {items.map((lesson, index) => (
                      <div
                        className={`lesson-row ${
                          activeId === lesson.id ? "is-active" : ""
                        }`}
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
                        <span className="lesson-index">
                          {lessonIndex(index)}
                        </span>
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
        <button
          type="button"
          className="account-mini"
          onClick={() => {
            setView("account");
            onClose();
          }}
        >
          <span className="account-avatar">
            {account ? account.code.slice(0, 2) : "OF"}
          </span>
          <span className="account-mini-copy">
            <span className="kicker">
              {account ? "TÀI KHOẢN CLOUD" : "CHẾ ĐỘ CỤC BỘ"}
            </span>
            <strong>{account ? account.code : "Chưa kết nối"}</strong>
          </span>
          {account ? <Cloud size={14} /> : <WifiOff size={14} />}
          <ArrowUpRight size={13} className="account-arrow" />
        </button>


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
