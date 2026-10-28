import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../QuickAssistantKnowledge.gs',import.meta.url),'utf8'),ctx);
const topics=ctx.qaWebsiteKnowledge_(),ids=new Set(),manifest={};
for(const d of topics){assert.ok(!ids.has(d.id));ids.add(d.id);assert.ok(d.body&&d.title&&d.keywords&&d.sourceFiles.length);assert.ok(['entry','management'].includes(d.scope));for(const name of d.sourceFiles){const text=fs.readFileSync(new URL(name,root),'utf8').replace(/\r\n/g,'\n');manifest[name]=crypto.createHash('sha256').update(text).digest('hex');}}
const target=new URL('assistant-knowledge-sources.json',import.meta.url),expected=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(target,expected);
else assert.equal(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n'),expected,'Source changed: review QuickAssistantKnowledge.gs, then run node "version final/tests/assistant-knowledge.mjs" --write.');
assert.ok(topics.length>=24);console.log('Assistant knowledge verified: '+topics.length+' topics, '+Object.keys(manifest).length+' source files.');
