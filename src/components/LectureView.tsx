import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Clock3 } from "lucide-react";
import type { ContentBlock } from "../types";
import type { SavedLesson } from "../storage";
import FormulaBlock from "./FormulaBlock";

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return block.text;
    case "paragraph":
      return block.text;
    case "concept":
      return `${block.title} ${block.body}`;
    case "formula":
      return `${block.name} ${block.expression} ${block.variants
        .map((variant) => variant.expression)
        .join(" ")}`;
    case "warning":
      return `${block.title} ${block.body}`;
    case "example":
      return `${block.title} ${block.problem} ${block.steps.join(" ")} ${block.answer}`;
    case "list":
      return block.items.join(" ");
    case "markdown":
      return block.text;
    default:
      return "";
  }
}

function legacyMarkdown(text: string): string {
  return text
    .replace(/\[\[(.+?)\]\]/g, "**$1**")
    .replace(/^> \[!(NOTE|IMPORTANT|WARNING|TIP)\]\s*$/gm, "> **$1**");
}

import { memo } from "react";

function LectureView({ lesson }: { lesson: SavedLesson }) {
  const blocks = lesson.blocks ?? [];
  const words = blocks.map(blockText).join(" ").trim().split(/\s+/).filter(Boolean)
    .length;
  const minutes = Math.max(1, Math.round(words / 200));

  let headingIndex = 0;

  if (blocks.length === 0) {
    return (
      <div className="empty-state">
        <BookOpen size={28} />
        <h2>Chưa có nội dung bài giảng</h2>
        <p>Bản nháp này chưa có khối nội dung nào.</p>
      </div>
    );
  }

  return (
    <article className="lecture">
      <div className="lecture-meta">
        <span className="kicker">BÀI GIẢNG · {blocks.length} KHỐI</span>
        <span className="lecture-time">
          <Clock3 size={13} /> {minutes} phút đọc
        </span>
      </div>

      <div className="lecture-body">
        {blocks.map((block, index) => {
          const key = `${block.type}-${index}`;
          switch (block.type) {
            case "heading": {
              headingIndex += 1;
              const Tag =
                block.level === 1 ? "h2" : block.level === 3 ? "h4" : "h3";
              return (
                <Tag className="lecture-heading" key={key}>
                  <span className="heading-index">
                    {String(headingIndex).padStart(2, "0")}
                  </span>
                  <span>{block.text}</span>
                </Tag>
              );
            }
            case "paragraph":
              return (
                <p className="lecture-paragraph" key={key}>
                  {block.text}
                </p>
              );
            case "concept":
              return (
                <section className="concept-block" key={key}>
                  <span className="kicker">KHÁI NIỆM</span>
                  <h3>{block.title}</h3>
                  <p>{block.body}</p>
                </section>
              );
            case "formula":
              return <FormulaBlock block={block} key={key} />;
            case "warning":
              return (
                <section className="warning-block" key={key}>
                  <span className="warning-mark" aria-hidden="true">
                    !
                  </span>
                  <div>
                    <span className="kicker">CẢNH BÁO</span>
                    <h3>{block.title || "Lưu ý"}</h3>
                    <p>{block.body}</p>
                  </div>
                </section>
              );
            case "example":
              return (
                <section className="example-block" key={key}>
                  <div className="example-head">
                    <span className="kicker">VÍ DỤ</span>
                    <h3>{block.title || "Ví dụ"}</h3>
                  </div>
                  <p className="example-problem">{block.problem}</p>
                  {block.steps.length > 0 && (
                    <ol className="example-steps">
                      {block.steps.map((step, stepIndex) => (
                        <li key={`${key}-step-${stepIndex}`}>
                          <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {block.answer && (
                    <div className="example-answer">
                      <span>ĐÁP ÁN</span>
                      <p>{block.answer}</p>
                    </div>
                  )}
                </section>
              );
            case "list": {
              const Tag = block.ordered ? "ol" : "ul";
              return (
                <Tag className="lecture-list" key={key}>
                  {block.items.map((item, itemIndex) => (
                    <li key={`${key}-item-${itemIndex}`}>{item}</li>
                  ))}
                </Tag>
              );
            }
            case "markdown":
              return (
                <div className="legacy-markdown" key={key}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h2 className="lecture-heading">{children}</h2>
                      ),
                      h2: ({ children }) => (
                        <h3 className="lecture-heading">{children}</h3>
                      ),
                      h3: ({ children }) => (
                        <h4 className="lecture-heading">{children}</h4>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="legacy-callout">
                          {children}
                        </blockquote>
                      ),
                      p: ({ children }) => (
                        <p className="lecture-paragraph">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="lecture-list">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="lecture-list">{children}</ol>
                      ),
                      strong: ({ children }) => (
                        <strong className="legacy-strong">{children}</strong>
                      ),
                      code: ({ children }) => (
                        <code className="legacy-code">{children}</code>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="legacy-link"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {legacyMarkdown(block.text)}
                  </ReactMarkdown>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}

export default memo(LectureView);
