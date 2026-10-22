# CRM Care — Hệ thống CRM chăm sóc khách hàng

Dự án mẫu hoàn chỉnh theo đề **Hệ thống CRM Chăm sóc Khách hàng**. Stack sử dụng Node.js + Express, PostgreSQL, pgAdmin, Nginx reverse proxy, Prometheus, Grafana, Loki và Promtail.

## 1. Chức năng

- **Khách hàng:** thêm, xem, tìm kiếm, sửa, xóa; lưu công ty, email, điện thoại, ghi chú và trạng thái (tiềm năng/đang hoạt động/ngừng hoạt động).
- **Liên hệ:** quản lý người phụ trách, chức vụ, email, điện thoại; liên kết với khách hàng.
- **Lịch sử tương tác:** ghi nhận cuộc gọi, email, cuộc họp hoặc ghi chú, thời gian, người liên hệ, tóm tắt và chi tiết.
- **Đăng nhập:** JWT có thời hạn 4 giờ; giới hạn 10 lần đăng nhập trong 15 phút.
- **Quan sát hệ thống:** endpoint `/metrics` cho Prometheus; Grafana được cấu hình sẵn dashboard; Winston ghi log JSON và Promtail chuyển log tới Loki.
- **Cơ sở dữ liệu:** PostgreSQL với ràng buộc khóa ngoại, trạng thái hợp lệ và chỉ mục tìm kiếm; pgAdmin dùng để quản trị DB.
- **Triển khai:** Docker Compose, Nginx reverse proxy, health check và GitHub Actions CI.

## 2. Yêu cầu

Cài **Docker Desktop** (Windows/macOS) hoặc Docker Engine + Docker Compose v2 (Linux). Chạy lệnh từ thư mục chứa `docker-compose.yml`. Không cần cài Node.js hoặc PostgreSQL riêng khi chạy bằng Docker.

## 3. Cài đặt và chạy local

1. Giải nén ZIP và mở terminal tại thư mục `crm-customer-care`.
2. Tạo file môi trường:
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
3. Mở `.env` và đổi các mật khẩu. Với môi trường local, có thể giữ `NODE_ENV=development`; trước khi triển khai thật, đổi `NODE_ENV=production`, đặt `JWT_SECRET` ngẫu nhiên dài ít nhất 32 ký tự và đặt lại mọi mật khẩu mẫu.
4. Khởi động toàn bộ stack:

   ```bash
   docker compose up -d --build
   ```

5. Xem trạng thái và log:

   ```bash
   docker compose ps
   docker compose logs -f app
   ```

6. Mở các địa chỉ trên cùng máy:

   | Dịch vụ | Địa chỉ local | Ghi chú |
   |---|---|---|
   | CRM Care | http://localhost:8081 | Giao diện quản lý |
   | pgAdmin | http://localhost:5050 | Quản trị PostgreSQL |
   | Prometheus | http://localhost:9091 | Truy vấn metrics |
   | Grafana | http://localhost:3001 | Dashboard vận hành |
   | Loki | Không public port | Truy cập qua datasource Grafana |

   Các cổng ứng dụng trong `docker-compose.yml` lần lượt là 8081, 5050, 9091 và 3001. Các cổng quản trị được bind vào `127.0.0.1` để tránh công khai trên mạng.

## 4. Tài khoản mặc định khi chưa chỉnh `.env`

Nếu chạy trực tiếp mà **chưa tạo file `.env`**, giá trị mặc định của ứng dụng là:

- CRM: `admin` / `123456`
- pgAdmin: `admin@example.com` / `123456`
- Grafana: `admin` / `123456`
- PostgreSQL: database `crmdb`, user `crmuser`, password `123456`

Đây chỉ là thông tin tiện chạy thử local, **không dùng các mật khẩu này trên hệ thống thật**. Nếu bạn đã sao chép `.env.example` thành `.env`, tài khoản CRM mặc định trong file mẫu là `admin` / `ChangeThis_CRM_Password`; hãy xem các biến `CRM_ADMIN_USER` và `CRM_ADMIN_PASSWORD` nếu đã chỉnh. Các mật khẩu pgAdmin, Grafana và PostgreSQL cũng lấy từ `.env`. Không gửi hoặc commit file `.env` lên GitHub.

### Kết nối PostgreSQL từ pgAdmin

Trong pgAdmin, tạo server mới với:

- **Name:** CRM Local
- **Host name/address:** `db`
- **Port:** `5432`
- **Maintenance database:** giá trị `POSTGRES_DB` (mặc định `crmdb`)
- **Username:** giá trị `POSTGRES_USER` (mặc định `crmuser`)
- **Password:** giá trị `POSTGRES_PASSWORD` trong `.env`

Tên host `db` chỉ dùng trong mạng Docker Compose. Từ ứng dụng quản lý DB trên máy host, không có cổng PostgreSQL public được mở mặc định.

## 5. Dashboard và log

- Grafana tự provision datasource **Prometheus**, **Loki** và dashboard **CRM Care - Tổng quan vận hành**.
- Grafana provision sẵn cảnh báo **HTTP 5xx rate above 5%**: tỷ lệ 5xx vượt 5% trong cửa sổ 5 phút và duy trì điều kiện 5 phút mới gửi email; thông báo được gom theo tên cảnh báo, nhắc lại sau 4 giờ.
- Để bật gửi email, đặt `GRAFANA_SMTP_USER` và `GRAFANA_SMTP_FROM_ADDRESS` thành Gmail gửi, `GRAFANA_ALERT_EMAIL` thành địa chỉ nhận, rồi điền Google App Password (không phải mật khẩu đăng nhập Gmail; bỏ khoảng trắng giữa các nhóm ký tự) vào `GRAFANA_SMTP_PASSWORD` trong `.env`. Bật Xác minh 2 bước trên Google và tạo App Password riêng cho Grafana; không commit `.env` hoặc chia sẻ App Password. Khởi động lại Grafana sau khi sửa:

  ```powershell
  docker compose up -d --force-recreate grafana
  ```

- Có thể kiểm tra SMTP tại Grafana **Alerting → Contact points → CRM Gmail → Test**. Để kiểm thử rule, giữ `NODE_ENV=test` và gửi lỗi liên tục để tỷ lệ 5xx duy trì trên ngưỡng trong 5 phút. Ví dụ PowerShell (khoảng 6 phút 40 giây):

  ```powershell
  for ($i = 1; $i -le 20; $i++) {
    curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8081/__test__/http-500
    Start-Sleep -Seconds 20
  }
  ```

  Sau đó xác nhận alert ở **Alerting → Alert rules** và email nhận được. Chỉ dùng route thử lỗi trong môi trường test; đặt `NODE_ENV` lại về `development` sau khi kiểm thử. Ngưỡng có thể điều chỉnh trong `grafana/provisioning/alerting/alert-rules.yml`; sau khi sửa, khởi động lại Grafana để nạp cấu hình.
- Dashboard gồm lưu lượng HTTP, tỷ lệ lỗi 5xx, độ trễ p50/p95, bộ nhớ heap Node.js, log Nginx (`{job="nginx"}`) và log ứng dụng (`{job="crm-backend"}`).
- Log JSON của ứng dụng và log access/error của Nginx được ghi vào volume dùng chung với Promtail; Promtail chuyển log tới Loki.
- Nếu dashboard chưa có dữ liệu ngay sau khi khởi động, chờ 30–60 giây rồi tải lại. Tạo một vài thao tác trong CRM để phát sinh metrics và log.
- Chạy `docker compose logs -f app nginx promtail loki` để chẩn đoán nếu log không xuất hiện.

### Kiểm thử ghi nhận HTTP 500

Route thử lỗi chỉ được đăng ký khi `NODE_ENV=test`; không bật chế độ này trên môi trường production.

1. Trong `.env`, đặt `NODE_ENV=test`, sau đó khởi động lại backend và các dịch vụ quan sát:

   ```powershell
   docker compose up -d --build app nginx prometheus loki promtail
   ```

2. Gửi một request và xác nhận response có status 500:

   ```powershell
   curl.exe -i http://localhost:8081/__test__/http-500
   ```

3. Sau khi Prometheus scrape (tối đa khoảng 15 giây), mở `http://localhost:9091` và chạy truy vấn:

   ```promql
   crm_http_requests_total{method="GET",route="/__test__/http-500",status="500"}
   ```

   Giá trị counter phải tăng sau mỗi request lỗi. Dashboard cũng có thể hiển thị lỗi 5xx sau khi có đủ mẫu trong cửa sổ thời gian.

4. Trong Grafana **Explore**, chọn datasource Loki, đặt khoảng thời gian bao gồm lúc gửi request (ví dụ **Last 15 minutes**) và chạy LogQL:

   ```logql
   {job="crm-backend"} | json | status="500" | path="/__test__/http-500"
   ```

   `job` lọc nguồn log; các trường `path`, `status` và `timestamp` cho phép thu hẹp theo endpoint, mã phản hồi và thời gian.

5. Đặt `.env` trở lại `NODE_ENV=development` và dựng lại backend để gỡ route thử lỗi:

   ```powershell
   docker compose up -d --build app
   ```

## 6. Bảo mật đã áp dụng

- Helmet security headers, CSP hạn chế script/style từ nguồn lạ, chống nhúng iframe.
- Nginx ẩn phiên bản, giới hạn kích thước request, timeout và giới hạn tốc độ.
- JWT cho các API nghiệp vụ; giới hạn thử đăng nhập và so sánh thông tin đăng nhập theo cách giảm rò rỉ thời gian.
- Kiểm tra dữ liệu ở server và truy vấn SQL có tham số; không nối chuỗi dữ liệu người dùng vào SQL.
- `express.json` giới hạn body 100 KB; rate limit cho thao tác ghi.
- Hạn chế công khai cổng database và công cụ giám sát; các cổng quản trị mặc định chỉ bind localhost.
- Container backend bỏ Linux capabilities không cần thiết, dùng `no-new-privileges`; ứng dụng chạy non-root và filesystem read-only, ngoại trừ volume log và `/tmp`.

**Lưu ý triển khai thực tế:** cấu hình Nginx đi kèm phục vụ HTTP cho demo local. Trước khi đưa ra Internet, cần đặt Nginx sau TLS/HTTPS (ví dụ load balancer hoặc reverse proxy có chứng thư), thay toàn bộ mật khẩu mẫu, dùng secret manager, đặt quy trình backup PostgreSQL và kiểm tra phân quyền người dùng. CRM hiện dùng một tài khoản quản trị chung trong biến môi trường, phù hợp bài tập/demo; hệ thống nhiều người dùng cần bảng tài khoản, mật khẩu băm, phân quyền và quản lý phiên riêng.

## 7. GitHub

1. Tạo repository GitHub mới.
2. Giải nén dự án và chạy `git init`, `git add .`, `git commit -m "Initial CRM Care project"`.
3. Thêm remote repo và `git push -u origin main`.
4. GitHub Actions tại `.github/workflows/ci.yml` tự kiểm tra cú pháp JS và build Docker image trên mỗi lần push/PR.

Không thêm `.env`, mật khẩu thật hay token vào repository. File `.gitignore` đã loại trừ `.env` và log runtime.

## 8. Một số lệnh hữu ích

```bash
# Kiểm tra dịch vụ

docker compose ps

# Theo dõi log toàn bộ stack

docker compose logs -f

# Dừng nhưng giữ dữ liệu

docker compose down

# Dựng lại backend sau khi sửa source

docker compose up -d --build app

# Xóa stack VÀ toàn bộ dữ liệu database/metrics/log đã lưu
# Chỉ chạy nếu chủ ý muốn bắt đầu lại từ đầu!
docker compose down -v
```

`db/init.sql` chỉ chạy tự động khi PostgreSQL khởi tạo volume dữ liệu lần đầu. Nếu sửa schema sau khi đã tạo volume, hãy dùng migration SQL mới hoặc thực hiện migration thủ công; không xóa volume đang chứa dữ liệu thật chỉ để chạy lại init script.

## 9. Cấu trúc thư mục

```text
crm-customer-care/
├── server.js                       # Express API, JWT, validation, metrics, logging
├── public/                         # Giao diện web CRM
├── db/init.sql                     # Schema, indexes, dữ liệu demo
├── nginx/default.conf              # Reverse proxy và hardening headers
├── prometheus/prometheus.yml       # Scrape cấu hình metrics
├── grafana/                        # Datasource provisioning + dashboard
├── loki/config.yml                 # Lưu trữ và truy vấn log
├── promtail/config.yml             # Đọc file log, chuyển vào Loki
├── docker-compose.yml              # Toàn bộ service và network
├── Dockerfile                      # Image Node.js non-root
├── API.md                          # API endpoint và payload
└── .github/workflows/ci.yml        # CI cho GitHub Actions
```
