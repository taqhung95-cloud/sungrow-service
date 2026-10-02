import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=process.argv[2];if(!file)throw Error('Usage: xbsolar-migration-full.mjs migration-package.json');
const plan=JSON.parse(fs.readFileSync(file,'utf8')),ctx={Date};vm.createContext(ctx);
for(const name of ['XBSolarMigrationPlan.gs','XBSolarMigration.gs'])vm.runInContext(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),ctx);
const baseline=structuredClone(plan.baseline),tables=Object.fromEntries(Object.entries(baseline.headers).map(([t,h])=>[t,[h,...baseline.tables[t].map(r=>h.map(k=>r[k]??''))]])),metadata=Object.fromEntries(Object.keys(tables).map((t,i)=>[t,{properties:{sheetId:i+1,title:t,gridProperties:{rowCount:tables[t].length+20,columnCount:baseline.headers[t].length}}}]));
const snapshot=()=>{const result={headers:baseline.headers,tables:{},positions:{},lastRows:{},metadata};for(const[t,v]of Object.entries(tables)){const h=v[0];result.tables[t]=[];result.positions[t]={};result.lastRows[t]=v.length;for(let i=1;i<v.length;i++){const r=v[i];if(!r?.[0])continue;result.positions[t][r[0]]=i;result.tables[t].push(Object.fromEntries(h.map((k,j)=>[k,r[j]??''])));}}return result;};
const apply=requests=>{for(const r of requests){if(r.appendDimension){Object.values(metadata).find(s=>s.properties.sheetId===r.appendDimension.sheetId).properties.gridProperties.rowCount+=r.appendDimension.length;continue;}assert.equal(Object.keys(r)[0],'updateCells');const u=r.updateCells,t=Object.keys(metadata).find(t=>metadata[t].properties.sheetId===u.range.sheetId),v=tables[t],pos=u.range.startRowIndex;assert.equal(u.range.endRowIndex-pos,1);assert.equal(u.rows[0].values.length,u.range.endColumnIndex-u.range.startColumnIndex);if(!v[pos])v[pos]=[];for(let j=0;j<u.rows[0].values.length;j++){const c=u.rows[0].values[j],value=c.userEnteredValue;v[pos][u.range.startColumnIndex+j]=value.numberValue==null?value.stringValue:c.userEnteredFormat?.numberFormat?new Date((value.numberValue-25569)*86400000).toISOString().slice(0,10):value.numberValue;}}};
let requestsCount=0;
for(const g of plan.groups){const before=snapshot(),requests=ctx.xbmGroupRequests_(plan,g,before,false,{});requestsCount+=requests.length;apply(requests);const after=snapshot();ctx.xbmVerifyGroup_(plan,g,after);assert.equal(ctx.xbmGroupRequests_(plan,g,after,false,{}).length,0,'Resume wrote duplicates '+g.sourceCase);}
const after=snapshot();assert.equal(ctx.xbmComparable_(after),ctx.xbmComparable_(ctx.xbmExpected_(plan)));
for(const[t,count]of Object.entries(plan.expectedCounts))assert.equal(after.tables[t].length,count,t);
const get=(table,id)=>after.tables[table].find(r=>r[ctx.XBSolarMigrationPlan.keys[table]]===id);
assert.equal(ctx.XBSolarMigrationPlan.day(get('Hồ sơ thiết bị','HS-OLD-2024-0526')['Ngày nhận từ khách']),'2024-10-16');
assert.ok(get('Hồ sơ thiết bị','HS-XB-OLD-00196'));assert.ok(get('Hồ sơ thiết bị','HS-XB-OLD-00254'));
assert.equal(after.tables['Linh kiện sử dụng'].filter(p=>p['Mã sử dụng linh kiện']==='LK-OLD-2026-0098-01').length,1);
assert.equal(after.tables['Linh kiện sử dụng'].some(p=>p['Mã sử dụng linh kiện']==='LK-FINAL-HS-XB-OLD-00681-1'),false);
const forward=plan.groups.find(g=>g.serial==='A2542704238');assert.equal(get('Hồ sơ thiết bị',forward.caseId)['Ngày trả khách'],'2026-02-04');assert.equal(get('Hồ sơ thiết bị',forward.caseId)['Ngày sẵn sàng trả khách'],'2026-02-02');
assert.equal(get('Công việc trung tâm','CV-OLD-2026-0032')['Ngày chuyển hàng đi'],'');
const replacement=after.tables['Linh kiện sử dụng'].find(p=>p['Mã sử dụng linh kiện']==='LK-XB-00651-3');assert.equal(replacement['Mã công việc'],'CV-OLD-2026-0032');
const protectedGroup=plan.groups.find(g=>g.protectedManualEdits);assert.ok(protectedGroup);
for(const[k,v]of Object.entries(protectedGroup.protectedManualEdits)){if(k==='Ghi chú chung')continue;assert.equal(ctx.XBSolarMigrationPlan.normalizeRow(get('Hồ sơ thiết bị',protectedGroup.caseId),baseline.headers['Hồ sơ thiết bị'])[k],ctx.XBSolarMigrationPlan.normalizeRow(protectedGroup.protectedManualEdits,baseline.headers['Hồ sơ thiết bị'])[k]);}
const oldWork=baseline.tables['Công việc trung tâm'].find(w=>w['Mã công việc']==='CV-OLD-2025-0459');assert.deepEqual(get('Công việc trung tâm','CV-OLD-2025-0459'),oldWork);
const stamp={id:plan.id,rollbackActor:'manager@example.com',rollbackDate:'2026-10-02',rollbackReason:'Full dataset rehearsal'};
for(const g of plan.groups.slice().reverse()){apply(ctx.xbmGroupRequests_(plan,g,snapshot(),true,stamp));ctx.xbmVerifyRollback_(plan,g,snapshot(),stamp);}
const rolled=snapshot();for(const t of Object.keys(baseline.tables)){const id=ctx.XBSolarMigrationPlan.keys[t];for(const original of baseline.tables[t]){const actual=rolled.tables[t].find(r=>r[id]===original[id]);assert.ok(actual);assert.equal(ctx.XBSolarMigrationPlan.stable(ctx.XBSolarMigrationPlan.normalizeRow(actual,baseline.headers[t])),ctx.XBSolarMigrationPlan.stable(ctx.XBSolarMigrationPlan.normalizeRow(original,baseline.headers[t])));}}
assert.equal(rolled.tables['Hồ sơ thiết bị'].filter(c=>c['Trạng thái hồ sơ']==='Đã hủy'&&c['Lý do hủy'].startsWith('Rollback '+plan.id)).length,605);
assert.equal(rolled.tables['Luân chuyển thiết bị'].length,baseline.tables['Luân chuyển thiết bị'].length);
console.log(JSON.stringify({passed:true,cases:plan.groups.length,newCases:605,mergeCases:106,requests:requestsCount,afterCounts:plan.expectedCounts,rollback:'All original rows restored; 605 new cases soft cancelled with provenance retained.'},null,2));
