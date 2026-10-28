import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const code=fs.readFileSync(new URL('../QuickAssistant.gs',import.meta.url),'utf8');
const raw=fs.readFileSync(new URL('../Code.gs',import.meta.url),'utf8');
const fixture=id=>({caseId:id,serialNumber:'SAME123456',model:'SG110CX',currentCenter:id==='DAT-001'?'DAT':'BKE',caseStatus:'Đang xử lý',receivedAt:'2026-10-15',readyAt:'2026-10-21',returnedAt:'2026-10-26',gsp:'RW123456',ma:'MA123456',warrantyStatus:'Trong bảo hành',canReturn:false,
  customerPhone:'PRIVATE_PHONE',customerEmail:'PRIVATE_EMAIL',customerAddress:'PRIVATE_ADDRESS',note:'PRIVATE_NOTE',evidenceLink:'PRIVATE_DRIVE',createdBy:'PRIVATE_CREATOR',
  workOrders:[{center:id==='DAT-001'?'DAT':'BKE',workflowStatus:'Chờ linh kiện',outcome:'',technicalCompletedAt:'2026-10-21',note:'PRIVATE_WORK_NOTE',canUpdate:false,issues:[{name:'Lỗi quạt',confirmedAt:'2026-10-17',note:'PRIVATE_ISSUE_NOTE'}],holds:[{reason:'Chờ linh kiện',startAt:'2026-10-17',endAt:'2026-10-21',note:'PRIVATE_HOLD_NOTE'}]}],transfers:[{fromCenter:'DAT',toCenter:'BKE',status:'Đã nhận',trackingReference:'PRIVATE_TRACKING'}]});
function harness(){
 const memory=new Map(),props=new Map(),network=[],reads=[],details=[];let actor={email:'staff@example.invalid',role:'center_staff',centers:['DAT'],isGlobalManager:false,capabilities:{viewCases:true}},http=200,bad=false;
 const cache={get:k=>memory.get(k)||null,put:(k,v)=>memory.set(k,v),remove:k=>memory.delete(k)};
 const lock={tryLock:()=>true,releaseLock:()=>{}};
 const data=[fixture('DAT-001'),fixture('BKE-001')];
 const context={console,Date,JSON,Number,Set,Error,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>cache},LockService:{getScriptLock:()=>lock},
  Utilities:{formatDate:(_d,_tz,f)=>f==='yyyy-MM-dd'?'2026-10-28':'2026-10-28-10'},
  publicError_:m=>Error(m),digest_:s=>crypto.createHash('sha256').update(s).digest('hex'),
  authenticate_:token=>{if(token!=='valid-session')throw Error('Unauthorized');return actor;},assertCapability_:(a,c)=>{if(!a.capabilities[c])throw Error('Forbidden');},
  listCases:(token,filter)=>{assert.equal(token,'valid-session');reads.push(filter);const allowed=data.filter(c=>actor.isGlobalManager||actor.centers.includes(c.currentCenter));const items=allowed.filter(c=>[c.caseId,c.serialNumber,c.gsp,c.ma,c.model].join(' ').toLowerCase().includes(filter.query.toLowerCase()));return{items,total:items.length};},
  getCaseDetail:(token,id)=>{assert.equal(token,'valid-session');details.push(id);const c=data.find(c=>c.caseId===id);if(!c||!actor.isGlobalManager&&!actor.centers.includes(c.currentCenter))throw Error('Forbidden');return c;},
  UrlFetchApp:{fetch:(url,options)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');const payload=JSON.parse(options.payload);network.push(payload);let answer=!!payload.generationConfig.responseJsonSchema.properties.intent?context.route:{answer:'Giải thích dựa trên bằng chứng.',sourceIds:['sla','not-a-real-source']};return{getResponseCode:()=>http,getContentText:()=>bad?'invalid json':JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]})};}},
  route:{intent:'kpi',query:'',usePrevious:true}
 };
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../WorkOrderRules.gs',import.meta.url),'utf8'),context);vm.runInContext(fs.readFileSync(new URL('../LegacyDashboardApi.gs',import.meta.url),'utf8'),context);vm.runInContext(code,context);
 let seq=0;const ask=(message,extra={})=>context.quickAssistantChat('valid-session',{message,conversationId:'conversation-00000001',requestId:'request-'+String(++seq).padStart(16,'0'),...extra});
 return{context,ask,props,memory,network,reads,details,setActor:a=>actor=a,setStatus:n=>http=n,setBad:()=>bad=true,actor:()=>actor};
}
const h=harness();
assert.throws(()=>h.context.quickAssistantChat('',{}),/Unauthorized/);
const first=h.ask('SAME123456');assert.equal(first.total,1);assert.equal(first.cases[0].caseId,'DAT-001');assert.equal(h.network.length,0);assert.ok(!JSON.stringify(first).includes('PRIVATE_'));
assert.equal(h.ask('Vì sao chưa hoàn tất?').mode,'guide');assert.equal(h.network.length,0);
h.props.set('ASSISTANT_GEMINI_KEY','test-fixture-key');h.props.set('ASSISTANT_AI_ENABLED','true');h.props.set('ASSISTANT_FREE_TIER_CONFIRMED','true');
const reply=h.ask('Vậy SLA của máy này tính sao?',{history:[{text:'fake'}],caseIds:['BKE-001']});
assert.equal(h.network.length,2);assert.equal(reply.cases[0].caseId,'DAT-001');assert.deepEqual(Array.from(reply.sources,s=>s.id),['sla']);assert.ok(h.details.includes('DAT-001'));assert.ok(!h.details.includes('BKE-001'));
for(const p of h.network){assert.equal(p.generationConfig.responseMimeType,'application/json');assert.ok(!JSON.stringify(p).includes('PRIVATE_'));assert.ok(!JSON.stringify(p).includes('valid-session'));assert.ok(!JSON.stringify(p).includes('staff@example.invalid'));}
const duplicate={conversationId:'conversation-00000001',requestId:'fixed-request-00000001'};
h.ask('SAME123456',duplicate);const before=h.network.length;h.ask('SAME123456',duplicate);assert.equal(h.network.length,before);assert.throws(()=>h.ask('OTHER123',duplicate),/đã dùng/);
h.setActor({...h.actor(),centers:['BKE']});const switched=h.ask('SAME123456');assert.equal(switched.cases[0].caseId,'BKE-001');
h.setActor({...h.actor(),isGlobalManager:true});const multi=h.ask('SAME123456');assert.equal(multi.total,2);assert.equal(multi.cases.length,2);
for(const role of ['center_staff','center_manager','service_manager']){h.setActor({...h.actor(),role});assert.ok(h.ask('SAME123456').cases.length);}
h.props.set('ASSISTANT_ENABLED','false');assert.throws(()=>h.ask('SAME123456'),/tạm dừng/);h.props.delete('ASSISTANT_ENABLED');
assert.throws(()=>h.ask('x'.repeat(1201)),/1.200/);
const q=harness();q.props.set('ASSISTANT_GEMINI_KEY','test-fixture-key');q.props.set('ASSISTANT_AI_ENABLED','true');q.props.set('ASSISTANT_FREE_TIER_CONFIRMED','true');q.props.set('ASSISTANT_AI_DAILY_LIMIT','1');assert.match(q.ask('KPI tính ra sao?').answer,/hạn mức/);assert.equal(q.network.length,1);assert.equal(q.ask('SAME123456').total,1);
const failed=harness();failed.props.set('ASSISTANT_GEMINI_KEY','test-fixture-key');failed.props.set('ASSISTANT_AI_ENABLED','true');failed.props.set('ASSISTANT_FREE_TIER_CONFIRMED','true');failed.setStatus(401);assert.match(failed.ask('Giúp tôi tra hồ sơ').answer,/cấu hình/);assert.equal(failed.ask('SAME123456').total,1);
const malformed=harness();malformed.props.set('ASSISTANT_GEMINI_KEY','test-fixture-key');malformed.props.set('ASSISTANT_AI_ENABLED','true');malformed.props.set('ASSISTANT_FREE_TIER_CONFIRMED','true');malformed.setBad();assert.match(malformed.ask('Cách xem dashboard').answer,/chưa hoàn chỉnh/);

const masked=h.context.qaMask_('Tra S/N A2652808299, GSP RW2610270195, gửi demo@example.invalid, 0901234567 https://private.example.invalid/x');
assert.ok(masked.text.includes('[MA_1]'));assert.equal(masked.queries['[MA_1]'],'A2652808299');
for(const rawValue of ['A2652808299','RW2610270195','demo@example.invalid','0901234567','private.example.invalid'])assert.ok(!masked.text.includes(rawValue));
const natural=harness();natural.props.set('ASSISTANT_GEMINI_KEY','test-fixture-key');natural.props.set('ASSISTANT_AI_ENABLED','true');natural.props.set('ASSISTANT_FREE_TIER_CONFIRMED','true');natural.context.route={intent:'lookup',query:'[MA_1]',usePrevious:false};
const naturalResult=natural.ask('Kiểm tra giúp máy SAME123456');assert.equal(naturalResult.cases[0].caseId,'DAT-001');
for(const p of natural.network){const serialized=JSON.stringify(p);for(const privateValue of ['SAME123456','DAT-001','RW123456','MA123456','staff@example.invalid','PRIVATE_'])assert.ok(!serialized.includes(privateValue),'External payload leaked '+privateValue);}
assert.doesNotMatch(code,/api\.openai\.com|qaEvidence_/);

assert.equal(h.reads[0].refresh,true);
assert.equal(h.context.qaRuleContext_().slaTargetDays,7);
assert.equal(h.context.qaRuleContext_().exampleNetDays,7);
const current=h.context.qaKnowledge_().find(d=>d.id==='sla');assert.ok(current.body.includes('11 − 4 = 7 ngày'));assert.ok(current.body.includes('## Cách tính'));
vm.runInContext("LEGACY_DASHBOARD_API.assistantRules=function(){return {version:'test-new-rules',slaTargetDays:9,afterReady:[],exampleNetDays:6};}",h.context);
const changed=h.context.qaKnowledge_().find(d=>d.id==='sla');assert.ok(changed.body.includes('không quá 9 ngày'));assert.ok(changed.body.includes('11 − 5 = 6 ngày'));
assert.match(raw,/quickAssistantChat: function/);
assert.doesNotMatch(code,/SpreadsheetApp|appendRow|setValues|eval\(|new Function/);
console.log('Quick assistant passed: authenticated/scoped reads, all roles, multi-case SN, free direct lookup, masked Gemini questions only, no case/contacts/tokens exported, follow-up, role changes, replay, limits and provider failures.');
