import { ArrowLeft, ChevronRight } from "lucide-react";
import { SIM_WORLDS } from "../worlds";
import { useStore } from "../store";

export default function SimulationHub() {
  const setView = useStore((s) => s.setView);

  return (
    <div className="sim-page">
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
            <span className="kicker">VÀNH ĐAI TIỂU HÀNH TINH</span>
            <h1>Mô phỏng</h1>
          </div>
        </div>
        <div className="page-head-meta">
          <span className="chip">{SIM_WORLDS.length} thế giới</span>
        </div>
      </header>

      <div className="sim-body">
        <p className="sim-lede">
          Ba thế giới giả tưởng trôi giữa vành đai — không theo thiên văn thật, mỗi
          thế giới mang một vật liệu và quy tắc riêng. Chọn một thế giới để bước vào
          phòng mô phỏng.
        </p>

        <div className="sim-grid">
          {SIM_WORLDS.map((world) => (
            <button
              type="button"
              key={world.id}
              className={`sim-world is-${world.id}`}
              onClick={() => setView(world.view)}
            >
              <span className="sim-orb" aria-hidden="true">
                <span className="sim-orb-ring" />
                <span className="sim-orb-core" />
                <span className="sim-orb-shine" />
              </span>

              <span className="sim-world-designation">{world.designation}</span>
              <span className="sim-world-name">{world.name}</span>
              <span className="sim-world-latin">{world.latin}</span>
              <p className="sim-world-tag">{world.tagline}</p>

              <span className="sim-world-traits">
                {world.traits.map((trait) => (
                  <em key={trait}>{trait}</em>
                ))}
              </span>

              <span className="sim-world-enter">
                NHẬP THẾ GIỚI <ChevronRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
