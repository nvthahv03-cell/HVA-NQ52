/**
 * HVA-NQ52 | 03_SETUP.gs
 * Khoi tao co so du lieu rieng. Chay initializeNQ52() trong Apps Script.
 * Phu thuoc 00_CORE.gs (NQ.TABLES, setupNQ52, nqLock_).
 * Khong ket noi EDOS, khong tao tai khoan hoac du lieu danh gia gia.
 */
function initializeNQ52() {
  return nqLock_(function () {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('NQ52_SHEET_ID');
    let book;
    let created = false;

    if (id) {
      // Neu ID da co ma khong mo duoc: dung, khong tao file thay the.
      book = SpreadsheetApp.openById(id);
      nq52CheckDatabaseName_(book);
    } else {
      book = SpreadsheetApp.create('HVA_NQ52_DATABASE');
      id = book.getId();
      // Luu ID ngay de co the chay lai khi khoi tao bi gian doan.
      props.setProperty('NQ52_SHEET_ID', id);
      created = true;
    }

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
