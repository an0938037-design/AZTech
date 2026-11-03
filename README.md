# AZTeach — AI Learning Engine

Hệ thống học tập cá nhân: biến một đề bài thành **bài giảng có cấu trúc**, **sơ đồ tư duy** và **mô hình tương tác** chạy trong sandbox cô lập.

- Pipeline AI 3 tầng: phân tích đề một lần → sinh 3 kênh song song.
- Bản nháp chỉ nằm trong RAM. Không lưu gì cho đến khi người dùng bấm **Giữ lại**.
- Lưu cloud (Supabase) hoặc local (trình duyệt) nếu chưa có tài khoản.
- Hỗ trợ **Gemini** và **OpenRouter**, mỗi tài khoản lưu riêng key + model.
- Giao diện **liquid glass** kiểu iOS trên nền vũ trụ động; 10 bộ màu, sáng/tối; responsive tới mobile.
- **Phòng lab hóa học 3D** gồm hai chế độ: **phản ứng** (điều chế, quan sát hiện tượng) và **phân tử** (7 mẫu dựng sẵn); cùng với **hình học không gian 3D** tích hợp trong ứng dụng.
- **Hệ mặt trời AZTeach** là trang chủ: hero slogan **“Học sâu hơn. Nhìn rõ hơn.”** nổi trên toàn màn hình cùng hệ mặt trời (tên web **AZTeach** góc trái); cuộn chuột/vuốt hoặc bấm **CUỘN XUỐNG** để xuống **phần trang chủ** — hàng stat + lưới chọn môn học. Các hành tinh theo thứ tự thật: Sao Thuỷ = Tin học, Sao Kim = Ngữ Văn & Ngoại ngữ, Trái Đất = Sinh học, Sao Hoả = Lịch sử, Sao Mộc = Vật lý, Sao Thổ = Toán học, Sao Thiên Vương = Địa lý, Sao Hải Vương = Hoá học.

## Kiến trúc

```
Frontend (React + Vite + Zustand)
  └── /api  ──►  Backend Express
                   ├── AI: Gemini | OpenRouter
                   ├── Storage: local (JSON) | Supabase
                   └── Nén Brotli + mã hoá AES-256-GCM
```

- `src/` — giao diện, store, pipeline, fallback offline, sandbox.
- `server/` — API tài khoản, cấu hình AI, sinh nội dung, lưu bài học.
- `server/sql/001_init.sql` — schema Supabase.
- `server/data/db.json` — dữ liệu khi chạy storage local.

## Chạy local

### 1. Backend

```bash
# từ thư mục gốc dự án
copy .env.example .env    # Windows
# cp .env.example .env    # macOS/Linux

cd server
npm install
npm start
# http://localhost:3001
```

Backend đọc `.env` ở thư mục gốc trước, sau đó tới `server/.env`.

### 2. Frontend

```bash
npm install
npm run dev
# http://localhost:5173  (proxy /api -> http://localhost:3001)
```

Có thể đổi cổng: `npm run dev -- --port 5174`.

### Kiểm tra nhanh

```bash
curl http://localhost:3001/api/health
# {"ok":true,"storage":"local"}
```

## Biến môi trường

| Biến | Mô tả |
| --- | --- |
| `PORT` | Cổng backend, mặc định `3001`. |
| `CORS_ORIGIN` | Danh sách origin frontend, phân tách bằng dấu phẩy. |
| `APP_URL` | URL ứng dụng, dùng làm `HTTP-Referer` cho OpenRouter. |
| `STORAGE_DRIVER` | `local` hoặc `supabase`. Để trống sẽ tự chọn Supabase nếu đủ cấu hình. |
| `SUPABASE_URL` | Project URL của Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, **chỉ dùng ở backend**. |
| `APP_ENCRYPTION_KEY` | Khoá AES-256-GCM để mã hoá API key người dùng (>= 32 ký tự). |
| `GEMINI_MODEL` | Model Gemini mặc định. |
| `OPENROUTER_MODEL` | Model OpenRouter mặc định. |

Nếu thiếu `APP_ENCRYPTION_KEY`, backend fallback sang lưu `plain:` — chỉ nên dùng khi phát triển.

## Supabase

1. Tạo project tại [supabase.com](https://supabase.com).
2. Mở **SQL Editor**, chạy toàn bộ `server/sql/001_init.sql`.
3. Điền vào `.env`:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
APP_ENCRYPTION_KEY=<chuỗi-ngẫu-nhiên-32+-ký-tự>
```

4. Khởi động lại backend. Log phải hiện `[storage] using supabase`.

Schema gồm: `accounts`, `devices`, `ai_configs`, `lessons`, `lesson_artifacts`. Artifact được nén Brotli và lưu riêng theo `kind`: `lecture`, `mindmap`, `interactive`, `quiz`.

## Deploy Render

Cách gọn nhất là deploy từ **root repository** để backend phục vụ luôn file tĩnh trong `dist/`.

- **Build Command**
  ```bash
  npm install && npm run build && cd server && npm install
  ```
- **Start Command**
  ```bash
  cd server && npm start
  ```
- **Health Check Path**: `/api/health`
- Thêm các biến môi trường ở trên trong phần **Environment**.
- Đặt `CORS_ORIGIN` và `APP_URL` bằng domain Render (hoặc domain frontend riêng).

Backend tự phục vụ `dist/index.html` nếu thư mục `dist/` tồn tại, nên chỉ cần một service.

## Tài khoản & thiết bị

- Mỗi trình duyệt có một **mã thiết bị** 8 số lưu trong `localStorage` (`device-code`).
- Tạo tài khoản trả về **mã tài khoản** 8 số. Mã này dùng để ghép thiết bị khác.
- `POST /api/account/create` idempotent theo mã thiết bị: gọi lại trả về đúng tài khoản cũ.
- API xác thực bằng header `X-Device-CODE`; backend tra `devices` → `accounts`.
- Không có mật khẩu. Không chia sẻ mã tài khoản.

## Provider AI

- Mỗi tài khoản lưu **song song** cấu hình Gemini và OpenRouter (key đã mã hoá + model).
- Lưu cấu hình **không tự đổi** provider đang dùng. Bấm **DÙNG PROVIDER NÀY** để áp dụng cho toàn pipeline.
- OpenRouter bắt buộc nhập tên model, ví dụ `google/gemini-2.5-flash`.
- Nút **KIỂM TRA KẾT NỐI** gọi thử provider; nút tải gợi ý model lấy danh sách từ provider.
- Toàn bộ pipeline (phân tích, bài giảng, sơ đồ, mô hình, quiz) dùng chung một provider active.

## Luồng tạo bài

1. Chọn môn, nhập chủ đề / đề bài / ghi chú, hoặc import file.
2. Backend phân tích **một lần** thành `lecture_brief`, `mindmap_brief`, `interactive_brief`.
3. Ba request sinh nội dung chạy **song song**.
4. Kết quả là một bản nháp trong RAM, mở màn hình xem trước.
5. **Giữ lại** → lưu cloud (nếu có tài khoản) hoặc localStorage.
   **Không giữ** → xoá nháp, không ghi gì.

Không có tài khoản hoặc provider lỗi: hệ thống dùng **fallback offline** dựng sẵn bài giảng, sơ đồ và mô hình theo môn, không chờ AI.

## Sandbox

Sơ đồ tư duy và mô hình tương tác là HTML/CSS/JS thuần, render trong iframe:

- `sandbox="allow-scripts"` (không cùng origin, không top navigation).
- CSP `default-src 'none'`, chỉ cho phép style/script inline.
- Chặn `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `window.open`.
- Chỉ nhận `postMessage` từ đúng iframe (chiều cao, yêu cầu tải lại).
- Không dùng thư viện ngoài, không CDN, không kết nối mạng.

## Import file

Hỗ trợ PDF, DOCX, PPTX, TXT/MD. Phần đọc PDF/DOCX/PPTX được **lazy-load** khi người dùng chọn file, không nằm trong bundle chính.

## Giao diện & điều hướng

- Nền vũ trụ vẽ bằng **Canvas 2D** (`CosmicBackground`): dải Ngân Hà, 3 lớp sao parallax, tinh vân, hành tinh có vành + vệ tinh, sao băng và vignette. Tự đổi màu theo theme/palette, tôn trọng `prefers-reduced-motion`, tạm dừng khi tab ẩn.
- Toàn bộ bề mặt dùng kính mờ (`backdrop-filter`), góc bo mềm, viền sáng và đổ bóng sâu — lớp override nằm trong `src/cosmic-glass.css`, nạp sau `src/index.css`.
- **Sidebar** thu gọn/mở rộng bằng cách bấm chính logo **AI**; animation width + opacity + transform, nội dung không bị logo đè.
- **Thanh trạng thái trên cùng** dồn toàn bộ thông tin về bên phải: màn hình hiện tại, LOCAL/CLOUD, nút quản lý và đồng hồ trực tiếp.
- **10 bộ màu theo chủ đề hành tinh & sao**: Sao Thuỷ, Sao Kim, Trái Đất, Sao Hoả, Sao Mộc, Sao Thổ, Sao Thiên Vương, Sao Hải Vương, Mặt Trời và **Tinh Vân** (nền vũ trụ violet). Chế độ tối đảo vai trò primary ↔ accent; lựa chọn lưu trong `localStorage` (`theme`, `palette`).
- Các màn hình chính: **Trang chủ** (chính là **Hệ mặt trời AZTeach**), **Thư viện** (chỉ trong sidebar), **Ghi chú**, **Tài khoản & AI**, **Hình học 3D**, **Phòng lab 3D**.
- **Hệ mặt trời AZTeach** (`src/solar.ts`, `src/solarTextures.ts`, `SolarSystem.tsx`, `SolarDashboard.tsx`): Three.js, camera bay mượt giữa 3 tầng — **hệ mặt trời** (8 hành tinh theo thứ tự thật: Sao Thuỷ = Tin học, Sao Kim = Ngữ Văn & Ngoại ngữ, Trái Đất = Sinh học, Sao Hoả = Lịch sử, Sao Mộc = Vật lý, Sao Thổ = Toán học, Sao Thiên Vương = Địa lý, Sao Hải Vương = Hoá học), **hành tinh** (vệ tinh = các chương thật của môn, tự xuất hiện/biến mất theo dữ liệu) và **chương** (các trạm học phát sáng quanh vệ tinh). Mặt Trời là **AZ AI**.
  - Nhãn 2D chiếu từ toạ độ 3D, tự dồn chỗ (declutter) và chừa chỗ cho bảng chỉ mục; bảng chỉ mục chỉ mở khi đi vào hành tinh để cả hệ luôn trọn vẹn.
  - Bản đồ dữ liệu học tập và phần thiên văn học được tách riêng (`solarModel`, `buildStations`); tiến độ (số chương/trạm đã học) lưu trong `localStorage` (`solar-progress-v1`), ảnh hưởng tới độ sáng hành tinh, màu vệ tinh và trạm học.
  - Chất liệu PBR: nền hành tinh, khí quyển, vành đai (Sao Thổ), mây trôi (Trái Đất), đèn đô thị ban đêm; vệ tinh tự nhiên (Moon/Europa/Io/Titan/Phobos) khác vệ tinh nhân tạo (tàu vũ trụ). LOD far/near tự đổi khi focus; texture sinh theo seed, không cần tải ngoài.
  - Không hỗ trợ WebGL → **lưới 2D dự phòng** liệt kê đầy đủ 8 hành tinh/chương (kiểm thử bằng cách chặn `getContext('webgl')`).
  - Toạ độ góc nhìn được ghi nhớ khi quay lại hệ mặt trời; không cần đăng nhập để dùng.
- Phòng lab 3D có hai tab. Tab **Phản ứng** cho phép điều chế: chọn chất từ kệ 18 chất (axit, bazơ, muối tan, kim loại, oxit, chỉ thị), hệ thống tự nhận diện phản ứng, chạy chuỗi tối đa 5 bước và hiển thị phương trình, hiện tượng, sản phẩm. Tab **Phân tử** dựng 7 phân tử mẫu bằng Three.js, xoay/zoom/pan, bật tắt nhãn nguyên tử, đặt lại góc nhìn.
- Hiện tượng trong cốc được mô phỏng bằng Three.js: dung dịch đổi màu/độ đục, bọt khí, kết tủa lắng, cục chất rắn, ngọn lửa, hơi nước/khói, bếp điện phát sáng và giọt rót. Màu accent bám theo bộ màu đang chọn.
- Phòng phản ứng giữ **lịch sử 5 phản ứng** và **sổ tay sản phẩm** (chất đã điều chế); nút **Đun nóng** mở khoá phản ứng nhiệt phân, **Rửa cốc** reset thí nghiệm nhưng giữ lịch sử.
- Ba chunk 3D (hình học, phòng lab, OrbitControls) đều được lazy-load.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b + vite build
npm run preview   # xem bản build
npm run lint      # oxlint
```

Backend:

```bash
cd server
npm start
```

## Ghi chú

- Model mặc định có thể thay đổi theo thời điểm; kiểm tra lại ID model trong trang Tài khoản.
- Khi phát triển, thư mục `server/` được loại khỏi Vite watcher để việc ghi `db.json` không làm reload frontend.
- Bản build hiện tách `fileExtract` và `pdf.worker` thành chunk riêng; bundle chính khoảng 540 kB (gzip ~163 kB).
