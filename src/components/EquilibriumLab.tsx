import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Beaker,
  Flame,
  FlaskConical,
  Gauge,
  Minus,
  RotateCcw,
  Scale,
  Snowflake,
  Sparkles,
  Wind,
} from "lucide-react";

/* ==========================================================================
   EquilibriumLab — minh hoạ chuyển dịch cân bằng theo nguyên lý Le Chatelier.
   Ba hệ cân bằng trực quan: phức Fe(SCN), N₂O₄/NO₂ và cromat/đicromat.
   Người học tác động nồng độ, nhiệt độ, áp suất rồi đọc chiều chuyển dịch.
   ========================================================================== */

type StressKind = "reactant" | "product" | "temp" | "pressure" | "catalyst" | "other";

interface Stress {
  id: string;
  label: string;
  delta: number;
  note: string;
  kind: StressKind;
  icon: "add" | "remove" | "heat" | "cool" | "compress" | "expand" | "catalyst";
}

interface Side {
  formula: string;
  label: string;
  color: string;
}

interface EqSystem {
  id: string;
  name: string;
  tag: string;
  equation: string;
  left: Side;
  right: Side;
  initial: number;
  intro: string;
  colorLabel: string;
  rightText: string;
  leftText: string;
  steadyText: string;
  stresses: Stress[];
}

const SYSTEMS: EqSystem[] = [
  {
    id: "fescn",
    name: "Phức sắt – thioxyanat",
    tag: "Fe³⁺ / SCN⁻",
    equation: "Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺",
    left: { formula: "Fe³⁺ + SCN⁻", label: "Vàng nhạt", color: "#f0e2a8" },
    right: { formula: "FeSCN²⁺", label: "Đỏ máu", color: "#b21f3c" },
    initial: 46,
    intro:
      "Phức FeSCN²⁺ có màu đỏ máu. Màu càng đậm khi cân bằng càng lệch về phía sản phẩm.",
    colorLabel: "MÀU DUNG DỊCH",
    rightText: "Cân bằng chuyển sang phải — tạo thêm phức đỏ FeSCN²⁺.",
    leftText: "Cân bằng chuyển sang trái — phức đỏ bị phân ly, dung dịch nhạt màu.",
    steadyText: "Cân bằng giữ nguyên, chỉ đạt nhanh hơn.",
    stresses: [
      {
        id: "add-fe",
        label: "Thêm Fe³⁺",
        delta: 14,
        kind: "reactant",
        icon: "add",
        note: "Tăng nồng độ chất phản ứng Fe³⁺ → cân bằng chuyển sang phải, màu đỏ đậm lên.",
      },
      {
        id: "add-scn",
        label: "Thêm SCN⁻",
        delta: 14,
        kind: "reactant",
        icon: "add",
        note: "Tăng nồng độ SCN⁻ → cân bằng chuyển sang phải để tạo thêm phức FeSCN²⁺.",
      },
      {
        id: "add-naoh",
        label: "Thêm NaOH",
        delta: -22,
        kind: "other",
        icon: "remove",
        note: "OH⁻ kết tủa Fe³⁺ thành Fe(OH)₃ nâu đỏ, nồng độ Fe³⁺ giảm → cân bằng chuyển sang trái, dung dịch nhạt màu.",
      },
      {
        id: "heat",
        label: "Đun nóng",
        delta: -16,
        kind: "temp",
        icon: "heat",
        note: "Chiều thuận toả nhiệt. Tăng nhiệt độ → cân bằng chuyển theo chiều thu nhiệt (chiều nghịch), màu đỏ nhạt đi.",
      },
      {
        id: "cool",
        label: "Làm lạnh",
        delta: 16,
        kind: "temp",
        icon: "cool",
        note: "Giảm nhiệt độ → cân bằng chuyển theo chiều toả nhiệt (chiều thuận), phức tạo thêm nên màu đậm hơn.",
      },
      {
        id: "dilute",
        label: "Pha loãng",
        delta: -10,
        kind: "pressure",
        icon: "expand",
        note: "Pha loãng làm giảm nồng độ mọi chất. Cân bằng dịch về phía có nhiều tiểu phân hơn (2 ion bên trái), nên nhạt màu.",
      },
      {
        id: "catalyst",
        label: "Thêm xúc tác",
        delta: 0,
        kind: "catalyst",
        icon: "catalyst",
        note: "Chất xúc tác chỉ giúp hệ đạt cân bằng nhanh hơn, không làm thay đổi vị trí cân bằng.",
      },
    ],
  },
  {
    id: "n2o4",
    name: "N₂O₄ – NO₂",
    tag: "KHÍ · THU NHIỆT",
    equation: "N₂O₄(không màu) ⇌ 2NO₂(nâu đỏ)",
    left: { formula: "N₂O₄", label: "Không màu", color: "#e8f0f8" },
    right: { formula: "2NO₂", label: "Nâu đỏ", color: "#a85a24" },
    initial: 40,
    intro:
      "N₂O₄ không màu, NO₂ nâu đỏ. Đây là hệ khí điển hình để học ảnh hưởng của nhiệt độ và áp suất.",
    colorLabel: "MÀU KHÍ TRONG ỐNG",
    rightText: "Cân bằng chuyển sang phải — sinh thêm NO₂, khí nâu đỏ đậm hơn.",
    leftText: "Cân bằng chuyển sang trái — NO₂ ghép lại thành N₂O₄, khí nhạt màu.",
    steadyText: "Cân bằng giữ nguyên, chỉ đạt nhanh hơn.",
    stresses: [
      {
        id: "add-n2o4",
        label: "Thêm N₂O₄",
        delta: 14,
        kind: "reactant",
        icon: "add",
        note: "Tăng nồng độ N₂O₄ → cân bằng chuyển sang phải, tạo thêm NO₂ nâu đỏ.",
      },
      {
        id: "add-no2",
        label: "Thêm NO₂",
        delta: -14,
        kind: "product",
        icon: "add",
        note: "Tăng nồng độ sản phẩm NO₂ → cân bằng chuyển sang trái, bớt NO₂ nên nhạt màu.",
      },
      {
        id: "heat",
        label: "Đun nóng",
        delta: 18,
        kind: "temp",
        icon: "heat",
        note: "Chiều thuận thu nhiệt. Tăng nhiệt độ → cân bằng chuyển sang phải, màu nâu đỏ đậm lên.",
      },
      {
        id: "cool",
        label: "Làm lạnh",
        delta: -18,
        kind: "temp",
        icon: "cool",
        note: "Giảm nhiệt độ → cân bằng chuyển theo chiều toả nhiệt (chiều nghịch), NO₂ hoá N₂O₄ nên nhạt màu.",
      },
      {
        id: "compress",
        label: "Nén (tăng áp)",
        delta: -16,
        kind: "pressure",
        icon: "compress",
        note: "Tăng áp suất → cân bằng chuyển về phía ít phân tử khí hơn (1 mol N₂O₄), nên nhạt màu.",
      },
      {
        id: "expand",
        label: "Giãn (giảm áp)",
        delta: 16,
        kind: "pressure",
        icon: "expand",
        note: "Giảm áp suất → cân bằng chuyển về phía nhiều phân tử khí hơn (2 mol NO₂), màu đậm lên.",
      },
      {
        id: "catalyst",
        label: "Thêm xúc tác",
        delta: 0,
        kind: "catalyst",
        icon: "catalyst",
        note: "Xúc tác không làm chuyển dịch cân bằng, chỉ rút ngắn thời gian đạt cân bằng.",
      },
    ],
  },
  {
    id: "cromat",
    name: "Cromat – đicromat",
    tag: "CROM · ĐỔI MÀU",
    equation: "2CrO₄²⁻(vàng) + 2H⁺ ⇌ Cr₂O₇²⁻(da cam) + H₂O",
    left: { formula: "2CrO₄²⁻", label: "Vàng tươi", color: "#f2cf3a" },
    right: { formula: "Cr₂O₇²⁻", label: "Da cam", color: "#e2701c" },
    initial: 42,
    intro:
      "Cromat màu vàng, đicromat màu da cam. Thêm axit hay bazơ sẽ đổi màu dung dịch rất rõ.",
    colorLabel: "MÀU DUNG DỊCH",
    rightText: "Cân bằng chuyển sang phải — tạo đicromat Cr₂O₇²⁻, dung dịch ngả da cam.",
    leftText: "Cân bằng chuyển sang trái — tạo cromat CrO₄²⁻, dung dịch ngả vàng tươi.",
    steadyText: "Cân bằng giữ nguyên, chỉ đạt nhanh hơn.",
    stresses: [
      {
        id: "add-acid",
        label: "Thêm axit (H⁺)",
        delta: 20,
        kind: "reactant",
        icon: "add",
        note: "Tăng H⁺ → cân bằng chuyển sang phải, cromat vàng chuyển thành đicromat da cam.",
      },
      {
        id: "add-base",
        label: "Thêm bazơ (OH⁻)",
        delta: -20,
        kind: "other",
        icon: "remove",
        note: "OH⁻ trung hoà H⁺, nồng độ H⁺ giảm → cân bằng chuyển sang trái, dung dịch trở lại màu vàng.",
      },
      {
        id: "heat",
        label: "Đun nóng",
        delta: -12,
        kind: "temp",
        icon: "heat",
        note: "Chiều thuận toả nhiệt. Tăng nhiệt độ → cân bằng lệch về chiều thu nhiệt (chiều nghịch), ngả vàng.",
      },
      {
        id: "cool",
        label: "Làm lạnh",
        delta: 12,
        kind: "temp",
        icon: "cool",
        note: "Giảm nhiệt độ → cân bằng lệch về chiều toả nhiệt (chiều thuận), da cam đậm hơn.",
      },
      {
        id: "dilute",
        label: "Pha loãng",
        delta: -10,
        kind: "pressure",
        icon: "expand",
        note: "Pha loãng → cân bằng dịch về phía nhiều tiểu phân hơn (2 CrO₄²⁻), dung dịch ngả vàng.",
      },
      {
        id: "catalyst",
        label: "Thêm xúc tác",
        delta: 0,
        kind: "catalyst",
        icon: "catalyst",
        note: "Xúc tác không làm chuyển dịch cân bằng.",
      },
    ],
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mixColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

function StressIcon({ icon }: { icon: Stress["icon"] }) {
  const size = 13;
  switch (icon) {
    case "heat":
      return <Flame size={size} />;
    case "cool":
      return <Snowflake size={size} />;
    case "compress":
      return <ArrowDownRight size={size} />;
    case "expand":
      return <ArrowUpRight size={size} />;
    case "catalyst":
      return <Sparkles size={size} />;
    case "remove":
      return <Minus size={size} />;
    default:
      return <FlaskConical size={size} />;
  }
}

interface Verdict {
  label: string;
  note: string;
  direction: "left" | "right" | "none";
}

export default function EquilibriumLab() {
  const [systemId, setSystemId] = useState(SYSTEMS[0].id);
  const system = useMemo(
    () => SYSTEMS.find((item) => item.id === systemId) ?? SYSTEMS[0],
    [systemId]
  );
  const [fraction, setFraction] = useState(system.initial);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [moves, setMoves] = useState<Array<{ id: string; label: string; direction: string }>>([]);
  const [applied, setApplied] = useState<string[]>([]);

  const pickSystem = (id: string) => {
    const next = SYSTEMS.find((item) => item.id === id) ?? SYSTEMS[0];
    setSystemId(id);
    setFraction(next.initial);
    setVerdict(null);
    setMoves([]);
    setApplied([]);
  };

  const reset = () => {
    setFraction(system.initial);
    setVerdict({
      label: "Đã đưa hệ về trạng thái cân bằng ban đầu",
      note: system.intro,
      direction: "none",
    });
    setMoves([]);
    setApplied([]);
  };

  const applyStress = (stress: Stress) => {
    const next = clamp(fraction + stress.delta, 8, 92);
    setFraction(next);
    setApplied((previous) =>
      previous.includes(stress.id) ? previous : [...previous, stress.id]
    );
    const direction: Verdict["direction"] =
      stress.delta > 0 ? "right" : stress.delta < 0 ? "left" : "none";
    setVerdict({
      label:
        direction === "right"
          ? system.rightText
          : direction === "left"
            ? system.leftText
            : system.steadyText,
      note: stress.note,
      direction,
    });
    setMoves((previous) =>
      [
        {
          id: `${stress.id}-${previous.length}`,
          label: stress.label,
          direction: direction === "right" ? "→" : direction === "left" ? "←" : "•",
        },
        ...previous,
      ].slice(0, 5)
    );
  };

  const mix = mixColor(system.left.color, system.right.color, fraction / 100);
  const productPct = Math.round(fraction);
  const shiftDirection = verdict?.direction ?? "none";

  return (
    <div className="chemx-layout eq-layout">
      <aside className="chemx-panel">
        <header className="chemx-panel-head">
          <span className="chemx-mark">
            <Scale size={16} />
          </span>
          <div>
            <strong>HỆ CÂN BẰNG</strong>
            <span>CHỌN HỆ · TÁC ĐỘNG</span>
          </div>
        </header>

        <div className="chemx-scroll">
          <div className="chemx-label">CHỌN HỆ CÂN BẰNG</div>
          <div className="eq-systems">
            {SYSTEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`eq-system ${item.id === system.id ? "is-active" : ""}`}
                onClick={() => pickSystem(item.id)}
                aria-pressed={item.id === system.id}
              >
                <span className="eq-system-swatch">
                  <i style={{ background: item.left.color }} />
                  <i style={{ background: item.right.color }} />
                </span>
                <span className="eq-system-text">
                  <b>{item.name}</b>
                  <span>{item.tag}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="chemx-label">TÁC ĐỘNG LÊN HỆ</div>
          <div className="eq-stresses">
            {system.stresses.map((stress) => (
              <button
                key={stress.id}
                type="button"
                className={`eq-stress ${applied.includes(stress.id) ? "is-used" : ""}`}
                onClick={() => applyStress(stress)}
                title={stress.note}
              >
                <span className={`eq-stress-icon is-${stress.kind}`}>
                  <StressIcon icon={stress.icon} />
                </span>
                {stress.label}
              </button>
            ))}
          </div>

          <button type="button" className="chemx-reset" onClick={reset}>
            <RotateCcw size={12} />
            ĐƯA VỀ CÂN BẰNG BAN ĐẦU
          </button>

          <div className="chemx-tip">
            <Gauge size={12} />
            <p>
              Khi một yếu tố thay đổi, cân bằng dịch chuyển theo hướng làm giảm tác động đó. Hằng số
              cân bằng K chỉ phụ thuộc nhiệt độ.
            </p>
          </div>
        </div>
      </aside>

      <section className="chemx-main eq-main">
        <div className="chemx-stage eq-stage">
          <div className="chemx-stage-top">
            <span className="chemx-badge">
              <ArrowLeftRight size={12} />
              CÂN BẰNG ĐỘNG
            </span>
            <span
              className={`chemx-live ${
                shiftDirection === "none" ? "" : `is-live is-${shiftDirection}`
              }`}
            >
              <i />
              {shiftDirection === "right"
                ? "ĐANG DỊCH SANG PHẢI"
                : shiftDirection === "left"
                  ? "ĐANG DỊCH SANG TRÁI"
                  : "HỆ ĐANG CÂN BẰNG"}
            </span>
          </div>

          <div className="eq-equation">{system.equation}</div>
          <p className="eq-intro">{system.intro}</p>

          <div className="eq-visual">
            <div className="eq-side">
              <span className="eq-side-cap">CHẤT PHẢN ỨNG</span>
              <div className="eq-tube">
                <i
                  className="eq-tube-fill"
                  style={{
                    height: `${clamp(100 - productPct, 12, 88)}%`,
                    background: `linear-gradient(180deg, ${system.left.color}, color-mix(in srgb, ${system.left.color} 70%, #000))`,
                  }}
                />
                <span className="eq-tube-gloss" />
              </div>
              <b>{system.left.formula}</b>
              <span className="eq-side-note">{system.left.label}</span>
            </div>

            <div className={`eq-shift is-${shiftDirection}`} aria-hidden="true">
              <span className="eq-shift-arrow">
                <ArrowLeftRight size={24} />
              </span>
              <span className="eq-shift-pct">{productPct}%</span>
              <span className="eq-shift-cap">SẢN PHẨM</span>
            </div>

            <div className="eq-side is-right">
              <span className="eq-side-cap">SẢN PHẨM</span>
              <div className="eq-tube">
                <i
                  className="eq-tube-fill"
                  style={{
                    height: `${clamp(productPct, 12, 88)}%`,
                    background: `linear-gradient(180deg, ${system.right.color}, color-mix(in srgb, ${system.right.color} 70%, #000))`,
                  }}
                />
                <span className="eq-tube-gloss" />
              </div>
              <b>{system.right.formula}</b>
              <span className="eq-side-note">{system.right.label}</span>
            </div>
          </div>

          <div className="eq-mix">
            <div className="eq-mix-vial">
              <i style={{ background: mix }} />
            </div>
            <div className="eq-mix-text">
              <span>{system.colorLabel}</span>
              <strong style={{ color: mix }}>{mix}</strong>
            </div>
            <div className="eq-mix-bar">
              <b style={{ width: `${100 - productPct}%`, background: system.left.color }} />
              <i style={{ width: `${productPct}%`, background: system.right.color }} />
            </div>
          </div>

          <div className={`eq-verdict is-${shiftDirection}`}>
            <span className="eq-verdict-icon">
              {shiftDirection === "right" ? (
                <ArrowUpRight size={18} />
              ) : shiftDirection === "left" ? (
                <ArrowDownRight size={18} />
              ) : (
                <Beaker size={18} />
              )}
            </span>
            <div>
              <strong>{verdict ? verdict.label : "Chọn một tác động để xem chiều chuyển dịch"}</strong>
              <p>
                {verdict
                  ? verdict.note
                  : "Thêm/bớt chất, thay đổi nhiệt độ hoặc áp suất — hệ sẽ tự điều chỉnh để chống lại thay đổi đó."}
              </p>
            </div>
          </div>
        </div>

        <div className="chemx-side-readout">
          <div className="chemx-stat">
            <span>TỈ LỆ SẢN PHẨM</span>
            <strong>
              {productPct}
              <small>%</small>
            </strong>
            <div className="chemx-bar">
              <i style={{ width: `${productPct}%` }} />
            </div>
          </div>

          <div className="chemx-stat">
            <span>CHIỀU CHUYỂN DỊCH</span>
            <strong className={`eq-dir is-${shiftDirection}`}>
              {shiftDirection === "right" ? "→ PHẢI" : shiftDirection === "left" ? "← TRÁI" : "CÂN BẰNG"}
            </strong>
            <p className="chemx-stat-note">
              {shiftDirection === "right"
                ? "Thuận · sinh thêm sản phẩm"
                : shiftDirection === "left"
                  ? "Nghịch · tái tạo chất phản ứng"
                  : "Tốc độ thuận = tốc độ nghịch"}
            </p>
          </div>

          <div className="chemx-stat is-log">
            <span>NHẬT KÝ TÁC ĐỘNG</span>
            {moves.length === 0 ? (
              <p className="chemx-stat-note">Chưa có tác động nào.</p>
            ) : (
              <ul className="eq-moves">
                {moves.map((move) => (
                  <li key={move.id}>
                    <i>{move.direction}</i>
                    {move.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="chemx-tip is-inline">
            <Wind size={12} />
            <p>Áp suất chỉ ảnh hưởng rõ với hệ có chất khí. Chất xúc tác không đổi vị trí cân bằng.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
