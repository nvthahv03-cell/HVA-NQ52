/**
 * HVA-NQ52 | 03_SETUP.gs
 * Khoi tao co so du lieu rieng. Chay initializeNQ52() trong Apps Script.
 * Phu thuoc 00_CORE.gs va 04_NHAN_SU.gs.
 * Script Properties: NQ52_ROOT_FOLDER_ID, NQ52_PERSONNEL_SOURCE_ID.
 * Khong ghi ID Drive hoac thong tin nhan su vao repository cong khai.
 * Khong ket noi EDOS, khong tao tai khoan hoac du lieu danh gia gia.
 */
function initializeNQ52() {
  return nqLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const root = nq52ProjectRoot_(props);
    const sourceId = String(props.getProperty('NQ52_PERSONNEL_SOURCE_ID') || '').trim();
    if (!sourceId) throw new Error('CHUA_CAU_HINH: NQ52_PERSONNEL_SOURCE_ID');
    const sourceFile = DriveApp.getFileById(sourceId);
    nq52Restricted_(sourceFile, 'NGUON_NHAN_SU');
    if (!nq52WithinProject_(sourceFile, root)) throw new Error('NGUON_NHAN_SU_KHONG_NAM_TRONG_THU_MUC_NQ52');
    if (typeof nq52ReadPersonnel_ !== 'function') throw new Error('CAN_CAP_NHAT_04_NHAN_SU.gs');
    const personnel = nq52ReadPersonnel_();
    const personnelPreview = nq52PersonnelStats_(personnel);
    if (!personnel.people.length || personnel.issues.some(function (i) { return i.blocking; })) {
      console.log(JSON.stringify(personnelPreview, null, 2));
      throw new Error('DUNG_KHOI_TAO: KIEM_TRA_NHAN_SU_TRUOC');
    }
    const folders = nq52ProjectFolders_(root);
    let id = props.getProperty('NQ52_SHEET_ID');
    let book;
    let created = false;

    if (id) {
      // Neu ID da co ma khong mo duoc: dung, khong tao file thay the.
      book = SpreadsheetApp.openById(id);
      nq52CheckDatabaseName_(book);
      nq52Restricted_(DriveApp.getFileById(id), 'DATABASE');
    } else {
      if (root.getFilesByName('HVA_NQ52_DATABASE').hasNext() || folders['01_CO_SO_DU_LIEU'].getFilesByName('HVA_NQ52_DATABASE').hasNext()) {
        throw new Error('DA_CO_DATABASE: KIEM_TRA_FILE_VA_CAU_HINH_NQ52_SHEET_ID, KHONG_TAO_TRUNG');
      }
      book = SpreadsheetApp.create('HVA_NQ52_DATABASE');
      id = book.getId();
      // Luu ID ngay de co the chay lai khi khoi tao bi gian doan.
      props.setProperty('NQ52_SHEET_ID', id);
      created = true;
    }

    // Chi di chuyen DATABASE duoc cau hinh; khong di chuyen nguon nhan su.
    const dbFile = DriveApp.getFileById(id);
    const dbFolder = folders['01_CO_SO_DU_LIEU'];
    if (!nq52HasParent_(dbFile, dbFolder.getId())) dbFile.moveTo(dbFolder);
    book.setSpreadsheetTimeZone(NQ.TZ);
    book.setSpreadsheetLocale('vi_VN');

    // Tai su dung sheet mac dinh chi khi bang tinh moi hoac khoi tao do dang.
    const sheets = book.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0 &&
        !book.getSheetByName('NQ52_USERS') &&
        !Object.prototype.hasOwnProperty.call(NQ.TABLES, sheets[0].getName()) &&
        sheets[0].getName() !== 'NQ52_CONFIG') {
      sheets[0].setName('NQ52_USERS');
    }

    // Kiem tra cac tieu de da ton tai truoc khi bo sung sheet.
    Object.keys(NQ.TABLES).forEach(function (name) {
      const sh = book.getSheetByName(name);
      if (sh && sh.getLastRow() > 0) nqCheckHeader_(sh, name);
    });
    nq52CheckConfig_(book);

    // Ke thua ham khoi tao 7 bang nghiep vu trong 00_CORE.gs.
    setupNQ52();

    Object.keys(NQ.TABLES).forEach(function (name) {
      nq52FormatHeader_(book.getSheetByName(name), NQ.TABLES[name]);
    });

    nq52SetupConfig_(book);
    SpreadsheetApp.flush();

    const result = nq52DatabaseStatus_(book);
    result.created = created;
    result.projectFolders = Object.keys(folders);
    result.databaseInProjectFolder = nq52HasParent_(dbFile, dbFolder.getId());
    result.personnelPreview = personnelPreview;
    result.personnelSynced = false;
    console.log(JSON.stringify(result, null, 2));
    console.log('Mo co so du lieu: ' + book.getUrl());
    return result;
  });
}

function nq52CheckDatabaseName_(book) {
  if (book.getName() !== 'HVA_NQ52_DATABASE') {
    throw new Error('DUNG KHOI TAO: NQ52_SHEET_ID khong tro den bang tinh HVA_NQ52_DATABASE.');
  }
}

function nq52FormatHeader_(sh, headers) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#103E62')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  // Chi dinh dang kich thuoc cot; khong ghi lai du lieu.
  headers.forEach(function (key, i) {
    const widths = {data:420,detail:320,email:240,name:220,unit:230,description:420,
      id:265,userId:265,firebaseUid:265,createdAt:190,updatedAt:190,at:190,
      key:230,value:260,month:110};
    sh.setColumnWidth(i + 1, widths[key] || 145);
  });
}

function nq52CheckConfig_(book) {
  const sh = book.getSheetByName('NQ52_CONFIG');
  if (!sh || sh.getLastRow() === 0) return;
  const expected = ['key', 'value', 'description'];
  const actual = sh.getRange(1, 1, 1, 3).getDisplayValues()[0];
  if (expected.some(function (v, i) { return v !== actual[i]; })) {
    throw new Error('SCHEMA_MISMATCH: NQ52_CONFIG');
  }
}

function nq52SetupConfig_(book) {
  const headers = ['key', 'value', 'description'];
  let sh = book.getSheetByName('NQ52_CONFIG');
  if (!sh) sh = book.insertSheet('NQ52_CONFIG');
  nq52CheckConfig_(book);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 3).setValues([headers]);

  // Cau hinh khoi tao, khong phai bo tieu chi phap ly da phe duyet.
  const defaults = [
    ['SYSTEM_NAME', 'HVA-NQ52', 'Tên hệ thống'],
    ['SCHOOL_NAME', 'Trường THPT Hòa Vang', 'Đơn vị sử dụng'],
    ['SCHEMA_VERSION', '0.1.0', 'Phiên bản cấu trúc cơ sở dữ liệu'],
    ['TIMEZONE', NQ.TZ, 'Múi giờ bảng tính'],
    ['FIRST_PERIOD', '2026-11', 'Tháng triển khai dự kiến'],
    ['OBJECT_GROUPS', 'CBQL,GV,NV', 'Ba nhóm đối tượng; không phải quyền truy cập'],
    ['MEETING_DAY_FROM', '25', 'Mốc họp nội bộ dự kiến'],
    ['MEETING_DAY_TO', '26', 'Mốc họp nội bộ dự kiến'],
    ['POLICY_STATUS', 'PENDING_VERIFICATION', 'Chưa kích hoạt tính điểm và xếp loại tự động'],
    ['SYSTEM_STAGE', 'DEVELOPMENT', 'Chưa vận hành chính thức']
  ];
  const last = sh.getLastRow();
  const existing = last > 1
    ? sh.getRange(2, 1, last - 1, 1).getDisplayValues().map(function (r) { return r[0]; })
    : [];
  const missing = defaults.filter(function (r) { return existing.indexOf(r[0]) === -1; });
  if (missing.length) {
    sh.getRange(last + 1, 1, missing.length, 3).setNumberFormat('@').setValues(missing);
  }
  nq52FormatHeader_(sh, headers);
}

function nq52DatabaseStatus_(book) {
  const tables = Object.keys(NQ.TABLES).map(function (name) {
    const sh = book.getSheetByName(name);
    if (!sh) throw new Error('THIEU_SHEET: ' + name);
    nqCheckHeader_(sh, name);
    return {name: name, rows: Math.max(0, sh.getLastRow() - 1)};
  });
  if (!book.getSheetByName('NQ52_CONFIG')) throw new Error('THIEU_SHEET: NQ52_CONFIG');
  nq52CheckConfig_(book);
  tables.push({name:'NQ52_CONFIG', rows:Math.max(0, book.getSheetByName('NQ52_CONFIG').getLastRow()-1)});
  return {
    ok: true,
    status: 'SCHEMA_OK',
    spreadsheetName: book.getName(),
    spreadsheetUrl: book.getUrl(),
    timezone: book.getSpreadsheetTimeZone(),
    totalTables: tables.length,
    tables: tables,
    firebaseKeyConfigured: !!PropertiesService.getScriptProperties().getProperty('NQ52_FIREBASE_KEY'),
    productionReady: false
  };
}

/** Chay rieng de kiem tra, khong tao file, khong thay doi du lieu. */
function checkNQ52Database() {
  const book = nqBook_();
  nq52CheckDatabaseName_(book);
  const result = nq52DatabaseStatus_(book);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Thu muc du an: chi chap nhan che do chia se han che. */
function nq52ProjectRoot_(props) {
  const id = String(props.getProperty('NQ52_ROOT_FOLDER_ID') || '').trim();
  if (!id) throw new Error('CHUA_CAU_HINH: NQ52_ROOT_FOLDER_ID');
  const folder = DriveApp.getFolderById(id);
  if (!/^HVA[-_]NQ52$/i.test(folder.getName())) throw new Error('KIEM_TRA_TEN_THU_MUC_GOC_HVA-NQ52');
  nq52Restricted_(folder, 'THU_MUC_GOC');
  return folder;
}
function nq52Restricted_(item, label) {
  if (item.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    throw new Error('DUNG_KHOI_TAO: ' + label + ' PHAI_CHIA_SE_HAN_CHE');
  }
}
function nq52HasParent_(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folderId) return true;
  return false;
}
function nq52WithinProject_(file, root) {
  if (nq52HasParent_(file, root.getId())) return true;
  const folders = root.getFoldersByName('00_NHAN_SU');
  while (folders.hasNext()) {
    const folder = folders.next();
    if (nq52HasParent_(file, folder.getId())) {
      nq52Restricted_(folder, '00_NHAN_SU');
      return true;
    }
  }
  return false;
}
function nq52ProjectFolders_(root) {
  const names = [
    '00_NHAN_SU','01_CO_SO_DU_LIEU','02_BACKEND','03_VAN_BAN_PHAP_LY',
    '04_DU_LIEU_LICH_SU','05_KET_QUA_DANH_GIA','06_MINH_CHUNG','07_HO_SO_SANG_KIEN'
  ];
  const result = {};
  // Kiem tra trung ten va chia se truoc khi tao cac thu muc con.
  names.forEach(function (name) {
    const matches = root.getFoldersByName(name);
    if (matches.hasNext()) {
      const folder = matches.next();
      if (matches.hasNext()) throw new Error('TRUNG_THU_MUC: ' + name);
      nq52Restricted_(folder, name);
      result[name] = folder;
    }
  });
  names.forEach(function (name) {
    if (!result[name]) {
      const folder = root.createFolder(name);
      nq52Restricted_(folder, name);
      result[name] = folder;
    }
  });
  return result;
}
