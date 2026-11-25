/**
 * HVA-NQ52 | 05_TAI_KHOAN.gs
 * Admin editor only. Never register these functions in doPost.
 * Stage 1: prepare roster from directory, no credentials or permissions.
 * Stage 2: explicitly provision one approved account (pilot) in NQ52 Firebase.
 * Stage 3: send password setup link separately, by authorized admin.
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
// Password format is NQ52@ + random UUID-derived suffix, never a staff ID.
// UUID is used for an undisclosed bootstrap secret; users set their password via Firebase reset link.
function nq52BootstrapPassword_(){
  return 'NQ52@'+Utilities.getUuid().replace(/-/g,'')+'aA7';
}
function nq52PilotAccount_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('NQ52_PILOT_APPROVED')!=='TRUE')throw new Error('PILOT_APPROVAL_REQUIRED');
  const username=String(props.getProperty('NQ52_PILOT_USERNAME')||'').trim().toLowerCase();
  const email=String(props.getProperty('NQ52_PILOT_EMAIL')||'').trim().toLowerCase();
  if(!username||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('PILOT_USERNAME_AND_CONFIRMED_EMAIL_REQUIRED');
  const project=String(nqProp_('NQ52_FIREBASE_PROJECT_ID')).trim();
  if(!/^[a-z][a-z0-9-]{4,29}$/.test(project))throw new Error('INVALID_FIREBASE_PROJECT');
  nqProp_('NQ52_FIREBASE_KEY');
  const people=nq52AccountDirectory_(), p=people.find(x=>String(x.username).trim().toLowerCase()===username);
  if(!p||!nq52AccountEligible_(p))throw new Error('PILOT_NOT_ELIGIBLE');
  const users=nqRows_('NQ52_USERS'), matches=users.filter(u=>String(u.username).trim().toLowerCase()===username);
  if(matches.length!==1||String(matches[0].id)!==String(p.id))throw new Error('PILOT_ACCOUNT_NOT_PREPARED');
  const u=matches[0];
  if(users.some(x=>String(x.id)!==String(u.id)&&String(x.email).trim().toLowerCase()===email))throw new Error('EMAIL_ALREADY_ASSIGNED');
  if(u.email&&String(u.email).trim().toLowerCase()!==email)throw new Error('EMAIL_CHANGE_REQUIRES_REVIEW');
  if(nqRoles_(u).length)throw new Error('PILOT_MUST_HAVE_NO_PRIVILEGED_ROLES');
  return {props,project,email,u};
}
/** Editor only, one approved pilot. Requires OAuth identitytoolkit/cloud-platform scope and IAM. */
function provisionNQ52PilotAccount(){
  return nqLock_(function(){
    const x=nq52PilotAccount_(),u=x.u;
    if(u.firebaseUid||nqActive_(u))throw new Error('ACCOUNT_ALREADY_PROVISIONED_OR_REQUIRES_REVIEW');
    // Reserve email locally; leave inactive if remote call fails.
    u.email=x.email;u.active=false;u.mustChange=true;nqWrite_('NQ52_USERS',u);SpreadsheetApp.flush();
    const url='https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(x.project)+'/accounts';
    const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
      payload:JSON.stringify({localId:String(u.id),email:x.email,password:nq52BootstrapPassword_(),emailVerified:false,disabled:false}),
      muteHttpExceptions:true});
    if(response.getResponseCode()!==200){
      // Never echo response body. On uncertainty inspect Firebase console; do not overwrite accounts.
      throw new Error('FIREBASE_CREATE_FAILED_HTTP_'+response.getResponseCode()+'_REVIEW_CONSOLE');
    }
    const remote=JSON.parse(response.getContentText());
    if(String(remote.localId)!==String(u.id))throw new Error('FIREBASE_UID_MISMATCH_REVIEW_CONSOLE');
    u.firebaseUid=String(remote.localId);
    // Keep application access inactive until administrator confirms the pilot setup.
    nqWrite_('NQ52_USERS',u);nqAudit_('ADMIN_EDITOR','PILOT_FIREBASE_CREATED',u.id,{});
    const result={ok:true,stage:'PILOT_CREATED_INACTIVE',passwordsStored:0,emailsSent:0,productionReady:false};
    console.log(JSON.stringify(result));return result;
  });
}
/** Sends only one reset link, to the explicitly approved pilot email. */
function sendNQ52PilotSetupLink(){
  return nqLock_(function(){
    const x=nq52PilotAccount_(),u=x.u;
    if(!u.firebaseUid||String(u.firebaseUid)!==String(u.id)||String(u.email)!==x.email)throw new Error('PILOT_NOT_PROVISIONED');
    if(nqActive_(u))throw new Error('PILOT_ALREADY_ACTIVE');
    const url='https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(nqProp_('NQ52_FIREBASE_KEY'));
    const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
      payload:JSON.stringify({requestType:'PASSWORD_RESET',email:x.email}),muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw new Error('SETUP_LINK_FAILED_HTTP_'+response.getResponseCode());
    // Only authorize after link request accepted; the Firebase password is never stored.
    u.active=true;u.mustChange=true;nqWrite_('NQ52_USERS',u);
    nqAudit_('ADMIN_EDITOR','PILOT_SETUP_LINK_REQUESTED',u.id,{});
    x.props.deleteProperty('NQ52_PILOT_APPROVED');
    const result={ok:true,stage:'PILOT_LINK_REQUEST_ACCEPTED',accountsActivated:1,passwordsStored:0,productionReady:false};
    console.log(JSON.stringify(result));return result;
  });
}
