// ═══ GOOGLE.SCRIPT.RUN POLYFILL (KẾT NỐI SERVER & WEB GITHUB PAGES) ═══
let vksToken = localStorage.getItem('vks_auth_token') || '';
const IS_STATIC_WEB = location.hostname.endsWith('github.io') || location.protocol === 'file:';

function createGScriptRunner(successCb = null, failureCb = null) {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'withSuccessHandler') {
        return (cb) => createGScriptRunner(cb, failureCb);
      }
      if (prop === 'withFailureHandler') {
        return (cb) => createGScriptRunner(successCb, cb);
      }
      return (...args) => {
        if (IS_STATIC_WEB && window.vksBrowserEngine && typeof window.vksBrowserEngine[prop] === 'function') {
          Promise.resolve()
            .then(() => window.vksBrowserEngine[prop](...args))
            .then(res => { if (successCb) successCb(res); })
            .catch(err => { if (failureCb) failureCb(err); else console.error(err); });
          return;
        }
        fetch('/api/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-vks-token': vksToken
          },
          body: JSON.stringify({ method: prop, args })
        })
          .then(async r => {
            if (r.status === 401) {
              showLoginScreen();
              throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
            }
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || data.message || 'Lỗi máy chủ');
            return data.result;
          })
          .then(res => { if (successCb) successCb(res); })
          .catch(err => { if (failureCb) failureCb(err); else console.error(err); });
      };
    }
  });
}

window.google = {
  script: {
    get run() {
      return createGScriptRunner();
    }
  }
};

// ═══ AUTHENTICATION & KHỞI ĐỘNG ═══
function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
}
function hideLoginScreen() {
  document.getElementById('loginScreen').classList.add('hidden');
}

async function doLogin() {
  const username = document.getElementById('login_user').value.trim() || 'admin';
  const password = document.getElementById('login_pass').value;
  const errEl = document.getElementById('loginErr');
  errEl.style.display = 'none';
  showLoad(true);
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const data = await window.vksBrowserEngine.loginOnWeb(username, password);
      showLoad(false);
      if (!data.success) {
        errEl.textContent = data.message || 'Đăng nhập thất bại!';
        errEl.style.display = 'block';
        return;
      }
      vksToken = data.token;
      localStorage.setItem('vks_auth_token', vksToken);
      hideLoginScreen();
      initAppAfterAuth();
      return;
    }
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    showLoad(false);
    if (!res.ok || !data.success) {
      errEl.textContent = data.message || 'Đăng nhập thất bại!';
      errEl.style.display = 'block';
      return;
    }
    vksToken = data.token;
    localStorage.setItem('vks_auth_token', vksToken);
    hideLoginScreen();
    initAppAfterAuth();
  } catch (e) {
    showLoad(false);
    errEl.textContent = 'Lỗi kết nối: ' + e.message;
    errEl.style.display = 'block';
  }
}

function doLogout() {
  localStorage.removeItem('vks_auth_token');
  localStorage.removeItem('vks_gh_token');
  vksToken = '';
  closeOvl('dataSyncOverlay');
  showLoginScreen();
}

// ═══ CONSTANTS ═══
const DEADLINE_NORMAL=60, DEADLINE_GH1=60, DEADLINE_GH2=120, DEADLINE_PHUCHOI=30;
const PAGE_DEFS={
  tonghop:     {label:'Tổng hợp các tin',           sub:'Toàn bộ tin báo, tố giác tội phạm và kiến nghị khởi tố', icon:'📋',dot:'sd-blue',  pill:'pp-blue',  tl:'Tổng hợp'},
  dagiaiquyet: {label:'Tin đã giải quyết trong kỳ', sub:'Các tin báo đã có kết quả: Khởi tố hoặc Không khởi tố',  icon:'✅',dot:'sd-green', pill:'pp-green', tl:'Đã giải quyết'},
  dangcho:     {label:'Tin đang chờ giải quyết',    sub:'Các tin báo chưa có kết quả, đang trong quá trình xử lý',icon:'⏳',dot:'sd-warn',  pill:'pp-amber', tl:'Đang chờ GQ'},
  tamdinh:     {label:'Tin tạm đình chỉ',            sub:'Tất cả tin tạm đình chỉ (kể cả đã phục hồi — ghi chú màu xanh)',icon:'⏸️',dot:'sd-purple',pill:'pp-purple',tl:'Tạm đình chỉ'},
  phuchoi:     {label:'Tin đã phục hồi',             sub:'Tin TĐC đã có QĐ tiếp tục GQ — tính như thụ lý mới',   icon:'🔄',dot:'sd-blue',  pill:'pp-blue',  tl:'Phục hồi'},
  thongke:     {label:'Thống kê theo tháng',         sub:'Số liệu tổng hợp định kỳ lấy từ danh sách tin báo',      icon:'📊',dot:'sd-blue',  pill:'pp-blue',  tl:'Thống kê'},
  chitieu:     {label:'Theo dõi chỉ tiêu',           sub:'Yêu cầu khởi tố và quy chế đã ký',                       icon:'🎯',dot:'sd-blue',  pill:'pp-blue',  tl:'Chỉ tiêu'},
  kiennghi:    {label:'Theo dõi kiến nghị',          sub:'Kiến nghị phòng ngừa và kiến nghị vi phạm',               icon:'📝',dot:'sd-blue',  pill:'pp-blue',  tl:'Kiến nghị'},
};

let MONTH_CLS={
  'Năm trước chuyển qua':'month-namtruoc',
  'Tháng 10':'month-10','Tháng 11':'month-11','Tháng 12':'month-12',
  'Tháng 1':'month-1','Tháng 2':'month-2','Tháng 3':'month-3',
  'Tháng 4':'month-4','Tháng 5':'month-5','Tháng 6':'month-6',
  'Tháng 7':'month-7','Tháng 8':'month-8','Tháng 9':'month-9',
};
let MONTH_ORDER={'Năm trước chuyển qua':0,'Tháng 1':1,'Tháng 2':2,'Tháng 3':3,'Tháng 4':4,'Tháng 5':5,'Tháng 6':6,'Tháng 7':7,'Tháng 8':8,'Tháng 9':9,'Tháng 10':10,'Tháng 11':11,'Tháng 12':12};

const PG=15;
let allRec=[],filt=[],curPg=1,curView='tonghop',editRow=null;
let chartKQ=null,chartPL=null,chartLT=null;
let dpState={};
let tdphCounter=0;
let phoVTListGlobal=[], ksvListGlobal=[];

window.onload = async () => {
  const now=new Date();
  const selNamDau=document.getElementById('tk_nam_dau');
  const selNamCuoi=document.getElementById('tk_nam_cuoi');
  for(let y=now.getFullYear()+1;y>=now.getFullYear()-5;y--){
    const opt1=document.createElement('option');opt1.value=y;opt1.textContent='Năm '+y;
    selNamDau.appendChild(opt1);
    const opt2=document.createElement('option');opt2.value=y;opt2.textContent='Năm '+y;
    selNamCuoi.appendChild(opt2);
  }
  selNamDau.value=now.getFullYear();
  selNamCuoi.value=now.getFullYear();
  document.getElementById('tk_thang').value=now.getMonth()+1;
  document.getElementById('tk_thang_cuoi').value=now.getMonth()+1;

  // Kiểm tra phiên đăng nhập
  if (IS_STATIC_WEB && window.vksBrowserEngine && window.vksBrowserEngine.isReady()) {
    showLoad(true);
    await window.vksBrowserEngine.pullFromGitHubCloud().catch(() => {});
    showLoad(false);
    hideLoginScreen();
    initAppAfterAuth();
    return;
  }
  if (vksToken && !IS_STATIC_WEB) {
    try {
      const r = await fetch('/api/auth-check', { headers: { 'x-vks-token': vksToken } });
      const d = await r.json();
      if (d.authenticated) {
        hideLoginScreen();
        initAppAfterAuth();
        return;
      }
    } catch (e) {}
  }
  showLoginScreen();
};

function initAppAfterAuth() {
  loadStaffLists();
  loadData();
  loadAllStaff();
  refreshSystemBadge();
}

function refreshSystemBadge() {
  const now = new Date();
  google.script.run.withSuccessHandler(info=>{
    const badge=document.getElementById('activeYearBadge');
    const activeYear=info.activeYear?+info.activeYear:now.getFullYear();
    if(info.activeYear){
      badge.innerHTML=`📅 Năm ${info.activeYear} ▾`;
      badge.style.display='';
    }
    buildThoiDiemPhatSinhOptions(activeYear);
  }).getSystemInfo();
}

function openYearSwitchPrompt() {
  google.script.run.withSuccessHandler(info => {
    const years = info.availableYears || [info.activeYear || new Date().getFullYear()];
    const y = prompt(`Đang làm việc tại: Năm ${info.activeYear}\nCác năm hiện có: ${years.join(', ')}\n\nNhập năm bạn muốn chuyển sang (VD: 2025, 2026, 2027):`, info.activeYear);
    if (!y || !y.trim()) return;
    showLoad(true);
    google.script.run.withSuccessHandler(res => {
      showLoad(false);
      if (res.success) {
        toast('✅ ' + res.message);
        refreshSystemBadge();
        loadData();
      } else {
        toast(res.message || 'Lỗi chuyển năm', 'err');
      }
    }).setActiveYear(y.trim());
  }).getSystemInfo();
}

const NAM_CHUYEN_DOI_KY=2026;
function dsThangTSL_(activeYear){
  const out=[];
  let m,y;
  if(activeYear<=NAM_CHUYEN_DOI_KY){m=10;y=activeYear-1;}else{m=1;y=activeYear;}
  while(y<activeYear||(y===activeYear&&m<=12)){out.push({m,y});m++;if(m>12){m=1;y++;}}
  return out;
}
function keyThangTSL_(m,y){return `Tháng ${String(m).padStart(2,'0')}/${y}`;}
function buildThoiDiemPhatSinhOptions(activeYear){
  activeYear=+activeYear||new Date().getFullYear();
  const months=dsThangTSL_(activeYear);
  const opts=months.map(({m,y})=>`<option value="${keyThangTSL_(m,y)}">Tháng ${m}/${y}</option>`).join('');
  const sel1=document.getElementById('f_thoidiemphatsinh');
  if(sel1){
    const cur=sel1.value;
    sel1.innerHTML='<option value="">-- Chọn --</option><option value="Năm trước chuyển qua">Năm trước chuyển qua</option>'+opts;
    if(cur)sel1.value=cur;
  }
  const sel2=document.getElementById('filterMonth');
  if(sel2){
    const cur=sel2.value;
    sel2.innerHTML='<option value="">Tất cả thời điểm</option><option value="Năm trước chuyển qua">Năm trước chuyển qua</option>'+opts;
    if(cur)sel2.value=cur;
  }
  MONTH_CLS={'Năm trước chuyển qua':'month-namtruoc'};
  MONTH_ORDER={'Năm trước chuyển qua':0};
  months.forEach(({m,y},idx)=>{
    [keyThangTSL_(m,y),`Tháng ${m}/${y}`].forEach(k=>{MONTH_CLS[k]='month-'+m;MONTH_ORDER[k]=idx+1;});
  });
}

// ═══ LOAD & MANAGE STAFF LISTS ═══
function loadStaffLists(){
  google.script.run.withSuccessHandler(list=>{
    phoVTListGlobal = list || [];
    const sel=document.getElementById('f_pvt');
    sel.innerHTML='<option value="">-- Chọn --</option>'+list.map(n=>`<option value="${n}">${n}</option>`).join('');
    fillLocTK();
  }).getPhoVTList();
  google.script.run.withSuccessHandler(list=>{
    ksvListGlobal = list || [];
    const sel=document.getElementById('f_ksv');
    sel.innerHTML='<option value="">-- Chọn --</option>'+list.map(n=>`<option value="${n}">${n}</option>`).join('');
    fillLocTK();
  }).getKSVList();
}

function openStaffModal() {
  document.getElementById('staff_pvt_txt').value = (phoVTListGlobal || []).join('\n');
  document.getElementById('staff_ksv_txt').value = (ksvListGlobal || []).join('\n');
  openOvl('staffOverlay');
}

function saveStaffModal() {
  const pvt = document.getElementById('staff_pvt_txt').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const ksv = document.getElementById('staff_ksv_txt').value.split('\n').map(s=>s.trim()).filter(Boolean);
  showLoad(true);
  google.script.run
    .withSuccessHandler(res => {
      showLoad(false);
      closeOvl('staffOverlay');
      loadStaffLists();
      loadAllStaff();
      toast('Đã cập nhật danh sách Phó Viện trưởng & Kiểm sát viên!');
    })
    .withFailureHandler(e => { showLoad(false); toast('Lỗi: ' + e.message, 'err'); })
    .updateStaffLists(pvt, ksv);
}

// ═══ EXCEL / BACKUP / CLOUD MODAL ═══
async function openDataSyncModal() {
  openOvl('dataSyncOverlay');
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const d = window.vksBrowserEngine.getCloudSettings();
      const st = document.getElementById('cloudStatusTxt');
      st.innerHTML = `<span style="color:var(--success);font-weight:700">🟢 Đang bật đồng bộ tự động GitHub Cloud (Private)</span>` + (d.lastSync ? ` (Cập nhật: ${new Date(d.lastSync).toLocaleString('vi-VN')})` : '');
      return;
    }
    const r = await fetch('/api/cloud-settings', { headers: { 'x-vks-token': vksToken } });
    const d = await r.json();
    document.getElementById('cloud_url').value = d.supabaseUrl || '';
    document.getElementById('cloud_key').value = d.supabaseKey || '';
    const st = document.getElementById('cloudStatusTxt');
    if (d.enabled) {
      st.innerHTML = `<span style="color:var(--success);font-weight:700">🟢 Đang bật đồng bộ Supabase Cloud</span>` + (d.lastSync ? ` (Cập nhật: ${new Date(d.lastSync).toLocaleString('vi-VN')})` : '');
    } else {
      st.innerHTML = `<span style="color:var(--success);font-weight:700">🟢 Đang tự động sao lưu GitHub Cloud & Local</span>`;
    }
  } catch (e) {}
}

async function exportExcelFile() {
  showLoad(true);
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const buf = await window.vksBrowserEngine.exportFormattedExcelBuffer();
      const year = window.vksBrowserEngine.getActiveYear() || new Date().getFullYear();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VKS_QuanLyTinBao_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showLoad(false);
      toast('📥 Đã xuất file Excel (.xlsx) đầy đủ màu sắc!');
      return;
    }
    const r = await fetch('/api/export-excel', { headers: { 'x-vks-token': vksToken } });
    if (!r.ok) throw new Error('Không thể xuất file Excel');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cd = r.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    a.download = m ? m[1] : 'VKS_QuanLyTinBao.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showLoad(false);
    toast('📥 Đã xuất file Excel (.xlsx) đầy đủ màu sắc!');
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

async function uploadExcelFile() {
  const input = document.getElementById('excelUploadInput');
  if (!input.files || !input.files[0]) {
    toast('Vui lòng chọn file Excel (.xlsx) cần nhập!', 'err');
    return;
  }
  showLoad(true);
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const buf = await input.files[0].arrayBuffer();
      const d = await window.vksBrowserEngine.importFromExcelBuffer(buf);
      showLoad(false);
      if (!d.success) {
        toast(d.message || 'Lỗi nhập Excel', 'err');
        return;
      }
      toast(d.message);
      input.value = '';
      closeOvl('dataSyncOverlay');
      refreshSystemBadge();
      loadData();
      return;
    }
    const fd = new FormData();
    fd.append('file', input.files[0]);
    const r = await fetch('/api/import-excel', {
      method: 'POST',
      headers: { 'x-vks-token': vksToken },
      body: fd
    });
    const d = await r.json();
    showLoad(false);
    if (!r.ok || !d.success) {
      toast(d.message || 'Lỗi nhập Excel', 'err');
      return;
    }
    toast(d.message);
    input.value = '';
    closeOvl('dataSyncOverlay');
    refreshSystemBadge();
    loadData();
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

async function downloadBackupJSON() {
  showLoad(true);
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const data = window.vksBrowserEngine.getFullBackupJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VKS_Backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showLoad(false);
      toast('💾 Đã tải file sao lưu hệ thống (.json)!');
      return;
    }
    const r = await fetch('/api/backup-json', { headers: { 'x-vks-token': vksToken } });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VKS_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showLoad(false);
    toast('💾 Đã tải file sao lưu hệ thống (.json)!');
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

async function uploadRestoreJSON() {
  const input = document.getElementById('jsonRestoreInput');
  if (!input.files || !input.files[0]) {
    toast('Vui lòng chọn file sao lưu (.json)!', 'err');
    return;
  }
  if (!confirm('Khôi phục dữ liệu từ file sao lưu này sẽ ghi đè dữ liệu hiện tại. Tiếp tục?')) return;
  showLoad(true);
  try {
    const text = await input.files[0].text();
    const payload = JSON.parse(text);
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const d = window.vksBrowserEngine.restoreFromBackupJSON(payload);
      showLoad(false);
      toast(d.message, d.success ? 'ok' : 'err');
      if (d.success) {
        closeOvl('dataSyncOverlay');
        refreshSystemBadge();
        loadStaffLists();
        loadAllStaff();
        loadData();
      }
      return;
    }
    const r = await fetch('/api/restore-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vks-token': vksToken },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    showLoad(false);
    if (!d.success) {
      toast(d.message || 'Lỗi khôi phục', 'err');
      return;
    }
    toast(d.message);
    closeOvl('dataSyncOverlay');
    refreshSystemBadge();
    loadStaffLists();
    loadAllStaff();
    loadData();
  } catch (e) {
    showLoad(false);
    toast('File JSON không hợp lệ: ' + e.message, 'err');
  }
}

async function saveCloudConfig() {
  if (IS_STATIC_WEB) {
    toast('Đang dùng đồng bộ tự động GitHub Cloud!', 'ok');
    return;
  }
  const supabaseUrl = document.getElementById('cloud_url').value.trim();
  const supabaseKey = document.getElementById('cloud_key').value.trim();
  showLoad(true);
  try {
    const r = await fetch('/api/cloud-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vks-token': vksToken },
      body: JSON.stringify({ supabaseUrl, supabaseKey })
    });
    const d = await r.json();
    showLoad(false);
    toast(d.message, d.success ? 'ok' : 'err');
    openDataSyncModal();
    loadData();
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

async function pullCloudNow() {
  showLoad(true);
  try {
    if (IS_STATIC_WEB && window.vksBrowserEngine) {
      const d = await window.vksBrowserEngine.pullFromGitHubCloud();
      showLoad(false);
      toast(d.message, d.success ? 'ok' : 'err');
      if (d.success) {
        refreshSystemBadge();
        loadStaffLists();
        loadAllStaff();
        loadData();
      }
      return;
    }
    const r = await fetch('/api/cloud-pull', {
      method: 'POST',
      headers: { 'x-vks-token': vksToken }
    });
    const d = await r.json();
    showLoad(false);
    toast(d.message, d.success ? 'ok' : 'err');
    if (d.success) {
      refreshSystemBadge();
      loadStaffLists();
      loadAllStaff();
      loadData();
    }
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

async function doChangePassword() {
  const oldPass = document.getElementById('pw_old').value;
  const newPass = document.getElementById('pw_new').value;
  showLoad(true);
  try {
    const r = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vks-token': vksToken },
      body: JSON.stringify({ oldPass, newPass })
    });
    const d = await r.json();
    showLoad(false);
    toast(d.message, d.success ? 'ok' : 'err');
    if (d.success) {
      document.getElementById('pw_old').value = '';
      document.getElementById('pw_new').value = '';
    }
  } catch (e) {
    showLoad(false);
    toast('Lỗi: ' + e.message, 'err');
  }
}

function loadData(){
  showLoad(true);
  google.script.run
    .withSuccessHandler(d=>{allRec=d;fillLocTK();updCounts();buildCharts();buildWarnPanel();applyView();showLoad(false);loadChiTieu();loadKienNghi();})
    .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);})
    .getAllRecords();
}

// ═══ DEADLINE ═══
function parseDS(s){if(!s)return null;const m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]):null;}
function getDeadlineInfo(rec){
  const tt=rec['_trangThai'];
  const kq=(rec['Kết quả giải quyết']||'').trim();

  if(tt==='tamdinh'){
    try{
      const list=JSON.parse(rec['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');
      let lastTD=null;
      list.filter(q=>q.loai==='tamdinhchi').forEach(q=>{
        const d=dpParseVal(q.ngay);
        if(d&&(!lastTD||d>lastTD))lastTD=q;
      });
      if(!lastTD) return {status:'paused',cls:'days-purple',dotCls:'wd-purple',isTdc:true};
      const tdDate=dpParseVal(lastTD.ngay);
      const thoiHieuNam=+lastTD.thoiHieu||0;
      if(!tdDate||!thoiHieuNam){
        return {status:'paused',cls:'days-purple',dotCls:'wd-purple',isTdc:true,noThoiHieu:true};
      }
      const hetHan=new Date(tdDate.getFullYear()+thoiHieuNam,tdDate.getMonth(),tdDate.getDate());
      const now=new Date();
      const daysLeft=Math.floor((hetHan-now)/(864e5));
      let thStatus='ok';
      if(daysLeft<0) thStatus='het';
      else if(daysLeft<=180) thStatus='near';
      else if(daysLeft<=365) thStatus='warn';
      return {
        status:'paused', cls:'days-purple', dotCls:'wd-purple', isTdc:true,
        thoiHieuNam, tdDate, hetHan, daysLeft, thStatus,
      };
    }catch(e){
      return {status:'paused',cls:'days-purple',dotCls:'wd-purple',isTdc:true};
    }
  }

  const ghRaw=(rec['QĐ gia hạn thời hạn giải quyết']||'').trim();
  const hasGH=!!ghRaw;
  const ghNgay=hasGH?(+rec['Số ngày gia hạn']||DEADLINE_GH1):0;

  let start, maxDays;
  if(tt==='phuchoi'){
    try{
      const list=JSON.parse(rec['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');
      let lastPH=null;
      list.filter(q=>q.loai==='phuchoi').forEach(q=>{
        const d=dpParseVal(q.ngay);
        if(d&&(!lastPH||d>lastPH))lastPH=d;
      });
      start=lastPH||(parseDS(rec['Ngày CSĐT thụ lý'])||parseDS(rec['Ngày VKS thụ lý']));
    }catch(e){start=parseDS(rec['Ngày CSĐT thụ lý'])||parseDS(rec['Ngày VKS thụ lý']);}
    maxDays=DEADLINE_PHUCHOI;
  } else {
    start=parseDS(rec['Ngày CSĐT thụ lý'])||parseDS(rec['Ngày VKS thụ lý']);
    maxDays=hasGH?(DEADLINE_NORMAL+ghNgay):DEADLINE_NORMAL;
  }
  if(!start) return null;

  const elapsed=Math.floor((new Date()-start)/(864e5));
  const remaining=maxDays-elapsed;
  const pct=Math.min(100,Math.round(elapsed/maxDays*100));
  let status='ok',cls='days-green',dotCls='wd-green';
  if(kq){status='done';}
  else if(remaining<0){status='over';cls='days-red';dotCls='wd-red';}
  else if(remaining<10){status='near';cls='days-orange';dotCls='wd-orange';}
  return{start,elapsed,remaining,maxDays,pct,status,cls,dotCls,hasGH,ghNgay};
}

// ═══ CHARTS ═══
function buildCharts(){
  if(!allRec.length){
    ['chartKQ','chartPL','chartLT'].forEach(id=>{
      const c=document.getElementById(id);
      if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#aaa';ctx.font='12px Inter,sans-serif';ctx.textAlign='center';ctx.fillText('Chưa có dữ liệu',c.width/2,c.height/2);}
    });
    return;
  }
  const khoito=allRec.filter(r=>(r['Kết quả giải quyết']||'').match(/^khởi tố/i)).length;
  const kkhoito=allRec.filter(r=>(r['Kết quả giải quyết']||'').match(/không khởi tố|kkt/i)).length;
  const tamdinh=allRec.filter(r=>r['_trangThai']==='tamdinh').length;
  const chuagq=allRec.filter(r=>r['_trangThai']==='dangcho').length;

  if(chartKQ)chartKQ.destroy();
  chartKQ=new Chart(document.getElementById('chartKQ'),{type:'doughnut',
    data:{labels:['Khởi tố','Không KT','Tạm đình chỉ','Chưa GQ'],
      datasets:[{data:[khoito,kkhoito,tamdinh,chuagq],backgroundColor:['#54c59f','#f48265','#8b75f6','#63b3ed'],borderWidth:3,borderColor:'#fff',borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'circle',font:{size:10.5,weight:'600'},padding:10}}}}});

  const plD=[allRec.filter(r=>r['Phân loại']==='Tố giác tội phạm').length,allRec.filter(r=>r['Phân loại']==='Tin báo về tội phạm').length,allRec.filter(r=>r['Phân loại']==='Kiến nghị khởi tố').length];
  if(chartPL)chartPL.destroy();
  chartPL=new Chart(document.getElementById('chartPL'),{type:'bar',
    data:{labels:['Tố giác','Tin báo','Kiến nghị KT'],datasets:[{data:plD,backgroundColor:['#63b3ed','#8b75f6','#f48265'],borderRadius:10,borderSkipped:false,barThickness:26}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f1f4fb'},ticks:{stepSize:1,font:{size:10}}},x:{ticks:{font:{size:10.5,weight:'600'}},grid:{display:false}}}}});

  const ltMap={};allRec.forEach(r=>{const lt=(r['Loại tội']||'Chưa PL').trim();ltMap[lt]=(ltMap[lt]||0)+1;});
  const ltL=Object.keys(ltMap).slice(0,8),ltV=ltL.map(k=>ltMap[k]);
  const COLS=['#8b75f6','#f48265','#63b3ed','#54c59f','#f6ad55','#f687b3','#4fd1c5','#9f7aea'];
  if(chartLT)chartLT.destroy();
  chartLT=new Chart(document.getElementById('chartLT'),{type:'bar',
    data:{labels:ltL,datasets:[{data:ltV,backgroundColor:ltL.map((_,i)=>COLS[i%COLS.length]),borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#f1f4fb'},ticks:{stepSize:1,font:{size:10}}},y:{ticks:{font:{size:10,weight:'600'}},grid:{display:false}}}}});
}

// ═══ WARN PANEL ═══
function buildWarnPanel(){
  const activeGQ=allRec.filter(r=>!isTdcNamCu(r)&&(r['_trangThai']==='dangcho'||r['_trangThai']==='phuchoi'));
  const warns=[];
  activeGQ.forEach(r=>{const dl=getDeadlineInfo(r);if(dl&&(dl.status==='near'||dl.status==='over'))warns.push({rec:r,dl,kind:'gq'});});

  const activeTDC=allRec.filter(r=>!isTdcNamCu(r)&&r['_trangThai']==='tamdinh');
  activeTDC.forEach(r=>{
    const dl=getDeadlineInfo(r);
    if(dl&&dl.isTdc&&(dl.thStatus==='het'||dl.thStatus==='near')) warns.push({rec:r,dl,kind:'tdc'});
  });

  warns.sort((a,b)=>{
    const pa=a.kind==='tdc'?(a.dl.thStatus==='het'?-2:-1):(a.dl.status==='over'?-2:a.dl.remaining);
    const pb=b.kind==='tdc'?(b.dl.thStatus==='het'?-2:-1):(b.dl.status==='over'?-2:b.dl.remaining);
    return pa-pb;
  });
  const panel=document.getElementById('warnPanel');
  const list=document.getElementById('warnList');
  const countEl=document.getElementById('warnCount');
  if(!warns.length){panel.style.display='none';return;}
  panel.style.display='';
  const ov=warns.filter(w=>w.kind==='gq'&&w.dl.status==='over').length+warns.filter(w=>w.kind==='tdc'&&w.dl.thStatus==='het').length;
  const nr=warns.length-ov;
  countEl.textContent=`(${ov} quá hạn/hết thời hiệu, ${nr} sắp hết hạn)`;
  list.innerHTML=warns.slice(0,10).map(({rec,dl,kind})=>{
    let txt,dotCls,cls;
    if(kind==='tdc'){
      txt=dl.thStatus==='het'?'Đã hết thời hiệu TCTNHS':`Còn ${dl.daysLeft} ngày thời hiệu`;
      dotCls=dl.thStatus==='het'?'wd-red':'wd-orange';
      cls=dl.thStatus==='het'?'days-red':'days-orange';
    } else {
      txt=dl.status==='over'?`Quá hạn ${Math.abs(dl.remaining)} ngày`:`Còn ${dl.remaining}/${dl.maxDays} ngày`;
      dotCls=dl.dotCls; cls=dl.cls;
    }
    const lt=(rec['Loại tội']||'').trim();
    const ngXR=(rec['Ngày xảy ra']||'').trim();
    const noiXR=(rec['Nơi xảy ra']||'').trim();
    const label=[lt,ngXR,noiXR].filter(Boolean).join(' - ');
    const tdcTag=kind==='tdc'?'<span class="badge b-purple" style="font-size:9px;margin-right:4px">TĐC</span>':'';
    return`<div class="warn-row" style="cursor:pointer" onclick="openDetail(${rec.rowIndex})" title="Bấm để xem chi tiết"><span class="warn-dot ${dotCls}"></span><span class="warn-stt">#${rec['STT']}</span><span class="warn-name">${tdcTag}${label||'—'}</span><span class="warn-days ${cls}">${txt}</span><span style="color:var(--muted);font-size:12px">›</span></div>`;
  }).join('');
}

// ═══ COUNTS ═══
function isTdcNamCu(r){
  return r['_trangThai']==='tamdinh' && r['Thời điểm tính số liệu']==='Năm trước chuyển qua';
}

function getLastPhucHoiDate(r){
  try{
    const list=JSON.parse(r['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');
    let last=null;
    list.filter(q=>q.loai==='phuchoi').forEach(q=>{
      const d=dpParseVal(q.ngay);
      if(d&&(!last||d>last))last=q.ngay;
    });
    return last||'';
  }catch(e){return '';}
}

function categorize(r){
  return{
    gq:     r.filter(x=>!isTdcNamCu(x)&&(x['_trangThai']==='dagiaiquyet'||x['_trangThai']==='kkthethoihieu')),
    cho:    r.filter(x=>!isTdcNamCu(x)&&x['_trangThai']==='dangcho'),
    td:     r.filter(x=>x['_trangThai']==='tamdinh'),
    phuchoi:r.filter(x=>{
      try{
        const list=JSON.parse(x['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');
        return list.some(q=>q.loai==='phuchoi');
      }catch(e){return false;}
    }),
  };
}
function updCounts(){
  const vis=allRec.filter(r=>!isTdcNamCu(r));
  const c=categorize(allRec);
  document.getElementById('cnt-tonghop').textContent=vis.length;
  document.getElementById('cnt-dagiaiquyet').textContent=c.gq.length;
  document.getElementById('cnt-dangcho').textContent=c.cho.length;
  document.getElementById('cnt-tamdinh').textContent=c.td.length;
  document.getElementById('cnt-phuchoi').textContent=c.phuchoi.length;
  document.getElementById('sv-total').textContent=vis.length;
  document.getElementById('sv-gq').textContent=c.gq.length;
  document.getElementById('sv-cho').textContent=c.cho.length;
  document.getElementById('sv-td').textContent=c.td.length;
}

// ═══ NAV ═══
function navTo(page,el){
  curView=page;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const d=PAGE_DEFS[page];
  document.getElementById('tbTitle').textContent=d.label;
  document.getElementById('tbSub').textContent=d.sub;
  document.getElementById('tbIcon').textContent=d.icon;
  document.getElementById('tbPill').className='page-pill '+d.pill;

  const isThongKe=page==='thongke';
  const isCtieu=page==='chitieu';
  const isKn=page==='kiennghi';
  const isList=!isThongKe&&!isCtieu&&!isKn;
  const ov=page==='tonghop';

  document.getElementById('statCards').style.display  = ov?'grid':'none';
  document.getElementById('chartsRow').style.display  = ov?'grid':'none';
  document.getElementById('warnPanel').style.display  = ov?'':'none';
  document.getElementById('tkPanel').classList.toggle('show',isThongKe);
  document.getElementById('ctPanel').classList.toggle('show',isCtieu);
  document.getElementById('knPanel').classList.toggle('show',isKn);
  document.getElementById('tableCard').style.display  = isList?'':'none';

  document.getElementById('btnAddTinBao').style.display = isList?'':'none';
  document.getElementById('btnAddCtieu').style.display  = isCtieu?'':'none';
  document.getElementById('btnAddKn').style.display     = isKn?'':'none';

  if(isThongKe||isCtieu||isKn){
    const pillTxt={thongke:'Thống kê',chitieu:allChiTieu.length+' mục',kiennghi:allKienNghi.length+' mục'};
    document.getElementById('tbPill').textContent=pillTxt[page]||'';
  }

  if(isList){
    document.getElementById('toolLabel').textContent=d.tl;
    document.getElementById('toolDot').className='sec-dot '+d.dot;
    document.getElementById('searchInput').value='';
    document.getElementById('filterPL').value='';
    document.getElementById('filterLT').value='';
    document.getElementById('filterMonth').value='';
    document.getElementById('filterGH').value='';
    document.getElementById('filterKQ').value='';
    document.getElementById('sortField').value='';
    curPg=1;applyView();
  }
  if(isCtieu) renderCtTable();
  if(isKn)    renderKnTable();
}
function navToKey(page){const btn=document.querySelector('.nav-item[data-page="'+page+'"]');if(btn)navTo(page,btn);}

// ═══ FILTER ═══
function applyView(){
  const c=categorize(allRec);
  let base=curView==='tonghop'?allRec.filter(r=>!isTdcNamCu(r)):
           curView==='phuchoi'?c.phuchoi:
           c[{dagiaiquyet:'gq',dangcho:'cho',tamdinh:'td'}[curView]]||[];
  const q=(document.getElementById('searchInput').value||'').toLowerCase();
  const pl=document.getElementById('filterPL').value;
  const lt=document.getElementById('filterLT').value;
  const mo=document.getElementById('filterMonth').value;
  const gh=document.getElementById('filterGH').value;
  const kqF=document.getElementById('filterKQ').value;
  const sort=document.getElementById('sortField').value;

  const pD=s=>{if(!s)return 0;const m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():0;};
  const ghDate=r=>{const v=r['QĐ gia hạn thời hạn giải quyết']||'';const m=v.match(/(\d{2}\/\d{2}\/\d{4})/);return m?m[1]:''};
  const hasGH=r=>!!(r['QĐ gia hạn thời hạn giải quyết']||'').trim();

  filt=base.filter(r=>{
    if(q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
    if(pl && r['Phân loại']!==pl) return false;
    if(lt && r['Loại tội']!==lt) return false;
    if(mo && r['Thời điểm tính số liệu']!==mo) return false;
    if(gh==='cogiahan' && !hasGH(r)) return false;
    if(gh==='chuagiahan' && hasGH(r)) return false;
    if(kqF==='dagiaiquyet' && r['_trangThai']!=='dagiaiquyet' && r['_trangThai']!=='kkthethoihieu') return false;
    if(kqF==='chuagq' && (r['_trangThai']==='dagiaiquyet'||r['_trangThai']==='kkthethoihieu')) return false;
    if(kqF==='khoito'){const kqRaw=(r['Kết quả giải quyết']||'');if(!kqRaw.match(/khởi tố vụ án|^khởi tố/i))return false;}
    if(kqF==='khongkhoito'){const kqRaw=(r['Kết quả giải quyết']||'');if(!kqRaw.match(/không khởi tố|kkt/i)||kqRaw.match(/hết thời hiệu/i))return false;}
    if(kqF==='kkthethoihieu' && r['_trangThai']!=='kkthethoihieu') return false;
    return true;
  });

  if(sort){
    if(sort==='stt_asc') filt.sort((a,b)=>(+a['STT']||0)-(+b['STT']||0));
    else if(sort==='stt_desc') filt.sort((a,b)=>(+b['STT']||0)-(+a['STT']||0));
    else if(sort==='ngay_asc') filt.sort((a,b)=>pD(a['Ngày VKS thụ lý'])-pD(b['Ngày VKS thụ lý']));
    else if(sort==='ngay_desc') filt.sort((a,b)=>pD(b['Ngày VKS thụ lý'])-pD(a['Ngày VKS thụ lý']));
    else if(sort==='month') filt.sort((a,b)=>(MONTH_ORDER[a['Thời điểm tính số liệu']]??99)-(MONTH_ORDER[b['Thời điểm tính số liệu']]??99));
    else if(sort==='hoten') filt.sort((a,b)=>(a['Họ và tên']||'').localeCompare(b['Họ và tên']||'','vi'));
    else if(sort==='loaitoi') filt.sort((a,b)=>(a['Loại tội']||'').localeCompare(b['Loại tội']||'','vi'));
    else if(sort==='giahan_asc') filt.sort((a,b)=>pD(ghDate(a))-pD(ghDate(b)));
    else if(sort==='giahan_desc') filt.sort((a,b)=>pD(ghDate(b))-pD(ghDate(a)));
  }

  document.getElementById('tbPill').textContent=filt.length+' tin';
  renderChips();
  curPg=1;renderTbl();
}
function applyFilter(){applyView();}

// ═══ RENDER TABLE ═══
function renderTbl(){
  const start=(curPg-1)*PG,pg=filt.slice(start,start+PG);
  const tbody=document.getElementById('tblBody'),thead=document.getElementById('tblHead');
  const empty=document.getElementById('emptyState');

  thead.innerHTML=`<tr>
    <th style="width:36px">STT</th>
    <th style="width:82px">Ngày thụ lý</th>
    <th style="width:58px">Thời hạn</th>
    <th>Loại tội — Nơi xảy ra</th>
    <th style="width:85px">KSV</th>
    <th style="width:88px">Trạng thái</th>
    <th style="width:95px">Kết quả</th>
    <th style="min-width:56px" class="act-th">⚙️</th>
  </tr>`;

  if(!filt.length){tbody.innerHTML='';empty.style.display='';document.getElementById('pager').innerHTML='';return;}
  empty.style.display='none';

  tbody.innerHTML=pg.map(r=>{
    const dl=getDeadlineInfo(r);
    const kqRaw=(r['Kết quả giải quyết']||'').trim();
    const kq=kqRaw.match(/khởi tố vụ án|^khởi tố/i)?'Khởi tố':kqRaw.match(/hết thời hiệu/i)?'Không khởi tố - Hết thời hiệu':kqRaw.match(/không khởi tố|kkt/i)?'Không khởi tố':'';
    const tt=r['_trangThai'];
    const monthVal=(r['Thời điểm tính số liệu']||'').trim();
    const monthCls=MONTH_CLS[monthVal]||'';
    const isPHInTD=(tt==='phuchoi')&&curView==='tamdinh';
    let rowCls=isPHInTD?'row-phuchoi':monthCls;
    if(!isPHInTD){
      if(dl&&dl.status==='over'&&!kq) rowCls='row-over';
      else if(dl&&dl.status==='near'&&!kq) rowCls=(monthCls?monthCls+' ':'')+'row-near';
    }
    const lt=r['Loại tội']||'';
    const noi=r['Nơi xảy ra']||'';
    const caxTag=r['Công an xã thụ lý']==='Có'?'<span class="cax-badge" style="font-size:9px;margin-left:4px">CAX</span>':'';
    const loaiNoiText=`<div style="font-weight:600;font-size:11.5px;color:var(--navy)">${lt||'—'}${caxTag}</div>${noi?`<div style="font-size:10.5px;color:var(--muted)">${noi}</div>`:''}`;
    const stMap={dangcho:['b-gray','⏳ Đang chờ'],dagiaiquyet:['b-green','✅ Đã GQ'],kkthethoihieu:['b-amber','⏱ Hết TH'],tamdinh:['b-purple','⏸ TĐC'],phuchoi:['b-blue','🔄 PH']};
    const [bCls,bLbl]=stMap[tt]||stMap.dangcho;
    let stExtra='';
    if(tt==='tamdinh'&&dl&&dl.isTdc&&dl.thoiHieuNam){
      if(dl.thStatus==='het') stExtra='<div style="font-size:9px;color:#dc2626;font-weight:700">⚠ Hết TH TCTNHS</div>';
      else if(dl.thStatus==='near') stExtra=`<div style="font-size:9px;color:#d97706">⚠ ${dl.daysLeft}n TH</div>`;
    }
    const stCell=`<span class="badge ${bCls}" style="font-size:10px">${bLbl}</span>${stExtra}`;
    const kqShort=kqRaw?kqRaw.replace(/^(Không khởi tố - Hết thời hiệu|Không khởi tố|Khởi tố vụ án|Khởi tố),?\s*/i,'').substring(0,25):'';
    const kqCell=kqRaw?`<div>${kqBadge(kq)}</div>${kqShort?`<div style="font-size:10px;color:var(--muted)">${kqShort}${kqRaw.length>40?'…':''}</div>`:''}`:'<span style="color:var(--muted);font-size:10.5px">—</span>';

    return`<tr class="${rowCls}" onclick="openDetail(${r.rowIndex})" title="Bấm xem chi tiết" style="cursor:pointer">
      <td class="t-c" style="font-weight:700;font-size:12px">${r['STT']}</td>
      <td style="white-space:nowrap;font-size:11.5px">${r['Ngày VKS thụ lý']}</td>
      <td>${renderDlCell(dl,kq)}</td>
      <td>${loaiNoiText}</td>
      <td style="font-size:11px">${r['Họ tên Kiểm sát viên thụ lý']||'<span style="color:var(--muted)">—</span>'}</td>
      <td>${stCell}</td>
      <td>${kqCell}</td>
      <td class="act-cell" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-xs" onclick="openEdit(${r.rowIndex})" title="Sửa">✏️</button>
        ${curView==='tamdinh'&&tt==='tamdinh'?`<button class="btn btn-ghost btn-xs" style="color:#1d4ed8;font-size:10px" onclick="openPhucHoiForm(${r.rowIndex})" title="Phục hồi">🔄</button>`:''}
        <button class="btn btn-danger btn-xs" onclick="delRec(${r.rowIndex})" title="Xóa">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  renderPager();
}

function renderDlCell(dl,kq){
  if(!dl)return'<span style="color:#aaa;font-size:11px">—</span>';
  if(kq)return'<span class="badge b-green" style="font-size:10px">Hoàn thành</span>';
  if(dl.status==='paused'){
    if(dl.isTdc&&dl.thoiHieuNam){
      const lbl=dl.thStatus==='het'?`<span class="days-red" style="font-weight:700">Hết thời hiệu!</span>`
        :dl.thStatus==='near'?`<span class="days-orange" style="font-weight:700">Còn ${dl.daysLeft}n thời hiệu</span>`
        :dl.thStatus==='warn'?`<span class="days-yellow">Còn ${Math.floor(dl.daysLeft/30)} tháng TH</span>`
        :`<span class="days-purple">TH: ${dpFmt(dl.hetHan)}</span>`;
      return`<div style="display:flex;flex-direction:column;gap:2px"><span class="badge b-purple" style="font-size:10px;align-self:flex-start">Tạm đình chỉ</span><span style="font-size:10px">${lbl}</span></div>`;
    }
    if(dl.noThoiHieu) return'<span class="badge b-purple" style="font-size:10px">TĐC ⚠️ chưa chọn TH</span>';
    return'<span class="badge b-purple" style="font-size:10px">Tạm đình chỉ</span>';
  }
  const fc=dl.status==='over'?'dl-over':dl.status==='near'?'dl-near':'dl-ok';
  const tc=dl.status==='over'?'days-red':dl.status==='near'?'days-orange':'days-green';
  const lbl=dl.status==='over'?`Quá ${Math.abs(dl.remaining)}n`:`Còn ${dl.remaining}/${dl.maxDays}n`;
  const ghTag=dl.hasGH?`<span style="font-size:9px;color:var(--muted);display:block;margin-top:1px">GH+${dl.ghNgay}n</span>`:'';
  return`<div class="dl-cell"><span class="${tc}" style="min-width:72px;font-size:11px">${lbl}${ghTag}</span><div class="dl-bar"><div class="dl-fill ${fc}" style="width:${dl.pct}%"></div></div></div>`;
}

// ═══ CHIP LỌC ĐANG ÁP DỤNG ═══
function renderChips(){
  const row=document.getElementById('chipRow');
  if(!row)return;
  const g=id=>document.getElementById(id).value;
  const chips=[];
  const q=g('searchInput');
  if(q)chips.push({id:'searchInput',lbl:'Tìm: <b>"'+escH(q)+'"</b>'});
  if(g('filterPL'))chips.push({id:'filterPL',lbl:'Phân loại: <b>'+escH(g('filterPL'))+'</b>'});
  if(g('filterLT'))chips.push({id:'filterLT',lbl:'Loại tội: <b>'+escH(g('filterLT'))+'</b>'});
  if(g('filterMonth'))chips.push({id:'filterMonth',lbl:'Thời điểm: <b>'+escH(g('filterMonth'))+'</b>'});
  if(g('filterGH'))chips.push({id:'filterGH',lbl:'<b>'+(g('filterGH')==='cogiahan'?'Có gia hạn':'Chưa gia hạn')+'</b>'});
  if(g('filterKQ')){const m={'dagiaiquyet':'Đã giải quyết','khoito':'Khởi tố','khongkhoito':'Không khởi tố','kkthethoihieu':'KKT hết thời hiệu','chuagq':'Chưa giải quyết'};chips.push({id:'filterKQ',lbl:'<b>'+(m[g('filterKQ')]||g('filterKQ'))+'</b>'});}
  if(g('sortField')){const sel=document.getElementById('sortField');chips.push({id:'sortField',lbl:'Sắp xếp: <b>'+escH(sel.options[sel.selectedIndex].text)+'</b>'});}
  if(!chips.length){row.classList.remove('show');row.innerHTML='';return;}
  row.innerHTML='<span style="font-size:10.5px;font-weight:700;color:var(--muted)">Đang lọc:</span>'+
    chips.map(c=>`<span class="chip">${c.lbl}<button class="chip-x" onclick="clearChip('${c.id}')" title="Bỏ lọc này">×</button></span>`).join('')+
    `<button class="chip-clear" onclick="clearAllChips()">✕ Xóa tất cả lọc</button>`;
  row.classList.add('show');
}
function clearChip(id){document.getElementById(id).value='';applyFilter();}
function clearAllChips(){
  ['searchInput','filterPL','filterLT','filterMonth','filterGH','filterKQ','sortField']
    .forEach(id=>document.getElementById(id).value='');
  applyFilter();
}
function escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ═══ MODAL CHI TIẾT TIN BÁO ═══
const TT_BADGE={
  dangcho:['b-gray','⏳ Đang chờ giải quyết'],
  dagiaiquyet:['b-green','✅ Đã giải quyết'],
  kkthethoihieu:['b-amber','⏱ KKT — Hết thời hiệu'],
  tamdinh:['b-purple','⏸ Đang tạm đình chỉ'],
  phuchoi:['b-blue','🔄 Đã phục hồi — đang chờ GQ'],
};
function dtItem(lbl,val,full){
  const v=(val==null||String(val).trim()==='')?'<span class="dt-val muted">—</span>':'<div class="dt-val">'+val+'</div>';
  return`<div class="dt-item${full?' full':''}"><div class="dt-lbl">${lbl}</div>${v}</div>`;
}
function openDetail(ri){
  const r=allRec.find(x=>x.rowIndex===ri);
  if(!r)return;
  const tt=r['_trangThai'];
  const [bCls,bTxt]=TT_BADGE[tt]||TT_BADGE.dangcho;
  document.getElementById('dtTitle').innerHTML=`Tin báo #${escH(r['STT'])} &nbsp;<span class="badge ${bCls}" style="font-size:11px">${bTxt}</span>`;

  const dl=getDeadlineInfo(r);
  const kqRaw=(r['Kết quả giải quyết']||'').trim();

  let dlBox='';
  if(kqRaw){
    dlBox=`<div class="dt-dlbox"><span class="badge b-green">✅ Hoàn thành giải quyết</span>
      <span style="font-size:12px;color:var(--muted);margin-left:8px">${escH(kqRaw)}</span></div>`;
  }else if(dl&&dl.status==='paused'){
    let th='';
    if(dl.isTdc&&dl.thoiHieuNam){
      const lbl=dl.thStatus==='het'?`<span class="days-red" style="font-weight:700">⚠️ ĐÃ HẾT thời hiệu TCTNHS (${dpFmt(dl.hetHan)})</span>`
        :dl.thStatus==='near'?`<span class="days-orange" style="font-weight:700">⚠️ Còn ${dl.daysLeft} ngày thời hiệu — hết hạn ${dpFmt(dl.hetHan)}</span>`
        :dl.thStatus==='warn'?`<span class="days-yellow">Còn ${Math.floor(dl.daysLeft/30)} tháng thời hiệu — hết hạn ${dpFmt(dl.hetHan)}</span>`
        :`<span style="color:var(--muted)">Thời hiệu TCTNHS ${dl.thoiHieuNam} năm — hết hạn ${dpFmt(dl.hetHan)}</span>`;
      th=`<div style="font-size:12px;margin-top:6px">${lbl}</div>`;
    }else if(dl.noThoiHieu){
      th=`<div style="font-size:12px;margin-top:6px;color:var(--danger);font-weight:600">⚠️ Chưa chọn thời hiệu TCTNHS — hãy sửa tin để bổ sung</div>`;
    }
    dlBox=`<div class="dt-dlbox"><span class="badge b-purple">⏸ Tạm đình chỉ — không tính thời hạn giải quyết</span>${th}</div>`;
  }else if(dl){
    const fc=dl.status==='over'?'dl-over':dl.status==='near'?'dl-near':'dl-ok';
    const tc=dl.status==='over'?'days-red':dl.status==='near'?'days-orange':'days-green';
    const lbl=dl.status==='over'?`⚠️ QUÁ HẠN ${Math.abs(dl.remaining)} ngày`:`Còn ${dl.remaining} / ${dl.maxDays} ngày`;
    const han=new Date(dl.start.getTime()+dl.maxDays*864e5);
    dlBox=`<div class="dt-dlbox">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;flex-wrap:wrap;gap:6px">
        <span class="${tc}" style="font-size:14px;font-weight:700">${lbl}</span>
        <span style="font-size:11.5px;color:var(--muted)">Tính từ ${dpFmt(dl.start)} → hạn cuối <b>${dpFmt(han)}</b>${dl.hasGH?' (đã gia hạn +'+dl.ghNgay+' ngày)':''}</span>
      </div>
      <div class="dl-bar"><div class="dl-fill ${fc}" style="width:${dl.pct}%"></div></div>
    </div>`;
  }

  let tl='';
  try{
    const list=JSON.parse(r['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');
    if(list.length){
      const sorted=[...list].sort((a,b)=>{
        const pa=dpParseVal(a.ngay),pb=dpParseVal(b.ngay);
        return(pa?pa.getTime():0)-(pb?pb.getTime():0);
      });
      let tdC=0,phC=0;
      tl=`<div class="dt-sec"><span>Diễn biến tạm đình chỉ / phục hồi</span></div><div class="tl">`+
        sorted.map(q=>{
          const isTd=q.loai==='tamdinhchi';
          const lan=isTd?++tdC:++phC;
          return`<div class="tl-item">
            <div class="tl-dot ${isTd?'td':'ph'}">${isTd?'⏸':'▶'}</div>
            <div class="tl-body">
              <div class="tl-title ${isTd?'td':'ph'}">${isTd?'Tạm đình chỉ':'Phục hồi giải quyết'} (Lần ${lan}) — QĐ số ${escH(q.so||'?')} ngày ${escH(q.ngay||'?')}</div>
              ${q.lydo?`<div class="tl-meta">Lý do: ${escH(q.lydo)}</div>`:''}
              ${(isTd&&q.thoiHieu)?`<div class="tl-meta">⏳ Thời hiệu TCTNHS: <b>${escH(q.thoiHieu)} năm</b></div>`:''}
            </div>
          </div>`;
        }).join('')+`</div>`;
    }
  }catch(e){}

  const hq=[];
  if(+(r['Hậu quả - Người chết']||0)>0)hq.push(`<span class="hq-tag hq-red">💀 ${escH(r['Hậu quả - Người chết'])} người chết</span>`);
  if(+(r['Hậu quả - Người bị thương']||0)>0)hq.push(`<span class="hq-tag hq-orange">🤕 ${escH(r['Hậu quả - Người bị thương'])} người bị thương</span>`);
  if((r['Hậu quả - Thiệt hại tài sản']||'').trim())hq.push(`<span class="hq-tag hq-amber">💰 ${escH(r['Hậu quả - Thiệt hại tài sản'])}</span>`);
  if((r['Hậu quả - Ghi chú khác']||'').trim())hq.push(`<span style="font-size:12px;color:var(--muted)">${escH(r['Hậu quả - Ghi chú khác'])}</span>`);

  const yc=(r['Yêu cầu KT/KKT (loại)']||'').trim();

  document.getElementById('dtBody').innerHTML=`<div class="dt-grid">
    ${dlBox}
    <div class="dt-sec"><span>Thông tin tiếp nhận</span></div>
    ${dtItem('Ngày VKS thụ lý',escH(r['Ngày VKS thụ lý']))}
    ${dtItem('Ngày CSĐT thụ lý',escH(r['Ngày CSĐT thụ lý']))}
    ${dtItem('Thời điểm tính số liệu',escH(r['Thời điểm tính số liệu']))}
    ${dtItem('Công an xã thụ lý',r['Công an xã thụ lý']==='Có'?'<span class="cax-badge">🏘️ Có</span>':'Không')}
    ${dtItem('Phân loại',plBadge(r['Phân loại']))}
    ${dtItem('Loại tội',ltBadge(r['Loại tội']))}
    <div class="dt-sec"><span>Nội dung sự việc</span></div>
    ${dtItem('Ngày xảy ra',escH(r['Ngày xảy ra']))}
    ${dtItem('Nơi xảy ra',escH(r['Nơi xảy ra']))}
    ${dtItem('Họ và tên',escH(r['Họ và tên']))}
    ${dtItem('Địa chỉ / Cơ quan tổ chức',escH(r['Địa chỉ cá nhân / Cơ quan tổ chức']))}
    ${dtItem('Tóm tắt nội dung sự việc',escH(r['Tóm tắt nội dung sự việc']),true)}
    ${hq.length?`<div class="dt-item full"><div class="dt-lbl">Hậu quả</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px">${hq.join('')}</div></div>`:''}
    <div class="dt-sec"><span>Phân công thụ lý</span></div>
    ${dtItem('Phó Viện trưởng',escH(r['Họ tên Phó viện trưởng thụ lý']))}
    ${dtItem('Kiểm sát viên',escH(r['Họ tên Kiểm sát viên thụ lý']))}
    ${(r['QĐ gia hạn thời hạn giải quyết']||'').trim()?`<div class="dt-sec"><span>Gia hạn</span></div>
      ${dtItem('QĐ gia hạn',escH(r['QĐ gia hạn thời hạn giải quyết']))}
      ${dtItem('Số ngày gia hạn',escH(r['Số ngày gia hạn']))}`:''}
    ${tl}
    ${yc?`<div class="dt-sec"><span>Yêu cầu của VKS</span></div>
      ${dtItem('Loại yêu cầu',ycBadge(yc))}
      ${dtItem('Số / Ngày QĐ','S.'+escH(r['Yêu cầu KT/KKT (số QĐ)']||'?')+' — '+escH(r['Yêu cầu KT/KKT (ngày QĐ)']||'?'))}`:''}
    <div class="dt-sec"><span>Kết quả giải quyết</span></div>
    ${dtItem('Kết quả',kqRaw?escH(kqRaw):'',true)}
    ${(r['Ghi chú vụ việc']||'').trim()?dtItem('Ghi chú vụ việc',escH(r['Ghi chú vụ việc']),true):''}
  </div>`;

  document.getElementById('dtFoot').innerHTML=`
    <button class="btn btn-danger" onclick="closeOvl('detailOverlay');delRec(${ri})">🗑️ Xóa</button>
    ${tt==='tamdinh'?`<button class="btn btn-ghost" style="color:#1d4ed8" onclick="closeOvl('detailOverlay');openPhucHoiForm(${ri})">🔄 Phục hồi</button>`:''}
    <button class="btn btn-ghost" onclick="closeOvl('detailOverlay')">Đóng</button>
    <button class="btn btn-primary" onclick="closeOvl('detailOverlay');openEdit(${ri})">✏️ Sửa tin báo</button>`;

  document.getElementById('detailOverlay').classList.add('show');
}

let warnExpanded=false;
function toggleWarnPanel(){
  warnExpanded=!warnExpanded;
  const el=document.getElementById('warnList');
  const btn=document.getElementById('warnToggle');
  if(warnExpanded){el.style.maxHeight='400px';btn.textContent='▲ Thu gọn';}
  else{el.style.maxHeight='78px';btn.textContent='▼ Mở rộng';}
}
function renderPager(){
  const total=filt.length,pages=Math.ceil(total/PG),el=document.getElementById('pager');
  if(pages<=1){el.innerHTML='';return;}
  const s=Math.min((curPg-1)*PG+1,total),e2=Math.min(curPg*PG,total);
  let h=`<span class="pager-info">${s}–${e2} / ${total}</span>`;
  h+=`<button class="pb" onclick="goPg(${curPg-1})" ${curPg===1?'disabled':''}>‹</button>`;
  for(let i=1;i<=pages;i++){
    if(pages>8&&Math.abs(i-curPg)>2&&i!==1&&i!==pages){if(i===2||i===pages-1)h+=`<span style="color:#aaa;padding:0 2px">…</span>`;continue;}
    h+=`<button class="pb ${i===curPg?'on':''}" onclick="goPg(${i})">${i}</button>`;
  }
  h+=`<button class="pb" onclick="goPg(${curPg+1})" ${curPg===pages?'disabled':''}>›</button>`;
  el.innerHTML=h;
}
function goPg(p){const pages=Math.ceil(filt.length/PG);if(p<1||p>pages)return;curPg=p;renderTbl();}

// ═══ BADGES ═══
function plBadge(v){if(!v)return'—';const m={'Tố giác tội phạm':'b-blue','Tin báo về tội phạm':'b-teal','Kiến nghị khởi tố':'b-gray'};return`<span class="badge ${m[v]||'b-gray'}" style="font-size:10px">${v}</span>`;}
function kqBadge(v){
  if(!v)return'<span class="badge b-gray">Chưa GQ</span>';
  if(v==='Không khởi tố - Hết thời hiệu')return`<span class="badge b-amber" style="font-size:10px">KKT hết thời hiệu</span>`;
  if(v==='Không khởi tố')return`<span class="badge b-red">${v}</span>`;
  if(v==='Khởi tố')return`<span class="badge b-green">${v}</span>`;
  return`<span class="badge b-gray">${v}</span>`;
}
function ycBadge(v){if(!v)return'—';if(v==='Không khởi tố')return`<span class="badge b-red" style="font-size:10px">${v}</span>`;if(v.includes('Khởi tố'))return`<span class="badge b-green" style="font-size:10px">${v}</span>`;return`<span class="badge b-amber" style="font-size:10px">${v}</span>`;}
function ltBadge(v){if(!v)return'—';const m={
  'TNGT':'b-orange','Tai nạn lao động':'b-orange',
  'Cố ý gây thương tích':'b-red','Giết người':'b-red','Bạo lực gia đình':'b-red',
  'Chết chưa rõ nguyên nhân':'b-red','Cháy chưa rõ nguyên nhân':'b-red',
  'Trộm cắp tài sản':'b-amber','Cướp tài sản':'b-orange','Cướp giật tài sản':'b-orange',
  'Lừa đảo chiếm đoạt TS':'b-amber','Lạm dụng tín nhiệm chiếm đoạt TS':'b-amber',
  'Hủy hoại/Khai thác trái phép TS':'b-amber',
  'Ma túy':'b-purple','Tàng trữ ma túy':'b-purple','Mua bán ma túy':'b-purple',
  'Vận chuyển ma túy':'b-purple','Tổ chức sử dụng ma túy':'b-purple',
  'Hiếp dâm':'b-pink','Cưỡng dâm':'b-pink',
  'Giao cấu với người dưới 16 tuổi':'b-pink','Dâm ô với người dưới 16 tuổi':'b-pink',
  'Đánh bạc':'b-teal','Tổ chức đánh bạc':'b-teal',
  'Vi phạm quy định về an toàn giao thông':'b-orange',
  'Vi phạm quy định về khai thác tài nguyên':'b-teal',
  'Tham nhũng':'b-blue','Nhận hối lộ':'b-blue','Lợi dụng chức vụ quyền hạn':'b-blue',
  'Môi trường':'b-teal','Chống người thi hành công vụ':'b-red',
  'Gây rối trật tự công cộng':'b-amber','Trốn thuế':'b-blue',
  'Bắt giữ người trái pháp luật':'b-red',
};return`<span class="badge ${m[v]||'b-gray'}" style="font-size:10px">${v}</span>`;}

// ═══ YÊU CẦU / KẾT QUẢ TOGGLE ═══
function toggleYKQ(prefix){
  const val=document.getElementById('f_yeucau_loai').value;
  const det=document.getElementById('ycDetail');
  if(val) det.classList.add('show'); else det.classList.remove('show');
}

function switchKQDateMode(){
  const isFull=document.getElementById('kq_mode_full').checked;
  document.getElementById('kq_input_full').style.display=isFull?'':'none';
  document.getElementById('kq_input_month').style.display=isFull?'none':'flex';
  buildKQStr();
}

(function initKQYears(){
  const sel=document.getElementById('f_ketqua_nam');
  if(!sel)return;
  const now=new Date().getFullYear();
  for(let y=now+1;y>=now-5;y--){
    const opt=document.createElement('option');
    opt.value=y;opt.textContent='Năm '+y;
    sel.appendChild(opt);
  }
})();

function buildKQStr(returnVal){
  const loai=document.getElementById('f_ketqua_loai').value;
  const so=(document.getElementById('f_ketqua_so').value||'').trim();
  const isFull=document.getElementById('kq_mode_full').checked;
  let dateStr='';
  if(isFull){
    dateStr=(document.getElementById('f_ketqua_ngay').value||'').trim();
  } else {
    const th=document.getElementById('f_ketqua_thang').value;
    const nm=document.getElementById('f_ketqua_nam').value;
    if(th&&nm) dateStr=`${th}/${nm}`;
    else if(nm) dateStr=nm;
  }
  let str='';
  if(loai){
    str=loai;
    if(so) str+=`, số ${so}`;
    if(dateStr) str+=isFull?` ngày ${dateStr}`:` tháng ${dateStr}`;
  }
  const pv=document.getElementById('kqPreview');
  if(pv){
    if(str){pv.style.display='block';pv.textContent='→ '+str;}
    else{pv.style.display='none';pv.textContent='';}
  }
  return returnVal?str:undefined;
}

// ═══ TDPH (Tạm đình chỉ / Phục hồi) ═══
let tdphItems=[];
const LY_DO_TDC = [
  '',
  'Đã trưng cầu giám định, yêu cầu định giá tài sản nhưng chưa có kết quả (Điều 148 khoản 1 điểm a BLTTHS)',
  'Đã yêu cầu nước ngoài tương trợ tư pháp nhưng chưa có kết quả (Điều 148 khoản 1 điểm a BLTTHS)',
  'Đã yêu cầu cơ quan, tổ chức, cá nhân cung cấp tài liệu, đồ vật quan trọng có ý nghĩa quyết định đối với việc khởi tố hoặc không khởi tố vụ án nhưng chưa có kết quả (Điều 148 khoản 1 điểm b BLTTHS)',
];

function renderTDPHList(){
  const container=document.getElementById('tdphList');
  let tdCount=0,phCount=0;
  const lanMap=tdphItems.map(item=>{
    if(item.loai==='tamdinhchi'){tdCount++;return tdCount;}
    else{phCount++;return phCount;}
  });
  container.innerHTML=tdphItems.map((item,idx)=>`
    <div class="tdph-item" id="tdph_${item.id}">
      <div style="display:flex;align-items:flex-start;gap:8px;width:100%">
        <span class="tdph-type ${item.loai==='tamdinhchi'?'td':'ph'}">${item.loai==='tamdinhchi'?'⏸ Tạm đình chỉ':'▶ Tiếp tục GQ'} <b style="margin-left:3px">- Lần ${lanMap[idx]}</b></span>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input class="tdph-so" type="text" placeholder="Số QĐ" value="${item.so||''}" oninput="tdphItems[${idx}].so=this.value">
            <div class="dp-wrap" style="flex:1;min-width:130px">
              <input class="tdph-ngay qd-ngay fc" type="text" placeholder="dd/MM/yyyy" value="${item.ngay||''}"
                oninput="tdphItems[${idx}].ngay=this.value;dpSyncInlineFromInput('tdph_dp_${item.id}','${item.id}',${idx})"
                onblur="dpValidateInput(null,'tdph_dp_${item.id}',${idx})"
                onclick="toggleInlineDP('tdph_dp_${item.id}','${item.id}',${idx})">
              <span class="dp-icon" onclick="toggleInlineDP('tdph_dp_${item.id}','${item.id}',${idx})">📅</span>
              <div class="dp-popup" id="tdph_dp_${item.id}"></div>
            </div>
          </div>
          ${item.loai==='tamdinhchi'?`<select class="fc" style="font-size:11.5px" onchange="tdphItems[${idx}].lydo=this.value" title="Lý do tạm đình chỉ">
            ${LY_DO_TDC.map(l=>`<option value="${l}" ${(item.lydo||'')=== l?'selected':''}>${l||'-- Chọn lý do (nếu có) --'}</option>`).join('')}
          </select>
          <select class="fc" style="font-size:11.5px" onchange="tdphItems[${idx}].thoiHieu=this.value" title="Thời hạn truy cứu TNHS (Điều 27 BLHS)">
            <option value="" ${!item.thoiHieu?'selected':''}>-- Thời hạn truy cứu TNHS --</option>
            <option value="5" ${item.thoiHieu==='5'?'selected':''}>5 năm (tội ít nghiêm trọng)</option>
            <option value="10" ${item.thoiHieu==='10'?'selected':''}>10 năm (tội nghiêm trọng)</option>
            <option value="15" ${item.thoiHieu==='15'?'selected':''}>15 năm (tội rất nghiêm trọng)</option>
            <option value="20" ${item.thoiHieu==='20'?'selected':''}>20 năm (tội đặc biệt nghiêm trọng)</option>
          </select>`:''}
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <span style="font-size:10px;font-weight:700;color:#0369a1;white-space:nowrap">Ngày tính SL:</span>
            <input class="fc" type="text" placeholder="dd/MM/yyyy — trống = lấy ngày QĐ" value="${item.ngayTSL||''}"
              oninput="tdphItems[${idx}].ngayTSL=this.value" style="font-size:11px;padding:4px 8px;flex:1;min-width:130px;border-color:#bae6fd;background:#f0f9ff">
          </div>
        </div>
        <button class="tdph-del" onclick="removeTDPH(${idx})" title="Xóa">×</button>
      </div>
    </div>`).join('');

  const addRow=document.querySelector('.tdph-add-row');
  if(addRow){
    const existBtn=addRow.querySelector('.btn-ttgq');
    if(curView==='tamdinh'&&!existBtn){
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn-sm2 btn-ttgq';
      btn.style.cssText='background:#dcfce7;color:#15803d;border-color:#86efac';
      btn.textContent='＋ QĐ Tiếp tục giải quyết';
      btn.onclick=()=>addTDPH('phuchoi');
      addRow.insertBefore(btn,addRow.children[1]);
    } else if(curView!=='tamdinh'&&existBtn){
      existBtn.remove();
    }
  }
}

function addTDPH(loai){
  tdphItems.push({id:++tdphCounter,loai,so:'',ngay:'',lydo:'',thoiHieu:'',ngayTSL:''});
  renderTDPHList();
}
function removeTDPH(idx){tdphItems.splice(idx,1);renderTDPHList();}

// ═══ FORM OPEN/SAVE ═══
function calcDlHintText(){
  const ngayVKS=document.getElementById('f_ngay').value||'';
  const ngayCSĐT=document.getElementById('f_ngay_csdt').value||'';
  const raw=ngayCSĐT||ngayVKS;
  const hint=document.getElementById('dlHint');
  const hintGH=document.getElementById('dlHintGH');
  const dt=dpParseVal(raw);
  if(!dt){hint.style.display='none';if(hintGH)hintGH.style.display='none';return;}

  const today=new Date();today.setHours(0,0,0,0);
  const elapsed=Math.floor((today-dt)/864e5);

  const remBase=DEADLINE_NORMAL-elapsed;
  hint.style.display='flex';
  if(remBase<0){hint.className='dl-hint over';hint.textContent=`⛔ Quá hạn cơ bản ${Math.abs(remBase)} ngày (thời hạn 2 tháng/60 ngày)`;}
  else if(remBase<=7){hint.className='dl-hint warn';hint.textContent=`⚠️ Còn ${remBase} ngày trong thời hạn 2 tháng (60 ngày)`;}
  else{hint.className='dl-hint';hint.textContent=`ℹ️ Còn ${remBase} ngày trong thời hạn cơ bản 2 tháng (60 ngày)`;}

  const ghNgay=+(document.getElementById('f_giahan_ngayso').value||0);
  if(hintGH){
    if(ghNgay>0){
      const maxTotal=DEADLINE_NORMAL+ghNgay;
      const remGH=maxTotal-elapsed;
      hintGH.style.display='flex';
      if(remGH<0){hintGH.className='dl-hint over';hintGH.textContent=`⛔ Quá hạn gia hạn ${Math.abs(remGH)} ngày (tổng ${maxTotal} ngày)`;}
      else if(remGH<=5){hintGH.className='dl-hint warn';hintGH.textContent=`⚠️ Còn ${remGH} ngày trong thời hạn gia hạn (tổng ${maxTotal} ngày)`;}
      else{hintGH.className='dl-hint';hintGH.textContent=`📋 Sau gia hạn ${ghNgay} ngày: còn ${remGH} ngày (tổng thời hạn ${maxTotal} ngày)`;}
    } else {
      hintGH.style.display='none';
    }
  }
}
function calcDlHint(){calcDlHintText();}

function clrForm(){
  ['f_ngay','f_ngay_csdt','f_thoidiemphatsinh','f_phanloai','f_loaitoi','f_ngay_xayra','f_noi_xayra','f_hoten','f_diachi','f_tomtat',
   'f_hq_chet','f_hq_thuong','f_hq_taisan','f_hq_khac',
   'f_pvt','f_ksv','f_giahan_so','f_giahan_ngay','f_giahan_ngayso',
   'f_yeucau_loai','f_yeucau_so','f_yeucau_ngay',
   'f_ketqua_loai','f_ketqua_so','f_ketqua_ngay','f_ketqua_thang','f_ketqua_nam',
   'f_ketqua_ngayTSL',
   'f_ghichu_vv'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('kq_mode_full').checked=true;
  switchKQDateMode();
  document.getElementById('f_caxathuly').checked=false;
  const pv=document.getElementById('kqPreview');if(pv){pv.style.display='none';pv.textContent='';}
  document.getElementById('ycDetail').classList.remove('show');
  tdphItems=[]; renderTDPHList();
  document.getElementById('dlHint').style.display='none';
}

function openAddModal(){
  editRow=null;clrForm();
  document.getElementById('formIcon').textContent='📝';
  document.getElementById('formTitle').textContent='Thêm Tin Báo Mới';
  document.getElementById('f_ngay').value=dpFmt(new Date());
  openOvl('formOverlay');
}

function openEdit(ri){
  const rec=allRec.find(r=>r.rowIndex===ri);if(!rec)return;
  editRow=ri;clrForm();
  document.getElementById('formIcon').textContent='✏️';
  document.getElementById('formTitle').textContent='Chỉnh Sửa Tin Báo';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  set('f_ngay',rec['Ngày VKS thụ lý']);
  set('f_ngay_csdt',rec['Ngày CSĐT thụ lý']);
  set('f_thoidiemphatsinh',rec['Thời điểm tính số liệu']);
  document.getElementById('f_caxathuly').checked = rec['Công an xã thụ lý']==='Có';
  set('f_phanloai',rec['Phân loại']);set('f_loaitoi',rec['Loại tội']);
  set('f_ngay_xayra',rec['Ngày xảy ra']);set('f_noi_xayra',rec['Nơi xảy ra']);
  set('f_hoten',rec['Họ và tên']);set('f_diachi',rec['Địa chỉ cá nhân / Cơ quan tổ chức']);
  set('f_tomtat',rec['Tóm tắt nội dung sự việc']);
  set('f_pvt',rec['Họ tên Phó viện trưởng thụ lý']);set('f_ksv',rec['Họ tên Kiểm sát viên thụ lý']);
  const gh=rec['QĐ gia hạn thời hạn giải quyết']||'';
  const mSo=gh.match(/Số\s+([^,]+)/),mNg=gh.match(/(\d{2}\/\d{2}\/\d{4})/);
  set('f_giahan_so',mSo?mSo[1].trim():'');set('f_giahan_ngay',mNg?mNg[1].trim():'');
  set('f_giahan_ngayso',rec['Số ngày gia hạn']);
  try{tdphItems=JSON.parse(rec['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');tdphItems.forEach(i=>{i.id=++tdphCounter;i.lydo=i.lydo||'';i.thoiHieu=i.thoiHieu||'';});}catch(e){tdphItems=[];}
  renderTDPHList();
  const ycLoai=rec['Yêu cầu KT/KKT (loại)']||'';
  set('f_yeucau_loai',ycLoai);set('f_yeucau_so',rec['Yêu cầu KT/KKT (số QĐ)']);set('f_yeucau_ngay',rec['Yêu cầu KT/KKT (ngày QĐ)']);
  if(ycLoai) document.getElementById('ycDetail').classList.add('show');
  const kqRaw=rec['Kết quả giải quyết']||'';
  const kqLoai=kqRaw.match(/khởi tố vụ án|^khởi tố/i)?'Khởi tố':kqRaw.match(/hết thời hiệu/i)?'Không khởi tố - Hết thời hiệu':kqRaw.match(/không khởi tố|kkt/i)?'Không khởi tố':'';
  const kqSoM=kqRaw.match(/số\s+([^\s,ngàytháng]+)/i);
  const kqThangM=kqRaw.match(/tháng\s+(\d{2})\/(\d{4})/i);
  const kqNgayM=kqRaw.match(/ngày\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)||kqRaw.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
  set('f_ketqua_loai',kqLoai);
  set('f_ketqua_so',kqSoM?kqSoM[1].trim():'');
  if(kqThangM){
    document.getElementById('kq_mode_month').checked=true;
    set('f_ketqua_thang',kqThangM[1]);
    set('f_ketqua_nam',kqThangM[2]);
    set('f_ketqua_ngay','');
  } else {
    document.getElementById('kq_mode_full').checked=true;
    set('f_ketqua_ngay',kqNgayM?kqNgayM[1].replace(/-/g,'/'):'');
    set('f_ketqua_thang','');
    set('f_ketqua_nam','');
  }
  switchKQDateMode();
  buildKQStr();
  set('f_ketqua_ngayTSL',rec['Ngày TSL kết quả']||'');
  set('f_ghichu_vv',rec['Ghi chú vụ việc']);
  set('f_hq_chet',rec['Hậu quả - Người chết']);
  set('f_hq_thuong',rec['Hậu quả - Người bị thương']);
  set('f_hq_taisan',rec['Hậu quả - Thiệt hại tài sản']);
  set('f_hq_khac',rec['Hậu quả - Ghi chú khác']);
  calcDlHint();
  openOvl('formOverlay');
}

function buildGH(){
  const so=document.getElementById('f_giahan_so').value.trim();
  const ng=document.getElementById('f_giahan_ngay').value.trim();
  if(!so&&!ng)return'';
  if(so&&ng)return`Số ${so}, ngày ${ng}`;
  return so||ng;
}

let _saving=false;
function saveRecord(){
  if(_saving)return;
  const gv=id=>document.getElementById(id).value.trim();

  const REQUIRED_ADD = [
    ['f_ngay','Ngày VKS thụ lý'],
    ['f_phanloai','Phân loại'],
    ['f_loaitoi','Loại tội'],
    ['f_ngay_xayra','Ngày xảy ra'],
    ['f_noi_xayra','Nơi xảy ra'],
    ['f_pvt','Phó Viện trưởng thụ lý'],
    ['f_ksv','Kiểm sát viên thụ lý'],
    ['f_tomtat','Tóm tắt nội dung sự việc'],
  ];
  const isAdd = !editRow;
  const checks = isAdd ? REQUIRED_ADD : [['f_ngay','Ngày VKS thụ lý']];
  const missing = [];

  REQUIRED_ADD.forEach(([id])=>{const el=document.getElementById(id);if(el)el.style.border='';});

  for(const [id,label] of checks){
    if(!gv(id)){
      missing.push(label);
      const el=document.getElementById(id);
      if(el){el.style.border='2px solid #ef4444';el.style.background='#fef2f2';}
    }
  }
  if(missing.length){
    toast('⚠️ Thiếu '+missing.length+' trường bắt buộc: '+missing.join(', '),'err');
    const firstId=checks.find(([id])=>!gv(id))?.[0];
    if(firstId)document.getElementById(firstId)?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }

  const hoten=document.getElementById('f_hoten').value.trim();
  const record={
    'Ngày VKS thụ lý':document.getElementById('f_ngay').value,
    'Ngày CSĐT thụ lý':document.getElementById('f_ngay_csdt').value,
    'Thời điểm tính số liệu':document.getElementById('f_thoidiemphatsinh').value,
    'Công an xã thụ lý':document.getElementById('f_caxathuly').checked?'Có':'',
    'Phân loại':document.getElementById('f_phanloai').value,
    'Loại tội':document.getElementById('f_loaitoi').value,
    'Ngày xảy ra':document.getElementById('f_ngay_xayra').value,
    'Nơi xảy ra':document.getElementById('f_noi_xayra').value,
    'Họ và tên':hoten,
    'Địa chỉ cá nhân / Cơ quan tổ chức':document.getElementById('f_diachi').value,
    'Tóm tắt nội dung sự việc':document.getElementById('f_tomtat').value,
    'Họ tên Phó viện trưởng thụ lý':document.getElementById('f_pvt').value,
    'Họ tên Kiểm sát viên thụ lý':document.getElementById('f_ksv').value,
    'QĐ gia hạn thời hạn giải quyết':buildGH(),
    'Số ngày gia hạn':document.getElementById('f_giahan_ngayso').value,
    'Danh sách QĐ tạm đình chỉ / phục hồi':JSON.stringify(tdphItems.map(({loai,so,ngay,lydo,thoiHieu,ngayTSL})=>({loai,so,ngay,lydo:lydo||'',thoiHieu:thoiHieu||'',ngayTSL:ngayTSL||''}))),
    'Yêu cầu KT/KKT (loại)':document.getElementById('f_yeucau_loai').value,
    'Yêu cầu KT/KKT (số QĐ)':document.getElementById('f_yeucau_so').value,
    'Yêu cầu KT/KKT (ngày QĐ)':document.getElementById('f_yeucau_ngay').value,
    'Kết quả giải quyết':buildKQStr(true),
    'Ngày TSL kết quả':document.getElementById('f_ketqua_ngayTSL').value,
    'Ghi chú vụ việc':document.getElementById('f_ghichu_vv').value,
    'Hậu quả - Người chết':document.getElementById('f_hq_chet').value,
    'Hậu quả - Người bị thương':document.getElementById('f_hq_thuong').value,
    'Hậu quả - Thiệt hại tài sản':document.getElementById('f_hq_taisan').value,
    'Hậu quả - Ghi chú khác':document.getElementById('f_hq_khac').value,
  };
  _saving=true;
  showLoad(true);
  if(editRow){
    record['STT']=allRec.find(r=>r.rowIndex===editRow)?.['STT'];
    google.script.run.withSuccessHandler(()=>{_saving=false;closeOvl('formOverlay');loadData();loadChiTieu();toast('Đã cập nhật!');showLoad(false);}).withFailureHandler(e=>{_saving=false;toast('Lỗi: '+e.message,'err');showLoad(false);}).updateRecord(editRow,record);
  }else{
    google.script.run.withSuccessHandler(()=>{_saving=false;closeOvl('formOverlay');loadData();loadChiTieu();toast('Đã thêm!');showLoad(false);}).withFailureHandler(e=>{_saving=false;toast('Lỗi: '+e.message,'err');showLoad(false);}).addRecord(record);
  }
}
function delRec(ri){if(!confirm('Xóa tin báo này?'))return;showLoad(true);google.script.run.withSuccessHandler(()=>{loadData();loadChiTieu();toast('Đã xóa!');showLoad(false);}).withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);}).deleteRecord(ri);}

// ═══ UTILS ═══
function openOvl(id){document.getElementById(id).classList.add('show');}
function closeOvl(id){document.getElementById(id).classList.remove('show');}
function showLoad(v){document.getElementById('loader').classList.toggle('show',v);}
function toast(msg,type='ok'){const el=document.getElementById('toast');el.textContent=(type==='ok'?'✅ ':'❌ ')+msg;el.className='toast show '+type;setTimeout(()=>el.classList.remove('show'),3400);}
// ═══ DATEPICKER ═══
const DP_M=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DP_W=['CN','T2','T3','T4','T5','T6','T7'];

const STATIC_DP_MAP={
  dp_giahan:'f_giahan_ngay',
  dp_yc:'f_yeucau_ngay',
  dp_kq:'f_ketqua_ngay',
  dp_kqtsl:'f_ketqua_ngayTSL',
  dp_f_ngay:'f_ngay',
  dp_f_ngay_csdt:'f_ngay_csdt',
  dp_f_ngay_xayra:'f_ngay_xayra',
  dp_ct_ngay:'ct_ngay',
  dp_kn_ngay:'kn_ngay',
  dp_kn_ngaytl:'kn_ngaytl',
};

function dpParseVal(v){
  if(!v)return null;
  const pts=v.trim().split('/');
  if(pts.length!==3)return null;
  const d=+pts[0],m=+pts[1]-1,y=+pts[2];
  if(isNaN(d)||isNaN(m)||isNaN(y))return null;
  if(y<1900||y>2100||m<0||m>11||d<1||d>31)return null;
  const dt=new Date(y,m,d);
  return(dt.getMonth()===m&&dt.getDate()===d)?dt:null;
}

function dpFmt(d){
  if(!d)return'';
  return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function dpAutoFormat(val){
  let digits=val.replace(/\D/g,'');
  if(digits.length>8)digits=digits.slice(0,8);
  let out='';
  if(digits.length>=1)out=digits.slice(0,2);
  if(digits.length>=3)out+='/'+digits.slice(2,4);
  if(digits.length>=5)out+='/'+digits.slice(4,8);
  return out;
}

function dpSyncFromInput(popupId, inputId){
  const el=document.getElementById(inputId);
  if(!el)return;
  const raw=el.value;
  const fmt=dpAutoFormat(raw);
  if(fmt!==raw){el.value=fmt;}
  const dt=dpParseVal(fmt);
  if(dt&&dpState[popupId]){
    dpState[popupId].year=dt.getFullYear();
    dpState[popupId].month=dt.getMonth();
    dpState[popupId].selDate=fmt;
    if(document.getElementById(popupId)?.classList.contains('open'))renderDP(popupId);
  }
}

function dpSyncInlineFromInput(dpId, itemId, idx){
  const item=tdphItems[idx];
  if(!item)return;
  const val=dpAutoFormat(item.ngay||'');
  item.ngay=val;
  const dt=dpParseVal(val);
  if(dt&&dpState[dpId]){
    dpState[dpId].year=dt.getFullYear();
    dpState[dpId].month=dt.getMonth();
    dpState[dpId].selDate=val;
    if(document.getElementById(dpId)?.classList.contains('open'))renderDP(dpId);
  }
}

function dpValidateInput(inputId, popupId, idx){
  if(inputId){
    const el=document.getElementById(inputId);
    if(!el)return;
    const dt=dpParseVal(el.value);
    if(el.value&&!dt){el.style.borderColor='var(--danger)';setTimeout(()=>el.style.borderColor='',1800);}
    else el.style.borderColor='';
    if(dt){el.value=dpFmt(dt);}
  } else if(popupId!==undefined&&idx!==undefined){
    const item=tdphItems[idx];
    if(!item)return;
    const dt=dpParseVal(item.ngay||'');
    if(dt)item.ngay=dpFmt(dt);
  }
}

function toggleDP(popupId){
  document.querySelectorAll('.dp-popup').forEach(p=>{if(p.id!==popupId)p.classList.remove('open');});
  const popup=document.getElementById(popupId);
  if(!popup)return;
  if(popup.classList.contains('open')){popup.classList.remove('open');return;}
  const inputId=STATIC_DP_MAP[popupId];
  const val=inputId?document.getElementById(inputId)?.value:'';
  const now=new Date();
  let y=now.getFullYear(),m=now.getMonth(),sel=null;
  const dt=dpParseVal(val);
  if(dt){y=dt.getFullYear();m=dt.getMonth();sel=dpFmt(dt);}
  dpState[popupId]={year:y,month:m,selDate:sel,
    onPick:inputId?(ds)=>{const el=document.getElementById(inputId);if(el)el.value=ds;}:null};
  renderDP(popupId);
  popup.classList.add('open');
}

function renderDP(popupId){
  const popup=document.getElementById(popupId);
  const st=dpState[popupId];
  if(!st||!popup)return;
  const{year,month,selDate}=st;
  const today=new Date();
  const ts=dpFmt(today);
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();

  let h=`<div class="dp-nav" onmousedown="event.preventDefault();event.stopPropagation()">
    <button class="dp-nav-btn" onmousedown="event.preventDefault();event.stopPropagation();dpNav('${popupId}',-1)">&#8249;</button>
    <span class="dp-month-label">${DP_M[month]} ${year}</span>
    <button class="dp-nav-btn" onmousedown="event.preventDefault();event.stopPropagation();dpNav('${popupId}',1)">&#8250;</button>
  </div>
  <div class="dp-weekdays">${DP_W.map(d=>`<div class="dp-wd">${d}</div>`).join('')}</div>
  <div class="dp-days">`;

  for(let i=0;i<firstDay;i++)h+=`<div class="dp-day dp-empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${String(d).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;
    let cls='dp-day';
    if(ds===ts)cls+=' dp-today';
    if(ds===selDate)cls+=' dp-sel';
    h+=`<div class="${cls}" onmousedown="event.preventDefault();event.stopPropagation();dpPick('${popupId}','${ds}')">${d}</div>`;
  }
  h+=`</div>
  <div class="dp-footer" onmousedown="event.preventDefault();event.stopPropagation()">
    <button class="dp-btn-clear" onmousedown="event.preventDefault();event.stopPropagation();dpClear('${popupId}')">✕ Xoá</button>
    <button class="dp-btn-today" onmousedown="event.preventDefault();event.stopPropagation();dpPick('${popupId}','${ts}')">Hôm nay</button>
  </div>`;

  popup.innerHTML=h;
}

function dpNav(popupId,dir){
  const st=dpState[popupId];
  if(!st)return;
  st.month+=dir;
  if(st.month<0){st.month=11;st.year--;}
  if(st.month>11){st.month=0;st.year++;}
  renderDP(popupId);
}

function dpPick(popupId,ds){
  const st=dpState[popupId];
  if(!st)return;
  st.selDate=ds;
  if(st.onPick)st.onPick(ds);
  renderDP(popupId);
  setTimeout(()=>{const p=document.getElementById(popupId);if(p)p.classList.remove('open');},80);
}

function dpClear(popupId){
  const st=dpState[popupId];
  if(!st)return;
  st.selDate=null;
  if(st.onPick)st.onPick('');
  renderDP(popupId);
}

function toggleInlineDP(dpId, itemId, idx){
  document.querySelectorAll('.dp-popup').forEach(p=>{if(p.id!==dpId)p.classList.remove('open');});
  const popup=document.getElementById(dpId);
  if(!popup)return;
  if(popup.classList.contains('open')){popup.classList.remove('open');return;}
  const val=tdphItems[idx]?.ngay||'';
  const now=new Date();
  let y=now.getFullYear(),m=now.getMonth(),sel=null;
  const dt=dpParseVal(val);
  if(dt){y=dt.getFullYear();m=dt.getMonth();sel=dpFmt(dt);}
  dpState[dpId]={year:y,month:m,selDate:sel,
    onPick:(ds)=>{tdphItems[idx].ngay=ds;renderTDPHList();}};
  renderDP(dpId);
  popup.classList.add('open');
}

document.addEventListener('click',function(e){
  if(!e.target.closest('.dp-wrap')&&!e.target.classList.contains('dp-icon')){
    document.querySelectorAll('.dp-popup.open').forEach(p=>p.classList.remove('open'));
  }
});

// ═══ CHỈ TIÊU ═══
let allChiTieu=[],curCtTab='yeucaukt',ctEditRow=null,ctSelStaff=[];

function loadChiTieu(){
  google.script.run
    .withSuccessHandler(d=>{
      allChiTieu=d;
      const el=document.getElementById('cnt-chitieu');
      if(el) el.textContent=d.length;
      renderCtTable();
    }).getAllChiTieu();
}

function switchCtTab(tab){
  curCtTab=tab;
  ['yeucaukt','kstt','ycph','quache','khac'].forEach(t=>{
    const btn=document.getElementById('ctTab_'+t);
    if(btn) btn.classList.toggle('on',t===tab);
  });
  renderCtTable();
}

function ctLoaiBadge(loai,ten){
  const display=(loai==='Khác'&&ten)?ten:loai;
  const cls={'Yêu cầu khởi tố':'bct-yeucaukt','Kiểm sát trực tiếp':'bct-kstt','Yêu cầu phục hồi tin báo':'bct-ycph','Quy chế đã ký':'bct-quache'}[loai]||'bct-yeucaukt';
  if(loai==='Khác') return`<span class="badge-ct" style="background:#f0fdf4;color:#166534;font-size:10.5px">${display}</span>`;
  return`<span class="badge-ct ${cls}" style="font-size:10.5px">${display}</span>`;
}

function renderCtTable(){
  const q=(document.getElementById('ctSearch').value||'').toLowerCase();
  const loaiMap={yeucaukt:'Yêu cầu khởi tố',kstt:'Kiểm sát trực tiếp',ycph:'Yêu cầu phục hồi tin báo',quache:'Quy chế đã ký',khac:'Khác'};
  let data=allChiTieu.filter(r=>r['Loại']===loaiMap[curCtTab]);
  if(q) data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));

  const thead=document.getElementById('ctTblHead');
  const tbody=document.getElementById('ctTblBody');
  const empty=document.getElementById('ctEmpty');

  const showTen=curCtTab==='khac';

  thead.innerHTML=`<tr>
    <th>STT</th>
    ${showTen?'<th>Tên chỉ tiêu</th>':''}
    <th>Số QĐ/VB</th><th>Ngày ký</th><th>Nội dung</th>
    <th>Người thực hiện</th><th>Ghi chú</th>
    <th style="min-width:80px">Thao tác</th></tr>`;

  if(!data.length){tbody.innerHTML='';empty.style.display='';return;}
  empty.style.display='none';

  tbody.innerHTML=data.map(r=>`<tr>
    <td class="t-c">${r['STT']}</td>
    ${showTen?`<td style="font-weight:600;color:var(--navy)">${r['Tên chỉ tiêu']||'—'}</td>`:''}
    <td style="white-space:nowrap;font-weight:600">${r['Số QĐ/VB']||'—'}</td>
    <td style="white-space:nowrap;font-size:12px">${r['Ngày ký']||'—'}</td>
    <td class="t-lg" title="${(r['Nội dung']||'').replace(/"/g,'&quot;')}">${r['Nội dung']||'—'}</td>
    <td class="t-md" style="font-size:11.5px">${r['Người thực hiện']||'<span style="color:var(--muted)">—</span>'}</td>
    <td class="t-sm">${r['Ghi chú']||'—'}</td>
    <td>
      <button class="btn btn-ghost btn-xs" onclick="openCtEdit(${r.rowIndex})">✏️</button>
      <button class="btn btn-danger btn-xs" onclick="deleteCtRec(${r.rowIndex})">🗑️</button>
    </td></tr>`).join('');
}

function buildCtStaffChips(){
  const wrap=document.getElementById('ct_staff_chips');
  if(!wrap)return;
  wrap.innerHTML=allStaff.map(s=>`
    <div class="staff-chip ${ctSelStaff.includes(s)?'sel':''}" onclick="toggleCtStaff('${s.replace(/'/g,"\\'")}',this)">
      ${s}
    </div>`).join('');
}

function toggleCtStaff(name,el){
  const idx=ctSelStaff.indexOf(name);
  if(idx>=0){ctSelStaff.splice(idx,1);el.classList.remove('sel');}
  else{ctSelStaff.push(name);el.classList.add('sel');}
}

function toggleCtLoaiTuDo(){
  const v=document.getElementById('ct_loai').value==='Khác';
  document.getElementById('ct_loai_tudo_wrap').style.display=v?'':'none';
}

function openCtForm(){
  ctEditRow=null; ctSelStaff=[];
  document.getElementById('ctFormIcon').textContent='🎯';
  document.getElementById('ctFormTitle').textContent='Thêm chỉ tiêu';
  ['ct_so','ct_ngay','ct_noidung','ct_ghichu','ct_loai_tudo','ct_nguoi_khac'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const loaiMap={yeucaukt:'Yêu cầu khởi tố',kstt:'Kiểm sát trực tiếp',ycph:'Yêu cầu phục hồi tin báo',quache:'Quy chế đã ký',khac:'Khác'};
  document.getElementById('ct_loai').value=loaiMap[curCtTab]||'Yêu cầu khởi tố';
  toggleCtLoaiTuDo();
  buildCtStaffChips();
  openOvl('ctOverlay');
}

function openCtEdit(ri){
  const rec=allChiTieu.find(r=>r.rowIndex===ri);if(!rec)return;
  ctEditRow=ri;
  ctSelStaff=(rec['Người thực hiện']||'').split(',').map(s=>s.trim()).filter(s=>allStaff.includes(s));
  document.getElementById('ctFormIcon').textContent='✏️';
  document.getElementById('ctFormTitle').textContent='Chỉnh sửa chỉ tiêu';
  document.getElementById('ct_loai').value=rec['Loại']||'Yêu cầu khởi tố';
  document.getElementById('ct_loai_tudo').value=rec['Tên chỉ tiêu']||'';
  document.getElementById('ct_so').value=rec['Số QĐ/VB']||'';
  document.getElementById('ct_ngay').value=rec['Ngày ký']||'';
  document.getElementById('ct_noidung').value=rec['Nội dung']||'';
  const nguoiAll=(rec['Người thực hiện']||'').split(',').map(s=>s.trim()).filter(Boolean);
  const nguoiKhac=nguoiAll.filter(s=>!allStaff.includes(s)).join(', ');
  document.getElementById('ct_nguoi_khac').value=nguoiKhac;
  document.getElementById('ct_ghichu').value=rec['Ghi chú']||'';
  toggleCtLoaiTuDo();
  buildCtStaffChips();
  openOvl('ctOverlay');
}

function saveCtRecord(){
  const loai=document.getElementById('ct_loai').value;
  const ten=document.getElementById('ct_loai_tudo').value.trim();
  const nd=document.getElementById('ct_noidung').value.trim();
  if(!nd){toast('Vui lòng nhập nội dung!','err');return;}
  if(loai==='Khác'&&!ten){toast('Vui lòng nhập tên chỉ tiêu!','err');return;}
  const nguoiKhacRaw=document.getElementById('ct_nguoi_khac').value.trim();
  const nguoiAll=[...ctSelStaff];
  if(nguoiKhacRaw)nguoiKhacRaw.split(',').map(s=>s.trim()).filter(Boolean).forEach(s=>{if(!nguoiAll.includes(s))nguoiAll.push(s);});
  const record={
    'Loại':loai,
    'Tên chỉ tiêu':loai==='Khác'?ten:'',
    'Số QĐ/VB':document.getElementById('ct_so').value,
    'Ngày ký':document.getElementById('ct_ngay').value,
    'Nội dung':nd,
    'Người thực hiện':nguoiAll.join(', '),
    'Ghi chú':document.getElementById('ct_ghichu').value,
  };
  showLoad(true);
  if(ctEditRow){
    record['STT']=allChiTieu.find(r=>r.rowIndex===ctEditRow)?.['STT'];
    google.script.run
      .withSuccessHandler(()=>{closeOvl('ctOverlay');loadChiTieu();toast('Đã cập nhật!');showLoad(false);})
      .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);})
      .updateChiTieu(ctEditRow,record);
  } else {
    google.script.run
      .withSuccessHandler(()=>{closeOvl('ctOverlay');loadChiTieu();toast('Đã thêm!');showLoad(false);})
      .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);})
      .addChiTieu(record);
  }
}

function deleteCtRec(ri){
  if(!confirm('Xóa chỉ tiêu này?'))return;
  showLoad(true);
  google.script.run
    .withSuccessHandler(()=>{loadChiTieu();toast('Đã xóa!');showLoad(false);})
    .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);})
    .deleteChiTieu(ri);
}

// ═══ KIẾN NGHỊ ═══
let allKienNghi=[],curKnTab='phongngua',knEditRow=null,allStaff=[],knSelStaff=[];

function loadAllStaff(){
  google.script.run.withSuccessHandler(list=>{
    allStaff=list;
    buildStaffChips();
  }).getAllStaffList();
}

function buildStaffChips(){
  const wrap=document.getElementById('kn_staff_chips');
  if(!wrap)return;
  wrap.innerHTML=allStaff.map((s,i)=>`
    <div class="staff-chip ${knSelStaff.includes(s)?'sel':''}" onclick="toggleStaff('${s.replace(/'/g,"\\'")}',this)">
      ${s}
    </div>`).join('');
}

function toggleStaff(name,el){
  const idx=knSelStaff.indexOf(name);
  if(idx>=0){knSelStaff.splice(idx,1);el.classList.remove('sel');}
  else{knSelStaff.push(name);el.classList.add('sel');}
}

function loadKienNghi(){
  google.script.run.withSuccessHandler(d=>{
    allKienNghi=d;
    const el=document.getElementById('cnt-kiennghi');
    if(el) el.textContent=d.length;
    renderKnTable();
  }).getAllKienNghi();
}

function switchKnTab(tab){
  curKnTab=tab;
  ['phongngua','vipham'].forEach(t=>{
    document.getElementById('knTab_'+t).classList.toggle('on',t===tab);
  });
  renderKnTable();
}

function renderKnTable(){
  const q=(document.getElementById('knSearch').value||'').toLowerCase();
  const tlFilter=document.getElementById('knFilterTL').value;
  const loaiMap={phongngua:'Kiến nghị phòng ngừa',vipham:'Kiến nghị vi phạm'};
  let data=allKienNghi.filter(r=>r['Loại kiến nghị']===loaiMap[curKnTab]);
  if(q) data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
  if(tlFilter) data=data.filter(r=>r['Đã có trả lời']===tlFilter);

  const thead=document.getElementById('knTblHead');
  const tbody=document.getElementById('knTblBody');
  const empty=document.getElementById('knEmpty');

  thead.innerHTML=`<tr>
    <th>STT</th><th>Số VB</th><th>Ngày BH</th><th>Nội dung</th>
    <th>Trả lời</th><th>Số/Ngày VB TL</th><th>Cán bộ ban hành</th><th>Ghi chú</th>
    <th style="min-width:80px">Thao tác</th></tr>`;

  if(!data.length){tbody.innerHTML='';empty.style.display='';return;}
  empty.style.display='none';

  tbody.innerHTML=data.map(r=>{
    const tl=r['Đã có trả lời']==='Có'
      ?`<span class="badge-yn-yes">✅ Có</span>`
      :`<span class="badge-yn-no">⏳ Chưa</span>`;
    const tlDetail=r['Đã có trả lời']==='Có'
      ?`<div style="font-size:10.5px;color:var(--muted)">${r['Số VB trả lời']||''} ${r['Ngày VB trả lời']||''}</div>`:'—';
    return`<tr>
      <td class="t-c">${r['STT']}</td>
      <td style="white-space:nowrap;font-weight:600">${r['Số văn bản']||'—'}</td>
      <td style="white-space:nowrap;font-size:12px">${r['Ngày ban hành']||'—'}</td>
      <td class="t-lg" title="${(r['Nội dung kiến nghị']||'').replace(/"/g,'&quot;')}">${r['Nội dung kiến nghị']||'—'}</td>
      <td>${tl}</td>
      <td>${tlDetail}</td>
      <td class="t-md" style="font-size:11.5px">${r['Cán bộ ban hành']||'—'}</td>
      <td class="t-sm">${r['Ghi chú khác']||'—'}</td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="openKnEdit(${r.rowIndex})">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="deleteKnRec(${r.rowIndex})">🗑️</button>
      </td></tr>`;
  }).join('');
}

function openKnForm(){
  knEditRow=null; knSelStaff=[];
  document.getElementById('knFormIcon').textContent='📝';
  document.getElementById('knFormTitle').textContent='Thêm kiến nghị';
  ['kn_so','kn_ngay','kn_noidung','kn_sotl','kn_ngaytl','kn_ghichu'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const loaiMap={phongngua:'Kiến nghị phòng ngừa',vipham:'Kiến nghị vi phạm'};
  document.getElementById('kn_loai').value=loaiMap[curKnTab]||'Kiến nghị phòng ngừa';
  document.getElementById('kn_tratloai').value='Chưa';
  toggleKnTraLoi();
  buildStaffChips();
  openOvl('knOverlay');
}
function openKnEdit(ri){
  const rec=allKienNghi.find(r=>r.rowIndex===ri);if(!rec)return;
  knEditRow=ri;
  knSelStaff=(rec['Cán bộ ban hành']||'').split(',').map(s=>s.trim()).filter(Boolean);
  document.getElementById('knFormIcon').textContent='✏️';
  document.getElementById('knFormTitle').textContent='Chỉnh sửa kiến nghị';
  document.getElementById('kn_loai').value=rec['Loại kiến nghị']||'';
  document.getElementById('kn_so').value=rec['Số văn bản']||'';
  document.getElementById('kn_ngay').value=rec['Ngày ban hành']||'';
  document.getElementById('kn_noidung').value=rec['Nội dung kiến nghị']||'';
  document.getElementById('kn_tratloai').value=rec['Đã có trả lời']||'Chưa';
  document.getElementById('kn_sotl').value=rec['Số VB trả lời']||'';
  document.getElementById('kn_ngaytl').value=rec['Ngày VB trả lời']||'';
  document.getElementById('kn_ghichu').value=rec['Ghi chú khác']||'';
  toggleKnTraLoi();
  buildStaffChips();
  openOvl('knOverlay');
}
function toggleKnTraLoi(){
  const v=document.getElementById('kn_tratloai').value==='Có';
  document.getElementById('kn_so_tl_wrap').style.display=v?'':'none';
  document.getElementById('kn_ngay_tl_wrap').style.display=v?'':'none';
}
function saveKnRecord(){
  const nd=document.getElementById('kn_noidung').value.trim();
  if(!nd){toast('Vui lòng nhập nội dung kiến nghị!','err');return;}
  const canBo=[...knSelStaff];
  const khac=document.getElementById('kn_ghichu').value.trim();
  const record={
    'Loại kiến nghị':document.getElementById('kn_loai').value,
    'Số văn bản':document.getElementById('kn_so').value,
    'Ngày ban hành':document.getElementById('kn_ngay').value,
    'Nội dung kiến nghị':nd,
    'Đã có trả lời':document.getElementById('kn_tratloai').value,
    'Số VB trả lời':document.getElementById('kn_sotl').value,
    'Ngày VB trả lời':document.getElementById('kn_ngaytl').value,
    'Cán bộ ban hành':canBo.join(', '),
    'Ghi chú khác':khac,
  };
  showLoad(true);
  if(knEditRow){
    record['STT']=allKienNghi.find(r=>r.rowIndex===knEditRow)?.['STT'];
    google.script.run.withSuccessHandler(()=>{closeOvl('knOverlay');loadKienNghi();toast('Đã cập nhật!');showLoad(false);})
      .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);}).updateKienNghi(knEditRow,record);
  } else {
    google.script.run.withSuccessHandler(()=>{closeOvl('knOverlay');loadKienNghi();toast('Đã thêm!');showLoad(false);})
      .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);}).addKienNghi(record);
  }
}
function deleteKnRec(ri){
  if(!confirm('Xóa kiến nghị này?'))return;
  showLoad(true);
  google.script.run.withSuccessHandler(()=>{loadKienNghi();toast('Đã xóa!');showLoad(false);})
    .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);}).deleteKienNghi(ri);
}

// ═══ THỐNG KÊ THÁNG ═══
let curTkMode='thang';
const TKL_IDS=['tkl_phanloai','tkl_loaitoi','tkl_ksv','tkl_pvt','tkl_cax','tkl_noi'];
function _optVals(selId){
  const el=document.getElementById(selId); if(!el)return[];
  return Array.from(el.options).map(o=>o.value||o.text).filter(v=>v&&v.indexOf('--')!==0);
}
function _fillLocSel(id,label,vals){
  const el=document.getElementById(id); if(!el)return;
  const cur=el.value;
  const uniq=[...new Set(vals.map(v=>String(v||'').trim()).filter(Boolean))];
  el.innerHTML=`<option value="">${label}: Tất cả</option>`+uniq.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');
  if(cur&&uniq.includes(cur))el.value=cur;
}
function fillLocTK(){
  const col=k=>(allRec||[]).map(r=>r[k]);
  _fillLocSel('tkl_phanloai','Phân loại',[..._optVals('f_phanloai'),...col('Phân loại')]);
  _fillLocSel('tkl_loaitoi','Loại tội',[..._optVals('f_loaitoi'),...col('Loại tội')]);
  _fillLocSel('tkl_ksv','KSV',[..._optVals('f_ksv'),...col('Họ tên Kiểm sát viên thụ lý')]);
  _fillLocSel('tkl_pvt','PVT',[..._optVals('f_pvt'),...col('Họ tên Phó viện trưởng thụ lý')]);
  danhDauLocTK();
}
function getLocTK(){
  const v=id=>(document.getElementById(id)||{}).value||'';
  return {phanLoai:v('tkl_phanloai'),loaiToi:v('tkl_loaitoi'),ksv:v('tkl_ksv'),pvt:v('tkl_pvt'),cax:v('tkl_cax'),noiXayRa:v('tkl_noi').trim()};
}
function danhDauLocTK(){
  TKL_IDS.forEach(id=>{const el=document.getElementById(id);if(el)el.classList.toggle('loc-on',!!String(el.value||'').trim());});
}
function xoaLocTK(){
  TKL_IDS.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  danhDauLocTK();
  if(lastThongKeData)loadThongKe();
}
function switchTkMode(mode){
  curTkMode=mode;
  document.getElementById('tkMode_thang').classList.toggle('on',mode==='thang');
  document.getElementById('tkMode_ngay').classList.toggle('on',mode==='ngay');
  document.getElementById('tkFormThang').style.display=mode==='thang'?'flex':'none';
  document.getElementById('tkFormNgay').style.display=mode==='ngay'?'flex':'none';
}

function loadThongKe(){
  if(curTkMode==='ngay'){
    const dau=document.getElementById('tk_ngay_dau').value;
    const cuoi=document.getElementById('tk_ngay_cuoi').value;
    if(!dau||!cuoi){toast('Chọn đầy đủ ngày bắt đầu và kết thúc!','err');return;}
    const fmtD=s=>{const p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
    if(dau>cuoi){toast('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu!','err');return;}
    showLoad(true);
    google.script.run
      .withSuccessHandler(data=>{showLoad(false);renderThongKe(data);})
      .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
      .getThongKeNgay(fmtD(dau),fmtD(cuoi),getLocTK());
    return;
  }
  const thangDau=+document.getElementById('tk_thang').value;
  const namDau=+document.getElementById('tk_nam_dau').value;
  const thangCuoi=+(document.getElementById('tk_thang_cuoi').value||thangDau);
  const namCuoi=+document.getElementById('tk_nam_cuoi').value;
  if(!thangDau||!namDau||!thangCuoi||!namCuoi){toast('Chọn đầy đủ tháng và năm!','err');return;}
  const startVal=namDau*12+thangDau, endVal=namCuoi*12+thangCuoi;
  if(endVal<startVal){toast('Kỳ kết thúc phải sau hoặc bằng kỳ bắt đầu!','err');return;}
  showLoad(true);
  google.script.run
    .withSuccessHandler(data=>{showLoad(false);renderThongKe(data);})
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getThongKeKhoang(thangDau,namDau,thangCuoi,namCuoi,getLocTK());
}

let lastThongKeData=null;
function xemTinTheoSTT(stt){
  const r=(allRec||[]).find(x=>String(x['STT'])===String(stt));
  if(!r){toast('Không tìm thấy tin #'+stt+' trong danh sách hiện tại','err');return;}
  if(typeof openDetail==='function'){openDetail(r.rowIndex);return;}
  toast('Tin #'+stt+': '+(r['Loại tội']||'')+' — '+(r['Kết quả giải quyết']||'chưa có kết quả'));
}
function renderThongKe(d){
  lastThongKeData=d;
  if(!d){document.getElementById('tkBody').innerHTML='<div class="tk-empty">Không có dữ liệu</div>';return;}
  if(d.error){document.getElementById('tkBody').innerHTML=`<div class="tk-empty" style="color:red">❌ Lỗi: ${d.error}</div>`;return;}
  const fmtNum=n=>isNaN(+n)?'0':String(+n||0);
  let ky;
  if(d.kyLabel){
    ky=d.kyLabel;
  }else{
    ky=(d.thangDau===d.thangCuoi&&d.namDau===d.namCuoi)
      ?`Tháng ${d.thangDau}/${d.namDau}`
      :(d.namDau===d.namCuoi
        ?`Tháng ${d.thangDau} – ${d.thangCuoi}/${d.namDau}`
        :`Tháng ${d.thangDau}/${d.namDau} – Tháng ${d.thangCuoi}/${d.namCuoi}`);
  }

  const detailRows=(list,emptyTxt)=>{
    if(!list||!list.length)return`<div class="tk-empty">${emptyTxt}</div>`;
    return list.map(r=>{
      const label=[r.loaitoi,r.ngayXayRa,r.noiXayRa].filter(Boolean).join(' - ');
      const caxTag=r.isCax?'<span class="badge" style="background:#dbeafe;color:#1e40af;font-size:9px;margin-left:4px">CAX</span>':'';
      return`<div class="tk-det-row">
        <span class="tk-det-stt">#${r.stt}</span>
        <span class="tk-det-name">${label||'—'}${caxTag}</span>
        ${r.trangThai==='tamdinh'?'<span class="badge b-purple" style="font-size:9px">TĐC</span>':''}
      </div>`;
    }).join('');
  };

  const ctRows=list=>{
    if(!list||!list.length)return'<div class="tk-empty">Không có trong kỳ</div>';
    return list.map(r=>`<div class="tk-det-row">
      <span class="badge b-blue" style="font-size:9.5px">${r['Loại']||'CT'}</span>
      <span class="tk-det-name">${r['Nội dung']||r['Tên chỉ tiêu']||'—'}</span>
      <span style="font-size:10px;color:var(--muted)">${r['Số QĐ/VB']||''} ${r['Ngày ký']||''}</span>
    </div>`).join('');
  };

  const knRows=list=>{
    if(!list||!list.length)return'<div class="tk-empty">Không có trong kỳ</div>';
    return list.map(r=>`<div class="tk-det-row">
      <span class="badge ${(r['Loại kiến nghị']||'').includes('vi phạm')?'b-red':'b-teal'}" style="font-size:9.5px">${r['Loại kiến nghị']||'KN'}</span>
      <span class="tk-det-name">${(r['Nội dung kiến nghị']||'—').substring(0,80)}</span>
      <span style="font-size:10px;color:var(--muted)">${r['Số văn bản']||''} ${r['Ngày ban hành']||''}</span>
    </div>`).join('');
  };

  const kktTuTDC=+(d.kktHTHtuTDC??0)||0;
  const kktNgoai=(+d.kktHetThoiHieu||0)-kktTuTDC;
  const ctCL=(+d.tongThuLy||0)-(+d.tongGiaiQuyet||0)-kktNgoai;
  const ctTDC=(+d.tdcTonDauKy||0)+(+d.tamDinhTrongThang||0)-(+d.phucHoiTrongThang||0)-kktTuTDC;
  const html=`
  <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:14px">📊 Kết quả: <span style="color:#0369a1">${ky}</span></div>
  ${d.locLabel?`<div style="margin:-8px 0 14px;padding:6px 10px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;font-size:12px;color:#713f12">🔎 Đang lọc: <b>${d.locLabel}</b></div>`:''}

  <div style="background:#f8fafc;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Tổng thụ lý = Cũ + Mới + Phục hồi &nbsp;|&nbsp; Còn lại = Tổng thụ lý − Giải quyết &nbsp;|&nbsp; TĐC cuối kỳ = TĐC đầu kỳ + TĐC mới − PH − KKT hết TH</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:12px;background:#f8fafc;border-right:1px solid var(--border);text-align:center">
        <div style="font-size:26px;font-weight:800;color:var(--navy)">${fmtNum(d.tongThuLy||0)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;font-weight:600">Tổng thụ lý</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">Cũ ${fmtNum(d.tonThangTruoc)} + Mới ${fmtNum(d.moiThuLy)} + PH ${fmtNum(d.phucHoiTrongThang||0)}</div>
      </div>
      <div style="padding:12px;background:#fff;border-right:1px solid var(--border);text-align:center">
        <div style="font-size:26px;font-weight:800;color:var(--muted)">${fmtNum(d.tonThangTruoc)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Cũ (tồn kỳ trước)</div>
      </div>
      <div style="padding:12px;background:#f0f9ff;border-right:1px solid var(--border);text-align:center">
        <div style="font-size:26px;font-weight:800;color:#0369a1">${fmtNum(d.moiThuLy)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Mới${d.moiCax>0?`<br><span style="color:#1e40af;font-size:10px">(${d.moiCax} tin xã)</span>`:''}</div>
      </div>
      <div style="padding:12px;background:#f0fdf4;border-right:1px solid var(--border);text-align:center">
        <div style="font-size:26px;font-weight:800;color:#15803d">${fmtNum(d.phucHoiTrongThang||0)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Phục hồi</div>
      </div>
      <div style="padding:12px;background:#fef2f2;border-right:1px solid var(--border);text-align:center">
        <div style="font-size:26px;font-weight:800;color:#dc2626">${fmtNum(d.tongGiaiQuyet)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Giải quyết</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">KT ${fmtNum(d.khoiTo)} · KKT ${fmtNum(d.khongKhoiTo)} · TĐC ${fmtNum(d.tamDinhTrongThang)}</div>
      </div>
    </div>
    <div style="margin-top:8px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;display:flex;align-items:center;gap:12px">
      <div style="text-align:center">
        <div style="font-size:26px;font-weight:800;color:#d97706">${fmtNum(d.conLai)}</div>
        <div style="font-size:11px;color:var(--muted)">Còn lại</div>
      </div>
      <div style="font-size:12px;color:#92400e;font-weight:600">= Tổng thụ lý ${fmtNum(d.tongThuLy||0)} − Giải quyết ${fmtNum(d.tongGiaiQuyet)}${kktNgoai>0?` − KKT hết TH (không qua TĐC) ${fmtNum(kktNgoai)}`:''} = <span style="font-size:16px">${fmtNum(ctCL)}</span>${ctCL!==(+d.conLai||0)?` <span style="color:#dc2626">≠ đếm thực tế ${fmtNum(d.conLai)}</span>`:''}</div>
    </div>
    ${(d.lechList||[]).length?`
    <div style="margin-top:8px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#991b1b">
      <div style="font-weight:700;margin-bottom:4px">⚠️ Số liệu chưa khớp — ${d.lechList.length} vụ cần kiểm tra lại dữ liệu:</div>
      ${d.lechList.map(x=>`<div style="padding:2px 0">• <b style="cursor:pointer;text-decoration:underline" onclick="xemTinTheoSTT('${x.stt}')">#${x.stt}</b> ${x.loaitoi?escH(x.loaitoi)+': ':''}${escH(x.lyDo)}</div>`).join('')}
    </div>`:''}
    ${(d.tdcTonDauKy||0)+(d.tdcConLai||0)+(d.giaHanTrongKy||0)+((d.chiTieuTrongKy||[]).length)+((d.kienNghiTrongKy||[]).length)>0?`
    <div style="margin-top:10px;padding:8px 12px;background:#fdf4ff;border:1px solid #e9d5ff;border-radius:8px;font-size:11.5px;display:flex;flex-wrap:wrap;gap:14px;align-items:center">
      ${(d.tdcTonDauKy||0)+(d.tdcConLai||0)>0?`<span><span style="font-weight:700;color:#7c3aed">⏸ TĐC:</span>
      tồn đầu kỳ <b>${fmtNum(d.tdcTonDauKy)}</b> + TĐC mới <b>${fmtNum(d.tamDinhTrongThang)}</b> − PH <b>${fmtNum(d.phucHoiTrongThang||0)}</b>${kktTuTDC?` − KKT hết TH <b>${fmtNum(kktTuTDC)}</b>`:''} = còn lại cuối kỳ <b>${fmtNum(d.tdcConLai)}</b>${ctTDC!==(+d.tdcConLai||0)?` <span style="color:#dc2626">(công thức ra ${fmtNum(ctTDC)})</span>`:''}</span>`:''}
      ${(d.giaHanTrongKy||0)>0?`<span><span style="font-weight:700;color:#6d28d9">🔄 Gia hạn trong kỳ:</span> <b>${fmtNum(d.giaHanTrongKy)}</b> vụ</span>`:''}
      ${(d.kktHetThoiHieu||0)>0?`<span><span style="font-weight:700;color:#92400e">⏱ KKT hết TH:</span> <b>${fmtNum(d.kktHetThoiHieu)}</b></span>`:''}
      ${((d.chiTieuTrongKy||[]).length)>0?`<span><span style="font-weight:700;color:#0369a1">📌 Chỉ tiêu:</span> <b>${fmtNum((d.chiTieuTrongKy||[]).length)}</b></span>`:''}
      ${((d.kienNghiTrongKy||[]).length)>0?`<span><span style="font-weight:700;color:#166534">📢 Kiến nghị:</span> <b>${fmtNum((d.kienNghiTrongKy||[]).length)}</b></span>`:''}
    </div>`:''}
  </div>

  <div class="tk-divider"></div>
  <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:10px">📋 Chi tiết từng nhóm</div>
  <div class="tk-detail-grid">
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#f1f5f9;color:#334155;border-color:#cbd5e1">📂 Cũ - tồn kỳ trước (${fmtNum(d.tonThangTruoc)})</div>
      <div class="tk-det-body">${detailRows(d.tonList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#f0f9ff;color:#0369a1;border-color:#bae6fd">🆕 Mới thụ lý (${fmtNum(d.moiThuLy)})</div>
      <div class="tk-det-body">${detailRows(d.moiList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head dh-green">✅ Khởi tố (${fmtNum(d.khoiTo)})</div>
      <div class="tk-det-body">${detailRows(d.khoiToList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head dh-red">🚫 Không KT (${fmtNum(d.khongKhoiTo)})</div>
      <div class="tk-det-body">${detailRows(d.khongKhoiToList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head dh-purple">⏸ TĐC trong kỳ (${fmtNum(d.tamDinhTrongThang)})</div>
      <div class="tk-det-body">${detailRows(d.tamDinhList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#dbeafe;color:#1e40af;border-color:#bfdbfe">🔄 Phục hồi trong kỳ (${fmtNum(d.phucHoiTrongThang||0)})</div>
      <div style="font-size:10px;color:var(--muted);padding:2px 10px;font-style:italic">Tính như thụ lý mới trong kỳ</div>
      <div class="tk-det-body">${detailRows(d.phucHoiList||[],'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head dh-warn">⏳ Còn lại cuối kỳ (${fmtNum(d.conLai)})</div>
      <div class="tk-det-body">${detailRows(d.conLaiList,'Không có')}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#fdf4ff;color:#7c3aed;border-color:#e9d5ff">⏸ TĐC còn lại (${fmtNum(d.tdcConLai)}) — mục riêng</div>
      <div class="tk-det-body">${detailRows(d.tdcConLaiList||[],'Không có')}</div>
    </div>
    ${(d.giaHanTrongKy||0)>0?`
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe">🔄 Gia hạn trong kỳ (${fmtNum(d.giaHanTrongKy)})</div>
      <div style="font-size:10px;color:var(--muted);padding:2px 10px;font-style:italic">Theo ngày ban hành QĐ gia hạn</div>
      <div class="tk-det-body">${(d.giaHanList||[]).map(r=>{
        const label=[r.loaitoi,r.ngayXayRa,r.noiXayRa].filter(Boolean).join(' - ');
        return `<div class="tk-det-row">
          <span class="tk-det-stt">#${r.stt}</span>
          <span class="tk-det-name">${label||'—'}</span>
          <span style="font-size:10px;color:#6d28d9;font-weight:600;white-space:nowrap">📅 ${r.giaHanNgay||''}${r.giaHanSoNgay?` · +${r.giaHanSoNgay}n`:''}</span>
        </div>`;
      }).join('')}</div>
    </div>`:''}
    ${(d.kktHetThoiHieu||0)>0?`
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#fef3c7;color:#92400e;border-color:#fde68a">⏱ KKT hết TH (${fmtNum(d.kktHetThoiHieu)})</div>
      <div class="tk-det-body">${detailRows(d.kktHetThoiHieuList||[],'Không có')}</div>
    </div>`:''}
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd">📌 Chỉ tiêu trong kỳ (${fmtNum((d.chiTieuTrongKy||[]).length)})</div>
      <div class="tk-det-body">${ctRows(d.chiTieuTrongKy)}</div>
    </div>
    <div class="tk-det-card">
      <div class="tk-det-head" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0">📢 Kiến nghị trong kỳ (${fmtNum((d.kienNghiTrongKy||[]).length)})</div>
      <div class="tk-det-body">${knRows(d.kienNghiTrongKy)}</div>
    </div>
  </div>`;

  document.getElementById('tkBody').innerHTML=html;
}

// ═══ PHỤC HỒI NHANH ═══
function openPhucHoiForm(ri){
  const rec=allRec.find(r=>r.rowIndex===ri);
  if(!rec){toast('Không tìm thấy bản ghi!','err');return;}
  const soQD=prompt('Số QĐ tiếp tục giải quyết (có thể bỏ trống):','');
  if(soQD===null)return;
  const ngayPH=prompt('Ngày phục hồi (dd/MM/yyyy):',dpFmt(new Date()));
  if(!ngayPH)return;
  let list=[];
  try{list=JSON.parse(rec['Danh sách QĐ tạm đình chỉ / phục hồi']||'[]');}catch(e){}
  list.push({loai:'phuchoi',so:soQD.trim(),ngay:ngayPH.trim(),lydo:'',thoiHieu:''});
  rec['Danh sách QĐ tạm đình chỉ / phục hồi']=JSON.stringify(list);
  showLoad(true);
  google.script.run
    .withSuccessHandler(()=>{loadData();loadChiTieu();toast('✅ Đã thêm QĐ phục hồi!');showLoad(false);})
    .withFailureHandler(e=>{toast('Lỗi: '+e.message,'err');showLoad(false);})
    .updateRecord(ri,rec);
}

// ═══ KẾT THÚC NĂM ═══
function openKetThucNam(){
  showLoad(true);
  google.script.run.withSuccessHandler(info=>{
    showLoad(false);
    const nowYear=new Date().getFullYear();
    const archYear=info.activeYear||String(nowYear);
    const nextYear=String(Number(archYear)+1);
    document.getElementById('ktnDesc').innerHTML=
      `Năm hiện tại đang hoạt động: <b>${archYear}</b><br>`+
      `Sheet sẽ lưu trữ với năm: <b>${archYear}</b><br>`+
      `Sheet mới sẽ tạo cho năm: <b>${nextYear}</b>`;
    openOvl('ketThucNamOverlay');
  }).withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
  .getSystemInfo();
}

function doKetThucNam(){
  closeOvl('ketThucNamOverlay');
  showLoad(true);
  google.script.run
    .withSuccessHandler(result=>{
      showLoad(false);
      if(result.success){
        toast('✅ '+result.message);
        refreshSystemBadge();
        setTimeout(()=>loadData(), 500);
      } else {
        toast('Lỗi khi kết thúc năm','err');
      }
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .ketThucNam();
}

function runMigrate(){
  if(!confirm('Chạy đồng bộ cấu trúc dữ liệu?')) return;
  showLoad(true);
  google.script.run
    .withSuccessHandler(res=>{ showLoad(false); toast((res&&res.message)||'Đồng bộ thành công!'); setTimeout(loadData, 400); })
    .withFailureHandler(e=>{ showLoad(false); toast('Lỗi: '+e.message,'err'); })
    .runMigration();
}

// ═══ IN SỔ THỤ LÝ TIN BÁO ═══
function inSoTDC(){
  showLoad(true);
  google.script.run
    .withSuccessHandler(function(html){
      showLoad(false);
      var w=window.open('','_blank');
      if(!w){toast('Trình duyệt chặn popup!','err');return;}
      w.document.write(html);w.document.close();
    })
    .withFailureHandler(function(e){showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTDCHTML();
}

function openInSoModal(){
  const sel=document.getElementById('inSo_nam');
  if(sel && !sel.options.length){
    const now=new Date().getFullYear();
    for(let y=now-3;y<=now+1;y++){
      const o=document.createElement('option');o.value=y;o.textContent=y;
      if(y===now)o.selected=true;
      sel.appendChild(o);
    }
  }
  document.getElementById('inSo_thangDau').value=new Date().getMonth()+1;
  document.getElementById('inSo_thangCuoi').value=new Date().getMonth()+1;
  openOvl('inSoOverlay');
}
function toggleInSoRange(){
  const v=document.getElementById('inSo_range').value;
  document.getElementById('inSoRangeFields').style.display=v==='range'?'':'none';
}
function downloadHtmlAsWordDoc(fullHtml, filename, isLandscape){
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, 'text/html');
  doc.querySelectorAll('.no-print, .np, script').forEach(el => el.remove());
  const styles = Array.from(doc.querySelectorAll('style')).map(s => s.innerHTML).join('\n');
  const pageRule = isLandscape
    ? '@page Section1 {size:42cm 29.7cm; mso-page-orientation:landscape; margin:1.2cm 1cm;} div.Section1 {page:Section1;}'
    : '@page Section1 {size:21cm 29.7cm; mso-page-orientation:portrait; margin:1.5cm 1.5cm;} div.Section1 {page:Section1;}';
  const wordDoc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>' + styles + '\n' + pageRule + '</style></head><body><div class="Section1">' + doc.body.innerHTML + '</div></body></html>';
  const blob = new Blob(['\ufeff', wordDoc], {type: 'application/msword;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function downloadHtmlAsPdf(fullHtml, filename){
  if (IS_STATIC_WEB) {
    const w = window.open('', '_blank');
    if (!w) { toast('Trình duyệt chặn popup! Hãy cho phép popup để lưu PDF.', 'err'); return; }
    w.document.write(fullHtml);
    w.document.close();
    w.document.title = filename.replace(/\.pdf$/i, '');
    setTimeout(() => { w.focus(); w.print(); }, 400);
    return;
  }
  showLoad(true);
  try{
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: fullHtml, filename })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error || 'Không thể kết xuất file PDF');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('📕 Đã tải file ' + filename + ' về máy!');
  }catch(e){
    toast('Lỗi tạo PDF: ' + e.message, 'err');
  }finally{
    showLoad(false);
  }
}

function doInSo(){
  const range=document.getElementById('inSo_range').value;
  let thangDau=0,thangCuoi=0,nam=0;
  if(range==='range'){
    thangDau=+document.getElementById('inSo_thangDau').value;
    thangCuoi=+document.getElementById('inSo_thangCuoi').value;
    nam=+document.getElementById('inSo_nam').value;
    if(thangCuoi<thangDau){toast('Tháng cuối phải ≥ tháng đầu!','err');return;}
  }
  showLoad(true);
  google.script.run
    .withSuccessHandler(html=>{
      showLoad(false);
      closeOvl('inSoOverlay');
      const w=window.open('','_blank');
      w.document.write(html);
      w.document.close();
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTinBaoHTML(thangDau,thangCuoi,nam);
}

function doDownloadSoDoc(){
  const range=document.getElementById('inSo_range').value;
  let thangDau=0,thangCuoi=0,nam=0;
  if(range==='range'){
    thangDau=+document.getElementById('inSo_thangDau').value;
    thangCuoi=+document.getElementById('inSo_thangCuoi').value;
    nam=+document.getElementById('inSo_nam').value;
    if(thangCuoi<thangDau){toast('Tháng cuối phải ≥ tháng đầu!','err');return;}
  }
  showLoad(true);
  google.script.run
    .withSuccessHandler(html=>{
      showLoad(false);
      closeOvl('inSoOverlay');
      const suffix = range==='range' ? `_Thang_${thangDau}_${thangCuoi}_${nam}` : '_ToanBo';
      downloadHtmlAsWordDoc(html, `So_Thu_Ly_Tin_Bao${suffix}.doc`, true);
      toast('📥 Đã tải Sổ thụ lý tin báo (.doc) về máy!');
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTinBaoHTML(thangDau,thangCuoi,nam);
}

function downloadSoTDCDoc(){
  showLoad(true);
  google.script.run
    .withSuccessHandler(html=>{
      showLoad(false);
      closeOvl('inSoOverlay');
      downloadHtmlAsWordDoc(html, 'So_Tam_Dinh_Chi.doc', true);
      toast('📥 Đã tải Sổ Tạm đình chỉ (.doc) về máy!');
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTDCHTML();
}

function doDownloadSoPdf(){
  const range=document.getElementById('inSo_range').value;
  let thangDau=0,thangCuoi=0,nam=0;
  if(range==='range'){
    thangDau=+document.getElementById('inSo_thangDau').value;
    thangCuoi=+document.getElementById('inSo_thangCuoi').value;
    nam=+document.getElementById('inSo_nam').value;
    if(thangCuoi<thangDau){toast('Tháng cuối phải ≥ tháng đầu!','err');return;}
  }
  showLoad(true);
  google.script.run
    .withSuccessHandler(html=>{
      closeOvl('inSoOverlay');
      const suffix = range==='range' ? `_Thang_${thangDau}_${thangCuoi}_${nam}` : '_ToanBo';
      downloadHtmlAsPdf(html, `So_Thu_Ly_Tin_Bao${suffix}.pdf`);
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTinBaoHTML(thangDau,thangCuoi,nam);
}

function downloadSoTDCPdf(){
  showLoad(true);
  google.script.run
    .withSuccessHandler(html=>{
      closeOvl('inSoOverlay');
      downloadHtmlAsPdf(html, 'So_Tam_Dinh_Chi.pdf');
    })
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .getSoTDCHTML();
}

function runTaoSheetTDC(){
  if(!confirm('Tạo/đồng bộ sheet "TamDinhChi"?\n\nHệ thống sẽ quét tất cả tin báo có QĐ tạm đình chỉ (kể cả năm cũ) và đưa vào sheet riêng (có thể tải về trong file Xuất Excel).'))return;
  showLoad(true);
  google.script.run
    .withSuccessHandler(res=>{showLoad(false);toast('✅ '+((res&&res.message)||'Đã tạo/đồng bộ sheet TamDinhChi!'));})
    .withFailureHandler(e=>{showLoad(false);toast('Lỗi: '+e.message,'err');})
    .khoiTaoSheetTamDinhChi();
}

// ═══ BÁO CÁO VIẾT — dạng văn xuôi để đọc trong giao ban ═══
function printBaoCaoViet(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước!','err');return;}
  try{ _buildBaoCaoViet(); }catch(e){ toast('Lỗi tạo báo cáo: '+e.message,'err'); console.error(e); }
}
function _buildBaoCaoViet(){
  var d=lastThongKeData;
  var nn=function(v){return String(+(v)||0);};
  var ky='';
  if(d.kyLabel){ky=d.kyLabel;}
  else if(d.thangDau===d.thangCuoi&&d.namDau===d.namCuoi){ky='Tháng '+d.thangDau+'/'+d.namDau;}
  else if(d.namDau===d.namCuoi){ky='Tháng '+d.thangDau+' \u2013 '+d.thangCuoi+'/'+d.namDau;}
  else{ky='Tháng '+d.thangDau+'/'+d.namDau+' \u2013 Tháng '+d.thangCuoi+'/'+d.namCuoi;}
  function lk(list,showKQ){
    if(!list||!list.length)return '<div style="padding:2px 0 2px 16px"><i>(Kh\u00f4ng c\u00f3)</i></div>';
    var s='';for(var i=0;i<list.length;i++){var r=list[i];var parts=[];
      if(r.loaitoi)parts.push(r.loaitoi);if(r.ngayXayRa)parts.push(r.ngayXayRa);if(r.noiXayRa)parts.push(r.noiXayRa);
      var label=parts.join(' \u2013 ')||'\u2014';var cax=r.isCax?' <b style="color:#1d4ed8">[C\u00f4ng an x\u00e3]</b>':'';
      var kq=(showKQ&&r.ngay)?' \u2192 <i>'+r.ngay+'</i>':'';
      s+='<div style="padding:2px 0 2px 16px">- #'+r.stt+': '+label+cax+kq+'</div>';}return s;}
  function caxC(list){var c=0;if(list)for(var i=0;i<list.length;i++)if(list[i].isCax)c++;return c;}
  function caxN(list){var c=caxC(list);return c>0?' (trong \u0111\u00f3 <b>'+c+'</b> tin C\u00f4ng an x\u00e3 th\u1ee5 l\u00fd)':'';}
  var h='';
  h+='<div class="bc-block"><div class="bc-title">I. TH\u1edcI \u0110I\u1ec2M L\u1ea4Y S\u1ed0 LI\u1ec6U</div>';
  h+='<div class="bc-text">K\u1ef3 b\u00e1o c\u00e1o: <b>'+ky+'</b></div>'+(d.locLabel?'<div class="bc-text">Ph\u1ea1m vi l\u1ecdc: <i>'+d.locLabel+'</i></div>':'')+'</div>';
  h+='<div class="bc-block"><div class="bc-title">II. T\u1ed4NG TH\u1ee4 L\u00dd: '+nn(d.tongThuLy)+' tin</div>';
  h+='<div class="bc-text">Bao g\u1ed3m: C\u0169 <b>'+nn(d.tonThangTruoc)+'</b> + M\u1edbi <b>'+nn(d.moiThuLy)+'</b> + Ph\u1ee5c h\u1ed3i <b>'+nn(d.phucHoiTrongThang)+'</b> = <b>'+nn(d.tongThuLy)+'</b></div></div>';
  h+='<div class="bc-block"><div class="bc-sub">1. C\u0169 \u2013 t\u1ed3n k\u1ef3 tr\u01b0\u1edbc: '+nn(d.tonThangTruoc)+' tin'+caxN(d.tonList)+'</div>'+lk(d.tonList)+'</div>';
  h+='<div class="bc-block"><div class="bc-sub">2. M\u1edbi th\u1ee5 l\u00fd: '+nn(d.moiThuLy)+' tin'+caxN(d.moiList)+'</div>'+lk(d.moiList)+'</div>';
  if(+(d.phucHoiTrongThang||0)>0){h+='<div class="bc-block"><div class="bc-sub">3. Ph\u1ee5c h\u1ed3i: '+nn(d.phucHoiTrongThang)+' tin'+caxN(d.phucHoiList)+'</div>'+lk(d.phucHoiList)+'</div>';}
  h+='<div class="bc-block"><div class="bc-title">III. GI\u1ea2I QUY\u1ebeT: '+nn(d.tongGiaiQuyet)+' tin</div>';
  h+='<div class="bc-text">G\u1ed3m: Kh\u1edfi t\u1ed1 <b>'+nn(d.khoiTo)+'</b> + Kh\u00f4ng kh\u1edfi t\u1ed1 <b>'+nn(d.khongKhoiTo)+'</b> + T\u1ea1m \u0111\u00ecnh ch\u1ec9 <b>'+nn(d.tamDinhTrongThang)+'</b> = <b>'+nn(d.tongGiaiQuyet)+'</b></div></div>';
  if(+(d.khoiTo||0)>0){h+='<div class="bc-block"><div class="bc-sub">1. Kh\u1edfi t\u1ed1: '+nn(d.khoiTo)+' v\u1ee5'+caxN(d.khoiToList)+'</div>'+lk(d.khoiToList,true)+'</div>';}
  if(+(d.khongKhoiTo||0)>0){h+='<div class="bc-block"><div class="bc-sub">2. Kh\u00f4ng kh\u1edfi t\u1ed1: '+nn(d.khongKhoiTo)+' v\u1ee5'+caxN(d.khongKhoiToList)+'</div>'+lk(d.khongKhoiToList,true)+'</div>';}
  if(+(d.tamDinhTrongThang||0)>0){h+='<div class="bc-block"><div class="bc-sub">3. T\u1ea1m \u0111\u00ecnh ch\u1ec9: '+nn(d.tamDinhTrongThang)+' v\u1ee5'+caxN(d.tamDinhList)+'</div>'+lk(d.tamDinhList)+'</div>';}
  if(+(d.kktHetThoiHieu||0)>0){h+='<div class="bc-block"><div class="bc-sub">* KKT h\u1ebft th\u1eddi hi\u1ec7u: '+nn(d.kktHetThoiHieu)+' v\u1ee5</div>'+lk(d.kktHetThoiHieuList)+'</div>';}
  h+='<div class="bc-block"><div class="bc-title">IV. C\u00d2N L\u1ea0I CU\u1ed0I K\u1ef2: '+nn(d.conLai)+' tin'+caxN(d.conLaiList)+'</div>';
  h+='<div class="bc-text">= T\u1ed5ng th\u1ee5 l\u00fd '+nn(d.tongThuLy)+' \u2212 Gi\u1ea3i quy\u1ebft '+nn(d.tongGiaiQuyet);
  {const kN=(+d.kktHetThoiHieu||0)-(+(d.kktHTHtuTDC??0)||0);if(kN>0)h+=' \u2212 KKT h\u1ebft TH '+nn(kN);}
  h+=' = <b>'+nn(d.conLai)+'</b></div>'+lk(d.conLaiList)+'</div>';
  if(+(d.tdcConLai||0)>0){h+='<div class="bc-block"><div class="bc-sub">T\u0110C c\u00f2n l\u1ea1i cu\u1ed1i k\u1ef3: '+nn(d.tdcConLai)+' tin'+caxN(d.tdcConLaiList)+'</div>'+lk(d.tdcConLaiList)+'</div>';}
  if(+(d.giaHanTrongKy||0)>0){h+='<div class="bc-block"><div class="bc-title">V. GIA H\u1ea0N: '+nn(d.giaHanTrongKy)+' v\u1ee5</div>';
    var gl=d.giaHanList||[];for(var i=0;i<gl.length;i++){var r=gl[i];var p=[];if(r.loaitoi)p.push(r.loaitoi);if(r.ngayXayRa)p.push(r.ngayXayRa);if(r.noiXayRa)p.push(r.noiXayRa);
    var cx=r.isCax?' <b style="color:#1d4ed8">[CAX]</b>':'';h+='<div style="padding:2px 0 2px 16px">- #'+r.stt+': '+(p.join(' \u2013 ')||'\u2014')+' \u2014 Q\u0110 ng\u00e0y '+(r.giaHanNgay||'?')+(r.giaHanSoNgay?' (+'+r.giaHanSoNgay+'n)':'')+cx+'</div>';}h+='</div>';}
  if((d.chiTieuTrongKy||[]).length>0){h+='<div class="bc-block"><div class="bc-title">VI. CH\u1ec8 TI\u00caU: '+(d.chiTieuTrongKy||[]).length+'</div>';
    var ct=d.chiTieuTrongKy||[];for(var i=0;i<ct.length;i++){var r=ct[i];h+='<div style="padding:2px 0 2px 16px">- '+(r['Lo\u1ea1i']||'')+': '+(r['N\u1ed9i dung']||r['T\u00ean ch\u1ec9 ti\u00eau']||'')+' (S\u1ed1 '+(r['S\u1ed1 Q\u0110/VB']||'?')+' ng\u00e0y '+(r['Ng\u00e0y k\u00fd']||'?')+')</div>';}h+='</div>';}
  if((d.kienNghiTrongKy||[]).length>0){h+='<div class="bc-block"><div class="bc-title">VII. KI\u1ebeN NGH\u1eca: '+(d.kienNghiTrongKy||[]).length+'</div>';
    var kn=d.kienNghiTrongKy||[];for(var i=0;i<kn.length;i++){var r=kn[i];h+='<div style="padding:2px 0 2px 16px">- '+(r['Lo\u1ea1i ki\u1ebfn ngh\u1ecb']||'')+': '+(r['N\u1ed9i dung ki\u1ebfn ngh\u1ecb']||'').substring(0,150)+' (S\u1ed1 '+(r['S\u1ed1 v\u0103n b\u1ea3n']||'?')+' ng\u00e0y '+(r['Ng\u00e0y ban h\u00e0nh']||'?')+')</div>';}h+='</div>';}
  if(+(d.tdcTonDauKy||0)>0){h+='<div class="bc-block"><div class="bc-sub">* T\u0110C t\u1ed3n \u0111\u1ea7u k\u1ef3: '+nn(d.tdcTonDauKy)+' tin</div></div>';}
  var css='@page{size:A4 portrait;margin:2cm}*{box-sizing:border-box}body{font-family:Times New Roman,Times,serif;font-size:13pt;margin:0 auto;max-width:800px;padding:20px;color:#000;line-height:1.55}.bc-header{text-align:center;margin-bottom:18px}.bc-header h1{font-size:15pt;font-weight:bold;margin:0;text-transform:uppercase}.bc-header h2{font-size:12pt;font-weight:normal;font-style:italic;margin:4px 0 0}.bc-block{margin-bottom:8px}.bc-title{font-weight:bold;font-size:13pt;margin:12px 0 4px}.bc-sub{font-weight:bold;font-size:12.5pt;margin:8px 0 2px;color:#1a1a1a}.bc-text{font-size:12.5pt;margin:2px 0}.np{text-align:center;margin:14px 0}.np button{padding:8px 20px;font-size:12pt;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;margin:0 6px}.np .gh{background:#fff;color:#1e40af;border:1px solid #93c5fd}@media print{.np{display:none}}';
  var dlScript='<script>function dlDoc(fn){var c=document.documentElement.cloneNode(true);c.querySelectorAll(".np,script").forEach(function(e){e.remove()});var s="<html xmlns:o=\\"urn:schemas-microsoft-com:office:office\\" xmlns:w=\\"urn:schemas-microsoft-com:office:word\\" xmlns=\\"http://www.w3.org/TR/REC-html40\\"><head><meta charset=\\"utf-8\\"><style>"+document.querySelector("style").innerHTML+"@page Section1 {size:21cm 29.7cm; margin:2cm;} div.Section1 {page:Section1;}<\\/style><\\/head><body><div class=\\"Section1\\">"+c.querySelector("body").innerHTML+"<\\/div><\\/body><\\/html>";var b=new Blob(["\\ufeff",s],{type:"application/msword;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=fn;a.click();}function dlHtml(fn){var b=new Blob([document.documentElement.outerHTML],{type:"text/html;charset=utf-8"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=fn;a.click();}function dlPdf(fn,btn){var orig=btn.innerText;btn.innerText="⏳ Đang tạo PDF...";btn.disabled=true;var base=(window.opener&&window.opener.location)?window.opener.location.origin:"http://localhost:3000";fetch(base+"/api/export-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({html:document.documentElement.outerHTML,filename:fn})}).then(function(r){if(!r.ok)throw new Error("Lỗi tạo PDF");return r.blob();}).then(function(b){var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=fn;a.click();btn.innerText=orig;btn.disabled=false;}).catch(function(e){alert(e.message);btn.innerText=orig;btn.disabled=false;});}<'+'/script>';
  var pg='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>B\u00e1o c\u00e1o vi\u1ebft</title><style>'+css+'<'+'/style>'+dlScript+'<'+'/head><body>';
  pg+='<div class="np"><button onclick="window.print()">\ud83d\udda8\ufe0f In</button><button style="background:#dc2626" onclick="dlPdf(\u0027Bao_Cao_Viet_Tin_Bao.pdf\u0027,this)">\ud83d\udcd5 T\u1ea3i file PDF (.pdf)</button><button style="background:#16a34a" onclick="dlDoc(\u0027Bao_Cao_Viet_Tin_Bao.doc\u0027)">\ud83d\udce5 T\u1ea3i file Word (.doc)</button><button style="background:#0284c7" onclick="dlHtml(\u0027Bao_Cao_Viet_Tin_Bao.html\u0027)">\ud83d\udcbe T\u1ea3i file (.html)</button><button class="gh" onclick="var t=document.getElementById(\u0027bc\u0027).innerText;navigator.clipboard.writeText(t).then(function(){alert(\u0027\u0110\u00e3 sao ch\u00e9p!\u0027)}).catch(function(){var a=document.createElement(\u0027textarea\u0027);a.value=t;document.body.appendChild(a);a.select();document.execCommand(\u0027copy\u0027);a.remove();alert(\u0027\u0110\u00e3 sao ch\u00e9p!\u0027)})">\ud83d\udccb Sao ch\u00e9p</button></div>';
  pg+='<div class="bc-header"><h1>B\u00e1o c\u00e1o t\u00ecnh h\u00ecnh tin b\u00e1o, t\u1ed1 gi\u00e1c t\u1ed9i ph\u1ea1m</h1><h2>VKSND Khu v\u1ef1c 17 \u2014 '+ky+'</h2></div>';
  pg+='<div id="bc">'+h+'</div><'+'/body><'+'/html>';
  if(arguments[0]===true) return pg;
  var w=window.open('','_blank');
  if(!w){toast('Tr\u00ecnh duy\u1ec7t ch\u1eb7n popup!','err');return;}
  w.document.write(pg);w.document.close();
}

function downloadBaoCaoVietDoc(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước khi tải!','err');return;}
  try{
    const html = _buildBaoCaoViet(true);
    downloadHtmlAsWordDoc(html, 'Bao_Cao_Viet_Tin_Bao.doc', false);
    toast('📥 Đã tải Báo cáo viết (.doc) về máy!');
  }catch(e){toast('Lỗi tải báo cáo: '+e.message,'err');}
}

function downloadBaoCaoVietPdf(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước khi tải!','err');return;}
  try{
    const html = _buildBaoCaoViet(true);
    downloadHtmlAsPdf(html, 'Bao_Cao_Viet_Tin_Bao.pdf');
  }catch(e){toast('Lỗi tải báo cáo PDF: '+e.message,'err');}
}

// ═══ IN THỐNG KÊ ═══
function printThongKe(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước khi in!','err');return;}
  const d=lastThongKeData;
  const fmtNum=n=>isNaN(+n)?'0':String(+n||0);
  const ky=d.kyLabel?d.kyLabel:(d.thangDau===d.thangCuoi&&d.namDau===d.namCuoi)
    ?`Tháng ${d.thangDau}/${d.namDau}`
    :(d.namDau===d.namCuoi
      ?`Tháng ${d.thangDau} – ${d.thangCuoi}/${d.namDau}`
      :`Tháng ${d.thangDau}/${d.namDau} – Tháng ${d.thangCuoi}/${d.namCuoi}`);

  const listRows=(list)=>{
    if(!list||!list.length)return '<tr><td colspan="3" style="text-align:center;color:#888;padding:4px">Không có</td></tr>';
    return list.map(r=>{
      const label=[r.loaitoi,r.ngayXayRa,r.noiXayRa].filter(Boolean).join(' - ');
      return `<tr><td class="c">#${r.stt}</td><td>${label||'—'}</td><td class="c">${r.isCax?'CAX':''}</td></tr>`;
    }).join('');
  };
  const ctRows=(list)=>{
    if(!list||!list.length)return '<tr><td colspan="3" style="text-align:center;color:#888;padding:4px">Không có</td></tr>';
    return list.map(r=>`<tr><td class="c">${r['Loại']||''}</td><td>${r['Nội dung']||r['Tên chỉ tiêu']||''}</td><td class="c">${r['Số QĐ/VB']||''} ${r['Ngày ký']||''}</td></tr>`).join('');
  };
  const knRows=(list)=>{
    if(!list||!list.length)return '<tr><td colspan="3" style="text-align:center;color:#888;padding:4px">Không có</td></tr>';
    return list.map(r=>`<tr><td class="c">${r['Loại kiến nghị']||''}</td><td>${(r['Nội dung kiến nghị']||'').substring(0,100)}</td><td class="c">${r['Số văn bản']||''} ${r['Ngày ban hành']||''}</td></tr>`).join('');
  };

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Báo cáo thống kê</title>
  <style>
    @page{size:A4 portrait;margin:1cm 1cm}
    *{box-sizing:border-box}
    body{font-family:'Times New Roman',Times,serif;font-size:9.5pt;margin:0;color:#000;line-height:1.3}
    .hd{text-align:center;margin-bottom:6px}
    .hd h1{font-size:13pt;font-weight:bold;margin:0}
    .hd h2{font-size:9.5pt;font-weight:normal;font-style:italic;margin:1px 0 0}
    .formula{font-size:8pt;color:#444;text-transform:uppercase;letter-spacing:.2px;margin-bottom:4px;text-align:center}
    table.main{width:100%;border-collapse:collapse;margin-bottom:5px}
    table.main td{border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:middle}
    table.main .val{font-size:14pt;font-weight:800;line-height:1}
    table.main .lbl{font-size:8pt;color:#444;margin-top:1px}
    .conlai-box{border:1px solid #000;padding:4px 10px;margin-bottom:6px;display:flex;align-items:center;gap:12px;background:#f5f5f5}
    .conlai-box .val{font-size:16pt;font-weight:800;line-height:1}
    .conlai-box .cl-info{font-size:8.5pt;line-height:1.35}
    .conlai-box .cl-info b{font-weight:bold}
    .detail-cols{column-count:2;column-gap:10px;column-rule:1px solid #ddd}
    .det-section{break-inside:avoid;page-break-inside:avoid;margin-bottom:5px;display:block}
    .section-title{font-size:8.5pt;font-weight:bold;margin:0 0 2px;border-bottom:1px solid #000;padding-bottom:1px;text-transform:uppercase;letter-spacing:.2px}
    table.detail{width:100%;border-collapse:collapse;font-size:7.8pt}
    table.detail th{background:#ececec;border:1px solid #999;padding:1px 3px;font-weight:bold;line-height:1.2}
    table.detail td{border:1px solid #999;padding:1px 3px;line-height:1.25;vertical-align:top}
    table.detail td.c{text-align:center}
    .no-print{margin:10px 0;text-align:center}
    .no-print button{padding:6px 18px;font-size:10.5pt;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;margin:0 4px}
    @media print{.no-print{display:none}}
  </style>
  <script>
    function dlDoc(fn){
      var c=document.documentElement.cloneNode(true);
      c.querySelectorAll('.no-print,script').forEach(function(e){e.remove()});
      var s='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>'+document.querySelector('style').innerHTML+'@page Section1 {size:21cm 29.7cm; margin:1cm 1cm;} div.Section1 {page:Section1;}<\\/style><\\/head><body><div class="Section1">'+c.querySelector('body').innerHTML+'<\\/div><\\/body><\\/html>';
      var b=new Blob(['\\ufeff',s],{type:'application/msword;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();
    }
    function dlHtml(fn){
      var b=new Blob([document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();
    }
    function dlPdf(fn,btn){
      var orig=btn.innerText;btn.innerText='⏳ Đang tạo PDF...';btn.disabled=true;
      var base=(window.opener&&window.opener.location)?window.opener.location.origin:'http://localhost:3000';
      fetch(base+'/api/export-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html:document.documentElement.outerHTML,filename:fn})})
        .then(function(r){if(!r.ok)throw new Error('Lỗi tạo PDF');return r.blob();})
        .then(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();btn.innerText=orig;btn.disabled=false;})
        .catch(function(e){alert(e.message);btn.innerText=orig;btn.disabled=false;});
    }
  </script>
  </head><body>

  <div class="hd">
    <h1>BÁO CÁO THỐNG KÊ TIN BÁO, TỐ GIÁC TỘI PHẠM</h1>
    <h2>Viện kiểm sát nhân dân Khu vực 17, tỉnh Phú Thọ &nbsp;—&nbsp; Kỳ: ${ky}</h2>
    ${d.locLabel?`<h2 style="font-style:italic">Phạm vi lọc: ${d.locLabel}</h2>`:''}
  </div>

  <div class="no-print">
    <button onclick="window.print()">🖨️ In báo cáo</button>
    <button style="background:#dc2626" onclick="dlPdf('Bao_Cao_Thong_Ke_Tin_Bao.pdf',this)">📕 Tải file PDF (.pdf)</button>
    <button style="background:#16a34a" onclick="dlDoc('Bao_Cao_Thong_Ke_Tin_Bao.doc')">📥 Tải file Word (.doc)</button>
    <button style="background:#0284c7" onclick="dlHtml('Bao_Cao_Thong_Ke_Tin_Bao.html')">💾 Tải file (.html)</button>
  </div>

  <div class="formula">Tổng thụ lý = Cũ + Mới + Phục hồi &nbsp;|&nbsp; Còn lại = Tổng thụ lý − Giải quyết &nbsp;|&nbsp; TĐC cuối kỳ = TĐC đầu kỳ + TĐC mới − PH − KKT hết TH</div>
  <table class="main">
    <tr>
      <td style="width:${(d.kktHetThoiHieu||0)>0?'17%':'20%'}"><div class="val">${fmtNum(d.tongThuLy)}</div><div class="lbl">Tổng thụ lý</div></td>
      <td style="width:${(d.kktHetThoiHieu||0)>0?'17%':'20%'}"><div class="val">${fmtNum(d.tonThangTruoc)}</div><div class="lbl">Cũ (tồn kỳ trước)</div></td>
      <td style="width:${(d.kktHetThoiHieu||0)>0?'17%':'20%'}"><div class="val">${fmtNum(d.moiThuLy)}</div><div class="lbl">Mới${d.moiCax>0?` (${d.moiCax} tin xã)`:''}</div></td>
      <td style="width:${(d.kktHetThoiHieu||0)>0?'17%':'20%'}"><div class="val">${fmtNum(d.phucHoiTrongThang||0)}</div><div class="lbl">Phục hồi</div></td>
      <td style="width:${(d.kktHetThoiHieu||0)>0?'17%':'20%'}"><div class="val">${fmtNum(d.tongGiaiQuyet)}</div><div class="lbl">Giải quyết<br><span style="font-size:8pt">KT ${fmtNum(d.khoiTo)} · KKT ${fmtNum(d.khongKhoiTo)} · TĐC ${fmtNum(d.tamDinhTrongThang)}</span></div></td>
      ${(d.kktHetThoiHieu||0)>0?`<td style="width:15%;background:#fef3c7"><div class="val" style="color:#92400e">${fmtNum(d.kktHetThoiHieu)}</div><div class="lbl" style="color:#92400e">KKT hết<br>thời hiệu</div></td>`:''}
    </tr>
  </table>

  <div class="conlai-box">
    <div class="val">${fmtNum(d.conLai)}</div>
    <div class="cl-info">
      <div><b>Còn lại cuối kỳ</b> = Tổng thụ lý ${fmtNum(d.tongThuLy)} − Giải quyết ${fmtNum(d.tongGiaiQuyet)}${((+d.kktHetThoiHieu||0)-(+(d.kktHTHtuTDC??0)||0))>0?` − KKT hết TH ${fmtNum((+d.kktHetThoiHieu||0)-(+(d.kktHTHtuTDC??0)||0))}`:''}</div>
      ${(d.tdcConLai||0)+(d.giaHanTrongKy||0)+((d.chiTieuTrongKy||[]).length)+((d.kienNghiTrongKy||[]).length)>0?`<div style="margin-top:2px">
        ${(d.tdcConLai||0)>0?`<span>⏸ TĐC còn lại: <b>${fmtNum(d.tdcConLai)}</b></span>`:''}
        ${(d.tdcConLai||0)>0&&(d.giaHanTrongKy||0)>0?' &nbsp;·&nbsp; ':''}
        ${(d.giaHanTrongKy||0)>0?`<span>🔄 Gia hạn: <b>${fmtNum(d.giaHanTrongKy)}</b></span>`:''}
        ${((d.tdcConLai||0)+(d.giaHanTrongKy||0))>0&&((d.chiTieuTrongKy||[]).length)>0?' &nbsp;·&nbsp; ':''}
        ${((d.chiTieuTrongKy||[]).length)>0?`<span>📌 Chỉ tiêu: <b>${fmtNum((d.chiTieuTrongKy||[]).length)}</b></span>`:''}
        ${((d.chiTieuTrongKy||[]).length)>0&&((d.kienNghiTrongKy||[]).length)>0?' &nbsp;·&nbsp; ':''}
        ${((d.kienNghiTrongKy||[]).length)>0?`<span>📢 Kiến nghị: <b>${fmtNum((d.kienNghiTrongKy||[]).length)}</b></span>`:''}
      </div>`:''}
    </div>
  </div>

  <div class="detail-cols">
  <div class="det-section">
  <div class="section-title">📂 Cũ - tồn kỳ trước (${fmtNum(d.tonThangTruoc)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.tonList)}</tbody></table>
  </div>

  <div class="det-section">
  <div class="section-title">🆕 Mới thụ lý trong kỳ (${fmtNum(d.moiThuLy)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.moiList)}</tbody></table>
  </div>

  <div class="det-section">
  <div class="section-title">✅ Khởi tố (${fmtNum(d.khoiTo)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.khoiToList)}</tbody></table>
  </div>

  <div class="det-section">
  <div class="section-title">🚫 Không khởi tố (${fmtNum(d.khongKhoiTo)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.khongKhoiToList)}</tbody></table>
  </div>

  ${(d.kktHetThoiHieu||0)>0?`
  <div class="det-section">
  <div class="section-title">⏱ KKT - Hết thời hiệu (${fmtNum(d.kktHetThoiHieu)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.kktHetThoiHieuList)}</tbody></table>
  </div>`:''}

  <div class="det-section">
  <div class="section-title">⏳ Còn lại cuối kỳ (${fmtNum(d.conLai)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.conLaiList)}</tbody></table>
  </div>

  ${(d.tamDinhTrongThang||0)>0?`
  <div class="det-section">
  <div class="section-title">⏸ Tạm đình chỉ trong kỳ (${fmtNum(d.tamDinhTrongThang)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:12%">CAX</th></tr></thead>
  <tbody>${listRows(d.tamDinhList)}</tbody></table>
  </div>`:''}

  ${(d.giaHanTrongKy||0)>0?`
  <div class="det-section">
  <div class="section-title">🔄 Gia hạn trong kỳ (${fmtNum(d.giaHanTrongKy)})</div>
  <table class="detail"><thead><tr><th style="width:14%">STT</th><th>Vụ việc</th><th style="width:22%">Ngày QĐ</th></tr></thead>
  <tbody>${(d.giaHanList||[]).map(r=>{
    const label=[r.loaitoi,r.ngayXayRa,r.noiXayRa].filter(Boolean).join(' - ');
    return `<tr><td class="c">#${r.stt}</td><td>${label||'—'}</td><td class="c">${r.giaHanNgay||''}${r.giaHanSoNgay?` (+${r.giaHanSoNgay}n)`:''}</td></tr>`;
  }).join('')}</tbody></table>
  </div>`:''}

  ${((d.chiTieuTrongKy||[]).length)>0?`
  <div class="det-section">
  <div class="section-title">📌 Chỉ tiêu ban hành (${fmtNum((d.chiTieuTrongKy||[]).length)})</div>
  <table class="detail"><thead><tr><th style="width:22%">Loại</th><th>Nội dung</th><th style="width:22%">Số/Ngày</th></tr></thead>
  <tbody>${ctRows(d.chiTieuTrongKy)}</tbody></table>
  </div>`:''}

  ${((d.kienNghiTrongKy||[]).length)>0?`
  <div class="det-section">
  <div class="section-title">📢 Kiến nghị ban hành (${fmtNum((d.kienNghiTrongKy||[]).length)})</div>
  <table class="detail"><thead><tr><th style="width:22%">Loại</th><th>Nội dung</th><th style="width:22%">Số/Ngày</th></tr></thead>
  <tbody>${knRows(d.kienNghiTrongKy)}</tbody></table>
  </div>`:''}
  </div>

  </body></html>`;

  if(arguments[0]===true) return html;
  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

function downloadThongKeDoc(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước khi tải!','err');return;}
  try{
    const html = printThongKe(true);
    downloadHtmlAsWordDoc(html, 'Bao_Cao_Thong_Ke_Tin_Bao.doc', false);
    toast('📥 Đã tải Báo cáo thống kê (.doc) về máy!');
  }catch(e){toast('Lỗi tải thống kê: '+e.message,'err');}
}

function downloadThongKePdf(){
  if(!lastThongKeData||lastThongKeData.error){toast('Hãy bấm "Tính toán" trước khi tải!','err');return;}
  try{
    const html = printThongKe(true);
    downloadHtmlAsPdf(html, 'Bao_Cao_Thong_Ke_Tin_Bao.pdf');
  }catch(e){toast('Lỗi tải thống kê PDF: '+e.message,'err');}
}

function runFormatSheet(){
  exportExcelFile();
}
