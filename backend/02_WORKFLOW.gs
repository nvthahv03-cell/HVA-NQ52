/** HVA-NQ52 | 02_WORKFLOW.gs
 * Workflow scaffold; no official QD32 score engine yet.
 * Mutations run under the router's script lock.
 */
function nqActorTarget_(u,targetId){
  const t=nqUser_(nqText_(targetId,100,true));if(!nqActive_(t))nqError_('TARGET_NOT_ACTIVE');
  return t;
}
function nqCanManageTarget_(u,t){
  if(String(u.id)===String(t.id))return false;
  if(String(t.group)==='CBQL')return false; // authority for CBQL not configured
  return nqHas_(u,'BGH')||(nqHas_(u,'TTCM')&&String(t.group)==='GV'&&String(u.unit)!==''&&String(u.unit)===String(t.unit))||
    (nqHas_(u,'TTVP')&&String(u.group)==='NV'&&String(t.group)==='NV'&&String(u.unit)==='Văn phòng'&&String(t.unit)===String(u.unit));
}
function nqCanReview_(u,r){
  const t=nqUser_(r.userId);
  return !!t&&String(r.unit)===String(t.unit)&&nqCanManageTarget_(u,t);
}
function nqCanDecide_(u,r){
  const t=nqUser_(r.userId);
  return !!t&&String(t.group)!=='CBQL'&&!nqOwned_(u,r)&&nqHas_(u,'DECIDER');
}
function nqCanRead_(u,r){return nqOwned_(u,r)||nqCanReview_(u,r)||nqCanDecide_(u,r);}
function nqDate_(s,month){
  s=nqText_(s,10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.slice(0,7)!==month)nqError_('INVALID_DATE');
  const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)nqError_('INVALID_DATE');return s;
}
function nqListPeople_(u){
  if(!nqHas_(u,'TTCM')&&!nqHas_(u,'BGH')&&!nqHas_(u,'TTVP'))nqError_('FORBIDDEN');
  return nqRows_('NQ52_USERS').filter(t=>nqActive_(t)&&nqCanManageTarget_(u,t)).map(t=>({id:String(t.id),name:String(t.name),unit:String(t.unit),group:String(t.group)}));
}
function nqListRecords_(u,p,table){
  const month=nqMonth_(p.month);return nqRows_(table).filter(r=>String(r.month)===month&&nqCanRead_(u,r)).map(nqPublicRecord_);
}
function nqAssign_(u,p){
  const month=nqMonth_(p.month),t=nqActorTarget_(u,p.userId);if(!nqCanManageTarget_(u,t))nqError_('FORBIDDEN');
  const category=nqText_(p.category,1,true);if(!['A','B','C'].includes(category))nqError_('INVALID_CATEGORY');
  const retro=p.retro===true, current=Utilities.formatDate(new Date(),NQ.TZ,'yyyy-MM');
  if(month<current&&!retro)nqError_('HISTORICAL_TASK_REQUIRES_SOURCE');
  const data={title:nqText_(p.title,300,true),category,deliverable:nqText_(p.deliverable,2000,true),acceptance:nqText_(p.acceptance,2000,true),deadline:nqDate_(p.deadline,month),milestone:nqText_(p.milestone,1000,false),assignedBy:String(u.id),recordedAt:nqNow_(),retro,source:nqText_(p.source,1000,retro)};
  if(nqRows_('NQ52_REPORTS').some(r=>String(r.month)===month&&String(r.userId)===String(t.id)&&r.state!=='DRAFT'))nqError_('REPORT_ALREADY_SUBMITTED');
  if(nqRows_('NQ52_TASKS').some(r=>String(r.month)===month&&String(r.userId)===String(t.id)&&r.state!=='CANCELLED'&&nqJSON_(r.data).title.toLowerCase()===data.title.toLowerCase()))nqError_('DUPLICATE_TASK');
  const r=nqNewRecord_(month,t,data,'ASSIGNED');nqWrite_('NQ52_TASKS',r);nqAudit_(u.id,'TASK_ASSIGNED',r.id,{retro,month,userId:t.id});return nqPublicRecord_(r);
}
function nqAcceptTask_(u,p){
  const r=nqRecord_('NQ52_TASKS',p.id);if(!nqOwned_(u,r))nqError_('FORBIDDEN');nqState_(r,['ASSIGNED']);const d=nqJSON_(r.data);d.acceptedAt=nqNow_();const out=nqUpdateRecord_('NQ52_TASKS',r,d,'ACCEPTED');nqAudit_(u.id,'TASK_ACCEPTED',r.id,{});return out;
}
function nqTaskResult_(u,p){
  const r=nqRecord_('NQ52_TASKS',p.id);if(!nqOwned_(u,r))nqError_('FORBIDDEN');nqState_(r,['ACCEPTED','IN_PROGRESS','RESULT_RECORDED']);
  if(nqRows_('NQ52_REPORTS').some(x=>String(x.userId)===String(u.id)&&String(x.month)===String(r.month)&&x.state!=='DRAFT'))nqError_('REPORT_LOCKED');
  const d=nqJSON_(r.data), status=nqText_(p.resultStatus,30,true);
  if(!['COMPLETED','PARTIAL','NOT_COMPLETED'].includes(status))nqError_('INVALID_RESULT');
  d.result={status,description:nqText_(p.description,4000,true),evidence:nqText_(p.evidence,2000,false),recordedAt:nqNow_()};
  const out=nqUpdateRecord_('NQ52_TASKS',r,d,'RESULT_RECORDED');nqAudit_(u.id,'TASK_RESULT',r.id,{});return out;
}
function nqReportDraft_(u,p){
  const month=nqMonth_(p.month);let r=nqRows_('NQ52_REPORTS').find(x=>String(x.userId)===String(u.id)&&String(x.month)===month);
  if(r)nqState_(r,['DRAFT']);
  const data=r?nqJSON_(r.data):{};
  // Optional versioned M03 draft; separate from all reviewed or official scores.
  if(Object.prototype.hasOwnProperty.call(p,'assessmentDraft'))data.assessmentDraft=nqAssessmentDraft_(u,p.assessmentDraft);
  data.self={strength:nqText_(p.strength,5000,true),weakness:nqText_(p.weakness,5000,true),solution:nqText_(p.solution,5000,true),proposedClass:nqClass_(p.proposedClass,false),updatedAt:nqNow_()};
  data.additionalWork=nqText_(p.additionalWork,10000,false);
  data.sourceNote=nqText_(p.sourceNote,3000,false);
  if(JSON.stringify(data).length>45000)nqError_('REPORT_TOO_LARGE');
  if(!r){r=nqNewRecord_(month,u,data,'DRAFT');nqWrite_('NQ52_REPORTS',r);}else nqUpdateRecord_('NQ52_REPORTS',r,data,'DRAFT');
  nqAudit_(u.id,'REPORT_DRAFT',r.id,{});return nqPublicRecord_(r);
}
function nqClass_(v,required){const s=nqText_(v,25,required);if(s&&!['HTXSNV','HTTNV','HTNV','KHTNV'].includes(s))nqError_('INVALID_CLASS');return s;}
function nqSubmitReport_(u,p){
  const r=nqRecord_('NQ52_REPORTS',p.id);if(!nqOwned_(u,r))nqError_('FORBIDDEN');nqState_(r,['DRAFT']);
  const d=nqJSON_(r.data);if(!d.self||!d.self.strength||!d.self.weakness||!d.self.solution)nqError_('INCOMPLETE_REPORT');
  const tasks=nqRows_('NQ52_TASKS').filter(t=>String(t.userId)===String(u.id)&&String(t.month)===String(r.month)&&t.state!=='CANCELLED');
  if(tasks.some(t=>t.state!=='RESULT_RECORDED'))nqError_('TASK_RESULTS_INCOMPLETE');
  if(!tasks.length&&!d.sourceNote)nqError_('MISSING_TASK_SOURCE');
  d.taskSnapshot=tasks.map(t=>({id:t.id,state:t.state,data:nqJSON_(t.data)}));d.submittedAt=nqNow_();
  if(JSON.stringify(d).length>45000)nqError_('REPORT_TOO_LARGE');
  const out=nqUpdateRecord_('NQ52_REPORTS',r,d,'SUBMITTED');nqAudit_(u.id,'REPORT_SUBMITTED',r.id,{});return out;
}
function nqReview_(u,p){
  const r=nqRecord_('NQ52_REPORTS',p.id);if(!nqCanReview_(u,r))nqError_('FORBIDDEN');nqState_(r,['SUBMITTED','REVIEWED']);
  const d=nqJSON_(r.data);const review={by:String(u.id),at:nqNow_(),comment:nqText_(p.comment,5000,true),proposedClass:nqClass_(p.proposedClass,true),reason:nqText_(p.reason,5000,true)};
  if(d.review)(d.reviewHistory||(d.reviewHistory=[])).push(d.review);d.review=review;
  if(JSON.stringify(d).length>45000)nqError_('REPORT_TOO_LARGE');
  const out=nqUpdateRecord_('NQ52_REPORTS',r,d,'REVIEWED');nqAudit_(u.id,'REPORT_REVIEWED',r.id,{});return out;
}
function nqListMeetings_(u,p){
  if(!nqHas_(u,'BGH')&&!nqHas_(u,'TTCM')&&!nqHas_(u,'DECIDER')&&!nqHas_(u,'TTVP'))nqError_('FORBIDDEN');
  const month=nqMonth_(p.month);
  return nqRows_('NQ52_MEETINGS').filter(r=>String(r.month)===month&&(nqOwned_(u,r)||nqHas_(u,'BGH')||nqHas_(u,'DECIDER')||nqJSON_(r.data).participants.includes(String(u.id)))).map(nqPublicRecord_);
}
function nqCreateMeeting_(u,p){
  if(!nqHas_(u,'BGH'))nqError_('FORBIDDEN');
  const month=nqMonth_(p.month),mode=nqText_(p.mode,15,true);if(!['DIRECT','ONLINE','HYBRID'].includes(mode))nqError_('INVALID_MODE');
  if(!Array.isArray(p.participants)||p.participants.length>150)nqError_('INVALID_PARTICIPANTS');
  const participants=[...new Set(p.participants.map(id=>String(nqActorTarget_(u,id).id)))];
  const data={title:nqText_(p.title,300,true),date:nqDate_(p.date,month),mode,venue:nqText_(p.venue,500,true),agenda:nqText_(p.agenda,8000,true),participants};
  const r=nqNewRecord_(month,u,data,'DRAFT');nqWrite_('NQ52_MEETINGS',r);nqAudit_(u.id,'MEETING_DRAFT',r.id,{});return nqPublicRecord_(r);
}
function nqImportHistory_(u,p){
  if(!nqHas_(u,'HISTORY_ADMIN'))nqError_('FORBIDDEN');
  const t=nqActorTarget_(u,p.userId),month=nqMonth_(p.month);
  const data={source:nqText_(p.source,2000,true),reference:nqText_(p.reference,300,true),classification:nqClass_(p.classification,true),note:nqText_(p.note,4000,false),importedBy:String(u.id),importedAt:nqNow_(),originalUnchanged:true};
  if(nqRows_('NQ52_HISTORY').some(x=>String(x.month)===month&&String(x.userId)===String(t.id)&&nqJSON_(x.data).reference===data.reference))nqError_('DUPLICATE_HISTORY');
  const r=nqNewRecord_(month,t,data,'IMPORTED_UNVERIFIED');nqWrite_('NQ52_HISTORY',r);nqAudit_(u.id,'HISTORY_IMPORTED',r.id,{});return nqPublicRecord_(r);
}
function nqSummary_(u,p){
  if(!nqHas_(u,'BGH')&&!nqHas_(u,'TTCM')&&!nqHas_(u,'DECIDER')&&!nqHas_(u,'TTVP'))nqError_('FORBIDDEN');
  const month=nqMonth_(p.month), people=nqRows_('NQ52_USERS').filter(t=>nqActive_(t)&&(nqCanManageTarget_(u,t)||nqHas_(u,'DECIDER')&&String(t.group)!=='CBQL'&&String(t.id)!==String(u.id)));
  const reports=nqRows_('NQ52_REPORTS').filter(r=>String(r.month)===month), buckets={};
  people.forEach(t=>{const key=String(t.group)+'|'+String(t.unit);const b=buckets[key]||(buckets[key]={group:String(t.group),unit:String(t.unit),active:0,draft:0,submitted:0,reviewed:0,proposed:{HTXSNV:0,HTTNV:0,HTNV:0,KHTNV:0}});b.active++;const r=reports.find(x=>String(x.userId)===String(t.id));if(!r)return;if(r.state==='DRAFT')b.draft++;if(r.state==='SUBMITTED'||r.state==='REVIEWED')b.submitted++;if(r.state==='REVIEWED'){b.reviewed++;const c=nqJSON_(r.data).review?.proposedClass;if(c&&Object.hasOwn(b.proposed,c))b.proposed[c]++;}});
  return {month,groups:Object.values(buckets),officialScoring:false,quotaCheck:false,notes:'Counts of current active users in authorized scope, not final eligibility or official quota.'};
}
