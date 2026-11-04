/* Bộ phân tích từ vựng cho tập con C++ của Arduino.
   Không cần avr-gcc: sketch được thông dịch trực tiếp trong trình duyệt. */

export class SketchError extends Error {
  line: number;

  constructor(message: string, line = 1) {
    super(message);
    this.name = "SketchError";
    this.line = line;
  }
}

export type TokenKind = "num" | "str" | "char" | "ident" | "punct" | "eof";

export interface Token {
  kind: TokenKind;
  value: string;
  num?: number;
  float?: boolean;
  line: number;
}

const PUNCTUATORS = [
  ">>=",
  "<<=",
  "...",
  "->",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "<<",
  ">>",
  "+",
  "-",
  "*",
  "/",
  "%",
  "&",
  "|",
  "^",
  "~",
  "!",
  "?",
  ":",
  ";",
  ",",
  ".",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  "=",
];

/* Hằng số / chân quen thuộc của Arduino Uno. */
const DEFAULT_DEFINES: Record<string, string> = {
  HIGH: "1",
  LOW: "0",
  INPUT: "0",
  OUTPUT: "1",
  INPUT_PULLUP: "2",
  LED_BUILTIN: "13",
  A0: "14",
  A1: "15",
  A2: "16",
  A3: "17",
  A4: "18",
  A5: "19",
  DEC: "10",
  HEX: "16",
  OCT: "8",
  BIN: "2",
  PI: "3.141592653589793",
  HALF_PI: "1.5707963267948966",
  TWO_PI: "6.283185307179586",
  true: "1",
  false: "0",
};

function substitute(code: string, defines: Map<string, string>, stack: string[]): string {
  let out = "";
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < code.length) {
        const current = code[i];
        out += current;
        if (current === "\\" && i + 1 < code.length) {
          out += code[i + 1];
          i += 2;
          continue;
        }
        i += 1;
        if (current === quote) break;
      }
      continue;
    }

    if (ch === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      out += code.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      out += code.slice(i, stop);
      i = stop;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) j += 1;
      const word = code.slice(i, j);
      const replacement = defines.get(word);
      if (replacement !== undefined && !stack.includes(word)) {
        out += `(${substitute(replacement, defines, [...stack, word])})`;
      } else {
        out += word;
      }
      i = j;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/* Bỏ các dòng tiền xử lý (#include, #define…), ghi nhận macro đơn giản và
   thay thế chúng. Số dòng được giữ nguyên để báo lỗi đúng vị trí. */
export function preprocess(source: string): string {
  const defines = new Map<string, string>(Object.entries(DEFAULT_DEFINES));
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const macro = /^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.*)$/.exec(line);
    if (macro) {
      const value = macro[2].replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").trim();
      defines.set(macro[1], value || "1");
      kept.push("");
      continue;
    }
    if (/^\s*#/.test(line)) {
      kept.push("");
      continue;
    }
    kept.push(line);
  }

  return substitute(kept.join("\n"), defines, []);
}

function readEscaped(code: string, start: number): { text: string; next: number; closed: boolean } {
  let text = "";
  let i = start;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "\\") {
      const next = code[i + 1] ?? "";
      const table: Record<string, string> = {
        n: "\n",
        t: "\t",
        r: "\r",
        "0": "\0",
        "\\": "\\",
        '"': '"',
        "'": "'",
      };
      if (next === "x") {
        const hex = /^[0-9a-fA-F]{1,2}/.exec(code.slice(i + 2));
        if (hex) {
          text += String.fromCharCode(parseInt(hex[0], 16));
          i += 2 + hex[0].length;
          continue;
        }
      }
      text += table[next] ?? next;
      i += 2;
      continue;
    }
    if (ch === "\n") return { text, next: i, closed: false };
    if (ch === '"' || ch === "'") return { text, next: i, closed: true };
    text += ch;
    i += 1;
  }
  return { text, next: i, closed: false };
}

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  while (i < code.length) {
    const ch = code[i];

    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        if (code[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
      const match = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(
        code.slice(i)
      );
      if (!match) throw new SketchError("Số không hợp lệ.", line);
      let raw = match[1];
      i += raw.length;
      while (/[uUlLfF]/.test(code[i] ?? "")) i += 1;
      const isFloat = /[.eE]/.test(raw);
      let value: number;
      if (/^0[xX]/.test(raw)) value = parseInt(raw.slice(2), 16);
      else if (/^0[bB]/.test(raw)) value = parseInt(raw.slice(2), 2);
      else value = parseFloat(raw);
      raw = String(value);
      tokens.push({ kind: "num", value: raw, num: value, float: isFloat, line });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < code.length && /[A-Za-z0-9_]/.test(code[j])) j += 1;
      tokens.push({ kind: "ident", value: code.slice(i, j), line });
      i = j;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const startedLine = line;
      const result = readEscaped(code, i + 1);
      if (!result.closed) {
        throw new SketchError(
          ch === '"' ? "Chuỗi chưa được đóng bằng dấu \u201c.\u201d" : "Ký tự chưa được đóng bằng dấu nháy.",
          startedLine
        );
      }
      if (ch === '"') {
        tokens.push({ kind: "str", value: result.text, line: startedLine });
      } else {
        if (result.text.length === 0) {
          throw new SketchError("Ký tự rỗng không hợp lệ.", startedLine);
        }
        tokens.push({ kind: "char", value: result.text, line: startedLine });
      }
      i = result.next + 1;
      continue;
    }

    const punct = PUNCTUATORS.find((candidate) => code.startsWith(candidate, i));
    if (punct) {
      tokens.push({ kind: "punct", value: punct, line });
      i += punct.length;
      continue;
    }

    throw new SketchError(`Ký tự không hợp lệ “${ch}”.`, line);
  }

  tokens.push({ kind: "eof", value: "", line });
  return tokens;
}

export function highlight(source: string): string {
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const pattern =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?)\b|\b(if|else|for|while|do|switch|case|default|break|continue|return|void|int|long|short|byte|char|float|double|bool|boolean|unsigned|signed|const|static|volatile|String|Servo|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|true|false)\b|([A-Za-z_]\w*)(?=\s*\()/g;

  let html = "";
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    html += escape(source.slice(last, index));
    const [text, comment, string, number, keyword, call] = match;
    if (comment) html += `<span class="tok-com">${escape(text)}</span>`;
    else if (string) html += `<span class="tok-str">${escape(text)}</span>`;
    else if (number) html += `<span class="tok-num">${escape(text)}</span>`;
    else if (keyword) html += `<span class="tok-key">${escape(text)}</span>`;
    else if (call) html += `<span class="tok-fn">${escape(text)}</span>`;
    else html += escape(text);
    last = index + text.length;
  }
  html += escape(source.slice(last));
  return html;
}
