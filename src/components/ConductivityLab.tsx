import { useMemo, useState } from "react";
import {
  BatteryCharging,
  Droplets,
  Info,
  Lightbulb,
  Power,
  RotateCcw,
  Waves,
  Zap,
} from "lucide-react";

/* ==========================================================================
   ConductivityLab — so sánh chất điện li mạnh / yếu / không điện li.
   Mạch điện SVG có bóng đèn sáng theo độ dẫn, ion chuyển động trong dung dịch.
   ========================================================================== */

type ElectrolyteKind = "strong" | "weak" | "none";

interface Solute {
  id: string;
  formula: string;
  name: string;
  kind: ElectrolyteKind;
  base: number;
  color: string;
  ions: string[];
  equation: string;
  note: string;
}

const KIND_LABEL: Record<ElectrolyteKind, string> = {
  strong: "ĐIỆN LI MẠNH",
  weak: "ĐIỆN LI YẾU",
  none: "KHÔNG ĐIỆN LI",
};

const SOLUTES: Solute[] = [
  {
    id: "hcl",
    formula: "HCl",
    name: "Axit clohidric",
    kind: "strong",
    base: 98,
    color: "#7ee0ff",
    ions: ["H⁺", "Cl⁻"],
    equation: "HCl → H⁺ + Cl⁻",
    note: "Phân li hoàn toàn trong nước, dung dịch dẫn điện rất tốt.",
  },
  {
    id: "h2so4",
    formula: "H₂SO₄",
    name: "Axit sunfuric",
    kind: "strong",
    base: 97,
    color: "#b6a4ff",
    ions: ["H⁺", "SO₄²⁻"],
    equation: "H₂SO₄ → 2H⁺ + SO₄²⁻",
    note: "Axit mạnh, cho nhiều ion nên độ dẫn điện cao.",
  },
  {
    id: "naoh",
    formula: "NaOH",
    name: "Natri hidroxit",
    kind: "strong",
    base: 95,
    color: "#8be0c8",
    ions: ["Na⁺", "OH⁻"],
    equation: "NaOH → Na⁺ + OH⁻",
    note: "Bazơ mạnh, phân li hoàn toàn thành ion.",
  },
  {
    id: "nacl",
    formula: "NaCl",
    name: "Natri clorua",
    kind: "strong",
    base: 92,
    color: "#8fd8ff",
    ions: ["Na⁺", "Cl⁻"],
    equation: "NaCl → Na⁺ + Cl⁻",
    note: "Muối tan phân li hoàn toàn — nước muối dẫn điện tốt.",
  },
  {
    id: "nh4cl",
    formula: "NH₄Cl",
    name: "Ammoni clorua",
    kind: "strong",
    base: 90,
    color: "#a8e6a3",
    ions: ["NH₄⁺", "Cl⁻"],
    equation: "NH₄Cl → NH₄⁺ + Cl⁻",
    note: "Muối tan, phân li hoàn toàn. Dung dịch có môi trường axit nhẹ.",
  },
  {
    id: "cuso4",
    formula: "CuSO₄",
    name: "Đồng(II) sunfat",
    kind: "strong",
    base: 86,
    color: "#4aa8ff",
    ions: ["Cu²⁺", "SO₄²⁻"],
    equation: "CuSO₄ → Cu²⁺ + SO₄²⁻",
    note: "Dung dịch xanh lam, dẫn điện tốt nhờ các ion chuyển động.",
  },
  {
    id: "ch3coona",
    formula: "CH₃COONa",
    name: "Natri axetat",
    kind: "strong",
    base: 82,
    color: "#7fb8e8",
    ions: ["Na⁺", "CH₃COO⁻"],
    equation: "CH₃COONa → Na⁺ + CH₃COO⁻",
    note: "Muối tan phân li hoàn toàn, dung dịch có môi trường bazơ yếu.",
  },
  {
    id: "ch3cooh",
    formula: "CH₃COOH",
    name: "Axit axetic",
    kind: "weak",
    base: 16,
    color: "#f0b45a",
    ions: ["CH₃COO⁻", "H⁺ (ít)"],
    equation: "CH₃COOH ⇌ CH₃COO⁻ + H⁺",
    note: "Chỉ phân li một phần, số ion ít nên bóng đèn sáng yếu.",
  },
  {
    id: "c2h5oh",
    formula: "C₂H₅OH",
    name: "Cồn etylic",
    kind: "none",
    base: 0,
    color: "#cfd8e6",
    ions: [],
    equation: "C₂H₅OH → không tạo ion",
    note: "Tan trong nước nhưng không phân li thành ion, không dẫn điện.",
  },
  {
    id: "sugar",
    formula: "C₁₂H₂₂O₁₁",
    name: "Đường saccarozơ",
    kind: "none",
    base: 0,
    color: "#e8dfc8",
    ions: [],
    equation: "C₁₂H₂₂O₁₁ → không tạo ion",
    note: "Phân tử trung hoà, dung dịch đường không dẫn điện.",
  },
  {
    id: "water",
    formula: "H₂O",
    name: "Nước cất",
    kind: "none",
    base: 0.6,
    color: "#9ed8ea",
    ions: ["H⁺ (rất ít)", "OH⁻ (rất ít)"],
    equation: "H₂O ⇌ H⁺ + OH⁻ (rất yếu)",
    note: "Nước cất tự phân li rất ít, gần như không dẫn điện.",
  },
];

const ION_POSITIONS = Array.from({ length: 14 }, (_, index) => {
  const column = index % 7;
  const row = Math.floor(index / 7);
  return {
    x: 132 + column * 24 + (row === 1 ? 12 : 0),
    y: row === 0 ? 224 : 258,
    delay: (index % 5) * 0.42,
    duration: 2.6 + (index % 4) * 0.55,
  };
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function levelLabel(value: number): string {
  if (value >= 58) return "DẪN ĐIỆN TỐT";
  if (value >= 22) return "DẪN ĐIỆN TRUNG BÌNH";
  if (value >= 6) return "DẪN ĐIỆN YẾU";
  if (value > 1.6) return "GẦN NHƯ KHÔNG DẪN";
  return "KHÔNG DẪN ĐIỆN";
}

export default function ConductivityLab() {
  const [soluteId, setSoluteId] = useState("nacl");
  const [concentration, setConcentration] = useState(0.5);
  const [power, setPower] = useState(true);

  const solute = useMemo(
    () => SOLUTES.find((item) => item.id === soluteId) ?? SOLUTES[0],
    [soluteId]
  );

  const intensity = power
    ? clamp(solute.base * (0.55 + 0.45 * concentration), 0, 100)
    : 0;
  const glow = intensity / 100;
  const label = power ? levelLabel(intensity) : "MẠCH ĐANG NGẮT";
  const ionCount = Math.round(clamp(intensity / 7, 0, 14));

  const reset = () => {
    setSoluteId("nacl");
    setConcentration(0.5);
    setPower(true);
  };

  return (
    <div className="chemx-layout cond-layout">
      <aside className="chemx-panel">
        <header className="chemx-panel-head">
          <span className="chemx-mark">
            <Zap size={16} />
          </span>
          <div>
            <strong>CHẤT THỬ</strong>
            <span>DUNG DỊCH · ĐIỆN LI</span>
          </div>
        </header>

        <div className="chemx-scroll">
          {(["strong", "weak", "none"] as ElectrolyteKind[]).map((kind) => (
            <div key={kind} className="cond-group" data-kind={kind}>
              <div className="chemx-label">
                <i className="chemx-dot" />
                {KIND_LABEL[kind]}
                <b>{SOLUTES.filter((item) => item.kind === kind).length}</b>
              </div>
              <div className="cond-solutes">
                {SOLUTES.filter((item) => item.kind === kind).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`cond-solute ${item.id === solute.id ? "is-active" : ""}`}
                    onClick={() => setSoluteId(item.id)}
                    aria-pressed={item.id === solute.id}
                    title={item.note}
                  >
                    <span className="cond-solute-formula">{item.formula}</span>
                    <span className="cond-solute-name">{item.name}</span>
                    <span className="cond-solute-ions">
                      {item.ions.length > 0 ? item.ions.join(" · ") : "không ion"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="chemx-reset" onClick={reset}>
            <RotateCcw size={12} />
            ĐẶT LẠI THÍ NGHIỆM
          </button>
        </div>
      </aside>

      <section className="chemx-main cond-main">
        <div className="chemx-stage cond-stage">
          <div className="chemx-stage-top">
            <span className="chemx-badge">
              <BatteryCharging size={12} />
              MẠCH ĐO ĐỘ DẪN
            </span>
            <button
              type="button"
              className={`cond-power ${power ? "is-on" : ""}`}
              onClick={() => setPower((value) => !value)}
              aria-pressed={power}
            >
              <Power size={12} />
              {power ? "ĐANG BẬT" : "ĐANG TẮT"}
            </button>
          </div>

          <label className="cond-slider">
            <span>
              <Droplets size={12} />
              NỒNG ĐỘ DUNG DỊCH
              <b>{concentration.toFixed(1)} M</b>
            </span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={concentration}
              onChange={(event) => setConcentration(Number(event.target.value))}
              aria-label="Nồng độ dung dịch"
            />
            <span className="cond-slider-scale">
              <i>0,1 M</i>
              <i>1,0 M</i>
            </span>
          </label>

          <div className="cond-scene" data-level={label}>
            <svg viewBox="0 0 420 320" role="img" aria-label={`Mạch điện thử độ dẫn của ${solute.name}`}>
              <defs>
                <linearGradient id="cond-liquid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={solute.color} stopOpacity="0.85" />
                  <stop offset="100%" stopColor={solute.color} stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id="cond-glass" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
                  <stop offset="35%" stopColor="#ffffff" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
                </linearGradient>
                <linearGradient id="cond-metal" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#cfd8e6" />
                  <stop offset="50%" stopColor="#8e9aae" />
                  <stop offset="100%" stopColor="#5c6678" />
                </linearGradient>
                <radialGradient id="cond-bulb-glow">
                  <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#ffd35c" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#ffb020" stopOpacity="0" />
                </radialGradient>
                <clipPath id="cond-beaker-clip">
                  <path d="M118 168 H302 V272 Q302 292 282 292 H138 Q118 292 118 272 Z" />
                </clipPath>
                <filter id="cond-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
              </defs>

              {/* dây dẫn */}
              <g className="cond-wires" fill="none" stroke="#7c8698" strokeWidth="5" strokeLinecap="round">
                <path d="M158 62 V96 H118 V170" />
                <path d="M262 62 H332 V76" />
                <path d="M334 118 V148 H256 V172" />
              </g>

              {/* pin */}
              <g>
                <rect x="140" y="18" width="140" height="44" rx="12" fill="#1b2230" stroke="#46536b" />
                <rect x="150" y="27" width="58" height="26" rx="6" fill="#273245" />
                <text x="179" y="45" textAnchor="middle" className="cond-svg-label">
                  9V
                </text>
                <rect x="216" y="33" width="54" height="14" rx="7" fill="#101722" />
                <circle cx="158" cy="62" r="4" fill="#d7dee9" />
                <circle cx="262" cy="62" r="4" fill="#d7dee9" />
              </g>

              {/* bóng đèn */}
              <g className="cond-bulb">
                <circle
                  cx="334"
                  cy="96"
                  r="34"
                  fill="url(#cond-bulb-glow)"
                  opacity={glow}
                  filter="url(#cond-glow)"
                />
                <circle cx="334" cy="96" r="25" fill="#1a2230" stroke="#8e9aae" strokeWidth="2.5" />
                <path
                  d="M324 104 C328 92, 332 92, 334 100 C336 92, 340 92, 344 104"
                  fill="none"
                  stroke={glow > 0.05 ? "#ffe27a" : "#59647a"}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <rect x="325" y="117" width="18" height="8" rx="3" fill="#8e9aae" />
                <rect x="328" y="124" width="12" height="4" rx="2" fill="#6a7488" />
                <circle cx="334" cy="96" r="25" fill="#ffd35c" opacity={glow * 0.16} />
              </g>

              {/* cốc */}
              <g>
                <path
                  d="M112 160 H308 V274 Q308 298 284 298 H136 Q112 298 112 274 Z"
                  fill="url(#cond-glass)"
                  stroke="#b9c8da"
                  strokeOpacity="0.5"
                  strokeWidth="2.5"
                />
                <g clipPath="url(#cond-beaker-clip)">
                  <rect x="118" y="206" width="184" height="92" fill="url(#cond-liquid)" />
                  <rect x="118" y="206" width="184" height="6" fill="#ffffff" opacity="0.25" />
                  {ION_POSITIONS.slice(0, ionCount).map((ion, index) => (
                    <circle
                      key={index}
                      cx={ion.x}
                      cy={ion.y}
                      r={index % 3 === 0 ? 4.4 : 3.4}
                      fill={index % 2 === 0 ? solute.color : "#ffffff"}
                      opacity={power ? 0.85 : 0.28}
                      className={power && intensity > 4 ? "cond-ion" : undefined}
                      style={{
                        animationDelay: `${ion.delay}s`,
                        animationDuration: `${ion.duration}s`,
                      }}
                    />
                  ))}
                </g>
                {/* điện cực */}
                <rect x="160" y="146" width="10" height="112" rx="5" fill="url(#cond-metal)" />
                <rect x="250" y="146" width="10" height="112" rx="5" fill="url(#cond-metal)" />
                <rect x="155" y="140" width="20" height="10" rx="4" fill="#9aa6b8" />
                <rect x="245" y="140" width="20" height="10" rx="4" fill="#9aa6b8" />
              </g>

              <text x="210" y="314" textAnchor="middle" className="cond-svg-caption">
                {solute.formula} · {concentration.toFixed(1)} M
              </text>
            </svg>

            <span className="cond-spark" aria-hidden="true" style={{ opacity: glow }} />
          </div>
        </div>

        <div className="chemx-side-readout">
          <div className={`cond-gauge ${intensity >= 58 ? "is-strong" : intensity >= 6 ? "is-weak" : "is-none"}`}>
            <span>ĐỘ DẪN ĐIỆN TƯƠNG ĐỐI</span>
            <strong>
              {Math.round(intensity)}
              <small>%</small>
            </strong>
            <div className="cond-gauge-bar">
              <i style={{ width: `${clamp(intensity, 2, 100)}%` }} />
            </div>
            <em>{label}</em>
          </div>

          <div className="cond-detail">
            <span className="cond-detail-kind" data-kind={solute.kind}>
              <Lightbulb size={12} />
              {KIND_LABEL[solute.kind]}
            </span>
            <b>{solute.formula}</b>
            <p>{solute.equation}</p>
            <div className="cond-ions">
              {solute.ions.length === 0 ? (
                <span className="cond-ion-chip is-none">không có ion tự do</span>
              ) : (
                solute.ions.map((ion) => (
                  <span className="cond-ion-chip" key={ion}>
                    {ion}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="chemx-stat">
            <span>ĐỘ PHÂN LI</span>
            <strong>
              {solute.kind === "strong" ? "100" : solute.kind === "weak" ? "≈ 3" : "0"}
              <small>%</small>
            </strong>
            <div className="chemx-bar">
              <i
                style={{
                  width: solute.kind === "strong" ? "100%" : solute.kind === "weak" ? "12%" : "2%",
                }}
              />
            </div>
            <p className="chemx-stat-note">
              {solute.kind === "strong"
                ? "Phân li hoàn toàn thành ion."
                : solute.kind === "weak"
                  ? "Chỉ một phần phân tử phân li thuận nghịch."
                  : "Không phân li thành ion."}
            </p>
          </div>

          <div className="chemx-tip is-inline">
            <Info size={12} />
            <p>{solute.note}</p>
          </div>

          <div className="chemx-tip is-inline">
            <Waves size={12} />
            <p>
              Tăng nồng độ làm tăng số ion mang điện nên độ dẫn tăng. Chất điện li yếu dẫn điện kém
              hơn nhiều so với chất điện li mạnh cùng nồng độ.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
