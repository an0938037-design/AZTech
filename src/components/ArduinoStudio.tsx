import {
  Activity,
  BookOpen,
  ChevronRight,
  CircuitBoard,
  Cpu,
  Lightbulb,
  Play,
  RotateCcw,
  Send,
  Square,
  Terminal,
  Trash,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Board, LED_COMPONENTS, pinLabel, type BoardSnapshot } from "../arduino/board";
import { RealTimeClock } from "../arduino/clock";
import { EXAMPLES, DEFAULT_CODE, getExample, type ArduinoExample } from "../arduino/examples";
import { highlight, SketchError } from "../arduino/lexer";
import { Interpreter } from "../arduino/interpreter";
import { compile, type Program } from "../arduino/parser";

const STORAGE_KEY = "aztech-arduino-v1";

interface SavedState {
  code: string;
  exampleId: string;
  muted: boolean;
  pot: number;
}

function loadSaved(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      if (typeof parsed.code === "string" && parsed.code.trim()) {
        const exampleId =
          typeof parsed.exampleId === "string" && EXAMPLES.some((item) => item.id === parsed.exampleId)
            ? parsed.exampleId
            : "blink";
        return {
          code: parsed.code,
          exampleId,
          muted: Boolean(parsed.muted),
          pot: typeof parsed.pot === "number" ? Math.max(0, Math.min(1023, parsed.pot)) : 512,
        };
      }
    }
  } catch {
    // ignore
  }
  return { code: DEFAULT_CODE, exampleId: "blink", muted: false, pot: 512 };
}

interface AudioRig {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
}

const DIGITAL_PINS = Array.from({ length: 14 }, (_, index) => index);
const ANALOG_PINS = [14, 15, 16, 17, 18, 19];

function levelSlug(level: ArduinoExample["level"]): string {
  if (level === "Cơ bản") return "basic";
  if (level === "Trung bình") return "mid";
  return "hard";
}

export default function ArduinoStudio() {
  const [saved] = useState(loadSaved);
  const [code, setCode] = useState(saved.code);
  const [exampleId, setExampleId] = useState(saved.exampleId);
  const [muted, setMuted] = useState(saved.muted);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ message: string; line: number } | null>(null);
  const [pot, setPot] = useState(saved.pot);
  const [pressed, setPressed] = useState(false);
  const [serialInput, setSerialInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const [initialBoard] = useState(() => new Board(new RealTimeClock()));
  const boardRef = useRef<Board>(initialBoard);
  const [snapshot, setSnapshot] = useState<BoardSnapshot>(() => initialBoard.snapshot());

  const genRef = useRef<Generator<unknown, void, void> | null>(null);
  const pumpRef = useRef<() => void>(() => {});
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const resumeAtRef = useRef(0);
  const lastPublishRef = useRef(0);
  const potRef = useRef(saved.pot);
  const pressedRef = useRef(false);
  const audioRef = useRef<AudioRig | null>(null);

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => code.split("\n"), [code]);
  const highlighted = useMemo(() => highlight(code), [code]);
  const activeExample = useMemo(() => EXAMPLES.find((item) => item.id === exampleId), [exampleId]);

  const publish = useCallback((force = false) => {
    const board = boardRef.current;
    if (!board) return;
    const now = performance.now();
    if (!force && now - lastPublishRef.current < 40) return;
    lastPublishRef.current = now;
    setSnapshot(board.snapshot());
  }, []);

  const ensureAudio = useCallback((): AudioRig | null => {
    try {
      if (audioRef.current) {
        void audioRef.current.ctx.resume();
        return audioRef.current;
      }
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioRef.current = { ctx, osc, gain };
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  const silenceAudio = useCallback(() => {
    const rig = audioRef.current;
    if (!rig) return;
    try {
      rig.gain.gain.setTargetAtTime(0, rig.ctx.currentTime, 0.01);
    } catch {
      // ignore
    }
  }, []);

  const stopThen = useCallback(
    (powerOff: boolean) => {
      runningRef.current = false;
      genRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      silenceAudio();
      if (powerOff) {
        boardRef.current?.powerOff();
        publish(true);
      }
      setRunning(false);
    },
    [publish, silenceAudio]
  );

  const handleError = useCallback((err: unknown) => {
    runningRef.current = false;
    genRef.current = null;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
    if (err instanceof SketchError) {
      setError({ message: err.message, line: err.line });
    } else {
      setError({
        message: err instanceof Error ? err.message : "Lỗi không xác định khi chạy sketch.",
        line: 0,
      });
    }
    const board = boardRef.current;
    if (board) setSnapshot(board.snapshot());
  }, []);

  const pump = useCallback(() => {
    if (!runningRef.current) return;
    const gen = genRef.current;
    const board = boardRef.current;
    if (!gen || !board) return;

    if (performance.now() < resumeAtRef.current) {
      publish();
      rafRef.current = window.requestAnimationFrame(() => pumpRef.current());
      return;
    }

    let budget = 900;
    try {
      while (budget > 0) {
        budget -= 1;
        const step = gen.next() as IteratorResult<{ delayMs: number } | null, void>;
        if (step.done) {
          stopThen(false);
          return;
        }
        const yielded = step.value;
        if (yielded && yielded.delayMs > 0) {
          resumeAtRef.current = performance.now() + yielded.delayMs;
          break;
        }
      }
    } catch (err) {
      handleError(err);
      return;
    }

    publish();
    rafRef.current = window.requestAnimationFrame(() => pumpRef.current());
  }, [handleError, publish, stopThen]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const run = useCallback(() => {
    runningRef.current = false;
    genRef.current = null;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    silenceAudio();
    setError(null);

    const clock = new RealTimeClock();
    const board = new Board(clock);
    board.setPot(potRef.current);
    board.setButton(pressedRef.current);
    boardRef.current = board;
    publish(true);

    let program: Program;
    try {
      program = compile(code);
    } catch (err) {
      handleError(err);
      return;
    }

    const interpreter = new Interpreter(program, board, clock);
    genRef.current = interpreter.run() as unknown as Generator<unknown, void, void>;

    setRunning(true);
    runningRef.current = true;
    resumeAtRef.current = 0;
    ensureAudio();
    pumpRef.current();
  }, [code, ensureAudio, handleError, publish, silenceAudio]);

  const loadExample = useCallback(
    (id: string) => {
      const example = getExample(id);
      stopThen(false);
      setExampleId(id);
      setCode(example.code);
      setError(null);
      const board = boardRef.current;
      if (board) {
        board.powerOff();
        board.clearSerial();
        board.setPot(potRef.current);
        board.setButton(pressedRef.current);
        setSnapshot(board.snapshot());
      }
      window.requestAnimationFrame(() => {
        const area = areaRef.current;
        if (!area) return;
        area.focus();
        area.setSelectionRange(0, 0);
        area.scrollTop = 0;
        area.scrollLeft = 0;
        if (preRef.current) {
          preRef.current.scrollTop = 0;
          preRef.current.scrollLeft = 0;
        }
        if (gutterRef.current) gutterRef.current.scrollTop = 0;
      });
    },
    [stopThen]
  );

  const syncScroll = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    if (preRef.current) {
      preRef.current.scrollTop = area.scrollTop;
      preRef.current.scrollLeft = area.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = area.scrollTop;
  }, []);

  /* Lưu sketch vào trình duyệt. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, exampleId, muted, pot }));
      } catch {
        // ignore
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [code, exampleId, muted, pot]);

  /* Âm thanh còi theo trạng thái bo mạch. */
  useEffect(() => {
    const active = running && !muted && snapshot.buzzer.active;
    if (!active) {
      silenceAudio();
      return;
    }
    const rig = ensureAudio();
    if (!rig) return;
    try {
      rig.osc.frequency.setTargetAtTime(snapshot.buzzer.freq, rig.ctx.currentTime, 0.006);
      rig.gain.gain.setTargetAtTime(0.03, rig.ctx.currentTime, 0.01);
    } catch {
      // ignore
    }
  }, [running, muted, snapshot.buzzer.active, snapshot.buzzer.freq, ensureAudio, silenceAudio]);

  /* Tự cuộn Serial Monitor. */
  useEffect(() => {
    if (!autoScroll) return;
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [snapshot.serial, autoScroll]);

  /* Dọn dẹp khi rời trang. */
  useEffect(
    () => () => {
      runningRef.current = false;
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      const rig = audioRef.current;
      if (rig) {
        try {
          void rig.ctx.close();
        } catch {
          // ignore
        }
        audioRef.current = null;
      }
    },
    []
  );

  const onEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget;

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      run();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const start = area.selectionStart;
      const end = area.selectionEnd;
      const next = `${code.slice(0, start)}  ${code.slice(end)}`;
      setCode(next);
      window.requestAnimationFrame(() => {
        area.selectionStart = start + 2;
        area.selectionEnd = start + 2;
      });
      return;
    }

    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
      const start = area.selectionStart;
      const end = area.selectionEnd;
      const before = code.slice(0, start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const indentMatch = /^[ \t]*/.exec(code.slice(lineStart, start));
      const indent = indentMatch ? indentMatch[0] : "";
      const extra = code.slice(lineStart, start).trimEnd().endsWith("{") ? "  " : "";
      if (indent || extra) {
        event.preventDefault();
        const insert = `\n${indent}${extra}`;
        setCode(`${code.slice(0, start)}${insert}${code.slice(end)}`);
        const caret = start + insert.length;
        window.requestAnimationFrame(() => {
          area.selectionStart = caret;
          area.selectionEnd = caret;
        });
      }
    }
  };

  const pressButton = (next: boolean) => {
    setPressed(next);
    pressedRef.current = next;
    boardRef.current?.setButton(next);
    publish(true);
  };

  const onButtonDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressButton(true);
  };

  const onPotChange = (value: number) => {
    setPot(value);
    potRef.current = value;
    boardRef.current?.setPot(value);
    publish(true);
  };

  const sendSerial = (event: FormEvent) => {
    event.preventDefault();
    if (!serialInput) return;
    boardRef.current?.pushSerialInput(serialInput);
    setSerialInput("");
    publish(true);
  };

  const clearSerial = () => {
    boardRef.current?.clearSerial();
    publish(true);
  };

  const runState = running ? "running" : error ? "error" : "idle";
  const potLevel = Math.round((snapshot.pot / 1023) * 100);

  return (
    <div className="arduino-studio">
      <header className="arduino-head">
        <div className="arduino-head-copy">
          <span className="kicker">KHÔNG GIAN PHẦN CỨNG</span>
          <h1>Arduino ngay trên trình duyệt</h1>
          <p>
            Viết sketch, bấm chạy và xem bo mạch ảo phản hồi tức thì. Không cần cài IDE,
            không cần mua board — mọi thứ chạy offline trong tab này.
          </p>
        </div>

        <div className="arduino-head-side">
          <span className={`arduino-run-state is-${runState}`}>
            <i aria-hidden="true" />
            {running ? "ĐANG CHẠY" : error ? "CÓ LỖI" : "SẴN SÀNG"}
          </span>
          <div className="arduino-actions">
            {running ? (
              <button type="button" className="btn btn-ghost" onClick={() => stopThen(true)}>
                <Square size={13} /> DỪNG
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={run}>
                <Play size={13} /> CHẠY
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={run} title="Chạy lại sketch từ đầu">
              <RotateCcw size={13} /> NẠP LẠI
            </button>
          </div>
        </div>
      </header>

      <div className="arduino-work">
        <section className="arduino-panel arduino-editor-panel" aria-label="Trình soạn thảo sketch">
          <div className="arduino-panel-head">
            <span className="arduino-file">
              <BookOpen size={13} /> sketch.ino
              <em>{activeExample ? activeExample.title : "Sketch tự do"}</em>
            </span>
            <div className="arduino-head-tools">
              <select
                className="arduino-example-select"
                value={exampleId}
                onChange={(event) => loadExample(event.target.value)}
                aria-label="Chọn ví dụ"
              >
                {EXAMPLES.map((example) => (
                  <option value={example.id} key={example.id}>
                    {example.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="arduino-tool"
                onClick={() => loadExample(exampleId)}
                title="Khôi phục code của ví dụ này"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="arduino-editor">
            <div className="arduino-gutter" ref={gutterRef} aria-hidden="true">
              {lines.map((_, index) => (
                <span key={index} className={error?.line === index + 1 ? "is-error" : ""}>
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="arduino-code">
              <pre
                className="arduino-highlight"
                ref={preRef}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
              />
              <textarea
                ref={areaRef}
                className="arduino-textarea"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onScroll={syncScroll}
                onKeyDown={onEditorKeyDown}
                spellCheck={false}
                wrap="off"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                aria-label="Mã Arduino"
              />
            </div>
          </div>

          {error ? (
            <div className="arduino-error" role="alert">
              <Zap size={14} />
              <span>
                {error.line > 0 ? `Dòng ${error.line}: ` : ""}
                {error.message}
              </span>
            </div>
          ) : (
            <div className="arduino-editor-foot">
              <span>{lines.length} dòng</span>
              <span>{code.length} ký tự</span>
              <span className="arduino-kbd">Ctrl</span>
              <span className="arduino-kbd">Enter</span>
              <span>để chạy</span>
            </div>
          )}
        </section>

        <div className="arduino-side">
          <section className="arduino-panel arduino-board-panel" aria-label="Bo mạch Arduino ảo">
            <div className="arduino-panel-head">
              <span className="arduino-file">
                <CircuitBoard size={13} /> BO MẠCH ẢO
              </span>
              <span className="arduino-chip">
                <Cpu size={12} /> ATmega328P · 16 MHz
              </span>
            </div>

            <BoardView snapshot={snapshot} />

            <div className="arduino-wiring">
              D13 đỏ · D12 vàng · D11 lá · D9 PWM · D2 nút · A0 biến trở · D8 còi · D10 servo
            </div>

            <div className="arduino-parts">
              <div className="arduino-part-group">
                <span className="arduino-part-title">ĐẦU RA</span>
                <div className="arduino-led-row">
                  {LED_COMPONENTS.map((led) => {
                    const state = snapshot.pins[led.pin];
                    const level = state ? state.level : 0;
                    return (
                      <div className="arduino-led" key={led.pin}>
                        <span
                          className="arduino-led-bulb"
                          style={{
                            background: led.color,
                            opacity: 0.18 + level * 0.82,
                            boxShadow: level > 0.02 ? `0 0 ${8 + level * 18}px ${led.color}` : "none",
                          }}
                        />
                        <span className="arduino-led-name">{pinLabel(led.pin)}</span>
                        <span className="arduino-led-value">{Math.round(level * 100)}%</span>
                      </div>
                    );
                  })}
                </div>

                <div className="arduino-output-grid">
                  <div className={`arduino-part ${snapshot.buzzer.active ? "is-on" : ""}`}>
                    <span className="arduino-part-name">
                      <Volume2 size={12} /> CÒI · D8
                    </span>
                    <div className="arduino-buzzer" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="arduino-part-value">
                      {snapshot.buzzer.active ? `${snapshot.buzzer.freq} Hz` : "tắt"}
                    </span>
                  </div>

                  <div className={`arduino-part ${snapshot.servo.attached ? "is-on" : ""}`}>
                    <span className="arduino-part-name">
                      <Activity size={12} /> SERVO · D10
                    </span>
                    <div className="arduino-servo-dial">
                      <span
                        className="arduino-servo-needle"
                        style={{ transform: `rotate(${snapshot.servo.angle - 90}deg)` }}
                      />
                    </div>
                    <span className="arduino-part-value">
                      {snapshot.servo.attached ? `${snapshot.servo.angle}°` : "chưa gắn"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="arduino-part-group">
                <span className="arduino-part-title">ĐẦU VÀO</span>

                <div className={`arduino-part arduino-input-part ${pressed ? "is-on" : ""}`}>
                  <span className="arduino-part-name">
                    <Lightbulb size={12} /> NÚT NHẤN · D2
                  </span>
                  <button
                    type="button"
                    className={`arduino-push ${pressed ? "is-pressed" : ""}`}
                    onPointerDown={onButtonDown}
                    onPointerUp={() => pressButton(false)}
                    onPointerCancel={() => pressButton(false)}
                    onPointerLeave={() => pressButton(false)}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        pressButton(true);
                      }
                    }}
                    onKeyUp={() => pressButton(false)}
                    aria-label="Giữ để nhấn nút ở chân D2"
                  >
                    <span />
                  </button>
                  <span className="arduino-part-value">{pressed ? "đang nhấn" : "nhả"}</span>
                </div>

                <label className="arduino-part arduino-input-part">
                  <span className="arduino-part-name">BIẾN TRỞ · A0</span>
                  <input
                    type="range"
                    min={0}
                    max={1023}
                    value={pot}
                    onChange={(event) => onPotChange(Number(event.target.value))}
                    aria-label="Giá trị biến trở A0"
                  />
                  <span className="arduino-part-value">
                    {snapshot.pot} · {potLevel}%
                  </span>
                </label>

              </div>
            </div>
          </section>

          <section className="arduino-panel arduino-serial" aria-label="Serial Monitor">
            <div className="arduino-panel-head">
              <span className="arduino-file">
                <Terminal size={13} /> SERIAL MONITOR
                <em>{snapshot.baud} baud</em>
              </span>
              <div className="arduino-head-tools">
                <button
                  type="button"
                  className={`arduino-tool ${autoScroll ? "is-on" : ""}`}
                  onClick={() => setAutoScroll((value) => !value)}
                  title={autoScroll ? "Đang tự cuộn" : "Bật tự cuộn"}
                >
                  <ChevronRight size={13} style={{ transform: "rotate(90deg)" }} />
                </button>
                <button type="button" className="arduino-tool" onClick={clearSerial} title="Xoá Serial Monitor">
                  <Trash size={13} />
                </button>
                <button
                  type="button"
                  className={`arduino-tool ${muted ? "" : "is-on"}`}
                  onClick={() => setMuted((value) => !value)}
                  title={muted ? "Bật âm thanh còi" : "Tắt âm thanh còi"}
                >
                  {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            </div>

            <div className="arduino-serial-log" ref={logRef} role="log" aria-live="polite">
              {snapshot.serial.length === 0 ? (
                <p className="arduino-serial-empty">
                  Chưa có dữ liệu. Thêm <code>Serial.begin(9600)</code> và <code>Serial.println("…")</code>{" "}
                  vào sketch rồi bấm CHẠY.
                </p>
              ) : (
                snapshot.serial.map((line, index) => (
                  <div className="arduino-serial-line" key={index}>
                    {line || "\u00a0"}
                  </div>
                ))
              )}
            </div>

            <form className="arduino-serial-send" onSubmit={sendSerial}>
              <input
                value={serialInput}
                onChange={(event) => setSerialInput(event.target.value)}
                placeholder="Gửi dữ liệu xuống bo (Serial.read)…"
                aria-label="Gửi dữ liệu xuống Arduino"
              />
              <button type="submit" className="btn btn-ghost" disabled={!serialInput}>
                <Send size={13} /> GỬI
              </button>
            </form>
          </section>
        </div>
      </div>

      <section className="arduino-examples">
        <div className="arduino-examples-head">
          <div>
            <span className="kicker">VÍ DỤ MẪU</span>
            <h2>Chọn một sketch để bắt đầu</h2>
          </div>
          <span>{EXAMPLES.length} ví dụ · chạy hoàn toàn offline</span>
        </div>

        <div className="arduino-example-grid">
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example.id}
              className={`arduino-example ${example.id === exampleId ? "is-active" : ""}`}
              onClick={() => loadExample(example.id)}
            >
              <span className="arduino-example-top">
                <span className={`arduino-tag is-${levelSlug(example.level)}`}>{example.level}</span>
                <span className="arduino-example-pins">{example.pins}</span>
              </span>
              <strong>{example.title}</strong>
              <span className="arduino-example-summary">{example.summary}</span>
              <span className="arduino-example-cta">
                NẠP VÀO EDITOR <ChevronRight size={13} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="arduino-footnote">
        Bo mạch ảo mô phỏng Arduino Uno ở mức logic: chân số, PWM, Serial, còi và servo. Các
        sketch dùng thư viện phần cứng đặc thù (LCD, cảm biến nhiệt, thẻ SD…) cần phần cứng thật.
      </p>
    </div>
  );
}

function BoardView({ snapshot }: { snapshot: BoardSnapshot }) {
  return (
    <svg className="arduino-board" viewBox="0 0 600 320" role="img" aria-label="Sơ đồ Arduino Uno ảo">
      <defs>
        <linearGradient id="unoPcb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f7a6d" />
          <stop offset="100%" stopColor="#095a50" />
        </linearGradient>
      </defs>

      <rect x="10" y="10" width="580" height="300" rx="24" className="uno-pcb" />
      <circle cx="32" cy="32" r="5" className="uno-hole" />
      <circle cx="568" cy="32" r="5" className="uno-hole" />
      <circle cx="32" cy="288" r="5" className="uno-hole" />
      <circle cx="568" cy="288" r="5" className="uno-hole" />

      <rect x="36" y="58" width="66" height="50" rx="5" className="uno-metal" />
      <rect x="45" y="68" width="48" height="30" rx="3" className="uno-metal-slot" />

      <circle cx="124" cy="68" r="4.5" className={snapshot.tx ? "uno-tx is-on" : "uno-tx"} />
      <circle cx="124" cy="86" r="4.5" className="uno-rx" />
      <text x="134" y="71" className="uno-micro">TX</text>
      <text x="134" y="89" className="uno-micro">RX</text>

      <text x="150" y="66" className="uno-brand">
        ARDUINO UNO
      </text>
      <text x="150" y="82" className="uno-brand-sub">
        AZTEACH · VIRTUAL BOARD
      </text>

      <circle cx="500" cy="64" r="15" className="uno-reset" />
      <circle cx="500" cy="64" r="8" className="uno-reset-inner" />
      <text x="500" y="94" className="uno-micro" textAnchor="middle">
        RESET
      </text>

      <rect x="140" y="106" width="430" height="30" rx="6" className="uno-header" />
      {DIGITAL_PINS.map((pin) => {
        const state = snapshot.pins[pin];
        const active = state.mode === "output" && state.level > 0.02;
        return (
          <g key={pin}>
            <text x={158 + pin * 30} y={102} className="uno-pin-label" textAnchor="middle">
              {pin}
            </text>
            <rect
              x={148 + pin * 30}
              y={112}
              width={20}
              height={18}
              rx={3}
              className={`uno-pin ${state.mode === "output" ? "is-out" : ""} ${active ? "is-high" : ""}`}
              style={active ? { opacity: 0.4 + state.level * 0.6 } : undefined}
            />
          </g>
        );
      })}

      <rect x="244" y="158" width="120" height="76" rx="8" className="uno-chip" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={`top-${index}`} x={252 + index * 16} y={153} width={8} height={7} className="uno-chip-pin" />
      ))}
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={`bottom-${index}`} x={252 + index * 16} y={232} width={8} height={7} className="uno-chip-pin" />
      ))}
      <text x="304" y="192" className="uno-chip-name" textAnchor="middle">
        ATmega328P
      </text>
      <text x="304" y="208" className="uno-chip-sub" textAnchor="middle">
        16 MHz · 5V
      </text>

      <circle cx="86" cy="212" r="23" className="uno-jack" />
      <rect x="74" y="200" width="24" height="24" rx="5" className="uno-jack-inner" />

      <rect x="140" y="262" width="200" height="30" rx="6" className="uno-header" />
      {ANALOG_PINS.map((pin, index) => {
        const state = snapshot.pins[pin];
        const lit = state.mode === "input" && snapshot.pot > 0;
        return (
          <g key={pin}>
            <text x={158 + index * 30} y={258} className="uno-pin-label" textAnchor="middle">
              {pinLabel(pin)}
            </text>
            <rect
              x={148 + index * 30}
              y={268}
              width={20}
              height={18}
              rx={3}
              className={`uno-pin ${lit ? "is-analog" : ""}`}
            />
          </g>
        );
      })}

      <rect x="366" y="262" width="170" height="30" rx="6" className="uno-header" />
      {["GND", "5V", "3V3", "VIN"].map((label, index) => (
        <g key={label}>
          <text x={386 + index * 40} y={258} className="uno-pin-label" textAnchor="middle">
            {label}
          </text>
          <rect x={376 + index * 40} y={268} width={20} height={18} rx={3} className="uno-pin is-power" />
        </g>
      ))}

      <path className="uno-trace" d="M102 132 H120 V156 H244" />
      <path className="uno-trace" d="M364 196 H420 V136" />
      <path className="uno-trace" d="M364 172 H452 V262" />
    </svg>
  );
}
