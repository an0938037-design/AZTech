import { useState } from "react";
import { Atom, FlaskConical } from "lucide-react";
import MoleculeViewer from "./MoleculeViewer";
import ReactionLab from "./ReactionLab";

type LabMode = "reaction" | "molecule";

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
            <span>ĐIỀU CHẾ · PHẢN ỨNG · PHÂN TỬ</span>
          </div>
        </div>

        <div className="lab-switch" role="tablist" aria-label="Chế độ phòng lab">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "reaction"}
            className={mode === "reaction" ? "is-active" : ""}
            onClick={() => setMode("reaction")}
          >
            <FlaskConical size={13} />
            PHẢN ỨNG
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "molecule"}
            className={mode === "molecule" ? "is-active" : ""}
            onClick={() => setMode("molecule")}
          >
            <Atom size={13} />
            PHÂN TỬ
          </button>
        </div>
      </header>

      {mode === "reaction" ? <ReactionLab /> : <MoleculeViewer />}
    </div>
  );
}
