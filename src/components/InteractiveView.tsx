import { useMemo } from "react";
import { CircleAlert, SlidersHorizontal } from "lucide-react";
import type { SavedLesson } from "../storage";
import { buildFallbackInteractive } from "../fallbackArtifacts";
import SandboxFrame from "./SandboxFrame";

export default function InteractiveView({ lesson }: { lesson: SavedLesson }) {
  const artifact = lesson.artifacts?.interactive;
  const valid = artifact?.kind === "interactive";
  const fallback = useMemo(
    () =>
      valid
        ? null
        : buildFallbackInteractive(lesson),
    [valid, lesson]
  );
  const active = valid && artifact ? artifact : fallback;

  if (!active) {
    return (
      <div className="empty-state">
        <SlidersHorizontal size={28} />
        <h2>Chưa có mô hình tương tác</h2>
        <p>Kênh này chưa được sinh cho bài học hiện tại.</p>
      </div>
    );
  }

  const widget =
    typeof active.meta?.widget === "string" ? active.meta.widget : "generic";

  return (
    <div className="artifact-view">
      <div className="artifact-head">
        <div>
          <span className="kicker">KÊNH 03 · MÔ HÌNH TƯƠNG TÁC</span>
          <h2>{active.title}</h2>
        </div>
        <div className="artifact-chips">
          <span className="chip">SANDBOX</span>
          <span className="chip">{widget.toUpperCase()}</span>
          {!valid && <span className="chip chip-strong">DỰNG CỤC BỘ</span>}
        </div>
      </div>
      <p className="artifact-desc">
        Thay đổi tham số để xem kết quả cập nhật trực tiếp. Mô hình không gọi
        mạng, không dùng thư viện ngoài và không thể chạm vào trang cha.
      </p>
      {!valid && (
        <div className="artifact-warning">
          <CircleAlert size={15} />
          <span>
            {artifact
              ? "Dữ liệu mô hình sai kênh (kind không khớp). Hệ thống dùng bản dựng cục bộ theo môn học."
              : "Bài học chưa có artifact mô hình. Hệ thống dựng bản tương tác dự phòng theo môn."}
          </span>
        </div>
      )}
      <SandboxFrame artifact={active} minHeight={620} />
    </div>
  );
}
