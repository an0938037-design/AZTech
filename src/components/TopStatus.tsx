import { useEffect, useState } from "react";
import { Cloud, Menu, WifiOff } from "lucide-react";
import { useStore } from "../store";
import type { View } from "../store";

interface Props {
  onMenu: () => void;
}

const VIEW_LABEL: Record<View, string> = {
  home: "TRANG CHỦ",
  create: "TẠO BÀI HỌC",
  lesson: "BÀI HỌC",
  account: "TÀI KHOẢN",
  study: "GHI CHÚ",
  geometry: "HÌNH HỌC 3D",
  lab: "PHÒNG LAB 3D",
  library: "THƯ VIỆN",
};

function clock(date: Date): string {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function TopStatus({ onMenu }: Props) {
  const view = useStore((s) => s.view);
  const account = useStore((s) => s.account);
  const setView = useStore((s) => s.setView);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="top-status">
      <button
        type="button"
        className="top-menu"
        onClick={onMenu}
        aria-label="Mở thanh điều hướng"
      >
        <Menu size={17} />
      </button>

      <div className="top-status-capsule">
        <span className="top-kicker">HỆ THỐNG HỌC TẬP CÁ NHÂN</span>
        <span className="top-dot" aria-hidden="true" />
        <span className="top-view">{VIEW_LABEL[view] ?? "TRANG CHỦ"}</span>
        <span className={`top-pill ${account ? "is-cloud" : ""}`}>
          {account ? <Cloud size={11} /> : <WifiOff size={11} />}
          {account ? `CLOUD · ${account.code}` : "LOCAL"}
        </span>
        <button
          type="button"
          className="top-manage"
          onClick={() => setView("account")}
          aria-label="Quản lý tài khoản"
        >
          QUẢN LÝ
        </button>
        <span className="top-clock">
          <span className="top-live" aria-hidden="true" />
          {clock(now)}
        </span>
      </div>
    </header>
  );
}
