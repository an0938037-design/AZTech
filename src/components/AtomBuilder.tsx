import { useMemo, useState } from "react";
import {
  Atom,
  Check,
  CircleDot,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

/* ==========================================================================
   AtomBuilder — lắp ráp nguyên tử theo mô hình Bohr.
   Thêm/bớt proton, neutron, electron; nhận diện nguyên tố, điện tích ion,
   cấu hình electron và hoàn thành các thử thách.
   ========================================================================== */

interface ElementInfo {
  z: number;
  symbol: string;
  name: string;
  neutrons: number;
}

const ELEMENTS: ElementInfo[] = [
  { z: 1, symbol: "H", name: "Hiđro", neutrons: 0 },
  { z: 2, symbol: "He", name: "Heli", neutrons: 2 },
  { z: 3, symbol: "Li", name: "Liti", neutrons: 4 },
  { z: 4, symbol: "Be", name: "Beri", neutrons: 5 },
  { z: 5, symbol: "B", name: "Bo", neutrons: 6 },
  { z: 6, symbol: "C", name: "Cacbon", neutrons: 6 },
  { z: 7, symbol: "N", name: "Nitơ", neutrons: 7 },
  { z: 8, symbol: "O", name: "Oxi", neutrons: 8 },
  { z: 9, symbol: "F", name: "Flo", neutrons: 10 },
  { z: 10, symbol: "Ne", name: "Neon", neutrons: 10 },
  { z: 11, symbol: "Na", name: "Natri", neutrons: 12 },
  { z: 12, symbol: "Mg", name: "Magie", neutrons: 12 },
  { z: 13, symbol: "Al", name: "Nhôm", neutrons: 14 },
  { z: 14, symbol: "Si", name: "Silic", neutrons: 14 },
  { z: 15, symbol: "P", name: "Photpho", neutrons: 16 },
  { z: 16, symbol: "S", name: "Lưu huỳnh", neutrons: 16 },
  { z: 17, symbol: "Cl", name: "Clo", neutrons: 18 },
  { z: 18, symbol: "Ar", name: "Agon", neutrons: 22 },
  { z: 19, symbol: "K", name: "Kali", neutrons: 20 },
  { z: 20, symbol: "Ca", name: "Canxi", neutrons: 20 },
];

const SHELL_CAPS = [2, 8, 8, 2];
const SHELL_NAMES = ["K", "L", "M", "N"];
const SHELL_RADII = [56, 84, 112, 140];

interface Challenge {
  id: string;
  title: string;
  hint: string;
  protons: number;
  electrons: number;
  answer: string;
}

const CHALLENGES: Challenge[] = [
  { id: "h", title: "Nguyên tử hiđro", hint: "1 proton · 1 electron", protons: 1, electrons: 1, answer: "H" },
  { id: "o", title: "Nguyên tử oxi", hint: "8 proton · 8 electron", protons: 8, electrons: 8, answer: "O" },
  { id: "na+", title: "Ion natri Na⁺", hint: "11 proton · 10 electron", protons: 11, electrons: 10, answer: "Na⁺" },
  { id: "cl-", title: "Ion clorua Cl⁻", hint: "17 proton · 18 electron", protons: 17, electrons: 18, answer: "Cl⁻" },
  { id: "mg2+", title: "Ion magie Mg²⁺", hint: "12 proton · 10 electron", protons: 12, electrons: 10, answer: "Mg²⁺" },
  { id: "ca2+", title: "Ion canxi Ca²⁺", hint: "20 proton · 18 electron", protons: 20, electrons: 18, answer: "Ca²⁺" },
];

const QUICK: Array<{ label: string; p: number; n: number; e: number }> = [
  { label: "H", p: 1, n: 0, e: 1 },
  { label: "C", p: 6, n: 6, e: 6 },
  { label: "O", p: 8, n: 8, e: 8 },
  { label: "Na", p: 11, n: 12, e: 11 },
  { label: "Cl", p: 17, n: 18, e: 17 },
  { label: "Ca", p: 20, n: 20, e: 20 },
];

function shellsOf(electrons: number): number[] {
  let left = electrons;
  const shells: number[] = [];
  for (const cap of SHELL_CAPS) {
    if (left <= 0) break;
    const take = Math.min(cap, left);
    shells.push(take);
    left -= take;
  }
  return shells;
}

function chargeOf(protons: number, electrons: number): number {
  return protons - electrons;
}

function chargeText(charge: number): string {
  if (charge === 0) return "0";
  if (charge > 0) return `+${charge}`;
  return `−${Math.abs(charge)}`;
}

const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function superscript(value: number): string {
  return String(value)
    .split("")
    .map((digit) => SUPERSCRIPT[Number(digit)] ?? digit)
    .join("");
}

function chargeSuffix(charge: number): string {
  if (charge === 0) return "";
  if (Math.abs(charge) === 1) return charge > 0 ? "⁺" : "⁻";
  return `${superscript(Math.abs(charge))}${charge > 0 ? "⁺" : "⁻"}`;
}

function nucleusPositions(count: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963;
    const radius = 1.6 + Math.sqrt(index) * 5.4;
    out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return out;
}

interface StepperProps {
  tone: "proton" | "neutron" | "electron";
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function Stepper({ tone, label, symbol, value, min, max, onChange }: StepperProps) {
  return (
    <div className="atom-stepper" data-tone={tone}>
      <span className="atom-stepper-dot" />
      <div className="atom-stepper-text">
        <strong>{label}</strong>
        <span>{symbol}</span>
      </div>
      <div className="atom-stepper-controls">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Giảm ${label}`}
        >
          <Minus size={12} />
        </button>
        <b>{value}</b>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`Tăng ${label}`}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

export default function AtomBuilder() {
  const [protons, setProtons] = useState(11);
  const [neutrons, setNeutrons] = useState(12);
  const [electrons, setElectrons] = useState(11);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [solved, setSolved] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"ok" | "retry" | null>(null);

  const element = protons >= 1 ? ELEMENTS[protons - 1] : undefined;
  const charge = chargeOf(protons, electrons);
  const shells = useMemo(() => shellsOf(electrons), [electrons]);
  const positions = useMemo(() => nucleusPositions(protons + neutrons), [protons, neutrons]);
  const protonNucleons = Math.min(protons, positions.length);
  const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? null;

  const symbol = element?.symbol ?? "?";
  const chargeLabel = chargeText(charge);
  const ionName =
    charge === 0 ? "Nguyên tử trung hoà" : charge > 0 ? `Ion dương ${chargeLabel}` : `Ion âm ${chargeLabel}`;
  const displaySymbol = `${symbol}${chargeSuffix(charge)}`;
  const massNumber = protons + neutrons;
  const config = shells.length > 0 ? shells.join(" · ") : "—";

  const applyQuick = (item: (typeof QUICK)[number]) => {
    setProtons(item.p);
    setNeutrons(item.n);
    setElectrons(item.e);
    setFeedback(null);
  };

  const reset = () => {
    setProtons(11);
    setNeutrons(12);
    setElectrons(11);
    setChallengeId(null);
    setFeedback(null);
  };

  const checkChallenge = () => {
    if (!challenge) return;
    const ok = protons === challenge.protons && electrons === challenge.electrons;
    setFeedback(ok ? "ok" : "retry");
    if (ok) {
      setSolved((previous) =>
        previous.includes(challenge.id) ? previous : [...previous, challenge.id]
      );
    }
  };

  return (
    <div className="chemx-layout atom-layout">
      <aside className="chemx-panel">
        <header className="chemx-panel-head">
          <span className="chemx-mark">
            <Atom size={16} />
          </span>
          <div>
            <strong>LẮP RÁP NGUYÊN TỬ</strong>
            <span>PROTON · NEUTRON · ELECTRON</span>
          </div>
        </header>

        <div className="chemx-scroll">
          <div className="chemx-label">HẠT CƠ BẢN</div>
          <div className="atom-steppers">
            <Stepper
              tone="proton"
              label="Proton"
              symbol="p⁺"
              value={protons}
              min={0}
              max={20}
              onChange={(value) => {
                setProtons(value);
                setFeedback(null);
              }}
            />
            <Stepper
              tone="neutron"
              label="Neutron"
              symbol="n⁰"
              value={neutrons}
              min={0}
              max={30}
              onChange={(value) => {
                setNeutrons(value);
                setFeedback(null);
              }}
            />
            <Stepper
              tone="electron"
              label="Electron"
              symbol="e⁻"
              value={electrons}
              min={0}
              max={20}
              onChange={(value) => {
                setElectrons(value);
                setFeedback(null);
              }}
            />
          </div>

          <div className="chemx-label">NGUYÊN TỐ NHANH</div>
          <div className="atom-quick">
            {QUICK.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyQuick(item)}
                className={protons === item.p && electrons === item.e ? "is-active" : ""}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="chemx-label">THỬ THÁCH</div>
          <div className="atom-challenges">
            {CHALLENGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`atom-challenge ${item.id === challengeId ? "is-active" : ""} ${
                  solved.includes(item.id) ? "is-solved" : ""
                }`}
                onClick={() => {
                  setChallengeId(item.id);
                  setFeedback(null);
                }}
              >
                <span className="atom-challenge-icon">
                  {solved.includes(item.id) ? <Check size={12} /> : <Target size={12} />}
                </span>
                <span>
                  <b>{item.title}</b>
                  <em>{item.hint}</em>
                </span>
              </button>
            ))}
          </div>

          <button type="button" className="chemx-reset" onClick={reset}>
            <RotateCcw size={12} />
            ĐẶT LẠI NGUYÊN TỬ
          </button>
        </div>
      </aside>

      <section className="chemx-main atom-main">
        <div className="chemx-stage atom-stage">
          <div className="chemx-stage-top">
            <span className="chemx-badge">
              <CircleDot size={12} />
              MÔ HÌNH BOHR
            </span>
            <span className="chemx-live">
              <i />
              {solved.length}/{CHALLENGES.length} THỬ THÁCH
            </span>
          </div>

          <div className="atom-scene">
            <div className="atom-orb" data-charge={charge === 0 ? "neutral" : charge > 0 ? "positive" : "negative"}>
              <svg viewBox="-160 -160 320 320" role="img" aria-label={`Mô hình nguyên tử ${symbol}`}>
                <defs>
                  <radialGradient id="atom-proton">
                    <stop offset="0%" stopColor="#ffb2a8" />
                    <stop offset="60%" stopColor="#f2545b" />
                    <stop offset="100%" stopColor="#a51d34" />
                  </radialGradient>
                  <radialGradient id="atom-neutron">
                    <stop offset="0%" stopColor="#e6edf7" />
                    <stop offset="60%" stopColor="#9aa7bd" />
                    <stop offset="100%" stopColor="#5a6478" />
                  </radialGradient>
                  <radialGradient id="atom-electron">
                    <stop offset="0%" stopColor="#e8fbff" />
                    <stop offset="55%" stopColor="#5ad1ff" />
                    <stop offset="100%" stopColor="#1d7fbe" />
                  </radialGradient>
                  <radialGradient id="atom-halo">
                    <stop offset="0%" stopColor="#7fe3ff" stopOpacity="0.28" />
                    <stop offset="70%" stopColor="#7fe3ff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#7fe3ff" stopOpacity="0" />
                  </radialGradient>
                  <filter id="atom-soft" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>

                <circle cx="0" cy="0" r="150" fill="url(#atom-halo)" />

                {SHELL_RADII.map((radius, index) => {
                  if (index >= Math.max(shells.length, 1)) return null;
                  return (
                    <circle
                      key={`ring-${radius}`}
                      cx="0"
                      cy="0"
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity={0.16}
                      strokeWidth="1"
                      strokeDasharray="3 7"
                    />
                  );
                })}

                {shells.map((count, shellIndex) => {
                  const radius = SHELL_RADII[shellIndex];
                  const duration = 14 + shellIndex * 7;
                  return (
                    <g
                      key={`shell-${shellIndex}`}
                      className="atom-shell"
                      style={{ animationDuration: `${duration}s` }}
                    >
                      {Array.from({ length: count }, (_, index) => {
                        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        return (
                          <g key={`e-${shellIndex}-${index}`}>
                            <circle cx={x} cy={y} r="9" fill="#5ad1ff" opacity="0.18" filter="url(#atom-soft)" />
                            <circle cx={x} cy={y} r="4.6" fill="url(#atom-electron)" />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                <g className="atom-nucleus">
                  {positions.map((position, index) => {
                    const isProton = index < protonNucleons;
                    return (
                      <circle
                        key={`n-${index}`}
                        cx={position.x}
                        cy={position.y}
                        r={Math.max(2.6, 4.6 - positions.length * 0.03)}
                        fill={isProton ? "url(#atom-proton)" : "url(#atom-neutron)"}
                      />
                    );
                  })}
                  {positions.length === 0 && (
                    <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeDasharray="3 3" opacity="0.4" />
                  )}
                </g>

                {shells.map((count, shellIndex) => (
                  <text
                    key={`shell-label-${shellIndex}`}
                    x={0}
                    y={-SHELL_RADII[shellIndex] - 5}
                    textAnchor="middle"
                    className="atom-shell-label"
                  >
                    {SHELL_NAMES[shellIndex]} · {count}e
                  </text>
                ))}
              </svg>
              <span className="atom-orbit-glow" aria-hidden="true" />
            </div>

            <div className="atom-summary">
              <span className="atom-summary-cap">NGUYÊN TỐ ĐANG LẮP</span>
              <div className="atom-symbol" data-charge={charge === 0 ? "neutral" : charge > 0 ? "positive" : "negative"}>
                {displaySymbol}
              </div>
              <strong>{element ? element.name : "Chưa xác định"}</strong>
              <span className="atom-summary-ion">{ionName}</span>

              <div className="atom-facts">
                <div>
                  <span>Z</span>
                  <b>{protons}</b>
                </div>
                <div>
                  <span>A</span>
                  <b>{massNumber}</b>
                </div>
                <div>
                  <span>ĐIỆN TÍCH</span>
                  <b>{chargeLabel}</b>
                </div>
              </div>

              <div className="atom-config">
                <span>CẤU HÌNH ELECTRON</span>
                <b>{config}</b>
                <em>{shells.length > 0 ? shells.map((n, i) => `${SHELL_NAMES[i]}${n}`).join(" ").toLowerCase() : "chưa có electron"}</em>
              </div>

              <div className="atom-legend">
                <span data-tone="proton">
                  <i />
                  Proton {protons}
                </span>
                <span data-tone="neutron">
                  <i />
                  Neutron {neutrons}
                </span>
                <span data-tone="electron">
                  <i />
                  Electron {electrons}
                </span>
              </div>
            </div>
          </div>

          <div className={`atom-task ${challenge ? "is-active" : ""} ${feedback ?? ""}`}>
            {challenge ? (
              <>
                <div className="atom-task-text">
                  <span>
                    <Target size={12} />
                    THỬ THÁCH ĐANG CHỌN
                  </span>
                  <strong>{challenge.title}</strong>
                  <p>{challenge.hint}</p>
                </div>
                <button type="button" className="atom-check" onClick={checkChallenge}>
                  <Check size={13} />
                  KIỂM TRA
                </button>
                {feedback === "ok" && (
                  <div className="atom-feedback is-ok">
                    <Sparkles size={14} />
                    Chính xác! Đã tạo được {challenge.answer}.
                  </div>
                )}
                {feedback === "retry" && (
                  <div className="atom-feedback is-retry">
                    <Info size={14} />
                    Chưa đúng. Hãy điều chỉnh số proton và electron theo gợi ý.
                  </div>
                )}
              </>
            ) : (
              <div className="atom-task-text">
                <span>
                  <Sparkles size={12} />
                  GỢI Ý
                </span>
                <strong>Chọn một thử thách ở cột bên trái</strong>
                <p>
                  Số proton quyết định nguyên tố, số electron quyết định điện tích ion. Neutron chỉ làm
                  thay đổi khối lượng (đồng vị).
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="chemx-side-readout">
          <div className="chemx-stat">
            <span>ĐIỆN TÍCH ION</span>
            <strong className={charge === 0 ? "" : charge > 0 ? "atom-charge-pos" : "atom-charge-neg"}>
              {charge === 0 ? "TRUNG HOÀ" : `${chargeText(charge)}`}
            </strong>
            <p className="chemx-stat-note">
              {charge === 0
                ? "Số proton bằng số electron."
                : charge > 0
                  ? `Mất ${charge} electron nên mang điện dương.`
                  : `Nhận ${Math.abs(charge)} electron nên mang điện âm.`}
            </p>
          </div>

          <div className="chemx-stat">
            <span>KHỐI LƯỢNG NGUYÊN TỬ</span>
            <strong>
              {massNumber}
              <small>u</small>
            </strong>
            <p className="chemx-stat-note">
              Xấp xỉ bằng số proton + số neutron (khối lượng electron không đáng kể).
            </p>
          </div>

          <div className="chemx-tip is-inline">
            <Atom size={12} />
            <p>
              Lớp K chứa tối đa 2e, lớp L tối đa 8e, lớp M tối đa 8e (với 20 nguyên tố đầu). Electron
              lấp đầy từ trong ra ngoài.
            </p>
          </div>

          <div className="chemx-tip is-inline">
            <Info size={12} />
            <p>
              Cùng số proton nhưng khác số neutron là các đồng vị. Cùng số proton nhưng khác số
              electron là các ion.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
