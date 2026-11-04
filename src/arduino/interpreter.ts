/* Trình thông dịch sketch Arduino: chạy generator để có thể tạm dừng ở delay()
   rồi tiếp tục, nhờ đó đèn/Serial/servo cập nhật theo thời gian thực. */

import { Board, analogChannel, PIN_COUNT } from "./board";
import type { Clock } from "./clock";
import { SketchError } from "./lexer";
import type { Expr, FuncDecl, Program, Stmt } from "./parser";

interface ServoValue {
  __kind: "servo";
  pin: number | null;
  angle: number;
}

interface SerialValue {
  __kind: "serial";
}

export type Value = number | string | boolean | null | Value[] | ServoValue | SerialValue;

interface Binding {
  value: Value;
  type: string;
  isConst: boolean;
}

interface Scope {
  vars: Map<string, Binding>;
  parent: Scope | null;
}

export type Step = { delayMs: number } | null;
type Ctrl = { kind: "break" } | { kind: "continue" } | { kind: "return"; value: Value } | null;
type Exec = Generator<Step, Ctrl, void>;
type EvalGen = Generator<Step, Value, void>;

const MAX_DEPTH = 160;

function isIntegralType(type: string): boolean {
  return type === "int" || type === "char" || type === "bool";
}

/* Hàm dựng sẵn trả về số nguyên (long/int). Dùng để quyết định phép chia
   có bị cắt phần thập phân như C++ hay không. */
const INTEGRAL_CALLS = new Set([
  "pinMode",
  "digitalRead",
  "digitalWrite",
  "analogRead",
  "analogWrite",
  "delay",
  "delayMicroseconds",
  "millis",
  "micros",
  "yield",
  "map",
  "constrain",
  "min",
  "max",
  "abs",
  "round",
  "random",
  "randomSeed",
  "tone",
  "noTone",
  "sizeof",
  "pulseIn",
]);

const INTEGRAL_METHODS = new Set([
  "read",
  "available",
  "length",
  "toInt",
  "indexOf",
  "charAt",
  "equals",
  "startsWith",
  "endsWith",
]);

function isServo(value: Value): value is ServoValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as ServoValue).__kind === "servo";
}

function isSerial(value: Value): value is SerialValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as SerialValue).__kind === "serial";
}

function toNumber(value: Value): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toInt32(value: Value): number {
  return Math.trunc(toNumber(value)) | 0;
}

function truthy(value: Value): boolean {
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "boolean") return value;
  return value !== null;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return "nan";
    return value > 0 ? "inf" : "-inf";
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function toText(value: Value): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value === null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .join("")
      .replace(/\0+$/, "");
  }
  return isServo(value) ? "[Servo]" : "";
}

function coerce(value: Value, type: string): Value {
  if (Array.isArray(value) || isServo(value) || isSerial(value)) return value;
  switch (type) {
    case "any":
      return value;
    case "String":
      return toText(value);
    case "char":
      return typeof value === "number"
        ? String.fromCharCode(Math.trunc(value) & 0xffff)
        : toText(value).slice(0, 1);
    case "bool":
      return truthy(value) ? 1 : 0;
    case "float":
      return toNumber(value);
    default:
      return Math.trunc(toNumber(value));
  }
}

function equalValues(left: Value, right: Value): boolean {
  if (typeof left === "string" && typeof right === "string") return left === right;
  if (Array.isArray(left) || Array.isArray(right)) return left === right;
  return toNumber(left) === toNumber(right);
}

function applyBinary(op: string, left: Value, right: Value, integerDivision = true): Value {
  switch (op) {
    case "+":
      if (typeof left === "string" || typeof right === "string") return toText(left) + toText(right);
      return toNumber(left) + toNumber(right);
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/": {
      const a = toNumber(left);
      const b = toNumber(right);
      if (b === 0) {
        if (a === 0) return NaN;
        return a > 0 ? Infinity : -Infinity;
      }
      const result = a / b;
      return integerDivision && Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(result) : result;
    }
    case "%": {
      const b = Math.trunc(toNumber(right));
      return b === 0 ? 0 : Math.trunc(toNumber(left)) % b;
    }
    case "==":
      return equalValues(left, right) ? 1 : 0;
    case "!=":
      return equalValues(left, right) ? 0 : 1;
    case "<":
      return toNumber(left) < toNumber(right) ? 1 : 0;
    case ">":
      return toNumber(left) > toNumber(right) ? 1 : 0;
    case "<=":
      return toNumber(left) <= toNumber(right) ? 1 : 0;
    case ">=":
      return toNumber(left) >= toNumber(right) ? 1 : 0;
    case "&":
      return toInt32(left) & toInt32(right);
    case "|":
      return toInt32(left) | toInt32(right);
    case "^":
      return toInt32(left) ^ toInt32(right);
    case "<<":
      return toInt32(left) << toInt32(right);
    case ">>":
      return toInt32(left) >> toInt32(right);
    case "&&":
      return truthy(left) && truthy(right) ? 1 : 0;
    case "||":
      return truthy(left) || truthy(right) ? 1 : 0;
    default:
      throw new SketchError(`Toán tử “${op}” chưa được hỗ trợ.`);
  }
}

export class Interpreter {
  private readonly program: Program;
  private readonly board: Board;
  private readonly clock: Clock;
  private readonly root: Scope;
  private scope: Scope;
  private steps = 0;
  private depth = 0;
  private randomState = (Date.now() % 2147483647) || 123456789;

  constructor(program: Program, board: Board, clock: Clock) {
    this.program = program;
    this.board = board;
    this.clock = clock;
    this.root = { vars: new Map(), parent: null };
    this.scope = this.root;
  }

  /* Toàn bộ chương trình: biến toàn cục → setup() → loop() lặp mãi. */
  *run(): Generator<Step, void, void> {
    for (const stmt of this.program.globals) {
      const ctrl = yield* this.execStmt(stmt);
      if (ctrl?.kind === "return") return;
    }

    const setup = this.program.funcs.get("setup");
    const loop = this.program.funcs.get("loop");

    if (setup) yield* this.callFunction(setup, []);
    if (!loop) throw new SketchError("Sketch cần có hàm loop().", 1);

    while (true) {
      yield* this.callFunction(loop, []);
      yield* this.tick();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Câu lệnh                                                            */
  /* ------------------------------------------------------------------ */

  private *tick(): Generator<Step, void, void> {
    this.steps += 1;
    if (this.steps >= 96) {
      this.steps = 0;
      yield null;
    }
  }

  private *execStmt(stmt: Stmt): Exec {
    yield* this.tick();

    switch (stmt.type) {
      case "empty":
        return null;

      case "block":
        return yield* this.execBlock(stmt.body);

      case "vardecl":
        return yield* this.execDecl(stmt);

      case "expr":
        yield* this.evalExpr(stmt.expr);
        return null;

      case "if": {
        const test = yield* this.evalExpr(stmt.test);
        if (truthy(test)) return yield* this.execStmt(stmt.cons);
        if (stmt.alt) return yield* this.execStmt(stmt.alt);
        return null;
      }

      case "for": {
        const parent = this.scope;
        this.scope = { vars: new Map(), parent };
        let result: Ctrl = null;
        try {
          if (stmt.init) {
            const initCtrl = yield* this.execStmt(stmt.init);
            if (initCtrl) return initCtrl;
          }
          while (true) {
            yield* this.tick();
            if (stmt.test) {
              const test = yield* this.evalExpr(stmt.test);
              if (!truthy(test)) break;
            }
            const bodyCtrl = yield* this.execStmt(stmt.body);
            if (bodyCtrl?.kind === "break") break;
            if (bodyCtrl?.kind === "return") {
              result = bodyCtrl;
              break;
            }
            if (stmt.update) yield* this.evalExpr(stmt.update);
            yield* this.tick();
          }
        } finally {
          this.scope = parent;
        }
        return result;
      }

      case "while": {
        while (true) {
          yield* this.tick();
          const test = yield* this.evalExpr(stmt.test);
          if (!truthy(test)) return null;
          const ctrl = yield* this.execStmt(stmt.body);
          if (ctrl?.kind === "break") return null;
          if (ctrl?.kind === "return") return ctrl;
        }
      }

      case "do": {
        while (true) {
          yield* this.tick();
          const ctrl = yield* this.execStmt(stmt.body);
          if (ctrl?.kind === "break") return null;
          if (ctrl?.kind === "return") return ctrl;
          const test = yield* this.evalExpr(stmt.test);
          if (!truthy(test)) return null;
        }
      }

      case "switch": {
        const disc = yield* this.evalExpr(stmt.disc);
        let start = -1;
        let fallback = -1;
        for (let i = 0; i < stmt.cases.length; i += 1) {
          const item = stmt.cases[i];
          if (item.test === null) {
            fallback = i;
            continue;
          }
          const value = yield* this.evalExpr(item.test);
          if (equalValues(disc, value)) {
            start = i;
            break;
          }
        }
        if (start === -1) start = fallback;
        if (start === -1) return null;

        const parent = this.scope;
        this.scope = { vars: new Map(), parent };
        try {
          for (let i = start; i < stmt.cases.length; i += 1) {
            for (const inner of stmt.cases[i].body) {
              const ctrl = yield* this.execStmt(inner);
              if (ctrl?.kind === "break") return null;
              if (ctrl) return ctrl;
            }
          }
        } finally {
          this.scope = parent;
        }
        return null;
      }

      case "break":
        return { kind: "break" };

      case "continue":
        return { kind: "continue" };

      case "return": {
        const value = stmt.value ? yield* this.evalExpr(stmt.value) : 0;
        return { kind: "return", value };
      }

      default:
        return null;
    }
  }

  private *execBlock(body: Stmt[]): Exec {
    const parent = this.scope;
    this.scope = { vars: new Map(), parent };
    let ctrl: Ctrl = null;
    try {
      for (const stmt of body) {
        ctrl = yield* this.execStmt(stmt);
        if (ctrl) break;
      }
    } finally {
      this.scope = parent;
    }
    return ctrl;
  }

  private *execDecl(stmt: Extract<Stmt, { type: "vardecl" }>): Exec {
    for (const item of stmt.items) {
      let value: Value = stmt.declType === "Servo" ? { __kind: "servo", pin: null, angle: 90 } : 0;

      if (item.init) value = yield* this.evalExpr(item.init);

      if (item.dims.length > 1) {
        throw new SketchError("Chỉ hỗ trợ mảng một chiều trong không gian Arduino.", item.line);
      }

      if (item.dims.length === 1) {
        const dim = item.dims[0];
        let size = -1;
        if (dim) size = Math.max(0, Math.trunc(toNumber(yield* this.evalExpr(dim))));

        let source: Value[] = [];
        if (item.init) {
          if (Array.isArray(value)) source = value.slice();
          else if (typeof value === "string") source = [...value];
          else if (value !== 0) source = [value];
        }
        if (size < 0) size = Math.max(source.length, 1);

        const empty = stmt.declType === "char" ? "\0" : 0;
        value = Array.from({ length: size }, (_, index) =>
          coerce(source[index] ?? empty, stmt.declType)
        );
      }

      this.declare(item.name, coerce(value, stmt.declType), stmt.declType, stmt.isConst, item.line);
    }
    return null;
  }

  private declare(name: string, value: Value, type: string, isConst: boolean, line: number): void {
    if (this.scope.vars.has(name)) {
      throw new SketchError(`Biến “${name}” đã được khai báo trong phạm vi này.`, line);
    }
    this.scope.vars.set(name, { value, type, isConst });
  }

  private lookup(name: string): Binding | null {
    let scope: Scope | null = this.scope;
    while (scope) {
      const binding = scope.vars.get(name);
      if (binding) return binding;
      scope = scope.parent;
    }
    return null;
  }

  private *callFunction(fn: FuncDecl, args: Value[]): EvalGen {
    if (this.depth >= MAX_DEPTH) {
      throw new SketchError(`Gọi hàm quá sâu khi chạy “${fn.name}” — kiểm tra đệ quy.`, fn.line);
    }
    this.depth += 1;

    const parent = this.scope;
    const scope: Scope = { vars: new Map(), parent: this.root };
    fn.params.forEach((param, index) => {
      scope.vars.set(param.name, { value: args[index] ?? 0, type: param.type, isConst: false });
    });
    this.scope = scope;

    try {
      const ctrl = yield* this.execStmt(fn.body);
      return ctrl?.kind === "return" ? ctrl.value : 0;
    } finally {
      this.scope = parent;
      this.depth -= 1;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Biểu thức                                                           */
  /* ------------------------------------------------------------------ */

  private *evalExpr(expr: Expr): EvalGen {
    switch (expr.type) {
      case "num":
        return expr.value;

      case "str":
        return expr.value;

      case "ident": {
        if (expr.name === "Serial") return { __kind: "serial" };
        const binding = this.lookup(expr.name);
        if (!binding) {
          throw new SketchError(`Biến “${expr.name}” chưa được khai báo.`, expr.line);
        }
        return binding.value;
      }

      case "unary": {
        if (expr.op === "++" || expr.op === "--") {
          const previous = yield* this.evalExpr(expr.arg);
          const next = toNumber(previous) + (expr.op === "++" ? 1 : -1);
          const assigned = yield* this.assignTo(expr.arg, next, "=", expr.line);
          return expr.prefix ? assigned : previous;
        }
        const value = yield* this.evalExpr(expr.arg);
        switch (expr.op) {
          case "!":
            return truthy(value) ? 0 : 1;
          case "-":
            return -toNumber(value);
          case "+":
            return toNumber(value);
          case "~":
            return ~toInt32(value);
          default:
            throw new SketchError(`Toán tử “${expr.op}” chưa được hỗ trợ.`, expr.line);
        }
      }

      case "binary": {
        if (expr.op === "&&") {
          const left = yield* this.evalExpr(expr.left);
          if (!truthy(left)) return 0;
          return truthy(yield* this.evalExpr(expr.right)) ? 1 : 0;
        }
        if (expr.op === "||") {
          const left = yield* this.evalExpr(expr.left);
          if (truthy(left)) return 1;
          return truthy(yield* this.evalExpr(expr.right)) ? 1 : 0;
        }
        const left = yield* this.evalExpr(expr.left);
        const right = yield* this.evalExpr(expr.right);
        if (expr.op === "/") {
          return applyBinary(
            expr.op,
            left,
            right,
            this.isIntegral(expr.left) && this.isIntegral(expr.right)
          );
        }
        return applyBinary(expr.op, left, right);
      }

      case "assign": {
        const value = yield* this.evalExpr(expr.value);
        return yield* this.assignTo(expr.target, value, expr.op, expr.line);
      }

      case "ternary": {
        const test = yield* this.evalExpr(expr.test);
        return truthy(test) ? yield* this.evalExpr(expr.cons) : yield* this.evalExpr(expr.alt);
      }

      case "cast":
        return coerce(yield* this.evalExpr(expr.arg), expr.target);

      case "arraylit": {
        const items: Value[] = [];
        for (const item of expr.items) items.push(yield* this.evalExpr(item));
        return items;
      }

      case "index": {
        const object = yield* this.evalExpr(expr.object);
        const index = Math.trunc(toNumber(yield* this.evalExpr(expr.index)));
        if (Array.isArray(object)) return object[index] ?? 0;
        if (typeof object === "string") return object.charAt(index) || "\0";
        throw new SketchError("Chỉ có thể lấy chỉ số của mảng hoặc chuỗi.", expr.line);
      }

      case "member": {
        const object = yield* this.evalExpr(expr.object);
        if (isSerial(object) || isServo(object)) {
          throw new SketchError(`Thuộc tính “${expr.name}” không dùng trực tiếp được.`, expr.line);
        }
        throw new SketchError("Chưa hỗ trợ truy cập thuộc tính này.", expr.line);
      }

      case "call": {
        if (expr.callee.type === "ident") {
          return yield* this.callNamed(expr.callee.name, expr.args, expr.line);
        }
        if (expr.callee.type === "member") {
          const object = yield* this.evalExpr(expr.callee.object);
          return yield* this.callMember(object, expr.callee.name, expr.args, expr.line);
        }
        throw new SketchError("Biểu thức này không phải là hàm.", expr.line);
      }

      default:
        throw new SketchError("Biểu thức chưa được hỗ trợ.", 1);
    }
  }

  private *assignTo(target: Expr, value: Value, op: string, line: number): EvalGen {
    if (target.type === "ident") {
      const binding = this.lookup(target.name);
      if (!binding) throw new SketchError(`Biến “${target.name}” chưa được khai báo.`, target.line);
      if (binding.isConst) throw new SketchError(`Không thể gán cho hằng “${target.name}”.`, target.line);
      const next = op === "=" ? value : applyBinary(op.slice(0, -1), binding.value, value, this.isIntegral(target));
      binding.value = coerce(next, binding.type);
      return binding.value;
    }

    if (target.type === "index") {
      const object = yield* this.evalExpr(target.object);
      const index = Math.trunc(toNumber(yield* this.evalExpr(target.index)));
      if (!Array.isArray(object)) {
        throw new SketchError("Chỉ có thể gán theo chỉ số cho mảng.", target.line);
      }
      if (index < 0 || index >= object.length) {
        throw new SketchError(`Chỉ số ${index} nằm ngoài mảng (0–${object.length - 1}).`, target.line);
      }
      const next = op === "=" ? value : applyBinary(op.slice(0, -1), object[index], value, this.isIntegral(target));
      object[index] = next;
      return next;
    }

    throw new SketchError("Không thể gán cho biểu thức này.", line);
  }

  /* ------------------------------------------------------------------ */
  /* Hàm dựng sẵn                                                        */
  /* ------------------------------------------------------------------ */

  /* Suy luận tĩnh: biểu thức có phải số nguyên? Chỉ dùng cho phép chia —
     C++ cắt phần thập phân khi cả hai toán hạng đều là số nguyên. */
  private isIntegral(expr: Expr): boolean {
    switch (expr.type) {
      case "num":
        return !expr.isFloat;
      case "str":
        return false;
      case "ident": {
        const binding = this.lookup(expr.name);
        return binding ? isIntegralType(binding.type) : false;
      }
      case "unary":
        return this.isIntegral(expr.arg);
      case "binary":
        if (
          ["==", "!=", "<", ">", "<=", ">=", "&&", "||", "&", "|", "^", "<<", ">>"].includes(expr.op)
        ) {
          return true;
        }
        return this.isIntegral(expr.left) && this.isIntegral(expr.right);
      case "assign":
        return this.isIntegral(expr.target);
      case "ternary":
        return this.isIntegral(expr.cons) && this.isIntegral(expr.alt);
      case "cast":
        return isIntegralType(expr.target);
      case "index": {
        if (expr.object.type === "ident") {
          const binding = this.lookup(expr.object.name);
          return binding ? isIntegralType(binding.type) : false;
        }
        return false;
      }
      case "call": {
        if (expr.callee.type === "ident") {
          const fn = this.program.funcs.get(expr.callee.name);
          if (fn) return isIntegralType(fn.returns);
          return INTEGRAL_CALLS.has(expr.callee.name);
        }
        if (expr.callee.type === "member") return INTEGRAL_METHODS.has(expr.callee.name);
        return false;
      }
      default:
        return false;
    }
  }

  private *arg(args: Expr[], index: number, fallback: Value): EvalGen {
    if (!args[index]) return fallback;
    return yield* this.evalExpr(args[index]);
  }

  private pinOf(value: Value, line: number, fnName: string): number {
    const pin = Math.trunc(toNumber(value));
    if (pin < 0 || pin >= PIN_COUNT) {
      throw new SketchError(`${fnName}(): chân ${pin} không tồn tại trên Arduino Uno (0–19).`, line);
    }
    return pin;
  }

  private *wait(ms: number): Generator<Step, void, void> {
    const target = this.clock.now() + Math.max(0, ms);
    let guard = 0;
    while (this.clock.now() < target) {
      yield { delayMs: Math.max(1, target - this.clock.now()) };
      guard += 1;
      if (guard > 10000) break;
    }
  }

  private nextRandom(): number {
    this.randomState = (this.randomState * 1103515245 + 12345) & 0x7fffffff;
    return this.randomState / 0x7fffffff;
  }

  private *callNamed(name: string, args: Expr[], line: number): EvalGen {
    const userFunction = this.program.funcs.get(name);
    if (userFunction) {
      const values: Value[] = [];
      for (const arg of args) values.push(yield* this.evalExpr(arg));
      return yield* this.callFunction(userFunction, values);
    }

    switch (name) {
      case "pinMode": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "pinMode");
        const mode = Math.trunc(toNumber(yield* this.arg(args, 1, 0)));
        this.board.pinMode(pin, mode);
        return 0;
      }

      case "digitalWrite": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "digitalWrite");
        const value = toNumber(yield* this.arg(args, 1, 0));
        this.board.digitalWrite(pin, value);
        return 0;
      }

      case "digitalRead": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "digitalRead");
        return this.board.digitalRead(pin);
      }

      case "analogRead": {
        const raw = Math.trunc(toNumber(yield* this.arg(args, 0, 0)));
        if (analogChannel(raw) < 0) {
          throw new SketchError(`analogRead(): ${raw} không phải chân tương tự (A0–A5).`, line);
        }
        return this.board.analogRead(raw);
      }

      case "analogWrite": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "analogWrite");
        const value = toNumber(yield* this.arg(args, 1, 0));
        this.board.analogWrite(pin, value);
        return 0;
      }

      case "delay": {
        const ms = toNumber(yield* this.arg(args, 0, 0));
        yield* this.wait(ms);
        return 0;
      }

      case "delayMicroseconds": {
        const us = toNumber(yield* this.arg(args, 0, 0));
        if (us >= 1000) yield* this.wait(us / 1000);
        return 0;
      }

      case "millis":
        return Math.floor(this.clock.now());

      case "micros":
        return Math.floor(this.clock.now() * 1000);

      case "yield":
        yield null;
        return 0;

      case "map": {
        const value = toNumber(yield* this.arg(args, 0, 0));
        const inMin = toNumber(yield* this.arg(args, 1, 0));
        const inMax = toNumber(yield* this.arg(args, 2, 1));
        const outMin = toNumber(yield* this.arg(args, 3, 0));
        const outMax = toNumber(yield* this.arg(args, 4, 1));
        if (inMax === inMin) return outMin;
        return Math.trunc(((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin);
      }

      case "constrain": {
        const value = toNumber(yield* this.arg(args, 0, 0));
        const low = toNumber(yield* this.arg(args, 1, 0));
        const high = toNumber(yield* this.arg(args, 2, 255));
        return Math.min(high, Math.max(low, value));
      }

      case "min": {
        const a = toNumber(yield* this.arg(args, 0, 0));
        const b = toNumber(yield* this.arg(args, 1, 0));
        return Math.min(a, b);
      }

      case "max": {
        const a = toNumber(yield* this.arg(args, 0, 0));
        const b = toNumber(yield* this.arg(args, 1, 0));
        return Math.max(a, b);
      }

      case "abs": {
        return Math.abs(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "round": {
        return Math.round(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "floor": {
        return Math.floor(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "ceil": {
        return Math.ceil(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "sqrt": {
        return Math.sqrt(Math.max(0, toNumber(yield* this.arg(args, 0, 0))));
      }

      case "sq": {
        const value = toNumber(yield* this.arg(args, 0, 0));
        return value * value;
      }

      case "pow": {
        const base = toNumber(yield* this.arg(args, 0, 0));
        const exponent = toNumber(yield* this.arg(args, 1, 0));
        return Math.pow(base, exponent);
      }

      case "sin": {
        return Math.sin(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "cos": {
        return Math.cos(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "tan": {
        return Math.tan(toNumber(yield* this.arg(args, 0, 0)));
      }

      case "random": {
        const first = toNumber(yield* this.arg(args, 0, 1));
        const second = args[1] ? toNumber(yield* this.arg(args, 1, 0)) : null;
        const low = second === null ? 0 : Math.min(first, second);
        const high = second === null ? first : Math.max(first, second);
        return Math.floor(low + this.nextRandom() * (high - low));
      }

      case "randomSeed": {
        const seed = Math.trunc(toNumber(yield* this.arg(args, 0, 1)));
        this.randomState = (seed || 1) & 0x7fffffff;
        return 0;
      }

      case "tone": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "tone");
        const freq = toNumber(yield* this.arg(args, 1, 440));
        const duration = args[2] ? toNumber(yield* this.evalExpr(args[2])) : undefined;
        this.board.tone(pin, freq, duration);
        return 0;
      }

      case "noTone": {
        const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "noTone");
        this.board.noTone(pin);
        return 0;
      }

      case "String":
        return toText(yield* this.arg(args, 0, ""));

      case "sizeof": {
        const value = yield* this.arg(args, 0, 0);
        if (Array.isArray(value)) return value.length;
        return 1;
      }

      case "pulseIn":
        throw new SketchError("pulseIn() cần phần cứng thật nên chưa được mô phỏng.", line);

      case "attachInterrupt":
      case "detachInterrupt":
        throw new SketchError("Ngắt ngoài (attachInterrupt) chưa được mô phỏng.", line);

      default:
        throw new SketchError(`Chưa hỗ trợ hàm “${name}()”.`, line);
    }
  }

  private *callMember(object: Value, method: string, args: Expr[], line: number): EvalGen {
    if (isSerial(object)) {
      switch (method) {
        case "begin": {
          const baud = toNumber(yield* this.arg(args, 0, 9600));
          this.board.serialBegin(baud);
          return 0;
        }
        case "print":
        case "println": {
          const value = yield* this.arg(args, 0, "");
          const format = args[1] ? toNumber(yield* this.evalExpr(args[1])) : 10;
          const text = this.formatValue(value, format);
          if (method === "print") this.board.serialPrint(text);
          else this.board.serialPrintln(text);
          return 0;
        }
        case "write": {
          const value = yield* this.arg(args, 0, 0);
          if (typeof value === "number") this.board.serialWrite(String.fromCharCode(Math.trunc(value)));
          else this.board.serialWrite(toText(value));
          return 0;
        }
        case "available":
          return this.board.serialAvailable();
        case "read":
          return this.board.serialRead();
        case "flush":
          return 0;
        case "end":
        case "clear":
          this.board.serialEnd();
          return 0;
        default:
          throw new SketchError(`Serial.${method}() chưa được hỗ trợ.`, line);
      }
    }

    if (isServo(object)) {
      switch (method) {
        case "attach": {
          const pin = this.pinOf(yield* this.arg(args, 0, 0), line, "Servo.attach");
          object.pin = pin;
          this.board.attachServo(pin);
          return 0;
        }
        case "write": {
          const angle = toNumber(yield* this.arg(args, 0, 0));
          object.angle = Math.max(0, Math.min(180, Math.round(angle)));
          this.board.setServoAngle(object.angle);
          return 0;
        }
        case "read":
          return object.angle;
        case "detach":
          object.pin = null;
          return 0;
        default:
          throw new SketchError(`Servo.${method}() chưa được hỗ trợ.`, line);
      }
    }

    if (typeof object === "string" || typeof object === "number") {
      const text = toText(object);
      switch (method) {
        case "length":
          return text.length;
        case "toInt":
          return Math.trunc(parseFloat(text) || 0);
        case "toFloat":
          return parseFloat(text) || 0;
        case "substring": {
          const start = Math.max(0, Math.trunc(toNumber(yield* this.arg(args, 0, 0))));
          const end = args[1] ? Math.trunc(toNumber(yield* this.evalExpr(args[1]))) : text.length;
          return text.slice(start, Math.max(start, end));
        }
        case "charAt":
          return text.charAt(Math.trunc(toNumber(yield* this.arg(args, 0, 0)))) || "\0";
        case "indexOf":
          return text.indexOf(toText(yield* this.arg(args, 0, "")));
        case "equals":
          return text === toText(yield* this.arg(args, 0, "")) ? 1 : 0;
        case "toUpperCase":
          return text.toUpperCase();
        case "toLowerCase":
          return text.toLowerCase();
        case "trim":
          return text.trim();
        case "startsWith":
          return text.startsWith(toText(yield* this.arg(args, 0, ""))) ? 1 : 0;
        case "endsWith":
          return text.endsWith(toText(yield* this.arg(args, 0, ""))) ? 1 : 0;
        case "concat":
          return text + toText(yield* this.arg(args, 0, ""));
        default:
          throw new SketchError(`Phương thức “${method}()” chưa được hỗ trợ cho chuỗi.`, line);
      }
    }

    throw new SketchError(`Chưa hỗ trợ phương thức “${method}()” cho giá trị này.`, line);
  }

  private formatValue(value: Value, format: number): string {
    if (typeof value === "number" && format !== 10) {
      if (format === 16) return Math.trunc(value).toString(16).toUpperCase();
      if (format === 2) return Math.trunc(value).toString(2);
      if (format === 8) return Math.trunc(value).toString(8);
    }
    return toText(value);
  }
}
