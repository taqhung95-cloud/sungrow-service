import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const props=new Map(),cache=new Map();let rejectSave=false;
const c={ScriptApp:{getScriptId:()=> 'fixture-1234567890'},asOwner_:()=> 'owner',
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperties:v=>Object.entries(v).forEach(([k,x])=>props.set(k,x))})},
 Utilities:{getUuid:()=>crypto.randomUUID()},CacheService:{getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this;}})}};
vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../QuickAssistantSetup.gs',import.meta.url),'utf8'),c);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('setupRPC',async(name,args)=>{await new Promise(r=>setTimeout(r,100));if(rejectSave&&name==='configureQuickAssistantForOwner')throw Error('Phiên cấu hình đã hết hạn');return c[name](...args);});
 const bridge=`<script>window.google={script:{get run(){let ok,fail;const r={withSuccessHandler(f){ok=f;return r},withFailureHandler(f){fail=f;return r}};for(const name of ['readQuickAssistantConfigurationForOwner','configureQuickAssistantForOwner'])r[name]=(...args)=>window.setupRPC(name,args).then(ok,fail);return r}}};</script>`;
 const open=async()=>{await page.setContent(c.qaSetupPage_().html.replace('<script>',bridge+'<script>'));await page.locator('#stored').filter({hasText:'Chưa có'}).or(page.locator('#stored').filter({hasText:'Đã lưu'})).waitFor();};
 await open();await page.locator('#key').fill('fixture-key-123456789012345');await page.locator('#free').check();await page.locator('#enabled').check();
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Đã ghi'),{},{timeout:3000});
 assert.equal(props.get('ASSISTANT_GEMINI_KEY'),'fixture-key-123456789012345');assert.equal(await page.locator('#key').inputValue(),'');
 await open();assert.ok((await page.locator('#stored').innerText()).includes('Key: Đã lưu'));assert.equal(await page.locator('#enabled').isChecked(),true);
 rejectSave=true;await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('hết hạn'),{},{timeout:3000});assert.equal(await page.locator('#save').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('Setup browser passed: save callback visible, persisted reload, secret cleared, failure visible and retry enabled.');
}finally{await browser.close();}
