/** HVA-NQ52 | 01_ROUTER.gs
 * JSON POST only for private operations. Never pass tokens or passwords in URLs.
 * Apps Script Web App, execute as owner. No EDOS dependency.
 */
function nqOut_(ok,data,code){
  return ContentService.createTextOutput(JSON.stringify(ok?{ok:true,data}:{ok:false,code})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(){
  return nqOut_(true,{service:'HVA-NQ52',version:'0.2.0',stage:'DEVELOPMENT',assessmentDraftVersion:typeof NQ52_QD32_DRAFT_VERSION==='undefined'?null:NQ52_QD32_DRAFT_VERSION,monthlyDraftVersion:typeof NQ52_MONTHLY_DRAFT_VERSION==='undefined'?null:NQ52_MONTHLY_DRAFT_VERSION,leadershipVersion:typeof NQ52_LEADERSHIP_VERSION==='undefined'?null:NQ52_LEADERSHIP_VERSION,authMode:PropertiesService.getScriptProperties().getProperty('NQ52_AUTH_MODE')==='LOCAL_PILOT'?'LOCAL_PILOT':'LOCKED'});
}
function nqThrottleLogin_(p){
  const name=typeof p.username==='string'?p.username.trim().toLowerCase().slice(0,100):'';
  if(!name)nqError_('INVALID_CREDENTIALS');
  // Best-effort pilot throttle, per account plus global. Not production abuse protection.
  const key='nq52login:'+nqDigest_(name);
  // Cache-only operation: retain script lock but avoid unnecessary spreadsheet flush.
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))nqError_('BUSY');
  try{const cache=CacheService.getScriptCache(), n=Number(cache.get(key)||0);const global=Number(cache.get('nq52login:global')||0);if(n>=5||global>=30)nqError_('TRY_LATER');cache.put(key,String(n+1),300);cache.put('nq52login:global',String(global+1),300);}finally{lock.releaseLock();}
}
function doPost(e){
  try{
    const raw=e&&e.postData&&e.postData.contents;
    if(typeof raw!=='string'||raw.length>65000)nqError_('INVALID_REQUEST');
    let p;try{p=JSON.parse(raw);}catch(_){nqError_('INVALID_REQUEST');}
    if(!p||typeof p!=='object'||Array.isArray(p))nqError_('INVALID_REQUEST');
    const action=nqText_(p.action,50,true);
    if(action==='login'){nqThrottleLogin_(p);return nqOut_(true,nqLogin_(p));}
    if(action==='changePassword'){nqThrottleLogin_({username:'password:'+nqDigest_(String(p.token||''))});return nqOut_(true,nqChangePassword_(p));}
    if(action==='logout')return nqOut_(true,nqLogout_(p));
    return nqOut_(true,nqLock_(()=>{
      const u=nqAuth_(p.token,false);
      switch(action){
        case 'me':return nqPublic_(u);
        case 'assessmentProfile':if(typeof nqFormProfile_!=='function')nqError_('CONFIG_REQUIRED');return nqFormProfile_(u);
        case 'saveLeadershipDraft':if(typeof nqLeadershipDraft_!=='function')nqError_('CONFIG_REQUIRED');return nqLeadershipDraft_(u,p);
        case 'pilotReviewInfo':if(typeof nqPilotReviewInfo_!=='function')nqError_('CONFIG_REQUIRED');return nqPilotReviewInfo_(u,p);
        case 'pilotReview':if(typeof nqPilotReview_!=='function')nqError_('CONFIG_REQUIRED');return nqPilotReview_(u,p);
        case 'listPeople':return nqListPeople_(u);
        case 'listTasks':return nqListRecords_(u,p,'NQ52_TASKS');
        case 'assignTask':return nqAssign_(u,p);
        case 'acceptTask':return nqAcceptTask_(u,p);
        case 'saveTaskResult':return nqTaskResult_(u,p);
        case 'listReports':return nqListRecords_(u,p,'NQ52_REPORTS');
        case 'saveReportDraft':return nqReportDraft_(u,p);
        case 'saveMonthlyReportDraft':if(typeof nqSaveMonthlyDraft_!=='function')nqError_('CONFIG_REQUIRED');return nqSaveMonthlyDraft_(u,p);
        case 'submitReport':nqError_('OFFICIAL_SUBMISSION_LOCKED');
        case 'reviewReport':return nqReview_(u,p);
        case 'listMeetings':return nqListMeetings_(u,p);
        case 'createMeetingDraft':return nqCreateMeeting_(u,p);
        case 'listHistory':return nqListRecords_(u,p,'NQ52_HISTORY');
        case 'importHistory':return nqImportHistory_(u,p);
        case 'getMonthlySummary':return nqSummary_(u,p);
        default:nqError_('UNKNOWN_ACTION');
      }
    }));
  }catch(err){
    // No request body, credentials, tokens, or stack trace in client responses/logs.
    const code=String(err&&err.message||'');
    const allowed=['INVALID_REQUEST','INVALID_INPUT','INVALID_CREDENTIALS','AUTH_REQUIRED','PASSWORD_CHANGE_REQUIRED','PASSWORD_POLICY','PASSWORD_CHANGE_FAILED','TRY_LATER','BUSY','CONFIG_REQUIRED','SCHEMA_MISMATCH','SETUP_REQUIRED','FORBIDDEN','NOT_FOUND','INVALID_MONTH','INVALID_DATE','INVALID_STATE','INVALID_CATEGORY','INVALID_RESULT','INVALID_CLASS','INVALID_MODE','INVALID_PARTICIPANTS','TARGET_NOT_ACTIVE','HISTORICAL_TASK_REQUIRES_SOURCE','REPORT_ALREADY_SUBMITTED','DUPLICATE_TASK','REPORT_LOCKED','INCOMPLETE_REPORT','TASK_RESULTS_INCOMPLETE','MISSING_TASK_SOURCE','REPORT_TOO_LARGE','DUPLICATE_HISTORY','OFFICIAL_SUBMISSION_LOCKED','UNKNOWN_ACTION'];
    return nqOut_(false,null,allowed.includes(code)?code:'SERVER_ERROR');
  }
}
