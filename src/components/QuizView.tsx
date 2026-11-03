import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, RotateCcw, Sparkles, Timer } from "lucide-react";
import { useStore } from "../store";
import type { SavedLesson } from "../storage";

export default function QuizView({ lesson }: { lesson: SavedLesson }) {
  const ensureQuiz = useStore((s) => s.ensureQuiz);
  const quizLoading = useStore((s) => s.quizLoading);
  const canGenerate = useStore((s) => Boolean(s.draft && s.account));
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timed, setTimed] = useState(false);
  const [duration, setDuration] = useState(5);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const quiz = useMemo(() => lesson.quiz ?? [], [lesson.quiz]);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setRunning(false);
    setTimeLeft(0);
    clearTimer();
  }, [lesson.id, quiz.length]);

  useEffect(() => {
    if (!running || submitted) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearTimer();
          setSubmitted(true);
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearTimer();
  }, [running, submitted]);

  useEffect(() => () => clearTimer(), []);

  if (quiz.length === 0) {
    return (
      <div className="empty-state">
        <CircleCheck size={28} />
        <h2>Chưa có câu hỏi</h2>
        <p>
          Bài học này chưa có phần kiểm tra. Khi bản nháp có phân tích AI, bạn
          có thể sinh câu hỏi ngay tại đây.
        </p>
        {quizLoading ? (
          <span className="loading-line">ĐANG SINH CÂU HỎI…</span>
        ) : canGenerate ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void ensureQuiz()}
          >
            <Sparkles size={14} /> Tạo câu hỏi bằng AI
          </button>
        ) : null}
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  const score = quiz.reduce(
    (total, question, index) =>
      total + (answers[index] === question.correct_answer ? 1 : 0),
    0
  );
  const percent = Math.round((score / quiz.length) * 100);

  const startExam = () => {
    setAnswers({});
    setSubmitted(false);
    setTimeLeft(Math.max(1, duration) * 60);
    setRunning(true);
  };

  const stopExam = () => {
    clearTimer();
    setRunning(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const lowTime = timed && running && timeLeft <= 30;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <div>
          <span className="kicker">KIỂM TRA KIẾN THỨC</span>
          <h2>
            {quiz.length} câu hỏi · {lesson.subject}
          </h2>
        </div>
        <div className="quiz-head-meta">
          <span className="chip">
            {lesson.quizSource === "ai" ? "AI" : "DỰ PHÒNG"}
          </span>
          {submitted && (
            <div className="score-inline">
              <strong>
                {score}/{quiz.length}
              </strong>
              <span>{percent}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="exam-bar">
        <label className="exam-toggle">
          <input
            type="checkbox"
            checked={timed}
            onChange={(event) => {
              if (running) return;
              setTimed(event.target.checked);
            }}
            disabled={running}
          />
          <span>Chế độ thi có giờ (Kho đề)</span>
        </label>
        {timed && (
          <div className="exam-config">
            <label className="field-inline">
              <span>Thời gian (phút)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={duration}
                onChange={(event) =>
                  setDuration(Math.max(1, Number(event.target.value) || 1))
                }
                disabled={running || submitted}
              />
            </label>
            {running ? (
              <div className={`exam-timer ${lowTime ? "is-low" : ""}`}>
                <Timer size={14} />
                <span>
                  {String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={startExam}
                disabled={submitted && !running}
              >
                Bắt đầu thi
              </button>
            )}
            {running && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={stopExam}
              >
                Dừng
              </button>
            )}
          </div>
        )}
      </div>

      {quizLoading && <span className="loading-line">ĐANG SINH CÂU HỎI…</span>}

      <div className="quiz-list">
        {quiz.map((question, index) => (
          <section className="quiz-card" key={`${lesson.id}-q-${index}`}>
            <div className="quiz-question">
              <span className="question-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{question.question}</h3>
            </div>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const selected = answers[index] === optionIndex;
                const correct =
                  submitted && optionIndex === question.correct_answer;
                const wrong =
                  submitted &&
                  selected &&
                  optionIndex !== question.correct_answer;
                return (
                  <button
                    type="button"
                    key={`${index}-${optionIndex}`}
                    className={`quiz-option ${selected ? "is-selected" : ""} ${
                      correct ? "is-correct" : ""
                    } ${wrong ? "is-wrong" : ""}`}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [index]: optionIndex,
                      }))
                    }
                    disabled={submitted || (timed && !running)}
                  >
                    <span className="option-key">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="option-text">{option}</span>
                    {correct && <span className="option-flag">ĐÚNG</span>}
                    {wrong && <span className="option-flag">SAI</span>}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="quiz-explanation">
                <span className="kicker">GIẢI THÍCH</span>
                <p>{question.explanation || "Chưa có giải thích."}</p>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="quiz-footer">
        <span className="quiz-progress">
          ĐÃ TRẢ LỜI {answered}/{quiz.length}
          {timed && running ? ` · CÒN ${minutes}:${String(seconds).padStart(2, "0")}` : ""}
        </span>
        {!submitted ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSubmitted(true)}
            disabled={answered === 0 || (timed && !running)}
          >
            Nộp bài
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setRunning(false);
              setTimeLeft(0);
            }}
          >
            <RotateCcw size={14} /> Làm lại
          </button>
        )}
      </div>
    </div>
  );
}
