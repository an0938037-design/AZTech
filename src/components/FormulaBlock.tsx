import { useId, useState } from "react";
import { ChevronDown, Sigma } from "lucide-react";
import type { ContentBlock } from "../types";

type Formula = Extract<ContentBlock, { type: "formula" }>;

import { memo } from "react";

function FormulaBlock({ block }: { block: Formula }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const hasDetails =
    block.variables.length > 0 ||
    block.variants.length > 0 ||
    Boolean(block.note);

  return (
    <section className={`formula-block ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="formula-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="formula-icon">
          <Sigma size={17} />
        </span>
        <span className="formula-main">
          <span className="formula-name">{block.name || "Công thức"}</span>
          <code className="formula-expression">{block.expression}</code>
        </span>
        <span className="formula-action">
          {open ? "THU GỌN" : "MỞ RỘNG"}
          <ChevronDown size={15} className={open ? "rotate-180" : ""} />
        </span>
      </button>

      {open && (
        <div className="formula-body" id={bodyId}>
          {block.variables.length > 0 && (
            <div className="formula-vars">
              <span className="kicker">KÝ HIỆU</span>
              <div className="var-grid">
                {block.variables.map((variable) => (
                  <div className="var-row" key={variable.symbol}>
                    <code>{variable.symbol}</code>
                    <span>{variable.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.variants.length > 0 && (
            <div className="formula-variants">
              <span className="kicker">CÁC DẠNG BIẾN ĐỔI</span>
              <div className="variant-list">
                {block.variants.map((variant, index) => (
                  <div
                    className="variant-row"
                    key={`${variant.expression}-${index}`}
                  >
                    <span className="variant-label">
                      {variant.label || `Dạng ${index + 1}`}
                    </span>
                    <code>{variant.expression}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {block.note && <p className="formula-note">{block.note}</p>}
          {!hasDetails && (
            <p className="formula-note">
              Công thức này chưa có dạng biến đổi hoặc ghi chú kèm theo.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default memo(FormulaBlock);
