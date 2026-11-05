import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  Braces,
  Columns2,
  Eye,
  Play,
  RotateCcw,
  Rows2,
  SlidersHorizontal,
  Table2,
  Terminal,
} from "lucide-react";
import { execute, type RunResult } from "../vanlab/engines";
import { formatCode, formatDuration } from "../vanlab/format";
import { CATS, VAN_BY_ID, VAN_LANGS } from "../vanlab/languages";
import { SIM_WORLDS } from "../worlds";
import { useStore } from "../store";
import "../vanlab.css";

const STORE_KEY = "vanngon.lab.v1";

interface LabMemory {
  last: string;
  code: Record<string, string>;
}

function readMemory(): LabMemory {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { last: "js", code: {} };
    const parsed = JSON.parse(raw) as Partial<LabMemory>;
    const last = typeof parsed.last === "string" && VAN_BY_ID[parsed.last] ? parsed.last : "js";
    return { last, code: parsed.code && typeof parsed.code === "object" ? parsed.code : {} };
  } catch {
    return { last: "js", code: {} };
  }
}

/* Trang nháp cho CSS — để bộ chọn và màu có thứ áp lên. */
const CSS_COMPANION =
  "<h1>Vạn Ngôn</h1><p>Thử bộ chọn, màu và bóng ngay trên trang nháp.</p>" +
  '<div class="card"><b>.card</b> — viền, góc bo và phát sáng khi rê chuột.</div>' +
  "<ul><li>mục một</li><li>mục hai</li></ul><button>nút</button>";

type Pane = "out" | "preview" | "table";
type Dock = "right" | "bottom";

export default function VanLangLab() {
  const setView = useStore((s) => s.setView);
  const [memory] = useState(readMemory);

  const [langId, setLangId] = useState(memory.last);
  const lang = VAN_BY_ID[langId] ?? VAN_LANGS[0];

  const [drafts, setDrafts] = useState<Record<string, string>>(memory.code);
  const code = drafts[lang.id] ?? lang.seed;
  const writeCode = (value: string) => setDrafts((prev) => ({ ...prev, [lang.id]: value }));

  const [implIndex, setImplIndex] = useState(0);
  const impl = lang.impl[Math.min(implIndex, lang.impl.length - 1)];

  const [stdin, setStdin] = useState("");
  const [args, setArgs] = useState("");
  const [tray, setTray] = useState(false);
  const [dock, setDock] = useState<Dock>("right");

  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pane, setPane] = useState<Pane>("out");
  const [caret, setCaret] = useState({ line: 1, column: 1 });

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const world = useMemo(() => SIM_WORLDS.find((item) => item.view === "vanlab"), []);

  /* Ghi nháp xuống máy, nhưng đừng viết từng phím một. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ last: langId, code: drafts }));
      } catch {
        /* hết dung lượng thì bỏ qua, mã vẫn còn trên màn hình */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [langId, drafts]);

  useEffect(() => {
    setImplIndex(0);
    setResult(null);
    setNotes([]);
    setPane("out");
  }, [langId]);

  const lineCount = code.split("\n").length;

  const syncScroll = () => {
    if (gutterRef.current && areaRef.current) gutterRef.current.scrollTop = areaRef.current.scrollTop;
  };

  const trackCaret = () => {
    const el = areaRef.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const lines = before.split("\n");
    setCaret({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const el = event.currentTarget;
      const from = el.selectionStart;
      const to = el.selectionEnd;
      const next = code.slice(0, from) + "  " + code.slice(to);
      writeCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = from + 2;
      });
    }
  };

  async function run() {
    if (busy || !impl) return;
    setBusy(true);
    setElapsed(0);
    setResult(null);
    setNotes([`chuẩn bị · ${impl.label}`]);
    const started = performance.now();
    const tick = window.setInterval(() => setElapsed(performance.now() - started), 100);
    try {
      const r = await execute(impl, code, {
        stdin,
        args,
        companion: impl.engine === "css-preview" ? CSS_COMPANION : undefined,
        note: (message) => setNotes((prev) => [...prev.slice(-5), message]),
      });
      setResult(r);
      setPane(r.preview ? "preview" : r.table ? "table" : "out");
    } catch (error) {
      setResult({
        out: "",
        err: String((error as Error)?.message ?? error),
        exit: 1,
        ms: performance.now() - started,
        engineLabel: impl.label,
      });
      setPane("out");
    } finally {
      window.clearInterval(tick);
      setBusy(false);
    }
  }

  const format = () => {
    try {
      writeCode(formatCode(code, lang.id));
      setNotes((prev) => [...prev.slice(-5), "đã định dạng lại mã"]);
    } catch (error) {
      setNotes((prev) => [...prev.slice(-5), `không định dạng được: ${(error as Error).message}`]);
    }
  };

  const status = busy
    ? { tone: "run", text: "ĐANG CHẠY" }
    : result
      ? result.exit === 0
        ? { tone: "ok", text: "HOÀN TẤT" }
        : { tone: "bad", text: `MÃ THOÁT ${result.exit}` }
      : { tone: "idle", text: "SẴN SÀNG" };

  const panes: { id: Pane; label: string; icon: typeof Terminal }[] = [
    { id: "out", label: "Xuất", icon: Terminal },
    ...(result?.preview ? [{ id: "preview" as Pane, label: "Xem trước", icon: Eye }] : []),
    ...(result?.table ? [{ id: "table" as Pane, label: "Bảng", icon: Table2 }] : []),
  ];

  return (
    <div
      className="van-page"
      style={{ "--world-color": world?.color, "--world-glow": world?.glow } as CSSProperties}
    >
      <header className="van-head">
        <button type="button" className="icon-btn" onClick={() => setView("sim")} aria-label="Về mục Mô phỏng">
          <ArrowLeft size={17} />
        </button>
        <div className="van-head-copy">
          <span className="kicker">{world?.latin ?? "POLYGLOT-Σ"}</span>
          <h1>Trạm Vạn Ngôn</h1>
          <p>
            Hai mươi thứ tiếng trong một khung mã. Máy chạy nằm trong trình duyệt ở chế độ
            <em> trong máy</em>; những compiler nặng hơn gửi sang <em>máy từ xa</em>.
          </p>
        </div>
        <div className="van-head-side">
          <span className={`van-state is-${status.tone}`}>
            <i aria-hidden="true" />
            {status.text}
          </span>
          <span className="van-clock">{busy ? formatDuration(elapsed) : result ? formatDuration(result.ms) : "—"}</span>
        </div>
      </header>

      <div className="van-band" role="tablist" aria-label="Chọn ngôn ngữ">
        {CATS.map((cat, groupIndex) => {
          const items = VAN_LANGS.filter((item) => item.cat === cat.id);
          if (!items.length) return null;
          return (
            <div className="van-band-group" key={cat.id} style={{ "--i": groupIndex } as CSSProperties}>
              <span className="van-band-label">{cat.label}</span>
              <div className="van-band-chips">
                {items.map((item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={item.id === lang.id}
                    key={item.id}
                    className={`van-chip ${item.id === lang.id ? "is-active" : ""}`}
                    data-kind={item.impl[0]?.kind}
                    onClick={() => setLangId(item.id)}
                    title={item.blurb}
                  >
                    <i className="van-led" aria-hidden="true" />
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`van-stage is-${dock}`}>
        <section className="van-panel van-editor-panel" aria-label={`Mã nguồn ${lang.name}`}>
          <div className="van-panel-head">
            <span className="van-file">
              <strong>{lang.name}</strong>
              <em>{lang.year}</em>
            </span>
            <span className="van-blurb">{lang.blurb}</span>
            {lang.impl.length > 1 && (
              <div className="van-engines" role="group" aria-label="Chọn engine">
                {lang.impl.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.engine}-${index}`}
                    className={`van-engine ${index === implIndex ? "is-active" : ""}`}
                    data-kind={item.kind}
                    onClick={() => setImplIndex(index)}
                  >
                    <i className="van-led" aria-hidden="true" />
                    {item.kind === "local" ? "trong máy" : "từ xa"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="van-editor">
            <div className="van-gutter" ref={gutterRef} aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <textarea
              ref={areaRef}
              className="van-area"
              spellCheck={false}
              value={code}
              onChange={(event) => writeCode(event.target.value)}
              onScroll={syncScroll}
              onKeyDown={onEditorKeyDown}
              onKeyUp={trackCaret}
              onClick={trackCaret}
              aria-label={`Trình soạn ${lang.name}`}
            />
          </div>

          <div className={`van-tray ${tray ? "is-open" : ""}`}>
            <label className="van-field">
              <span>NGÕ VÀO TIÊU CHUẨN (stdin)</span>
              <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} spellCheck={false} rows={3} />
            </label>
            <label className="van-field">
              <span>THAM SỐ (argv)</span>
              <input value={args} onChange={(event) => setArgs(event.target.value)} spellCheck={false} placeholder="tách nhau bằng dấu cách" />
            </label>
          </div>
        </section>

        <section className="van-panel van-console" aria-label="Bảng kết quả" aria-live="polite">
          <div className="van-panel-head">
            <div className="van-tabs" role="tablist" aria-label="Khung kết quả">
              {panes.map((item) => (
                <button
                  type="button"
                  role="tab"
                  key={item.id}
                  aria-selected={pane === item.id}
                  className={`van-tab ${pane === item.id ? "is-active" : ""}`}
                  onClick={() => setPane(item.id)}
                >
                  <item.icon size={12} /> {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="van-tool"
              onClick={() => setDock(dock === "right" ? "bottom" : "right")}
              aria-label={dock === "right" ? "Chuyển bảng kết quả xuống dưới" : "Chuyển bảng kết quả sang phải"}
              title={dock === "right" ? "Đặt bảng xuống dưới" : "Đặt bảng sang phải"}
            >
              {dock === "right" ? <Rows2 size={13} /> : <Columns2 size={13} />}
            </button>
          </div>

          <div className="van-console-body">
            {busy && (
              <ul className="van-notes">
                {notes.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
                <li className="van-cursor" aria-hidden="true" />
              </ul>
            )}

            {!busy && pane === "out" && (
              <div className="van-stream">
                {result?.out && <pre className="van-line">{result.out}</pre>}
                {result?.err && <pre className="van-line is-err">{result.err}</pre>}
                {!result?.out && !result?.err && (
                  <p className="van-hint">
                    Bấm <strong>CHẠY</strong> hoặc <kbd>Ctrl</kbd>+<kbd>Enter</kbd>. Engine báo tiến trình tại đây trước
                    khi in kết quả.
                  </p>
                )}
                {notes.length > 0 && (
                  <ul className="van-notes">
                    {notes.map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!busy && pane === "preview" && result?.preview && (
              <iframe className="van-preview" title="Xem trước" sandbox="allow-scripts" srcDoc={result.preview} />
            )}

            {!busy && pane === "table" && result?.table && (
              <div className="van-tablewrap">
                <table className="van-table">
                  <thead>
                    <tr>
                      {result.table.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.table.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell === null || cell === undefined ? "NULL" : String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="van-console-foot">
            <span>{result?.engineLabel ?? impl?.label ?? "—"}</span>
            {result && <span>{result.exit === 0 ? "ổn" : `mã thoát ${result.exit}`}</span>}
            {result?.noteText && <span className="is-accent">{result.noteText}</span>}
          </div>
        </section>
      </div>

      <div className="van-dock">
        <button type="button" className="btn btn-primary van-run" onClick={() => void run()} disabled={busy}>
          <Play size={13} /> {busy ? "ĐANG CHẠY…" : "CHẠY"}
        </button>
        <span className="van-kbd">
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
        </span>
        <button type="button" className="btn btn-ghost" onClick={format} title="Định dạng lại mã">
          <Braces size={13} /> ĐỊNH DẠNG
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => writeCode(lang.seed)}
          title="Nạp lại mã mẫu của ngôn ngữ này"
        >
          <RotateCcw size={13} /> MẪU GỐC
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${tray ? "is-on" : ""}`}
          onClick={() => setTray((prev) => !prev)}
          aria-expanded={tray}
        >
          <SlidersHorizontal size={13} /> NGÕ VÀO
        </button>
        <span className="van-dock-tail">
          dòng {caret.line} · cột {caret.column} · {lineCount} dòng
        </span>
      </div>
    </div>
  );
}
