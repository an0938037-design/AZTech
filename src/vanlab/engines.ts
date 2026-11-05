/* Engine của trạm Vạn Ngôn: ba máy chạy trong trình duyệt (WebAssembly / VM),
   một khung sandbox cho JS, và Wandbox cho những compiler nặng. */

import type { EngineRef } from "./languages";

const CDN = "https://cdn.jsdelivr.net/npm";
const PYODIDE = `${CDN}/pyodide@0.27.7`;
const SQLJS = `${CDN}/sql.js@1.11.0`;
const WANDBOX_API = "https://wandbox.org/api/compile.json";

export interface RunTable {
  columns: string[];
  rows: unknown[][];
}

export interface RunResult {
  out: string;
  err: string;
  exit: number;
  ms: number;
  noteText?: string;
  preview?: string;
  table?: RunTable;
  engineLabel?: string;
}

export interface RunOptions {
  stdin?: string;
  args?: string;
  flags?: string;
  timeLimit?: number;
  companion?: string;
  note?: (message: string) => void;
}

const list = (s: string) => String(s || "").split(/\s+/).filter(Boolean);
const tail = (s: string) => (s.endsWith("\n") ? s : s + "\n");

class Cap {
  out = "";
  err = "";
  write(s: string, stream = "out") {
    if (stream === "err") this.err += s;
    else this.out += s;
  }
}

function loadScript(src: string) {
  return new Promise<void>((ok, bad) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => ok();
    el.onerror = () => bad(new Error(`Không tải được thư viện: ${src}`));
    document.head.appendChild(el);
  });
}

const external = (url: string) => import(/* @vite-ignore */ url);

/* ---------------------------------- JavaScript ---------------------------------- */

const JS_BOOT = `
const send = (o) => parent.postMessage(o, "*");
const inspect = (v, seen) => {
  seen = seen || new Set();
  if (typeof v === "string") return v;
  if (typeof v === "bigint") return v + "n";
  if (typeof v === "function") return "[Function " + (v.name || "anonymous") + "]";
  if (v instanceof Error) return v.name + ": " + v.message;
  if (v && typeof v === "object") {
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    try {
      if (Array.isArray(v)) return "[" + v.map((x) => inspect(x, seen)).join(", ") + "]";
      if (v instanceof Map) return "Map{" + [...v].map(([k, x]) => inspect(k, seen) + " => " + inspect(x, seen)).join(", ") + "}";
      if (v instanceof Set) return "Set{" + [...v].map((x) => inspect(x, seen)).join(", ") + "}";
      const parts = Object.keys(v).map((k) => k + ": " + inspect(v[k], seen));
      if (!parts.length && v.constructor && v.constructor.name !== "Object") return v.constructor.name + "{}";
      return "{" + parts.join(", ") + "}";
    } finally { seen.delete(v); }
  }
  return String(v);
};
const emit = (stream, args) => send({ t: "log", stream, s: args.map((a) => inspect(a)).join(stream === "out" ? " " : "\\n") + "\\n" });
["log", "info", "debug", "dir", "table"].forEach((m) => { console[m] = (...a) => emit("out", a); });
["warn", "error"].forEach((m) => { console[m] = (...a) => emit("err", a); });
const _lines = __STDIN__;
let _i = 0;
globalThis.readline = () => (_i < _lines.length ? _lines[_i++] : null);
globalThis.input = globalThis.readline;
globalThis.argv = __ARGV__;
globalThis.prompt = (m) => { emit("out", [m || ""]); return globalThis.readline(); };
addEventListener("error", (e) => send({ t: "done", exit: 1, err: (e.error && e.error.stack) || e.message }));
addEventListener("unhandledrejection", (e) => send({ t: "done", exit: 1, err: "Uncaught (in promise) " + inspect(e.reason) }));
(async () => {
  try { await (async () => { __CODE__ })(); send({ t: "done", exit: 0 }); }
  catch (e) { send({ t: "done", exit: 1, err: (e && e.stack) || inspect(e) }); }
})();
`;

function runBrowserJs(code: string, { stdin = "", args = "", timeLimit = 20 }: RunOptions) {
  return new Promise<RunResult>((resolve) => {
    const started = performance.now();
    const cap = new Cap();
    let settled = false;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-4px;top:-4px;width:1px;height:1px;border:0";

    const finish = (exit: number, extraErr?: string, cut?: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (extraErr) cap.write(tail(extraErr), "err");
      if (cut) cap.write("(mã không nhường vòng lặp nên dòng in cuối cùng chưa kịp gửi ra ngoài)\n");
      frame.remove();
      resolve({ out: cap.out, err: cap.err, exit, ms: performance.now() - started });
    };

    const onMessage = (e: MessageEvent) => {
      const m = e.data as { t?: string; s?: string; stream?: string; exit?: number; err?: string };
      if (!m || typeof m !== "object" || e.source !== frame.contentWindow) return;
      if (m.t === "log") cap.write(String(m.s || ""), m.stream);
      else if (m.t === "done") finish(Number(m.exit ?? 0), m.err);
    };

    const boot = JS_BOOT.replace("__STDIN__", () =>
      JSON.stringify(stdin.length ? stdin.replace(/\n$/, "").split("\n") : [])
    )
      .replace("__ARGV__", () => JSON.stringify(list(args)))
      .replace("__CODE__", () => code);

    window.addEventListener("message", onMessage);
    const timer = setTimeout(
      () => finish(124, `Hết thời gian sau ${timeLimit}s — mã có thể đang lặp vô hạn.`, true),
      timeLimit * 1000
    );
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><script>${boot}<\/script>`;
    document.body.appendChild(frame);
  });
}

/* ------------------------------------ Python ------------------------------------ */

interface Pyodide {
  globals: { set: (k: string, v: unknown) => void };
  runPython: (src: string) => unknown;
  runPythonAsync: (src: string) => Promise<unknown>;
  setStdout: (o: { batched: (s: string) => void }) => void;
  setStderr: (o: { batched: (s: string) => void }) => void;
  loadPackagesFromImports: (src: string) => Promise<unknown>;
}

let pyodidePromise: Promise<Pyodide> | null = null;
const pyoCap = { cap: null as Cap | null };

async function ensurePyodide(note: (m: string) => void) {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      note("nạp Pyodide — CPython biên dịch sang WebAssembly, lần đầu tải khoảng 10–15 MB…");
      const mod = await external(`${PYODIDE}/pyodide.mjs`);
      const loadPyodide = (mod as { loadPyodide: (o: { indexURL: string }) => Promise<Pyodide> }).loadPyodide;
      const py = await loadPyodide({ indexURL: `${PYODIDE}/` });
      py.setStdout({ batched: (s) => pyoCap.cap?.write(tail(s)) });
      py.setStderr({ batched: (s) => pyoCap.cap?.write(tail(s), "err") });
      return py;
    })().catch((e) => {
      pyodidePromise = null;
      throw e;
    });
  }
  return pyodidePromise;
}

async function runPyodide(code: string, { stdin = "", args = "", timeLimit = 20, note = () => {} }: RunOptions): Promise<RunResult> {
  const started = performance.now();
  const cap = new Cap();
  pyoCap.cap = cap;
  let báoThức: number | undefined;
  try {
    const py = await ensurePyodide(note);
    py.globals.set("__van_stdin", stdin);
    py.globals.set("__van_argv", ["prog", ...list(args)]);
    py.runPython(
      "import sys, io\n" +
        "sys.stdin = io.StringIO(__van_stdin)\n" +
        "sys.argv = __van_argv\n" +
        "del __van_stdin, __van_argv\n"
    );
    if (/\b(import|from)\s/.test(code)) {
      note("thử nạp gói phụ thuộc từ mã của bạn…");
      await py.loadPackagesFromImports(code).catch(() => {});
    }
    const hetGiờ = new Promise((_, rej) => {
      báoThức = window.setTimeout(
        () =>
          rej(
            new Error(
              `Đã chạy quá ${timeLimit}s. Pyodide không thể bị cắt giữa chừng — hãy bấm “từ xa” nếu mã của bạn lặp vô hạn.`
            )
          ),
        timeLimit * 1000
      );
    });
    await Promise.race([py.runPythonAsync(code), hetGiờ]);
    return { out: cap.out, err: cap.err, exit: 0, ms: performance.now() - started };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg && !cap.err.includes(msg)) cap.write(tail(msg), "err");
    return { out: cap.out, err: cap.err, exit: 1, ms: performance.now() - started };
  } finally {
    window.clearTimeout(báoThức);
    pyoCap.cap = null;
  }
}

/* -------------------------------------- Lua -------------------------------------- */

const LUA_PRELUDE = (lines: string[], argv: string[]) =>
  "local _out = {} ; io = io or {} ; " +
  "io.write = function(...) local a = {...} ; for i = 1, #a do _out[#_out + 1] = tostring(a[i]) end ; return true end ; " +
  "print = function(...) local a = {...} ; for i = 1, #a do if i > 1 then io.write(string.char(9)) end ; io.write(a[i]) end ; io.write(string.char(10)) end ; " +
  `local _lines = { ${lines.map((s) => JSON.stringify(s)).join(", ")} } ; local _i = 0 ; ` +
  "io.read = function() _i = _i + 1 ; return _lines[_i] end ; " +
  `arg = { ${argv.map((s) => JSON.stringify(s)).join(", ")} }`;

const LUA_FOOTER =
  " ; _VAN_OUT = table.concat(_out) ; _VAN_ERR = _ok and '' or tostring(_why) ; _VAN_EXIT = _ok and 0 or 1";

interface FengariNs {
  lua: {
    lua_getglobal: (L: unknown, s: number[]) => void;
    lua_isnil: (L: unknown, i: number) => boolean;
    lua_tojsstring: (L: unknown, i: number) => string | undefined;
    lua_pop: (L: unknown, n: number) => void;
    lua_pcall: (L: unknown, a: number, b: number, c: number) => number;
    lua_close?: (L: unknown) => void;
  };
  lauxlib: {
    luaL_newstate: () => unknown;
    luaL_openlibs: (L: unknown) => void;
    luaL_loadstring: (L: unknown, s: number[]) => number;
  };
  lualib: { luaL_openlibs: (L: unknown) => void };
  to_luastring: (s: string) => number[];
}

let fengariPromise: Promise<FengariNs> | null = null;

async function ensureFengari() {
  if (!fengariPromise) {
    fengariPromise = external(`${CDN}/fengari-web@0.1.4/+esm`)
      .then((mod) => {
        const ns = ((mod as { default?: unknown }).default ?? mod) as Partial<FengariNs>;
        if (!ns.lua || !ns.lauxlib || !ns.lualib || !ns.to_luastring)
          throw new Error("Fengari không cung cấp API mong đợi");
        return ns as FengariNs;
      })
      .catch((e) => {
        fengariPromise = null;
        throw e;
      });
  }
  return fengariPromise;
}

/* Lua báo lỗi theo dòng của cả cụm (mở đầu + mã người dùng) nên dịch lại về dòng tương đối. */
const vietLuaError = (msg: string) =>
  String(msg)
    .replace(/\[string ".*?"\]:(\d+):/g, (_, n: string) => `dòng ${Math.max(1, Number(n) - 1)}: `)
    .replace(/^\[string ".*?"\]: /, "");

async function runFengari(code: string, { stdin = "", args = "", note = () => {} }: RunOptions): Promise<RunResult> {
  const started = performance.now();
  const { lua, lauxlib, lualib, to_luastring } = await ensureFengari();
  note("nạp Fengari — máy ảo Lua viết bằng JavaScript…");

  const lines = stdin.length ? stdin.replace(/\n$/, "").split("\n") : [];
  const chunk =
    LUA_PRELUDE(lines, list(args)) +
    "\nlocal _ok, _why = pcall(function()\n" +
    code +
    "\nend)" +
    LUA_FOOTER;

  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const pull = (name: string) => {
    lua.lua_getglobal(L, to_luastring(name));
    const v = lua.lua_isnil(L, -1) ? "" : String(lua.lua_tojsstring(L, -1));
    lua.lua_pop(L, 1);
    return v;
  };
  const popError = () => {
    const m = String(lua.lua_tojsstring(L, -1) || "lỗi Lua không rõ");
    lua.lua_pop(L, 1);
    return m;
  };

  let exit = 0;
  let err = "";
  if (lauxlib.luaL_loadstring(L, to_luastring(chunk)) !== 0) {
    err = vietLuaError(popError());
    exit = 1;
  } else if (lua.lua_pcall(L, 0, 0, 0) !== 0) {
    err = vietLuaError(popError());
    exit = 1;
  } else {
    err = vietLuaError(pull("_VAN_ERR"));
    exit = Number(pull("_VAN_EXIT")) || 0;
  }
  const out = pull("_VAN_OUT");
  lua.lua_close?.(L);
  return { out, err: err ? tail(err) : "", exit, ms: performance.now() - started };
}

/* --------------------------------------- SQL --------------------------------------- */

export function alignTable(columns: string[], rows: unknown[][]) {
  const cells = rows.map((r) => r.map((v) => (v === null || v === undefined ? "NULL" : String(v))));
  const w = columns.map((c, i) => Math.max(c.length, ...cells.map((r) => (r[i] || "").length), 4));
  const line = (r: string[]) => "| " + r.map((v, i) => String(v).padEnd(w[i])).join(" | ") + " |";
  const sep = "+" + w.map((n) => "-".repeat(n + 2)).join("+") + "+";
  return [sep, line(columns), sep, ...cells.map(line), sep].join("\n") + "\n";
}

function splitSql(code: string) {
  const out: string[] = [];
  let buf = "";
  let quote: string | null = null;
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (quote) {
      buf += c;
      if (c === quote) {
        if (code[i + 1] === quote) buf += code[++i];
        else quote = null;
      }
    } else if (c === "'" || c === '"') {
      buf += c;
      quote = c;
    } else if (c === "-" && code[i + 1] === "-") {
      while (i < code.length && code[i] !== "\n") buf += code[i++];
      buf += "\n";
    } else if (c === ";") {
      if (buf.trim()) out.push(buf);
      buf = "";
    } else buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

interface SqlDatabase {
  exec: (stmt: string) => { columns: string[]; values: unknown[][] }[];
  getRowsModified: () => number;
  close: () => void;
}

let sqlPromise: Promise<{ Database: new () => SqlDatabase }> | null = null;

async function ensureSqlJs() {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const w = window as unknown as { initSqlJs?: (o: { locateFile: (f: string) => string }) => Promise<{ Database: new () => SqlDatabase }> };
      if (!w.initSqlJs) await loadScript(`${SQLJS}/dist/sql-wasm.js`);
      return w.initSqlJs!({ locateFile: (f: string) => `${SQLJS}/dist/${f}` });
    })().catch((e) => {
      sqlPromise = null;
      throw e;
    });
  }
  return sqlPromise;
}

async function runSqlJs(code: string, { timeLimit = 20, note = () => {} }: RunOptions): Promise<RunResult> {
  const started = performance.now();
  note("nạp SQLite sang WebAssembly…");
  const SQL = await ensureSqlJs();
  const db = new SQL.Database();
  const cap = new Cap();
  let table: RunTable | null = null;
  let tổngDòng = 0;
  try {
    for (const stmt of splitSql(code)) {
      if (performance.now() - started > timeLimit * 1000) {
        cap.write(tail(`Hết thời gian sau ${timeLimit}s`), "err");
        break;
      }
      const res = db.exec(stmt);
      if (res.length) {
        const { columns, values } = res[0];
        cap.write(alignTable(columns, values));
        cap.write(`${values.length} dòng kết quả\n`);
        tổngDòng += values.length;
        if (!table) table = { columns, rows: values };
      } else {
        cap.write(`ok — ${db.getRowsModified()} dòng bị ảnh hưởng\n`);
      }
    }
    const schema = db.exec("select type, name from sqlite_master where type in ('table','index') order by type, name");
    if (schema.length) {
      cap.write("\nbảng có trong cơ sở dữ liệu tạm:\n");
      cap.write(alignTable(schema[0].columns, schema[0].values));
    }
    return {
      out: cap.out,
      err: cap.err,
      exit: 0,
      ms: performance.now() - started,
      table: table ?? undefined,
      noteText: `${tổngDòng} dòng trả về`,
    };
  } catch (e) {
    return {
      out: cap.out,
      err: cap.err + tail(String((e as Error)?.message ?? e)),
      exit: 1,
      ms: performance.now() - started,
      table: table ?? undefined,
    };
  } finally {
    db.close();
  }
}

/* ----------------------------------- Brainfuck ----------------------------------- */

const BF_OPS = "><+-.,[]";

function runBrainfuck(code: string, { stdin = "", timeLimit = 20 }: RunOptions): RunResult {
  const started = performance.now();
  const ops = [...code].filter((c) => BF_OPS.includes(c));
  const tape = new Uint8Array(30000);
  const jump = new Int32Array(ops.length);
  const open: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === "[") open.push(i);
    else if (ops[i] === "]") {
      if (!open.length)
        return { out: "", err: tail(`Dấu ] thứ ${i} không có [ mở tương ứng`), exit: 1, ms: performance.now() - started };
      const o = open.pop()!;
      jump[o] = i;
      jump[i] = o;
    }
  }
  if (open.length)
    return { out: "", err: tail(`Còn ${open.length} dấu [ chưa đóng`), exit: 1, ms: performance.now() - started };

  let p = 0;
  let ip = 0;
  let out = "";
  let steps = 0;
  let stdinPos = 0;
  let exit = 0;
  let err = "";
  const deadline = performance.now() + timeLimit * 1000;
  while (ip < ops.length) {
    if (++steps % 100000 === 0 && performance.now() > deadline)
      return {
        out,
        err: tail(`Hết thời gian sau ${timeLimit}s — đã chạy ${steps.toLocaleString("vi")} lệnh`),
        exit: 124,
        ms: performance.now() - started,
      };
    switch (ops[ip]) {
      case ">": p++; break;
      case "<": p--; break;
      case "+": tape[p] = (tape[p] + 1) & 255; break;
      case "-": tape[p] = (tape[p] - 1) & 255; break;
      case ".": out += String.fromCharCode(tape[p]); break;
      case ",": tape[p] = stdinPos < stdin.length ? stdin.charCodeAt(stdinPos++) & 255 : 0; break;
      case "[": if (tape[p] === 0) ip = jump[ip]; break;
      case "]": if (tape[p] !== 0) ip = jump[ip]; break;
    }
    if (p < 0 || p >= tape.length) {
      err += tail(`Con trỏ băng vượt phạm vi tại lệnh thứ ${ip} (ô ${p})`);
      exit = 1;
      break;
    }
    ip++;
  }
  return {
    out,
    err,
    exit,
    ms: performance.now() - started,
    noteText: `${steps.toLocaleString("vi")} lệnh · ${out.length} ký tự ra · ô dùng đến ${p}`,
  };
}

/* ------------------------------ Xem trước & cấu hình ------------------------------ */

const PREVIEW_PAGE = (inner: string, head = "") =>
  `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}` +
  `<style>body{font:15px/1.6 system-ui,sans-serif;margin:0;padding:1rem;color:#12202f;background:#fff}</style></head><body>${inner}</body></html>`;

function runMarkup(code: string): RunResult {
  return { out: "", err: "", exit: 0, ms: 0, preview: code, noteText: "trang hiển thị ở khung Xem trước" };
}

function runCssPreview(code: string, companion?: string): RunResult {
  return {
    out: "",
    err: "",
    exit: 0,
    ms: 0,
    preview: PREVIEW_PAGE(companion || "", `<style>${code}</style>`),
    noteText: "CSS áp lên trang nháp",
  };
}

function runSvgPreview(code: string): RunResult {
  const doc = new DOMParser().parseFromString(code, "image/svg+xml");
  const bad = doc.querySelector("parsererror");
  if (bad) return { out: "", err: tail(bad.textContent?.replace(/\s+/g, " ").slice(0, 600) ?? ""), exit: 1, ms: 0 };
  if (!doc.documentElement || doc.documentElement.nodeName.toLowerCase() !== "svg")
    return { out: "", err: tail("Nội dung gốc không phải phần tử <svg>."), exit: 1, ms: 0 };
  const n = doc.querySelectorAll("*").length;
  return { out: "", err: "", exit: 0, ms: 0, preview: PREVIEW_PAGE(code), noteText: `${n} nút trong cây SVG` };
}

async function runMarkdown(code: string, note: (m: string) => void = () => {}): Promise<RunResult> {
  note("nạp marked — chuyển Markdown thành HTML…");
  const mod = await external(`${CDN}/marked@12.0.2/+esm`);
  const parse =
    (mod as { parse?: (s: string) => string }).parse ??
    (mod as { default?: { parse?: (s: string) => string } }).default?.parse;
  if (!parse) throw new Error("marked không cung cấp hàm parse");
  const htmlOut = parse(code);
  return {
    out: tail(`đã render ${code.split("\n").length} dòng Markdown thành ${htmlOut.length} ký tự HTML`),
    err: "",
    exit: 0,
    ms: 0,
    preview: PREVIEW_PAGE(htmlOut),
  };
}

function flatten(value: unknown, path: string, rows: unknown[][]): unknown[][] {
  if (Array.isArray(value)) {
    if (!value.length) rows.push([path || "(gốc)", "[]", "array rỗng"]);
    value.forEach((v, i) => flatten(v, `${path}[${i}]`, rows));
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) rows.push([path, "{}", "object rỗng"]);
    keys.forEach((k) => flatten((value as Record<string, unknown>)[k], path ? `${path}.${k}` : k, rows));
  } else {
    rows.push([
      path || "(gốc)",
      typeof value === "string" ? JSON.stringify(value) : String(value),
      value === null ? "null" : typeof value,
    ]);
  }
  return rows;
}

function locateJsonError(code: string, message: string) {
  const m = /position (\d+)/.exec(message);
  if (!m) return "";
  const pos = Number(m[1]);
  const before = code.slice(0, pos);
  const line = before.split("\n").length;
  const col = pos - before.lastIndexOf("\n");
  const src = code.split("\n")[line - 1] || "";
  return `\n→ dòng ${line}, cột ${col}\n${src}\n${" ".repeat(Math.max(0, col - 1))}^\n`;
}

function runJsonTool(code: string): RunResult {
  const started = performance.now();
  try {
    const data = JSON.parse(code) as unknown;
    const rows = flatten(data, "", []);
    return {
      out: JSON.stringify(data, null, 2) + "\n",
      err: "",
      exit: 0,
      ms: performance.now() - started,
      table: { columns: ["đường dẫn", "giá trị", "kiểu"], rows },
      noteText: `JSON hợp lệ · ${rows.length} lá`,
    };
  } catch (e) {
    const message = String((e as Error).message);
    return { out: "", err: tail(message + locateJsonError(code, message)), exit: 1, ms: performance.now() - started };
  }
}

let yamlPromise: Promise<unknown> | null = null;

async function runYamlTool(code: string): Promise<RunResult> {
  const started = performance.now();
  if (!yamlPromise)
    yamlPromise = external(`${CDN}/js-yaml@4.1.0/+esm`).catch((e) => {
      yamlPromise = null;
      throw e;
    });
  const mod = (await yamlPromise) as { load?: (s: string) => unknown; default?: { load?: (s: string) => unknown } };
  const load = mod.load ?? mod.default?.load;
  if (!load) throw new Error("js-yaml không cung cấp hàm load");
  try {
    const data = load(code);
    const rows = flatten(data === undefined ? {} : data, "", []);
    return {
      out: JSON.stringify(data, null, 2) + "\n",
      err: "",
      exit: 0,
      ms: performance.now() - started,
      table: { columns: ["đường dẫn", "giá trị", "kiểu"], rows },
      noteText: `YAML hợp lệ · ${rows.length} lá`,
    };
  } catch (e) {
    return { out: "", err: tail(String((e as Error)?.message ?? e)), exit: 1, ms: performance.now() - started };
  }
}

/* ------------------------------------ Wandbox ------------------------------------ */

const queue = { busy: 0, limit: 3, waiters: [] as (() => void)[] };

function takeSlot() {
  if (queue.busy < queue.limit) {
    queue.busy++;
    return Promise.resolve();
  }
  return new Promise<void>((r) => queue.waiters.push(r)).then(() => {
    queue.busy++;
  });
}
function freeSlot() {
  queue.busy--;
  const w = queue.waiters.shift();
  if (w) w();
}

async function runWandbox(impl: EngineRef, code: string, { stdin = "", args = "", flags = "", timeLimit = 20, note = () => {} }: RunOptions): Promise<RunResult> {
  const started = performance.now();
  await takeSlot();
  note(`gửi mã tới Wandbox · ${impl.compiler} · hàng đợi ${queue.busy}/${queue.limit}`);
  try {
    const body: Record<string, string> = { compiler: impl.compiler ?? "", code, stdin };
    const cờ = [impl.flags, flags?.trim()].filter(Boolean).join(" ").trim();
    if (cờ) body["compiler-option-raw"] = cờ;
    if (args.trim()) body["runtime-option-raw"] = args.trim();
    const res = await fetch(WANDBOX_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout((timeLimit + 60) * 1000),
    });
    const text = await res.text();
    let data: {
      status?: string | number;
      signal?: string;
      url?: string;
      message?: string;
      program_output?: string;
      program_error?: string;
      compiler_error?: string;
      compiler_output?: string;
    };
    try {
      data = JSON.parse(text);
    } catch {
      return {
        out: "",
        err: tail(`HTTP ${res.status} — phản hồi không phải JSON:\n${text.slice(0, 400)}`),
        exit: 1,
        ms: performance.now() - started,
      };
    }
    if (data.message && !("status" in data)) return { out: "", err: tail(data.message), exit: 1, ms: performance.now() - started };
    if (!res.ok && !("status" in data))
      return { out: "", err: tail(`HTTP ${res.status}: ${text.slice(0, 300)}`), exit: 1, ms: performance.now() - started };

    const cap = new Cap();
    cap.write(data.program_output || "");
    const lỗi = [data.compiler_error, data.compiler_output, data.program_error].filter(Boolean);
    if (lỗi.length) cap.write(lỗi.join("\n---\n") + "\n", "err");
    let noteText = `mã thoát ${data.status || "0"}`;
    if (data.signal) noteText += ` · tín hiệu ${data.signal}`;
    if (data.url) noteText += ` · lưu tại ${data.url}`;
    return { out: cap.out, err: cap.err, exit: Number(data.status || 0), ms: performance.now() - started, noteText };
  } catch (e) {
    const err = e as Error;
    const msg =
      err.name === "TimeoutError"
        ? `Chờ quá ${timeLimit + 60}s — Wandbox đang bận hoặc mất kết nối.`
        : `Không gọi được Wandbox (${err.name}: ${err.message}).`;
    return {
      out: "",
      err: tail(`${msg}\nThử lại, hoặc chọn engine “trong máy” nếu ngôn ngữ này có.`),
      exit: 125,
      ms: performance.now() - started,
    };
  } finally {
    freeSlot();
  }
}

/* ---------------------------------- Bộ định tuyến ---------------------------------- */

export async function execute(impl: EngineRef, code: string, opts: RunOptions = {}): Promise<RunResult> {
  const t0 = performance.now();
  const src = code.replace(/\r\n?/g, "\n");
  const note = opts.note ?? (() => {});
  let r: RunResult;
  switch (impl.engine) {
    case "browser-js":
      r = await runBrowserJs(src, opts);
      break;
    case "pyodide":
      r = await runPyodide(src, opts);
      break;
    case "fengari":
      r = await runFengari(src, opts);
      break;
    case "sqljs":
      r = await runSqlJs(src, opts);
      break;
    case "brainfuck":
      r = runBrainfuck(src, opts);
      break;
    case "markup":
      r = runMarkup(src);
      break;
    case "css-preview":
      r = runCssPreview(src, opts.companion);
      break;
    case "svg-preview":
      r = runSvgPreview(src);
      break;
    case "markdown-render":
      r = await runMarkdown(src, note);
      break;
    case "json-tool":
      r = runJsonTool(src);
      break;
    case "yaml-tool":
      r = await runYamlTool(src);
      break;
    case "wandbox":
      r = await runWandbox(impl, src, opts);
      break;
    default:
      throw new Error(`Engine lạ: ${impl.engine}`);
  }
  return { ...r, engineLabel: impl.label, ms: r.ms ?? performance.now() - t0 };
}
