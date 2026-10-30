// ============================================================
//  VKS BROWSER ENGINE v5.2 (Zero-Cache + Anti-Data-Loss Sync)
//  Đồng bộ tự động 2 chiều tức thì với kho lưu trữ riêng tư GitHub
// ============================================================
(function(window) {
  const ENCRYPTED_GH_TOKEN = "111c22332de4e78fbc0f56795fec84b9ce13094f71a6c7b694344e4f1af3ccdfbfed1b3857259ad9";
  const GH_DATA_REPO = "TranVietHoang99/vks-quan-ly-tin-bao";
  const GH_DATA_PATH = "data/vks_database.json";

  function xorDecryptHex(hexStr, pass) {
    const key = pass + "_VKSND_SECRET_KEY_2026";
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes.push(parseInt(hexStr.substr(i, 2), 16));
    }
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      const kCode = key.charCodeAt(i % key.length);
      out += String.fromCharCode(bytes[i] ^ kCode ^ ((i * 31) & 0xff));
    }
    return out;
  }

  function setSyncBadge_(state, text) {
    const el = document.getElementById("cloudSyncBadge");
    if (!el) return;
    if (state === "syncing") {
      el.style.background = "#fef3c7";
      el.style.color = "#b45309";
      el.style.borderColor = "#fde68a";
      el.innerHTML = "🔄 " + (text || "Đang lưu lên Cloud...");
    } else if (state === "error") {
      el.style.background = "#fee2e2";
      el.style.color = "#dc2626";
      el.style.borderColor = "#fecaca";
      el.innerHTML = "⚠️ " + (text || "Chờ đồng bộ (Bấm thử lại)");
    } else {
      el.style.background = "#dcfce7";
      el.style.color = "#15803d";
      el.style.borderColor = "#86efac";
      const nowStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      el.innerHTML = "☁️ " + (text || ("Đã lưu Cloud (" + nowStr + ")"));
    }
  }


const SHEET_NAME     = "DanhSachTinBao";
const SHEET_CHITIEU  = "ChiTieu";
const SHEET_KIENNGHI = "KienNghi";

const HEADERS = [
  "STT","Ngày VKS thụ lý","Ngày CSĐT thụ lý","Thời điểm tính số liệu",
  "Công an xã thụ lý",
  "Phân loại","Loại tội","Ngày xảy ra","Nơi xảy ra","Họ và tên","Địa chỉ cá nhân / Cơ quan tổ chức",
  "Tóm tắt nội dung sự việc","Họ tên Phó viện trưởng thụ lý",
  "Họ tên Kiểm sát viên thụ lý","QĐ gia hạn thời hạn giải quyết","Số ngày gia hạn",
  "Danh sách QĐ tạm đình chỉ / phục hồi",
  "Yêu cầu KT/KKT (loại)","Yêu cầu KT/KKT (số QĐ)","Yêu cầu KT/KKT (ngày QĐ)",
  "Kết quả giải quyết","Ngày TSL kết quả",
  "Ghi chú vụ việc",
  "Hậu quả - Người chết","Hậu quả - Người bị thương",
  "Hậu quả - Thiệt hại tài sản","Hậu quả - Ghi chú khác",
];

const HEADERS_CHITIEU = ["STT","Loại","Tên chỉ tiêu","Số QĐ/VB","Ngày ký","Nội dung","Người thực hiện","Ghi chú"];

const HEADERS_KIENNGHI = [
  "STT","Loại kiến nghị","Số văn bản","Ngày ban hành",
  "Nội dung kiến nghị","Đã có trả lời","Số VB trả lời","Ngày VB trả lời",
  "Cán bộ ban hành","Ghi chú khác"
];

const HEADERS_TAMDINHCHI = [
  "STT", "STT gốc (TinBao#)", "Năm phát sinh", "Loại tội",
  "Họ và tên / Nguồn tin", "Tóm tắt nội dung",
  "Số QĐ tạm đình chỉ", "Ngày QĐ tạm đình chỉ", "Lý do tạm đình chỉ",
  "Thời hiệu TCTNHS (năm)", "Ngày hết thời hiệu",
  "Trạng thái hiện tại", "Ngày phục hồi (nếu có)", "Số QĐ phục hồi",
  "Kết quả giải quyết",
  "Ghi chú",
];

const DEFAULT_PHO_VT_LIST = [
  "Nguyễn Thị Chiến","Lê Minh Tuyết","Đàm Trung Kiên","Đinh Thế Huy"
];
const DEFAULT_KSV_LIST = [
  "Nguyễn Trung Kiên","Bùi Thị Mai","Trần Ngọc Diệp","Lê Hiệp Thương",
  "Đinh Thị Liên","Đinh Thị Thu Huyền","Trần Thu Hằng","Lê Thùy Linh",
  "Nguyễn Trần Hiếu","Bùi Thị Thu Hà","Nguyễn Vũ Trung","Trần Việt Hoàng"
];


  let db = {
    updatedAt: 0,
    revision: 0,
    properties: { ACTIVE_YEAR: "2026" },
    staff: {
      phoVTList: [...DEFAULT_PHO_VT_LIST],
      ksvList: [...DEFAULT_KSV_LIST]
    },
    auth: { username: "admin", password: "vks123456" },
    cloud: { supabaseUrl: "", supabaseKey: "", enabled: true, lastSync: null },
    sheets: {
      "DanhSachTinBao_2026": [],
      "ChiTieu_2026": [],
      "KienNghi_2026": [],
      "TamDinhChi": []
    }
  };

  let supabaseClient = null;
  function initSupabase_() {}

  let _unlockedGhToken = sessionStorage.getItem("vks_gh_token") || localStorage.getItem("vks_gh_token") || "";
  let _lastFileSha = "";
  let _syncInFlight = false;
  let _syncPending = false;
  let _hasLoadedData = false;

  function loadFromLocalStorage_() {
    try {
      const raw = localStorage.getItem("vks_browser_db");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sheets) {
          db = { ...db, ...parsed };
          const activeRows = db.sheets["DanhSachTinBao_" + (db.properties?.ACTIVE_YEAR || "2026")] || [];
          if (activeRows.length > 0) _hasLoadedData = true;
        }
      }
    } catch (e) {}
  }
  loadFromLocalStorage_();

  // Cảnh báo nếu người dùng đóng tab ngay trong lúc đang đẩy dữ liệu lên Cloud
  window.addEventListener("beforeunload", function(e) {
    if (_syncInFlight || localStorage.getItem("vks_dirty_sync") === "1") {
      e.preventDefault();
      e.returnValue = "Dữ liệu đang được đồng bộ lên Cloud, vui lòng chờ 1 giây...";
    }
  });

  async function pushToGitHubCloudNow() {
    if (!_unlockedGhToken || !_hasLoadedData) return { success: false, message: "Chưa sẵn sàng đẩy Cloud" };
    if (_syncInFlight) {
      _syncPending = true;
      return { success: true, message: "Đang xếp hàng đồng bộ..." };
    }
    _syncInFlight = true;
    setSyncBadge_("syncing", "Đang lưu lên Cloud...");

    try {
      const apiUrl = "https://api.github.com/repos/" + GH_DATA_REPO + "/contents/" + GH_DATA_PATH;
      // Luôn lấy SHA mới nhất từ commit đầu nhánh main để tránh lỗi 409 Conflict và tránh cache
      const refRes = await fetch("https://api.github.com/repos/" + GH_DATA_REPO + "/commits/main?t=" + Date.now(), {
        headers: {
          "Authorization": "Bearer " + _unlockedGhToken,
          "Cache-Control": "no-cache"
        },
        cache: "no-store"
      });
      let refParam = "?t=" + Date.now();
      if (refRes.ok) {
        const refData = await refRes.json();
        if (refData && refData.sha) refParam = "?ref=" + refData.sha;
      }
      const getRes = await fetch(apiUrl + refParam, {
        headers: {
          "Authorization": "Bearer " + _unlockedGhToken,
          "Cache-Control": "no-cache"
        },
        cache: "no-store"
      });
      if (getRes.ok) {
        const info = await getRes.json();
        if (info && info.sha) _lastFileSha = info.sha;
      }

      const jsonStr = JSON.stringify(db, null, 2);
      const bytes = new TextEncoder().encode(jsonStr);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const contentB64 = btoa(bin);
      const ts = new Date().toLocaleString("vi-VN");

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + _unlockedGhToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Web Auto-Sync VKS data (" + ts + ")",
          content: contentB64,
          ...(_lastFileSha ? { sha: _lastFileSha } : {})
        })
      });

      if (!putRes.ok) {
        throw new Error("GitHub HTTP " + putRes.status);
      }

      const putData = await putRes.json();
      if (putData.content && putData.content.sha) {
        _lastFileSha = putData.content.sha;
      }
      db.cloud.lastSync = new Date().toISOString();
      localStorage.setItem("vks_browser_db", JSON.stringify(db));
      localStorage.setItem("vks_dirty_sync", "0");
      setSyncBadge_("ok");
      return { success: true, message: "Đã lưu lên Cloud thành công!" };
    } catch (e) {
      console.warn("Auto-Sync error:", e);
      setSyncBadge_("error", "Chưa lưu Cloud (Bấm thử lại)");
      return { success: false, message: e.message };
    } finally {
      _syncInFlight = false;
      if (_syncPending) {
        _syncPending = false;
        pushToGitHubCloudNow();
      }
    }
  }

  async function pullFromGitHubCloud(forceOverwrite) {
    if (!_unlockedGhToken) return { success: false, message: "Chưa mở khóa kết nối Cloud." };

    // NẾU trên máy đang có dữ liệu mới vừa nhập mà chưa kịp đẩy lên Cloud -> ĐẨY LÊN TRƯỚC, TUYỆT ĐỐI KHÔNG GHI ĐÈ!
    if (!forceOverwrite && localStorage.getItem("vks_dirty_sync") === "1" && _hasLoadedData) {
      await pushToGitHubCloudNow();
      return { success: true, message: "Đã đồng bộ dữ liệu vừa nhập lên Cloud!" };
    }

    setSyncBadge_("syncing", "Đang kiểm tra Cloud...");
    try {
      // B1: Lấy SHA của commit mới nhất trên nhánh main (vượt qua 100% bộ nhớ đệm 60s của GitHub CDN)
      const refRes = await fetch("https://api.github.com/repos/" + GH_DATA_REPO + "/commits/main?t=" + Date.now(), {
        headers: {
          "Authorization": "Bearer " + _unlockedGhToken,
          "Cache-Control": "no-cache"
        },
        cache: "no-store"
      });
      let refParam = "?t=" + Date.now();
      if (refRes.ok) {
        const refData = await refRes.json();
        if (refData && refData.sha) refParam = "?ref=" + refData.sha;
      }

      // B2: Tải nội dung file theo đúng SHA commit mới nhất
      const apiUrl = "https://api.github.com/repos/" + GH_DATA_REPO + "/contents/" + GH_DATA_PATH + refParam;
      const res = await fetch(apiUrl, {
        headers: {
          "Authorization": "Bearer " + _unlockedGhToken,
          "Accept": "application/vnd.github.v3+json",
          "Cache-Control": "no-cache"
        },
        cache: "no-store"
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const meta = await res.json();
      _lastFileSha = meta.sha || "";
      const binStr = atob((meta.content || "").replace(/\s/g, ""));
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const jsonText = new TextDecoder("utf-8").decode(bytes);
      const parsed = JSON.parse(jsonText);

      if (parsed && parsed.sheets) {
        const localTs = +(db.updatedAt || 0);
        const cloudTs = +(parsed.updatedAt || 0);

        // Nếu dữ liệu trong trình duyệt mới hơn trên Cloud -> không ghi đè mà đẩy bản mới hơn lên Cloud
        if (!forceOverwrite && _hasLoadedData && localTs > cloudTs) {
          await pushToGitHubCloudNow();
          return { success: true, message: "Đã giữ dữ liệu mới nhất và đồng bộ lên Cloud!" };
        }

        db = {
          ...db,
          ...parsed,
          properties: { ...db.properties, ...(parsed.properties || {}) },
          staff: {
            phoVTList: parsed.staff?.phoVTList || [...DEFAULT_PHO_VT_LIST],
            ksvList: parsed.staff?.ksvList || [...DEFAULT_KSV_LIST]
          },
          sheets: parsed.sheets
        };
        _hasLoadedData = true;
        db.cloud.lastSync = new Date().toISOString();
        localStorage.setItem("vks_browser_db", JSON.stringify(db));
        localStorage.setItem("vks_dirty_sync", "0");
        setSyncBadge_("ok", "Đã đồng bộ Cloud");
        return { success: true, updated: cloudTs > localTs, message: "Đã đồng bộ dữ liệu mới nhất từ GitHub Cloud!" };
      }
      return { success: false, message: "Dữ liệu trên Cloud trống." };
    } catch (e) {
      setSyncBadge_("error", "Lỗi mạng Cloud");
      return { success: false, message: "Lỗi đồng bộ Cloud: " + e.message };
    }
  }

  function saveLocalDB() {
    db.updatedAt = Date.now();
    db.revision = (+(db.revision || 0)) + 1;
    _hasLoadedData = true;
    try {
      localStorage.setItem("vks_browser_db", JSON.stringify(db));
      localStorage.setItem("vks_dirty_sync", "1");
    } catch (e) {}
    // Đẩy ngay lập tức lên GitHub Cloud (không chờ 1.5s)
    pushToGitHubCloudNow();
  }

  async function pullFromSupabase() {
    return await pullFromGitHubCloud(true);
  }

  async function loginOnWeb(username, password) {
    const u = String(username || "admin").trim();
    const p = String(password || "");
    const candidateToken = xorDecryptHex(ENCRYPTED_GH_TOKEN, p);
    if (candidateToken && (candidateToken.startsWith("gho_") || candidateToken.startsWith("ghp_") || candidateToken.startsWith("github_pat_"))) {
      _unlockedGhToken = candidateToken;
      localStorage.setItem("vks_gh_token", _unlockedGhToken);
      await pullFromGitHubCloud();
      return { success: true, token: "web_cloud_session", systemInfo: getSystemInfo() };
    }
    if (u === (db.auth?.username || "admin") && p === (db.auth?.password || "vks123456")) {
      return { success: true, token: "web_local_session", systemInfo: getSystemInfo() };
    }
    return { success: false, message: "Mật khẩu hoặc tài khoản không đúng!" };
  }

  // Tự động kiểm tra dữ liệu mới khi người dùng chuyển lại tab hoặc mỗi 25 giây
  window.addEventListener("focus", async function() {
    if (_unlockedGhToken && !_syncInFlight && localStorage.getItem("vks_dirty_sync") !== "1") {
      const r = await pullFromGitHubCloud();
      if (r && r.updated && typeof window.loadData === "function") {
        window.loadData();
      }
    }
  });

// ── Tiện ích Ngày tháng ─────────────────────────────────────
function fmtDate_(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseD_(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  const str = String(s).trim();
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

// ── Chuẩn hóa "Thời điểm tính số liệu" ─────────────────────
function normThoiDiem_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return "Tháng " + mm + "/" + v.getFullYear();
  }
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  let m = s.match(/^Tháng\s+(\d{1,2})\/(\d{4})$/i);
  if (m) return "Tháng " + ("0" + m[1]).slice(-2) + "/" + m[2];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return "Tháng " + ("0" + m[2]).slice(-2) + "/" + m[3];
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return "Tháng " + ("0" + m[1]).slice(-2) + "/" + m[2];
  return s;
}

// ── Quản lý tên Sheet theo năm hiện hành ───────────────────
function getActiveYear_() {
  return db.properties.ACTIVE_YEAR || "";
}

function getActiveSheetName_() {
  const p = getActiveYear_();
  if (p) {
    const name = "DanhSachTinBao_" + p;
    if (db.sheets[name]) return name;
  }
  if (db.sheets[SHEET_NAME]) return SHEET_NAME;
  // Tự tạo nếu chưa có
  const target = p ? "DanhSachTinBao_" + p : SHEET_NAME;
  if (!db.sheets[target]) db.sheets[target] = [];
  return target;
}

function getActiveChitieuName_() {
  const p = getActiveYear_();
  if (p) {
    const name = "ChiTieu_" + p;
    if (db.sheets[name]) return name;
  }
  if (db.sheets[SHEET_CHITIEU]) return SHEET_CHITIEU;
  const target = p ? "ChiTieu_" + p : SHEET_CHITIEU;
  if (!db.sheets[target]) db.sheets[target] = [];
  return target;
}

function getActiveKienNghiName_() {
  const p = getActiveYear_();
  if (p) {
    const name = "KienNghi_" + p;
    if (db.sheets[name]) return name;
  }
  if (db.sheets[SHEET_KIENNGHI]) return SHEET_KIENNGHI;
  const target = p ? "KienNghi_" + p : SHEET_KIENNGHI;
  if (!db.sheets[target]) db.sheets[target] = [];
  return target;
}

function ensureSheet_(name) {
  if (!db.sheets[name]) {
    db.sheets[name] = [];
  }
  return db.sheets[name];
}

// ── Parse chuỗi kết quả gộp → {loai, so, ngay} ───────────
function parseKQ_(raw) {
  const s = (raw || "").trim();
  if (!s) return { loai: "", so: "", ngay: "" };
  let loai = "";
  if (/hết thời hiệu|thời hiệu truy cứu/i.test(s))        loai = "Không khởi tố - Hết thời hiệu";
  else if (/không khởi tố|\bkkt\b/i.test(s))              loai = "Không khởi tố";
  else if (/khởi tố vụ án|^khởi tố|\bkt\b/i.test(s))      loai = "Khởi tố";
  const so_m = s.match(/số\s+([^\s,ngàytháng]+)/i);
  const so   = so_m ? so_m[1].trim() : "";
  let ngay = "";
  const fullM = s.match(/ngày\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (fullM) {
    ngay = `${fullM[1].padStart(2,"0")}/${fullM[2].padStart(2,"0")}/${fullM[3]}`;
  } else {
    const monM = s.match(/tháng\s+(\d{1,2})[\/\-](\d{4})/i);
    if (monM) {
      ngay = `01/${monM[1].padStart(2,"0")}/${monM[2]}`;
    } else {
      const bareM = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (bareM) ngay = `${bareM[1].padStart(2,"0")}/${bareM[2].padStart(2,"0")}/${bareM[3]}`;
    }
  }
  return { loai, so, ngay };
}

// ── Tính trạng thái tin báo ────────────────────────────────
function computeTrangThai(rec) {
  const kq = parseKQ_(rec["Kết quả giải quyết"]).loai;
  if (kq === "Không khởi tố - Hết thời hiệu") return "kkthethoihieu";
  if (kq) return "dagiaiquyet";

  const raw = (rec["Danh sách QĐ tạm đình chỉ / phục hồi"] || "").trim();
  if (!raw) return "dangcho";
  let list = [];
  try { list = JSON.parse(raw); } catch (e) { return "dangcho"; }
  if (!list.length) return "dangcho";

  let lastTDDate = null, lastPHDate = null;
  list.forEach(item => {
    const d = parseD_(item.ngay); if (!d) return;
    if (item.loai === "tamdinhchi") { if (!lastTDDate || d > lastTDDate) lastTDDate = d; }
    else if (item.loai === "phuchoi") { if (!lastPHDate || d > lastPHDate) lastPHDate = d; }
  });

  if (lastPHDate && (!lastTDDate || lastPHDate > lastTDDate)) return "phuchoi";
  if (lastTDDate && (!lastPHDate || lastTDDate > lastPHDate)) return "tamdinh";
  return "dangcho";
}

// ── Records (DanhSachTinBao) ───────────────────────────────
function getAllRecords() {
  const name = getActiveSheetName_();
  const rows = ensureSheet_(name);
  return rows.map((row, idx) => {
    const obj = { rowIndex: idx + 2 };
    HEADERS.forEach(h => {
      const v = row[h];
      if (h === "Thời điểm tính số liệu") {
        obj[h] = normThoiDiem_(v);
      } else {
        obj[h] = v instanceof Date ? fmtDate_(v) : (v !== null && v !== undefined ? String(v) : "");
      }
    });
    obj["STT"] = String(idx + 1);
    obj["_trangThai"] = computeTrangThai(obj);
    return obj;
  });
}

// ── Đồng bộ Yêu cầu KT từ tin báo → ChiTieu ──────────────
function syncYeuCauKT_(record) {
  const loai = (record["Yêu cầu KT/KKT (loại)"] || "").trim();
  const so   = (record["Yêu cầu KT/KKT (số QĐ)"] || "").trim();
  const ngay = (record["Yêu cầu KT/KKT (ngày QĐ)"] || "").trim();
  const stt  = String(record["STT"] || "");
  const key  = "[TinBao#" + stt + "]";

  const ctName = getActiveChitieuName_();
  const ctRows = ensureSheet_(ctName);

  let existingIdx = ctRows.findIndex(r => String(r["Ghi chú"] || "").includes(key));

  if (!loai || loai === "Không khởi tố") {
    if (existingIdx >= 0) {
      ctRows.splice(existingIdx, 1);
      reindexArray_(ctRows);
    }
    return;
  }

  const nd = (record["Tóm tắt nội dung sự việc"] || "").substring(0, 100);
  const newObj = {
    "STT": existingIdx >= 0 ? ctRows[existingIdx]["STT"] : String(ctRows.length + 1),
    "Loại": "Yêu cầu khởi tố",
    "Tên chỉ tiêu": "",
    "Số QĐ/VB": so,
    "Ngày ký": ngay,
    "Nội dung": nd || ("Yêu cầu KT - Tin báo #" + stt),
    "Người thực hiện": record["Họ tên Kiểm sát viên thụ lý"] || "",
    "Ghi chú": key
  };

  if (existingIdx >= 0) {
    ctRows[existingIdx] = newObj;
  } else {
    ctRows.push(newObj);
  }
}

function reindexArray_(arr) {
  arr.forEach((item, i) => {
    item["STT"] = String(i + 1);
  });
}

function addRecord(record) {
  const name = getActiveSheetName_();
  const rows = ensureSheet_(name);
  const stt = rows.length + 1;
  const newRow = {};
  HEADERS.forEach(h => {
    if (h === "STT") newRow[h] = String(stt);
    else if (h === "Thời điểm tính số liệu") newRow[h] = normThoiDiem_(record[h] || "");
    else newRow[h] = record[h] !== undefined && record[h] !== null ? String(record[h]) : "";
  });
  rows.push(newRow);
  syncYeuCauKT_(newRow);
  saveLocalDB();
  return { success: true };
}

function updateRecord(rowIndex, record) {
  const name = getActiveSheetName_();
  const rows = ensureSheet_(name);
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) {
    return { success: false, message: "Không tìm thấy bản ghi cần cập nhật." };
  }
  const stt = idx + 1;
  const updatedRow = {};
  HEADERS.forEach(h => {
    if (h === "STT") updatedRow[h] = String(stt);
    else if (h === "Thời điểm tính số liệu") updatedRow[h] = normThoiDiem_(record[h] || "");
    else updatedRow[h] = record[h] !== undefined && record[h] !== null ? String(record[h]) : "";
  });
  rows[idx] = updatedRow;
  syncYeuCauKT_(updatedRow);
  saveLocalDB();
  return { success: true };
}

function deleteRecord(rowIndex) {
  const name = getActiveSheetName_();
  const rows = ensureSheet_(name);
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) {
    return { success: false, message: "Không tìm thấy bản ghi cần xóa." };
  }
  const sttNum = +(rows[idx]["STT"] || (idx + 1));
  rows.splice(idx, 1);
  reindexArray_(rows);

  // Đồng bộ sheet ChiTieu sau khi đánh lại STT
  if (sttNum) {
    const ctRows = ensureSheet_(getActiveChitieuName_());
    for (let i = ctRows.length - 1; i >= 0; i--) {
      const gc = String(ctRows[i]["Ghi chú"] || "");
      const m = gc.match(/\[TinBao#(\d+)\]/);
      if (!m) continue;
      const n = +m[1];
      if (n === sttNum) {
        ctRows.splice(i, 1);
      } else if (n > sttNum) {
        ctRows[i]["Ghi chú"] = gc.replace(/\[TinBao#\d+\]/, "[TinBao#" + (n - 1) + "]");
      }
    }
    reindexArray_(ctRows);
  }
  saveLocalDB();
  return { success: true };
}

// ── Chỉ tiêu ───────────────────────────────────────────────
function getAllChiTieu() {
  const rows = ensureSheet_(getActiveChitieuName_());
  return rows.map((row, idx) => {
    const obj = { rowIndex: idx + 2 };
    HEADERS_CHITIEU.forEach(h => {
      const v = row[h];
      obj[h] = v instanceof Date ? fmtDate_(v) : String(v || "");
    });
    obj["STT"] = String(idx + 1);
    return obj;
  });
}

function addChiTieu(record) {
  const rows = ensureSheet_(getActiveChitieuName_());
  const newRow = {};
  HEADERS_CHITIEU.forEach(h => {
    newRow[h] = h === "STT" ? String(rows.length + 1) : String(record[h] || "");
  });
  rows.push(newRow);
  saveLocalDB();
  return { success: true };
}

function updateChiTieu(rowIndex, record) {
  const rows = ensureSheet_(getActiveChitieuName_());
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return { success: false, message: "Không tìm thấy chỉ tiêu." };
  const newRow = {};
  HEADERS_CHITIEU.forEach(h => {
    newRow[h] = h === "STT" ? String(idx + 1) : String(record[h] || "");
  });
  rows[idx] = newRow;
  saveLocalDB();
  return { success: true };
}

function deleteChiTieu(rowIndex) {
  const rows = ensureSheet_(getActiveChitieuName_());
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return { success: false, message: "Không tìm thấy chỉ tiêu." };
  rows.splice(idx, 1);
  reindexArray_(rows);
  saveLocalDB();
  return { success: true };
}

// ── Kiến nghị ──────────────────────────────────────────────
function getAllKienNghi() {
  const rows = ensureSheet_(getActiveKienNghiName_());
  return rows.map((row, idx) => {
    const obj = { rowIndex: idx + 2 };
    HEADERS_KIENNGHI.forEach(h => {
      const v = row[h];
      obj[h] = v instanceof Date ? fmtDate_(v) : String(v || "");
    });
    obj["STT"] = String(idx + 1);
    return obj;
  });
}

function addKienNghi(record) {
  const rows = ensureSheet_(getActiveKienNghiName_());
  const newRow = {};
  HEADERS_KIENNGHI.forEach(h => {
    newRow[h] = h === "STT" ? String(rows.length + 1) : String(record[h] || "");
  });
  rows.push(newRow);
  saveLocalDB();
  return { success: true };
}

function updateKienNghi(rowIndex, record) {
  const rows = ensureSheet_(getActiveKienNghiName_());
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return { success: false, message: "Không tìm thấy kiến nghị." };
  const newRow = {};
  HEADERS_KIENNGHI.forEach(h => {
    newRow[h] = h === "STT" ? String(idx + 1) : String(record[h] || "");
  });
  rows[idx] = newRow;
  saveLocalDB();
  return { success: true };
}

function deleteKienNghi(rowIndex) {
  const rows = ensureSheet_(getActiveKienNghiName_());
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return { success: false, message: "Không tìm thấy kiến nghị." };
  rows.splice(idx, 1);
  reindexArray_(rows);
  saveLocalDB();
  return { success: true };
}

// ── Thống kê tổng quan ─────────────────────────────────────
function getStats() {
  const records = getAllRecords();
  const khoi_to       = records.filter(r => parseKQ_(r["Kết quả giải quyết"]).loai === "Khởi tố").length;
  const khong_khoi_to = records.filter(r => parseKQ_(r["Kết quả giải quyết"]).loai === "Không khởi tố").length;
  const kkt_het_thoi_hieu = records.filter(r => r["_trangThai"] === "kkthethoihieu").length;
  const tam_dinh  = records.filter(r => r["_trangThai"] === "tamdinh").length;
  const phuc_hoi  = records.filter(r => r["_trangThai"] === "phuchoi").length;
  const chua_gq   = records.filter(r => r["_trangThai"] === "dangcho").length;
  const ltMap = {};
  records.forEach(r => {
    const lt = (r["Loại tội"] || "Chưa PL").trim();
    ltMap[lt] = (ltMap[lt] || 0) + 1;
  });
  return { total: records.length, khoi_to, khong_khoi_to, kkt_het_thoi_hieu, tam_dinh, phuc_hoi, chua_gq, ltMap };
}

// Kiểm tra 1 vụ có đang TĐC tại một thời điểm mốc cụ thể hay không
function isTdcAtMoment_(r, mocDate) {
  const raw = (r["Danh sách QĐ tạm đình chỉ / phục hồi"] || "").trim();
  if (!raw) return false;
  let list;
  try { list = JSON.parse(raw); } catch (e) { return false; }
  if (!list.length) return false;
  let lastTDDate = null, lastPHDate = null;
  list.forEach(item => {
    const d = parseD_(item.ngayTSL) || parseD_(item.ngay);
    if (!d || d > mocDate) return;
    if (item.loai === "tamdinhchi") { if (!lastTDDate || d > lastTDDate) lastTDDate = d; }
    else if (item.loai === "phuchoi") { if (!lastPHDate || d > lastPHDate) lastPHDate = d; }
  });
  return !!(lastTDDate && (!lastPHDate || lastTDDate > lastPHDate));
}

// ── BỘ LỌC THỐNG KÊ ──
function locTinBaoTK_(records, loc) {
  if (!loc) return records;
  const eq = (a, b) => String(a || "").trim() === String(b || "").trim();
  const noi = String(loc.noiXayRa || "").trim().toLowerCase();
  return records.filter(r => {
    if (loc.phanLoai && !eq(r["Phân loại"], loc.phanLoai)) return false;
    if (loc.loaiToi  && !eq(r["Loại tội"], loc.loaiToi)) return false;
    if (loc.ksv      && !eq(r["Họ tên Kiểm sát viên thụ lý"], loc.ksv)) return false;
    if (loc.pvt      && !eq(r["Họ tên Phó viện trưởng thụ lý"], loc.pvt)) return false;
    if (loc.cax === "co"    && r["Công an xã thụ lý"] !== "Có") return false;
    if (loc.cax === "khong" && r["Công an xã thụ lý"] === "Có") return false;
    if (noi && String(r["Nơi xảy ra"] || "").toLowerCase().indexOf(noi) < 0) return false;
    return true;
  });
}

function locTheoCanBo_(list, col, loc) {
  if (!loc || !loc.ksv) return list;
  const ten = String(loc.ksv).trim().toLowerCase();
  return list.filter(o => String(o[col] || "").toLowerCase().indexOf(ten) >= 0);
}

function locLabel_(loc) {
  if (!loc) return "";
  const p = [];
  if (loc.phanLoai) p.push("Phân loại: " + loc.phanLoai);
  if (loc.loaiToi)  p.push("Loại tội: " + loc.loaiToi);
  if (loc.ksv)      p.push("KSV: " + loc.ksv);
  if (loc.pvt)      p.push("PVT: " + loc.pvt);
  if (loc.cax === "co")    p.push("Công an xã thụ lý");
  if (loc.cax === "khong") p.push("Không do Công an xã thụ lý");
  if (String(loc.noiXayRa || "").trim()) p.push("Nơi xảy ra: " + String(loc.noiXayRa).trim());
  return p.join("; ");
}

// ── ĐỐI SOÁT ──
function doiSoat_(records, g) {
  function dem(arr) {
    const m = new Map();
    arr.forEach(r => m.set(r, (m.get(r) || 0) + 1));
    return m;
  }
  const M = {};
  Object.keys(g).forEach(k => { M[k] = dem(g[k]); });
  const c = (k, r) => M[k].get(r) || 0;
  const out = [];
  records.forEach(r => {
    const vao = c("ton", r) + c("moi", r) + c("ph", r);
    const ra  = c("kt", r) + c("kkt", r) + (c("kktHTH", r) - c("kktHTHtuTDC", r)) + c("td", r);
    const cl  = c("conLai", r);
    if (vao - ra === cl) return;
    const kqRaw = String(r["Kết quả giải quyết"] || "").trim();
    const p = [];
    if (kqRaw && !parseKQ_(kqRaw).loai) p.push('Kết quả "' + kqRaw + '" không nhận dạng được là KT/KKT');
    else if (kqRaw && !parseKQ_(kqRaw).ngay && !String(r["Ngày TSL kết quả"] || "").trim()) p.push("Kết quả không có ngày");
    const vaoTxt = [];
    if (c("ton", r)) vaoTxt.push("Cũ");
    if (c("moi", r)) vaoTxt.push("Mới");
    if (c("ph", r))  vaoTxt.push("PH×" + c("ph", r));
    const raTxt = [];
    if (c("kt", r))  raTxt.push("KT");
    if (c("kkt", r)) raTxt.push("KKT");
    if (c("kktHTH", r) && !c("kktHTHtuTDC", r)) raTxt.push("KKT hết TH");
    if (c("td", r))  raTxt.push("TĐC×" + c("td", r));
    p.push("Vào: " + (vaoTxt.join(", ") || "không") + " | Ra: " + (raTxt.join(", ") || "không") + " | Còn lại cuối kỳ: " + (cl ? "có" : "không"));
    out.push({ stt: r["STT"], loaitoi: r["Loại tội"] || "", chenh: (vao - ra) - cl, lyDo: p.join(" — ") });
  });
  return out;
}

function getThongKeThang(thang, nam) {
  return getThongKeKhoang(thang, nam, thang, nam);
}

// ── THỐNG KÊ THEO NGÀY ──
function getThongKeNgay(ngayDauStr, ngayCuoiStr, loc) {
  try {
    const records = locTinBaoTK_(getAllRecords(), loc);
    const s0 = parseD_(ngayDauStr);
    let s1 = parseD_(ngayCuoiStr);
    if (!s0 || !s1) return { error: "Ngày không hợp lệ. Định dạng: dd/MM/yyyy" };
    s1 = new Date(s1.getFullYear(), s1.getMonth(), s1.getDate(), 23, 59, 59);

    function parseGiaHanNgay_(s) {
      const raw = String(s || "").trim();
      if (!raw) return null;
      let m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      m = raw.match(/tháng\s+(\d{1,2})[\/\-](\d{4})/i);
      if (m) return new Date(+m[2], +m[1] - 1, 1);
      return null;
    }

    const ton = [], tdcTon = [], moi = [], kt = [], kkt = [], kktHTH = [], kktHTHtuTDC = [], td = [], ph = [], conLai = [], tdcConLai = [], giaHan = [];

    records.forEach(r => {
      const ngayVKS = parseD_(r["Ngày VKS thụ lý"]);
      const kqParsed = parseKQ_(r["Kết quả giải quyết"]);
      const kq = kqParsed.loai;
      const kqNgay = parseD_(kqParsed.ngay);
      const kqNgayGQ = kq ? (parseD_(r["Ngày TSL kết quả"]) || kqNgay) : null;

      if (ngayVKS && ngayVKS < s0) {
        const isTdcAtS0 = isTdcAtMoment_(r, new Date(s0.getTime() - 1));
        if (!kqNgayGQ) {
          if (isTdcAtS0) tdcTon.push(r); else ton.push(r);
        } else if (kqNgayGQ >= s0) {
          if (isTdcAtS0) tdcTon.push(r); else ton.push(r);
        }
      }

      if (ngayVKS && ngayVKS >= s0 && ngayVKS <= s1) {
        moi.push(r);
      }

      try {
        const list = JSON.parse(r["Danh sách QĐ tạm đình chỉ / phục hồi"] || "[]");
        list.forEach(q => {
          const qdDate = parseD_(q.ngayTSL) || parseD_(q.ngay);
          if (!qdDate) return;
          if (q.loai === "phuchoi"    && qdDate >= s0 && qdDate <= s1) ph.push(r);
          if (q.loai === "tamdinhchi" && qdDate >= s0 && qdDate <= s1) td.push(r);
        });
      } catch (e) {}

      if (kqNgayGQ && kqNgayGQ >= s0 && kqNgayGQ <= s1) {
        if (kq === "Khởi tố") kt.push(r);
        else if (kq === "Không khởi tố") kkt.push(r);
        else if (kq === "Không khởi tố - Hết thời hiệu") {
          kktHTH.push(r);
          if (isTdcAtMoment_(r, new Date(kqNgayGQ.getTime() - 1))) kktHTHtuTDC.push(r);
        }
      }

      const ghNgay = parseGiaHanNgay_(r["QĐ gia hạn thời hạn giải quyết"]);
      if (ghNgay && ghNgay >= s0 && ghNgay <= s1) giaHan.push(r);

      const thuLyTruocCuoiKy = ngayVKS && ngayVKS <= s1;
      const isTdcAtS1 = isTdcAtMoment_(r, s1);
      if (!thuLyTruocCuoiKy) {
        // không tính
      } else if (kqNgayGQ && kqNgayGQ <= s1) {
        // đã GQ
      } else if (isTdcAtS1) {
        tdcConLai.push(r);
      } else {
        conLai.push(r);
      }
    });

    let chiTieuTrongKy = getAllChiTieu().filter(ct => {
      const d = parseD_(ct["Ngày ký"]);
      return d && d >= s0 && d <= s1;
    });
    let kienNghiTrongKy = getAllKienNghi().filter(kn => {
      const d = parseD_(kn["Ngày ban hành"]);
      return d && d >= s0 && d <= s1;
    });

    const tongThuLy = ton.length + moi.length + ph.length;
    const tongGQ = kt.length + kkt.length + td.length;
    const conLaiTinh = conLai.length;

    const lechList = doiSoat_(records, { ton, moi, ph, kt, kkt, kktHTH, kktHTHtuTDC, td, conLai });
    chiTieuTrongKy  = locTheoCanBo_(chiTieuTrongKy, "Người thực hiện", loc);
    kienNghiTrongKy = locTheoCanBo_(kienNghiTrongKy, "Cán bộ ban hành", loc);

    function toList(arr, extra) {
      return arr.map(r => {
        const o = {
          stt: r["STT"], loaitoi: r["Loại tội"],
          ngay: parseKQ_(r["Kết quả giải quyết"]).ngay,
          ngayXayRa: r["Ngày xảy ra"] || "", noiXayRa: r["Nơi xảy ra"] || "",
          trangThai: r["_trangThai"],
          isCax: r["Công an xã thụ lý"] === "Có",
        };
        if (extra) extra(o, r);
        return o;
      });
    }

    return {
      kyLabel: ngayDauStr + " → " + ngayCuoiStr,
      locLabel: locLabel_(loc),
      lechList,
      cheDo: "ngay",
      tongThuLy,
      tonThangTruoc: ton.length,
      moiThuLy: moi.length,
      moiCax: moi.filter(r => r["Công an xã thụ lý"] === "Có").length,
      phucHoiTrongThang: ph.length,
      tongGiaiQuyet: tongGQ,
      khoiTo: kt.length,
      khongKhoiTo: kkt.length,
      kktHetThoiHieu: kktHTH.length,
      kktHTHtuTDC: kktHTHtuTDC.length,
      tamDinhTrongThang: td.length,
      conLai: conLaiTinh,
      tdcTonDauKy: tdcTon.length,
      tdcConLai: tdcConLai.length,
      khoiToList:        toList(kt),
      khongKhoiToList:   toList(kkt),
      kktHetThoiHieuList: toList(kktHTH),
      tamDinhList:       toList(td),
      phucHoiList:       toList(ph),
      conLaiList:        toList(conLai),
      tdcConLaiList:     toList(tdcConLai),
      tonList:           toList(ton),
      moiList:           toList(moi),
      giaHanTrongKy:     giaHan.length,
      giaHanList:        toList(giaHan, (o, r) => {
        const m = String(r["QĐ gia hạn thời hạn giải quyết"] || "").match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
        o.giaHanNgay = m ? m[1].replace(/-/g, "/") : (r["QĐ gia hạn thời hạn giải quyết"] || "");
        o.giaHanSoNgay = r["Số ngày gia hạn"] || "";
      }),
      chiTieuTrongKy,
      kienNghiTrongKy,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ── THỐNG KÊ KHOẢNG THÁNG ──
function getThongKeKhoang(thangDau, namDau, thangCuoi, namCuoi, loc) {
  try {
    thangDau = +thangDau; namDau = +namDau; thangCuoi = +thangCuoi; namCuoi = +namCuoi;
    const records = locTinBaoTK_(getAllRecords(), loc);
    const s0 = new Date(namDau, thangDau - 1, 1);
    const s1 = new Date(namCuoi, thangCuoi, 0, 23, 59, 59);

    function parseThoiDiemTSL_(s) {
      if (!s) return null;
      const m = String(s).match(/Tháng\s+(\d{1,2})\/(\d{4})/);
      if (m) return { thang: +m[1], nam: +m[2] };
      return null;
    }
    function inRangeThangNam_(thang, nam) {
      const v = nam * 12 + thang;
      const vStart = namDau * 12 + thangDau;
      const vEnd = namCuoi * 12 + thangCuoi;
      return v >= vStart && v <= vEnd;
    }
    function isBeforeRange_(thang, nam) {
      const v = nam * 12 + thang;
      const vStart = namDau * 12 + thangDau;
      return v < vStart;
    }

    const ton = [], tdcTon = [], moi = [], kt = [], kkt = [], kktHTH = [], kktHTHtuTDC = [], td = [], ph = [], conLai = [], tdcConLai = [], giaHan = [];

    function parseGiaHanNgay_(s) {
      const raw = String(s || "").trim();
      if (!raw) return null;
      let m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      m = raw.match(/tháng\s+(\d{1,2})[\/\-](\d{4})/i);
      if (m) return new Date(+m[2], +m[1] - 1, 1);
      return null;
    }

    records.forEach(r => {
      const ngayVKS = parseD_(r["Ngày VKS thụ lý"]);
      const tsl = parseThoiDiemTSL_(r["Thời điểm tính số liệu"]);
      const kqParsed = parseKQ_(r["Kết quả giải quyết"]);
      const kq = kqParsed.loai;
      const kqNgay = parseD_(kqParsed.ngay);
      const kqNgayGQ = kq ? (parseD_(r["Ngày TSL kết quả"]) || kqNgay) : null;

      const truocKy = tsl ? isBeforeRange_(tsl.thang, tsl.nam) : (ngayVKS && ngayVKS < s0);
      if (truocKy) {
        const isTdcAtS0 = isTdcAtMoment_(r, new Date(s0.getTime() - 1));
        if (!kqNgayGQ) {
          if (isTdcAtS0) tdcTon.push(r);
          else ton.push(r);
        } else if (kqNgayGQ >= s0) {
          if (isTdcAtS0) tdcTon.push(r);
          else ton.push(r);
        }
      }

      const trongKy = tsl ? inRangeThangNam_(tsl.thang, tsl.nam) : (ngayVKS && ngayVKS >= s0 && ngayVKS <= s1);
      if (trongKy) {
        moi.push(r);
      }

      try {
        const list = JSON.parse(r["Danh sách QĐ tạm đình chỉ / phục hồi"] || "[]");
        list.forEach(q => {
          const qdDate = parseD_(q.ngayTSL) || parseD_(q.ngay);
          if (!qdDate) return;
          if (q.loai === "phuchoi"    && qdDate >= s0 && qdDate <= s1) ph.push(r);
          if (q.loai === "tamdinhchi" && qdDate >= s0 && qdDate <= s1) td.push(r);
        });
      } catch (e) {}

      if (kqNgayGQ && kqNgayGQ >= s0 && kqNgayGQ <= s1) {
        if (kq === "Khởi tố") kt.push(r);
        else if (kq === "Không khởi tố") kkt.push(r);
        else if (kq === "Không khởi tố - Hết thời hiệu") {
          kktHTH.push(r);
          if (isTdcAtMoment_(r, new Date(kqNgayGQ.getTime() - 1))) kktHTHtuTDC.push(r);
        }
      }

      const ghNgay = parseGiaHanNgay_(r["QĐ gia hạn thời hạn giải quyết"]);
      if (ghNgay && ghNgay >= s0 && ghNgay <= s1) {
        giaHan.push(r);
      }

      const thuLyTruocCuoiKy = tsl
        ? (tsl.nam * 12 + tsl.thang) <= (namCuoi * 12 + thangCuoi)
        : (ngayVKS && ngayVKS <= s1);
      const isTdcAtS1 = isTdcAtMoment_(r, s1);
      if (!thuLyTruocCuoiKy) {
        // không tính
      } else if (kqNgayGQ && kqNgayGQ <= s1) {
        // đã GQ
      } else if (isTdcAtS1) {
        tdcConLai.push(r);
      } else {
        conLai.push(r);
      }
    });

    let chiTieuTrongKy = getAllChiTieu().filter(ct => {
      const d = parseD_(ct["Ngày ký"]);
      return d && d >= s0 && d <= s1;
    });
    let kienNghiTrongKy = getAllKienNghi().filter(kn => {
      const d = parseD_(kn["Ngày ban hành"]);
      return d && d >= s0 && d <= s1;
    });

    const lechList = doiSoat_(records, { ton, moi, ph, kt, kkt, kktHTH, kktHTHtuTDC, td, conLai });
    chiTieuTrongKy  = locTheoCanBo_(chiTieuTrongKy, "Người thực hiện", loc);
    kienNghiTrongKy = locTheoCanBo_(kienNghiTrongKy, "Cán bộ ban hành", loc);

    function toList(arr, extra) {
      return arr.map(r => {
        const o = {
          stt: r["STT"], loaitoi: r["Loại tội"],
          ngay: parseKQ_(r["Kết quả giải quyết"]).ngay,
          ngayXayRa: r["Ngày xảy ra"] || "", noiXayRa: r["Nơi xảy ra"] || "",
          trangThai: r["_trangThai"],
          isCax: r["Công an xã thụ lý"] === "Có",
        };
        if (extra) extra(o, r);
        return o;
      });
    }

    const moiCax = moi.filter(r => r["Công an xã thụ lý"] === "Có").length;
    const phCax  = ph.filter(r => r["Công an xã thụ lý"] === "Có").length;
    const tongThuLy = ton.length + moi.length + ph.length;
    const tongGQ = kt.length + kkt.length + td.length;
    const conLaiTinh = conLai.length;

    return {
      thangDau, namDau, thangCuoi, namCuoi,
      locLabel: locLabel_(loc),
      lechList,
      tongThuLy,
      tonThangTruoc:     ton.length,
      tdcTonDauKy:       tdcTon.length,
      moiThuLy:          moi.length,
      moiCax,
      phucHoiTrongThang: ph.length,
      phCax,
      tongGiaiQuyet:     tongGQ,
      khoiTo:            kt.length,
      khongKhoiTo:       kkt.length,
      kktHetThoiHieu:    kktHTH.length,
      kktHTHtuTDC:       kktHTHtuTDC.length,
      tamDinhTrongThang: td.length,
      conLai:            conLaiTinh,
      tdcConLai:         tdcConLai.length,
      khoiToList:        toList(kt),
      khongKhoiToList:   toList(kkt),
      kktHetThoiHieuList:toList(kktHTH),
      tamDinhList:       toList(td),
      phucHoiList:       toList(ph),
      conLaiList:        toList(conLai),
      tdcConLaiList:     toList(tdcConLai),
      tonList:           toList(ton),
      moiList:           toList(moi),
      giaHanTrongKy:     giaHan.length,
      giaHanList:        toList(giaHan, (o, r) => {
        const m = String(r["QĐ gia hạn thời hạn giải quyết"] || "").match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
        o.giaHanNgay = m ? m[1].replace(/-/g, "/") : (r["QĐ gia hạn thời hạn giải quyết"] || "");
        o.giaHanSoNgay = r["Số ngày gia hạn"] || "";
      }),
      chiTieuTrongKy,
      kienNghiTrongKy,
    };
  } catch (e) {
    return { error: e.message, thangDau, namDau, thangCuoi, namCuoi };
  }
}

// ── Quản lý danh sách Cán bộ (Phó VT & KSV) ────────────────
function getPhoVTList() {
  return db.staff?.phoVTList || DEFAULT_PHO_VT_LIST;
}
function getKSVList() {
  return db.staff?.ksvList || DEFAULT_KSV_LIST;
}
function getAllStaffList() {
  return [...getPhoVTList(), ...getKSVList()];
}
function updateStaffLists(phoVTList, ksvList) {
  if (Array.isArray(phoVTList)) db.staff.phoVTList = phoVTList.map(s => String(s).trim()).filter(Boolean);
  if (Array.isArray(ksvList))   db.staff.ksvList   = ksvList.map(s => String(s).trim()).filter(Boolean);
  saveLocalDB();
  return {
    success: true,
    phoVTList: db.staff.phoVTList,
    ksvList: db.staff.ksvList,
    allStaff: getAllStaffList()
  };
}

function getActiveYear() {
  return getActiveYear_();
}

function getAvailableYears() {
  const years = new Set();
  const active = getActiveYear_();
  if (active) years.add(String(active));
  Object.keys(db.sheets).forEach(k => {
    const m = k.match(/_(\d{4})$/);
    if (m) years.add(m[1]);
  });
  return Array.from(years).sort((a, b) => (+b) - (+a));
}

function setActiveYear(year) {
  const y = String(year).trim();
  if (!y) return { success: false, message: "Năm không hợp lệ." };
  db.properties.ACTIVE_YEAR = y;
  ensureSheet_("DanhSachTinBao_" + y);
  ensureSheet_("ChiTieu_" + y);
  ensureSheet_("KienNghi_" + y);
  saveLocalDB();
  return { success: true, activeYear: y, message: "Đã chuyển sang năm làm việc " + y };
}

function getSystemInfo() {
  return {
    activeYear: getActiveYear_(),
    sheetName:  getActiveSheetName_(),
    availableYears: getAvailableYears(),
    cloudEnabled: !!(db.cloud && db.cloud.enabled),
    lastSync: db.cloud?.lastSync || null
  };
}

function getInitialBundle() {
  return {
    records: getAllRecords(),
    chiTieu: getAllChiTieu(),
    kienNghi: getAllKienNghi(),
    phoVTList: getPhoVTList(),
    ksvList: getKSVList(),
    allStaff: getAllStaffList(),
    systemInfo: getSystemInfo()
  };
}

// ── Kết thúc năm ───────────────────────────────────────────
function ketThucNam() {
  const currentYear = getActiveYear_();
  const nowYear = new Date().getFullYear();
  const archiveYear = currentYear || String(nowYear);
  const nextYear    = String(Number(archiveYear) + 1);

  const oldTinBao   = getActiveSheetName_();
  const oldChiTieu  = getActiveChitieuName_();
  const oldKienNghi = getActiveKienNghiName_();

  const archTinBao   = "DanhSachTinBao_" + archiveYear;
  const archChiTieu  = "ChiTieu_"        + archiveYear;
  const archKienNghi = "KienNghi_"       + archiveYear;

  const newTinBao   = "DanhSachTinBao_" + nextYear;
  const newChiTieu  = "ChiTieu_"        + nextYear;
  const newKienNghi = "KienNghi_"       + nextYear;

  if (oldTinBao !== archTinBao && db.sheets[oldTinBao]) {
    db.sheets[archTinBao] = db.sheets[oldTinBao];
    delete db.sheets[oldTinBao];
  }
  if (oldChiTieu !== archChiTieu && db.sheets[oldChiTieu]) {
    db.sheets[archChiTieu] = db.sheets[oldChiTieu];
    delete db.sheets[oldChiTieu];
  }
  if (oldKienNghi !== archKienNghi && db.sheets[oldKienNghi]) {
    db.sheets[archKienNghi] = db.sheets[oldKienNghi];
    delete db.sheets[oldKienNghi];
  }

  const archRows = db.sheets[archTinBao] || [];
  const chuaGQRows = archRows
    .filter(row => !String(row["Kết quả giải quyết"] || "").trim())
    .map((row, idx) => ({
      ...row,
      "STT": String(idx + 1),
      "Thời điểm tính số liệu": "Năm trước chuyển qua"
    }));

  db.sheets[newTinBao]   = chuaGQRows;
  db.sheets[newChiTieu]  = [];
  db.sheets[newKienNghi] = [];
  db.properties.ACTIVE_YEAR = nextYear;

  saveLocalDB();
  return {
    success: true,
    archiveYear,
    nextYear,
    chuaGQCount: chuaGQRows.length,
    message: "Đã kết thúc năm " + archiveYear + ". Chuyển " + chuaGQRows.length + " tin chưa GQ sang năm " + nextYear + "."
  };
}

// ── Khởi tạo / Đồng bộ sheet "TamDinhChi" ─────────────────
function khoiTaoSheetTamDinhChi() {
  const SHEET_TDC = "TamDinhChi";
  const existingRows = ensureSheet_(SHEET_TDC);
  const existingKeys = new Set(existingRows.map(r => String(r["STT gốc (TinBao#)"] || "")));

  let rowsToAdd = [];
  let countFound = 0;

  Object.keys(db.sheets).forEach(name => {
    if (!name.startsWith("DanhSachTinBao")) return;
    const rows = db.sheets[name] || [];
    rows.forEach(row => {
      const sttGoc = name + "#" + String(row["STT"] || "");
      const tdphRaw = row["Danh sách QĐ tạm đình chỉ / phục hồi"] || "";
      if (!tdphRaw) return;
      let list = [];
      try { list = JSON.parse(tdphRaw); } catch (e) { return; }
      if (!list.length) return;

      let lastTD = null, lastPH = null, lastTDDate = null, lastPHDate = null;
      list.forEach(q => {
        const d = parseD_(q.ngay);
        if (!d) return;
        if (q.loai === "tamdinhchi" && (!lastTDDate || d > lastTDDate)) { lastTD = q; lastTDDate = d; }
        else if (q.loai === "phuchoi" && (!lastPHDate || d > lastPHDate)) { lastPH = q; lastPHDate = d; }
      });
      if (!lastTD) return;
      countFound++;

      const ngayTD = lastTD.ngay || "";
      const thoiHieuNam = lastTD.thoiHieu || "";
      let ngayHetTH = "";
      if (ngayTD && thoiHieuNam) {
        const m = ngayTD.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) {
          const d = new Date(+m[3] + (+thoiHieuNam), +m[2] - 1, +m[1]);
          ngayHetTH = fmtDate_(d);
        }
      }

      const namPhatSinh = row["Thời điểm tính số liệu"] === "Năm trước chuyển qua"
        ? "Năm trước" : (name.match(/_(\d{4})$/) ? name.match(/_(\d{4})$/)[1] : "");

      const kqGQ = String(row["Kết quả giải quyết"] || "").trim();
      let trangThaiHienTai;
      if (kqGQ) {
        trangThaiHienTai = kqGQ.match(/hết thời hiệu/i) ? "KKT hết thời hiệu"
          : kqGQ.match(/không khởi tố|kkt/i) ? "Không khởi tố"
          : "Khởi tố";
      } else if (lastPHDate && (!lastTDDate || lastPHDate > lastTDDate)) {
        trangThaiHienTai = "Đã phục hồi";
      } else {
        trangThaiHienTai = "Đang tạm đình chỉ";
      }

      const newTdcObj = {
        "STT": "",
        "STT gốc (TinBao#)": sttGoc,
        "Năm phát sinh": namPhatSinh,
        "Loại tội": row["Loại tội"] || "",
        "Họ và tên / Nguồn tin": row["Họ và tên"] || row["Địa chỉ cá nhân / Cơ quan tổ chức"] || "",
        "Tóm tắt nội dung": row["Tóm tắt nội dung sự việc"] || "",
        "Số QĐ tạm đình chỉ": lastTD.so || "",
        "Ngày QĐ tạm đình chỉ": ngayTD,
        "Lý do tạm đình chỉ": lastTD.lydo || "",
        "Thời hiệu TCTNHS (năm)": thoiHieuNam,
        "Ngày hết thời hiệu": ngayHetTH,
        "Trạng thái hiện tại": trangThaiHienTai,
        "Ngày phục hồi (nếu có)": lastPH ? (lastPH.ngay || "") : "",
        "Số QĐ phục hồi": lastPH ? (lastPH.so || "") : "",
        "Kết quả giải quyết": kqGQ,
        "Ghi chú": ""
      };

      if (existingKeys.has(sttGoc)) {
        // Cập nhật dòng đã có
        const idx = existingRows.findIndex(r => String(r["STT gốc (TinBao#)"]) === sttGoc);
        if (idx >= 0) {
          newTdcObj["STT"] = existingRows[idx]["STT"];
          newTdcObj["Ghi chú"] = existingRows[idx]["Ghi chú"] || "";
          existingRows[idx] = newTdcObj;
        }
      } else {
        rowsToAdd.push(newTdcObj);
      }
    });
  });

  if (rowsToAdd.length > 0) {
    existingRows.push(...rowsToAdd);
  }
  reindexArray_(existingRows);
  saveLocalDB();

  return {
    success: true,
    countFound,
    addedCount: rowsToAdd.length,
    message: `Sheet "TamDinhChi" đã được tạo/cập nhật. Tìm thấy ${countFound} tin đang/đã tạm đình chỉ. Đã thêm ${rowsToAdd.length} dòng mới.`
  };
}

// ── In Sổ thụ lý tin báo, tố giác tội phạm — A3 ngang ───────
function getSoTinBaoHTML(thangDau, thangCuoi, nam) {
  const records = getAllRecords();
  let filtered = records;

  if (thangDau && thangCuoi && nam) {
    const s0 = new Date(nam, thangDau - 1, 1);
    const s1 = new Date(nam, thangCuoi, 0, 23, 59, 59);
    filtered = records.filter(r => {
      const d = parseD_(r["Ngày VKS thụ lý"]);
      return d && d >= s0 && d <= s1;
    });
  }

  filtered.sort((a, b) => (+a["STT"] || 0) - (+b["STT"] || 0));

  function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function fmtTdph(raw, loaiCanLay) {
    if (!raw) return "";
    let list = [];
    try { list = JSON.parse(raw); } catch(e) { return ""; }
    const items = list.filter(q => q.loai === loaiCanLay);
    if (!items.length) return "";
    return items.map(q => "Số " + (q.so||"?") + " ngày " + (q.ngay||"?")).join("<br>");
  }

  const rows = filtered.map(r => {
    const nguoiTin = (r["Họ và tên"] || r["Địa chỉ cá nhân / Cơ quan tổ chức"] || "");
    const diaChi   = r["Địa chỉ cá nhân / Cơ quan tổ chức"] || "";
    const nguoiTinFull = [nguoiTin, diaChi].filter(x => x && x !== nguoiTin).join(" - ") || nguoiTin;

    const ycVKS = [];
    if ((r["Yêu cầu KT/KKT (loại)"]||"").trim()) {
      ycVKS.push(esc(r["Yêu cầu KT/KKT (loại)"]) +
        (r["Yêu cầu KT/KKT (số QĐ)"] ? " - Số " + esc(r["Yêu cầu KT/KKT (số QĐ)"]) : "") +
        (r["Yêu cầu KT/KKT (ngày QĐ)"] ? " ngày " + esc(r["Yêu cầu KT/KKT (ngày QĐ)"]) : ""));
    }

    const ghRaw = (r["QĐ gia hạn thời hạn giải quyết"] || "").trim();
    const ghText = ghRaw ? esc(ghRaw) + (r["Số ngày gia hạn"] ? " (" + esc(r["Số ngày gia hạn"]) + " ngày)" : "") : "";

    const tdcText = fmtTdph(r["Danh sách QĐ tạm đình chỉ / phục hồi"], "tamdinhchi");
    const phText  = fmtTdph(r["Danh sách QĐ tạm đình chỉ / phục hồi"], "phuchoi");
    const kqRaw   = (r["Kết quả giải quyết"] || "").trim();
    const tomTatFull = esc(r["Tóm tắt nội dung sự việc"]);

    return "<tr>" +
      "<td class='c nowrap'>" + esc(r["STT"]) + "</td>" +
      "<td class='c nowrap'>" + esc(r["Ngày VKS thụ lý"]) + "</td>" +
      "<td class='l'>" + esc(nguoiTinFull) + "</td>" +
      "<td class='l'>" + tomTatFull + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + esc(r["Họ tên Kiểm sát viên thụ lý"]) + "</td>" +
      "<td class='l'>" + ycVKS.join("<br>") + "</td>" +
      "<td class='l'>" + ghText + "</td>" +
      "<td class='l'>" + tdcText + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + phText + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + ycVKS.join("<br>") + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + esc(kqRaw) + "</td>" +
      "<td class='l'>" + esc(r["Ghi chú vụ việc"]) + "</td>" +
      "</tr>";
  }).join("");

  return "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
    "<title>Sổ thụ lý tin báo, tố giác tội phạm</title>" +
    "<style>" +
    "@page { size: A3 landscape; margin: 1cm; }" +
    "* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
    "body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin:0; }" +
    "table { width:100%; border-collapse: collapse; table-layout: fixed; }" +
    "thead { display: table-header-group; }" +
    "tbody { display: table-row-group; }" +
    "tr { page-break-inside: auto; break-inside: auto; }" +
    "th, td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 10.5pt; line-height: 1.35; word-wrap: break-word; }" +
    "th { background:#e8e8e8; font-weight:bold; text-align:center; vertical-align:middle; font-size: 9.5pt; line-height: 1.3; }" +
    "tr.colnum td { text-align:center; font-size:8.5pt; padding:2px 4px; background:#f3f3f3; font-style:italic; }" +
    "td.c { text-align:center; }" +
    "td.c.nowrap { text-align:center; white-space:nowrap; }" +
    "td.l { text-align:justify; text-justify:inter-word; }" +
    "td.nowrap { white-space:nowrap; }" +
    ".no-print { margin: 10px 0; text-align:center; display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; }" +
    ".no-print button { padding:8px 18px; font-size:11.5pt; background:#1d4ed8; color:#fff; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold; }" +
    "@media print { .no-print { display:none; } }" +
    "</style>" +
    "<script>" +
    "function dlDoc(fn){var c=document.documentElement.cloneNode(true);c.querySelectorAll('.no-print,script').forEach(function(e){e.remove()});var h=\"<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>@page Section1{size:42cm 29.7cm;mso-page-orientation:landscape;margin:1cm;}div.Section1{page:Section1;}</style>\"+c.querySelector('head').innerHTML+\"</head><body><div class='Section1'>\"+c.querySelector('body').innerHTML+\"</div></body></html>\";var b=new Blob(['\\ufeff',h],{type:'application/msword;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.doc';a.click();}" +
    "function dlHtml(fn){var b=new Blob(['\\ufeff',document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.html';a.click();}" +
    "function dlPdf(fn,btn){var orig=btn.innerText;btn.innerText='⏳ Đang tạo PDF...';btn.disabled=true;var base=(window.opener&&window.opener.location)?window.opener.location.origin:'http://localhost:3000';fetch(base+'/api/export-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:document.documentElement.outerHTML,filename:fn+'.pdf'})}).then(function(r){if(!r.ok)throw new Error('Lỗi tạo PDF');return r.blob();}).then(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.pdf';a.click();btn.innerText=orig;btn.disabled=false;}).catch(function(e){alert(e.message);btn.innerText=orig;btn.disabled=false;});}" +
    "</script></head><body>" +
    "<div class='no-print'>" +
    "<button onclick='window.print()'>🖨️ In Sổ</button>" +
    "<button style='background:#dc2626' onclick=\"dlPdf('So_Thu_Ly_Tin_Bao',this)\">📕 Tải file PDF (.pdf)</button>" +
    "<button style='background:#15803d' onclick=\"dlDoc('So_Thu_Ly_Tin_Bao')\">📥 Tải file Word (.doc)</button>" +
    "<button style='background:#0369a1' onclick=\"dlHtml('So_Thu_Ly_Tin_Bao')\">💾 Tải file (.html)</button>" +
    "<span style='font-size:11pt;color:#666;margin-left:8px'>Khung tiêu đề tự lặp mọi trang. Tin dài sẽ được viết tiếp sang trang sau — giống sổ giấy.</span></div>" +
    "<table id='soTable'><thead><tr>" +
    "<th style='width:34px;white-space:nowrap'>STT</th>" +
    "<th style='width:82px;white-space:nowrap'>Ngày VKS<br>thụ lý</th>" +
    "<th style='width:130px'>Họ và tên, địa chỉ cá nhân, cơ quan, tổ chức<br>cung cấp tin báo, tố giác tội phạm</th>" +
    "<th style='width:280px'>Tóm tắt nội dung<br>sự việc</th>" +
    "<th style='width:88px'>Họ và tên, địa chỉ người,<br>pháp nhân bị tố giác</th>" +
    "<th style='width:72px'>Họ tên Kiểm sát viên<br>thụ lý</th>" +
    "<th style='width:74px'>Yêu cầu của<br>Viện kiểm sát</th>" +
    "<th style='width:84px'>QĐ gia hạn thời hạn giải quyết<br>nguồn tin về tội phạm</th>" +
    "<th style='width:84px'>QĐ tạm đình chỉ việc giải quyết<br>nguồn tin về tội phạm</th>" +
    "<th style='width:70px'>QĐ hủy bỏ QĐ tạm đình chỉ việc<br>giải quyết nguồn tin về tội phạm</th>" +
    "<th style='width:80px'>QĐ phục hồi việc giải quyết tin báo,<br>tố giác tội phạm, kiến nghị khởi tố</th>" +
    "<th style='width:54px'>QĐ giải quyết tranh chấp<br>về thẩm quyền</th>" +
    "<th style='width:78px'>Thông báo: Kiểm sát Quyết định khởi tố/<br>Không khởi tố/Tạm đình chỉ giải quyết tố giác, tin báo</th>" +
    "<th style='width:78px'>Yêu cầu Khởi tố vụ án/Không khởi tố/<br>Hủy bỏ QĐ khởi tố vụ án hình sự</th>" +
    "<th style='width:58px'>Kết quả thực hiện<br>yêu cầu của VKS</th>" +
    "<th style='width:84px'>Kết quả giải quyết<br>(Khởi tố; Không khởi tố)</th>" +
    "<th style='width:54px'>Ghi chú</th>" +
    "</tr>" +
    "<tr class='colnum'>" +
    Array.from({length:17}, (_, i) => "<td>(" + (i+1) + ")</td>").join("") +
    "</tr>" +
    "</thead><tbody>" +
    rows +
    "</tbody></table>" +
    "</body></html>";
}

// ═══ IN SỔ TĐC — chỉ các vụ đã từng tạm đình chỉ, đánh STT riêng từ 1 ═══
function getSoTDCHTML() {
  const records = getAllRecords();
  const filtered = records.filter(r => {
    try {
      const list = JSON.parse(r["Danh sách QĐ tạm đình chỉ / phục hồi"] || "[]");
      return list.some(q => q.loai === "tamdinhchi");
    } catch(e) { return false; }
  });
  filtered.sort((a, b) => (+a["STT"] || 0) - (+b["STT"] || 0));

  function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function fmtTdph(raw, loaiCanLay) {
    if (!raw) return "";
    let list = []; try { list = JSON.parse(raw); } catch(e) { return ""; }
    const items = list.filter(q => q.loai === loaiCanLay);
    if (!items.length) return "";
    return items.map(q => "Số " + (q.so||"?") + " ngày " + (q.ngay||"?")).join("<br>");
  }

  const rows = filtered.map((r, idx) => {
    const sttMoi = idx + 1;
    const sttGoc = r["STT"];
    const nguoiTin = r["Họ và tên"] || r["Địa chỉ cá nhân / Cơ quan tổ chức"] || "";
    const diaChi = r["Địa chỉ cá nhân / Cơ quan tổ chức"] || "";
    const nguoiTinFull = [nguoiTin, diaChi].filter(x => x && x !== nguoiTin).join(" - ") || nguoiTin;
    const ycVKS = [];
    if ((r["Yêu cầu KT/KKT (loại)"]||"").trim()) {
      ycVKS.push(esc(r["Yêu cầu KT/KKT (loại)"]) +
        (r["Yêu cầu KT/KKT (số QĐ)"] ? " - Số " + esc(r["Yêu cầu KT/KKT (số QĐ)"]) : "") +
        (r["Yêu cầu KT/KKT (ngày QĐ)"] ? " ngày " + esc(r["Yêu cầu KT/KKT (ngày QĐ)"]) : ""));
    }
    const ghRaw = (r["QĐ gia hạn thời hạn giải quyết"] || "").trim();
    const ghText = ghRaw ? esc(ghRaw) + (r["Số ngày gia hạn"] ? " (" + esc(r["Số ngày gia hạn"]) + " ngày)" : "") : "";
    const tdcText = fmtTdph(r["Danh sách QĐ tạm đình chỉ / phục hồi"], "tamdinhchi");
    const phText  = fmtTdph(r["Danh sách QĐ tạm đình chỉ / phục hồi"], "phuchoi");
    const kqRaw = (r["Kết quả giải quyết"] || "").trim();
    const ghiChu = (r["Ghi chú vụ việc"] || "").trim();
    const gcFull = "Sổ chính #" + sttGoc + (ghiChu ? "<br>" + esc(ghiChu) : "");

    return "<tr>" +
      "<td class='c nowrap'>" + sttMoi + "</td>" +
      "<td class='c nowrap'>" + esc(r["Ngày VKS thụ lý"]) + "</td>" +
      "<td class='l'>" + esc(nguoiTinFull) + "</td>" +
      "<td class='l'>" + esc(r["Tóm tắt nội dung sự việc"]) + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + esc(r["Họ tên Kiểm sát viên thụ lý"]) + "</td>" +
      "<td class='l'>" + ycVKS.join("<br>") + "</td>" +
      "<td class='l'>" + ghText + "</td>" +
      "<td class='l'>" + tdcText + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + phText + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + ycVKS.join("<br>") + "</td>" +
      "<td class='l'></td>" +
      "<td class='l'>" + esc(kqRaw) + "</td>" +
      "<td class='l'>" + gcFull + "</td>" +
      "</tr>";
  }).join("");

  return "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
    "<title>Sổ Tạm Đình Chỉ</title>" +
    "<style>" +
    "@page { size: A3 landscape; margin: 1cm; }" +
    "* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
    "body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin:0; }" +
    "table { width:100%; border-collapse: collapse; table-layout: fixed; }" +
    "thead { display: table-header-group; }" +
    "tbody { display: table-row-group; }" +
    "tr { page-break-inside: auto; break-inside: auto; }" +
    "th, td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; font-size: 10.5pt; line-height: 1.35; word-wrap: break-word; }" +
    "th { background:#e8e8e8; font-weight:bold; text-align:center; vertical-align:middle; font-size: 9.5pt; line-height: 1.3; }" +
    "tr.colnum td { text-align:center; font-size:8.5pt; padding:2px 4px; background:#f3f3f3; font-style:italic; }" +
    "td.c { text-align:center; } td.c.nowrap { text-align:center; white-space:nowrap; }" +
    "td.l { text-align:justify; text-justify:inter-word; }" +
    ".no-print { margin: 10px 0; text-align:center; display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; }" +
    ".no-print button { padding:8px 18px; font-size:11.5pt; background:#7c3aed; color:#fff; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold; }" +
    "@media print { .no-print { display:none; } }" +
    "</style>" +
    "<script>" +
    "function dlDoc(fn){var c=document.documentElement.cloneNode(true);c.querySelectorAll('.no-print,script').forEach(function(e){e.remove()});var h=\"<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>@page Section1{size:42cm 29.7cm;mso-page-orientation:landscape;margin:1cm;}div.Section1{page:Section1;}</style>\"+c.querySelector('head').innerHTML+\"</head><body><div class='Section1'>\"+c.querySelector('body').innerHTML+\"</div></body></html>\";var b=new Blob(['\\ufeff',h],{type:'application/msword;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.doc';a.click();}" +
    "function dlHtml(fn){var b=new Blob(['\\ufeff',document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.html';a.click();}" +
    "function dlPdf(fn,btn){var orig=btn.innerText;btn.innerText='⏳ Đang tạo PDF...';btn.disabled=true;var base=(window.opener&&window.opener.location)?window.opener.location.origin:'http://localhost:3000';fetch(base+'/api/export-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:document.documentElement.outerHTML,filename:fn+'.pdf'})}).then(function(r){if(!r.ok)throw new Error('Lỗi tạo PDF');return r.blob();}).then(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn+'.pdf';a.click();btn.innerText=orig;btn.disabled=false;}).catch(function(e){alert(e.message);btn.innerText=orig;btn.disabled=false;});}" +
    "</script></head><body>" +
    "<div class='no-print'>" +
    "<button onclick='window.print()'>🖨️ In Sổ TĐC</button>" +
    "<button style='background:#dc2626' onclick=\"dlPdf('So_Tam_Dinh_Chi',this)\">📕 Tải file PDF (.pdf)</button>" +
    "<button style='background:#15803d' onclick=\"dlDoc('So_Tam_Dinh_Chi')\">📥 Tải file Word (.doc)</button>" +
    "<button style='background:#0369a1' onclick=\"dlHtml('So_Tam_Dinh_Chi')\">💾 Tải file (.html)</button>" +
    "<span style='font-size:11pt;color:#666;margin-left:8px'>" + filtered.length + " vụ đã từng tạm đình chỉ — đánh số riêng từ 1</span></div>" +
    "<table><thead><tr>" +
    "<th style='width:34px'>STT</th>" +
    "<th style='width:82px'>Ngày VKS<br>thụ lý</th>" +
    "<th style='width:130px'>Họ và tên, địa chỉ cá nhân, cơ quan, tổ chức<br>cung cấp tin báo, tố giác tội phạm</th>" +
    "<th style='width:280px'>Tóm tắt nội dung<br>sự việc</th>" +
    "<th style='width:88px'>Họ và tên, địa chỉ người,<br>pháp nhân bị tố giác</th>" +
    "<th style='width:72px'>Họ tên Kiểm sát viên<br>thụ lý</th>" +
    "<th style='width:74px'>Yêu cầu của<br>Viện kiểm sát</th>" +
    "<th style='width:84px'>QĐ gia hạn thời hạn giải quyết<br>nguồn tin về tội phạm</th>" +
    "<th style='width:84px'>QĐ tạm đình chỉ việc giải quyết<br>nguồn tin về tội phạm</th>" +
    "<th style='width:70px'>QĐ hủy bỏ QĐ tạm đình chỉ việc<br>giải quyết nguồn tin về tội phạm</th>" +
    "<th style='width:80px'>QĐ phục hồi việc giải quyết tin báo,<br>tố giác tội phạm, kiến nghị khởi tố</th>" +
    "<th style='width:54px'>QĐ giải quyết tranh chấp<br>về thẩm quyền</th>" +
    "<th style='width:78px'>Thông báo: Kiểm sát QĐ khởi tố/<br>Không khởi tố/TĐC</th>" +
    "<th style='width:78px'>Yêu cầu Khởi tố vụ án/Không khởi tố/<br>Hủy bỏ QĐ KTVA hình sự</th>" +
    "<th style='width:58px'>Kết quả thực hiện<br>yêu cầu của VKS</th>" +
    "<th style='width:84px'>Kết quả giải quyết<br>(Khởi tố; Không khởi tố)</th>" +
    "<th style='width:54px'>Ghi chú</th>" +
    "</tr>" +
    "<tr class='colnum'>" + Array.from({length:17}, (_, i) => "<td>(" + (i+1) + ")</td>").join("") + "</tr>" +
    "</thead><tbody>" + rows + "</tbody></table>" +
    "</body></html>";
}

// ── Đồng bộ & Sửa dữ liệu cột "Thời điểm tính số liệu" ──────
function runMigration() {
  getActiveSheetName_();
  getActiveChitieuName_();
  getActiveKienNghiName_();
  let fixed = 0;
  Object.keys(db.sheets).forEach(shName => {
    if (!shName.startsWith("DanhSachTinBao")) return;
    const rows = db.sheets[shName] || [];
    rows.forEach((r, idx) => {
      r["STT"] = String(idx + 1);
      const cur = r["Thời điểm tính số liệu"];
      const norm = normThoiDiem_(cur);
      if (cur !== norm) {
        r["Thời điểm tính số liệu"] = norm;
        fixed++;
      }
    });
  });
  saveLocalDB();
  let msg = "Đã kiểm tra và đồng bộ cấu trúc dữ liệu thành công!";
  if (fixed > 0) msg += ` Đã chuẩn hóa ${fixed} ô "Thời điểm tính số liệu".`;
  return { success: true, message: msg };
}

function formatSheetTinBao() {
  return {
    success: true,
    message: "Đã áp dụng định dạng màu sắc & căn chỉnh! Bạn có thể bấm nút '📥 Xuất Excel' để tải file Excel (.xlsx) đã tô màu đầy đủ."
  };
}

// ═══ XUẤT FILE EXCEL (.XLSX) ĐỊNH DẠNG MÀU CHUẨN 100% ═══
async function exportFormattedExcelBuffer() {
  // Cập nhật sheet TamDinhChi trước khi xuất
  khoiTaoSheetTamDinhChi();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VKSND - Quản Lý Tin Báo Tội Phạm";
  workbook.created = new Date();

  const MONTH_BG = {
    "Năm trước chuyển qua": "FFF5F0FF",
    "10": "FFFFF7E6", "11": "FFE6F7FF", "12": "FFFFF0F0",
    "1": "FFF0FFF4",  "2": "FFFFFDE7",  "3": "FFFCE4EC",
    "4": "FFE8F5E9",  "5": "FFE3F2FD",  "6": "FFFFF3E0",
    "7": "FFF3E5F5",  "8": "FFE0F7FA",  "9": "FFFAFAFA",
  };
  function getMonthArgb_(monthVal) {
    if (monthVal === "Năm trước chuyển qua") return MONTH_BG["Năm trước chuyển qua"];
    const m = String(monthVal || "").match(/Tháng\s+0?(\d{1,2})/);
    if (m && MONTH_BG[m[1]]) return MONTH_BG[m[1]];
    return "FFFFFFFF";
  }

  const STATUS_STYLE = {
    dagiaiquyet:   { color: "FF16A34A", bold: false },
    kkthethoihieu: { color: "FFB45309", bold: true  },
    tamdinh:       { color: "FF7C3AED", bold: true  },
    phuchoi:       { color: "FF1D4ED8", bold: true  },
    dangcho:       { color: "FF000000", bold: false },
    quahan:        { color: "FFDC2626", bold: true  },
  };

  const COL_WIDTH = {
    "STT": 7,
    "Ngày VKS thụ lý": 14, "Ngày CSĐT thụ lý": 14, "Thời điểm tính số liệu": 16,
    "Công an xã thụ lý": 11,
    "Phân loại": 16, "Loại tội": 19, "Ngày xảy ra": 14, "Nơi xảy ra": 24, "Họ và tên": 20,
    "Địa chỉ cá nhân / Cơ quan tổ chức": 26,
    "Tóm tắt nội dung sự việc": 44,
    "Họ tên Phó viện trưởng thụ lý": 20, "Họ tên Kiểm sát viên thụ lý": 20,
    "QĐ gia hạn thời hạn giải quyết": 18, "Số ngày gia hạn": 11,
    "Danh sách QĐ tạm đình chỉ / phục hồi": 36,
    "Yêu cầu KT/KKT (loại)": 18, "Yêu cầu KT/KKT (số QĐ)": 14, "Yêu cầu KT/KKT (ngày QĐ)": 14,
    "Kết quả giải quyết": 28, "Ngày TSL kết quả": 14,
    "Ghi chú vụ việc": 26,
    "Hậu quả - Người chết": 12, "Hậu quả - Người bị thương": 12,
    "Hậu quả - Thiệt hại tài sản": 16, "Hậu quả - Ghi chú khác": 22,
  };

  const CENTER_COLS = [
    "STT","Ngày VKS thụ lý","Ngày CSĐT thụ lý","Thời điểm tính số liệu","Ngày xảy ra",
    "Công an xã thụ lý","Phân loại","Loại tội","Số ngày gia hạn",
    "Yêu cầu KT/KKT (loại)","Yêu cầu KT/KKT (số QĐ)","Yêu cầu KT/KKT (ngày QĐ)","Ngày TSL kết quả",
    "Hậu quả - Người chết","Hậu quả - Người bị thương","Hậu quả - Thiệt hại tài sản"
  ];

  // Sắp xếp thứ tự các sheet để active sheets lên đầu
  const activeTB = getActiveSheetName_();
  const activeCT = getActiveChitieuName_();
  const activeKN = getActiveKienNghiName_();
  const sheetOrder = [
    activeTB, activeCT, activeKN, "TamDinhChi",
    ...Object.keys(db.sheets).filter(k => ![activeTB, activeCT, activeKN, "TamDinhChi"].includes(k))
  ];

  for (const shName of sheetOrder) {
    const rows = db.sheets[shName];
    if (!rows) continue;
    let headers = HEADERS;
    if (shName.startsWith("ChiTieu")) headers = HEADERS_CHITIEU;
    else if (shName.startsWith("KienNghi")) headers = HEADERS_KIENNGHI;
    else if (shName === "TamDinhChi") headers = HEADERS_TAMDINHCHI;

    const ws = workbook.addWorksheet(shName.substring(0, 31), {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }]
    });

    ws.columns = headers.map(h => ({
      header: h,
      key: h,
      width: COL_WIDTH[h] || 18
    }));

    // Style Header
    const headerRow = ws.getRow(1);
    headerRow.height = 36;
    headerRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5C" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } }
      };
    });

    // Thêm dữ liệu và tô màu
    rows.forEach((r, idx) => {
      const rowValues = headers.map(h => h === "STT" ? String(idx + 1) : String(r[h] || ""));
      const excelRow = ws.addRow(rowValues);
      excelRow.height = 36;

      let bgArgb = "FFFFFFFF";
      let style = STATUS_STYLE.dangcho;

      if (shName.startsWith("DanhSachTinBao")) {
        bgArgb = getMonthArgb_(r["Thời điểm tính số liệu"]);
        const tt = computeTrangThai(r);
        style = STATUS_STYLE[tt] || STATUS_STYLE.dangcho;
        if (tt === "dangcho") {
          const startStr = r["Ngày CSĐT thụ lý"] || r["Ngày VKS thụ lý"];
          const startDate = parseD_(startStr);
          if (startDate) {
            const hasGH = !!(r["QĐ gia hạn thời hạn giải quyết"] || "").trim();
            const ghNgay = hasGH ? (+r["Số ngày gia hạn"] || 60) : 0;
            const maxDays = hasGH ? (60 + ghNgay) : 60;
            const elapsed = Math.floor((new Date() - startDate) / 86400000);
            if (elapsed > maxDays) style = STATUS_STYLE.quahan;
          }
        }
      }

      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = headers[colNumber - 1];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.font = {
          name: "Arial",
          size: 10,
          bold: style.bold,
          color: { argb: style.color }
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: CENTER_COLS.includes(h) ? "center" : "left",
          wrapText: true
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFDDDDDD" } },
          left: { style: "thin", color: { argb: "FFDDDDDD" } },
          bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
          right: { style: "thin", color: { argb: "FFDDDDDD" } }
        };
      });
    });
  }

  return await workbook.xlsx.writeBuffer();
}

// ═══ NHẬP DỮ LIỆU TỪ FILE EXCEL (.XLSX) ═══
async function importFromExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  let importedSheets = [];
  let totalRows = 0;

  function cellValToStr_(val) {
    if (val === null || val === undefined) return "";
    if (val instanceof Date) return fmtDate_(val);
    if (typeof val === "object") {
      if (val.result !== undefined) return cellValToStr_(val.result);
      if (val.richText && Array.isArray(val.richText)) {
        return val.richText.map(t => t.text || "").join("");
      }
      if (val.text !== undefined) return String(val.text);
    }
    return String(val).trim();
  }

  workbook.eachSheet(ws => {
    const name = ws.name.trim();
    const isTB = name.startsWith("DanhSachTinBao");
    const isCT = name.startsWith("ChiTieu");
    const isKN = name.startsWith("KienNghi");
    const isTDC = name === "TamDinhChi";

    // Nếu người dùng tải 1 file chỉ có 1 sheet tên bất kỳ (VD "Sheet1"), kiểm tra cột đầu tiên
    const headerRow = ws.getRow(1);
    const colHeaders = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      colHeaders[colNumber] = cellValToStr_(cell.value);
    });

    let targetName = name;
    let targetHeaders = null;

    if (isTB || colHeaders.includes("Ngày VKS thụ lý")) {
      targetHeaders = HEADERS;
      if (!isTB) targetName = getActiveSheetName_();
    } else if (isCT || colHeaders.includes("Tên chỉ tiêu")) {
      targetHeaders = HEADERS_CHITIEU;
      if (!isCT) targetName = getActiveChitieuName_();
    } else if (isKN || colHeaders.includes("Loại kiến nghị")) {
      targetHeaders = HEADERS_KIENNGHI;
      if (!isKN) targetName = getActiveKienNghiName_();
    } else if (isTDC || colHeaders.includes("STT gốc (TinBao#)")) {
      targetHeaders = HEADERS_TAMDINHCHI;
      targetName = "TamDinhChi";
    } else {
      return; // bỏ qua sheet không liên quan
    }

    const parsedRows = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rawObj = {};
      let hasData = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = colHeaders[colNumber];
        if (!h) return;
        const rawVal = cell.value;
        if (h === "Thời điểm tính số liệu") {
          rawObj[h] = normThoiDiem_(rawVal instanceof Date ? rawVal : cellValToStr_(rawVal));
        } else {
          rawObj[h] = cellValToStr_(rawVal);
        }
        if (h !== "STT" && rawObj[h]) hasData = true;
      });
      if (!hasData) return;

      // Tương thích dữ liệu cũ nếu có cột QĐ tạm đình chỉ / phục hồi tách rời
      if (targetHeaders === HEADERS && !rawObj["Danh sách QĐ tạm đình chỉ / phục hồi"]) {
        const td = rawObj["QĐ tạm đình chỉ giải quyết"] || "";
        const ph = rawObj["QĐ phục hồi giải quyết"] || "";
        const list = [];
        const mD = s => { const m = s.match(/(\d{2}\/\d{2}\/\d{4})/); return m ? m[1] : ""; };
        if (td) list.push({ loai: "tamdinhchi", so: "", ngay: mD(td) });
        if (ph) list.push({ loai: "phuchoi", so: "", ngay: mD(ph) });
        if (list.length) rawObj["Danh sách QĐ tạm đình chỉ / phục hồi"] = JSON.stringify(list);
      }

      const cleanRow = {};
      targetHeaders.forEach(h => {
        cleanRow[h] = rawObj[h] || "";
      });
      cleanRow["STT"] = String(parsedRows.length + 1);
      parsedRows.push(cleanRow);
    });

    db.sheets[targetName] = parsedRows;
    importedSheets.push(`${targetName} (${parsedRows.length} dòng)`);
    totalRows += parsedRows.length;

    // Nếu sheet có hậu tố _YYYY thì cập nhật ACTIVE_YEAR nếu lớn hơn hoặc chưa có
    const ym = targetName.match(/^DanhSachTinBao_(\d{4})$/);
    if (ym) {
      db.properties.ACTIVE_YEAR = ym[1];
    }
  });

  saveLocalDB();
  return {
    success: true,
    importedSheets,
    totalRows,
    message: `Đã nhập thành công ${totalRows} bản ghi từ ${importedSheets.length} sheet: ${importedSheets.join(", ")}`
  };
}

// ═══ SAO LƯU & KHÔI PHỤC JSON ═══
function getFullBackupJSON() {
  return {
    version: "5.0",
    exportedAt: new Date().toISOString(),
    properties: db.properties,
    staff: db.staff,
    sheets: db.sheets
  };
}

function restoreFromBackupJSON(payload) {
  if (!payload || !payload.sheets) {
    return { success: false, message: "File sao lưu không hợp lệ." };
  }
  if (payload.properties) db.properties = payload.properties;
  if (payload.staff) db.staff = payload.staff;
  db.sheets = payload.sheets;
  saveLocalDB();
  return {
    success: true,
    message: "Đã khôi phục toàn bộ dữ liệu thành công!"
  };
}

// ═══ CẤU HÌNH CLOUD & BẢO MẬT ═══
function getCloudSettings() {
  return {
    supabaseUrl: db.cloud?.supabaseUrl || "",
    supabaseKey: db.cloud?.supabaseKey ? "••••••••" + db.cloud.supabaseKey.slice(-6) : "",
    hasKey: !!(db.cloud?.supabaseKey),
    enabled: !!(db.cloud?.enabled),
    lastSync: db.cloud?.lastSync || null,
    username: db.auth?.username || "admin"
  };
}

async function updateCloudSettings({ supabaseUrl, supabaseKey }) {
  db.cloud.supabaseUrl = (supabaseUrl || "").trim();
  if (supabaseKey && !supabaseKey.startsWith("••••")) {
    db.cloud.supabaseKey = supabaseKey.trim();
  }
  initSupabase_();
  saveLocalDB();
  if (supabaseClient) {
    const res = await pullFromSupabase();
    return {
      success: res.success,
      enabled: true,
      message: res.message
    };
  }
  return { success: true, enabled: false, message: "Đã lưu cấu hình Local (đã tắt đồng bộ Cloud)." };
}

function verifyLogin(username, password) {
  const validUser = (db.auth?.username || "admin").trim();
  const validPass = db.auth?.password || "vks123456";
  if (String(username || "admin").trim() === validUser && String(password || "") === validPass) {
    return { success: true };
  }
  return { success: false, message: "Mật khẩu hoặc tài khoản không đúng!" };
}

function updatePassword(oldPass, newPass, newUsername) {
  if (String(oldPass || "") !== (db.auth?.password || "vks123456")) {
    return { success: false, message: "Mật khẩu hiện tại không đúng!" };
  }
  if (!newPass || String(newPass).length < 4) {
    return { success: false, message: "Mật khẩu mới phải từ 4 ký tự trở lên!" };
  }
  db.auth.password = String(newPass);
  if (newUsername && String(newUsername).trim()) {
    db.auth.username = String(newUsername).trim();
  }
  saveLocalDB();
  return { success: true, message: "Đã đổi mật khẩu bảo mật thành công!" };
}



  window.vksBrowserEngine = {
    isReady: () => !!_unlockedGhToken,
    loginOnWeb,
    pullFromGitHubCloud,
    pushToGitHubCloudNow,
    getAllRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    getAllChiTieu,
    addChiTieu,
    updateChiTieu,
    deleteChiTieu,
    getAllKienNghi,
    addKienNghi,
    updateKienNghi,
    deleteKienNghi,
    getStats,
    getThongKeThang,
    getThongKeNgay,
    getThongKeKhoang,
    getPhoVTList,
    getKSVList,
    getAllStaffList,
    updateStaffLists,
    getActiveYear,
    setActiveYear,
    getSystemInfo,
    getInitialBundle,
    ketThucNam,
    khoiTaoSheetTamDinhChi,
    getSoTinBaoHTML,
    getSoTDCHTML,
    formatSheetTinBao,
    runMigration,
    exportFormattedExcelBuffer,
    importFromExcelBuffer,
    getFullBackupJSON,
    restoreFromBackupJSON,
    getCloudSettings,
    updateCloudSettings,
    pullFromSupabase,
    verifyLogin,
    updatePassword
  };
})(window);
