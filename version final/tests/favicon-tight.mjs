import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=new URL('../../',import.meta.url);
const svg=fs.readFileSync(new URL('docs/favicon-tight.svg',root),'utf8');
const png=fs.readFileSync(new URL('docs/favicon.png',root));
assert.match(svg,/viewBox="109 108 296 296"/);
assert.deepEqual(Buffer.from(svg.match(/base64,([^"]+)/)[1],'base64'),png,'Embedded logo must be exactly the original PNG');
for(const page of ['index.html','entry.html','data-entry-login.html','privacy.html']){
  const html=fs.readFileSync(new URL('docs/'+page,root),'utf8');
  assert.match(html,/favicon\.png\?v=3/);
  assert.match(html,/image\/svg\+xml" href="\.\/favicon-tight\.svg\?v=1"/);
}
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage();
  const bounds=await page.evaluate(async({original,tight})=>{
    const measure=async url=>{
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,16,16);
      const pixels=ctx.getImageData(0,0,16,16).data;
      let left=16,right=-1,top=16,bottom=-1;
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(pixels[(y*16+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
      return {width:right-left+1,height:bottom-top+1,cornerAlpha:pixels[3]};
    };
    return {original:await measure(original),tight:await measure(tight)};
  },{original:'data:image/png;base64,'+png.toString('base64'),tight:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')});
  assert.ok(bounds.tight.width>=14,'Logo should fill the favicon width');
  assert.ok(bounds.tight.width>bounds.original.width);
  assert.equal(bounds.tight.cornerAlpha,0,'Transparent background must remain');
  console.log('Favicon crop passed: original PNG bytes unchanged, embedded SVG rendering at 16px:',bounds);
}finally{await browser.close()}
