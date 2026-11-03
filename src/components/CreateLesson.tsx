import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  FileText,
  Sparkles,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { SUBJECTS, TOPIC_SUGGESTIONS, subjectMeta } from "../subjects";

export default function CreateLesson() {
  const subject = useStore((s) => s.subject);
  const topic = useStore((s) => s.topic);
  const prompt = useStore((s) => s.prompt);
  const notes = useStore((s) => s.notes);
  const account = useStore((s) => s.account);
  const generating = useStore((s) => s.generating);
  const setField = useStore((s) => s.setField);
  const generate = useStore((s) => s.generate);
  const setView = useStore((s) => s.setView);
  const importFile = useStore((s) => s.importFile);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const suggestions = TOPIC_SUGGESTIONS[subject] ?? [];
  const canGenerate = topic.trim().length > 1 && !generating;
  const activeProvider = account?.activeProvider ?? null;
  const providerConfig = activeProvider ? account?.ai[activeProvider] : null;
  const providerLabel =
    activeProvider === "openrouter" ? "OpenRouter" : "Gemini";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    setFileName(file.name);
    try {
      await importFile(file);
    } catch (error: unknown) {
      setFileError(
        error instanceof Error ? error.message : "Không đọc được tệp."
      );
    }
  };

  return (
    <div className="create-page">
      <header className="page-head">
        <div className="page-head-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView("library")}
            aria-label="Quay lại thư viện"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <span className="kicker">TẠO BÀI HỌC · ĐẦU VÀO</span>
            <h1>Thiết lập đề bài</h1>
          </div>
        </div>
        <div className="page-head-meta">
          <span className={`status-pill ${account ? "is-cloud" : ""}`}>
            {account ? <Cloud size={12} /> : <WifiOff size={12} />}
            {account ? "CLOUD" : "LOCAL"}
          </span>
          <span className="mono-muted">
            {account ? account.code : "CHƯA KẾT NỐI"}
          </span>
        </div>
      </header>

      <div className="create-layout">
        <div className="create-form">
          <section className="form-section">
            <div className="form-section-head">
              <span className="form-index">01</span>
              <div>
                <h2>Môn học</h2>
                <p>Chọn một trong chín môn nền tảng.</p>
              </div>
            </div>
            <div className="subject-options">
              {SUBJECTS.map((item) => {
                const active = subject === item.name;
                return (
                  <button
                    type="button"
                    key={item.name}
                    className={`subject-option ${active ? "is-active" : ""}`}
                    onClick={() => setField("subject", item.name)}
                  >
                    <span className="subject-option-code">{item.short}</span>
                    <span>{item.name}</span>
                    {active && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="form-index">02</span>
              <div>
                <h2>Chủ đề bài học</h2>
                <p>Một câu ngắn, càng cụ thể càng tốt.</p>
              </div>
            </div>
            <input
              className="input input-lg"
              value={topic}
              onChange={(event) => setField("topic", event.target.value)}
              placeholder={`Ví dụ: ${suggestions[0] ?? "Cấu trúc tế bào"}`}
              maxLength={140}
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="suggestion-row">
                <span className="kicker">GỢI Ý</span>
                {suggestions.map((item) => (
                  <button
                    type="button"
                    className="suggestion-chip"
                    key={item}
                    onClick={() => setField("topic", item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="form-index">03</span>
              <div>
                <h2>Yêu cầu riêng</h2>
                <p>Không bắt buộc. Ví dụ: lớp 10, tập trung công thức, thêm ví dụ thực tế.</p>
              </div>
            </div>
            <textarea
              className="textarea"
              value={prompt}
              onChange={(event) => setField("prompt", event.target.value)}
              placeholder="Mô tả cách bạn muốn bài học được triển khai…"
              rows={3}
              maxLength={1200}
            />
            <span className="field-count">{prompt.length}/1200</span>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="form-index">04</span>
              <div>
                <h2>Ghi chú thô</h2>
                <p>Dán ghi chú, dàn ý hoặc nội dung cần bám sát.</p>
              </div>
            </div>
            <textarea
              className="textarea textarea-lg"
              value={notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder={"- Ý chính 1: mô tả\n- Ý chính 2: mô tả\n- Công thức: ..."}
              rows={8}
              maxLength={12000}
            />
            <span className="field-count">{notes.length}/12000</span>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <span className="form-index">05</span>
              <div>
                <h2>Hoặc nhập tài liệu</h2>
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.pptx"
              className="visually-hidden"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div
              className={`dropzone ${dragging ? "is-dragging" : ""} ${
                fileName ? "has-file" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInput.current?.click();
                }
              }}
            >
              <span className="dropzone-icon">
                {fileName ? <FileText size={20} /> : <Upload size={20} />}
              </span>
              <span>
                <strong>
                  {fileName || "Kéo tệp vào đây hoặc bấm để chọn"}
                </strong>
                <small>PDF · DOCX · PPTX — tối đa 12 MB</small>
              </span>
              {fileName && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFileName("");
                    setFileError(null);
                  }}
                  aria-label="Bỏ tệp"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {fileError && <p className="form-error">{fileError}</p>}
          </section>

          <div className="create-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!canGenerate}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {generating ? "ĐANG CHẠY PIPELINE…" : "TẠO BÀI HỌC"}
              {!generating && <ArrowRight size={15} />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={() => setView("library")}
            >
              HUỶ
            </button>
          </div>
        </div>

        <aside className="create-aside">
          <section className="panel panel-subtle">
            <span className="kicker">MÔN ĐANG CHỌN</span>
            <p className="panel-note">
              <strong>{subjectMeta(subject).name}</strong>
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="kicker">NGUỒN AI</span>
              <span className={`chip ${account ? "chip-strong" : ""}`}>
                {account ? "SẴN SÀNG" : "CỤC BỘ"}
              </span>
            </div>
            {account ? (
              <div className="source-info">
                <div className="source-row">
                  <span>Provider</span>
                  <strong>{providerLabel}</strong>
                </div>
                <div className="source-row">
                  <span>Model</span>
                  <strong>{providerConfig?.model || "Mặc định"}</strong>
                </div>
                <div className="source-row">
                  <span>API key</span>
                  <strong>
                    {providerConfig?.hasKey
                      ? providerConfig.keyHint || "Đã lưu"
                      : "Chưa có"}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm full"
                  onClick={() => setView("account")}
                >
                  CẤU HÌNH AI <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div className="source-empty">
                <WifiOff size={18} />
                <p>
                  Chưa có tài khoản. Pipeline sẽ dựng bản cục bộ và chỉ lưu
                  vào trình duyệt khi bạn giữ lại.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm full"
                  onClick={() => setView("account")}
                >
                  KẾT NỐI TÀI KHOẢN <ArrowRight size={13} />
                </button>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="kicker">LƯU TRỮ</span>
              <span className="chip">RAM</span>
            </div>

            <div className="storage-line">
              {account ? <Cloud size={14} /> : <WifiOff size={14} />}
              <span>
                {account
                  ? "Đích lưu: Supabase qua backend"
                  : "Đích lưu: localStorage của thiết bị"}
              </span>
            </div>
          </section>

          <section className="panel panel-subtle">
            <span className="kicker">MÔN ĐANG CHỌN</span>
            <p className="panel-note">
              <strong>{subjectMeta(subject).name}</strong>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
