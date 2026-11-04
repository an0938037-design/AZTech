/* Parser cho tập con C++ Arduino: biến, mảng 1 chiều, hàm, if/for/while/do,
   switch, toán tử đầy đủ và lời gọi hàm/thư viện (Serial, Servo). */

import { SketchError, tokenize, preprocess, type Token } from "./lexer";

export type Expr =
  | { type: "num"; value: number; isFloat: boolean; line: number }
  | { type: "str"; value: string; line: number }
  | { type: "ident"; name: string; line: number }
  | { type: "unary"; op: string; arg: Expr; prefix: boolean; line: number }
  | { type: "binary"; op: string; left: Expr; right: Expr; line: number }
  | { type: "assign"; op: string; target: Expr; value: Expr; line: number }
  | { type: "ternary"; test: Expr; cons: Expr; alt: Expr; line: number }
  | { type: "call"; callee: Expr; args: Expr[]; line: number }
  | { type: "member"; object: Expr; name: string; line: number }
  | { type: "index"; object: Expr; index: Expr; line: number }
  | { type: "cast"; target: string; arg: Expr; line: number }
  | { type: "arraylit"; items: Expr[]; line: number };

export interface DeclItem {
  name: string;
  dims: Array<Expr | null>;
  init: Expr | null;
  ctorArgs: Expr[] | null;
  line: number;
}

export type Stmt =
  | { type: "empty"; line: number }
  | { type: "block"; body: Stmt[]; line: number }
  | { type: "vardecl"; declType: string; items: DeclItem[]; isConst: boolean; line: number }
  | { type: "expr"; expr: Expr; line: number }
  | { type: "if"; test: Expr; cons: Stmt; alt: Stmt | null; line: number }
  | { type: "for"; init: Stmt | null; test: Expr | null; update: Expr | null; body: Stmt; line: number }
  | { type: "while"; test: Expr; body: Stmt; line: number }
  | { type: "do"; body: Stmt; test: Expr; line: number }
  | {
      type: "switch";
      disc: Expr;
      cases: Array<{ test: Expr | null; body: Stmt[] }>;
      line: number;
    }
  | { type: "break"; line: number }
  | { type: "continue"; line: number }
  | { type: "return"; value: Expr | null; line: number };

export interface FuncDecl {
  name: string;
  params: Array<{ name: string; type: string }>;
  returns: string;
  body: Stmt;
  line: number;
}

export interface Program {
  globals: Stmt[];
  funcs: Map<string, FuncDecl>;
}

const TYPE_WORDS = new Set([
  "void",
  "int",
  "long",
  "short",
  "byte",
  "char",
  "float",
  "double",
  "bool",
  "boolean",
  "unsigned",
  "signed",
  "const",
  "static",
  "volatile",
  "String",
  "Servo",
  "LiquidCrystal_I2C",
  "LiquidCrystal",
  "size_t",
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "int8_t",
  "int16_t",
  "int32_t",
]);

const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "<": 7,
  ">": 7,
  "<=": 7,
  ">=": 7,
  "<<": 8,
  ">>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
};

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);

function canonicalType(words: string[]): string {
  const clean = words.filter(
    (word) => !["const", "static", "volatile", "signed", "unsigned"].includes(word)
  );
  if (clean.includes("String")) return "String";
  if (clean.includes("LiquidCrystal_I2C")) return "LiquidCrystal_I2C";
  if (clean.includes("LiquidCrystal")) return "LiquidCrystal";
  if (clean.includes("Servo")) return "Servo";
  if (clean.includes("void")) return "void";
  if (clean.includes("float") || clean.includes("double")) return "float";
  if (clean.includes("char") || clean.includes("int8_t") || clean.includes("uint8_t")) return "char";
  if (clean.includes("bool") || clean.includes("boolean")) return "bool";
  return "int";
}

export class Parser {
  private readonly tokens: Token[];
  private index = 0;
  private readonly funcs = new Map<string, FuncDecl>();
  private readonly globals: Stmt[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    while (!this.atEnd()) {
      if (!this.isTypeStart()) {
        const token = this.peek();
        throw new SketchError(
          `Ngoài hàm chỉ được khai báo biến hoặc định nghĩa hàm (gặp “${token.value}”).`,
          token.line
        );
      }

      const line = this.peek().line;
      const words = this.consumeTypeWords();
      const type = canonicalType(words);
      const isConst = words.includes("const");

      if (this.peek().kind !== "ident") {
        throw new SketchError("Thiếu tên biến hoặc tên hàm sau kiểu dữ liệu.", this.peek().line);
      }

      const nameToken = this.peek();
      const constructorType =
        type === "Servo" || type === "LiquidCrystal" || type === "LiquidCrystal_I2C";
      if (this.peek(1).value === "(" && !constructorType) {
        this.advance(); // tên hàm
        this.parseFunction(type, nameToken);
        continue;
      }

      if (type === "void") {
        throw new SketchError("Biến không thể có kiểu void.", nameToken.line);
      }

      this.globals.push(this.parseDeclarators(type, isConst, line));
    }

    return { globals: this.globals, funcs: this.funcs };
  }

  /* ------------------------------------------------------------------ */
  /* Token helpers                                                       */
  /* ------------------------------------------------------------------ */

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private atEnd(): boolean {
    return this.peek().kind === "eof";
  }

  private advance(): Token {
    const token = this.peek();
    if (!this.atEnd()) this.index += 1;
    return token;
  }

  private check(value: string): boolean {
    return this.peek().value === value;
  }

  private match(value: string): boolean {
    if (this.check(value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(value: string, message?: string): Token {
    if (!this.check(value)) {
      throw new SketchError(message ?? `Thiếu “${value}” (gặp “${this.peek().value}”).`, this.peek().line);
    }
    return this.advance();
  }

  private expectIdent(): Token {
    if (this.peek().kind !== "ident") {
      throw new SketchError(`Cần tên, nhưng gặp “${this.peek().value}”.`, this.peek().line);
    }
    return this.advance();
  }

  private isTypeStart(): boolean {
    return this.peek().kind === "ident" && TYPE_WORDS.has(this.peek().value);
  }

  private consumeTypeWords(): string[] {
    const words: string[] = [];
    while (this.peek().kind === "ident" && TYPE_WORDS.has(this.peek().value)) {
      words.push(this.advance().value);
    }
    if (this.check("*") || this.check("&")) {
      throw new SketchError("Chưa hỗ trợ con trỏ/tham chiếu. Hãy dùng biến thường.", this.peek().line);
    }
    return words;
  }

  /* ------------------------------------------------------------------ */
  /* Declarations & functions                                            */
  /* ------------------------------------------------------------------ */

  private parseDecl(): Stmt {
    const line = this.peek().line;
    const words = this.consumeTypeWords();
    return this.parseDeclarators(canonicalType(words), words.includes("const"), line);
  }

  private parseDeclarators(declType: string, isConst: boolean, line: number): Stmt {
    const items: DeclItem[] = [];

    do {
      const name = this.expectIdent();
      const dims: Array<Expr | null> = [];
      while (this.match("[")) {
        if (this.match("]")) {
          dims.push(null);
        } else {
          dims.push(this.parseExpression());
          this.expect("]");
        }
      }

      let init: Expr | null = null;
      let ctorArgs: Expr[] | null = null;
      if (this.match("=")) {
        if (this.check("{")) init = this.parseInitializerList();
        else init = this.parseAssignment();
      } else if (
        this.check("(") &&
        (declType === "Servo" || declType === "LiquidCrystal" || declType === "LiquidCrystal_I2C")
      ) {
        this.advance();
        ctorArgs = [];
        if (!this.check(")")) {
          do {
            ctorArgs.push(this.parseAssignment());
          } while (this.match(","));
        }
        this.expect(")");
      }

      items.push({ name: name.value, dims, init, ctorArgs, line: name.line });
    } while (this.match(","));

    this.expect(";", `Thiếu “;” sau khai báo “${items[0]?.name ?? ""}”.`);
    return { type: "vardecl", declType, items, isConst, line };
  }

  private parseInitializerList(): Expr {
    const line = this.expect("{").line;
    const items: Expr[] = [];
    if (!this.check("}")) {
      do {
        if (this.check("}")) break;
        items.push(this.parseAssignment());
      } while (this.match(","));
    }
    this.expect("}");
    return { type: "arraylit", items, line };
  }

  private parseFunction(returnType: string, nameToken: Token): void {
    this.expect("(");
    const params: Array<{ name: string; type: string }> = [];

    if (!this.check(")")) {
      let first = true;
      while (true) {
        if (!first) this.match(",");
        first = false;
        if (this.check(")")) break;

        const words = this.consumeTypeWords();
        if (words.length === 0) {
          throw new SketchError("Tham số hàm thiếu kiểu dữ liệu.", this.peek().line);
        }
        const type = canonicalType(words);
        if (type === "void" && (this.check(")") || this.check(","))) {
          continue;
        }
        params.push({ name: this.expectIdent().value, type });
        while (this.match("[")) {
          if (!this.check("]")) this.parseExpression();
          this.expect("]");
        }
      }
    }

    this.expect(")");

    if (this.match(";")) return; // prototype
    if (!this.check("{")) {
      throw new SketchError(`Hàm “${nameToken.value}” thiếu thân hàm “{”.`, this.peek().line);
    }

    if (this.funcs.has(nameToken.value)) {
      throw new SketchError(`Hàm “${nameToken.value}” được định nghĩa hai lần.`, nameToken.line);
    }

    const body = this.parseBlock();
    this.funcs.set(nameToken.value, {
      name: nameToken.value,
      params,
      returns: returnType,
      body,
      line: nameToken.line,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Statements                                                          */
  /* ------------------------------------------------------------------ */

  private parseBlock(): Stmt {
    const line = this.expect("{").line;
    const body: Stmt[] = [];
    while (!this.check("}")) {
      if (this.atEnd()) {
        throw new SketchError("Thiếu “}” đóng khối lệnh.", this.peek().line);
      }
      body.push(this.parseStatement());
    }
    this.expect("}");
    return { type: "block", body, line };
  }

  private parseStatement(): Stmt {
    const token = this.peek();

    if (this.check("{")) return this.parseBlock();
    if (this.match(";")) return { type: "empty", line: token.line };

    if (token.kind === "ident") {
      switch (token.value) {
        case "if": {
          this.advance();
          this.expect("(");
          const test = this.parseExpression();
          this.expect(")");
          const cons = this.parseStatement();
          let alt: Stmt | null = null;
          if (this.match("else")) alt = this.parseStatement();
          return { type: "if", test, cons, alt, line: token.line };
        }
        case "for": {
          this.advance();
          this.expect("(");
          let init: Stmt | null = null;
          if (!this.match(";")) {
            if (this.isTypeStart()) init = this.parseDecl();
            else {
              const expr = this.parseExpression();
              this.expect(";");
              init = { type: "expr", expr, line: token.line };
            }
          }
          let test: Expr | null = null;
          if (!this.check(";")) test = this.parseExpression();
          this.expect(";");
          let update: Expr | null = null;
          if (!this.check(")")) update = this.parseExpression();
          this.expect(")");
          const body = this.parseStatement();
          return { type: "for", init, test, update, body, line: token.line };
        }
        case "while": {
          this.advance();
          this.expect("(");
          const test = this.parseExpression();
          this.expect(")");
          const body = this.parseStatement();
          return { type: "while", test, body, line: token.line };
        }
        case "do": {
          this.advance();
          const body = this.parseStatement();
          if (!this.match("while")) {
            throw new SketchError("Sau khối do phải là “while”.", this.peek().line);
          }
          this.expect("(");
          const test = this.parseExpression();
          this.expect(")");
          this.expect(";");
          return { type: "do", body, test, line: token.line };
        }
        case "switch": {
          this.advance();
          this.expect("(");
          const disc = this.parseExpression();
          this.expect(")");
          this.expect("{");
          const cases: Array<{ test: Expr | null; body: Stmt[] }> = [];
          while (!this.check("}")) {
            let test: Expr | null = null;
            if (this.match("case")) {
              test = this.parseExpression();
              this.expect(":");
            } else if (this.match("default")) {
              this.expect(":");
            } else {
              throw new SketchError("Trong switch chỉ có case/default.", this.peek().line);
            }
            const body: Stmt[] = [];
            while (!this.check("case") && !this.check("default") && !this.check("}")) {
              body.push(this.parseStatement());
            }
            cases.push({ test, body });
          }
          this.expect("}");
          return { type: "switch", disc, cases, line: token.line };
        }
        case "break":
          this.advance();
          this.expect(";");
          return { type: "break", line: token.line };
        case "continue":
          this.advance();
          this.expect(";");
          return { type: "continue", line: token.line };
        case "return": {
          this.advance();
          const value = this.check(";") ? null : this.parseExpression();
          this.expect(";");
          return { type: "return", value, line: token.line };
        }
        case "else":
          throw new SketchError("“else” không đứng một mình.", token.line);
        default:
          break;
      }
    }

    if (this.isTypeStart()) return this.parseDecl();

    const expr = this.parseExpression();
    this.expect(";");
    return { type: "expr", expr, line: token.line };
  }

  /* ------------------------------------------------------------------ */
  /* Expressions                                                         */
  /* ------------------------------------------------------------------ */

  private parseExpression(): Expr {
    return this.parseAssignment();
  }

  private parseAssignment(): Expr {
    const left = this.parseConditional();
    if (this.peek().kind === "punct" && ASSIGN_OPS.has(this.peek().value)) {
      const op = this.advance();
      const value = this.parseAssignment();
      return { type: "assign", op: op.value, target: left, value, line: op.line };
    }
    return left;
  }

  private parseConditional(): Expr {
    const test = this.parseBinary(1);
    if (this.match("?")) {
      const cons = this.parseAssignment();
      this.expect(":");
      const alt = this.parseAssignment();
      return { type: "ternary", test, cons, alt, line: test.line };
    }
    return test;
  }

  private parseBinary(minPrecedence: number): Expr {
    let left = this.parseUnary();

    while (true) {
      const token = this.peek();
      if (token.kind !== "punct") break;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      this.advance();
      const right = this.parseBinary(precedence + 1);
      left = { type: "binary", op: token.value, left, right, line: token.line };
    }

    return left;
  }

  private isCastAhead(): boolean {
    const next = this.peek(1);
    return next.kind === "ident" && TYPE_WORDS.has(next.value) && !["const", "static", "volatile"].includes(next.value);
  }

  private parseUnary(): Expr {
    const token = this.peek();

    if (token.kind === "punct" && ["!", "~", "-", "+", "++", "--"].includes(token.value)) {
      this.advance();
      const arg = this.parseUnary();
      return { type: "unary", op: token.value, arg, prefix: true, line: token.line };
    }

    if (this.check("(") && this.isCastAhead()) {
      this.advance();
      const words = this.consumeTypeWords();
      this.expect(")");
      const arg = this.parseUnary();
      return { type: "cast", target: canonicalType(words), arg, line: token.line };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match("(")) {
        const args: Expr[] = [];
        if (!this.check(")")) {
          do {
            args.push(this.parseAssignment());
          } while (this.match(","));
        }
        this.expect(")");
        expr = { type: "call", callee: expr, args, line: expr.line };
        continue;
      }

      if (this.match("[")) {
        const index = this.parseExpression();
        this.expect("]");
        expr = { type: "index", object: expr, index, line: expr.line };
        continue;
      }

      if (this.match(".")) {
        const name = this.expectIdent();
        expr = { type: "member", object: expr, name: name.value, line: expr.line };
        continue;
      }

      if (this.check("++") || this.check("--")) {
        const op = this.advance();
        expr = { type: "unary", op: op.value, arg: expr, prefix: false, line: op.line };
        continue;
      }

      break;
    }

    return expr;
  }

  private parsePrimary(): Expr {
    const token = this.peek();

    if (token.kind === "num") {
      this.advance();
      return { type: "num", value: token.num ?? 0, isFloat: Boolean(token.float), line: token.line };
    }

    if (token.kind === "str" || token.kind === "char") {
      this.advance();
      return { type: "str", value: token.value, line: token.line };
    }

    if (token.kind === "ident") {
      this.advance();
      return { type: "ident", name: token.value, line: token.line };
    }

    if (this.match("(")) {
      const expr = this.parseExpression();
      this.expect(")");
      return expr;
    }

    throw new SketchError(`Không hiểu biểu thức bắt đầu bằng “${token.value}”.`, token.line);
  }
}

export function compile(source: string): Program {
  const code = preprocess(source);
  const tokens = tokenize(code);
  return new Parser(tokens).parse();
}
