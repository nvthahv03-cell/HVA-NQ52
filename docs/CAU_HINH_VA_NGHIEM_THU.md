# Hoàn thiện HVA–NQ52 – 27/11/2026 (bản thử nghiệm)
Nguồn: bản QĐ32/2026/QĐ-UBND ngày 13/4/2026, PDF trang 30–37 Mẫu 5A, trang 40–46 Mẫu 02. Mỗi mẫu A gồm 27 tiêu chí lá, 30 điểm; B=35+15+10+10. Các dải B.I của M02 và 5A không giống nhau; không dùng M03 cho lãnh đạo. Mục C: theo dõi riêng, không cộng vào A+B. Giao diện tóm lược, chưa phải nguyên văn hoặc bản in hoàn chỉnh.
## Phân loại biểu mẫu
Máy chủ đọc Script Property NQ52_FORM_PROFILE (JSON đối tượng id tài khoản -> M02/M03/M5A/UNCONFIGURED). Không đưa ID hoặc cấu hình thật lên GitHub. M02 chỉ khi quản trị xác định chức vụ pháp lý; không gán theo TTCM/TTVP. M5A tạm chọn cho nhóm CBQL có vai trò BGH, cần đối chiếu danh sách chính thức. M03 tạm chọn GV/NV còn lại. Không xác định đối tượng hưởng NQ52 từ nhóm tài khoản.
## Rà soát thử nghiệm
Mặc định tắt. Sau khi kiểm thử tài khoản quản lý riêng, đặt Script Property NQ52_REVIEW_REHEARSAL=ON để mở luồng thử: cá nhân yêu cầu rà soát tại Kết quả đánh giá -> người quản lý trực tiếp trong phạm vi quyền nhận xét/trả bổ sung -> BGH ghi nhận dự thảo ý kiến tập thể kèm hồ sơ cuộc họp và tham chiếu biên bản -> DECIDER lưu dự thảo kết quả. Không thay trạng thái DRAFT, không gửi chính thức, không chi trả. Khi nhiệm vụ hoặc nội dung tự khai đổi, dấu vân tay hồ sơ không còn khớp; phải gửi lại. Chưa hỗ trợ thẩm quyền rà soát hồ sơ CBQL, hồ sơ HT phải trình cấp trên.
## Cấu hình trường cần phê duyệt
1. Danh mục nhiệm vụ/sản phẩm theo vị trí, đơn vị tính, cách quy đổi, nguồn EDOS, quy tắc không đếm trùng.
2. Đối tượng áp dụng, chức vụ, quyền đánh giá trực tiếp, cấp có thẩm quyền, người không thuộc diện và ngoại lệ Điều 5; đối chiếu văn bản về nghỉ hè.
3. Lịch đánh giá, biên bản và cơ chế lưu bản chính; xác nhận số lượng, tiến độ, chất lượng, điều kiện xếp loại, tỷ lệ nhóm tương đồng.
4. Tiêu chí đặc thù trường, căn cứ phê duyệt, hiệu lực và phiên bản. Không tự sinh điểm hoặc tiêu chí pháp lý.
5. Kiểm thử toàn trình dữ liệu giả trước khi dùng hồ sơ thật; kiểm tra quyền chéo, đổi dữ liệu làm hết hiệu lực rà soát, bản in, lỗi kết nối, lịch sử.
## Triển khai
Thêm 09_LANH_DAO_RASOAT.gs, cập nhật 01_ROUTER.gs và 02_WORKFLOW.gs; Deploy phiên bản mới trên deployment hiện tại. Giữ CORE, URL, tài khoản, dữ liệu. Chỉ mở chức năng rehearsal bằng property sau kiểm thử. Mẫu 01TKNV bản Word và Mẫu 03 đã có vẫn giữ. Chưa nghiệm thu bản in và vận hành, không tự coi quy chế được phê duyệt.

## Đối chiếu Công văn 1757/SGDĐT-TCCB ngày 24/4/2026
- Mục 2: đơn vị cụ thể hóa tiêu chí và ban hành quy chế. Chưa tìm thấy văn bản quy chế nhà trường đã ký trong lần truy xuất này; không dùng bảng Excel thử nghiệm làm căn cứ thay thế.
- Mục 4: nhóm lãnh đạo quản lý gồm HT/PHT, giám đốc/phó giám đốc trung tâm, trưởng/phó phòng; nhóm không quản lý gồm viên chức GV và NV. M02 chỉ mở khi chức vụ pháp lý thực sự phù hợp.
- Mục 5: tỷ lệ HTXSNV không vượt 20% số HTTNV toàn đơn vị và từng nhóm tương đồng. Nhóm quản lý thuộc thẩm quyền đánh giá của thủ trưởng dưới 5 người có thể chọn một người nếu đủ điều kiện; cần xem đồng thời các điều kiện, không tự làm tròn lên. Hàm nqQuotaReference_ chỉ đối chiếu hạn mức thông thường từ số lượng đã có, chưa dùng để kết luận hồ sơ.
- Mục 7: báo cáo tháng và tờ trình người đứng đầu trước ngày 02 tháng liền kề; tờ trình quý người đứng đầu trước ngày 20 tháng cuối quý. Không tự tạo/nộp tờ trình.
- Cấu hình riêng trong Script Property NQ52_SCHOOL_POLICY dạng JSON, không đưa số định danh hoặc đường dẫn nội bộ lên kho công khai. Trạng thái chỉ xác định có khai căn cứ, không xác thực văn bản hay tự mở kết luận:
```json
{"regulationReference":"","effectiveDate":"","productCatalogueReference":"","eligibilityReference":"","authorityReference":"","assessmentCalendarReference":"","similarGroupsReference":""}
```
- Kết quả kiểm thử giả lập 15 tình huống: tắt chức năng; sai chủ hồ sơ; sai tổ; sai trình tự; trả bổ sung, gửi lại, rà soát, ghi ý kiến tập thể, giới hạn quyền quyết định; thay đổi nhiệm vụ làm cũ hồ sơ; từ chối dùng sai mẫu. Trạng thái gốc DRAFT không đổi. Chưa kiểm thử Apps Script/trình duyệt thực tế.
