/**
 * HVA-NQ52 | 04_NHAN_SU.gs
 * Doc nguon nhan su rieng, chi kiem tra va thong ke.
 * Khong doc mat khau, CCCD, ngay sinh, dien thoai hay cac cot khong can thiet.
 * NQ52_PERSONNEL_SOURCE_ID: Script Properties, khong dua len GitHub.
 */
function previewNQ52Personnel() {
  const sourceId = PropertiesService.getScriptProperties().getProperty('NQ52_PERSONNEL_SOURCE_ID');
  if (!sourceId) throw new Error('Chua cau hinh NQ52_PERSONNEL_SOURCE_ID trong Script Properties.');
  const book = SpreadsheetApp.openById(sourceId.trim());
  const sh = book.getSheetByName('NHAN_SU');
  if (!sh) throw new Error('Khong tim thay sheet NHAN_SU.');
  const headerRow = 6;
  const count = Math.max(0, sh.getLastRow() - headerRow);
  const headers = sh.getRange(headerRow, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(nq52PersonnelNorm_);
  const fields = {
    name: 'ho ten',
    username: 'ten dang nhap',
    unit: 'to/bo phan',
    position: 'vi tri viec lam',
    role: 'vai tro',
    status: 'trang thai',
    contract: 'hinh thuc hop dong'
  };
  const columns = {};
  Object.keys(fields).forEach(function(key) {
    const matches = headers.reduce(function(out, h, i) {
      if (h === fields[key]) out.push(i + 1);
      return out;
    }, []);
    if (matches.length !== 1) throw new Error('Khong xac dinh duy nhat cot: ' + fields[key]);
    columns[key] = matches[0];
  });
  // Chi doc cac cot da duoc phep; khong doc ca vung du lieu nhan su.
  const data = {};
  Object.keys(columns).forEach(function(key) {
    data[key] = count ? sh.getRange(headerRow + 1, columns[key], count, 1).getDisplayValues() : [];
  });
  const stats = {CBQL:0, GV:0, NV:0, UNKNOWN:0};
  const working = {CBQL:0, GV:0, NV:0, UNKNOWN:0};
  const roleCounts = {TTCM:0, TPCM:0};
  const units = new Set();
  const seen = new Map();
  const issues = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const row = {};
    Object.keys(data).forEach(function(key) {row[key] = String(data[key][i][0] || '').trim();});
    if (!row.name && !row.username) continue;
    total++;
    const rowNo = headerRow + 1 + i;
    const group = nq52PersonnelGroup_(row.position, row.role);
    stats[group]++;
    if (group === 'UNKNOWN') issues.push({row:rowNo,code:'GROUP_REVIEW_REQUIRED'});
    const role = nq52PersonnelNorm_(row.role);
    if (role === 'ttcm') roleCounts.TTCM++;
    if (role === 'tpcm') roleCounts.TPCM++;
    if (row.unit) units.add(row.unit);
    if (!row.name || !row.username || !row.unit) issues.push({row:rowNo,code:'MISSING_FIELD'});
    const username = row.username.toLowerCase();
    if (username) {
      if (seen.has(username)) issues.push({row:rowNo,otherRow:seen.get(username),code:'DUPLICATE_USERNAME'});
      else seen.set(username,rowNo);
    }
    if (nq52PersonnelNorm_(row.status) === 'dang lam viec') working[group]++;
    else issues.push({row:rowNo,code:'EMPLOYMENT_STATUS_REVIEW'});
    if (!row.contract) issues.push({row:rowNo,code:'CONTRACT_REVIEW_REQUIRED'});
  }
  const result = {
    ok:true, stage:'PREVIEW_ONLY', sheet:'NHAN_SU', headerRow:headerRow,
    total:total, groups:stats, workingGroups:working,
    sourceRoleCounts:roleCounts, unitCount:units.size, issues:issues,
    accountsCreated:0, writes:0, productionReady:false
  };
  // Nhat ky chi gom so lieu tong hop va so dong can kiem tra, khong gom ten/username.
  console.log(JSON.stringify(result,null,2));
  return result;
}
function nq52PersonnelNorm_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/gi,'d').toLowerCase().replace(/\s*\/\s*/g,'/')
    .replace(/\s+/g,' ').trim();
}
function nq52PersonnelGroup_(position, role) {
  const p = nq52PersonnelNorm_(position), r = nq52PersonnelNorm_(role);
  const classify = function(v) {
    if (['ht','pht','cbql','bgh','hieu truong','pho hieu truong','can bo quan ly'].includes(v)) return 'CBQL';
    if (['gv','giao vien','ttcm','tpcm','to truong chuyen mon','to pho chuyen mon'].includes(v)) return 'GV';
    if (['nv','nhan vien'].includes(v)) return 'NV';
    return 'UNKNOWN';
  };
  const a=classify(p), b=classify(r);
  if(a!=='UNKNOWN'&&b!=='UNKNOWN'&&a!==b)return 'UNKNOWN';
  return a!=='UNKNOWN'?a:b;
}
