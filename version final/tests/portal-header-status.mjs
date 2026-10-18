import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../docs/live-data.js',import.meta.url),'utf8');
const status=source.slice(source.indexOf('  function status('),source.indexOf('  function markDashboardSynced('));
const begin=source.lastIndexOf("  window.addEventListener('message',event => {");
const handler=source.slice(begin,source.indexOf('\n})();',begin));
const frameWindow={},nodes=new Map([
 ['.sg-portal-frame',{contentWindow:frameWindow}],['.sg-main',{classList:{contains:()=>true}}],
 ...['.sg-live-dot','#sg-live-title','#sg-live-detail','.sg-live-text','.sg-live-box','#sg-refresh'].map(key=>[key,{}])
]);
const context={q:key=>nodes.get(key),live:{},window:{location:{origin:'https://fixture'},addEventListener:(_,listener)=>context.message=listener}};
vm.createContext(context);vm.runInContext(status+handler,context);
const send=(text,busy=false,origin='https://fixture',source=frameWindow)=>context.message({origin,source,data:{type:'sungrow-portal-sync-status',text,busy}});
send('Đã đồng bộ 00:13:03');assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot ok');assert.equal(nodes.get('#sg-refresh').disabled,false);
send('Đã đồng bộ 00:13:03',true);assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot ');assert.equal(nodes.get('#sg-live-title').textContent,'Đang đồng bộ…');
send('Đang tải hồ sơ…');assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot ');
send('Chưa đồng bộ | Mất kết nối');assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot error');
send('Đã đồng bộ 00:13:05');assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot ok');
send('Chưa đồng bộ',false,'https://untrusted');send('Chưa đồng bộ',false,'https://fixture',{});assert.equal(nodes.get('.sg-live-dot').className,'sg-live-dot ok');
console.log('Portal header status passed: synced green, busy amber with matching label, failures red, recovery green and source/origin guards.');
