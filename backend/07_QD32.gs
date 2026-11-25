/** HVA-NQ52 | 07_QD32.gs
 * Reference: QD32/2026/QD-UBND, Phu luc III, Mau 03, PDF pp.47-52.
 * Draft only; not an approved school rubric or an official score/classification engine.
 * No client input for B, C, management evaluation or official decision.
 */
const NQ52_QD32_DRAFT_VERSION="QD32-M03-2026-04-23-DRAFT1";
const NQ52_QD32_A_MAX=Object.freeze({"I.1.a":0.75,"I.1.b":0.5,"I.1.c":0.5,"I.1.d":0.75,"I.1.đ":0.75,"I.1.e":0.75,"I.1.ê":0.5,"I.1.g":0.5,"I.2.a":1,"I.2.b":1,"I.2.c":1,"I.2.d":2,"II.1.a":1,"II.1.b":0.75,"II.1.c":0.75,"II.2.a":1.5,"II.2.b":1,"II.3.a":1.5,"II.3.b":1,"II.4.a":1.5,"II.4.b":1,"III.1":2.5,"III.2":2.5,"III.3":2.5,"III.4":2.5});
function nqAssessmentDraft_(u,p){
  if(!['GV','NV'].includes(String(u.group)))nqError_('FORBIDDEN');
  if(!p||typeof p!=='object'||Array.isArray(p)||p.version!==NQ52_QD32_DRAFT_VERSION||!Array.isArray(p.items)||p.items.length!==25)nqError_('INVALID_INPUT');
  const seen={},items=p.items.map(item=>{
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!Object.prototype.hasOwnProperty.call(NQ52_QD32_A_MAX,item.id)||seen[item.id])nqError_('INVALID_INPUT');
    seen[item.id]=true;const max=NQ52_QD32_A_MAX[item.id],score=item.score;
    if(score!==null&&(typeof score!=='number'||!Number.isFinite(score)||score<0||score>max||Math.abs(score*100-Math.round(score*100))>1e-7))nqError_('INVALID_INPUT');
    return {id:item.id,score,reason:nqText_(item.reason,500,false)};
  });
  const complete=items.every(x=>x.score!==null);
  return {version:NQ52_QD32_DRAFT_VERSION,items,complete,selfA:complete?Math.round(items.reduce((a,x)=>a+x.score,0)*100)/100:null,official:false,updatedAt:nqNow_()};
}
function nqQD32ReferenceBand_(kind,rate){
  if(!['quantity','progress','quality'].includes(kind)||typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>100)nqError_('INVALID_INPUT');
  const bands=kind==='quality'?[[95,30],[90,25],[80,20],[70,15],[60,10],[50,5],[0,0]]:[[100,20],[90,15],[80,10],[70,5],[60,1],[0,0]];
  const max=bands.find(x=>rate>=x[0])[1];
  return {rate,bandMax:max,referencePoints:rate*max/100,official:false};
}
