import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  Square,
  X,
} from "lucide-react";
import { useStore } from "../store";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const CHANNELS = [
  { key: "lecture", label: "Bài giảng", note: "Cấu trúc khối nội dung" },
  { key: "mindmap", label: "Sơ đồ tư duy", note: "HTML/CSS/JS trong sandbox" },
  { key: "interactive", label: "Mô hình tương tác", note: "Tham số chạy trực tiếp" },
] as const;

export default function PipelineOverlay() {
  const generating = useStore((s) => s.generating);
  const pipeline = useStore((s) => s.pipeline);
  const subject = useStore((s) => s.subject);
  const topic = useStore((s) => s.topic);
  const cancelGenerate = useStore((s) => s.cancelGenerate);
  const [elapsed, setElapsed] = useState(0);

  const active = generating || pipeline.active;

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = pipeline.startedAt || Date.now();
    const tick = () => setElapsed(Date.now() - started);
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [active, pipeline.startedAt]);

  if (!active) return null;

  const doneChannels = CHANNELS.filter(
    (channel) => pipeline[channel.key] === "done"
  ).length;
  const errorChannels = CHANNELS.filter(
    (channel) => pipeline[channel.key] === "error"
  ).length;

  let progress = 8;
  if (pipeline.stage === "analyzing") progress = 18;
  if (pipeline.stage === "generating") progress = 36 + doneChannels * 18;
  if (pipeline.stage === "done") progress = 100;
  if (pipeline.stage === "error") progress = Math.max(18, 36 + doneChannels * 18);
  progress = Math.min(100, progress);

  const title =
    pipeline.stage === "analyzing"
      ? "Phân tích đề bài"
      : pipeline.stage === "generating"
        ? "Sinh ba kênh song song"
        : pipeline.stage === "error"
          ? "Pipeline dừng lại"
          : "Đang hoàn tất";

  return (
    <div
      className="pipeline-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Đang tạo bài học"
    >
      <div className="pipeline-grid" aria-hidden="true" />
      <div className="pipeline-shell">
        <div className="pipeline-top">
          <span className="kicker">PIPELINE 3 TẦNG · ĐANG CHẠY</span>
          <span className="pipeline-timer">{formatElapsed(elapsed)}</span>
        </div>

        <div className="pipeline-hero">
          <div className="pipeline-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="pipeline-heading">
            <h1>{title}</h1>
            <p>
              {subject || "Chung"} <span>/</span> {topic || "Chưa đặt tên"}
            </p>
          </div>
        </div>

        <div className="pipeline-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="pipeline-progress-meta">
          <span>{progress}%</span>
          <span>
            {doneChannels}/3 kênh hoàn tất
            {errorChannels > 0 ? ` · ${errorChannels} lỗi` : ""}
          </span>
        </div>

        <div className="pipeline-steps">
          <div
            className={`pipeline-step ${
              pipeline.stage === "analyzing" ? "is-active" : ""
            } ${pipeline.stage !== "analyzing" ? "is-done" : ""}`}
          >
            <span className="step-number">01</span>
            <div>
              <strong>Phân tích đề</strong>
              <p>Tách cấu trúc bài giảng, sơ đồ và mô hình.</p>
            </div>
            <span className="step-state">
              {pipeline.stage === "analyzing" ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Check size={14} />
              )}
            </span>
          </div>

          <div
            className={`pipeline-step ${
              pipeline.stage === "generating" ? "is-active" : ""
            } ${
              pipeline.stage === "done" || doneChannels > 0 ? "is-done" : ""
            }`}
          >
            <span className="step-number">02</span>
            <div>
              <strong>Sinh nội dung</strong>
              <p>Ba kênh độc lập chạy song song, không trộn dữ liệu.</p>
            </div>
            <span className="step-state">
              {pipeline.stage === "generating" ? (
                <LoaderCircle size={14} className="spin" />
              ) : pipeline.stage === "done" ? (
                <Check size={14} />
              ) : (
                <Square size={12} />
              )}
            </span>
          </div>

          <div
            className={`pipeline-step ${
              pipeline.stage === "done" ? "is-done" : ""
            } ${pipeline.stage === "error" ? "is-error" : ""}`}
          >
            <span className="step-number">03</span>
            <div>
              <strong>Kiểm tra chéo</strong>
              <p>Đối chiếu kind, ghép bản nháp và giữ nguyên trong RAM.</p>
            </div>
            <span className="step-state">
              {pipeline.stage === "error" ? (
                <CircleAlert size={14} />
              ) : pipeline.stage === "done" ? (
                <Check size={14} />
              ) : (
                <Square size={12} />
              )}
            </span>
          </div>
        </div>

        <div className="pipeline-channels">
          {CHANNELS.map((channel) => {
            const status = pipeline[channel.key];
            return (
              <div
                key={channel.key}
                className={`channel-row channel-${status}`}
              >
                <span className="channel-dot" aria-hidden="true" />
                <div>
                  <strong>{channel.label}</strong>
                  <p>{channel.note}</p>
                </div>
                <span className="channel-state">
                  {status === "pending" && "ĐANG CHỜ"}
                  {status === "done" && "XONG"}
                  {status === "error" && "LỖI"}
                  {status === "idle" && "CHƯA CHẠY"}
                </span>
                {status === "pending" && (
                  <LoaderCircle size={14} className="spin" />
                )}
                {status === "done" && <Check size={14} />}
                {status === "error" && <X size={14} />}
              </div>
            );
          })}
        </div>

        {pipeline.error && (
          <div className="pipeline-error">
            <CircleAlert size={16} />
            <span>{pipeline.error}</span>
          </div>
        )}

        <div className="pipeline-footer">
          <p>
            Kết quả phân tích không được lưu. Bản nháp chỉ nằm trong RAM và
            biến mất khi đóng tab hoặc tải lại trang.
          </p>
          <button type="button" className="btn btn-ghost" onClick={cancelGenerate}>
            Huỷ pipeline
          </button>
        </div>
      </div>
    </div>
  );
}
