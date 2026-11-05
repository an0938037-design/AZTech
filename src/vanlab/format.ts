const TỪ_KHÓA_SQL = [
  "select", "from", "where", "group by", "order by", "having", "limit",
  "insert into", "values", "create table", "drop table", "left join",
  "inner join", "join", "on", "desc", "asc",
];

const BF_OPS = "><+-.,[]";

/* Chỉ viết hoa từ khóa ở phần mã, không đụng vào chuỗi nằm trong dấu nháy đơn. */
function ngoàiChuỗi(code: string, biến: (s: string) => string) {
  let ra = "";
  let phần = "";
  let i = 0;
  while (i < code.length) {
    if (code[i] === "'") {
      ra += biến(phần);
      phần = "";
      const đóng = code.indexOf("'", i + 1);
      if (đóng < 0) return ra + code.slice(i);
      ra += code.slice(i, đóng + 1);
      i = đóng + 1;
      continue;
    }
    phần += code[i];
    i++;
  }
  return ra + biến(phần);
}

export function formatCode(code: string, langId: string) {
  if (langId === "json") return JSON.stringify(JSON.parse(code), null, 2) + "\n";
  if (langId === "bf") return [...code].filter((c) => BF_OPS.includes(c)).join(" ");
  if (langId === "sql") {
    const out = ngoàiChuỗi(code, (m) => {
      for (const kw of TỪ_KHÓA_SQL)
        m = m.replace(new RegExp(`\\b${kw.replace(/ /g, "\\s+")}\\b`, "gi"), (x) => x.toUpperCase());
      return m;
    });
    return out.replace(/[ \t]+$/gm, "").trim() + "\n";
  }
  return code.replace(/[ \t]+$/gm, "").replace(/\n{4,}/g, "\n\n\n");
}

export const formatDuration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);
