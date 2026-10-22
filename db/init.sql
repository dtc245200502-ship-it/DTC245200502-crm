CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(180),
  email VARCHAR(254),
  phone VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('lead', 'active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(120),
  email VARCHAR(254),
  phone VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interactions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'note' CHECK (type IN ('call', 'email', 'meeting', 'note')),
  summary VARCHAR(500) NOT NULL,
  details TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts (customer_id);
CREATE INDEX IF NOT EXISTS idx_interactions_customer_date ON interactions (customer_id, occurred_at DESC);

INSERT INTO customers (name, company, email, phone, status, notes)
SELECT 'Nguyễn Minh Anh', 'Công ty Sao Việt', 'minhanh@example.com', '0901234567', 'active', 'Khách hàng mẫu để kiểm tra hệ thống.'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'minhanh@example.com');

INSERT INTO customers (name, company, email, phone, status, notes) VALUES
('Trần Thị Mai Lan', 'Công ty TNHH Công Nghệ Ánh Dương', 'mailan.tran@anhduongtech.vn', '0912345601', 'active', 'Khách hàng doanh nghiệp sử dụng gói phần mềm quản lý kho và bán hàng.'),
('Lê Hoàng Nam', 'Tập đoàn Xây dựng An Phát', 'nam.le@anphatgroup.com', '0988776602', 'active', 'Đang ký hợp đồng dịch vụ tư vấn quản lý dự án năm 2026.'),
('Phạm Quỳnh Nga', 'Công ty CP Truyền thông VinaLink', 'quynhnga@vinalink.vn', '0903456703', 'lead', 'Khách hàng tiềm năng, cần gửi báo giá gói chăm sóc khách hàng đa kênh.'),
('Vũ Đức Thắng', 'Chuỗi Siêu thị Thực phẩm Xanh', 'thang.vu@thucphamxanh.com', '0932112204', 'active', 'Hợp tác cung ứng chuỗi bán lẻ, thanh toán đúng hạn hàng tháng.'),
('Đặng Thùy Dương', 'Công ty May Mặc Thời Trang Sen Vàng', 'duong.dang@senvangfashion.com', '0976554405', 'lead', 'Đang cân nhắc chuyển đổi hệ thống CRM cho đội ngũ kinh doanh 20 người.'),
('Bùi Quang Huy', 'Công ty CP Giải pháp Logistics Toàn Cầu', 'huy.bui@globallogistics.vn', '0918889906', 'active', 'Khách hàng VIP ngành vận tải biển, phụ trách chi nhánh miền Bắc.'),
('Hoàng Yến Nhi', 'Viện Đào tạo & Khởi nghiệp Sáng tạo', 'yennhi@innocenter.edu.vn', '0965443307', 'active', 'Sử dụng giải pháp quản lý học viên và tổ chức hội thảo.'),
('Đỗ Tiến Dũng', 'Công ty Cơ khí & Tự động hóa Nam Hải', 'dung.do@namhaiauto.com.vn', '0908223308', 'inactive', 'Tạm ngừng dịch vụ để nâng cấp hạ tầng nhà máy, hẹn liên hệ lại quý 3.'),
('Ngô Bảo Trâm', 'Chuỗi Cà phê Highlands Garden', 'tram.ngo@highlandsgarden.vn', '0938776609', 'active', 'Khách hàng thân thiết F&B, chuỗi có 15 chi nhánh tại Hà Nội và TP.HCM.'),
('Phan Văn Hùng', 'Công ty TNHH Dược phẩm Đông Á', 'hung.phan@dongapharma.vn', '0982334410', 'lead', 'Quan tâm tích hợp dữ liệu khách hàng nhà thuốc và bệnh viện.'),
('Dương Minh Triết', 'Công ty Bất động sản Đất Lành', 'triet.duong@datlanhland.vn', '0945667711', 'active', 'Đối tác phân phối các dự án căn hộ cao cấp và văn phòng cho thuê.'),
('Nguyễn Thúy Hà', 'Công ty TNHH Thiết kế Nội thất Không Gian Mới', 'thuyha@khonggianmoi.vn', '0971223312', 'lead', 'Cần tư vấn quy trình quản lý hợp đồng thiết kế và thi công nội thất.'),
('Tạ Quốc Tuấn', 'Công ty Phân phối Thiết bị Y tế Tân Bình', 'tuan.ta@tanbinhmed.com', '0913998813', 'active', 'Khách hàng duy trì dịch vụ bảo hành thiết bị y tế 3 năm liên tiếp.'),
('Lương Thu Trang', 'Hệ thống Bán lẻ Mỹ phẩm Lona Beauty', 'trang.luong@lonabeauty.vn', '0909445514', 'active', 'Tích hợp quản lý tích điểm và chăm sóc khách hàng trung thành.'),
('Hồ Gia Bảo', 'Công ty TNHH Giải pháp Năng lượng Xanh EcoPower', 'bao.ho@ecopower.com.vn', '0987112215', 'lead', 'Đang thử nghiệm bản dùng thử tính năng lưu trữ lịch sử cuộc gọi.'),
('Võ Phương Uyên', 'Trường Quốc tế Song ngữ Horizon', 'uyen.vo@horizon-edu.vn', '0933667716', 'active', 'Khách hàng giáo dục, áp dụng CRM cho bộ phận tuyển sinh và liên lạc phụ huynh.'),
('Đinh Khắc Hưng', 'Công ty CP Thương mại & Vận tải Bắc Nam', 'hung.dinh@bacnamtransport.com', '0968990017', 'inactive', 'Đang tái cơ cấu doanh nghiệp, dự kiến kích hoạt lại dịch vụ vào cuối năm.'),
('Đoàn Kim Oanh', 'Khách sạn & Nghỉ dưỡng Biển Xanh', 'oanh.doan@blueoceanresort.vn', '0915332218', 'active', 'Quản lý đặt phòng và ưu đãi đặc quyền cho hội viên VIP.'),
('Trịnh Văn Thành', 'Công ty TNHH Nhập khẩu Ô tô Việt Hưng', 'thanh.trinh@viethungauto.vn', '0977881119', 'active', 'Quản lý hồ sơ lái thử, mua bảo hiểm và bảo dưỡng định kỳ cho khách hàng.'),
('Mai Lan Phương', 'Công ty Quảng cáo & Sự kiện Phù Đổng', 'phuong.mai@phudongmedia.vn', '0906554420', 'lead', 'Cần hệ thống theo dõi tiến độ chiến dịch và phản hồi khách hàng theo thời gian thực.')
ON CONFLICT DO NOTHING;

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Trần Quốc Bảo', 'Quản lý mua hàng', 'bao@example.com', '0912345678'
FROM customers c
WHERE c.email = 'minhanh@example.com'
  AND NOT EXISTS (SELECT 1 FROM contacts x WHERE x.customer_id = c.id);

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Nguyễn Anh Tuấn', 'Giám đốc Kỹ thuật', 'tuan.nguyen@anhduongtech.vn', '0912001122'
FROM customers c WHERE c.email = 'mailan.tran@anhduongtech.vn'
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id);

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Phạm Hồng Sơn', 'Trưởng ban Quản lý Đấu thầu', 'son.pham@anphatgroup.com', '0988002233'
FROM customers c WHERE c.email = 'nam.le@anphatgroup.com'
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id);

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Lê Thị Thu Thảo', 'Trưởng phòng Marketing', 'thao.le@vinalink.vn', '0903003344'
FROM customers c WHERE c.email = 'quynhnga@vinalink.vn'
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id);

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Hoàng Minh Đức', 'Giám đốc Vận hành Chuỗi', 'duc.hoang@thucphamxanh.com', '0932004455'
FROM customers c WHERE c.email = 'thang.vu@thucphamxanh.com'
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id);

INSERT INTO contacts (customer_id, name, role, email, phone)
SELECT c.id, 'Vũ Thị Ngọc Ánh', 'Trưởng phòng Kinh doanh', 'anh.vu@globallogistics.vn', '0918005566'
FROM customers c WHERE c.email = 'huy.bui@globallogistics.vn'
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE customer_id = c.id);

INSERT INTO interactions (customer_id, type, summary, details, occurred_at)
SELECT c.id, 'call', 'Gọi điện giới thiệu dịch vụ', 'Khách hàng quan tâm gói dịch vụ CRM, hẹn liên hệ lại.', NOW() - INTERVAL '1 day'
FROM customers c
WHERE c.email = 'minhanh@example.com'
  AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.customer_id = c.id);

INSERT INTO interactions (customer_id, type, summary, details, occurred_at)
SELECT c.id, 'meeting', 'Họp rà soát tiến độ triển khai tính năng mới', 'Khách hàng phản hồi rất hài lòng với giao diện mới và đề xuất mở rộng tài khoản cho 5 chi nhánh.', NOW() - INTERVAL '2 hours'
FROM customers c WHERE c.email = 'mailan.tran@anhduongtech.vn'
  AND NOT EXISTS (SELECT 1 FROM interactions WHERE customer_id = c.id);

INSERT INTO interactions (customer_id, type, summary, details, occurred_at)
SELECT c.id, 'call', 'Tư vấn giải pháp và hẹn gửi báo giá chi tiết', 'Đã trao đổi về nhu cầu lưu trữ lịch sử liên hệ và tích hợp dữ liệu bán hàng. Hẹn gửi proposal trước thứ Năm.', NOW() - INTERVAL '5 hours'
FROM customers c WHERE c.email = 'quynhnga@vinalink.vn'
  AND NOT EXISTS (SELECT 1 FROM interactions WHERE customer_id = c.id);

INSERT INTO interactions (customer_id, type, summary, details, occurred_at)
SELECT c.id, 'email', 'Gửi xác nhận hợp đồng và tài liệu đào tạo người dùng', 'Đã gửi file hướng dẫn sử dụng và bàn giao tài khoản quản trị cho phụ trách vận hành.', NOW() - INTERVAL '1 day'
FROM customers c WHERE c.email = 'nam.le@anphatgroup.com'
  AND NOT EXISTS (SELECT 1 FROM interactions WHERE customer_id = c.id);

INSERT INTO interactions (customer_id, type, summary, details, occurred_at)
SELECT c.id, 'call', 'Hỏi thăm định kỳ và hỗ trợ nghiệp vụ bán lẻ', 'Hệ thống vận hành ổn định, khách hàng hỏi thêm về cách xuất báo cáo danh sách theo ngày.', NOW() - INTERVAL '2 days'
FROM customers c WHERE c.email = 'thang.vu@thucphamxanh.com'
  AND NOT EXISTS (SELECT 1 FROM interactions WHERE customer_id = c.id);
