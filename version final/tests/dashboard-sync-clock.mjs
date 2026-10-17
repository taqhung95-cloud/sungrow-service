import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../docs/live-data.js',import.meta.url),'utf8');
const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const functions=[block('  function markDashboardSynced(', '  function selectedPeriod('),block('  async function checkDashboardRevision(', '  async function loadLive('),block('  async function loadLive(', '  function renderAll('),block('  async function loadTicketPage(', '  function goTicketPage(')].join('\n');
const tick=()=>new Promise(r=>setImmediate(r));
const cachedAt='2026-10-17T14:20:00Z';
function harness(){
 let now=Date.parse('2026-10-17T14:31:00Z');class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const nodes=new Map(),statuses=[],requests=[];
 const q=key=>{if(!nodes.has(key))nodes.set(key,{value:key==='#sg-center'?'all':key==='#sg-ticket-page-size'?'20':'',disabled:false,classList:{contains:()=>false}});return nodes.get(key)};
 const dashboard={source:{sourceUpdatedAt:cachedAt,revision:'r1'},period:{key:'2026'},actor:{}};
 const ctx={Date:Clock,AbortController,console,window:{SungrowPeriod:{previous:()=> '2025'}},document:{hidden:false},navigator:{onLine:false},root:{dataset:{}},q,status:(...args)=>statuses.push(args),renderAll(){},renderTickets(){},renderIdentity(){},syncCenterOptions(){},selectedPeriod:()=> '2026',failureRateCache:new Map(),token:'fixture',live:structuredClone(dashboard),previousLive:{summary:{}},portalRevision:'r1',lastSuccessfulSync:Date.parse(cachedAt),loadSequence:0,activeController:null,revisionCheckBusy:false,ticketSearchState:{page:3,pageSize:20,totalPages:139,rows:[],error:'',loading:false},ticketSearchSequence:0,ticketSearchController:null,ticketSearchTimer:null,ticketSortOrder:'newest',setTimeout,clearTimeout};
 ctx.fetchDashboard=async(payload,signal)=>{requests.push(payload);if(signal?.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});if(payload.action==='portal.call')return {revision:'r1'};if(payload.action==='tickets.page')return {tickets:[{id:'fresh'}],total:2762,page:payload.page,pageSize:20,totalPages:139};return structuredClone(dashboard);};
 vm.createContext(ctx);vm.runInContext(functions,ctx);
 return {ctx,statuses,requests,q,dashboard,advance:ms=>{now+=ms},get now(){return now}};
}
const h=harness();let finishList;
h.ctx.fetchDashboard=async p=>{h.requests.push(p);return p.action==='tickets.page'?new Promise(resolve=>{finishList=resolve}):structuredClone(h.dashboard)};
const refresh=h.ctx.loadLive({comparison:false,force:true});await tick();
assert.equal(h.ctx.lastSuccessfulSync,Date.parse(cachedAt),'A dashboard response alone must not confirm the visible list.');assert.equal(h.statuses.some(s=>s[0]==='Đã đồng bộ'),false);assert.equal(h.q('#sg-refresh').disabled,true);
assert.equal(h.requests.find(p=>p.action==='tickets.page').page,3,'Sync preserves the current page.');
finishList({tickets:[{id:'new-data'}],total:2762,page:3,pageSize:20,totalPages:139});assert.equal(await refresh,true);
assert.equal(h.ctx.lastSuccessfulSync,h.now);assert.equal(h.ctx.ticketSearchState.rows[0].id,'new-data');assert.equal(h.statuses.at(-1)[0],'Đã đồng bộ');assert.equal(h.statuses.at(-1)[1],new Date(h.now).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));assert.equal(h.q('#sg-refresh').disabled,false);

const fail=harness();fail.ctx.fetchDashboard=async p=>{if(p.action==='tickets.page')throw Error('List disconnected');return structuredClone(fail.dashboard)};
await fail.ctx.loadLive({comparison:false});assert.equal(fail.ctx.lastSuccessfulSync,Date.parse(cachedAt));assert.equal(fail.statuses.at(-1)[0],'Chưa đồng bộ');assert.equal(fail.statuses.at(-1)[2],'error');assert.match(fail.ctx.ticketSearchState.error,/List disconnected/);assert.equal(fail.statuses.some(s=>s[0]==='Đã đồng bộ'),false,'Failed list reads cannot show a green sync acknowledgement.');

const poll=harness();await poll.ctx.checkDashboardRevision();assert.equal(poll.ctx.lastSuccessfulSync,poll.now);assert.deepEqual(poll.requests.map(p=>p.action),['portal.call'],'An unchanged revision only needs one lightweight check.');
const changed=harness();let dataFails=true,builds=0;
changed.ctx.portalRevision='';changed.ctx.fetchDashboard=async p=>{if(p.action==='portal.call')return {revision:'r2'};if(p.action==='tickets.page')return {tickets:[],total:0,page:3};builds++;if(dataFails)throw Error('Temporary read failure');return {...structuredClone(changed.dashboard),source:{...changed.dashboard.source,revision:'r2'}}};
await changed.ctx.checkDashboardRevision();assert.notEqual(changed.ctx.portalRevision,'r2','A failed read must not acknowledge the new revision.');dataFails=false;await changed.ctx.checkDashboardRevision();assert.equal(builds,2,'Next poll retries the unacknowledged revision.');assert.equal(changed.ctx.portalRevision,'r2');assert.equal(changed.ctx.lastSuccessfulSync,changed.now);
const stale=harness();stale.ctx.ticketSearchState.error='List unavailable';await stale.ctx.checkDashboardRevision();assert.equal(stale.statuses.some(s=>s[0]==='Đã đồng bộ'),false,'Revision checks must not hide a visible list error.');
const listRevision=harness();let listFails=true,listReloads=0;
listRevision.ctx.fetchDashboard=async p=>{if(p.action==='portal.call')return {revision:'r2'};if(p.action==='tickets.page'){listReloads++;if(listFails)throw Error('List unavailable');return {tickets:[],total:0,page:3};}return {...structuredClone(listRevision.dashboard),source:{...listRevision.dashboard.source,revision:'r2'}};};
await listRevision.ctx.checkDashboardRevision();assert.equal(listRevision.ctx.live.source.revision,'r2');assert.equal(listRevision.ctx.portalRevision,'r1');listFails=false;await listRevision.ctx.checkDashboardRevision();assert.equal(listReloads,2,'Retry a failed list even if the summary already carries the new revision.');assert.equal(listRevision.ctx.portalRevision,'r2');
const directFail=harness();directFail.ctx.fetchDashboard=async()=>{throw Error('Standalone list failed')};assert.equal(await directFail.ctx.loadTicketPage(false),false);assert.equal(directFail.statuses.at(-1)[2],'error');
console.log('Dashboard sync passed: cached 21:20 data acknowledged at current receipt time, visible-list completion/error, preserved page, lightweight no-change heartbeat and retry after failed revision reload.');
