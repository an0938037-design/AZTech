import { useState } from "react";
import { Atom, Droplets, FlaskConical, Orbit, Scale, Zap } from "lucide-react";
import AtomBuilder from "./AtomBuilder";
import ConductivityLab from "./ConductivityLab";
import EquilibriumLab from "./EquilibriumLab";
import HydrolysisLab from "./HydrolysisLab";
import MoleculeViewer from "./MoleculeViewer";
import ReactionLab from "./ReactionLab";

type LabMode = "reaction" | "equilibrium" | "conductivity" | "hydrolysis" | "atom" | "molecule";

const MODES: Array<{ id: LabMode; label: string; icon: typeof FlaskConical }> = [
  { id: "reaction", label: "PHẢN ỨNG", icon: FlaskConical },
  { id: "equilibrium", label: "CÂN BẰNG", icon: Scale },
  { id: "conductivity", label: "ĐIỆN LI", icon: Zap },
  { id: "hydrolysis", label: "THUỶ PHÂN", icon: Droplets },
  { id: "atom", label: "NGUYÊN TỬ", icon: Atom },
  { id: "molecule", label: "PHÂN TỬ", icon: Orbit },
];

export default function ChemistryLab() {
  const [mode, setMode] = useState<LabMode>("reaction");

  return (
    <div className="lab-page">
      <header className="lab-top">
        <div className="lab-heading">
          <span className="lab-mark">
            <FlaskConical size={18} />
          </span>
          <div>
            <strong>PHÒNG LAB 3D</strong>
            <span>PHẢN ỨNG · CÂN BẰNG · ĐIỆN LI · THUỶ PHÂN · NGUYÊN TỬ · PHÂN TỬ</span>
          </div>
        </div>

        <div className="lab-switch" role="tablist" aria-label="Chế độ phòng lab">
          {MODES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={mode === item.id ? "is-active" : ""}
                onClick={() => setMode(item.id)}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {mode === "reaction" && <ReactionLab />}
      {mode === "equilibrium" && <EquilibriumLab />}
      {mode === "conductivity" && <ConductivityLab />}
      {mode === "hydrolysis" && <HydrolysisLab />}
      {mode === "atom" && <AtomBuilder />}
      {mode === "molecule" && <MoleculeViewer />}
    </div>
  );
}
