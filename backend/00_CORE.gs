/**
 * HVA-NQ52 | 00_CORE.gs | Apps Script V8
 * Independent store and authentication. No EDOS endpoints.
 * Set Script Properties NQ52_SHEET_ID, NQ52_FIREBASE_KEY before setupNQ52().
 */
const NQ = Object.freeze({
  TZ:'Asia/Ho_Chi_Minh', SESSION_MS:8*60*60*1000,
  TABLES:{
    NQ52_USERS:['id','username','email','firebaseUid','name','unit','group','roles','active','mustChange'],
    NQ52_SESSIONS:['id','userId','expiresAt','revoked'],
    NQ52_TASKS:['id','month','unit','userId','state','data','createdAt','updatedAt'],
    NQ52_REPORTS:['id','month','unit','userId','state','data','createdAt','updatedAt'],
    NQ52_MEETINGS:['id','month','unit','userId','state','data','createdAt','updatedAt'],
    NQ52_HISTORY:['id','month','unit','userId','state','data','createdAt','updatedAt'],
    NQ52_AUDIT:['id','at','actor','action','target','detail']
  }
});
function nqError_(code){throw new Error(code);}
function nqProp_(name){const v=PropertiesService.getScriptProperties().getProperty(name);if(!v)nqError_('CONFIG_REQUIRED');return v;}
function nqBook_(){return SpreadsheetApp.openById(nqProp_('NQ52_SHEET_ID'));}
function setupNQ52(){
  const book=nqBook_();
  Object.keys(NQ.TABLES).forEach(name=>{
    let sh=book.getSheetByName(name);
    if(!sh)sh=book.insertSheet(name);
    if(sh.getLastRow()===0){sh.getRange(1,1,1,NQ.TABLES[name].length).setValues([NQ.TABLES[name]]);sh.setFrozenRows(1);}
    else nqCheckHeader_(sh,name);
  });
  return 'NQ52 schema initialized. Provision users separately.';
}
function nqCheckHeader_(sh,name){
  const expected=NQ.TABLES[name], actual=sh.getRange(1,1,1,expected.length).getDisplayValues()[0];
  if(expected.some((v,i)=>v!==actual[i]))nqError_('SCHEMA_MISMATCH');
}
function nqSheet_(name){if(!NQ.TABLES[name])nqError_('UNKNOWN_TABLE');const sh=nqBook_().getSheetByName(name);if(!sh)nqError_('SETUP_REQUIRED');nqCheckHeader_(sh,name);return sh;}
function nqRows_(name){
  const sh=nqSheet_(name), keys=NQ.TABLES[name], last=sh.getLastRow();if(last<2)return [];
  return sh.getRange(2,1,last-1,keys.length).getValues().map((row,i)=>{
    const obj={_row:i+2};keys.forEach((k,j)=>obj[k]=row[j]);return obj;
  }).filter(x=>x.id!=='');
}
function nqCell_(v){
  if(v===undefined||v===null)return '';
  if(typeof v==='object')v=JSON.stringify(v);
  if(typeof v==='string'&&/^[=+\-@\t\r]/.test(v))return "'"+v;
  return v;
}
function nqWrite_(name,obj){
  const sh=nqSheet_(name),keys=NQ.TABLES[name], row=keys.map(k=>nqCell_(obj[k]));
  const pos=obj._row||sh.getLastRow()+1;const range=sh.getRange(pos,1,1,row.length);range.setNumberFormats([row.map(v=>typeof v==='string'?'@':'General')]);range.setValues([row]);return obj;
}
function nqLock_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))nqError_('BUSY');try{const r=fn();SpreadsheetApp.flush();return r;}finally{lock.releaseLock();}}
function nqNow_(){return new Date().toISOString();}
function nqId_(){return Utilities.getUuid();}
function nqBool_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1';}
function nqText_(v,max,required){if(typeof v!=='string'){if(required)nqError_('INVALID_INPUT');return '';}const s=v.trim();if(s.length>max||required&&!s)nqError_('INVALID_INPUT');return s;}
function nqMonth_(v){const s=nqText_(v,7,true);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(s))nqError_('INVALID_MONTH');return s;}
function nqJSON_(s){try{return JSON.parse(String(s||'{}'));}catch(_){nqError_('CORRUPT_DATA');}}
function nqDigest_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function nqRoles_(u){return String(u.roles||'').split(/[;, ]+/).filter(Boolean);}
function nqHas_(u,role){return nqRoles_(u).includes(role);}
function nqActive_(u){return u&&nqBool_(u.active);}
function nqUser_(id){return nqRows_('NQ52_USERS').find(x=>String(x.id)===String(id));}
function nqPublic_(u){return {id:String(u.id),username:String(u.username),name:String(u.name),unit:String(u.unit),group:String(u.group),roles:nqRoles_(u),mustChange:nqBool_(u.mustChange)};}
function nqAudit_(actor,action,target,detail){nqWrite_('NQ52_AUDIT',{id:nqId_(),at:nqNow_(),actor:String(actor),action,target:String(target||''),detail:JSON.stringify(detail||{})});}
function nqFirebase_(operation,payload){
  const url='https://identitytoolkit.googleapis.com/v1/accounts:'+operation+'?key='+encodeURIComponent(nqProp_('NQ52_FIREBASE_KEY'));
  const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(res.getResponseCode()!==200)nqError_(operation==='signInWithPassword'?'INVALID_CREDENTIALS':'PASSWORD_CHANGE_FAILED');
  return JSON.parse(res.getContentText());
}
function nqFindSession_(token){
  if(typeof token!=='string'||token.length!==72)nqError_('AUTH_REQUIRED');
  const s=nqRows_('NQ52_SESSIONS').find(x=>x.id===nqDigest_(token));
  if(!s||nqBool_(s.revoked)||Number(s.expiresAt)<=Date.now())nqError_('AUTH_REQUIRED');
  return s;
}
function nqAuth_(token,allowChange){
  const s=nqFindSession_(token),u=nqUser_(s.userId);
  if(!nqActive_(u))nqError_('AUTH_REQUIRED');
  if(!allowChange&&nqBool_(u.mustChange))nqError_('PASSWORD_CHANGE_REQUIRED');
  return u;
}
function nqLogin_(p){
  const username=nqText_(p.username,100,true).toLowerCase(),password=nqTextRawPassword_(p.password);
  const matches=nqRows_('NQ52_USERS').filter(x=>String(x.username).trim().toLowerCase()===username);
  const u=matches.length===1?matches[0]:null;
  if(!nqActive_(u)||!u.firebaseUid||!u.email)nqError_('INVALID_CREDENTIALS');
  const f=nqFirebase_('signInWithPassword',{email:String(u.email),password,returnSecureToken:true});
  if(String(f.localId)!==String(u.firebaseUid))nqError_('INVALID_CREDENTIALS');
  return nqLock_(()=>{const fresh=nqUser_(u.id);if(!nqActive_(fresh)||String(fresh.firebaseUid)!==String(f.localId)||String(fresh.email)!==String(u.email))nqError_('INVALID_CREDENTIALS');
    const token=nqId_()+nqId_();nqWrite_('NQ52_SESSIONS',{id:nqDigest_(token),userId:fresh.id,expiresAt:Date.now()+NQ.SESSION_MS,revoked:false});nqAudit_(fresh.id,'LOGIN',fresh.id,{});return {token,user:nqPublic_(fresh)};
  });
}
function nqTextRawPassword_(v){if(typeof v!=='string'||!v.length||v.length>256)nqError_('INVALID_CREDENTIALS');return v;}
function nqRevokeAll_(id){nqRows_('NQ52_SESSIONS').filter(s=>String(s.userId)===String(id)&&!nqBool_(s.revoked)).forEach(s=>{s.revoked=true;nqWrite_('NQ52_SESSIONS',s);});}
function nqChangePassword_(p){
  const old=nqTextRawPassword_(p.oldPassword), next=nqTextRawPassword_(p.newPassword);
  if(next.length<12||next===old)nqError_('PASSWORD_POLICY');
  return nqLock_(()=>{
    const u=nqAuth_(p.token,true),f=nqFirebase_('signInWithPassword',{email:String(u.email),password:old,returnSecureToken:true});
    if(String(f.localId)!==String(u.firebaseUid))nqError_('INVALID_CREDENTIALS');
    nqFirebase_('update',{idToken:f.idToken,password:next,returnSecureToken:true});
    nqRevokeAll_(u.id);u.mustChange=false;nqWrite_('NQ52_USERS',u);nqAudit_(u.id,'PASSWORD_CHANGED',u.id,{});
    return {loginAgain:true};
  });
}
function nqLogout_(p){return nqLock_(()=>{const s=nqFindSession_(p.token);s.revoked=true;nqWrite_('NQ52_SESSIONS',s);return {loggedOut:true};});}
function nqPublicRecord_(r){const o={...r,data:nqJSON_(r.data)};delete o._row;return o;}
function nqOwned_(u,r){return String(r.userId)===String(u.id);}
function nqRecord_(table,id){const r=nqRows_(table).find(x=>String(x.id)===String(id));if(!r)nqError_('NOT_FOUND');return r;}
function nqState_(r,allowed){if(!allowed.includes(String(r.state)))nqError_('INVALID_STATE');}
function nqNewRecord_(month,u,data,state){const at=nqNow_();return {id:nqId_(),month,unit:u.unit,userId:u.id,state,data:JSON.stringify(data),createdAt:at,updatedAt:at};}
function nqUpdateRecord_(table,r,data,state){r.data=JSON.stringify(data);r.state=state;r.updatedAt=nqNow_();nqWrite_(table,r);return nqPublicRecord_(r);}
