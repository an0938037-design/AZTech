import { useMemo } from "react";
import { CircleAlert, Network } from "lucide-react";
import type { SavedLesson } from "../storage";
import { buildFallbackMindmap } from "../fallbackArtifacts";
import SandboxFrame from "./SandboxFrame";

export default function MindmapView({ lesson }: { lesson: SavedLesson }) {
  const artifact = lesson.artifacts?.mindmap;
  const valid = artifact?.kind === "mindmap";
  const fallback = useMemo(
    () => (valid ? null : buildFallbackMindmap(lesson)),
    [valid, lesson]
  );
  const active = valid && artifact ? artifact : fallback;

  if (!active) {
    return (
      <div className="empty-state">
        <Network size={28} />
        <h2>Chưa có sơ đồ tư duy</h2>
        <p>Kênh này chưa được sinh cho bài học hiện tại.</p>
      </div>
    );
  }

  return (
    <div className="artifact-view">
      <div className="artifact-head">
        <div>
          <span className="kicker">KÊNH 02 · SƠ ĐỒ TƯ DUY</span>
          <h2>{active.title}</h2>
        </div>
        <div className="artifact-chips">
          <span className="chip">SANDBOX</span>
          <span className="chip">KHÔNG MẠNG</span>
          {!valid && <span className="chip chip-strong">DỰNG CỤC BỘ</span>}
        </div>
      </div>
      <p className="artifact-desc">
        Sơ đồ thứ bậc dựng bằng HTML/CSS/JS thuần. Bấm vào từng nhánh để mở
        hoặc đóng, dùng thanh công cụ để mở rộng toàn bộ.
      </p>
      {!valid && (
        <div className="artifact-warning">
          <CircleAlert size={15} />
          <span>
            {artifact
              ? "Dữ liệu sơ đồ sai kênh (kind không khớp). Hệ thống dùng bản dựng cục bộ để tránh lẫn dữ liệu."
              : "Bài học chưa có artifact sơ đồ. Hệ thống dựng bản cục bộ từ cấu trúc bài giảng."}
          </span>
        </div>
      )}
      <SandboxFrame artifact={active} minHeight={560} />
    </div>
  );
}
