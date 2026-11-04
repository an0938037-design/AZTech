import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Database,
  Info,
  Monitor,
  Moon,
  Palette as PaletteIcon,
  Sun,
} from "lucide-react";
import Account from "./Account";
import { PALETTES, useAppearanceStore } from "../palettes";
import { useStore } from "../store";
import { countLocalLessons } from "../storage";

type Section = "root" | "account" | "appearance" | "device" | "data" | "about";

const SECTION_TITLE: Record<Exclude<Section, "root">, string> = {
  account: "Tài khoản & AI",
  appearance: "Giao diện",
  device: "Thiết bị",
  data: "Dữ liệu",
  about: "Giới thiệu",
};

export default function Settings() {
  const [section, setSection] = useState<Section>("root");
  const setView = useStore((s) => s.setView);
  const account = useStore((s) => s.account);
  const deviceCode = useStore((s) => s.deviceCode);
  const lessons = useStore((s) => s.lessons);
  const theme = useAppearanceStore((s) => s.theme);
  const palette = useAppearanceStore((s) => s.palette);
  const toggleTheme = useAppearanceStore((s) => s.toggleTheme);
  const setPalette = useAppearanceStore((s) => s.setPalette);
  const [copied, setCopied] = useState(false);

  const isDark = theme === "dark";
  const localCount = countLocalLessons();

  const copyDevice = async () => {
    try {
      await navigator.clipboard.writeText(deviceCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (section === "account") {
    return (
      <div className="settings-host">
        <Account onBack={() => setSection("root")} />
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="page-head">
        <div className="page-head-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView("home")}
            aria-label="Về trang chủ"
          >
            <ArrowLeft size={17} />
          </button>
          <div>
            <span className="kicker">HỆ THỐNG</span>
            <h1>Cài đặt</h1>
          </div>
        </div>
        <div className="page-head-meta">
          <span className={`status-pill ${account ? "is-cloud" : ""}`}>
            {account ? <Cloud size={12} /> : <Database size={12} />}
            {account ? `CLOUD · ${account.code}` : "LOCAL"}
          </span>
        </div>
      </header>

      <div className="settings-body">
        <section className="settings-group">
          <p className="settings-group-title">TÀI KHOẢN</p>
          <button
            type="button"
            className="settings-row"
            onClick={() => setSection("account")}
          >
            <span className="settings-row-icon is-cloud">
              <Cloud size={15} />
            </span>
            <span className="settings-row-label">Tài khoản cloud & AI</span>
            <span className="settings-row-value">
              {account ? account.code : "Chưa kết nối"}
            </span>
            <ChevronRight size={15} className="settings-chevron" />
          </button>
          <button
            type="button"
            className="settings-row"
            onClick={() => setSection("device")}
          >
            <span className="settings-row-icon">
              <Monitor size={15} />
            </span>
            <span className="settings-row-label">Thiết bị này</span>
            <span className="settings-row-value">{deviceCode}</span>
            <ChevronRight size={15} className="settings-chevron" />
          </button>
        </section>

        <section className="settings-group">
          <p className="settings-group-title">GIAO DIỆN</p>
          <div className="settings-row is-static">
            <span className="settings-row-icon">
              {isDark ? <Moon size={15} /> : <Sun size={15} />}
            </span>
            <span className="settings-row-label">
              {isDark ? "Chế độ tối" : "Chế độ sáng"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!isDark}
              aria-label="Đổi sang chế độ sáng hoặc tối"
              className={`settings-switch ${isDark ? "" : "is-on"}`}
              onClick={toggleTheme}
            >
              <span className="settings-switch-knob" />
            </button>
          </div>
          <button
            type="button"
            className="settings-row"
            onClick={() => setSection("appearance")}
          >
            <span className="settings-row-icon is-palette">
              <PaletteIcon size={15} />
            </span>
            <span className="settings-row-label">Bảng màu hành tinh</span>
            <span className="settings-row-value">
              {PALETTES.find((p) => p.id === palette)?.name ?? "Sao Thuỷ"}
            </span>
            <ChevronRight size={15} className="settings-chevron" />
          </button>
        </section>

        <section className="settings-group">
          <p className="settings-group-title">DỮ LIỆU</p>
          <button
            type="button"
            className="settings-row"
            onClick={() => setSection("data")}
          >
            <span className="settings-row-icon">
              <Database size={15} />
            </span>
            <span className="settings-row-label">Bài học & lưu trữ</span>
            <span className="settings-row-value">{lessons.length} bài</span>
            <ChevronRight size={15} className="settings-chevron" />
          </button>
          <button
            type="button"
            className="settings-row"
            onClick={() => setSection("about")}
          >
            <span className="settings-row-icon">
              <Info size={15} />
            </span>
            <span className="settings-row-label">Giới thiệu</span>
            <span className="settings-row-value">v2 · pipeline 3 tầng</span>
            <ChevronRight size={15} className="settings-chevron" />
          </button>
        </section>
      </div>

      {section !== "root" && (
        <div className="settings-sheet">
          <div className="settings-sheet-head">
            <button
              type="button"
              className="text-btn"
              onClick={() => setSection("root")}
            >
              <ArrowLeft size={13} /> QUAY LẠI
            </button>
            <strong>{SECTION_TITLE[section as Exclude<Section, "root">]}</strong>
          </div>

          {section === "appearance" && (
            <div className="palette-grid">
              {PALETTES.map((pal) => {
                const active = pal.id === palette;
                return (
                  <button
                    type="button"
                    key={pal.id}
                    className={`palette-swatch ${active ? "is-active" : ""}`}
                    onClick={() => setPalette(pal.id)}
                    aria-pressed={active}
                  >
                    <span
                      className="palette-sweep"
                      style={{ background: `linear-gradient(135deg, ${pal.bg}, ${pal.accent})` }}
                    />
                    <span className="palette-swatch-name">{pal.name}</span>
                    {active && <Check size={13} className="palette-swatch-check" />}
                  </button>
                );
              })}
            </div>
          )}

          {section === "device" && (
            <div className="settings-detail">
              <p className="panel-note">
                Mã thiết bị xác định máy này trong hệ thống. Khi đăng nhập cùng mã
                trên thiết bị khác, bài học cloud sẽ hiện ra mà không cần tạo lại
                tài khoản.
              </p>
              <div className="device-code-row">
                <strong className="device-code-big">{deviceCode}</strong>
                <button type="button" className="btn btn-sm" onClick={copyDevice}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "ĐÃ SAO CHÉP" : "SAO CHÉP"}
                </button>
              </div>
            </div>
          )}

          {section === "data" && (
            <div className="settings-detail">
              <div className="data-row">
                <span>Bài học đang hiển thị</span>
                <strong>{lessons.length}</strong>
              </div>
              <div className="data-row">
                <span>Bài học cục bộ (trình duyệt)</span>
                <strong>{localCount}</strong>
              </div>
              <div className="data-row">
                <span>Nơi lưu</span>
                <strong>{account ? "Supabase cloud" : "localStorage"}</strong>
              </div>
              <p className="panel-note">
                {account
                  ? "Bài học tạo trong tài khoản được đồng bộ qua backend Supabase."
                  : "Chưa kết nối tài khoản nên bài học chỉ lưu trên máy này."}
              </p>
            </div>
          )}

          {section === "about" && (
            <div className="settings-detail">
              <p className="panel-note">
                <strong>AZTeach · AI Learning Engine</strong> — pipeline ba tầng:
                phân tích, dựng bài giảng, tạo mindmap và tương tác. Hệ mặt trời là
                bản đồ tri thức: hành tinh là môn học, vệ tinh là chương, trạm là
                bài học, vành đai tiểu hành tinh là khu kiểm tra đánh giá.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
