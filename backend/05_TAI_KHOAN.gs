/**
 * HVA-NQ52 | 05_TAI_KHOAN.gs
 * Admin editor only. Never register these functions in doPost.
 * Stage 1: prepare roster from directory, no credentials or permissions.
 * Stage 2: explicitly provision one ordinary pilot with local credentials. No Firebase.
 */
function nq52AccountDirectory_(){
  const book=nqBook_();
  nq52CheckDatabaseName_(book);
  const root=nq52ProjectRoot_(PropertiesService.getScriptProperties());
  const folders=root.getFoldersByName('01_CO_SO_DU_LIEU');
  if(!folders.hasNext())throw new Error('DATABASE_FOLDER_MISSING');
  const folder=folders.next();
  if(folders.hasNext())throw new Error('DATABASE_FOLDER_DUPLICATE');
  nq52Restricted_(folder,'01_CO_SO_DU_LIEU');
  const file=DriveApp.getFileById(book.getId());
  nq52Restricted_(file,'DATABASE');
  if(!nq52HasParent_(file,folder.getId()))throw new Error('DATABASE_OUTSIDE_PROJECT');
  const sh=book.getSheetByName('NQ52_PERSONNEL');
  if(!sh||sh.getLastRow()<2)throw new Error('PERSONNEL_SYNC_REQUIRED');
  const h=NQ52_DIRECTORY_HEADERS;
  const head=sh.getRange(1,1,1,h.length).getDisplayValues()[0];
  if(h.some((k,i)=>head[i]!==k))throw new Error('PERSONNEL_SCHEMA_MISMATCH');
  const people=sh.getRange(2,1,sh.getLastRow()-1,h.length).getDisplayValues()
    .filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));
  const ids=new Set(),names=new Set();
  people.forEach(p=>{
    const id=String(p.id).trim(),username=String(p.username).trim().toLowerCase();
    if(!id||!username||ids.has(id)||names.has(username))throw new Error('PERSONNEL_DUPLICATE_OR_MISSING_ID');
    ids.add(id);names.add(username);
  });
  return people;
}
function nq52AccountEligible_(p){
  return p.sourceState==='PRESENT'&&nq52EmploymentCode_(p.employmentStatus)==='WORKING'&&
    ['CBQL','GV','NV'].includes(p.group)&&!!p.name&&!!p.unitKey&&!!p.unit;
}
function nq52AccountPlan_(){
  const people=nq52AccountDirectory_(),users=nqRows_('NQ52_USERS');
  const byId=new Map(),byName=new Map();
  users.forEach(u=>{
    const id=String(u.id),name=String(u.username).trim().toLowerCase();
    if(!id||!name||byId.has(id)||byName.has(name))throw new Error('USERS_DUPLICATE_OR_MISSING_ID');
    byId.set(id,u);byName.set(name,u);
  });
  const pending=[], skipped=[];
  let existing=0;
  people.forEach(p=>{
    const id=String(p.id),name=String(p.username).trim().toLowerCase();
    const u=byId.get(id), v=byName.get(name);
    if((u&&String(u.username).trim().toLowerCase()!==name)||(v&&String(v.id)!==id))
      throw new Error('ACCOUNT_IDENTITY_CONFLICT_SOURCE_ROW_'+p.sourceRow);
    if(!nq52AccountEligible_(p)){skipped.push({sourceRow:p.sourceRow,status:p.employmentStatus});return;}
    if(u){existing++;return;}
    pending.push({id,username:name,email:'',firebaseUid:'',name:p.name,unit:p.unit,
      group:p.group,roles:'',active:false,mustChange:true});
  });
  return {pending,existing,skipped,total:people.length};
}
function previewNQ52Accounts(){
  const plan=nq52AccountPlan_();
  const result={ok:true,stage:'ACCOUNT_PREVIEW',directoryTotal:plan.total,toPrepare:plan.pending.length,
    existing:plan.existing,skipped:plan.skipped,groupCounts:{CBQL:0,GV:0,NV:0},
    accountsActivated:0,permissionsGranted:0};
  plan.pending.forEach(u=>result.groupCounts[u.group]++);
  console.log(JSON.stringify(result,null,2));return result;
}
function createNQ52Accounts(){
  return nqLock_(function(){
    const plan=nq52AccountPlan_(),sh=nqSheet_('NQ52_USERS'),keys=NQ.TABLES.NQ52_USERS;
    if(plan.pending.length){
      const range=sh.getRange(sh.getLastRow()+1,1,plan.pending.length,keys.length);
      range.setNumberFormats(plan.pending.map(u=>keys.map(k=>typeof u[k]==='string'?'@':'General')));
      range.setValues(plan.pending.map(u=>keys.map(k=>nqCell_(u[k]))));
    }
    nqAudit_('ADMIN_EDITOR','ACCOUNT_ROSTER_PREPARED','NQ52_USERS',{inserted:plan.pending.length,existing:plan.existing});
    const result={ok:true,stage:'ACCOUNT_ROSTER_PREPARED',inserted:plan.pending.length,existing:plan.existing,
      skipped:plan.skipped,accountsActivated:0,permissionsGranted:0,passwordsStored:0,productionReady:false};
    console.log(JSON.stringify(result,null,2));return result;
  });
}
/** Editor only: set NQ52_PILOT_USERNAME and NQ52_PILOT_PASSWORD privately, then run.
 * Consumes password property; no password or hash in log. One active pilot only.
 */
function provisionNQ52PilotAccount(){
  return nqLock_(function(){
    const props=PropertiesService.getScriptProperties();
    const username=String(props.getProperty('NQ52_PILOT_USERNAME')||'').trim().toLowerCase();
    const password=props.getProperty('NQ52_PILOT_PASSWORD')||'';
    if(!username||!nqPwdPolicy_(password))throw new Error('PILOT_USERNAME_AND_STRONG_PASSWORD_REQUIRED');
    const people=nq52AccountDirectory_(),p=people.find(x=>String(x.username).trim().toLowerCase()===username);
    if(!p||!nq52AccountEligible_(p))throw new Error('PILOT_NOT_ELIGIBLE');
    const users=nqRows_('NQ52_USERS'),matches=users.filter(u=>String(u.username).trim().toLowerCase()===username);
    if(matches.length!==1||String(matches[0].id)!==String(p.id))throw new Error('PILOT_ACCOUNT_NOT_PREPARED');
    const u=matches[0];
    if(nqRoles_(u).length)throw new Error('PILOT_MUST_HAVE_NO_PRIVILEGED_ROLES');
    if(users.some(nqActive_)||u.firebaseUid)throw new Error('EXISTING_ACTIVE_ACCOUNT_REVIEW');
    const book=nqBook_();let sh=book.getSheetByName('NQ52_CREDENTIALS');
    if(!sh){sh=book.insertSheet('NQ52_CREDENTIALS');sh.getRange(1,1,1,NQ.TABLES.NQ52_CREDENTIALS.length).setValues([NQ.TABLES.NQ52_CREDENTIALS]);sh.setFrozenRows(1);}
    nqCheckHeader_(sh,'NQ52_CREDENTIALS');
    if(nqRows_('NQ52_CREDENTIALS').length)throw new Error('EXISTING_CREDENTIALS_REVIEW');
    if(!props.getProperty('NQ52_AUTH_PEPPER'))props.setProperty('NQ52_AUTH_PEPPER',nqId_()+nqId_());
    // Remove temporary plaintext before persisting; never print it.
    props.deleteProperty('NQ52_PILOT_PASSWORD');
    const start=Date.now(),cred=nqPwdNew_(u.id,password,null);
    nqWrite_('NQ52_CREDENTIALS',cred);nqRevokeAll_(u.id);u.mustChange=true;u.active=true;nqWrite_('NQ52_USERS',u);
    nqAudit_('ADMIN_EDITOR','LOCAL_PILOT_PROVISIONED',u.id,{});
    SpreadsheetApp.flush();props.setProperty('NQ52_AUTH_MODE','LOCAL_PILOT');
    const result={ok:true,stage:'LOCAL_PILOT_READY',accountsActivated:1,hashAndWriteMs:Date.now()-start,plaintextStored:false,productionReady:false};
    console.log(JSON.stringify(result));return result;
  });
}
