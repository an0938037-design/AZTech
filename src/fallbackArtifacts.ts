import type {
  ContentBlock,
  GraphNode,
  Lesson,
  LessonArtifacts,
  SandboxArtifact,
} from "./types";
import { fold } from "./subjects";

type LessonLike = {
  subject: string;
  topic: string;
  summary?: string;
  blocks?: ContentBlock[];
  legacy?: Lesson["legacy"];
};

interface Branch {
  title: string;
  children: string[];
}

function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clean(value: string, max = 180): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function sentences(value: string, max = 3): string[] {
  return String(value ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => clean(item, 160))
    .filter(Boolean)
    .slice(0, max);
}

/* ------------------------------- Mindmap -------------------------------- */

function legacyBranches(lesson: LessonLike): Branch[] {
  const nodes = lesson.legacy?.graph_nodes ?? [];
  const edges = lesson.legacy?.graph_edges ?? [];
  if (nodes.length === 0) return [];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = nodes.find((node) => node.type === "topic") ?? nodes[0];
  const childrenOf = new Map<string, string[]>();
  const hierarchyOf = new Map<string, string[]>();
  const containment = /chứa|bao gồm|gồm|thuộc|contains?|includes?/i;
  for (const edge of edges) {
    const list = childrenOf.get(edge.source) ?? [];
    list.push(edge.target);
    childrenOf.set(edge.source, list);

    if (!containment.test(edge.relation)) continue;
    const nested = hierarchyOf.get(edge.source) ?? [];
    nested.push(edge.target);
    hierarchyOf.set(edge.source, nested);
  }

  const seen = new Set<string>([root.id]);
  const branches: Branch[] = [];
  for (const id of childrenOf.get(root.id) ?? []) {
    const node = byId.get(id);
    if (!node || seen.has(id)) continue;
    seen.add(id);
    const children = (hierarchyOf.get(id) ?? [])
      .map((childId) => byId.get(childId))
      .filter(
        (child): child is GraphNode =>
          child !== undefined && !seen.has(child.id)
      )
      .slice(0, 5)
      .map((child) => clean(`${child.label}: ${child.description}`, 150));
    if (children.length === 0 && node.description) {
      children.push(clean(node.description, 150));
    }
    branches.push({
      title: clean(node.label, 70),
      children: children.filter(Boolean),
    });
  }

  if (branches.length === 0) {
    return nodes
      .filter((node) => node.id !== root.id)
      .slice(0, 6)
      .map((node) => ({
        title: clean(node.label, 70),
        children: [clean(node.description, 150)].filter(Boolean),
      }));
  }
  return branches;
}

function blockBranches(lesson: LessonLike): Branch[] {
  const blocks = lesson.blocks ?? [];
  const branches: Branch[] = [];
  const used = new Set<string>();
  const push = (title: string, children: string[]) => {
    const safeTitle = clean(title, 70);
    const safeChildren = children
      .map((child) => clean(child, 150))
      .filter(Boolean)
      .slice(0, 5);
    if (!safeTitle || safeChildren.length === 0) return;
    const key = fold(safeTitle);
    if (used.has(key)) return;
    used.add(key);
    branches.push({ title: safeTitle, children: safeChildren });
  };

  for (const block of blocks) {
    if (block.type === "concept") {
      push(block.title || "Khái niệm", [block.body]);
    }
  }

  const headings = blocks.filter((block) => block.type === "heading");
  for (const heading of headings.slice(0, 4)) {
    push(heading.text, [
      `Ý chính của phần ${heading.text.toLowerCase()} trong bài ${lesson.topic}.`,
    ]);
  }

  const formulas = blocks.filter((block) => block.type === "formula");
  if (formulas.length > 0) {
    push(
      "Công thức",
      formulas.map(
        (formula) =>
          `${formula.name || "Công thức"}: ${formula.expression}`.trim()
      )
    );
  }

  const warnings = blocks.filter((block) => block.type === "warning");
  if (warnings.length > 0) {
    push(
      "Lưu ý",
      warnings.map((warning) => warning.title || warning.body)
    );
  }

  const examples = blocks.filter((block) => block.type === "example");
  if (examples.length > 0) {
    push(
      "Ví dụ",
      examples.map((example) => example.title || example.problem)
    );
  }

  const lists = blocks.filter((block) => block.type === "list");
  if (lists.length > 0) {
    push(
      "Ôn tập",
      lists.flatMap((list) => list.items).slice(0, 5)
    );
  }

  if (branches.length === 0) {
    const summary = sentences(lesson.summary ?? "", 3);
    if (summary.length > 0) push("Tổng quan", summary);
  }

  return branches;
}

function ensureBranches(lesson: LessonLike, branches: Branch[]): Branch[] {
  const result = branches
    .filter((branch) => branch.title && branch.children.length > 0)
    .slice(0, 6);

  if (result.length < 3) {
    const summary = sentences(lesson.summary ?? "", 3);
    if (summary.length > 0 && !result.some((b) => fold(b.title) === "tong quan")) {
      result.push({ title: "Tổng quan", children: summary });
    }
  }
  if (result.length < 3) {
    result.push({
      title: "Ghi nhớ",
      children: [
        `Nắm được khái niệm trung tâm của ${lesson.topic}.`,
        "Tự giải thích lại bằng lời của mình.",
        "Chỉ ra một lỗi hoặc hiểu nhầm thường gặp.",
      ],
    });
  }
  if (result.length < 3) {
    result.push({
      title: "Ôn tập",
      children: [
        "Vẽ lại sơ đồ từ trí nhớ.",
        "Làm lại bài kiểm tra và ghi chú lỗi sai.",
        "Liên hệ bài học với một ví dụ thực tế.",
      ],
    });
  }
  return result.slice(0, 6);
}

function mindmapHtml(lesson: LessonLike, branches: Branch[]): string {
  const root = clean(lesson.topic || "Bài học", 80);
  const summary = clean(lesson.summary ?? "", 260);
  const branchHtml = branches
    .map(
      (branch) => `<div class="mm-node">
  <button class="mm-head" type="button" aria-expanded="true">
    <span class="mm-mark">−</span>
    <span class="mm-title">${esc(branch.title)}</span>
    <span class="mm-count">${branch.children.length}</span>
  </button>
  <ul class="mm-children">
    ${branch.children.map((child) => `<li>${esc(child)}</li>`).join("")}
  </ul>
</div>`
    )
    .join("");

  return `<div class="mm-wrap" id="mm">
  <div class="mm-meta">
    <span>${esc(lesson.subject)} / sơ đồ tư duy</span>
    <span>${branches.length} nhánh chính</span>
  </div>
  <div class="mm-toolbar">
    <button type="button" data-mm="expand">Mở tất cả</button>
    <button type="button" data-mm="collapse">Thu gọn</button>
    <span class="mm-live">BẤM VÀO NHÁNH ĐỂ MỞ / ĐÓNG</span>
  </div>
  <div class="mm-tree">
    <div class="mm-node mm-root">
      <button class="mm-head mm-root-head" type="button" aria-expanded="true">
        <span class="mm-mark">−</span>
        <span class="mm-title">${esc(root)}</span>
        <span class="mm-count">GỐC</span>
      </button>
      <div class="mm-children mm-root-children">
        ${summary ? `<p class="mm-summary">${esc(summary)}</p>` : ""}
        ${branchHtml}
      </div>
    </div>
  </div>
  <p class="mm-hint">Sơ đồ được dựng cục bộ từ cấu trúc bài học. Không có dữ liệu nào rời khỏi iframe.</p>
</div>`;
}

const MINDMAP_CSS = `
*{box-sizing:border-box;border-radius:0}
html,body{margin:0;background:#0a0a0a;color:#f5f5f5;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif}
body{padding:22px;min-height:1px}
.mm-wrap{max-width:920px;margin:0 auto}
.mm-meta{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #262626;padding-bottom:12px;margin-bottom:16px;font:10px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.14em;color:#a3a3a3;text-transform:uppercase}
.mm-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.mm-toolbar button{background:transparent;border:1px solid #333;color:#f5f5f5;padding:7px 10px;font:600 10px/1 "SFMono-Regular",Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.mm-toolbar button:hover{background:#f5f5f5;color:#0a0a0a;border-color:#f5f5f5}
.mm-live{margin-left:auto;font:9px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.1em;color:#737373}
.mm-tree{border:1px solid #262626;background:#0d0d0d;padding:18px}
.mm-node{position:relative}
.mm-head{display:flex;align-items:center;gap:10px;width:100%;background:#0a0a0a;border:1px solid #333;color:#f5f5f5;padding:10px 12px;font:600 13px/1.35 "Segoe UI",system-ui,Arial,sans-serif;text-align:left;cursor:pointer}
.mm-head:hover{background:#f5f5f5;color:#0a0a0a;border-color:#f5f5f5}
.mm-head:hover .mm-count{color:#0a0a0a;border-color:#0a0a0a}
.mm-root-head{background:#f5f5f5;color:#0a0a0a;border-color:#f5f5f5;font-size:15px;letter-spacing:-.01em;padding:13px 14px}
.mm-root-head .mm-count{color:#0a0a0a;border-color:#0a0a0a}
.mm-mark{width:16px;flex:none;text-align:center;font:14px/1 "SFMono-Regular",Consolas,monospace}
.mm-title{flex:1;min-width:0}
.mm-count{flex:none;font:9px/1 "SFMono-Regular",Consolas,monospace;letter-spacing:.08em;color:#a3a3a3;border:1px solid #333;padding:3px 5px;text-transform:uppercase}
.mm-children{list-style:none;margin:0 0 10px 18px;padding:8px 0 0 18px;border-left:1px solid #333}
.mm-root-children{margin-left:22px;margin-top:12px;padding-top:0;border-left:1px solid #333}
.mm-root-children>.mm-node{margin-bottom:10px}
.mm-node>.mm-children>li{position:relative;padding:7px 0 7px 16px;font-size:12.5px;line-height:1.55;color:#c9c9c9;border-bottom:1px dashed #222}
.mm-node>.mm-children>li:last-child{border-bottom:0}
.mm-node>.mm-children>li:before{content:"";position:absolute;left:-18px;top:19px;width:14px;border-top:1px solid #333}
.mm-node.is-collapsed>.mm-children{display:none}
.mm-summary{margin:0 0 14px;padding:12px 14px;border:1px solid #262626;background:#0a0a0a;color:#a3a3a3;font-size:12.5px;line-height:1.65}
.mm-hint{margin:14px 0 0;font:10px/1.6 "SFMono-Regular",Consolas,monospace;color:#737373;letter-spacing:.03em}
@media(max-width:640px){
  body{padding:14px}
  .mm-tree{padding:12px}
  .mm-children{margin-left:10px;padding-left:12px}
  .mm-root-children{margin-left:12px}
  .mm-head{font-size:12px;padding:9px 10px}
  .mm-live{display:none}
}
`;

const MINDMAP_JS = `
(function(){
  function sendHeight(){
    var h=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0,320);
    h=Math.min(h,4000);
    try{parent.postMessage({type:"sandbox:height",height:h},"*");}catch(e){}
  }
  function setCollapsed(node,collapsed){
    if(!node)return;
    node.classList.toggle("is-collapsed",collapsed);
    var btn=node.querySelector(":scope > .mm-head");
    var mark=btn?btn.querySelector(".mm-mark"):null;
    if(btn)btn.setAttribute("aria-expanded",collapsed?"false":"true");
    if(mark)mark.textContent=collapsed?"+":"−";
  }
  document.addEventListener("click",function(event){
    var btn=event.target.closest(".mm-head");
    if(!btn)return;
    var node=btn.parentElement;
    setCollapsed(node,!node.classList.contains("is-collapsed"));
    sendHeight();
  });
  var expand=document.querySelector('[data-mm="expand"]');
  var collapse=document.querySelector('[data-mm="collapse"]');
  if(expand)expand.addEventListener("click",function(){
    document.querySelectorAll(".mm-node").forEach(function(node){setCollapsed(node,false);});
    sendHeight();
  });
  if(collapse)collapse.addEventListener("click",function(){
    document.querySelectorAll(".mm-root-children .mm-node").forEach(function(node){setCollapsed(node,true);});
    sendHeight();
  });
  window.addEventListener("load",sendHeight);
  window.addEventListener("resize",sendHeight);
  if(window.ResizeObserver){
    try{new ResizeObserver(sendHeight).observe(document.documentElement);}catch(e){}
  }
  setTimeout(sendHeight,60);
  setTimeout(sendHeight,420);
})();
`;

export function buildFallbackMindmap(lesson: LessonLike): SandboxArtifact {
  const legacy = legacyBranches(lesson);
  const blocks = blockBranches(lesson);
  const branches = ensureBranches(
    lesson,
    legacy.length >= 2 ? legacy : blocks.length > 0 ? blocks : legacy
  );
  return {
    kind: "mindmap",
    title: `Sơ đồ tư duy: ${lesson.topic || "Bài học"}`,
    html: mindmapHtml(lesson, branches),
    css: MINDMAP_CSS,
    js: MINDMAP_JS,
    meta: { layout: "tree", source: "local-fallback" },
  };
}

/* ----------------------------- Interactive ------------------------------ */

interface Widget {
  widget: string;
  html: string;
  js: string;
}

const INTERACTIVE_CSS = `
*{box-sizing:border-box;border-radius:0}
html,body{margin:0;background:#0a0a0a;color:#f5f5f5;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif}
body{padding:22px;min-height:1px}
.lab{max-width:980px;margin:0 auto}
.lab-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid #262626;padding-bottom:14px;margin-bottom:18px}
.lab-kicker{font:10px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.18em;color:#a3a3a3;text-transform:uppercase}
.lab-head h2{font-size:21px;line-height:1.2;margin:6px 0 0;font-weight:650;letter-spacing:-.015em}
.lab-badge{font:9px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.1em;border:1px solid #333;color:#a3a3a3;padding:5px 7px;text-transform:uppercase;white-space:nowrap}
.lab-grid{display:grid;grid-template-columns:minmax(230px,.9fr) minmax(0,1.35fr);gap:18px;align-items:start}
.lab-controls{display:flex;flex-direction:column;gap:14px;border:1px solid #262626;background:#0d0d0d;padding:16px}
.control{display:flex;flex-direction:column;gap:7px;font:10px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.09em;color:#a3a3a3;text-transform:uppercase}
.control .row{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.control b{color:#f5f5f5;font:12px/1 "SFMono-Regular",Consolas,monospace;letter-spacing:0;text-transform:none}
input[type=range]{width:100%;accent-color:#f5f5f5;height:20px;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-thumb{width:12px;height:18px;background:#f5f5f5;border:0}
input[type=number],input[type=text],select,textarea{width:100%;background:#0a0a0a;border:1px solid #333;color:#f5f5f5;padding:9px 10px;font:12px/1.4 "SFMono-Regular",Consolas,monospace;outline:none}
input[type=number]:focus,input[type=text]:focus,select:focus,textarea:focus{border-color:#f5f5f5}
textarea{resize:vertical;min-height:74px}
select{cursor:pointer}
.readout{border-top:1px solid #262626;padding-top:10px;display:flex;flex-direction:column;gap:4px}
.readout span{font:9px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.1em;color:#737373;text-transform:uppercase}
.readout strong{font:600 17px/1.2 "SFMono-Regular",Consolas,monospace;color:#f5f5f5;letter-spacing:-.02em}
.readout.big strong{font-size:28px}
.lab-stage{border:1px solid #262626;background:#0d0d0d;padding:12px;min-width:0;overflow:hidden}
.lab-stage svg,.lab-stage canvas{display:block;width:100%;height:auto;background:#0a0a0a}
.lab-note{margin:16px 0 0;font:10px/1.7 "SFMono-Regular",Consolas,monospace;color:#737373;border-top:1px solid #262626;padding-top:12px;letter-spacing:.02em}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font:9px/1.4 "SFMono-Regular",Consolas,monospace;color:#a3a3a3;text-transform:uppercase;letter-spacing:.08em}
.legend i{display:inline-block;width:8px;height:8px;border:1px solid #f5f5f5;margin-right:6px;vertical-align:-1px}
.btn{background:#f5f5f5;color:#0a0a0a;border:1px solid #f5f5f5;padding:8px 12px;font:600 10px/1 "SFMono-Regular",Consolas,monospace;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}
.btn:hover{background:#fff}
.btn.ghost{background:transparent;color:#f5f5f5;border-color:#333}
.btn.ghost:hover{background:#1a1a1a;border-color:#f5f5f5}
.btn-row{display:flex;gap:8px;flex-wrap:wrap}
.bar{height:10px;border:1px solid #333;background:#0a0a0a;margin-top:6px}
.bar i{display:block;height:100%;background:#f5f5f5;width:0;transition:width .12s linear}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid #333;padding:4px 7px;font:9px/1.4 "SFMono-Regular",Consolas,monospace;color:#a3a3a3;text-transform:uppercase;letter-spacing:.06em}
.chip.on{background:#f5f5f5;color:#0a0a0a;border-color:#f5f5f5}
.code{background:#0a0a0a;border:1px solid #262626;padding:16px;font:12px/1.75 "SFMono-Regular",Consolas,monospace;color:#d4d4d4;white-space:pre-wrap;margin:0;overflow:auto;min-height:150px}
.formula-bar{border:1px solid #262626;border-top:0;background:#0d0d0d;padding:9px 11px;font:11px/1.4 "SFMono-Regular",Consolas,monospace;color:#a3a3a3}
.sheet{border-collapse:collapse;width:100%;font:12px/1.4 "SFMono-Regular",Consolas,monospace}
.sheet th,.sheet td{border:1px solid #333;padding:0;height:38px;text-align:left}
.sheet th{background:#151515;color:#a3a3a3;padding:0 10px;font-weight:400;width:38px;text-align:center}
.sheet input{border:0;background:transparent;color:#f5f5f5;width:100%;height:36px;padding:0 10px;font:12px/1.4 "SFMono-Regular",Consolas,monospace;outline:none}
.sheet input:focus{background:#171717;box-shadow:inset 0 0 0 1px #f5f5f5}
.sheet .active-cell{background:#171717}
.beakers{display:flex;align-items:flex-end;justify-content:space-around;gap:20px;min-height:250px;padding:20px 10px}
.beaker-wrap{display:flex;flex-direction:column;align-items:center;gap:9px}
.beaker-label{font:9px/1.4 "SFMono-Regular",Consolas,monospace;letter-spacing:.1em;color:#a3a3a3;text-transform:uppercase}
.beaker{position:relative;width:112px;height:164px;border:1px solid #3f3f3f;border-top:0;background:#0a0a0a;overflow:hidden}
.beaker:before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:#3f3f3f}
.beaker-fill{position:absolute;left:0;right:0;bottom:0;height:30%;background:repeating-linear-gradient(45deg,#1c1c1c,#1c1c1c 5px,#141414 5px,#141414 10px);border-top:1px solid #f5f5f5;transition:height .15s linear}
.beaker-meta{font:9px/1.4 "SFMono-Regular",Consolas,monospace;color:#737373}
.chem-formula{border-top:1px solid #262626;padding-top:12px;font:11px/1.6 "SFMono-Regular",Consolas,monospace;color:#a3a3a3}
.cell-part{cursor:pointer;transition:opacity .12s linear}
.cell-part:hover{opacity:.78}
.cell-part.active{filter:drop-shadow(0 0 0 #fff)}
.cell-part.active .part-shape{stroke:#fff;stroke-width:2.5}
.part-shape{transition:stroke .12s linear}
@media(max-width:720px){
  body{padding:14px}
  .lab-grid{grid-template-columns:1fr}
  .lab-head h2{font-size:18px}
  .beaker{width:90px;height:140px}
}
`;

function labShell(lesson: LessonLike, widget: Widget): string {
  return `<div class="lab">
  <div class="lab-head">
    <div>
      <span class="lab-kicker">Mô hình tương tác · ${esc(lesson.subject)}</span>
      <h2>${esc(lesson.topic || "Bài học")}</h2>
    </div>
    <span class="lab-badge">Tham số trực tiếp</span>
  </div>
  ${widget.html}
  <p class="lab-note">Kết quả cập nhật ngay khi thay đổi tham số. Mô hình chạy trong iframe cô lập, không dùng thư viện ngoài và không kết nối mạng.</p>
</div>`;
}

function mathWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Hệ số a</span><b id="m-va">1.00</b></span>
      <input id="m-a" type="range" min="-3" max="3" step="0.1" value="1">
    </label>
    <label class="control">
      <span class="row"><span>Hệ số b</span><b id="m-vb">0.00</b></span>
      <input id="m-b" type="range" min="-6" max="6" step="0.5" value="0">
    </label>
    <label class="control">
      <span class="row"><span>Hệ số c</span><b id="m-vc">0.00</b></span>
      <input id="m-c" type="range" min="-6" max="6" step="0.5" value="0">
    </label>
    <div class="readout">
      <span>Phương trình</span>
      <strong id="m-eq" style="font-size:13px">y = 1.00x²</strong>
    </div>
    <div class="readout">
      <span>Đỉnh parabol</span>
      <strong id="m-vertex" style="font-size:13px">(0.00; 0.00)</strong>
    </div>
    <div class="readout">
      <span>Biệt thức Δ</span>
      <strong id="m-delta" style="font-size:13px">0.00</strong>
    </div>
    <div class="readout">
      <span>Nghiệm thực</span>
      <strong id="m-roots" style="font-size:13px">x = 0.00</strong>
    </div>
  </div>
  <div class="lab-stage">
    <svg id="m-plot" viewBox="0 0 520 340" role="img" aria-label="Đồ thị hàm số bậc hai">
      <g id="m-grid"></g>
      <path id="m-curve" d="" fill="none" stroke="#f5f5f5" stroke-width="2"></path>
      <circle id="m-dot" cx="260" cy="170" r="5" fill="#0a0a0a" stroke="#f5f5f5" stroke-width="2"></circle>
      <text x="500" y="160" fill="#737373" font-family="monospace" font-size="10">x</text>
      <text x="270" y="14" fill="#737373" font-family="monospace" font-size="10">y</text>
    </svg>
    <div class="legend"><span><i></i>Đồ thị y = ax² + bx + c</span><span><i style="border-color:#737373"></i>Trục tọa độ</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var NS="http://www.w3.org/2000/svg";
  var W=520,H=340,CX=260,CY=170,SX=40,SY=18;
  var a=document.getElementById("m-a");
  var b=document.getElementById("m-b");
  var c=document.getElementById("m-c");
  var grid=document.getElementById("m-grid");
  var curve=document.getElementById("m-curve");
  var dot=document.getElementById("m-dot");
  function add(tag,attrs,parent){
    var el=document.createElementNS(NS,tag);
    Object.keys(attrs).forEach(function(key){el.setAttribute(key,attrs[key]);});
    (parent||grid).appendChild(el);
    return el;
  }
  function drawGrid(){
    grid.textContent="";
    for(var i=-6;i<=6;i++){
      var x=CX+i*SX;
      add("line",{x1:x,y1:0,x2:x,y2:H,stroke:i===0?"#3f3f3f":"#1c1c1c","stroke-width":i===0?1.4:1});
      var y=CY+i*SY;
      add("line",{x1:0,y1:y,x2:W,y2:y,stroke:i===0?"#3f3f3f":"#1c1c1c","stroke-width":i===0?1.4:1});
    }
    for(var j=-6;j<=6;j++){
      add("text",{x:CX+j*SX+3,y:CY+13,fill:"#525252","font-family":"monospace","font-size":"9"},grid).textContent=String(j);
    }
  }
  function fmt(v){return (Math.round(v*100)/100).toFixed(2);}
  function update(){
    var av=parseFloat(a.value);
    var bv=parseFloat(b.value);
    var cv=parseFloat(c.value);
    document.getElementById("m-va").textContent=fmt(av);
    document.getElementById("m-vb").textContent=fmt(bv);
    document.getElementById("m-vc").textContent=fmt(cv);
    var eq="y = "+fmt(av)+"x² "+(bv>=0?"+ ":"− ")+fmt(Math.abs(bv))+"x "+(cv>=0?"+ ":"− ")+fmt(Math.abs(cv));
    document.getElementById("m-eq").textContent=eq;
    var pts=[];
    for(var px=0;px<=W;px+=2){
      var x=(px-CX)/SX;
      var y=av*x*x+bv*x+cv;
      var py=CY-y*SY;
      pts.push((pts.length?"L":"M")+px.toFixed(1)+" "+py.toFixed(1));
    }
    curve.setAttribute("d",pts.join(" "));
    var delta=bv*bv-4*av*cv;
    document.getElementById("m-delta").textContent=fmt(delta);
    if(Math.abs(av)<0.0001){
      dot.style.display="none";
      document.getElementById("m-vertex").textContent="a = 0: đồ thị là đường thẳng";
      document.getElementById("m-roots").textContent=Math.abs(bv)<0.0001?(Math.abs(cv)<0.0001?"Vô số nghiệm":"Vô nghiệm"):"x = "+fmt(-cv/bv);
      return;
    }
    dot.style.display="block";
    var vx=-bv/(2*av);
    var vy=av*vx*vx+bv*vx+cv;
    dot.setAttribute("cx",CX+vx*SX);
    dot.setAttribute("cy",CY-vy*SY);
    document.getElementById("m-vertex").textContent="("+fmt(vx)+"; "+fmt(vy)+")";
    if(delta<0){
      document.getElementById("m-roots").textContent="Vô nghiệm thực";
    }else if(Math.abs(delta)<0.0001){
      document.getElementById("m-roots").textContent="x = "+fmt(-bv/(2*av));
    }else{
      var r=Math.sqrt(delta);
      document.getElementById("m-roots").textContent="x₁ = "+fmt((-bv-r)/(2*av))+" · x₂ = "+fmt((-bv+r)/(2*av));
    }
  }
  [a,b,c].forEach(function(input){input.addEventListener("input",update);});
  drawGrid();
  update();
})();
`;
  return { widget: "function_plot", html, js };
}

function ohmWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Hiệu điện thế U</span><b id="p-vu">12 V</b></span>
      <input id="p-u" type="range" min="0" max="24" step="1" value="12">
    </label>
    <label class="control">
      <span class="row"><span>Điện trở R</span><b id="p-vr">4 Ω</b></span>
      <input id="p-r" type="range" min="1" max="20" step="1" value="4">
    </label>
    <div class="readout big">
      <span>Cường độ dòng điện I = U / R</span>
      <strong id="p-i">3.00 A</strong>
    </div>
    <div class="readout">
      <span>Công suất P = U · I</span>
      <strong id="p-power">36.0 W</strong>
    </div>
    <div class="bar"><i id="p-bar"></i></div>
  </div>
  <div class="lab-stage">
    <svg viewBox="0 0 520 340" role="img" aria-label="Mạch điện minh hoạ định luật Ohm">
      <rect x="36" y="34" width="448" height="272" fill="none" stroke="#1f1f1f"></rect>
      <path d="M100 92 H420 V250 H100 Z" fill="none" stroke="#3f3f3f" stroke-width="2"></path>
      <rect x="205" y="74" width="110" height="36" fill="#0a0a0a" stroke="#f5f5f5" stroke-width="2"></rect>
      <text x="260" y="97" text-anchor="middle" fill="#f5f5f5" font-family="monospace" font-size="13">R</text>
      <circle cx="100" cy="171" r="20" fill="#0a0a0a" stroke="#f5f5f5" stroke-width="2"></circle>
      <line x1="93" y1="164" x2="107" y2="178" stroke="#f5f5f5"></line>
      <line x1="93" y1="178" x2="107" y2="164" stroke="#f5f5f5"></line>
      <text x="100" y="215" text-anchor="middle" fill="#737373" font-family="monospace" font-size="10">NGUỒN</text>
      <text id="p-u-label" x="260" y="140" text-anchor="middle" fill="#a3a3a3" font-family="monospace" font-size="11">U = 12 V</text>
      <text id="p-r-label" x="360" y="97" text-anchor="middle" fill="#a3a3a3" font-family="monospace" font-size="11">R = 4 Ω</text>
      <text id="p-i-label" x="260" y="285" text-anchor="middle" fill="#f5f5f5" font-family="monospace" font-size="13">I = 3.00 A</text>
      <line x1="100" y1="92" x2="100" y2="150" stroke="#737373" stroke-width="1.5"></line>
      <line x1="100" y1="192" x2="100" y2="250" stroke="#737373" stroke-width="1.5"></line>
      <line x1="120" y1="250" x2="420" y2="250" stroke="#737373" stroke-width="1.5"></line>
    </svg>
    <div class="legend"><span><i></i>Dòng điện</span><span><i style="border-color:#737373"></i>Dây dẫn</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var u=document.getElementById("p-u");
  var r=document.getElementById("p-r");
  function fmt(v,n){return v.toFixed(n);}
  function update(){
    var uv=parseFloat(u.value);
    var rv=parseFloat(r.value);
    var current=rv>0?uv/rv:0;
    var power=uv*current;
    document.getElementById("p-vu").textContent=uv+" V";
    document.getElementById("p-vr").textContent=rv+" Ω";
    document.getElementById("p-i").textContent=fmt(current,2)+" A";
    document.getElementById("p-power").textContent=fmt(power,1)+" W";
    document.getElementById("p-u-label").textContent="U = "+uv+" V";
    document.getElementById("p-r-label").textContent="R = "+rv+" Ω";
    document.getElementById("p-i-label").textContent="I = "+fmt(current,2)+" A";
    document.getElementById("p-bar").style.width=Math.min(100,current/24*100)+"%";
  }
  [u,r].forEach(function(input){input.addEventListener("input",update);});
  update();
})();
`;
  return { widget: "circuit", html, js };
}

function pendulumWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Chiều dài dây L</span><b id="pen-vl">1.00 m</b></span>
      <input id="pen-l" type="range" min="0.4" max="2.5" step="0.05" value="1">
    </label>
    <label class="control">
      <span class="row"><span>Gia tốc g</span><b id="pen-vg">9.8 m/s²</b></span>
      <input id="pen-g" type="range" min="1.6" max="25" step="0.1" value="9.8">
    </label>
    <label class="control">
      <span class="row"><span>Góc thả</span><b id="pen-va">25°</b></span>
      <input id="pen-a" type="range" min="5" max="45" step="1" value="25">
    </label>
    <div class="readout big">
      <span>Chu kỳ T = 2π√(L/g)</span>
      <strong id="pen-period">2.01 s</strong>
    </div>
    <div class="btn-row">
      <button id="pen-toggle" class="btn" type="button">Dừng</button>
      <button id="pen-reset" class="btn ghost" type="button">Thả lại</button>
    </div>
  </div>
  <div class="lab-stage">
    <canvas id="pen-canvas" width="520" height="340"></canvas>
    <div class="legend"><span><i></i>Quỹ đạo</span><span><i style="border-color:#737373"></i>Dây treo</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var canvas=document.getElementById("pen-canvas");
  var ctx=canvas.getContext("2d");
  var len=document.getElementById("pen-l");
  var grav=document.getElementById("pen-g");
  var amp=document.getElementById("pen-a");
  var toggle=document.getElementById("pen-toggle");
  var reset=document.getElementById("pen-reset");
  var running=true;
  var angle=0,velocity=0,last=0,raf=0,trail=[];
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){running=false;toggle.textContent="Chạy";}
  function values(){
    return {L:parseFloat(len.value),g:parseFloat(grav.value),a:parseFloat(amp.value)*Math.PI/180};
  }
  function resetMotion(){
    var v=values();
    angle=v.a;velocity=0;trail=[];
    document.getElementById("pen-vl").textContent=v.L.toFixed(2)+" m";
    document.getElementById("pen-vg").textContent=v.g.toFixed(1)+" m/s²";
    document.getElementById("pen-va").textContent=Math.round(parseFloat(amp.value))+"°";
    document.getElementById("pen-period").textContent=(2*Math.PI*Math.sqrt(v.L/v.g)).toFixed(2)+" s";
  }
  function draw(){
    var v=values();
    var w=canvas.width,h=canvas.height,cx=w/2,cy=48,ppm=105;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle="#1c1c1c";
    ctx.lineWidth=1;
    for(var i=1;i<8;i++){ctx.beginPath();ctx.moveTo(0,i*42);ctx.lineTo(w,i*42);ctx.stroke();}
    for(var j=1;j<10;j++){ctx.beginPath();ctx.moveTo(j*52,0);ctx.lineTo(j*52,h);ctx.stroke();}
    ctx.strokeStyle="#3f3f3f";
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,h);ctx.stroke();
    ctx.fillStyle="#a3a3a3";
    ctx.fillRect(cx-34,cy-6,68,6);
    var bx=cx+Math.sin(angle)*v.L*ppm;
    var by=cy+Math.cos(angle)*v.L*ppm;
    if(trail.length>1){
      ctx.strokeStyle="#262626";
      ctx.lineWidth=1;
      ctx.beginPath();
      for(var k=0;k<trail.length;k++){
        if(k===0)ctx.moveTo(trail[k].x,trail[k].y);else ctx.lineTo(trail[k].x,trail[k].y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle="#737373";
    ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(bx,by);ctx.stroke();
    ctx.fillStyle="#f5f5f5";
    ctx.beginPath();ctx.arc(bx,by,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#0a0a0a";
    ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#737373";
    ctx.font="10px monospace";
    ctx.fillText("L = "+v.L.toFixed(2)+" m",12,h-16);
    ctx.fillText("T = "+(2*Math.PI*Math.sqrt(v.L/v.g)).toFixed(2)+" s",12,h-32);
  }
  function frame(now){
    if(!last)last=now;
    var dt=Math.min(0.033,(now-last)/1000);
    last=now;
    var v=values();
    if(running){
      var acc=-(v.g/v.L)*Math.sin(angle);
      velocity+=acc*dt;
      angle+=velocity*dt;
      var bx=canvas.width/2+Math.sin(angle)*v.L*105;
      var by=48+Math.cos(angle)*v.L*105;
      trail.push({x:bx,y:by});
      if(trail.length>70)trail.shift();
    }
    draw();
    raf=requestAnimationFrame(frame);
  }
  [len,grav,amp].forEach(function(input){
    input.addEventListener("input",function(){resetMotion();draw();});
  });
  toggle.addEventListener("click",function(){
    running=!running;
    toggle.textContent=running?"Dừng":"Chạy";
  });
  reset.addEventListener("click",function(){resetMotion();draw();});
  resetMotion();
  raf=requestAnimationFrame(frame);
  window.addEventListener("pagehide",function(){cancelAnimationFrame(raf);});
})();
`;
  return { widget: "pendulum", html, js };
}

function chemistryWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Nồng độ ban đầu C₁</span><b id="ch-vc1">0.10 M</b></span>
      <input id="ch-c1" type="range" min="0.01" max="1" step="0.01" value="0.1">
    </label>
    <label class="control">
      <span class="row"><span>Thể tích ban đầu V₁</span><b id="ch-vv1">20 mL</b></span>
      <input id="ch-v1" type="range" min="10" max="100" step="5" value="20">
    </label>
    <label class="control">
      <span class="row"><span>Thể tích sau pha V₂</span><b id="ch-vv2">200 mL</b></span>
      <input id="ch-v2" type="range" min="100" max="1000" step="25" value="200">
    </label>
    <div class="readout big">
      <span>Nồng độ sau C₂ = C₁·V₁/V₂</span>
      <strong id="ch-c2">0.010 M</strong>
    </div>
    <div class="readout">
      <span>pH = −log[H⁺]</span>
      <strong id="ch-ph">2.00</strong>
    </div>
    <div class="readout">
      <span>Môi trường</span>
      <strong id="ch-medium">Axit</strong>
    </div>
  </div>
  <div class="lab-stage">
    <div class="beakers">
      <div class="beaker-wrap">
        <span class="beaker-label">Ban đầu</span>
        <div class="beaker"><div id="ch-fill1" class="beaker-fill"></div></div>
        <span id="ch-meta1" class="beaker-meta">20 mL · 0.10 M</span>
      </div>
      <div class="beaker-wrap">
        <span class="beaker-label">Sau khi pha</span>
        <div class="beaker"><div id="ch-fill2" class="beaker-fill"></div></div>
        <span id="ch-meta2" class="beaker-meta">200 mL · 0.010 M</span>
      </div>
    </div>
    <div id="ch-eq" class="chem-formula">C₂ = 0.10 × 20 / 200 = 0.010 M</div>
  </div>
</div>`;

  const js = `
(function(){
  var c1=document.getElementById("ch-c1");
  var v1=document.getElementById("ch-v1");
  var v2=document.getElementById("ch-v2");
  function update(){
    var C1=parseFloat(c1.value);
    var V1=parseFloat(v1.value);
    var V2=parseFloat(v2.value);
    var C2=C1*V1/V2;
    var ph=Math.max(0,Math.min(14,-Math.log10(C2)));
    var medium=ph<6.95?"Axit":ph>7.05?"Bazơ":"Trung tính";
    document.getElementById("ch-vc1").textContent=C1.toFixed(2)+" M";
    document.getElementById("ch-vv1").textContent=V1+" mL";
    document.getElementById("ch-vv2").textContent=V2+" mL";
    document.getElementById("ch-c2").textContent=(C2<0.001?C2.toExponential(2):C2.toFixed(4))+" M";
    document.getElementById("ch-ph").textContent=ph.toFixed(2);
    document.getElementById("ch-medium").textContent=medium;
    document.getElementById("ch-meta1").textContent=V1+" mL · "+C1.toFixed(2)+" M";
    document.getElementById("ch-meta2").textContent=V2+" mL · "+(C2<0.001?C2.toExponential(2):C2.toFixed(4))+" M";
    document.getElementById("ch-eq").textContent="C₂ = "+C1.toFixed(2)+" × "+V1+" / "+V2+" = "+(C2<0.001?C2.toExponential(2):C2.toFixed(4))+" M";
    document.getElementById("ch-fill1").style.height=Math.max(8,Math.min(88,V1/100*70))+"%";
    document.getElementById("ch-fill2").style.height=Math.max(8,Math.min(88,V2/1000*70))+"%";
  }
  [c1,v1,v2].forEach(function(input){input.addEventListener("input",update);});
  update();
})();
`;
  return { widget: "dilution", html, js };
}

function biologyWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Nhu cầu năng lượng</span><b id="bio-ve">50%</b></span>
      <input id="bio-energy" type="range" min="0" max="100" step="1" value="50">
    </label>
    <div class="readout big">
      <span>ATP ước tính</span>
      <strong id="bio-atp">50</strong>
    </div>
    <div class="readout">
      <span>Bào quan đang chọn</span>
      <strong id="bio-part-name" style="font-size:15px">Ti thể</strong>
    </div>
    <p id="bio-part-desc" class="lab-note" style="margin:0;border:0;padding:0">Bào quan sản xuất ATP, cung cấp năng lượng cho hoạt động sống của tế bào.</p>
  </div>
  <div class="lab-stage">
    <svg viewBox="0 0 520 340" role="img" aria-label="Sơ đồ tế bào tương tác">
      <g class="cell-part active" data-name="Màng tế bào" data-desc="Lớp phospholipid kép bao bọc tế bào, kiểm soát chất ra vào." role="button" tabindex="0">
        <rect class="part-shape" x="38" y="30" width="444" height="280" fill="none" stroke="#f5f5f5" stroke-width="2"></rect>
        <text x="52" y="52" fill="#a3a3a3" font-family="monospace" font-size="10">MÀNG TẾ BÀO</text>
      </g>
      <g class="cell-part" data-name="Nhân tế bào" data-desc="Chứa DNA, là trung tâm điều khiển hoạt động của tế bào." role="button" tabindex="0">
        <circle class="part-shape" cx="250" cy="170" r="52" fill="#171717" stroke="#a3a3a3" stroke-width="2"></circle>
        <circle cx="250" cy="170" r="18" fill="#3f3f3f"></circle>
        <text x="250" y="238" text-anchor="middle" fill="#a3a3a3" font-family="monospace" font-size="10">NHÂN</text>
      </g>
      <g id="bio-mito" class="cell-part" data-name="Ti thể" data-desc="Bào quan sản xuất ATP, cung cấp năng lượng cho hoạt động sống của tế bào." role="button" tabindex="0" style="transform-box:fill-box;transform-origin:center;transition:transform .15s linear">
        <ellipse class="part-shape" cx="390" cy="120" rx="46" ry="24" fill="#111" stroke="#f5f5f5" stroke-width="2"></ellipse>
        <path d="M356 120 Q370 104 384 120 T412 120" fill="none" stroke="#737373" stroke-width="1.5"></path>
        <text x="390" y="160" text-anchor="middle" fill="#a3a3a3" font-family="monospace" font-size="10">TI THỂ</text>
      </g>
      <g class="cell-part" data-name="Tế bào chất" data-desc="Môi trường gel chứa các bào quan và diễn ra nhiều phản ứng chuyển hoá." role="button" tabindex="0">
        <path class="part-shape" d="M120 250 C150 220 190 240 210 260" fill="none" stroke="#3f3f3f" stroke-width="2"></path>
        <text x="150" y="292" text-anchor="middle" fill="#737373" font-family="monospace" font-size="10">TẾ BÀO CHẤT</text>
      </g>
      <text x="260" y="324" text-anchor="middle" fill="#525252" font-family="monospace" font-size="9">BẤM VÀO MỘT BỘ PHẬN ĐỂ XEM CHỨC NĂNG</text>
    </svg>
    <div class="legend"><span><i></i>Bào quan</span><span><i style="border-color:#737373"></i>Màng</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var energy=document.getElementById("bio-energy");
  var mito=document.getElementById("bio-mito");
  function selectPart(part){
    document.querySelectorAll(".cell-part").forEach(function(item){item.classList.remove("active");});
    part.classList.add("active");
    document.getElementById("bio-part-name").textContent=part.getAttribute("data-name");
    document.getElementById("bio-part-desc").textContent=part.getAttribute("data-desc");
  }
  document.querySelectorAll(".cell-part").forEach(function(part){
    part.addEventListener("click",function(){selectPart(part);});
    part.addEventListener("keydown",function(event){
      if(event.key==="Enter"||event.key===" "){event.preventDefault();selectPart(part);}
    });
  });
  function update(){
    var value=parseFloat(energy.value);
    document.getElementById("bio-ve").textContent=Math.round(value)+"%";
    document.getElementById("bio-atp").textContent=String(Math.round(20+value*0.6));
    mito.style.transform="scale("+(0.82+value/260).toFixed(3)+")";
  }
  energy.addEventListener("input",update);
  update();
})();
`;
  return { widget: "cell", html, js };
}

function literatureWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Điểm cao trào</span><b id="lit-vt">65%</b></span>
      <input id="lit-tension" type="range" min="0" max="100" step="1" value="65">
    </label>
    <label class="control">
      <span>Câu chủ đề</span>
      <textarea id="lit-thesis" placeholder="Viết một câu nêu vấn đề trung tâm..."></textarea>
    </label>
    <div class="readout">
      <span>Số từ</span>
      <strong id="lit-words">0</strong>
    </div>
    <div class="readout">
      <span>Gợi ý nhịp</span>
      <strong id="lit-advice" style="font-size:13px">Dẫn dắt tăng dần</strong>
    </div>
  </div>
  <div class="lab-stage">
    <svg viewBox="0 0 520 340" role="img" aria-label="Đường cong nhịp cảm xúc">
      <g stroke="#1c1c1c" stroke-width="1">
        <line x1="40" y1="290" x2="480" y2="290"></line>
        <line x1="40" y1="220" x2="480" y2="220"></line>
        <line x1="40" y1="150" x2="480" y2="150"></line>
        <line x1="40" y1="80" x2="480" y2="80"></line>
      </g>
      <path id="lit-curve" d="" fill="none" stroke="#f5f5f5" stroke-width="2"></path>
      <line id="lit-guide" x1="40" y1="60" x2="40" y2="290" stroke="#3f3f3f" stroke-dasharray="4 4"></line>
      <circle id="lit-marker" cx="40" cy="290" r="6" fill="#0a0a0a" stroke="#f5f5f5" stroke-width="2"></circle>
      <text x="40" y="316" fill="#737373" font-family="monospace" font-size="10">MỞ</text>
      <text x="250" y="316" fill="#737373" font-family="monospace" font-size="10" text-anchor="middle">DIỄN BIẾN</text>
      <text x="480" y="316" fill="#737373" font-family="monospace" font-size="10" text-anchor="end">KẾT</text>
    </svg>
    <div class="legend"><span><i></i>Nhịp cảm xúc</span><span><i style="border-color:#737373"></i>Điểm cao trào</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var slider=document.getElementById("lit-tension");
  var curve=document.getElementById("lit-curve");
  var marker=document.getElementById("lit-marker");
  var guide=document.getElementById("lit-guide");
  var thesis=document.getElementById("lit-thesis");
  function point(t){
    var x=40+t*440;
    var y=290-(Math.sin(t*Math.PI)*180+t*38);
    return {x:x,y:y};
  }
  function buildCurve(){
    var pts=[];
    for(var i=0;i<=100;i++){
      var p=point(i/100);
      pts.push((i===0?"M":"L")+p.x.toFixed(1)+" "+p.y.toFixed(1));
    }
    curve.setAttribute("d",pts.join(" "));
  }
  function update(){
    var value=parseFloat(slider.value);
    var p=point(value/100);
    document.getElementById("lit-vt").textContent=Math.round(value)+"%";
    marker.setAttribute("cx",p.x);
    marker.setAttribute("cy",p.y);
    guide.setAttribute("x1",p.x);
    guide.setAttribute("x2",p.x);
    var advice=value<30?"Mở bài chậm, giữ dư địa":value<70?"Dẫn dắt tăng dần":"Cao trào gần cuối, kết nhanh";
    document.getElementById("lit-advice").textContent=advice;
  }
  function countWords(){
    var value=thesis.value.trim();
    var words=value?value.split(/\\s+/).length:0;
    document.getElementById("lit-words").textContent=String(words);
  }
  slider.addEventListener("input",update);
  thesis.addEventListener("input",countWords);
  buildCurve();
  update();
  countWords();
})();
`;
  return { widget: "narrative", html, js };
}

function historyWidget(lesson: LessonLike): Widget {
  const topic = lesson.topic || "Bài học";
  const isDienBien = fold(topic).includes("dien bien");
  const milestones = isDienBien
    ? [
        { year: "1953", title: "Chuẩn bị chiến dịch", desc: "Bộ Chính trị quyết định mở chiến dịch Điện Biên Phủ, huy động sức người và sức của toàn quốc." },
        { year: "13/03/1954", title: "Mở màn", desc: "Quân ta tiêu diệt cứ điểm Him Lam, mở màn chiến dịch với phương châm đánh chắc, tiến chắc." },
        { year: "30/03/1954", title: "Đợt tiến công thứ hai", desc: "Ta siết chặt vòng vây, đánh chiếm các cứ điểm phía đông và chia cắt sân bay Mường Thanh." },
        { year: "07/05/1954", title: "Kết thúc thắng lợi", desc: "Đồi A1 và khu trung tâm thất thủ, tướng De Castries bị bắt; chiến dịch toàn thắng." },
        { year: "1954", title: "Ý nghĩa", desc: "Chiến thắng góp phần kết thúc chiến tranh, mở ra trang mới cho cách mạng Việt Nam." },
      ]
    : [
        { year: "01", title: "Bối cảnh", desc: `Bối cảnh lịch sử và nguyên nhân dẫn đến ${topic}.` },
        { year: "02", title: "Diễn biến", desc: `Các mốc chính trong diễn biến của ${topic}.` },
        { year: "03", title: "Kết quả", desc: `Những kết quả nổi bật và tác động trực tiếp của ${topic}.` },
        { year: "04", title: "Ý nghĩa", desc: `Bài học kinh nghiệm và ý nghĩa lịch sử của ${topic}.` },
      ];
  const data = JSON.stringify(milestones).replace(/</g, "\\u003c");

  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Mốc thời gian</span><b id="hist-vyear">${esc(milestones[0].year)}</b></span>
      <input id="hist-time" type="range" min="0" max="${milestones.length - 1}" step="1" value="0">
    </label>
    <div class="readout">
      <span>Sự kiện</span>
      <strong id="hist-title" style="font-size:16px">${esc(milestones[0].title)}</strong>
    </div>
    <p id="hist-desc" class="lab-note" style="margin:0;border:0;padding:0">${esc(milestones[0].desc)}</p>
  </div>
  <div class="lab-stage">
    <svg id="hist-svg" viewBox="0 0 520 340" role="img" aria-label="Dòng thời gian sự kiện"></svg>
    <div class="legend"><span><i></i>Mốc đang chọn</span><span><i style="border-color:#737373"></i>Các mốc khác</span></div>
  </div>
</div>`;

  const js = `
(function(){
  var milestones=${data};
  var slider=document.getElementById("hist-time");
  var svg=document.getElementById("hist-svg");
  var NS="http://www.w3.org/2000/svg";
  function add(tag,attrs,parent){
    var el=document.createElementNS(NS,tag);
    Object.keys(attrs).forEach(function(key){el.setAttribute(key,attrs[key]);});
    (parent||svg).appendChild(el);
    return el;
  }
  function render(){
    var index=parseInt(slider.value,10);
    svg.textContent="";
    add("line",{x1:48,y1:170,x2:472,y2:170,stroke:"#3f3f3f","stroke-width":2});
    var step=milestones.length>1?404/(milestones.length-1):0;
    milestones.forEach(function(item,i){
      var x=48+i*step;
      var active=i===index;
      add("line",{x1:x,y1:active?120:146,x2:x,y2:active?170:170,stroke:active?"#f5f5f5":"#333","stroke-width":1});
      add("circle",{cx:x,cy:170,r:active?9:5,fill:active?"#f5f5f5":"#0a0a0a",stroke:active?"#f5f5f5":"#737373","stroke-width":2});
      add("text",{x:x,y:200,fill:active?"#f5f5f5":"#737373","font-family":"monospace","font-size":"10","text-anchor":"middle"},svg).textContent=item.year;
      var label=add("text",{x:x,y:i%2===0?250:96,fill:active?"#f5f5f5":"#737373","font-family":"monospace","font-size":"9","text-anchor":"middle"},svg);
      label.textContent=item.title.toUpperCase();
      var hit=add("rect",{x:x-22,y:120,width:44,height:100,fill:"transparent",style:"cursor:pointer"},svg);
      hit.addEventListener("click",function(){slider.value=String(i);render();});
    });
    var current=milestones[index];
    document.getElementById("hist-vyear").textContent=current.year;
    document.getElementById("hist-title").textContent=current.title;
    document.getElementById("hist-desc").textContent=current.desc;
  }
  slider.addEventListener("input",render);
  render();
})();
`;
  return { widget: "timeline", html, js };
}

function officeWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span>Phép tính</span>
      <select id="off-op">
        <option value="SUM">SUM — Tổng</option>
        <option value="AVERAGE">AVERAGE — Trung bình</option>
        <option value="PRODUCT">PRODUCT — Tích</option>
        <option value="MAX">MAX — Lớn nhất</option>
        <option value="MIN">MIN — Nhỏ nhất</option>
      </select>
    </label>
    <div class="readout big">
      <span>Kết quả</span>
      <strong id="off-result">25</strong>
    </div>
    <div class="readout">
      <span>Công thức</span>
      <strong id="off-formula" style="font-size:12px">=SUM(A1:C1)</strong>
    </div>
    <div class="bar"><i id="off-bar" style="width:62%"></i></div>
  </div>
  <div class="lab-stage">
    <table class="sheet" aria-label="Bảng tính mô phỏng">
      <thead><tr><th></th><th>A</th><th>B</th><th>C</th></tr></thead>
      <tbody>
        <tr><th>1</th><td class="active-cell"><input id="off-a" type="number" value="12" aria-label="Ô A1"></td><td><input id="off-b" type="number" value="8" aria-label="Ô B1"></td><td><input id="off-c" type="number" value="5" aria-label="Ô C1"></td></tr>
        <tr><th>2</th><td><input type="text" value="Dữ liệu" disabled aria-label="Ô A2"></td><td><input type="text" value="ô nhập" disabled aria-label="Ô B2"></td><td><input type="text" value="tính toán" disabled aria-label="Ô C2"></td></tr>
        <tr><th>3</th><td><input type="text" value="" disabled aria-label="Ô A3"></td><td><input type="text" value="" disabled aria-label="Ô B3"></td><td><input type="text" value="" disabled aria-label="Ô C3"></td></tr>
      </tbody>
    </table>
    <div id="off-bar-formula" class="formula-bar">fx &nbsp; =SUM(A1:C1)</div>
  </div>
</div>`;

  const js = `
(function(){
  var a=document.getElementById("off-a");
  var b=document.getElementById("off-b");
  var c=document.getElementById("off-c");
  var op=document.getElementById("off-op");
  function update(){
    var values=[parseFloat(a.value)||0,parseFloat(b.value)||0,parseFloat(c.value)||0];
    var operation=op.value;
    var result=0;
    if(operation==="SUM")result=values[0]+values[1]+values[2];
    else if(operation==="AVERAGE")result=(values[0]+values[1]+values[2])/3;
    else if(operation==="PRODUCT")result=values[0]*values[1]*values[2];
    else if(operation==="MAX")result=Math.max(values[0],values[1],values[2]);
    else if(operation==="MIN")result=Math.min(values[0],values[1],values[2]);
    var rounded=Math.round(result*100)/100;
    document.getElementById("off-result").textContent=String(rounded);
    var formula="="+operation+"(A1:C1)";
    document.getElementById("off-formula").textContent=formula;
    document.getElementById("off-bar-formula").textContent="fx   "+formula+"   →   "+rounded;
    document.getElementById("off-bar").style.width=Math.max(4,Math.min(100,Math.abs(rounded)/40*100))+"%";
  }
  [a,b,c].forEach(function(input){input.addEventListener("input",update);});
  op.addEventListener("change",update);
  update();
})();
`;
  return { widget: "spreadsheet", html, js };
}

function programmingWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span>Kiểu dữ liệu</span>
      <select id="prog-type">
        <option value="int">int — số nguyên</option>
        <option value="float">float — số thực</option>
        <option value="string">string — chuỗi</option>
        <option value="boolean">boolean — logic</option>
      </select>
    </label>
    <label class="control">
      <span>Giá trị</span>
      <input id="prog-value" type="text" value="42">
    </label>
    <div class="readout">
      <span>Trạng thái</span>
      <strong id="prog-status" style="font-size:15px;color:#f5f5f5">Hợp lệ</strong>
    </div>
    <div class="readout">
      <span>Bộ nhớ ước tính</span>
      <strong id="prog-bytes" style="font-size:15px">4 byte</strong>
    </div>
    <p id="prog-explain" class="lab-note" style="margin:0;border:0;padding:0">Số nguyên được lưu trong 4 byte.</p>
  </div>
  <div class="lab-stage">
    <pre id="prog-code" class="code">int x = 42;
Console.WriteLine(x);</pre>
    <div class="formula-bar">Mô phỏng kiểm tra kiểu dữ liệu — không chạy mã thật.</div>
  </div>
</div>`;

  const js = `
(function(){
  var type=document.getElementById("prog-type");
  var value=document.getElementById("prog-value");
  function check(){
    var kind=type.value;
    var raw=value.value;
    var valid=false;
    var bytes=0;
    var explain="";
    var literal=raw;
    if(kind==="int"){
      valid=/^-?\\d+$/.test(raw.trim());
      bytes=4;
      explain=valid?"Số nguyên được lưu trong 4 byte.":"int chỉ nhận số nguyên, không có dấu chấm thập phân.";
    }else if(kind==="float"){
      valid=/^-?\\d+(\\.\\d+)?$/.test(raw.trim());
      bytes=8;
      explain=valid?"Số thực được lưu trong 8 byte (double).":"float cần dạng số, ví dụ 3.14.";
    }else if(kind==="string"){
      valid=true;
      bytes=raw.length*2;
      explain="Chuỗi lưu theo UTF-16, mỗi ký tự khoảng 2 byte.";
      literal=JSON.stringify(raw);
    }else{
      valid=/^(true|false|0|1)$/i.test(raw.trim());
      bytes=1;
      explain=valid?"boolean chỉ nhận true hoặc false.":"boolean chỉ nhận true hoặc false.";
      literal=raw.trim().toLowerCase()==="1"||raw.trim().toLowerCase()==="true"?"true":"false";
    }
    var status=document.getElementById("prog-status");
    status.textContent=valid?"Hợp lệ":"Không hợp lệ";
    status.style.color=valid?"#f5f5f5":"#a3a3a3";
    document.getElementById("prog-bytes").textContent=bytes+" byte";
    document.getElementById("prog-explain").textContent=explain;
    document.getElementById("prog-code").textContent=(valid?kind:"// lỗi kiểu")+" x = "+literal+";\\nConsole.WriteLine(x);";
  }
  type.addEventListener("change",check);
  value.addEventListener("input",check);
  check();
})();
`;
  return { widget: "code", html, js };
}

function englishWidget(): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span>Chủ ngữ</span>
      <select id="eng-subject">
        <option>I</option><option>You</option><option>We</option><option>They</option>
        <option>He</option><option>She</option><option>It</option>
      </select>
    </label>
    <label class="control">
      <span>Động từ</span>
      <input id="eng-verb" type="text" value="go">
    </label>
    <label class="control">
      <span>Loại câu</span>
      <select id="eng-kind">
        <option value="aff">Khẳng định</option>
        <option value="neg">Phủ định</option>
        <option value="q">Nghi vấn</option>
      </select>
    </label>
    <div class="readout big">
      <span>Kết quả</span>
      <strong id="eng-out" style="font-size:20px">I go.</strong>
    </div>
  </div>
  <div class="lab-stage">
    <pre id="eng-table" class="code"></pre>
    <div class="formula-bar">Present Simple — thói quen, sự thật hiển nhiên.</div>
  </div>
</div>`;

  const js = `
(function(){
  var subject=document.getElementById("eng-subject");
  var verb=document.getElementById("eng-verb");
  var kind=document.getElementById("eng-kind");
  function cap(text){return text?text.charAt(0).toUpperCase()+text.slice(1):text;}
  function thirdForm(base){
    if(base==="be")return "is";
    if(base==="have")return "has";
    if(base==="do")return "does";
    if(/(s|x|z|ch|sh|o)$/.test(base))return base+"es";
    if(/[^aeiou]y$/.test(base))return base.slice(0,-1)+"ies";
    return base+"s";
  }
  function forms(){
    var s=subject.value;
    var base=verb.value.trim().toLowerCase()||"go";
    var third=s==="He"||s==="She"||s==="It";
    if(base==="be"){
      var beMap={I:"am",You:"are",We:"are",They:"are",He:"is",She:"is",It:"is"};
      var be=beMap[s]||"are";
      return {
        aff:cap(s)+" "+be+".",
        neg:cap(s)+" "+be+" not.",
        q:cap(be)+" "+s.toLowerCase()+"?"
      };
    }
    return {
      aff:cap(s)+" "+(third?thirdForm(base):base)+".",
      neg:cap(s)+" "+(third?"does not":"do not")+" "+base+".",
      q:(third?"Does":"Do")+" "+s.toLowerCase()+" "+base+"?"
    };
  }
  function update(){
    var all=forms();
    var selected=all[kind.value];
    document.getElementById("eng-out").textContent=selected;
    document.getElementById("eng-table").textContent="Khẳng định:  "+all.aff+"\\nPhủ định:    "+all.neg+"\\nNghi vấn:    "+all.q;
  }
  [subject,verb,kind].forEach(function(input){input.addEventListener("input",update);input.addEventListener("change",update);});
  update();
})();
`;
  return { widget: "language", html, js };
}

function genericWidget(lesson: LessonLike): Widget {
  const html = `<div class="lab-grid">
  <div class="lab-controls">
    <label class="control">
      <span class="row"><span>Mức độ tự tin</span><b id="gen-v">50%</b></span>
      <input id="gen-level" type="range" min="0" max="100" step="1" value="50">
    </label>
    <div class="readout big">
      <span>Mức độ nắm bài</span>
      <strong id="gen-out">50%</strong>
    </div>
    <div class="bar"><i id="gen-bar" style="width:50%"></i></div>
  </div>
  <div class="lab-stage">
    <div class="code">1. Đọc lại phần tóm tắt.\n2. Tự giải thích ${esc(lesson.topic)} bằng lời của mình.\n3. Làm bài kiểm tra và ghi chú lỗi sai.\n4. Vẽ lại sơ đồ tư duy từ trí nhớ.</div>
  </div>
</div>`;

  const js = `
(function(){
  var level=document.getElementById("gen-level");
  function update(){
    var value=parseFloat(level.value);
    document.getElementById("gen-v").textContent=Math.round(value)+"%";
    document.getElementById("gen-out").textContent=Math.round(value)+"%";
    document.getElementById("gen-bar").style.width=value+"%";
  }
  level.addEventListener("input",update);
  update();
})();
`;
  return { widget: "generic", html, js };
}

export function buildFallbackInteractive(lesson: LessonLike): SandboxArtifact {
  const subject = fold(lesson.subject);
  const topic = fold(lesson.topic);
  let widget: Widget;

  if (subject.includes("tin hoc van phong")) {
    widget = officeWidget();
  } else if (subject.includes("tin hoc") || subject.includes("lap trinh")) {
    widget = programmingWidget();
  } else if (subject.includes("toan")) {
    widget = mathWidget();
  } else if (subject.includes("vat")) {
    widget =
      topic.includes("lac") || topic.includes("dao dong")
        ? pendulumWidget()
        : ohmWidget();
  } else if (subject.includes("hoa")) {
    widget = chemistryWidget();
  } else if (subject.includes("sinh")) {
    widget = biologyWidget();
  } else if (subject.includes("ngu van") || subject.includes("van")) {
    widget = literatureWidget();
  } else if (subject.includes("lich su")) {
    widget = historyWidget(lesson);
  } else if (subject.includes("tieng anh")) {
    widget = englishWidget();
  } else {
    widget = genericWidget(lesson);
  }

  return {
    kind: "interactive",
    title: `Mô hình: ${lesson.topic || "Bài học"}`,
    html: labShell(lesson, widget),
    css: INTERACTIVE_CSS,
    js: widget.js,
    meta: { widget: widget.widget, source: "local-fallback" },
  };
}

export function buildFallbackArtifacts(lesson: LessonLike): LessonArtifacts {
  return {
    mindmap: buildFallbackMindmap(lesson),
    interactive: buildFallbackInteractive(lesson),
  };
}
