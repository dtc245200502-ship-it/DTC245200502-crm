# API nhanh

Tất cả API dưới `/api` (ngoại trừ đăng nhập và health check) yêu cầu header `Authorization: Bearer <token>`.

## Xác thực
- `POST /api/auth/login` — JSON `{ "username": "admin", "password": "..." }`, trả về token JWT có hạn 4 giờ.
- `GET /api/health` — kiểm tra kết nối PostgreSQL.
- `GET /metrics` — chỉ số Prometheus; dùng trong mạng Docker nội bộ.
- `GET /__test__/http-500` — chỉ có khi `NODE_ENV=test`, chủ đích trả về 500 để kiểm tra metrics và log; không bật chế độ này trên production.

## Khách hàng
- `GET /api/customers?q=tu-khoa`
- `GET /api/customers/:id`
- `POST /api/customers` — `name` bắt buộc; có thể gửi `company`, `email`, `phone`, `status` (`lead|active|inactive`), `notes`.
- `PUT /api/customers/:id` — cập nhật các trường khách hàng.
- `DELETE /api/customers/:id` — xóa khách hàng cùng liên hệ và lịch sử tương tác của khách hàng đó.

## Liên hệ
- `GET /api/contacts?customerId=:id`
- `POST /api/contacts` — `customerId`, `name` bắt buộc; có thể gửi `role`, `email`, `phone`.
- `PUT /api/contacts/:id` — `customerId`, `name` bắt buộc; các trường còn lại tùy chọn.
- `DELETE /api/contacts/:id`

## Lịch sử tương tác
- `GET /api/interactions?customerId=:id`
- `POST /api/interactions` — `customerId`, `type` (`call|email|meeting|note`), `summary` bắt buộc; có thể gửi `contactId`, `details`, `occurredAt` (ISO-8601).
- `PUT /api/interactions/:id` — cập nhật một bản ghi tương tác hiện có với cùng cấu trúc payload như khi tạo.
- `DELETE /api/interactions/:id`

Các ID là số nguyên dương. Dữ liệu SQL được truyền qua tham số truy vấn, không ghép trực tiếp dữ liệu người dùng vào SQL.
