/**
 * URL Google Apps Script Web App để đọc/ghi trực tiếp từ Google Sheet.
 * - Dán URL kết thúc bằng `/exec` vào đây sau khi deploy file `apps-script.gs`.
 * - Nếu để trống "", web sẽ dùng dữ liệu mẫu `window.GUEST_LIST` bên dưới.
 */
window.SHEET_API_URL = "https://script.google.com/macros/s/AKfycbx0VHIpcwa_HwJTXBFUk286nVAPJoL79O0Nt_kghr45XHNM3ETzJAqcrEZTQ4FiaqJXQA/exec";

/**
 * Danh sách khách mời dự phòng (khớp cấu trúc cột: SST | Name | Code | Status | Comment)
 */
window.GUEST_LIST = {
  "MINHANH01": {
    sst: "1",
    name: "Nguyễn Minh Anh",
    code: "MINHANH01",
    status: "",
    comment: ""
  },
  "HOANGNAM02": {
    sst: "2",
    name: "Trần Hoàng Nam",
    code: "HOANGNAM02",
    status: "",
    comment: ""
  },
  "THAOVY03": {
    sst: "3",
    name: "Lê Thảo Vy",
    code: "THAOVY03",
    status: "",
    comment: ""
  }
};
