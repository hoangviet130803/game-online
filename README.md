# 🏯 Kỳ Đạo Quán (Game Center - React + Vite)

Ứng dụng Game Center dành riêng cho **Tam Đại Kỳ Nghệ**: **Cờ Vua (Chess)**, **Cờ Tướng (Xiangqi)** và **Cờ Vây (Go / Baduk)**, được xây dựng bằng **React (Vite)** với cấu trúc chuẩn **mỗi game nằm trong 1 folder riêng biệt**, hỗ trợ đầy đủ **Chế độ Chơi với Máy (AI)**, **2 Người chơi (PvP)** và **tuân thủ nghiêm ngặt Luật Cờ Việt Nam & Quốc Tế**.

---

## 📂 Cấu trúc thư mục (Mỗi game 1 folder)

```text
Code_Game/
├── index.html                   # HTML gốc của ứng dụng Vite
├── package.json                 # Cấu hình dependencies (React 18, React Router DOM, Vite)
├── vite.config.js               # Cấu hình Vite React plugin
├── src/
│   ├── main.jsx                 # Entry point khởi tạo React app & BrowserRouter
│   ├── App.jsx                  # Điều hướng các Route (/co-vua, /co-tuong, /co-vay)
│   ├── index.css                # CSS toàn cục (dark mode, scrollbar)
│   └── pages/
│       ├── Home/                # 🏠 Folder Trang Chủ (Kỳ Đạo Quán)
│       │   ├── index.jsx
│       │   └── Home.module.css
│       ├── CoVua/               # ♔ Folder Game Cờ Vua Quốc Tế (FIDE Rules)
│       │   ├── index.jsx
│       │   └── CoVua.module.css
│       ├── CoTuong/             # 🏮 Folder Game Cờ Tướng (Vietnam / WXF Rules)
│       │   ├── index.jsx
│       │   └── CoTuong.module.css
│       └── CoVay/               # ⚪ Folder Game Cờ Vây (Go / Baduk Rules)
│           ├── index.jsx
│           └── CoVay.module.css
```

---

## 📜 Quy chuẩn Luật Cờ Việt Nam & Quốc Tế được áp dụng

### 1. ♔ Cờ Vua (FIDE - Liên đoàn Cờ Vua Quốc Tế)
- **Tỉ lệ bàn cờ**: 8x8 ô vuông tuyệt đối (`aspect-ratio: 1 / 1`), màu sắc gỗ sang trọng, tọa độ từ a-h và 1-8.
- **Chiếu Vua (Check)**: Phát hiện và cảnh báo tức thì khi Vua bị bất kỳ quân địch nào tấn công. Vua bị chiếu sẽ phát hào quang cảnh báo.
- **Lọc nước đi hợp lệ (In Check Filter)**: Người chơi không thể đi bất kỳ nước cờ nào khiến Vua đồng minh bị chiếu hoặc duy trì trạng thái bị chiếu.
- **Chiếu bí (Checkmate)**: Khi Vua bị chiếu và không còn bất kỳ nước đi hợp lệ nào để hóa giải -> Kết thúc ván, bên chiếu bí thắng.
- **Hòa cờ bế tắc (Stalemate)**: Khi bên đến lượt đi không bị chiếu nhưng không còn nước đi hợp lệ nào -> Tự động xử Hòa theo luật FIDE.
- **Nhập thành (Castling)**:
  - Nhập thành gần (O-O / King-side) và Nhập thành xa (O-O-O / Queen-side).
  - Điều kiện: Vua và Xe chưa từng di chuyển, các ô trung gian trống, Vua không đang bị chiếu và không đi qua ô đang bị kiểm soát.
- **Bắt tốt qua đường (En Passant)**: Cho phép Tốt bắt chéo Tốt đối phương vừa tiến 2 ô ở nước đi ngay trước đó.
- **Phong cấp (Promotion)**: Khi Tốt đi đến hàng cuối (hàng 8 cho Trắng, hàng 1 cho Đen), hiển thị modal cho phép người chơi chọn phong thành **Hậu, Xe, Tượng hoặc Mã**.

---

### 2. 🏮 Cờ Tướng (Luật Cờ Tướng Việt Nam & WXF)
- **Tỉ lệ bàn cờ**: 9x10 ô cờ vuông đều nhau 100% (`aspect-ratio: 9 / 10`), đường chỉ sông Sở Hà - Hán Giới và Cung Cấm chữ X chuẩn xác.
- **Luật Lộ diện Tướng (Chống Tướng)**: Hai Tướng của 2 bên tuyệt đối không được nhìn thấy nhau trên cùng một cột dọc mà không có bất kỳ quân nào chắn giữa.
- **Cung Cấm (Cửu Cung)**: Tướng và Sĩ chỉ được di chuyển trong phạm vi Cửu Cung; Tượng không được qua sông và bị cản bởi mắt Tượng.
- **Cản Mã (Chặn chân Mã)**: Ngựa không nhảy được nếu có quân nằm ngay trước bước đi thẳng đầu tiên.
- **Pháo ăn quân**: Pháo phải nhảy qua đúng một quân làm ngòi để ăn quân mục tiêu.
- **Chiếu Tướng & Chiếu Bí**: Cảnh báo khi Tướng lâm nguy.
- **Luật Khốn Tướng (Stalemate Loss)**: Theo quy định chính thức của Cờ Tướng Việt Nam và Liên đoàn Cờ tướng Thế giới (WXF), bên đến lượt đi mà không còn nước đi hợp lệ nào (dù không bị chiếu) sẽ bị **Xử Thua** (khác biệt cơ bản so với Cờ Vua).

---

### 3. ⚪ Cờ Vây (Go / Baduk - Nihon Ki-in / IGF Rules)
- **Tỉ lệ bàn cờ**: Khung lưới vuông tỉ lệ 1:1, hỗ trợ kích thước **9x9 (Tốc chiến)** và **13x13 (Chiến thuật)** cùng các điểm sao Hoshi chuẩn.
- **Khí & Bắt quân (Liberties & Capturing)**: Tự động tính toán khí theo thời gian thực bằng thuật toán BFS. Cụm quân hết khí bị loại khỏi bàn và tính vào bảng tù binh.
- **Luật Cấm Tự Sát (Suicide Rule)**: Cấm người chơi đặt quân vào ô không còn khí, trừ phi nước đi đó trực tiếp ăn được quân địch để tạo khí mới.
- **Luật Kiếp (Ko Rule)**: Cấm lập tức ăn lại quân đối phương nếu nước cờ làm lặp lại trạng thái bàn cờ ở nước trước. Điểm Kiếp được đánh dấu chữ ✕ trên bàn cờ.
- **Điểm đền bù Komi**: Quân Trắng được cộng **5.5 mục (bàn 9x9)** hoặc **6.5 mục (bàn 13x13)** để bù trừ cho lợi thế đi trước của quân Đen.
- **Nước Bỏ lượt (Pass) & Tính điểm**:
  - Khi hai bên liên tiếp chọn Bỏ lượt (Pass), ván cờ chính thức kết thúc.
  - Thuật toán Flood-Fill tự động kiểm đếm vùng đất trống (Territory) thuộc quyền kiểm soát của mỗi bên.
  - Tổng kết: `Điểm = Đất + Số Tù Binh (+ Komi cho Trắng)` để phân định thắng thua với cách biệt số mục cụ thể.
- **Nút Đầu hàng (Resign)**: Cho phép dừng ván đấu văn minh khi thế cờ bất lợi.

---

## 🤖 Chế độ AI trên cả 3 tựa game

Tại thanh điều khiển của mỗi bàn cờ, bạn có thể dễ dàng chuyển đổi giữa:
- **🤖 Đấu với Máy (PvE)**: Mặc định bật sẵn, AI tự động tính toán thế trận, nước đi chiến thuật và phản hồi sau ~400ms.
- **👥 2 Người (PvP)**: Chơi đối kháng trực tiếp trên cùng một thiết bị.

---

## 🚀 Hướng dẫn khởi chạy

Mở Terminal tại thư mục `d:\LEARN________E\Learn\Code_Game` và chạy:

```bash
npm run dev
```

Sau đó mở trình duyệt theo địa chỉ: `http://localhost:5173`.
