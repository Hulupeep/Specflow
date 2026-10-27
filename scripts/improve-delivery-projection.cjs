'use strict';
const m=require('./improve-memory.cjs');
function project(delivery){if(!delivery)return null;const operations=Object.values(delivery.operations).map(o=>({id:o.id,purpose:o.purpose,state:o.state,reason_code:o.reason_code,remote_id:o.remote_id,report_sequence:o.report_sequence})),states=[delivery.github,delivery.heystax];
 // Use explicit precedence: a known PR does not hide an unknown/blocked Stax write.
 const actual=['unknown','blocked','pending'].find(s=>states.includes(s))||(states.includes('delivered')?'delivered':'not_requested'),op=operations.filter(o=>(o.purpose!=='stax_result'||o.report_sequence===delivery.report_sequence||['unknown','issued'].includes(o.state))&&['unknown','blocked','pending','issued'].includes(o.state)).at(-1),reason=op?.reason_code||(actual==='pending'?'delivery_pending':null);
 return {version:1,status:actual,github:delivery.github,heystax:delivery.heystax,recipient_observation:delivery.recipient_observation,operations,proposal:delivery.proposal||null,blocker:op?{reason_code:reason,operation_id:op.id,purpose:op.purpose,next_action:{owner:'agent',reason_code:reason,action:op.state==='unknown'||op.state==='issued'?'Reconcile the original configured external operation by its exact marker/remote identity; do not resend unknown effects or build again.':'Inspect the exact configured delivery boundary and current authority; preserve the original result and human edits.'}}:null,revision:m.digest({github:delivery.github,heystax:delivery.heystax,operations,proposal:delivery.proposal||null})};
}
module.exports={project};
