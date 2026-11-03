# Phân tích sâu think.pro.vn

> Nguồn: https://think.pro.vn/ (đã rà soát HTML, bundle JS minified, public API, route map).  
> Mục tiêu: hiểu ý tưởng tương tự, so sánh với AI Learning Engine, và chứng minh ta cũng làm được.

## 1. Tổng quan sản phẩm

**think** là nền tảng học tập tương tác đa môn, bám sát Chương trình GDPT 2018 (lớp 6–12), gồm 8 môn: Toán, Vật lý, Hóa học, Địa lý, Sinh học, Ngữ văn, Tiếng Anh, Lịch sử.

Thông điệp: *“Cả vũ trụ kiến thức trong một think”* — UI chủ đề vũ trụ, các hành tinh đại diện cho chức năng, bấm vào hành tinh để vào thẳng.

5 trục chính:
1. **Thư viện học liệu** — bài trình chiếu, mô phỏng, bài học đã biên tập, xếp theo môn/lớp.
2. **Mô phỏng** — dựng mô phỏng của riêng bạn: con lắc, sóng, quỹ đạo… kéo tham số, xem hiện tượng đổi ngay.
3. **Góc học tập** — bàn học 3D, vở, lịch học, chế độ tập trung.
4. **Lớp học** — tạo lớp bằng mã, giao bài, chấm và chữa ngay trên think.
5. **Kho đề** — đề có giờ, nộp là có điểm, lời giải chi tiết từng câu.

Hỗ trợ: `support@think.vn`. Nội dung bám sát GDPT 2018.

## 2. Kiến trúc thông tin & route

Route chính (trích từ bundle):
- Công khai: `/`, `/community`, `/community/:slug`, `/exams`, `/exams/:slug`, `/exams/featured`, `/search`, `/students`, `/schools`, `/help-center`, `/terms-of-use`, `/privacy-policy`, `/copyright-policy`, `/policies/:slug`.
- Người dùng: `/library`, `/library/saved`, `/my-simulations`, `/my-presentations`, `/study-corner`, `/study-corner/notebooks/:code/*`, `/me`, `/me/settings`, `/notifications/*`, `/referrals/*`.
- Lớp học: `/classes`, `/classes/join`, `/classes/:classId`, `/classes/:classId/assignments/:assignmentId/*` (read, exam, simulations, presentations, english, grading, edit).
- Tác giả/nội dung: `/builder`, `/builder/:simulationId`, `/simulations/:simulationId`, `/play/:simulationId`, `/studio`, `/studio-preview/:submissionId`, `/presentations/:id`, `/presentations/:id/publish`, `/exams/import`, `/exams/mine`, `/exams/review`.
- Monetization: `/shop`, `/pen-shop`.
- Admin/giáo viên: `/teacher`, `/admin`, `/cong-cu-giao-vien`.
- Auth: `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/forgot-password`, Google OAuth (`/auth/google/done`, `/auth/link-google`, …).

API: `https://think.pro.vn/api/v1/...` (REST, JSON envelope `{ data, meta, requestId }`).

## 3. Mô hình nội dung

- **Subjects** (8 môn) → **Grades** (6–12) → **Chapters** → **Lessons**.
- **Community posts**: `SIMULATION` hoặc `PRESENTATION`, có `slug`, `title`, `subject`, `grade`, `chapter`, `topic`, `description`, `coverImageUrl`, `coverThumbnailUrl`, `pageCount`, `ratingAverage/Count`, `viewCount`, `saveCount`, `publishedAt`, `attribution`.
- **Filters**: subject, grade, chapter, topic, type, feed (`for-you`, `top-rated`, `newest`, `most-saved`), search, cursor pagination.
- **Tương tác cộng đồng**: lưu (`save`/`DELETE`), đánh giá (`rating` PUT/DELETE), bình luận (`comments` POST/DELETE, report), phản hồi riêng tư (`feedback`), báo cáo (`reports`), đếm lượt xem (`views/qualify` với `dwellMs`), copy bài.
- **Tính năng cộng đồng bật/tắt** qua `/public/community-features`: library, publication, rating, privateFeedback, publicComments, follow, messaging, feed, libraryRatingsEnabled.

## 4. Tính năng nổi bật

### 4.1 Mô phỏng tương tác (core)
- Người dùng kéo tham số → hiện tượng đổi ngay (con lắc, sóng, quỹ đạo, đồ thị hàm số sin với 4 thanh trượt, đường tròn lượng giác, hình nón…).
- Cover là ảnh chụp mô phỏng; có mô tả, bài tập, lời giải.
- Tác giả: “T. A. N.” với 217 bài đăng → sản phẩm do một tác giả chính biên soạn, AI/agent hỗ trợ.

### 4.2 Builder / Studio
- `/builder`, `/studio` cho phép tác giả tự dựng mô phỏng/trình chiếu.
- `/play/:simulationId` chạy mô phỏng đã xuất bản.
- `/presentations/:id/publish` xuất bản trình chiếu.

### 4.3 Góc học tập
- `/study-corner`, notebooks (`/study-corner/notebooks/:code/*`, `cover-editor`), focus mode, calendar, activities (`balloon-race`, `chicken-race`), pen shop.
- Bàn học 3D, vở, lịch học, chế độ tập trung.

### 4.4 Lớp học
- Tạo lớp bằng mã, giao bài (read, exam, simulations, presentations, english), chấm và chữa.
- Phân quyền: student, teacher, admin, content editor.

### 4.5 Kho đề
- Đề có giờ, nộp là có điểm, lời giải chi tiết từng câu, import đề, review.

### 4.6 Auth
- Google OAuth + mật khẩu, verify email, forgot password, refresh token, liên kết Google.
- UI đăng nhập có tương tác “Kéo dây để bật đèn”.

### 4.7 UX/Design
- Chủ đề vũ trụ, hành tinh tương tác, cookie banner GDPR, “Bấm vào mèo để góp ý”.
- KaTeX render công thức, GLTFLoader (3D assets), Rive (11 chỗ) cho animation.
- Không dùng Three.js/WebGL nặng; hiệu ứng chủ yếu CSS/SVG/canvas 2D + Rive.

## 5. So sánh với AI Learning Engine

| Tiêu chí | think.pro.vn | AI Learning Engine (của ta) |
| --- | --- | --- |
| Tạo bài từ đề | Biên tập thủ công + builder | Pipeline AI 3 tầng (phân tích 1 lần → sinh song song) |
| Sơ đồ tư duy | Không rõ (có thể trong presentation) | Có, sandbox cô lập |
| Mô hình tương tác | Có, builder + community | Có, sandbox cô lập, fallback theo môn |
| Thư viện cộng đồng | Có, rating/save/comment | Chưa có (chỉ local/cloud cá nhân) |
| Lớp học/giao bài | Có | Chưa có |
| Kho đề có giờ | Có | Quiz cơ bản, chưa timed exam |
| Góc học tập 3D | Có (bàn học, vở, lịch, focus) | Chưa có |
| Monetization | Shop, pen, referral | Không |
| Auth | Google OAuth + password | Mã thiết bị 8 số + mã tài khoản 8 số |
| Storage | Cloud (backend) | Supabase/local, Brotli, AES-256-GCM |
| AI provider | Không rõ (có thể không dùng AI) | Gemini + OpenRouter, mỗi tài khoản lưu riêng |
| Sandbox bảo mật | Không rõ | CSP + chặn network, iframe cô lập |
| Offline fallback | Không rõ | Có, dựng sẵn theo môn |
| Responsive/mobile | Có | Có (breakpoint 900/1100/760) |
| Design | Vũ trụ, nhiều màu | Đen/trắng/xám, vuông góc, tràn viền |

## 6. Điều ta đã làm được (proof points)

- Pipeline 3 tầng với brief riêng cho lecture/mindmap/interactive, sinh song song, bản nháp chỉ trong RAM.
- Sandbox HTML/CSS/JS thuần, không CDN, chặn network, postMessage chiều cao.
- Fallback offline theo 9 môn (sơ đồ + mô hình).
- Cloud lưu Brotli + AES-256-GCM, migrate localStorage, idempotent account.
- Provider Gemini/OpenRouter song song, active provider rõ ràng, OpenRouter bắt buộc nhập model.
- UI responsive, reduced-motion, design system nhất quán.

## 7. Khoảng trống cần lấp để “cho nó biết ta cũng làm được”

Ưu tiên cao (để đạt parity):
1. **Thư viện học liệu cộng đồng** (publish/share/search/filter/rating/save) — ta đã có artifact sandbox + storage; cần thêm public endpoint + UI browse.
2. **Mô phỏng builder** — cho phép chỉnh tham số và xuất bản; ta đã có artifact generator, cần editor.
3. **Kho đề có giờ** — nâng cấp QuizView thành timed exam với chấm điểm và review.
4. **Góc học tập** — vở ghi chú, lịch, focus mode (đơn giản hoá).
5. **Lớp học** — tạo lớp bằng mã, giao bài, chấm (phức tạp, làm sau).

Ưu tiên thấp:
- Monetization (shop/pen/referral).
- Auth Google OAuth (ta dùng device code, đủ cho use case cá nhân).
- 3D nặng (ta giữ CSS/SVG/canvas để nhẹ và không phụ thuộc WebGL).

## 9. Đã triển khai parity trong repo (UI theo triết lý riêng)

Để chứng minh “ta cũng làm được” mà không sao chép UI của think, các tính năng sau đã được thêm với design system đen/trắng/xám, vuông góc, tràn viền:

- **Kho đề có giờ** (`src/components/QuizView.tsx`): chế độ thi có giờ, đếm ngược, tự nộp khi hết giờ, chấm điểm, xem giải thích, làm lại. CSS `.exam-bar`, `.exam-timer`, `.field-inline`.
- **Góc học tập** (`src/components/StudyCorner.tsx`): Pomodoro 25/5 tự chuyển phiên, ghi chú tự lưu, chế độ tập trung ẩn sidebar (`body.focus-mode`).
- **Hình học không gian** (`src/components/GeometrySpace.tsx`): nâng cấp lên **Three.js** (WebGL) — OrbitControls xoay/zoom/pan, GridHelper, AxesHelper, ánh sáng; 7 dạng (lập phương, hộp chữ nhật, mặt cầu, hình trụ, hình nón, hình chóp, mặt phẳng) với thanh trượt; nền sáng.
- **Thanh lệnh GeoGebra-style** (`src/components/GeometrySpace.tsx`): nhập lệnh như `A = (1,2,3)`, `Segment(A,B)`, `Plane(A,B,C)`, `Cube(O,2)`, `Sphere(O,1)`, `Cylinder(O,r,h)`, `Cone(O,r,h)`, `Pyramid(O,a,h)`, `Vector(A,B)`, `Midpoint(A,B)`, `Polygon(A,B,C)` — đối tượng xuất hiện ngay trên canvas 3D, có nhật ký lệnh.
- **Tương tác kéo thả** (`src/components/GeometrySpace.tsx`): click khoảng trống đặt điểm (snap lưới), kéo điểm di chuyển (snap nhẹ), OrbitControls xoay/zoom.
- Điều hướng mới trong sidebar: “GÓC HỌC TẬP”, “HÌNH HỌC 3D”, “THƯ VIỆN”.
- View mới `"study"`, `"geometry"` trong `src/App.tsx` và store.

Các phần còn lại (thư viện cộng đồng publish/share, builder mô phỏng, lớp học) có thể xây trên nền artifact sandbox + storage hiện có; ưu tiên theo nhu cầu.

## 8. Kết luận

think.pro.vn là sản phẩm biên tập thủ công + builder, thiên về cộng đồng và lớp học. AI Learning Engine của ta thiên về **AI pipeline** và **sandbox bảo mật**, nhanh hơn trong việc tạo bài mới, nhưng thiếu lớp cộng đồng/lớp học/kho đề có giờ. Để “cho nó biết ta cũng làm được”, ta nên:
- Công bố thư viện mô phỏng cá nhân + community (share link),
- Nâng cấp quiz thành timed exam,
- Thêm study corner (notes + focus).

Các phần này đều có thể xây trên nền tảng hiện có (artifact sandbox, storage, account) mà không phá design system đen/trắng/xám.
