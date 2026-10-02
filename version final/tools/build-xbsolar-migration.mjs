import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const [convertedPath,baselinePath,auditPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw Error('Usage: build-xbsolar-migration.mjs converted.json baseline-full.json audit.json package.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../XBSolarMigrationPlan.gs',import.meta.url),'utf8'),ctx);
vm.runInContext(fs.readFileSync(new URL('../XBSolarMigration.gs',import.meta.url),'utf8'),ctx);
const converted=read(convertedPath),baseline=read(baselinePath),audit=read(auditPath);
if(baseline.spreadsheetId!=='1EoYBTSAPPOne1VCUMTLQ7W_1jjDOQnQloDWdZyXM5xI')throw Error('Sai database đích');
const plan=ctx.XBSolarMigrationPlan.build(converted,baseline,audit);
const chronology=ctx.xbmCheckChronology_(plan);
const hash=x=>crypto.createHash('sha256').update(ctx.XBSolarMigrationPlan.stable(x)).digest('hex');
plan.id='XB-'+hash({source:converted,baseline,policy:audit.policy}).slice(0,24);
plan.inputHashes={converted:hash(converted),baseline:hash(baseline),policy:hash(audit.policy)};
plan.planHash=hash(plan);
fs.writeFileSync(outputPath,JSON.stringify(plan));
const counts={};for(const g of plan.groups)for(const op of g.operations){const k=op.table+(op.before?' / update':' / append');counts[k]=(counts[k]||0)+1;}
const manual=plan.groups.filter(g=>g.protectedManualEdits).flatMap(g=>{
 const incoming=converted.tables['Hồ sơ thiết bị'].find(c=>c['Mã hồ sơ']===g.sourceCase);
 const before=g.protectedManualEdits;
 return [`- ${g.caseId} / ${g.serial}: ${g.reviewNote}`, ...['Ngày nhận từ khách','Ngày trả khách','Trạng thái hồ sơ','Tình trạng bảo hành'].map(k=>`  - ${k}: giữ production «${before[k]||'trống'}»; nguồn XB «${incoming[k]||'trống'}».`)];
});
fs.writeFileSync(outputPath.replace(/\.json$/,'.md'),['# Gói migration XBSolar đã lập kế hoạch','',`Mã: ${plan.id}`,`SHA-256: ${plan.planHash}`,'',`Hồ sơ nguồn: ${plan.groups.length}; hồ sơ mới: ${plan.groups.filter(g=>g.createdCase).length}; merge: ${plan.groups.filter(g=>!g.createdCase).length}.`,'','## Thao tác dự kiến','',...Object.entries(counts).map(([k,v])=>`- ${k}: ${v}`),'','## Số dòng sau nhập','',...Object.entries(plan.expectedCounts).map(([k,v])=>`- ${k}: ${v}`),'','Gói này chưa được ghi lên production. Preview trên dữ liệu live phải khớp toàn bộ baseline, schema, version và hash. Commit yêu cầu backup + journal + ScriptLock + batch nguyên tử theo case. Chạy lại dùng cùng gói/cùng journal. Rollback giữ hồ sơ mới ở trạng thái Đã hủy, khôi phục các hồ sơ merge, không ghi đè tab lịch sử.'].join('\n'));
console.log(JSON.stringify({id:plan.id,groups:plan.groups.length,counts,expectedCounts:plan.expectedCounts,bytes:fs.statSync(outputPath).size},null,2));
fs.appendFileSync(outputPath.replace(/\.json$/,'.md'),'\n\n## Hồ sơ được bảo vệ do quản lý đã sửa\n\n'+(manual.join('\n')||'Không có.')+'\n\n19 hồ sơ hoàn tất kỹ thuật chờ XB bổ sung chi tiết/linh kiện vẫn giữ ghi chú theo xác nhận. Hai dòng linh kiện đã tồn tại dùng lại ID, không cộng thêm số lượng. Các lượt bảo hành độc lập giữ ID riêng; luân chuyển dùng cùng ID hồ sơ.\n');
fs.appendFileSync(outputPath.replace(/\.json$/,'.md'),'\n## Bất thường ngày có sẵn, không sửa tự động\n\n'+chronology.map(w=>`- ${w.caseId} / ${w.serial} / ${w.recordId}: ${w.earlier}; ${w.later}. ${w.note}`).join('\n')+'\n');
