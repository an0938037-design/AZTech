export interface SubjectMeta {
  name: string;
  code: string;
  short: string;
}

export const SUBJECTS: SubjectMeta[] = [
  { name: "Toán", code: "MATH", short: "TO" },
  { name: "Ngữ Văn", code: "LIT", short: "NV" },
  { name: "Vật Lý", code: "PHY", short: "VL" },
  { name: "Hoá Học", code: "CHEM", short: "HH" },
  { name: "Sinh Học", code: "BIO", short: "SH" },
  { name: "Lịch Sử", code: "HIS", short: "LS" },
  { name: "Tin học văn phòng", code: "OFFICE", short: "VP" },
  { name: "Tin học Lập Trình", code: "CODE", short: "LT" },
  { name: "Tiếng Anh", code: "ENG", short: "TA" },
];

export function fold(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function subjectMeta(name: string): SubjectMeta {
  const folded = fold(name);
  return (
    SUBJECTS.find((item) => fold(item.name) === folded) ??
    SUBJECTS.find(
      (item) =>
        folded.includes(fold(item.name)) || fold(item.name).includes(folded)
    ) ??
    SUBJECTS[0]
  );
}

export function subjectCode(name: string): string {
  return subjectMeta(name).short;
}

export const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  "Toán": ["Hàm số bậc hai", "Đạo hàm và ứng dụng", "Xác suất cơ bản"],
  "Ngữ Văn": ["Phân tích tác phẩm", "Nghị luận xã hội", "Biện pháp tu từ"],
  "Vật Lý": ["Định luật Ohm", "Con lắc đơn", "Sóng cơ học"],
  "Hoá Học": ["Cấu tạo nguyên tử", "Phản ứng oxi hoá - khử", "Dung dịch và pH"],
  "Sinh Học": ["Cấu trúc tế bào", "Quang hợp", "Di truyền Mendel"],
  "Lịch Sử": ["Chiến dịch Điện Biên Phủ", "Cách mạng tháng Tám", "Chiến tranh lạnh"],
  "Tin học văn phòng": ["Excel cơ bản", "Hàm IF và VLOOKUP", "Trình chiếu hiệu quả"],
  "Tin học Lập Trình": ["Biến và kiểu dữ liệu", "Vòng lặp", "Mảng một chiều"],
  "Tiếng Anh": ["Present Simple", "Câu bị động", "Mệnh đề quan hệ"],
};
