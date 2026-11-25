/**
 * HVA-NQ52 | 06_PHAN_QUYEN.gs | 0.3
 * Preview plus explicit approval-bound initial role assignment. No account activation.
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
    if(['ttvp','to truong van phong'].includes(position)){
      if(p.unitKey==='OFFICE'&&p.unit==='Văn phòng')roles.push('TTVP');
      else pending.push('TTVP_UNIT_REVIEW');
    }
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
    entries.push({id:String(u.id),sourceRow:p.sourceRow,group:p.group,unit:p.unit,position:p.position,
      proposedRoles:c.roles,currentRoles:nqRoles_(u),review:c.pending,active:nqActive_(u)});
  });
  users.forEach(u=>{if(!matched.has(String(u.id)))issues.push({code:'UNMATCHED_OR_INELIGIBLE_ACCOUNT_REVIEW'});});
  return {entries,issues};
}
function previewNQ52Permissions(){
  const plan=nq52RolePlan_(), counts={BGH:0,DECIDER:0,TTCM:0,TTVP:0,HISTORY_ADMIN:0};
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
    approvalDigest:nq52PermissionDigest_(plan),permissionsGranted:0,writes:0,productionReady:false,
    notes:'Proposal only. BGH/TTCM/DECIDER are existing backend scopes, not legal authority. TTVP scope: office NV only. CBQL evaluation and TPCM delegation need separate workflow. HISTORY_ADMIN not inferred.'};
  console.log(JSON.stringify(result,null,2));return result;
}

/** Fingerprint binds approval to exact accounts, units, positions, current roles and proposals. */
function nq52PermissionDigest_(plan){
  const rows=plan.entries.map(e=>[e.id,e.sourceRow,e.group,e.unit,e.position,
    e.currentRoles.slice().sort(),e.proposedRoles.slice().sort(),e.review.slice().sort(),e.active]);
  rows.sort((a,b)=>a[0].localeCompare(b[0]));
  return nqDigest_(JSON.stringify({rows,issues:plan.issues}));
}
/**
 * Initial role assignment only, before activation.
 * Admin must review preview and enter its approvalDigest as NQ52_PERMISSION_APPROVAL.
 * No automatic TPCM or HISTORY_ADMIN grants. TTVP is restricted to the office. No changes to existing roles.
 */
function applyNQ52InitialPermissions(){
  return nqLock_(function(){
    const props=PropertiesService.getScriptProperties();
    const plan=nq52RolePlan_();
    if(plan.issues.length||!plan.entries.length)throw new Error('PERMISSION_PLAN_HAS_ISSUES');
    if(plan.entries.some(e=>e.active))throw new Error('INITIAL_ASSIGNMENT_REQUIRES_INACTIVE_ACCOUNTS');
    const digest=nq52PermissionDigest_(plan);
    if(props.getProperty('NQ52_PERMISSION_APPROVAL')!==digest)throw new Error('PERMISSION_APPROVAL_REQUIRED_OR_STALE');
    const byId=new Map(nqRows_('NQ52_USERS').map(u=>[String(u.id),u]));
    const grants=[];
    plan.entries.forEach(e=>{
      const current=e.currentRoles.slice().sort().join(','),next=e.proposedRoles.slice().sort().join(',');
      if(current&&current!==next)throw new Error('EXISTING_ROLES_REQUIRE_MANUAL_REVIEW');
      if(!current&&next){
        if(e.review.length)throw new Error('PROPOSED_ROLE_REQUIRES_REVIEW');
        const u=byId.get(e.id);
        if(!u||nqActive_(u)||nqRoles_(u).length)throw new Error('ACCOUNT_STATE_CHANGED');
        grants.push({u,roles:next});
      }
    });
    // Consume approval before writes: rerun preview and reapprove after interrupted execution.
    props.deleteProperty('NQ52_PERMISSION_APPROVAL');
    let assigned=0;
    grants.forEach(g=>{
      g.u.roles=g.roles;
      nqWrite_('NQ52_USERS',g.u);
      nqRevokeAll_(g.u.id);
      nqAudit_('ADMIN_EDITOR','INITIAL_ROLES_ASSIGNED',g.u.id,{roles:g.roles,digest});
      assigned++;
    });
    const result={ok:true,stage:'INITIAL_PERMISSIONS_ASSIGNED',accountsUpdated:assigned,
      accountsActivated:0,remainingScopes:['TPCM','HISTORY_ADMIN','CBQL_EVALUATION'],
      productionReady:false};
    console.log(JSON.stringify(result,null,2));return result;
  });
}
