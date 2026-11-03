import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, NotebookPen, RotateCcw } from "lucide-react";

const NOTES_KEY = "ai-learning-notes-v1";
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

export default function StudyCorner() {
  const [mode, setMode] = useState<"work" | "break">("work");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [notes, setNotes] = useState("");
  const [focus, setFocus] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(NOTES_KEY) || "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          const nextMode = mode === "work" ? "break" : "work";
          setMode(nextMode);
          return nextMode === "work" ? WORK_SECONDS : BREAK_SECONDS;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, mode]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", focus);
    return () => document.body.classList.remove("focus-mode");
  }, [focus]);

  useEffect(() => () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    document.body.classList.remove("focus-mode");
  }, []);

  const reset = () => {
    setRunning(false);
    setMode("work");
    setSecondsLeft(WORK_SECONDS);
  };

  const saveNotes = (value: string) => {
    setNotes(value);
    try {
      localStorage.setItem(NOTES_KEY, value);
    } catch {
      // ignore
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="study-corner">
      <header className="page-head">
        <div>
          <span className="kicker">GHI CHÚ</span>
          <h1>Ghi chú & tập trung</h1>
        </div>
        <div className="page-head-meta">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setFocus((value) => !value)}
          >
            {focus ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {focus ? "Thoát tập trung" : "Chế độ tập trung"}
          </button>
        </div>
      </header>

      <div className="study-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="kicker">POMODORO</span>
            <h3 className="panel-title">
              {mode === "work" ? "Phiên làm việc" : "Nghỉ ngắn"}
            </h3>
          </div>
          <div className="pomodoro">
            <div className="pomodoro-time">
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </div>
            <div className="pomodoro-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRunning((value) => !value)}
              >
                {running ? "Tạm dừng" : "Bắt đầu"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                <RotateCcw size={14} /> Đặt lại
              </button>
            </div>
            <p className="pomodoro-note">
              25 phút làm việc · 5 phút nghỉ. Tự chuyển phiên khi hết giờ.
            </p>
          </div>
        </section>

        <section className="panel panel-wide">
          <div className="panel-head">
            <span className="kicker">VỞ GHI CHÚ</span>
            <h3 className="panel-title">Ghi chú cá nhân</h3>
          </div>
          <textarea
            className="notes-area"
            value={notes}
            onChange={(event) => saveNotes(event.target.value)}
            placeholder="Ghi lại ý chính, công thức, câu hỏi cần ôn…"
            spellCheck={false}
          />
          <div className="notes-meta">
            <NotebookPen size={13} />
            <span>Tự lưu vào trình duyệt này.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
