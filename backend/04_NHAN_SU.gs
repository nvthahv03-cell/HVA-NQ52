/**
 * HVA-NQ52 | 04_NHAN_SU.gs | Personnel directory 0.3
 * Ke thua quy tac danh muc to, unitKey, chong trung cua HVA_Personnel.js.
 * Doc ban sao NHAN_SU cua NQ52; KHONG goi API/session EDOS.
 * Chi chay ham quan tri trong Apps Script; khong mo qua Router.
 * Khong doc mat khau, CCCD, ngay sinh, dien thoai, chi bo.
 */
const NQ52_PERSONNEL_UNITS = [
  ['MATH_IT','Toán - Tin','Toán - Tin'],
  ['LITERATURE','Ngữ văn','Ngữ văn'],
  ['ENGLISH','Tiếng Anh','Ngoại Ngữ'],
  ['HISTORY_GEO','Lịch sử - Địa lí - GDKT&PL','Sử - Địa - GD KT&PL'],
  ['PHYSICS_TECH','Vật lí - Công nghệ','Vật lí - Công nghệ'],
  ['CHEMISTRY','Hóa học','Hóa học'],
  ['BIO_PE_DEF','Sinh - GDTC - QPAN','Sinh - GDTC - QPAN'],
  ['OFFICE','Văn phòng','Văn phòng']
];
const NQ52_DIRECTORY_HEADERS = [
  'id','username','name','group','unitKey','unit','sourceUnit','position',
  'sourceRole','employmentStatus','contract','subject','homeroom',
  'liaison','extendedLiaison','sourceRow','syncedAt','sourceState'
];

function nq52PersonnelNorm_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/gi,'d').toLowerCase().replace(/\s*\/\s*/g,'/')
    .replace(/\s+/g,' ').trim();
}
function nq52PersonnelUnitKey_(v) {
  const n=nq52PersonnelNorm_(v).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  if(n==='ngoai ngu'||n==='tieng anh')return 'ENGLISH';
  if(n.includes('su')&&n.includes('dia')&&(n.includes('kt')||n.includes('giao duc kinh te')))return 'HISTORY_GEO';
  if(n==='toan tin')return 'MATH_IT';
  if(n==='ngu van')return 'LITERATURE';
  if(n==='vat li cong nghe'||n==='vat ly cong nghe')return 'PHYSICS_TECH';
  if(n==='hoa hoc')return 'CHEMISTRY';
  if(n.includes('sinh')&&n.includes('gdtc')&&(n.includes('qpan')||n.includes('qp an')))return 'BIO_PE_DEF';
  if(n==='van phong')return 'OFFICE';
  if(['bgh','ban giam hieu','lanh dao','can bo quan ly'].includes(n))return 'BGH';
  return '';
}
function nq52PersonnelGroup_(position,role) {
  const classify=function(v){
    v=nq52PersonnelNorm_(v);
    if(['ht','pht','cbql','bgh','hieu truong','pho hieu truong','can bo quan ly'].includes(v))return 'CBQL';
    if(['gv','giao vien','ttcm','tpcm','to truong chuyen mon','to pho chuyen mon'].includes(v))return 'GV';
    if(['nv','nhan vien'].includes(v))return 'NV';
    return 'UNKNOWN';
  };
  const a=classify(position),b=classify(role);
  return a!=='UNKNOWN'&&b!=='UNKNOWN'&&a!==b?'UNKNOWN':a!=='UNKNOWN'?a:b;
}
function nq52ReadPersonnel_() {
  const props=PropertiesService.getScriptProperties();
  const sourceId=String(props.getProperty('NQ52_PERSONNEL_SOURCE_ID')||'').trim();
  if(!sourceId)throw new Error('Chua cau hinh NQ52_PERSONNEL_SOURCE_ID.');
  if(sourceId===props.getProperty('NQ52_SHEET_ID'))throw new Error('Nguon nhan su phai la bang tinh rieng.');
  const root=nq52ProjectRoot_(props);
  const file=DriveApp.getFileById(sourceId);
  nq52Restricted_(file,'NGUON_NHAN_SU');
  if(!nq52WithinProject_(file,root))throw new Error('NGUON_NHAN_SU_KHONG_NAM_TRONG_THU_MUC_NQ52');
  const source=SpreadsheetApp.openById(sourceId);
  if(source.getName()!=='Du_lieu_NhanSu_HVA_NQ52')throw new Error('Kiem tra lai ten bang tinh nguon NQ52; khong dung ban goc EDOS.');
  const sh=source.getSheetByName('NHAN_SU');
  if(!sh||sh.getLastRow()<6||sh.getLastColumn()<1)throw new Error('Khong tim thay cau truc NHAN_SU.');
  const headers=sh.getRange(6,1,1,sh.getLastColumn()).getDisplayValues()[0].map(nq52PersonnelNorm_);
  const required={name:'ho ten',username:'ten dang nhap',unit:'to/bo phan',position:'vi tri viec lam',role:'vai tro',status:'trang thai',contract:'hinh thuc hop dong'};
  const optional={subject:'mon day',homeroom:'gvcn',liaison:'lien tich',extendedLiaison:'lien tich mo rong'};
  const count=sh.getLastRow()-6, cols={}, issues=[];
  function readFields(fields,must){
    Object.keys(fields).forEach(function(k){
      const matches=[];headers.forEach(function(h,i){if(h===fields[k])matches.push(i+1);});
      if(matches.length!==1){
        if(must||matches.length>1)throw new Error('Cot khong xac dinh duy nhat: '+fields[k]);
        issues.push({code:'OPTIONAL_COLUMN_MISSING',field:k});return;
      }
      cols[k]=count?sh.getRange(7,matches[0],count,1).getDisplayValues():[];
    });
  }
  readFields(required,true);readFields(optional,false);
  const people=[], seen=new Map();
  for(let i=0;i<count;i++){
    const row={};Object.keys(cols).forEach(k=>row[k]=String(cols[k][i][0]||'').trim());
    if(!row.name&&!row.username)continue;
    const sourceRow=i+7,username=String(row.username||'').toLowerCase();
    const group=nq52PersonnelGroup_(row.position,row.role);
    const unitKey=nq52PersonnelUnitKey_(row.unit)||(group==='CBQL'&&!row.unit?'BGH':'');
    const unitEntry=NQ52_PERSONNEL_UNITS.find(x=>x[0]===unitKey);
    const unit=unitEntry?unitEntry[1]:unitKey==='BGH'?'Ban Giám hiệu':row.unit;
    if(!row.name||!username)issues.push({row:sourceRow,code:'MISSING_IDENTITY',blocking:true});
    if(username&&seen.has(username))issues.push({row:sourceRow,otherRow:seen.get(username),code:'DUPLICATE_USERNAME',blocking:true});
    else if(username)seen.set(username,sourceRow);
    if(group==='UNKNOWN')issues.push({row:sourceRow,code:'GROUP_REVIEW_REQUIRED'});
    if(!unitKey)issues.push({row:sourceRow,code:'UNIT_REVIEW_REQUIRED'});
    if(nq52PersonnelNorm_(row.status)!=='dang lam viec')issues.push({row:sourceRow,code:'EMPLOYMENT_STATUS_REVIEW'});
    if(!row.contract)issues.push({row:sourceRow,code:'CONTRACT_REVIEW_REQUIRED'});
    people.push({username,name:row.name,group,unitKey,unit,sourceUnit:row.unit,position:row.position,
      sourceRole:row.role,employmentStatus:row.status,contract:row.contract,subject:row.subject||'',
      homeroom:row.homeroom||'',liaison:row.liaison||'',extendedLiaison:row.extendedLiaison||'',sourceRow});
  }
  return {people,issues};
}
function nq52PersonnelStats_(source) {
  const groups={CBQL:0,GV:0,NV:0,UNKNOWN:0},workingGroups={CBQL:0,GV:0,NV:0,UNKNOWN:0};
  const roleCounts={TTCM:0,TPCM:0};
  const byUnit=NQ52_PERSONNEL_UNITS.map(x=>({unitKey:x[0],unit:x[1],count:0,working:0}));
  const otherGroups={BGH:0,HoiDong:0,GVCN:0,LienTich:0,LienTichMoRong:0};
  source.people.forEach(p=>{
    groups[p.group]++;
    const active=nq52PersonnelNorm_(p.employmentStatus)==='dang lam viec';
    const r=nq52PersonnelNorm_(p.sourceRole);
    if(r==='ttcm'||r==='to truong chuyen mon')roleCounts.TTCM++;
    if(r==='tpcm'||r==='to pho chuyen mon')roleCounts.TPCM++;
    const u=byUnit.find(x=>x.unitKey===p.unitKey);
    if(u){u.count++;if(active)u.working++;}
    if(!active)return;
    workingGroups[p.group]++;
    if(p.group==='CBQL')otherGroups.BGH++;
    if(p.group==='CBQL'||(u&&p.group!=='UNKNOWN'))otherGroups.HoiDong++;
    if(nq52PersonnelMembership_(p.homeroom))otherGroups.GVCN++;
    if(nq52PersonnelMembership_(p.liaison))otherGroups.LienTich++;
    if(nq52PersonnelMembership_(p.extendedLiaison))otherGroups.LienTichMoRong++;
  });
  return {total:source.people.length,groups,workingGroups,sourceRoleCounts:roleCounts,byUnit,
    workgroupCandidates:otherGroups,issues:source.issues,productionReady:false};
}
function nq52PersonnelMembership_(v){
  const n=nq52PersonnelNorm_(v);
  return !!n&&!['0','khong','false','-','—','n/a'].includes(n);
}
/** Buoc 1: chi doc, thong ke; khong tao tai khoan hay ghi du lieu. */
function previewNQ52Personnel(){
  const result=Object.assign({ok:true,stage:'PREVIEW_ONLY',writes:0,accountsCreated:0},
    nq52PersonnelStats_(nq52ReadPersonnel_()));
  console.log(JSON.stringify(result,null,2));return result;
}
/** Buoc 2: sau khi duyet preview, dong bo danh muc vao DATABASE rieng. */
function syncNQ52Personnel(){
  return nqLock_(function(){
    const source=nq52ReadPersonnel_(), stats=nq52PersonnelStats_(source);
    if(!source.people.length||source.issues.some(x=>x.blocking))throw new Error('DUNG DONG BO: nguon rong hoac trung/thieu dinh danh. Chay previewNQ52Personnel.');
    const book=nqBook_();
    nq52CheckDatabaseName_(book);
    const root=nq52ProjectRoot_(PropertiesService.getScriptProperties());
    const folders=root.getFoldersByName('01_CO_SO_DU_LIEU');
    if(!folders.hasNext())throw new Error('CHUA_KHOI_TAO_DATABASE');
    const folder=folders.next();
    if(folders.hasNext())throw new Error('TRUNG_THU_MUC_DATABASE');
    nq52Restricted_(folder,'01_CO_SO_DU_LIEU');
    const dbFile=DriveApp.getFileById(book.getId());
    nq52Restricted_(dbFile,'DATABASE');
    if(!nq52HasParent_(dbFile,folder.getId()))throw new Error('DATABASE_KHONG_NAM_TRONG_THU_MUC_NQ52');
    let sh=book.getSheetByName('NQ52_PERSONNEL');
    if(!sh)sh=book.insertSheet('NQ52_PERSONNEL');
    const h=NQ52_DIRECTORY_HEADERS, n=h.length;
    if(!sh.getLastRow()){
      sh.getRange(1,1,1,n).setValues([h]).setBackground('#103E62').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
      sh.setFrozenRows(1);
    }
    const actual=sh.getRange(1,1,1,n).getDisplayValues()[0];
    if(h.some((k,i)=>actual[i]!==k))throw new Error('SCHEMA_MISMATCH: NQ52_PERSONNEL');
    const last=sh.getLastRow(), rows=last>1?sh.getRange(2,1,last-1,n).getDisplayValues():[];
    const existing=new Map(), ids=new Set(), sourceKeys=new Set(source.people.map(p=>p.username));
    rows.forEach((r,i)=>{
      if(!r.some(Boolean))return;
      const key=String(r[1]).trim().toLowerCase();
      if(!r[0]||!key||existing.has(key)||ids.has(r[0]))throw new Error('Dinh danh danh muc khong hop le tai dong '+(i+2));
      existing.set(key,{id:r[0],row:i+2,name:r[2]});ids.add(r[0]);
    });
    // Ten khac voi username cu co the la tai khoan duoc tai su dung. Dung de xac minh.
    source.people.forEach(p=>{
      const e=existing.get(p.username);
      if(e&&nq52PersonnelNorm_(e.name)!==nq52PersonnelNorm_(p.name))throw new Error('Can xac minh thay doi ten/username tai dong nguon '+p.sourceRow);
    });
    let next=last+1, inserted=0, updated=0, missing=0;
    const at=nqNow_();
    source.people.forEach(p=>{
      const e=existing.get(p.username);
      const record=Object.assign({},p,{id:e?e.id:nqId_(),syncedAt:at,sourceState:'PRESENT'});
      const values=h.map(k=>nqCell_(record[k]));
      sh.getRange(e?e.row:next++,1,1,n).setNumberFormat('@').setValues([values]);
      if(e)updated++;else inserted++;
    });
    existing.forEach((e,key)=>{
      if(!sourceKeys.has(key)){
        sh.getRange(e.row,h.indexOf('sourceState')+1).setValue('MISSING_REVIEW');missing++;
      }
    });
    const result=Object.assign({ok:true,stage:'DIRECTORY_SYNCED',inserted,updated,missingFromSource:missing,
      accountsCreated:0,permissionsGranted:0},stats);
    nqAudit_('ADMIN_EDITOR','PERSONNEL_DIRECTORY_SYNC','NQ52_PERSONNEL',{inserted,updated,missing});
    console.log(JSON.stringify(result,null,2));return result;
  });
}
