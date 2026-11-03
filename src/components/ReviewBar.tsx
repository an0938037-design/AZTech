import { useState } from "react";
import { Check, CircleAlert, X } from "lucide-react";

interface Props {
  hasAccount: boolean;
  error: string | null;
  onKeep: () => Promise<void> | void;
  onDiscard: () => void;
}

export default function ReviewBar({
  hasAccount,
  error,
  onKeep,
  onDiscard,
}: Props) {
  const [saving, setSaving] = useState(false);

  const handleKeep = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onKeep();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="review-bar">
      <div className="review-info">
        <span className="review-pulse" aria-hidden="true" />
        <div>
          <span className="kicker">BẢN NHÁP · CHỈ NẰM TRONG RAM</span>
          <p>
            Chưa có gì được lưu. Chọn “Giữ lại” để ghi
            {hasAccount ? " lên tài khoản cloud" : " vào trình duyệt này"}.
          </p>
          {error && (
            <p className="review-error">
              <CircleAlert size={13} /> {error}
            </p>
          )}
        </div>
      </div>
      <div className="review-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onDiscard}
          disabled={saving}
        >
          <X size={14} /> Không giữ
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleKeep()}
          disabled={saving}
        >
          <Check size={14} />
          {saving
            ? "ĐANG LƯU…"
            : hasAccount
              ? "GIỮ LẠI · CLOUD"
              : "GIỮ LẠI · MÁY NÀY"}
        </button>
      </div>
    </div>
  );
}
