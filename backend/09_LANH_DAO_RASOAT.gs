/** QD32 M02/M5A draft and review rehearsal. No official classification. */
const NQ52_LEADERSHIP_VERSION='LEADERSHIP-DRAFT-1';
const NQ52_LEADERSHIP_A=Object.freeze({"I.1.a":0.75,"I.1.b":0.5,"I.1.c":0.5,"I.1.d":0.75,"I.1.đ":0.75,"I.1.e":0.75,"I.1.ê":0.5,"I.1.g":0.5,"I.2.a":1,"I.2.b":1,"I.2.c":1,"I.2.d":2,"II.1.a":0.5,"II.1.b":0.5,"II.1.c":0.5,"II.1.d":0.5,"II.1.đ":0.5,"II.2.a":1.5,"II.2.b":1,"II.3.a":1.5,"II.3.b":1,"II.4.a":1.5,"II.4.b":1,"III.1":2.5,"III.2":2.5,"III.3":2.5,"III.4":2.5});
function nqFormProfile_(u){
 const raw=PropertiesService.getScriptProperties().getProperty('NQ52_FORM_PROFILE')||'{}';let map;try{map=JSON.parse(raw);}catch(_){nqError_('CONFIG_REQUIRED');}
 if(!map||typeof map!=='object'||Array.isArray(map))nqError_('CONFIG_REQUIRED');
 const key=String(u.id),explicit=Object.prototype.hasOwnProperty.call(map,key),form=explicit?map[key]:String(u.group)==='CBQL'&&nqHas_(u,'BGH')?'M5A':['GV','NV'].includes(String(u.group))?'M03':'UNCONFIGURED';
 if(!['M03','M02','M5A','UNCONFIGURED'].includes(form))nqError_('CONFIG_REQUIRED');
 if(String(u.group)==='CBQL'&&form!=='M5A'&&form!=='UNCONFIGURED')nqError_('CONFIG_REQUIRED');
 if(form==='M5A'&&!(String(u.group)==='CBQL'&&nqHas_(u,'BGH')))nqError_('CONFIG_REQUIRED');
 return {form,explicit,official:false};
}
function nqLeadershipDraft_(u,p){
 const profile=nqFormProfile_(u),form=profile.form,d=p.leadershipDraft;
 if(!['M02','M5A'].includes(form))nqError_('FORBIDDEN');
 if(!d||d.form!==form||d.version!==NQ52_LEADERSHIP_VERSION||!Array.isArray(d.items)||d.items.length!==27)nqError_('INVALID_INPUT');
 const seen=new Set(),items=d.items.map(x=>{if(!x||typeof x.id!=='string'||!Object.prototype.hasOwnProperty.call(NQ52_LEADERSHIP_A,x.id)||seen.has(x.id))nqError_('INVALID_INPUT');seen.add(x.id);const score=x.score;if(score!==null&&(typeof score!=='number'||!Number.isFinite(score)||score<0||score>NQ52_LEADERSHIP_A[x.id]||Math.abs(score*100-Math.round(score*100))>1e-7))nqError_('INVALID_INPUT');return {id:x.id,score,reason:nqText_(x.reason,500,false)};});
 const keys=['unitOutcome','implementation','cohesion'],basis={};for(const k of keys){const x=d.basis&&d.basis[k];if(!x||![null,50,100].includes(x.rate))nqError_('INVALID_INPUT');basis[k]={rate:x.rate,evidence:nqText_(x.evidence,2000,x.rate!==null)};}
 const complete=items.every(x=>x.score!==null);
 const month=nqMonth_(p.month);let r=nqRows_('NQ52_REPORTS').find(x=>String(x.userId)===String(u.id)&&String(x.month)===month);if(r)nqState_(r,['DRAFT']);const data=r?nqJSON_(r.data):{};
 data.leadershipDraft={version:NQ52_LEADERSHIP_VERSION,form,items,complete,selfA:complete?Math.round(items.reduce((a,x)=>a+x.score,0)*100)/100:null,basis,taskNarrative:nqText_(d.taskNarrative,8000,false),partyRole:nqText_(d.partyRole,300,false),unionRole:nqText_(d.unionRole,300,false),position:nqText_(d.position,300,false),birthDate:nqText_(d.birthDate,10,false),official:false,updatedAt:nqNow_()};
 if(data.leadershipDraft.birthDate&&!/^\d{4}-\d{2}-\d{2}$/.test(data.leadershipDraft.birthDate))nqError_('INVALID_DATE');
 data.self={strength:nqText_(p.strength,5000,false),weakness:nqText_(p.weakness,5000,false),solution:nqText_(p.solution,5000,false),proposedClass:nqClass_(p.proposedClass,false),updatedAt:nqNow_()};
 if(JSON.stringify(data).length>45000)nqError_('REPORT_TOO_LARGE');
 if(!r){r=nqNewRecord_(month,u,data,'DRAFT');nqWrite_('NQ52_REPORTS',r);}else nqUpdateRecord_('NQ52_REPORTS',r,data,'DRAFT');nqAudit_(u.id,'LEADERSHIP_DRAFT',r.id,{form});return nqPublicRecord_(r);
}
function nqReviewFingerprint_(r,d){
 const tasks=nqRows_('NQ52_TASKS').filter(t=>String(t.userId)===String(r.userId)&&String(t.month)===String(r.month)&&t.state!=='CANCELLED').map(t=>[String(t.id),t.state,String(t.data)]).sort((a,b)=>a[0].localeCompare(b[0]));
 return nqDigest_(JSON.stringify([d.self||null,d.monthlyDraft||null,d.assessmentDraft||null,d.leadershipDraft||null,d.additionalWork||'',d.sourceNote||'',tasks]));
}
function nqPilotReview_(u,p){
 if(PropertiesService.getScriptProperties().getProperty('NQ52_REVIEW_REHEARSAL')!=='ON')nqError_('CONFIG_REQUIRED');
 const r=nqRecord_('NQ52_REPORTS',p.id);nqState_(r,['DRAFT']);if(String(r.month)!==nqMonth_(p.month))nqError_('INVALID_STATE');
 const d=nqJSON_(r.data),step=nqText_(p.step,30,true),prior=d.pilotReview||{},fingerprint=nqReviewFingerprint_(r,d),target=nqUser_(r.userId);
 if(!target||!nqActive_(target)||String(target.group)==='CBQL')nqError_('FORBIDDEN'); // CBQL requires separate authority mapping.
 let next;
 if(step==='REQUEST'){
  if(!nqOwned_(u,r))nqError_('FORBIDDEN');
  if(prior.fingerprint===fingerprint&&['REQUESTED','REVIEWED','COLLECTIVE_NOTED','DECISION_DRAFT'].includes(prior.state))nqError_('INVALID_STATE');
  const form=nqFormProfile_(u).form,a=form==='M02'?d.leadershipDraft:d.assessmentDraft;
  if(!['M02','M03'].includes(form)||!a||!a.complete||(form==='M02'&&a.form!=='M02')||!d.monthlyDraft?.items?.length||d.monthlyDraft.confirmTruth!==true||!d.self?.strength||!d.self?.weakness||!d.self?.solution||!d.self?.proposedClass)nqError_('INCOMPLETE_REPORT');
  next={state:'REQUESTED',fingerprint,form,requestedAt:nqNow_(),official:false};
 }else{
  if(prior.fingerprint!==fingerprint)nqError_('INVALID_STATE');
  if(step==='RETURN'||step==='REVIEW'){
   if(!nqCanReview_(u,r))nqError_('FORBIDDEN');if(prior.state!=='REQUESTED')nqError_('INVALID_STATE');
   next={...prior,state:step==='RETURN'?'RETURNED':'REVIEWED',review:{by:String(u.id),at:nqNow_(),comment:nqText_(p.comment,4000,true),proposedClass:step==='REVIEW'?nqClass_(p.proposedClass,true):'',official:false}};
  }else if(step==='COLLECTIVE'){
   if(!nqHas_(u,'BGH')||!nqCanReview_(u,r))nqError_('FORBIDDEN');if(prior.state!=='REVIEWED')nqError_('INVALID_STATE');
   const meeting=nqRecord_('NQ52_MEETINGS',p.meetingId);if(String(meeting.month)!==String(r.month))nqError_('INVALID_STATE');
   next={...prior,state:'COLLECTIVE_NOTED',collective:{by:String(u.id),at:nqNow_(),meetingId:String(meeting.id),reference:nqText_(p.reference,500,true),comment:nqText_(p.comment,4000,true),proposedClass:nqClass_(p.proposedClass,true),official:false}};
  }else if(step==='DECISION_DRAFT'){
   if(!nqCanDecide_(u,r))nqError_('FORBIDDEN');if(prior.state!=='COLLECTIVE_NOTED')nqError_('INVALID_STATE');
   next={...prior,state:'DECISION_DRAFT',decision:{by:String(u.id),at:nqNow_(),comment:nqText_(p.comment,4000,true),proposedClass:nqClass_(p.proposedClass,true),official:false}};
  }else nqError_('INVALID_INPUT');
 }
 d.pilotReview=next;if(JSON.stringify(d).length>45000)nqError_('REPORT_TOO_LARGE');nqUpdateRecord_('NQ52_REPORTS',r,d,'DRAFT');nqAudit_(u.id,'PILOT_REVIEW_'+step,r.id,{official:false});return nqPublicRecord_(r);
}
function nqPilotReviewInfo_(u,p){
 const enabled=PropertiesService.getScriptProperties().getProperty('NQ52_REVIEW_REHEARSAL')==='ON',month=nqMonth_(p.month);
 const policy=nqHas_(u,'BGH')?nqSchoolPolicyStatus_():null;
 if(!enabled)return {enabled:false,items:[],policy};const items=nqRows_('NQ52_REPORTS').filter(r=>String(r.month)===month&&r.state==='DRAFT'&&nqCanRead_(u,r)).map(r=>{const d=nqJSON_(r.data),pr=d.pilotReview,t=nqUser_(r.userId),own=nqOwned_(u,r);if(!t||!nqActive_(t)||String(t.group)==='CBQL'||(!own&&!pr))return null;const fresh=!!pr&&pr.fingerprint===nqReviewFingerprint_(r,d);return {id:String(r.id),name:String(t.name),unit:String(t.unit),own,state:pr?(fresh?pr.state:'STALE'):'NOT_REQUESTED',canReview:!own&&nqCanReview_(u,r),canCollective:!own&&nqHas_(u,'BGH')&&nqCanReview_(u,r),canDecide:!own&&nqCanDecide_(u,r),review:pr?.review||null,collective:pr?.collective||null,decision:pr?.decision||null};}).filter(Boolean);
 return {enabled:true,items,policy};
}

/** Status of private school configuration; presence is not verification/approval. */
function nqSchoolPolicyStatus_(){
 const raw=PropertiesService.getScriptProperties().getProperty('NQ52_SCHOOL_POLICY')||'{}';let p;try{p=JSON.parse(raw);}catch(_){return {invalid:true,checks:[]};}
 if(!p||typeof p!=='object'||Array.isArray(p))return {invalid:true,checks:[]};
 const fields=[['regulationReference','Quy chế nhà trường và số văn bản'],['effectiveDate','Ngày hiệu lực'],['productCatalogueReference','Danh mục công việc, sản phẩm và quy đổi'],['eligibilityReference','Danh sách đối tượng, chức vụ và ngoại lệ'],['authorityReference','Thẩm quyền quản lý, xét duyệt và quyết định'],['assessmentCalendarReference','Lịch thực hiện, biên bản và hạn báo cáo'],['similarGroupsReference','Danh sách nhóm nhiệm vụ tương đồng']];
 const checks=fields.map(([key,label])=>({key,label,provided:typeof p[key]==='string'&&!!p[key].trim()&&(key!=='effectiveDate'||/^\d{4}-\d{2}-\d{2}$/.test(p[key]))}));
 return {checks,invalid:false,verified:false,officialEnabled:false};
}
function nqQuotaReference_(excellent,good){
 if(!Number.isInteger(excellent)||!Number.isInteger(good)||excellent<0||good<0)nqError_('INVALID_INPUT');
 return {excellent,good,ordinaryCap:Math.floor(good/5),withinOrdinaryCap:excellent*5<=good,requiresSeparateManagerExceptionCheck:true,official:false};
}
