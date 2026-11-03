import { useStore } from "../store";
import { SUBJECTS, subjectCode, subjectAccent } from "../subjects";
import type { CSSProperties } from "react";

export default function WelcomeSection() {
  const lessons = useStore((s) => s.lessons);
  const account = useStore((s) => s.account);
  const setView = useStore((s) => s.setView);
  const setField = useStore((s) => s.setField);

  const chooseSubject = (subject: string) => {
    setField("subject", subject);
    setView("create");
  };

  return (
    <section className="welcome home-welcome" aria-label="Bắt đầu nhanh">
      <div className="stat-strip">
        <div className="stat-cell">
          <span className="stat-value">{String(lessons.length).padStart(2, "0")}</span>
          <span className="stat-label">BÀI HỌC ĐÃ LƯU</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value">09</span>
          <span className="stat-label">MÔN HỌC</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value">03</span>
          <span className="stat-label">KÊNH SONG SONG</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value">{account ? "CLOUD" : "LOCAL"}</span>
          <span className="stat-label">NƠI LƯU</span>
        </div>
      </div>

      <div className="welcome-section">
        <div className="section-head">
          <div>
            <span className="kicker">BẮT ĐẦU NHANH</span>
            <h2>Chọn một môn học</h2>
          </div>
        </div>
        <div className="subject-grid">
          {SUBJECTS.map((subject, index) => (
            <button
              type="button"
              className="subject-tile"
              key={subject.name}
              onClick={() => chooseSubject(subject.name)}
              style={{ "--subject-accent": subjectAccent(subject.name) } as CSSProperties}
            >
              <span className="tile-top">
                <span className="tile-code">{subjectCode(subject.name)}</span>
                <span className="tile-index">{String(index + 1).padStart(2, "0")}</span>
              </span>
              <span className="tile-name">{subject.name}</span>
              <span className="tile-arrow">TẠO BÀI</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
