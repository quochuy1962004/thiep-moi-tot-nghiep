/**
 * Google Apps Script — Kết nối Google Sheet với Thiệp Mời Tốt Nghiệp (Đọc & Ghi)
 * Sheet ID: 13Nl3FQiiMSyFJY9cQgAf7xNzpJhAVDbMZa7vyICyJP8
 *
 * Header dòng 1 của Sheet:
 * SST | Name | Code | Status | Comment
 *
 * HƯỚNG DẪN CÀI ĐẶT (chỉ làm 1 lần):
 * 1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ code này vào, bấm Lưu (Ctrl + S).
 * 3. Triển khai (Deploy) -> Triển khai mới (New deployment) -> Ứng dụng web (Web app):
 *    - Thực thi với tư cách: Tôi (Me)
 *    - Ai có quyền truy cập: Bất kỳ ai (Anyone)
 * 4. Copy URL Web App (kết thúc bằng /exec) dán vào `window.SHEET_API_URL` trong file `guests.js`.
 */

const SHEET_ID = "13Nl3FQiiMSyFJY9cQgAf7xNzpJhAVDbMZa7vyICyJP8";

function getTargetSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheets()[0];
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeaderMap_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((h, idx) => {
    const key = String(h || "").trim().toLowerCase();
    if (key) map[key] = idx + 1; // 1-based column index
  });
  return map;
}

/**
 * ĐỌC DATA:
 * - GET ?code=XYZ -> Trả về thông tin 1 khách mời theo cột Code
 * - GET (không có code) -> Trả về toàn bộ danh sách (dùng cho links.html)
 */
function doGet(e) {
  try {
    const sheet = getTargetSheet_();
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return jsonResponse_({ ok: true, guests: {} });
    }

    const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const idxOf = (col) => headers.indexOf(col);

    const codeIdx = idxOf("code");
    if (codeIdx === -1) {
      return jsonResponse_({ ok: false, error: "Thiếu cột 'Code' ở dòng tiêu đề" });
    }

    const sstIdx = idxOf("sst") !== -1 ? idxOf("sst") : idxOf("stt");
    const nameIdx = idxOf("name");
    const statusIdx = idxOf("status");
    const commentIdx = idxOf("comment");

    const guests = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const code = String(row[codeIdx] || "").trim();
      if (!code) continue;

      guests[code] = {
        sst: sstIdx !== -1 ? String(row[sstIdx] || "").trim() : String(r),
        name: nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "",
        code: code,
        status: statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "",
        comment: commentIdx !== -1 ? String(row[commentIdx] || "").trim() : ""
      };
    }

    const reqCode =
      e && e.parameter
        ? String(e.parameter.code || e.parameter.id || "").trim()
        : "";

    if (reqCode) {
      const guest = guests[reqCode] || null;
      return jsonResponse_({ ok: true, code: reqCode, guest: guest });
    }

    return jsonResponse_({ ok: true, guests: guests });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

/**
 * GHI DATA:
 * - POST body JSON: { code: "XYZ", status: "CONFIRMED", comment: "Chúc mừng Huy!" }
 *   Cập nhật cột Status và Comment vào đúng dòng có Code tương ứng.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const targetCode = String(payload.code || payload.id || "").trim();
    if (!targetCode) {
      return jsonResponse_({ ok: false, error: "Thiếu 'Code' khách mời" });
    }

    const sheet = getTargetSheet_();
    const headerMap = getHeaderMap_(sheet);
    const codeCol = headerMap["code"];
    if (!codeCol) {
      return jsonResponse_({ ok: false, error: "Thiếu cột 'Code' trong Google Sheet" });
    }

    const lastRow = sheet.getLastRow();
    let targetRow = -1;
    if (lastRow >= 2) {
      const codeValues = sheet.getRange(2, codeCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < codeValues.length; i++) {
        if (String(codeValues[i][0] || "").trim() === targetCode) {
          targetRow = i + 2;
          break;
        }
      }
    }

    if (targetRow === -1) {
      return jsonResponse_({ ok: false, error: "Không tìm thấy Code: " + targetCode });
    }

    if (headerMap["status"] && payload.status !== undefined) {
      sheet.getRange(targetRow, headerMap["status"]).setValue(String(payload.status));
    }

    const commentVal = payload.comment !== undefined ? payload.comment : payload.note;
    if (headerMap["comment"] && commentVal !== undefined) {
      sheet.getRange(targetRow, headerMap["comment"]).setValue(String(commentVal));
    }

    return jsonResponse_({
      ok: true,
      code: targetCode,
      status: payload.status || "",
      comment: commentVal || ""
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}
