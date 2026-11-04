import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Droplets,
  FlaskConical,
  Info,
  RotateCcw,
  Scale,
  Sparkles,
  TestTubes,
} from "lucide-react";

/* ==========================================================================
   HydrolysisLab — so sánh môi trường của các muối khi tan trong nước.
   Màu dung dịch theo chỉ thị vạn năng, thang pH và phương trình thuỷ phân.
   ========================================================================== */

type Medium = "acid" | "neutral" | "base";

interface Salt {
  id: string;
  formula: string;
  name: string;
  medium: Medium;
  ph: number;
  cation: string;
  anion: string;
  hydrolysed: "cation" | "anion" | "none";
  equation: string;
  note: string;
}

const SALTS: Salt[] = [
  {
    id: "nh4cl",
    formula: "NH₄Cl",
    name: "Ammoni clorua",
    medium: "acid",
    ph: 5,
    cation: "NH₄⁺",
    anion: "Cl⁻",
    hydrolysed: "cation",
    equation: "NH₄⁺ + H₂O ⇌ NH₃ + H₃O⁺",
    note: "Gốc bazơ yếu NH₄⁺ bị thuỷ phân, giải phóng H₃O⁺ nên môi trường axit.",
  },
  {
    id: "alcl3",
    formula: "AlCl₃",
    name: "Nhôm clorua",
    medium: "acid",
    ph: 3,
    cation: "Al³⁺",
    anion: "Cl⁻",
    hydrolysed: "cation",
    equation: "Al³⁺ + H₂O ⇌ Al(OH)²⁺ + H⁺",
    note: "Ion Al³⁺ thuỷ phân mạnh tạo H⁺, dung dịch có tính axit rõ rệt.",
  },
  {
    id: "fecl3",
    formula: "FeCl₃",
    name: "Sắt(III) clorua",
    medium: "acid",
    ph: 2,
    cation: "Fe³⁺",
    anion: "Cl⁻",
    hydrolysed: "cation",
    equation: "Fe³⁺ + H₂O ⇌ Fe(OH)²⁺ + H⁺",
    note: "Dung dịch có màu vàng nâu và môi trường axit do Fe³⁺ thuỷ phân.",
  },
  {
    id: "nh4no3",
    formula: "NH₄NO₃",
    name: "Ammoni nitrat",
    medium: "acid",
    ph: 5,
    cation: "NH₄⁺",
    anion: "NO₃⁻",
    hydrolysed: "cation",
    equation: "NH₄⁺ + H₂O ⇌ NH₃ + H₃O⁺",
    note: "Muối của bazơ yếu và axit mạnh, thuỷ phân cho môi trường axit.",
  },
  {
    id: "nacl",
    formula: "NaCl",
    name: "Natri clorua",
    medium: "neutral",
    ph: 7,
    cation: "Na⁺",
    anion: "Cl⁻",
    hydrolysed: "none",
    equation: "NaCl → Na⁺ + Cl⁻ (không thuỷ phân)",
    note: "Cation của bazơ mạnh và anion của axit mạnh đều không bị thuỷ phân.",
  },
  {
    id: "kno3",
    formula: "KNO₃",
    name: "Kali nitrat",
    medium: "neutral",
    ph: 7,
    cation: "K⁺",
    anion: "NO₃⁻",
    hydrolysed: "none",
    equation: "KNO₃ → K⁺ + NO₃⁻ (không thuỷ phân)",
    note: "Muối trung tính, dung dịch giữ màu xanh của chỉ thị vạn năng.",
  },
  {
    id: "ch3coona",
    formula: "CH₃COONa",
    name: "Natri axetat",
    medium: "base",
    ph: 9,
    cation: "Na⁺",
    anion: "CH₃COO⁻",
    hydrolysed: "anion",
    equation: "CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻",
    note: "Gốc axit yếu CH₃COO⁻ thuỷ phân tạo OH⁻, dung dịch có môi trường bazơ.",
  },
  {
    id: "na2co3",
    formula: "Na₂CO₃",
    name: "Natri cacbonat",
    medium: "base",
    ph: 11,
    cation: "Na⁺",
    anion: "CO₃²⁻",
    hydrolysed: "anion",
    equation: "CO₃²⁻ + H₂O ⇌ HCO₃⁻ + OH⁻",
    note: "Ion CO₃²⁻ thuỷ phân mạnh, dung dịch soda có tính bazơ rõ.",
  },
  {
    id: "nahco3",
    formula: "NaHCO₃",
    name: "Natri hidrocacbonat",
    medium: "base",
    ph: 8.3,
    cation: "Na⁺",
    anion: "HCO₃⁻",
    hydrolysed: "anion",
    equation: "HCO₃⁻ + H₂O ⇌ H₂CO₃ + OH⁻",
    note: "HCO₃⁻ vừa có tính axit vừa có tính bazơ; trong nước nghiêng về bazơ yếu.",
  },
];

const MEDIUM_LABEL: Record<Medium, string> = {
  acid: "MÔI TRƯỜNG AXIT",
  neutral: "MÔI TRƯỜNG TRUNG TÍNH",
  base: "MÔI TRƯỜNG BAZƠ",
};

const PH_STOPS: Array<[number, string]> = [
  [0, "#cf2b2b"],
  [2, "#e04a2f"],
  [4, "#e8972c"],
  [6, "#e0cc3c"],
  [7, "#5cc06a"],
  [8, "#2fb9a5"],
  [10, "#2f8fd0"],
  [12, "#5a54cf"],
  [14, "#7d3fb8"],
];

function phColor(ph: number): string {
  const value = Math.min(14, Math.max(0, ph));
  for (let index = 0; index < PH_STOPS.length - 1; index += 1) {
    const [start, startColor] = PH_STOPS[index];
    const [end, endColor] = PH_STOPS[index + 1];
    if (value >= start && value <= end) {
      const t = (value - start) / (end - start || 1);
      const parse = (hex: string) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      const a = parse(startColor);
      const b = parse(endColor);
      const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
      return `rgb(${mix(a[0], b[0])}, ${mix(a[1], b[1])}, ${mix(a[2], b[2])})`;
    }
  }
  return "#5cc06a";
}

const GROUPS: Array<{ medium: Medium; label: string }> = [
  { medium: "acid", label: "MUỐI AXIT" },
  { medium: "neutral", label: "MUỐI TRUNG TÍNH" },
  { medium: "base", label: "MUỐI BAZƠ" },
];

export default function HydrolysisLab() {
  const [saltId, setSaltId] = useState("nh4cl");
  const salt = useMemo(() => SALTS.find((item) => item.id === saltId) ?? SALTS[0], [saltId]);
  const color = phColor(salt.ph);

  const pickSalt = (id: string) => setSaltId(id);

  return (
    <div className="chemx-layout hyd-layout">
      <aside className="chemx-panel">
        <header className="chemx-panel-head">
          <span className="chemx-mark">
            <TestTubes size={16} />
          </span>
          <div>
            <strong>KHO MUỐI</strong>
            <span>THUỶ PHÂN · MÔI TRƯỜNG</span>
          </div>
        </header>

        <div className="chemx-scroll">
          {GROUPS.map((group) => (
            <div key={group.medium} className="hyd-group" data-medium={group.medium}>
              <div className="chemx-label">
                <i className="chemx-dot" />
                {group.label}
                <b>{SALTS.filter((item) => item.medium === group.medium).length}</b>
              </div>
              <div className="hyd-salts">
                {SALTS.filter((item) => item.medium === group.medium).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`hyd-salt ${item.id === salt.id ? "is-active" : ""}`}
                    onClick={() => pickSalt(item.id)}
                    aria-pressed={item.id === salt.id}
                    title={item.note}
                  >
                    <span className="hyd-salt-dot" style={{ background: phColor(item.ph) }} />
                    <span className="hyd-salt-formula">{item.formula}</span>
                    <span className="hyd-salt-ph">pH {item.ph}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="chemx-reset" onClick={() => pickSalt("nh4cl")}>
            <RotateCcw size={12} />
            CHỌN LẠI MUỐI ĐẦU TIÊN
          </button>

          <div className="chemx-tip">
            <Info size={12} />
            <p>
              Muối của bazơ yếu hoặc axit yếu bị thuỷ phân khi tan trong nước, làm dung dịch chuyển
              sang axit hoặc bazơ.
            </p>
          </div>
        </div>
      </aside>

      <section className="chemx-main hyd-main">
        <div className="chemx-stage hyd-stage">
          <div className="chemx-stage-top">
            <span className="chemx-badge">
              <Droplets size={12} />
              CHỈ THỊ VẠN NĂNG
            </span>
            <span className={`chemx-live is-live`}>
              <i />
              {MEDIUM_LABEL[salt.medium]}
            </span>
          </div>

          <div className="hyd-scene">
            <div className="hyd-beaker" data-medium={salt.medium}>
              <div className="hyd-glass">
                <i className="hyd-liquid" style={{ background: color }} />
                <span className="hyd-gloss" />
                {salt.medium !== "neutral" && (
                  <span className="hyd-bubbles" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              <span className="hyd-beaker-label">
                {salt.formula} {salt.ph < 7 ? "+ H₂O" : ""}
              </span>
            </div>

            <div className="hyd-gauge">
              <span className="hyd-gauge-title">pH</span>
              <strong style={{ color }}>{salt.ph.toFixed(1)}</strong>
              <span className="hyd-gauge-medium" data-medium={salt.medium}>
                {salt.medium === "acid" ? "AXIT" : salt.medium === "base" ? "BAZƠ" : "TRUNG TÍNH"}
              </span>
            </div>

            <div className="hyd-strip" aria-hidden="true">
              <span className="hyd-strip-scale">
                <i>0</i>
                <i>7</i>
                <i>14</i>
              </span>
              <div className="hyd-strip-bar">
                <span
                  className="hyd-strip-marker"
                  style={{ "--ph": String(salt.ph / 14) } as CSSProperties}
                >
                  <b style={{ background: color }} />
                </span>
              </div>
            </div>
          </div>

          <div className="hyd-equation">
            <span className="hyd-eq-label">PHƯƠNG TRÌNH THUỶ PHÂN</span>
            <strong>{salt.equation}</strong>
          </div>

          <div className="hyd-breakdown">
            <div className={`hyd-ion ${salt.hydrolysed === "cation" ? "is-active" : ""}`}>
              <span>CATION</span>
              <b>{salt.cation}</b>
              <em>
                {salt.hydrolysed === "cation"
                  ? "thuỷ phân → H⁺"
                  : salt.hydrolysed === "none"
                    ? "không thuỷ phân"
                    : "trung tính"}
              </em>
            </div>
            <div className={`hyd-ion ${salt.hydrolysed === "anion" ? "is-active" : ""}`}>
              <span>ANION</span>
              <b>{salt.anion}</b>
              <em>
                {salt.hydrolysed === "anion"
                  ? "thuỷ phân → OH⁻"
                  : salt.hydrolysed === "none"
                    ? "không thuỷ phân"
                    : "trung tính"}
              </em>
            </div>
            <div className="hyd-verdict" data-medium={salt.medium}>
              <Sparkles size={14} />
              <div>
                <strong>{MEDIUM_LABEL[salt.medium]}</strong>
                <p>{salt.note}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="chemx-side-readout">
          <div className="chemx-stat">
            <span>MÀU CHỈ THỊ</span>
            <div className="hyd-swatch-row">
              <i className="hyd-swatch" style={{ background: color }} />
              <div>
                <strong className="hyd-swatch-hex">{color}</strong>
                <p className="chemx-stat-note">
                  {salt.medium === "acid"
                    ? "Chỉ thị ngả đỏ / da cam"
                    : salt.medium === "base"
                      ? "Chỉ thị ngả xanh / tím"
                      : "Chỉ thị giữ màu xanh lá"}
                </p>
              </div>
            </div>
          </div>

          <div className="chemx-stat">
            <span>SO SÁNH NHANH</span>
            <ul className="hyd-compare">
              {SALTS.filter((item) =>
                ["nh4cl", "nacl", "ch3coona", "na2co3"].includes(item.id)
              ).map((item) => (
                <li key={item.id} className={item.id === salt.id ? "is-active" : ""}>
                  <i style={{ background: phColor(item.ph) }} />
                  <b>{item.formula}</b>
                  <span>pH {item.ph}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="chemx-tip is-inline">
            <Scale size={12} />
            <p>
              Quy tắc: cation của bazơ yếu → axit; anion của axit yếu → bazơ; cả hai đều mạnh → trung
              tính.
            </p>
          </div>

          <div className="chemx-tip is-inline">
            <FlaskConical size={12} />
            <p>
              Thêm vài giọt chỉ thị vạn năng vào dung dịch muối, so màu với thang pH để xác định môi
              trường.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
