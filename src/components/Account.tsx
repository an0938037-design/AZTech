import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Cloud,
  Copy,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { useStore } from "../store";
import { listModels } from "../api";
import { countLocalLessons } from "../storage";
import type { AiProvider } from "../types";

type Message = { ok: boolean; text: string };
type Busy = "save" | "test" | "models" | "activate" | "migrate" | null;

export default function Account({ onBack }: { onBack?: () => void }) {
  const account = useStore((s) => s.account);
  const accountLoading = useStore((s) => s.accountLoading);
  const deviceCode = useStore((s) => s.deviceCode);
  const createAccount = useStore((s) => s.createAccount);
  const bindAccount = useStore((s) => s.bindAccount);
  const saveAiSettings = useStore((s) => s.saveAiSettings);
  const setActiveProvider = useStore((s) => s.setActiveProvider);
  const testAi = useStore((s) => s.testAi);
  const migrateLocalLessons = useStore((s) => s.migrateLocalLessons);
  const importFile = useStore((s) => s.importFile);
  const loadJson = useStore((s) => s.loadJson);
  const setView = useStore((s) => s.setView);

  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [keyInput, setKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [bindCode, setBindCode] = useState("");
  const [copied, setCopied] = useState<"account" | "device" | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [localCount, setLocalCount] = useState(() => countLocalLessons());

  useEffect(() => {
    if (!account) return;
    setProvider(account.activeProvider);
    setModelInput(account.ai[account.activeProvider]?.model ?? "");
    setKeyInput("");
    setModels([]);
  }, [account?.code]);

  useEffect(() => {
    setLocalCount(countLocalLessons());
  }, [account?.code]);

  const providerConfig = account?.ai[provider];
  const hasKey = Boolean(providerConfig?.hasKey);
  const isActive = account?.activeProvider === provider;
  const providerLabel = provider === "openrouter" ? "OpenRouter" : "Gemini";
  const canSave =
    Boolean(account) &&
    (provider === "gemini" || modelInput.trim().length > 0);

  const switchProvider = (next: AiProvider) => {
    setProvider(next);
    setKeyInput("");
    setModelInput(account?.ai[next]?.model ?? "");
    setShowKey(false);
    setModels([]);
    setMessage(null);
  };

  const handleCopy = async (value: string, type: "account" | "device") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setMessage({ ok: false, text: "Không sao chép được vào clipboard." });
    }
  };

  const handleCreate = async () => {
    setMessage(null);
    const created = await createAccount();
    if (created) {
      setMessage({
        ok: true,
        text: `Đã tạo tài khoản ${created.code}. Hãy lưu mã này để dùng trên thiết bị khác.`,
      });
    }
  };

  const handleBind = async () => {
    const code = bindCode.trim();
    if (!/^\d{8}$/.test(code)) {
      setMessage({ ok: false, text: "Mã tài khoản phải gồm đúng 8 chữ số." });
      return;
    }
    setMessage(null);
    const bound = await bindAccount(code);
    if (bound) {
      setMessage({
        ok: true,
        text: `Đã ghép thiết bị vào tài khoản ${bound.code}.`,
      });
      setBindCode("");
    }
  };

  const handleSave = async () => {
    if (!canSave || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const updated = await saveAiSettings(
        provider,
        keyInput.trim() || undefined,
        modelInput.trim()
      );
      if (updated) {
        setKeyInput("");
        setMessage({
          ok: true,
          text:
            updated.activeProvider === provider
              ? `Đã lưu cấu hình ${providerLabel}. Key được mã hoá trên server.`
              : `Đã lưu cấu hình ${providerLabel}. Bấm “Dùng provider này” để áp dụng cho pipeline.`,
        });
      } else {
        setMessage({
          ok: false,
          text: "Không lưu được cấu hình. Kiểm tra kết nối backend.",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    if (busy) return;
    setBusy("test");
    setMessage(null);
    try {
      const result = await testAi(
        provider,
        keyInput.trim() || undefined,
        modelInput.trim()
      );
      setMessage({ ok: true, text: result.message });
      if (result.models) setModels(result.models.slice(0, 120));
    } catch (error: unknown) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Không kiểm tra được kết nối AI.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleModels = async () => {
    if (busy) return;
    setBusy("models");
    setMessage(null);
    try {
      const result = await listModels(deviceCode, provider);
      const ids = result.models.map((item) => item.id).slice(0, 120);
      setModels(ids);
      setMessage({
        ok: true,
        text: `Đã tải ${ids.length} gợi ý model. Chọn trong ô tên model.`,
      });
    } catch (error: unknown) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách model.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleActivate = async () => {
    if (busy || !hasKey || isActive) return;
    setBusy("activate");
    setMessage(null);
    try {
      const updated = await setActiveProvider(provider);
      if (updated) {
        setMessage({
          ok: true,
          text: `${providerLabel} đã trở thành provider active cho toàn bộ pipeline.`,
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveKey = async () => {
    if (busy || !hasKey) return;
    if (!window.confirm(`Xoá API key ${providerLabel} đã lưu?`)) return;
    setBusy("save");
    setMessage(null);
    try {
      const updated = await saveAiSettings(provider, "", modelInput.trim());
      if (updated) {
        setMessage({ ok: true, text: `Đã xoá API key ${providerLabel}.` });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleMigrate = async () => {
    if (busy) return;
    setBusy("migrate");
    try {
      await migrateLocalLessons();
      setLocalCount(countLocalLessons());
    } finally {
      setBusy(null);
    }
  };

  if (accountLoading && !account) {
    return (
      <div className="account-page">
        <div className="empty-state">
          <RefreshCw size={26} className="spin" />
          <h2>Đang tải tài khoản</h2>
          <p>Kiểm tra kết nối backend và mã thiết bị.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <header className="page-head">
        <div className="page-head-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => (onBack ? onBack() : setView("library"))}
            aria-label={onBack ? "Quay lại cài đặt" : "Quay lại thư viện"}
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <span className="kicker">TÀI KHOẢN & AI</span>
            <h1>Kết nối pipeline</h1>
          </div>
        </div>
        <div className="page-head-meta">
          <span className={`status-pill ${account ? "is-cloud" : ""}`}>
            {account ? <Cloud size={12} /> : <Database size={12} />}
            {account ? "CLOUD" : "LOCAL"}
          </span>
          <span className="mono-muted">MÃ THIẾT BỊ {deviceCode}</span>
        </div>
      </header>

      {message && (
        <div className={`account-message ${message.ok ? "is-ok" : "is-bad"}`}>
          {message.ok ? <Check size={15} /> : <CircleAlert size={15} />}
          <span>{message.text}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMessage(null)}
            aria-label="Đóng thông báo"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {!account ? (
        <>
          <section className="account-hero">
            <div>
              <span className="kicker">CHƯA CÓ TÀI KHOẢN CLOUD</span>
              <h2>Tài khoản cloud</h2>
            </div>
            <div className="device-card">
              <span className="kicker">MÃ THIẾT BỊ</span>
              <strong>{deviceCode}</strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleCopy(deviceCode, "device")}
              >
                <Copy size={13} />
                {copied === "device" ? "ĐÃ COPY" : "COPY MÃ"}
              </button>
              <small>
                Mã này chỉ dùng để backend nhận ra trình duyệt. Không phải mã
                tài khoản.
              </small>
            </div>
          </section>

          <div className="account-grid">
            <section className="panel">
              <div className="panel-head">
                <span className="kicker">TẠO MỚI</span>
                <span className="chip">8 SỐ</span>
              </div>
              <h3 className="panel-title">Tạo tài khoản cloud</h3>
              <button
                type="button"
                className="btn btn-primary full"
                onClick={() => void handleCreate()}
                disabled={accountLoading}
              >
                <Cloud size={15} /> TẠO TÀI KHOẢN
              </button>
            </section>

            <section className="panel">
              <div className="panel-head">
                <span className="kicker">ĐÃ CÓ MÃ</span>
                <span className="chip">GHÉP THIẾT BỊ</span>
              </div>
              <h3 className="panel-title">Dùng mã tài khoản có sẵn</h3>
              <p className="panel-note">
                Nhập mã 8 số của tài khoản bạn đã tạo trước đó. Thiết bị này
                sẽ được gắn vào tài khoản đó.
              </p>
              <div className="inline-form">
                <input
                  className="input"
                  value={bindCode}
                  onChange={(event) =>
                    setBindCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="12345678"
                  inputMode="numeric"
                  maxLength={8}
                  aria-label="Mã tài khoản 8 số"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleBind()}
                  disabled={bindCode.length !== 8 || accountLoading}
                >
                  GHÉP
                </button>
              </div>
            </section>
          </div>

          <section className="panel panel-wide">
            <div className="panel-head">
              <span className="kicker">LƯU TRỮ HIỆN TẠI</span>
              <span className="chip">LOCAL</span>
            </div>

            <div className="storage-line">
              <Database size={14} />
              <span>
                {localCount} bài học đang nằm trên thiết bị. Dữ liệu không rời
                khỏi máy cho đến khi bạn chủ động nhập lên cloud.
              </span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="kicker">IMPORT</span>
              <span className="chip">FILE / JSON</span>
            </div>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-ghost full"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.docx,.pptx";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (file) {
                      await importFile(file);
                      setView("create");
                    }
                  };
                  input.click();
                }}
              >
                <Upload size={14} /> FILE
              </button>
              <button
                type="button"
                className="btn btn-ghost full"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "application/json,.json";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const result = loadJson(text);
                    if (!result.ok) {
                      window.alert(`JSON không hợp lệ: ${result.error ?? "không đọc được"}`);
                    } else {
                      setView("lesson");
                    }
                  };
                  input.click();
                }}
              >
                <FileText size={14} /> JSON
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="account-hero account-hero-connected">
            <div>
              <span className="kicker">ĐÃ KẾT NỐI CLOUD</span>
              <div className="account-code-row">
                <strong className="account-code">{account.code}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleCopy(account.code, "account")}
                >
                  <Copy size={13} />
                  {copied === "account" ? "ĐÃ COPY" : "COPY MÃ"}
                </button>
              </div>
              <p>
                Dùng mã này để ghép thiết bị khác. Mã thiết bị hiện tại là{" "}
                <span className="mono">{deviceCode}</span>. Không chia sẻ mã
                tài khoản cho người khác.
              </p>
            </div>
            <div className="account-facts">
              <div>
                <span>NGÀY TẠO</span>
                <strong>
                  {new Date(account.createdAt).toLocaleDateString("vi-VN")}
                </strong>
              </div>
              <div>
                <span>PROVIDER ACTIVE</span>
                <strong>
                  {account.activeProvider === "openrouter"
                    ? "OpenRouter"
                    : "Gemini"}
                </strong>
              </div>
              <div>
                <span>BÀI HỌC LOCAL</span>
                <strong>{localCount}</strong>
              </div>
            </div>
          </section>

          <section className="panel panel-wide">
            <div className="panel-head">
              <span className="kicker">AI PROVIDER</span>
              <span className="chip">MỖI TÀI KHOẢN LƯU RIÊNG</span>
            </div>
            <div className="provider-tabs" role="tablist" aria-label="Chọn AI provider">
              {(["gemini", "openrouter"] as AiProvider[]).map((item) => {
                const config = account.ai[item];
                const active = provider === item;
                const inUse = account.activeProvider === item;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    key={item}
                    className={`provider-tab ${active ? "is-active" : ""}`}
                    onClick={() => switchProvider(item)}
                  >
                    <span className="provider-tab-top">
                      <strong>{item === "openrouter" ? "OpenRouter" : "Gemini"}</strong>
                      {inUse && <span className="chip chip-strong">ĐANG DÙNG</span>}
                    </span>
                    <span className="provider-tab-model">
                      {config?.model || "Chưa đặt model"}
                    </span>
                    <span className="provider-tab-key">
                      {config?.hasKey ? config.keyHint || "Đã có key" : "Chưa có key"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="ai-form">
              <div className="ai-form-head">
                <div>
                  <span className="kicker">CẤU HÌNH {providerLabel.toUpperCase()}</span>
                  <h3 className="panel-title">
                    {provider === "openrouter"
                      ? "OpenRouter cần tên model chính xác"
                      : "Gemini dùng model mặc định nếu để trống"}
                  </h3>
                </div>
                <span className={`status-pill ${hasKey ? "is-cloud" : ""}`}>
                  <KeyRound size={12} />
                  {hasKey ? "ĐÃ CÓ KEY" : "CHƯA CÓ KEY"}
                </span>
              </div>

              <label className="field">
                <span>API KEY</span>
                <div className="key-input">
                  <input
                    className="input"
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                    placeholder={
                      hasKey
                        ? `Đã lưu ${providerConfig?.keyHint || "••••"} — nhập key mới để thay`
                        : provider === "openrouter"
                          ? "sk-or-v1-..."
                          : "AIza..."
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowKey((value) => !value)}
                    aria-label={showKey ? "Ẩn key" : "Hiện key"}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>TÊN MODEL</span>
                <div className="key-input">
                  <input
                    className="input"
                    value={modelInput}
                    onChange={(event) => setModelInput(event.target.value)}
                    placeholder={
                      provider === "openrouter"
                        ? "google/gemini-2.5-flash"
                        : "gemini-2.5-flash"
                    }
                    list="ai-model-options"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void handleModels()}
                    disabled={busy !== null}
                    title="Tải gợi ý model"
                    aria-label="Tải gợi ý model"
                  >
                    <RefreshCw
                      size={14}
                      className={busy === "models" ? "spin" : ""}
                    />
                  </button>
                </div>
                <datalist id="ai-model-options">
                  {models.map((model) => (
                    <option value={model} key={model} />
                  ))}
                </datalist>
                {provider === "openrouter" && !modelInput.trim() && (
                  <small className="field-hint is-warning">
                    OpenRouter bắt buộc nhập tên model, ví dụ{" "}
                    <span className="mono">google/gemini-2.5-flash</span>.
                  </small>
                )}
              </label>

              <div className="ai-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={!canSave || busy !== null}
                >
                  <Check size={14} />
                  {busy === "save" ? "ĐANG LƯU…" : "LƯU CẤU HÌNH"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleTest()}
                  disabled={busy !== null || (!hasKey && !keyInput.trim())}
                >
                  <RefreshCw
                    size={14}
                    className={busy === "test" ? "spin" : ""}
                  />
                  KIỂM TRA KẾT NỐI
                </button>
                {hasKey && !isActive && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleActivate()}
                    disabled={busy !== null}
                  >
                    DÙNG PROVIDER NÀY
                  </button>
                )}
                {hasKey && (
                  <button
                    type="button"
                    className="text-btn danger"
                    onClick={() => void handleRemoveKey()}
                    disabled={busy !== null}
                  >
                    XOÁ KEY
                  </button>
                )}
              </div>

              <div className="security-note">
                <ShieldCheck size={15} />
                <span className="kicker">KEY MÃ HOÁ AES-256-GCM</span>
              </div>
            </div>
          </section>

          <div className="account-grid">
            <section className="panel">
              <div className="panel-head">
                <span className="kicker">NHẬP BÀI CŨ</span>
                <span className="chip">{localCount} BÀI</span>
              </div>
              <h3 className="panel-title">Đưa dữ liệu local lên cloud</h3>

              <button
                type="button"
                className="btn btn-ghost full"
                onClick={() => void handleMigrate()}
                disabled={localCount === 0 || busy !== null}
              >
                <Database size={14} />
                {busy === "migrate" ? "ĐANG NHẬP…" : "NHẬP LÊN CLOUD"}
              </button>
            </section>

            <section className="panel">
              <div className="panel-head">
                <span className="kicker">IMPORT</span>
                <span className="chip">FILE / JSON</span>
              </div>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-ghost full"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf,.docx,.pptx";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (file) {
                        await importFile(file);
                        setView("create");
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload size={14} /> FILE
                </button>
                <button
                  type="button"
                  className="btn btn-ghost full"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "application/json,.json";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const result = loadJson(text);
                      if (!result.ok) {
                        window.alert(`JSON không hợp lệ: ${result.error ?? "không đọc được"}`);
                      } else {
                        setView("lesson");
                      }
                    };
                    input.click();
                  }}
                >
                  <FileText size={14} /> JSON
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <span className="kicker">THIẾT BỊ</span>
                <span className="chip">8 SỐ</span>
              </div>
              <h3 className="panel-title">Mã thiết bị hiện tại</h3>
              <div className="device-code-inline">
                <strong>{deviceCode}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleCopy(deviceCode, "device")}
                >
                  <Copy size={13} />
                  {copied === "device" ? "ĐÃ COPY" : "COPY"}
                </button>
              </div>

            </section>
          </div>
        </>
      )}
    </div>
  );
}
