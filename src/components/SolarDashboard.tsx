import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ChevronDown,
  ChevronRight,
  House,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { fold } from "../subjects";
import {
  chapterById,
  markStationVisited,
  percent,
  PLANET_ACCENT,
  planetById,
  solarModel,
  SYSTEM_FOCUS,
  type SolarChapter,
  type SolarFocus,
  type SolarStation,
} from "../solar";
import SolarSystem, { type SolarHover } from "./SolarSystem";
import { SIM_WORLDS, type SimWorld } from "../worlds";

function levelLabel(level: SolarFocus["level"]): string {
  if (level === "planet") return "HÀNH TINH";
  if (level === "chapter") return "CHƯƠNG HỌC";
  if (level === "world") return "THẾ GIỚI MÔ PHỎNG";
  return "HỆ MẶT TRỜI";
}

function short(text: string, max = 44): string {
  const clean = String(text || "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default function SolarDashboard({ ambient = false }: { ambient?: boolean }) {
  const lessons = useStore((s) => s.lessons);
  const focus = useStore((s) => s.solarFocus);
  const setSolarFocus = useStore((s) => s.setSolarFocus);
  const sceneFocus = ambient ? SYSTEM_FOCUS : focus;
  const setView = useStore((s) => s.setView);
  const setSceneFade = useStore((s) => s.setSceneFade);
  const setField = useStore((s) => s.setField);
  const setTab = useStore((s) => s.setTab);
  const openLesson = useStore((s) => s.openLesson);

  const [progressRev, setProgressRev] = useState(0);
  const [hover, setHover] = useState<SolarHover | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInset, setPanelInset] = useState(0);
  const [panelInsetY, setPanelInsetY] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAiOpen(false);
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (aiOpen) aiInputRef.current?.focus();
  }, [aiOpen]);

  const model = useMemo(() => {
    void progressRev;
    return solarModel(lessons);
  }, [lessons, progressRev]);

  useEffect(() => {
    const compute = () => {
      const page = pageRef.current;
      const panel = page?.querySelector(".solar-side") as HTMLElement | null;
      const desktop = window.matchMedia("(min-width: 901px)").matches;
      const needed = !ambient && panelOpen && focus.level !== "system";
      if (!page || !panel || !needed) {
        setPanelInset(0);
        setPanelInsetY(0);
        return;
      }
      const pageRect = page.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      if (desktop) {
        setPanelInset(Math.max(0, Math.round(panelRect.right - pageRect.left + 16)));
        setPanelInsetY(0);
      } else {
        setPanelInset(0);
        setPanelInsetY(Math.max(0, Math.round(pageRect.bottom - panelRect.top + 8)));
      }
    };
    compute();
    const timer = window.setTimeout(compute, 80);
    window.addEventListener("resize", compute);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", compute);
    };
  }, [focus.level, query, panelOpen, ambient]);
  const planet = planetById(model, focus.planetId);
  const chapter = chapterById(model, focus.planetId, focus.chapterId);
  const world =
    focus.level === "world" && focus.worldId
      ? SIM_WORLDS.find((item) => item.id === focus.worldId) ?? null
      : null;
  const panelAccent = world
    ? world.color
    : planet
      ? PLANET_ACCENT[planet.spec.id]
      : "#9fb4d8";
  const hoverAccent = hover?.planetId ? PLANET_ACCENT[hover.planetId] : null;
  const onReady = useCallback(() => setReady(true), []);
  const onFallback = useCallback(() => setFallback(true), []);

  useEffect(() => {
    setPanelOpen(focus.level !== "system");
    setQuery("");
  }, [focus]);

  const go = (next: SolarFocus) => {
    setSolarFocus(next);
    setAiOpen(false);
  };

  const scrollToWelcome = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(".home-welcome")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const goSystem = () => go({ level: "system", planetId: null, chapterId: null });
  const goPlanet = (planetId: SolarFocus["planetId"]) => go({ level: "planet", planetId, chapterId: null });

  const openStation = (target: SolarChapter, station: SolarStation) => {
    markStationVisited(target.lessonId, station.id);
    setProgressRev((value) => value + 1);
    void openLesson(target.lessonId).then(() => setTab(station.tab));
  };

  const openChapterLesson = (target: SolarChapter) => {
    const station = target.stations[0];
    if (station) openStation(target, station);
    else void openLesson(target.lessonId);
  };

  const createForPlanet = (subject?: string) => {
    if (subject) setField("subject", subject);
    setField("topic", "");
    setView("create");
  };

  const assessCount = useMemo(
    () => lessons.filter((lesson) => (lesson.quiz?.length ?? 0) > 0).length,
    [lessons]
  );

  /* Phóng vào hành tinh phòng lab trước, rồi mờ dần sang phòng mô phỏng. */
  const enterWorld = (target: SimWorld) => {
    setAiOpen(false);
    setSceneFade(true);
    window.setTimeout(() => {
      setView(target.view);
      window.setTimeout(() => setSceneFade(false), 80);
    }, 420);
  };

  const askAi = () => {
    const text =
      aiText.trim() ||
      (chapter
        ? `Hướng dẫn học chương "${chapter.title}"${planet ? ` môn ${planet.subjectLabel}` : ""}`
        : "Gợi ý lộ trình học tiếp theo dựa trên tiến độ của tôi");
    if (planet) setField("subject", planet.subjects[0] ?? "Toán");
    setField("prompt", text);
    setView("create");
  };

  const liveHover = hover;

  const suggestions = useMemo(() => {
    const rows = model.planets.flatMap((item) =>
      item.chapters
        .filter((entry) => !entry.done)
        .map((entry) => ({ planet: item, chapter: entry }))
    );
    return rows.slice(0, 4);
  }, [model]);

  const searchResults = useMemo(() => {
    const key = fold(query);
    if (!key) return null;
    const planets = model.planets.filter(
      (item) =>
        fold(item.spec.name).includes(key) ||
        fold(item.spec.latin).includes(key) ||
        fold(item.subjectLabel).includes(key) ||
        item.subjects.some((subject) => fold(subject).includes(key))
    );
    const chapters = model.planets.flatMap((item) =>
      item.chapters
        .filter((entry) => fold(entry.title).includes(key) || fold(item.spec.name).includes(key))
        .map((entry) => ({ planet: item, chapter: entry }))
    );
    return { planets, chapters: chapters.slice(0, 10) };
  }, [model, query]);

  const breadcrumbPlanet = focus.planetId ? planet : null;

  const noop = useCallback(() => undefined, []);
  const noopReady = useCallback(() => undefined, []);
  const noopFallback = useCallback(() => undefined, []);

  return (
    <div className={`solar-page level-${focus.level}${ambient ? " is-ambient" : ""}`} ref={pageRef} aria-hidden={ambient}>
      <div className="solar-stage">
        <SolarSystem
          model={model}
          ambient={ambient}
          focus={sceneFocus}
          inset={panelInset}
          insetY={panelInsetY}
          onFocus={ambient ? noop : go}
          onHover={ambient ? noop : setHover}
          onOpenStation={ambient ? noop : openStation}
          onOpenSun={ambient ? noop : () => setAiOpen(true)}
          onOpenBelt={ambient ? noop : () => setView("assess")}
          onReady={ambient ? noopReady : onReady}
          onFallback={ambient ? noopFallback : onFallback}
        />

        {!ambient && !ready && !fallback && (
          <div className="solar-boot">
            <span className="solar-boot-dot" />
            <b>ĐANG DỰNG HỆ MẶT TRỜI</b>
            <em>8 hành tinh · {model.chapters} chương · {model.stations} trạm học</em>
          </div>
        )}

        {!ambient && fallback && (
          <div className="solar-fallback">
            <span className="solar-eyebrow">CHẾ ĐỘ KHÔNG GIAN 2D</span>
            <h2>WEBGL KHÔNG KHẢ DỤNG</h2>
            <p>
              Thiết bị hoặc trình duyệt hiện tại không chạy được cảnh 3D. Toàn bộ nội dung học tập
              vẫn truy cập được từ danh sách bên dưới.
            </p>
            <div className="solar-fallback-grid">
              {model.planets.map((item) => (
                <button
                  key={item.spec.id}
                  type="button"
                  className="solar-fallback-planet"
                  onClick={() => goPlanet(item.spec.id)}
                >
                  <span>{String(item.spec.order).padStart(2, "0")}</span>
                  <b>{item.spec.name}</b>
                  <em>{item.subjectLabel}</em>
                  <i>
                    {item.chapterCount} chương · {percent(item.progress)}
                  </i>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!ambient && (
      <div className="solar-ui">
        <header className="solar-head">
          <div className="solar-brand">
            <span className="solar-eyebrow">AZTEACH · INTERACTIVE KNOWLEDGE SYSTEM</span>
            {focus.level === "system" ? (
              <>
                <h1 className="solar-hero-title">
                  HỌC SÂU HƠN.
                  <br />
                  <span className="solar-hero-outline">NHÌN RÕ HƠN.</span>
                </h1>
                <p className="solar-hero-sub">
                  8 hành tinh · {model.chapters} chương · {model.stations} trạm học · {percent(model.progress)} hoàn thành
                </p>
              </>
            ) : (
              <>
                <h1>{levelLabel(focus.level)}</h1>
                <p>
                  {focus.level === "planet" && planet && (
                    <>
                      {planet.spec.latin} · {planet.subjectLabel} · {planet.chapterCount} chương · {percent(planet.progress)}
                    </>
                  )}
                  {focus.level === "chapter" && chapter && planet && (
                    <>
                      {planet.spec.name} · {chapter.kind === "natural" ? "Vệ tinh tự nhiên" : "Vệ tinh nhân tạo"} ·{" "}
                      {chapter.visited}/{chapter.total} trạm
                    </>
                  )}
                  {focus.level === "world" && world && (
                    <>
                      {world.latin} · {world.designation}
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          <nav className="solar-crumbs" aria-label="Điều hướng hệ mặt trời">
            {focus.level !== "system" && (
              <>
                <button type="button" className="solar-crumb" onClick={goSystem}>
                  <House size={12} /> HỆ MẶT TRỜI
                </button>
                {breadcrumbPlanet && (
                  <>
                    <ChevronRight size={12} className="solar-crumb-sep" />
                    <button type="button" className="solar-crumb" onClick={() => goPlanet(breadcrumbPlanet.spec.id)}>
                      {breadcrumbPlanet.spec.name}
                    </button>
                  </>
                )}
                {chapter && (
                  <>
                    <ChevronRight size={12} className="solar-crumb-sep" />
                    <span className="solar-crumb is-current">{short(chapter.title, 32)}</span>
                  </>
                )}
                {!breadcrumbPlanet && !chapter && world && (
                  <>
                    <ChevronRight size={12} className="solar-crumb-sep" />
                    <span className="solar-crumb is-current">{world.name}</span>
                  </>
                )}
              </>
            )}
          </nav>
        </header>

        <div className="solar-actions">
          <label className="solar-search">
            <Search size={13} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPanelOpen(Boolean(event.target.value));
              }}
              placeholder="TÌM HÀNH TINH, CHƯƠNG HỌC…"
              aria-label="Tìm hành tinh hoặc chương học"
              aria-controls="solar-index-panel"
              aria-expanded={panelOpen}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Xoá tìm kiếm">
                <X size={12} />
              </button>
            )}
          </label>
          <button type="button" className="solar-action" onClick={goSystem} title="Về hệ mặt trời">
            <House size={14} />
            <span>TỔNG QUAN</span>
          </button>
          <button
            type="button"
            className={`solar-action ${aiOpen ? "is-active" : ""}`}
            onClick={() => setAiOpen((value) => !value)}
            aria-expanded={aiOpen}
            aria-controls="az-ai-panel"
          >
            <Sparkles size={14} />
            <span>AZ AI</span>
          </button>
          <button
            type="button"
            className="solar-action solar-action-menu"
            onClick={() => setPanelOpen((value) => !value)}
            aria-expanded={panelOpen}
            aria-controls="solar-index-panel"
          >
            <span>DANH MỤC</span>
          </button>
        </div>

        {searchResults ? (
          <aside
            className={`solar-side ${panelOpen ? "is-open" : ""}`}
            id="solar-index-panel"
            aria-hidden={!panelOpen}
            inert={!panelOpen}
            style={{ "--planet-accent": panelAccent } as CSSProperties}
          >
            <div className="solar-panel-head">
              <span>KẾT QUẢ</span>
              <span>{searchResults.planets.length + searchResults.chapters.length}</span>
            </div>
            <div className="solar-list">
              {searchResults.planets.map((item, index) => (
                <button
                  key={item.spec.id}
                  type="button"
                  className="solar-row solar-row-planet"
                  onClick={() => goPlanet(item.spec.id)}
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className="solar-order">{String(item.spec.order).padStart(2, "0")}</span>
                  <span
                    className="solar-dot"
                    aria-hidden="true"
                    style={{
                      background: PLANET_ACCENT[item.spec.id],
                      boxShadow: `0 0 10px -2px ${PLANET_ACCENT[item.spec.id]}`,
                    }}
                  />
                  <span className="solar-row-main">
                    <b>{item.spec.name}</b>
                    <em>{item.subjectLabel}</em>
                  </span>
                  <span className="solar-row-count">{item.chapterCount} ch.</span>
                </button>
              ))}
              {searchResults.chapters.map(({ planet: owner, chapter: entry }, index) => (
                <button
                  key={entry.id}
                  type="button"
                  className="solar-row solar-row-chapter"
                  onClick={() =>
                    go({ level: "chapter", planetId: owner.spec.id, chapterId: entry.id })
                  }
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className={`solar-sat ${entry.kind}`}>{entry.kind === "natural" ? "●" : "▣"}</span>
                  <span className="solar-row-main">
                    <b>{entry.title}</b>
                    <em>
                      {owner.spec.name} · {entry.visited}/{entry.total} trạm
                    </em>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
              {searchResults.planets.length + searchResults.chapters.length === 0 && (
                <div className="solar-empty">
                  <p>Không tìm thấy hành tinh hoặc chương phù hợp.</p>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside
            className={`solar-side ${panelOpen ? "is-open" : ""}`}
            id="solar-index-panel"
            aria-hidden={!panelOpen}
            inert={!panelOpen}
            style={{ "--planet-accent": panelAccent } as CSSProperties}
          >
            {focus.level === "system" && (
              <>
                <div className="solar-panel-head">
                  <span>CHỈ MỤC HÀNH TINH</span>
                  <span>{model.chapters} CHƯƠNG</span>
                </div>
                <div className="solar-list">
                  {model.planets.map((item, index) => {
                    const empty = item.chapterCount === 0;
                    return (
                      <button
                        key={item.spec.id}
                        type="button"
                        className={`solar-row solar-row-planet ${empty ? "is-empty" : ""}`}
                        onClick={() => goPlanet(item.spec.id)}
                        style={{ "--i": index } as CSSProperties}
                      >
                        <span className="solar-order">{String(item.spec.order).padStart(2, "0")}</span>
                        <span
                          className="solar-dot"
                          aria-hidden="true"
                          style={{
                            background: PLANET_ACCENT[item.spec.id],
                            boxShadow: `0 0 10px -2px ${PLANET_ACCENT[item.spec.id]}`,
                          }}
                        />
                        <span className="solar-row-main">
                          <b>{item.spec.name}</b>
                          <em>{item.subjectLabel}</em>
                          <i className="solar-bar">
                            <b style={{ width: percent(item.progress) }} />
                          </i>
                        </span>
                        <span className="solar-row-count">
                          {item.chapterCount}
                          <em>ch.</em>
                        </span>
                      </button>
                    );
                  })}

                  <p className="solar-section-divider">VÀNH ĐAI TIỂU HÀNH TINH</p>
                  <button
                    type="button"
                    className="solar-row solar-row-belt"
                    onClick={() => setView("assess")}
                    style={{ "--i": model.planets.length } as CSSProperties}
                  >
                    <span className="solar-order">◎</span>
                    <span className="solar-row-main">
                      <b>Kiểm tra đánh giá</b>
                      <em>{assessCount} bài có ngân hàng câu hỏi</em>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                  {SIM_WORLDS.map((world, index) => (
                    <button
                      key={world.id}
                      type="button"
                      className="solar-row solar-row-world"
                      onClick={() =>
                        go({ level: "world", planetId: null, chapterId: null, worldId: world.id })
                      }
                      style={
                        {
                          "--i": model.planets.length + 1 + index,
                          "--planet-accent": world.color,
                        } as CSSProperties
                      }
                    >
                      <span
                        className="solar-dot"
                        aria-hidden="true"
                        style={{
                          background: world.color,
                          boxShadow: `0 0 10px -2px ${world.color}`,
                        }}
                      />
                      <span className="solar-row-main">
                        <b>{world.name}</b>
                        <em>{world.designation}</em>
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  ))}
                </div>
                <div className="solar-panel-foot">
                  <span>{percent(model.progress)} hoàn thành</span>
                  <span>{model.visited}/{model.stations} trạm</span>
                </div>
              </>
            )}

            {focus.level === "planet" && planet && (
              <>
                <div className="solar-panel-head">
                  <button type="button" className="solar-back" onClick={goSystem}>
                    ← HỆ MẶT TRỜI
                  </button>
                  <span>{planet.chapterCount} CHƯƠNG</span>
                </div>
                <div className="solar-context">
                  <span className="solar-order">{String(planet.spec.order).padStart(2, "0")}</span>
                  <div>
                    <h2>{planet.spec.name}</h2>
                    <p>
                      {planet.spec.latin} · {planet.subjectLabel}
                    </p>
                    <i className="solar-bar">
                      <b style={{ width: percent(planet.progress) }} />
                    </i>
                  </div>
                </div>
                <div className="solar-list">
                  {planet.chapters.map((entry, index) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="solar-row solar-row-chapter"
                      onClick={() =>
                        go({ level: "chapter", planetId: planet.spec.id, chapterId: entry.id })
                      }
                      style={{ "--i": index } as CSSProperties}
                    >
                      <span className={`solar-sat ${entry.kind}`}>{entry.kind === "natural" ? "●" : "▣"}</span>
                      <span className="solar-row-main">
                        <b>{entry.title}</b>
                        <em>
                          {entry.kind === "natural" ? "Vệ tinh tự nhiên" : "Vệ tinh nhân tạo"} ·{" "}
                          {entry.visited}/{entry.total} trạm
                        </em>
                      </span>
                      {entry.done ? <span className="solar-done">✓</span> : <ChevronRight size={13} />}
                    </button>
                  ))}
                  {planet.chapters.length === 0 && (
                    <div className="solar-empty">
                      <p>Chưa có chương học nào cho môn này.</p>
                      <button
                        type="button"
                        className="solar-mini-btn"
                        onClick={() => createForPlanet(planet.subjects[0])}
                      >
                        TẠO BÀI HỌC ĐẦU TIÊN
                      </button>
                    </div>
                  )}
                </div>
                <div className="solar-panel-foot">
                  <span>{percent(planet.progress)} hoàn thành</span>
                  <button type="button" className="solar-mini-btn" onClick={() => createForPlanet(planet.subjects[0])}>
                    + BÀI HỌC
                  </button>
                </div>
              </>
            )}

            {focus.level === "chapter" && planet && chapter && (
              <>
                <div className="solar-panel-head">
                  <button
                    type="button"
                    className="solar-back"
                    onClick={() => goPlanet(planet.spec.id)}
                  >
                    ← {planet.spec.name.toUpperCase()}
                  </button>
                  <span>{chapter.total} TRẠM</span>
                </div>
                <div className="solar-context">
                  <span className={`solar-sat ${chapter.kind}`}>{chapter.kind === "natural" ? "●" : "▣"}</span>
                  <div>
                    <h2>{chapter.title}</h2>
                    <p>
                      {chapter.kind === "natural" ? "Vệ tinh tự nhiên" : "Vệ tinh nhân tạo"} · {planet.subjectLabel}
                    </p>
                    <i className="solar-bar">
                      <b style={{ width: percent(chapter.progress) }} />
                    </i>
                  </div>
                </div>
                <div className="solar-list solar-stations">
                  {chapter.stations.map((station, index) => (
                    <button
                      key={station.id}
                      type="button"
                      className={`solar-row solar-row-station ${station.visited ? "is-visited" : ""}`}
                      onClick={() => openStation(chapter, station)}
                      style={{ "--i": index } as CSSProperties}
                    >
                      <span className="solar-station-index">
                        {station.visited ? "✓" : String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="solar-row-main">
                        <b>{station.label}</b>
                        <em>{station.tab === "quiz" ? "Luyện tập · trắc nghiệm" : "Trạm học · bài giảng"}</em>
                      </span>
                      <Play size={12} />
                    </button>
                  ))}
                </div>
                <div className="solar-panel-foot">
                  <button type="button" className="solar-mini-btn" onClick={() => openChapterLesson(chapter)}>
                    MỞ BÀI HỌC
                  </button>
                  <span>
                    {chapter.visited}/{chapter.total} trạm đã mở
                  </span>
                </div>
              </>
            )}
            {focus.level === "world" && world && (
              <>
                <div className="solar-panel-head">
                  <button type="button" className="solar-back" onClick={goSystem}>
                    ← HỆ MẶT TRỜI
                  </button>
                  <span>VÀNH ĐAI</span>
                </div>
                <div className="solar-context is-world">
                  <span className="solar-orb-mini" aria-hidden="true" />
                  <div>
                    <h2>{world.name}</h2>
                    <p>{world.latin}</p>
                    <p className="solar-world-tag">{world.tagline}</p>
                    <span className="solar-world-traits">
                      {world.traits.map((trait) => (
                        <em key={trait}>{trait}</em>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="solar-list">
                  <p className="solar-mini-title">THẾ GIỚI KHÁC TRONG VÀNH ĐAI</p>
                  {SIM_WORLDS.filter((item) => item.id !== world.id).map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className="solar-row solar-row-world"
                      onClick={() =>
                        go({ level: "world", planetId: null, chapterId: null, worldId: item.id })
                      }
                      style={{ "--i": index, "--planet-accent": item.color } as CSSProperties}
                    >
                      <span
                        className="solar-dot"
                        aria-hidden="true"
                        style={{
                          background: item.color,
                          boxShadow: `0 0 10px -2px ${item.color}`,
                        }}
                      />
                      <span className="solar-row-main">
                        <b>{item.name}</b>
                        <em>{item.designation}</em>
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  ))}
                </div>
                <div className="solar-panel-foot">
                  <button
                    type="button"
                    className="solar-enter-btn"
                    onClick={() => enterWorld(world)}
                  >
                    VÀO PHÒNG LAB
                  </button>
                  <span>{world.designation}</span>
                </div>
              </>
            )}
          </aside>
        )}

        {liveHover && !fallback && (
          <div
            className={`solar-hover-card is-${liveHover.kind}`}
            style={{ "--planet-accent": hoverAccent ?? "#cfe1f7" } as CSSProperties}
          >
            <span className="solar-hover-kind">
              {liveHover.kind === "planet" && "HÀNH TINH"}
              {liveHover.kind === "chapter" && "CHƯƠNG HỌC"}
              {liveHover.kind === "station" && "TRẠM HỌC"}
              {liveHover.kind === "sun" && "TRÍ TUỆ TRUNG TÂM"}
              {liveHover.kind === "belt" && "VÀNH ĐAI"}
              {liveHover.kind === "world" && "THẾ GIỚI MÔ PHỎNG"}
            </span>
            <b>{liveHover.title}</b>
            <em>{liveHover.meta}</em>
            <span className="solar-hover-hint">
              {liveHover.kind === "station"
                ? "NHẤN ĐỂ MỞ BÀI HỌC"
                : liveHover.kind === "sun"
                  ? "NHẤN ĐỂ MỞ TRỢ LÝ AZ AI"
                  : liveHover.kind === "belt"
                    ? "NHẤN ĐỂ VÀO KIỂM TRA ĐÁNH GIÁ"
                    : liveHover.kind === "world"
                      ? "NHẤN ĐỂ PHÓNG VÀO"
                      : "NHẤN ĐỂ ĐI SÂU"}
            </span>
          </div>
        )}

        {aiOpen && (
          <section className="solar-ai" id="az-ai-panel" aria-label="AZ AI">
            <div className="solar-ai-head">
              <div>
                <span className="solar-eyebrow">TRÍ TUỆ TRUNG TÂM</span>
                <h2>AZ AI</h2>
              </div>
              <button type="button" className="solar-ai-close" onClick={() => setAiOpen(false)} aria-label="Đóng AZ AI">
                <X size={15} />
              </button>
            </div>
            <p className="solar-ai-copy">
              Mặt trời giữ toàn bộ tri thức của hệ thống. Hỏi AZ AI để tạo bài học, nhận lộ trình
              hoặc mở lại chương đang học dở.
            </p>
            <label className="solar-ai-input">
              <span>BẠN MUỐN HỌC GÌ?</span>
              <textarea
                ref={aiInputRef}
                value={aiText}
                onChange={(event) => setAiText(event.target.value)}
                rows={3}
                placeholder={
                  chapter
                    ? `Ví dụ: giải thích "${short(chapter.title, 36)}" theo từng bước…`
                    : "Ví dụ: lập lộ trình ôn tập Hoá học trong 7 ngày…"
                }
              />
            </label>
            <div className="solar-ai-chips">
              {["Gợi ý lộ trình", "Giải thích chương này", "Tạo bài kiểm tra"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    setAiText(
                      chip === "Giải thích chương này" && chapter
                        ? `Giải thích chương "${chapter.title}" theo từng bước, kèm ví dụ.`
                        : chip === "Tạo bài kiểm tra" && chapter
                          ? `Tạo bài kiểm tra 10 câu cho chương "${chapter.title}".`
                          : "Gợi ý lộ trình học tiếp theo dựa trên tiến độ của tôi."
                    )
                  }
                >
                  {chip}
                </button>
              ))}
            </div>
            <button type="button" className="solar-ai-submit" onClick={askAi}>
              <Sparkles size={14} /> TẠO VỚI AZ AI
            </button>

            <div className="solar-ai-recs">
              <div className="solar-panel-head">
                <span>TIẾP TỤC HỌC</span>
                <span>{percent(model.progress)}</span>
              </div>
              {suggestions.length === 0 && (
                <p className="solar-ai-empty">
                  Chưa có chương đang học. Chọn một hành tinh để bắt đầu.
                </p>
              )}
              {suggestions.map(({ planet: owner, chapter: entry }) => (
                <button
                  key={entry.id}
                  type="button"
                  className="solar-ai-rec"
                  onClick={() =>
                    go({ level: "chapter", planetId: owner.spec.id, chapterId: entry.id })
                  }
                >
                  <span>{owner.spec.name}</span>
                  <b>{entry.title}</b>
                  <em>
                    {entry.visited}/{entry.total} trạm
                  </em>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="solar-foot">
          <span className="solar-foot-item">
            <i className="solar-legend-dot is-planet" /> HÀNH TINH = MÔN HỌC
          </span>
          <span className="solar-foot-item">
            <i className="solar-legend-dot is-moon" /> VỆ TINH = CHƯƠNG
          </span>
          <span className="solar-foot-item">
            <i className="solar-legend-dot is-station" /> TRẠM = BÀI HỌC
          </span>
        </div>

        {focus.level === "system" && (
          <button
            type="button"
            className="solar-scroll-cue"
            onClick={scrollToWelcome}
            aria-label="Cuộn xuống phần trang chủ"
          >
            <span>CUỘN XUỐNG</span>
            <ChevronDown size={16} />
          </button>
        )}
      </div>
      )}
    </div>
  );
}
