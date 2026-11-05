/* Dữ liệu trạm Vạn Ngôn: ngôn ngữ, engine, mẫu mã.
   Mỗi ngôn ngữ thuộc về một họ (cat) để dải chọn đọc được trong một cái nhìn. */

export type LangCat = "web" | "kichban" | "hethong" | "ham" | "dulieu" | "kythu";

export interface EngineRef {
  kind: "local" | "remote";
  engine: string;
  label: string;
  compiler?: string;
  flags?: string;
}

export interface VanLang {
  id: string;
  name: string;
  cat: LangCat;
  year: number;
  blurb: string;
  impl: EngineRef[];
  seed: string;
  comment?: string;
}

export const CATS: { id: LangCat; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "kichban", label: "Kịch bản" },
  { id: "hethong", label: "Hệ thống" },
  { id: "ham", label: "Hàm" },
  { id: "dulieu", label: "Dữ liệu" },
  { id: "kythu", label: "Kỹ thuật" },
];

const wb = (compiler: string, label: string, flags?: string): EngineRef => ({
  kind: "remote",
  engine: "wandbox",
  compiler,
  label,
  flags,
});

export const VAN_LANGS: VanLang[] = [
  {
    id: "js",
    name: "JavaScript",
    cat: "web",
    year: 1995,
    blurb: "Máy chạy có sẵn trong mọi trình duyệt.",
    comment: "//",
    impl: [
      { kind: "local", engine: "browser-js", label: "Sandbox trình duyệt" },
      wb("nodejs-20.17.0", "Node.js 20.17"),
    ],
    seed: `const HangTu = (s) => [...s].reverse().join("");
console.log("Vạn Ngôn:", HangTu("ngôn"));
console.log([1, 2, 3].map((n) => n * n));
`,
  },
  {
    id: "html",
    name: "HTML",
    cat: "web",
    year: 1993,
    blurb: "Kết trúc trang — render ngay trong khung xem trước.",
    comment: "<!-- -->",
    impl: [{ kind: "local", engine: "markup", label: "Khung xem trước" }],
    seed: `<!doctype html>
<h1>Trạm Vạn Ngôn</h1>
<p>Mã chạy trong <b>WebAssembly</b> hoặc trên máy từ xa.</p>
<ul><li>Python</li><li>Lua</li><li>SQL</li></ul>
`,
  },
  {
    id: "css",
    name: "CSS",
    cat: "web",
    year: 1996,
    blurb: "Bộ chọn và màu — thử ngay trên trang nháp.",
    comment: "/* */",
    impl: [{ kind: "local", engine: "css-preview", label: "Khung xem trước" }],
    seed: `body { font: 16px/1.6 system-ui; background: #0f1720; color: #e6edf3; padding: 2rem; }
.card { border: 1px solid #e8b04b; border-radius: 14px; padding: 1rem; }
.card:hover { box-shadow: 0 0 24px -8px #e8b04b; }
`,
  },
  {
    id: "svg",
    name: "SVG",
    cat: "web",
    year: 1999,
    blurb: "Hình vẽ bằng mã, phóng bao nhiêu cũng sắc.",
    comment: "<!-- -->",
    impl: [{ kind: "local", engine: "svg-preview", label: "Khung xem trước" }],
    seed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">
  <circle cx="80" cy="90" r="46" fill="#e8b04b" opacity=".85"/>
  <circle cx="170" cy="90" r="46" fill="#4fc9a0" opacity=".75"/>
  <text x="20" y="165" font-size="14" fill="#e6edf3">hai hành tinh của mã</text>
</svg>
`,
  },
  {
    id: "python",
    name: "Python",
    cat: "kichban",
    year: 1991,
    blurb: "CPython nằm gọn trong WebAssembly (Pyodide).",
    comment: "#",
    impl: [
      { kind: "local", engine: "pyodide", label: "Pyodide (WASM)" },
      wb("cpython-3.13.8", "CPython 3.13.8"),
    ],
    seed: `from math import isqrt

def nguyen_to(n):
    if n < 2:
        return False
    for d in range(2, isqrt(n) + 1):
        if n % d == 0:
            return False
    return True

print([n for n in range(2, 60) if nguyen_to(n)])
`,
  },
  {
    id: "lua",
    name: "Lua",
    cat: "kichban",
    year: 1993,
    blurb: "VM Fengari — Lua viết bằng JavaScript.",
    comment: "--",
    impl: [
      { kind: "local", engine: "fengari", label: "Fengari (WASM-like VM)" },
      wb("lua-5.4.7", "Lua 5.4.7"),
    ],
    seed: `local fibonacci = {}
fibonacci[1], fibonacci[2] = 1, 1
for i = 3, 12 do
  fibonacci[i] = fibonacci[i - 1] + fibonacci[i - 2]
end
print(table.concat(fibonacci, " ", 1, 12))
`,
  },
  {
    id: "sql",
    name: "SQL (SQLite)",
    cat: "kichban",
    year: 1974,
    blurb: "SQLite biên dịch sang WebAssembly, hỏi thật.",
    comment: "--",
    impl: [
      { kind: "local", engine: "sqljs", label: "SQLite WASM" },
      wb("sqlite-3.46.1", "SQLite 3.46.1"),
    ],
    seed: `create table hanh_tinh (ten text, du_kinh real, mon text);
insert into hanh_tinh values
  ('Sao Thuỷ', 4879, 'Tin học'),
  ('Sao Kim', 12104, 'Ngữ văn'),
  ('Trái Đất', 12742, 'Sinh học'),
  ('Sao Hoả', 6779, 'Lịch sử');

select mon, count(*) as so_ngoi, round(avg(du_kinh)) as trung_binh
from hanh_tinh
group by mon
order by trung_binh desc;
`,
  },
  {
    id: "bash",
    name: "Bash",
    cat: "kichban",
    year: 1989,
    blurb: "Chạy trên nhân Linux từ xa.",
    comment: "#",
    impl: [wb("bash", "GNU Bash")],
    seed: `for i in 1 2 3 4; do
  echo "ngôn ngữ thứ $i"
done
date -u +%Y-%m-%d
`,
  },
  {
    id: "ruby",
    name: "Ruby",
    cat: "kichban",
    year: 1995,
    blurb: "Block là trung tâm ngôn ngữ.",
    comment: "#",
    impl: [wb("ruby-3.4.9", "Ruby 3.4.9")],
    seed: `so = (1..9).select { |n| (n ** 2) < 50 }
puts so.inspect
`,
  },
  {
    id: "c",
    name: "C",
    cat: "hethong",
    year: 1972,
    blurb: "Nền của hệ điều hành hiện đại.",
    comment: "/* */",
    impl: [wb("gcc-13.2.0-c", "gcc 13.2")],
    seed: `#include <stdio.h>
int main(void) {
  int tong = 0;
  for (int i = 1; i <= 10; i++) tong += i;
  printf("tong 1..10 = %d\\n", tong);
  return 0;
}
`,
  },
  {
    id: "cpp",
    name: "C++",
    cat: "hethong",
    year: 1985,
    blurb: "Trừu tượng không mất phí.",
    comment: "//",
    impl: [wb("gcc-13.2.0", "gcc 13.2", "-std=gnu++20")],
    seed: `#include <iostream>
#include <vector>
#include <algorithm>
int main() {
  std::vector<int> v{5, 3, 9, 1};
  std::sort(v.begin(), v.end());
  for (int n : v) std::cout << n << ' ';
  std::cout << std::endl;
}
`,
  },
  {
    id: "rust",
    name: "Rust",
    cat: "hethong",
    year: 2010,
    blurb: "An toàn bộ nhớ nhờ ownership.",
    comment: "//",
    impl: [wb("rust-1.82.0", "rustc 1.82.0")],
    seed: `fn main() {
    let tong: i32 = (1..=10).filter(|n| n % 2 == 0).sum();
    println!("chan 1..=10 tong = {tong}");
}
`,
  },
  {
    id: "go",
    name: "Go",
    cat: "hethong",
    year: 2009,
    blurb: "Ít từ khoá, goroutine có sẵn.",
    comment: "//",
    impl: [wb("go-1.23.2", "Go 1.23.2")],
    seed: `package main

import "fmt"

func main() {
    dem := map[string]int{"a": 1, "b": 2}
    for k, v := range dem {
        fmt.Println(k, v)
    }
}
`,
  },
  {
    id: "java",
    name: "Java",
    cat: "hethong",
    year: 1995,
    blurb: "Viết một lần, chạy mọi nơi.",
    comment: "//",
    impl: [wb("openjdk-jdk-22+36", "OpenJDK 22")],
    seed: `class Chinh {
  public static void main(String[] a) {
    var so = new int[]{3, 1, 2};
    java.util.Arrays.sort(so);
    System.out.println(java.util.Arrays.toString(so));
  }
}
`,
  },
  {
    id: "haskell",
    name: "Haskell",
    cat: "ham",
    year: 1990,
    blurb: "Thuần hàm, mọi tác dụng ghi trong kiểu.",
    comment: "--",
    impl: [wb("ghc-9.10.1", "GHC 9.10.1")],
    seed: `main :: IO ()
main = print (take 10 (map (^2) [1..]))
`,
  },
  {
    id: "json",
    name: "JSON",
    cat: "dulieu",
    year: 2001,
    blurb: "Máy kiểm tra cú pháp rồi vẽ cây.",
    impl: [{ kind: "local", engine: "json-tool", label: "Bộ kiểm tra trong máy" }],
    seed: `{
  "tran": "Van Ngon",
  "ngon_ngu": ["Python", "Lua", "SQL"],
  "local": true,
  "nam": 2026
}
`,
  },
  {
    id: "yaml",
    name: "YAML",
    cat: "dulieu",
    year: 2001,
    blurb: "Thụt lề sai là máy chỉ đúng dòng.",
    comment: "#",
    impl: [{ kind: "local", engine: "yaml-tool", label: "Bộ kiểm tra trong máy" }],
    seed: `tran: Van Ngon
ding_so:
  - Python
  - Lua
  - SQL
local: true
`,
  },
  {
    id: "md",
    name: "Markdown",
    cat: "dulieu",
    year: 2004,
    blurb: "Render thành HTML ngay tại chỗ.",
    impl: [{ kind: "local", engine: "markdown-render", label: "Trình render trong máy" }],
    seed: `# Trạm Vạn Ngôn

Chạy **Python**, *Lua*, *SQL* trong máy; C, Rust, Go ở máy từ xa.

- local: WebAssembly
- remote: Wandbox
`,
  },
  {
    id: "bf",
    name: "Brainfuck",
    cat: "kythu",
    year: 1993,
    blurb: "Tám lệnh, một băng giấy.",
    impl: [{ kind: "local", engine: "brainfuck", label: "Máy ảo tự viết" }],
    seed: `++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.
`,
  },
];

export const VAN_BY_ID: Record<string, VanLang> = Object.fromEntries(
  VAN_LANGS.map((lang) => [lang.id, lang])
);
