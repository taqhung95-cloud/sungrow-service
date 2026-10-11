/* Small offline OOXML writer. Text stays inlineString, never Excel formulas. */
(() => {
 const encoder=new TextEncoder();
 const xml=value=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
 const crc=bytes=>{let value=0xFFFFFFFF;for(const b of bytes)value=crcTable[(value^b)&255]^(value>>>8);return (value^0xFFFFFFFF)>>>0;};
 const header=(size,fields)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [offset,value,length] of fields)length===2?view.setUint16(offset,value,true):view.setUint32(offset,value,true);return bytes;};
 function zip(files){
  const local=[],central=[];let offset=0,total=0;
  for(const [name,content] of files){
   const filename=encoder.encode(name),data=encoder.encode(content),sum=crc(data);total+=data.length;
   if(total>32*1024*1024)throw Error('File vượt 32 MB. Hãy thu hẹp kỳ hoặc bỏ các cột nội dung dài.');
   const lh=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[8,0,2],[12,33,2],[14,sum,4],[18,data.length,4],[22,data.length,4],[26,filename.length,2]]);
   const ch=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,sum,4],[20,data.length,4],[24,data.length,4],[28,filename.length,2],[42,offset,4]]);
   local.push(lh,filename,data);central.push(ch,filename);offset+=lh.length+filename.length+data.length;
  }
  const size=central.reduce((n,b)=>n+b.length,0),end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,size,4],[16,offset,4]]);
  const bytes=new Uint8Array(offset+size+22);let cursor=0;for(const b of [...local,...central,end]){bytes.set(b,cursor);cursor+=b.length;}return bytes;
 }
 function cell(value,type,ref,heading=false){
  if(value===null||value===undefined||value==='')return '<c r="'+ref+'"/>';
  if(heading)return '<c r="'+ref+'" t="inlineStr" s="1"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
  if(type==='number'||type==='percent'){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Giá trị số không hợp lệ tại '+ref);return '<c r="'+ref+'" s="'+(type==='percent'?3:0)+'"><v>'+value+'</v></c>';}
  if(type==='date'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Ngày không hợp lệ tại '+ref);
   const serial=(Date.parse(value+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
   if(!Number.isFinite(serial))throw Error('Ngày không hợp lệ tại '+ref);return '<c r="'+ref+'" s="2"><v>'+serial+'</v></c>';
  }
  if(String(value).length>32767)throw Error('Nội dung ô '+ref+' vượt giới hạn Excel. Bỏ cột nội dung dài hoặc thu hẹp báo cáo.');
  return '<c r="'+ref+'" t="inlineStr" s="4"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
 }
 function worksheet(sheet){
  const columns=sheet.columns,rows=sheet.rows;if(!columns.length||rows.length>20000)throw Error('Số dòng/cột báo cáo không hợp lệ.');
  const head='<row r="1">'+columns.map((c,i)=>cell(c.label,'text',column(i)+'1',true)).join('')+'</row>';
  let size=head.length;const body=rows.map((row,n)=>{const part='<row r="'+(n+2)+'">'+columns.map((c,i)=>cell(row[c.key],c.type,column(i)+(n+2))).join('')+'</row>';size+=part.length;if(size>32*1024*1024)throw Error('File vượt 32 MB. Hãy thu hẹp kỳ hoặc bỏ các cột nội dung dài.');return part;}).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+column(columns.length-1)+(rows.length+1)+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+columns.map((c,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+Math.min(40,Math.max(16,c.label.length+3))+'" customWidth="1"/>').join('')+'</cols><sheetData>'+head+body+'</sheetData><autoFilter ref="A1:'+column(columns.length-1)+(rows.length+1)+'"/></worksheet>';
 }
 function build(sheets){
  if(!Array.isArray(sheets)||!sheets.length||sheets.length>10)throw Error('Workbook không hợp lệ.');
  const names=new Set();sheets.forEach(s=>{if(!s.name||s.name.length>31||/[\\/:*?\[\]]/.test(s.name)||names.has(s.name))throw Error('Tên sheet không hợp lệ.');names.add(s.name);});
  const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files=[['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'],
   ['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
   ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="'+rel+'"><bookViews><workbookView/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'],
   ['xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>'],
   ['xl/styles.xml','<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEBD9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']];
  sheets.forEach((sheet,i)=>files.push(['xl/worksheets/sheet'+(i+1)+'.xml',worksheet(sheet)]));return zip(files);
 }
 window.SungrowXlsx={build};
})();
