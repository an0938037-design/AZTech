function contextBlock(value) {
  return JSON.stringify(value, null, 2);
}

function analysisPrompt({ subject, topic, prompt, notes }) {
  return `Bạn là chuyên gia thiết kế bài học phổ thông Việt Nam. Hãy phân tích yêu cầu và trả về DUY NHẤT một JSON hợp lệ, không markdown, không giải thích.

DỮ LIỆU ĐẦU VÀO:
${contextBlock({ subject, topic, prompt, notes })}

SCHEMA BẮT BUỘC:
{
  "subject": "Tên môn học",
  "topic": "Tên bài học",
  "objectives": ["Mục tiêu 1", "Mục tiêu 2"],
  "lecture_brief": {
    "outline": ["Tổng quan", "Khái niệm cốt lõi", "Công thức", "Ví dụ", "Ôn tập"],
    "concepts": [{"name": "Tên khái niệm", "definition": "Định nghĩa ngắn"}],
    "formulas": [{"name": "Tên công thức", "expression": "Biểu thức gốc", "variants": ["Dạng biến đổi 1", "Dạng biến đổi 2"]}],
    "examples": ["Ví dụ minh họa"],
    "warnings": ["Lỗi hoặc hiểu nhầm thường gặp"]
  },
  "mindmap_brief": {
    "root": "Chủ đề gốc",
    "branches": [
      {"title": "Nhánh chính", "children": ["Ý con 1", "Ý con 2"]}
    ]
  },
  "interactive_brief": {
    "kind": "function_plot | geometry | pendulum | cell | timeline | spreadsheet | code | language | generic",
    "goal": "Mục tiêu của mô hình tương tác",
    "inputs": ["Tham số người dùng có thể thay đổi"],
    "outputs": ["Kết quả hiển thị"],
    "constraints": ["Ràng buộc kỹ thuật hoặc sư phạm"]
  }
}

QUY TẮC:
- Toàn bộ nội dung bằng tiếng Việt, chính xác, phù hợp lứa tuổi phổ thông.
- mindmap_brief phải có 3-6 nhánh chính, mỗi nhánh 2-5 ý con.
- interactive_brief.kind phải chọn đúng bản chất môn học.
- lecture_brief.formulas chỉ ghi công thức thật sự xuất hiện trong bài; nếu không có thì để mảng rỗng.
- Không thêm bất kỳ trường nào ngoài schema.
- Không dùng ký tự markdown bao quanh JSON.`;
}

function lecturePrompt({ subject, topic, analysis }) {
  return `Bạn là giáo viên biên soạn bài giảng. Dựa trên bản phân tích, hãy viết nội dung bài học tiếng Việt và trả về DUY NHẤT JSON hợp lệ.

MÔN: ${subject}
BÀI: ${topic}
PHÂN TÍCH:
${contextBlock(analysis)}

SCHEMA BẮT BUỘC:
{
  "summary": "Tóm tắt 2-3 câu",
  "blocks": [
    {"type": "heading", "level": 2, "text": "Tên phần"},
    {"type": "paragraph", "text": "Đoạn văn ngắn, rõ ý"},
    {"type": "concept", "title": "Tên khái niệm", "body": "Định nghĩa và ý chính"},
    {"type": "formula", "name": "Tên công thức", "expression": "Biểu thức gốc", "variables": [{"symbol": "U", "meaning": "Hiệu điện thế (V)"}], "variants": [{"label": "Tính dòng điện", "expression": "I = U / R"}], "note": "Ghi chú ngắn"},
    {"type": "warning", "title": "Sai lầm thường gặp", "body": "Nội dung cảnh báo"},
    {"type": "example", "title": "Ví dụ", "problem": "Đề bài", "steps": ["Bước 1", "Bước 2"], "answer": "Kết quả"},
    {"type": "list", "items": ["Ý 1", "Ý 2"], "ordered": false}
  ]
}

QUY TẮC:
- Mở đầu bằng heading cấp 2 cho phần "Tổng quan".
- Mỗi khái niệm quan trọng đặt trong một block "concept".
- Mỗi công thức cốt lõi đặt trong block "formula"; bắt buộc có ít nhất 1 biến thể nếu công thức có thể biến đổi.
- Có ít nhất 1 block "example" và 1 block "warning".
- Đoạn văn ngắn, không quá 5 câu; tránh nhồi chữ.
- Không dùng markdown ngoài các trường văn bản; không thêm trường lạ.
- Chỉ trả về JSON.`;
}

function mindmapPrompt({ subject, topic, analysis }) {
  return `Bạn là lập trình viên front-end tạo sơ đồ tư duy tương tác. Hãy trả về DUY NHẤT JSON hợp lệ.

MÔN: ${subject}
BÀI: ${topic}
BẢN PHÂN TÍCH:
${contextBlock(analysis)}

SCHEMA BẮT BUỘC:
{
  "kind": "mindmap",
  "title": "Tên sơ đồ",
  "html": "FULL HTML FRAGMENT",
  "css": "CSS THUẦN",
  "js": "JAVASCRIPT THUẦN",
  "meta": {"layout": "tree | radial | timeline"}
}

YÊU CẦU KỸ THUẬT:
- "html" là fragment (không có <html>, <head>, <body>), chứa toàn bộ nội dung sơ đồ.
- Chỉ dùng HTML, CSS, JavaScript thuần, SVG hoặc Canvas. KHÔNG dùng thư viện ngoài, CDN, import, fetch, XMLHttpRequest, WebSocket, localStorage, sessionStorage, cookie.
- Không truy cập DOM của trang cha. Chỉ được dùng parent.postMessage để gửi chiều cao.
- Giao diện đen/trắng/xám: nền #0a0a0a, chữ #f5f5f5, phụ #a3a3a3, đường kẻ #262626. Không bo góc, không gradient, không bóng đổ.
- Sơ đồ phải rõ thứ bậc: gốc ở giữa hoặc bên trái, các nhánh tỏa ra, đường nối rõ ràng.
- Có thể click vào node để mở/đóng nhánh hoặc hiện mô tả. Có nút zoom nếu cần.
- Responsive, chữ dễ đọc, không tràn ngang.
- Khi tải xong và khi kích thước thay đổi, gửi:
  parent.postMessage({ type: "sandbox:height", height: document.documentElement.scrollHeight }, "*");
- Không dùng alert, confirm, prompt.
- Không thêm trường nào ngoài schema. Chỉ trả về JSON.`;
}

function interactivePrompt({ subject, topic, analysis }) {
  return `Bạn là lập trình viên front-end tạo mô hình tương tác cho bài học. Hãy trả về DUY NHẤT JSON hợp lệ.

MÔN: ${subject}
BÀI: ${topic}
BẢN PHÂN TÍCH:
${contextBlock(analysis)}

SCHEMA BẮT BUỘC:
{
  "kind": "interactive",
  "title": "Tên mô hình",
  "html": "FULL HTML FRAGMENT",
  "css": "CSS THUẦN",
  "js": "JAVASCRIPT THUẦN",
  "meta": {"widget": "function_plot | geometry | pendulum | cell | timeline | spreadsheet | code | language | generic"}
}

YÊU CẦU KỸ THUẬT:
- "html" là fragment (không có <html>, <head>, <body>).
- Chỉ dùng HTML, CSS, JavaScript thuần, SVG hoặc Canvas. KHÔNG dùng thư viện ngoài, CDN, import, fetch, XMLHttpRequest, WebSocket, localStorage, sessionStorage, cookie.
- Không truy cập DOM của trang cha. Chỉ được dùng parent.postMessage để gửi chiều cao.
- Phải có ít nhất 1 tham số người dùng thay đổi được (slider, input, nút bấm) và kết quả cập nhật trực tiếp.
- Giao diện đen/trắng/xám: nền #0a0a0a, chữ #f5f5f5, phụ #a3a3a3, đường kẻ #262626. Không bo góc, không gradient, không bóng đổ.
- Có nhãn tiếng Việt cho tham số và kết quả.
- Responsive, không tràn ngang.
- Khi tải xong và khi kích thước thay đổi, gửi:
  parent.postMessage({ type: "sandbox:height", height: document.documentElement.scrollHeight }, "*");
- Không dùng alert, confirm, prompt.
- Không thêm trường nào ngoài schema. Chỉ trả về JSON.`;
}

function quizPrompt({ subject, topic, analysis, lecture }) {
  return `Bạn là giáo viên ra đề kiểm tra. Dựa trên bài học, hãy tạo câu hỏi trắc nghiệm tiếng Việt và trả về DUY NHẤT JSON hợp lệ.

MÔN: ${subject}
BÀI: ${topic}
PHÂN TÍCH:
${contextBlock(analysis)}
BÀI GIẢNG:
${contextBlock(lecture)}

SCHEMA BẮT BUỘC:
{
  "quiz": [
    {
      "question": "Câu hỏi?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0,
      "explanation": "Giải thích ngắn"
    }
  ]
}

QUY TẮC:
- 3-5 câu, bám sát nội dung, không đánh đố.
- Mỗi câu có đúng 4 lựa chọn, correct_answer là số 0-3.
- Có giải thích cho đáp án đúng.
- Chỉ trả về JSON.`;
}

module.exports = {
  analysisPrompt,
  lecturePrompt,
  mindmapPrompt,
  interactivePrompt,
  quizPrompt,
};
