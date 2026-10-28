import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const props=new Map(),cache=new Map(),key='fixture-key-'+ 'x'.repeat(30),owner='taqhung.95@gmail.com';
let active=owner,effective=owner,sets=0,discardWrites=false;
const c={console,JSON,Number,Error,Date,
 ScriptApp:{getScriptId:()=> 'fixture-project-1234567890'},
 Session:{getEffectiveUser:()=>({getEmail:()=>effective}),getActiveUser:()=>({getEmail:()=>active})},
 Utilities:{getUuid:()=>crypto.randomUUID()},CacheService:{getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperties:(values,remove)=>{assert.equal(remove,false,'Must retain other properties');sets++;if(!discardWrites)Object.entries(values).forEach(([k,v])=>props.set(k,v));}})},
 HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this;}})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})}
};
vm.createContext(c);vm.runInContext(read('AttachmentStorage.gs'),c);vm.runInContext(read('QuickAssistantSetup.gs'),c);
for(let n=0;n<65;n++)props.set('EXISTING_'+n,'keep-'+n);
props.set('RDR_DONE_TEST','keep-receipt');props.set('SCRIPT_MAINTENANCE_CCS_SRS_ARCHIVE','keep-archive');props.set('ATTACHMENT_STORAGE_SECRET','keep-worker-secret');
props.set('ASSISTANT_GEMINI_KEY',key);
const before=new Map(props);
const page=c.qaSetupPage_();assert.ok(!page.html.includes(key));assert.ok(!page.html.includes('keep-worker-secret'));assert.ok(!page.html.includes('keep-archive'));
const nonce=[...cache.keys()][0].slice('QA_SETUP:'.length);
const values={key:'',model:'gemini-3.5-flash-lite',daily:100,hourly:30,enabled:true,freeConfirmed:true,ATTACHMENT_STORAGE_SECRET:'evil'};
assert.equal(c.configureQuickAssistantForOwner(nonce,values).ok,true);assert.equal(props.get('ASSISTANT_GEMINI_KEY'),key);
for(const[k,v]of before)assert.equal(props.get(k),v,'Unexpected change to '+k);
assert.equal(props.get('ASSISTANT_AI_ENABLED'),'true');assert.equal(sets,1);
assert.throws(()=>c.configureQuickAssistantForOwner(nonce,values),/hết hạn/);
active='staff@example.invalid';assert.throws(()=>c.qaSetupPage_(),/Chỉ chủ/);assert.throws(()=>c.configureQuickAssistantForOwner(nonce,values),/Chỉ chủ/);
active=effective='other-owner@example.invalid';assert.throws(()=>c.qaSetupPage_(),/Chỉ chủ/,'Matching active/effective identities alone do not grant access');
active=effective=owner;
c.qaSetupPage_();const second=[...cache.keys()][0].slice('QA_SETUP:'.length);
assert.throws(()=>c.configureQuickAssistantForOwner(second,{...values,daily:-1}),/không hợp lệ/);
assert.throws(()=>c.configureQuickAssistantForOwner(second,{...values,freeConfirmed:false}),/Free Tier/);
assert.equal(sets,1,'Invalid input must not write');
const disabled=c.configureQuickAssistantForOwner(second,{...values,enabled:false,freeConfirmed:false,daily:0});assert.equal(disabled.aiEnabled,false);assert.equal(props.get('ASSISTANT_GEMINI_KEY'),key);
assert.equal(c.readQuickAssistantConfigurationForOwner().keyConfigured,true);
assert.equal(c.readQuickAssistantConfigurationForOwner().project,'1234567890');
assert.ok(!JSON.stringify(c.readQuickAssistantConfigurationForOwner()).includes(key));
active='staff@example.invalid';assert.throws(()=>c.readQuickAssistantConfigurationForOwner(),/Chỉ chủ/);active=owner;
c.qaSetupPage_();const third=[...cache.keys()][0].slice('QA_SETUP:'.length);discardWrites=true;
assert.throws(()=>c.configureQuickAssistantForOwner(third,{...values,key:'new-fixture-key-123456789012345'}),/Không xác minh/);
discardWrites=false;
assert.equal(c.configureQuickAssistantForOwner(third,{...values,key:'new-fixture-key-123456789012345'}).keyConfigured,true);
assert.equal(props.get('ASSISTANT_GEMINI_KEY'),'new-fixture-key-123456789012345');
const scripts=[...page.html.matchAll(/<script>([\s\S]*?)<\/script>/g)];for(const m of scripts)new vm.Script(m[1]);
assert.match(read('Code.gs'),/assistant_setup==='1'/);
assert.doesNotMatch(read('QuickAssistantSetup.gs'),/deleteAllProperties|deleteProperty|setProperties\([^;]+true\)/);
console.log('Assistant setup passed: >50 existing properties retained, pinned owner, nonce/replay, no key in HTML/result, validated quotas, key preservation and no writes on invalid input.');
