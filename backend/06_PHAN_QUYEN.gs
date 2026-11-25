/**
 * HVA-NQ52 | 06_PHAN_QUYEN.gs | 0.1
 * Read-only proposal. No permission grants or account activation.
 * Keep source software role independent of position and approved NQ52 roles.
 * Editor only; do not expose via Router.
 */
function nq52RoleCandidate_(p){
  const position=nq52PersonnelNorm_(p.position);
  const roles=[], pending=[];
  if(p.group==='CBQL'){
    if(['ht','hieu truong'].includes(position)){roles.push('BGH','DECIDER');}
    else if(['pht','pho hieu truong'].includes(position)){roles.push('BGH');}
    else pending.push('CBQL_AUTHORITY_REVIEW');
  }else if(p.group==='GV'){
    if(['ttcm','to truong chuyen mon'].includes(position))roles.push('TTCM');
    if(['tpcm','to pho chuyen mon'].includes(position))pending.push('TPCM_DELEGATION_REVIEW');
  }else if(p.group==='NV'){
    if(['ttvp','to truong van phong'].includes(position))pending.push('TTVP_SCOPE_NOT_IMPLEMENTED');
  }else pending.push('GROUP_REVIEW');
  const src=nq52PersonnelNorm_(p.sourceRole);
  if(['tpcm','to pho chuyen mon'].includes(src)&&!['tpcm','to pho chuyen mon'].includes(position))
    pending.push('SOURCE_ROLE_TPCM_MISMATCH');
  if(['ttcm','to truong chuyen mon'].includes(src)&&!['ttcm','to truong chuyen mon'].includes(position))
    pending.push('SOURCE_ROLE_TTCM_MISMATCH');
  return {roles,pending};
}
function nq52RolePlan_(){
  const people=nq52AccountDirectory_(),users=nqRows_('NQ52_USERS');
  const ids=new Set(),names=new Set(),byId=new Map();
  users.forEach(u=>{
    const id=String(u.id),name=String(u.username).trim().toLowerCase();
    if(!id||!name||ids.has(id)||names.has(name))throw new Error('USERS_DUPLICATE_OR_MISSING_ID');
    ids.add(id);names.add(name);byId.set(id,u);
  });
  const matched=new Set(),entries=[],issues=[];
  people.forEach(p=>{
    const u=byId.get(String(p.id));
    if(!nq52AccountEligible_(p)){
      if(u&&nqActive_(u))issues.push({sourceRow:p.sourceRow,code:'ACTIVE_ACCOUNT_REVIEW'});
      return;
    }
    if(!u){issues.push({sourceRow:p.sourceRow,code:'ACCOUNT_NOT_PREPARED'});return;}
    matched.add(String(u.id));
    if(String(u.username).trim().toLowerCase()!==String(p.username).trim().toLowerCase()||
       String(u.unit)!==String(p.unit)||String(u.group)!==String(p.group)){
      issues.push({sourceRow:p.sourceRow,code:'ACCOUNT_DIRECTORY_MISMATCH'});return;
    }
    const c=nq52RoleCandidate_(p);
    entries.push({sourceRow:p.sourceRow,group:p.group,unit:p.unit,position:p.position,
      proposedRoles:c.roles,currentRoles:nqRoles_(u),review:c.pending,active:nqActive_(u)});
  });
  users.forEach(u=>{if(!matched.has(String(u.id)))issues.push({code:'UNMATCHED_OR_INELIGIBLE_ACCOUNT_REVIEW'});});
  return {entries,issues};
}
function previewNQ52Permissions(){
  const plan=nq52RolePlan_(), counts={BGH:0,DECIDER:0,TTCM:0,HISTORY_ADMIN:0};
  const review=[],proposals=[];
  let personalOnly=0,active=0;
  plan.entries.forEach(e=>{
    if(e.active)active++;
    if(!e.proposedRoles.length)personalOnly++;
    e.proposedRoles.forEach(r=>counts[r]++);
    if(e.proposedRoles.length)proposals.push({sourceRow:e.sourceRow,position:e.position,unit:e.unit,proposedRoles:e.proposedRoles});
    e.review.forEach(code=>review.push({sourceRow:e.sourceRow,code}));
    if(e.currentRoles.length)review.push({sourceRow:e.sourceRow,code:'EXISTING_PERMISSIONS_REVIEW'});
  });
  const result={ok:!plan.issues.length,stage:'PERMISSION_PREVIEW_ONLY',
    accountsMatched:plan.entries.length,activeAccounts:active,
    proposedRoleCounts:counts,personalOnly,proposals,review,issues:plan.issues,
    permissionsGranted:0,writes:0,productionReady:false,
    notes:'Proposal only. BGH/TTCM/DECIDER are existing backend scopes, not legal authority. CBQL evaluation, TTVP and TPCM delegation need separate workflow. HISTORY_ADMIN not inferred.'};
  console.log(JSON.stringify(result,null,2));return result;
}
