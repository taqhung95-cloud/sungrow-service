/* Read-only, revision-scoped source bundles. Authorization stays in Code.gs. */
function fastReadCacheKey_(kind, suffix) {
  return 'fast-case-v1-' + kind + '-' + digest_(APP_VERSION + '|' + DATABASE_SPREADSHEET_ID + '|' + (suffix || ''));
}
function fastSheetsFetch_(path, body) {
  const options = {method: body ? 'post' : 'get', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true};
  if (body) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  const response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + DATABASE_SPREADSHEET_ID + path, options);
  if (response.getResponseCode() !== 200) throw Error('FAST_READ_HTTP_' + response.getResponseCode());
  return JSON.parse(response.getContentText());
}
function fastReadSchema_(refresh) {
  const cache = CacheService.getScriptCache(), key = fastReadCacheKey_('schema');
  const cached = readPortalChunkedCache_(cache, key);
  if (cached && !refresh) return cached;
  const tables = [SHEETS.cases,SHEETS.workOrders,SHEETS.transfers,SHEETS.issues,SHEETS.parts,SHEETS.holds,SHEETS.audit];
  const fields = 'properties(timeZone),sheets(properties(sheetId,title),data(rowData(values(formattedValue))))';
  const ranges = tables.map(function (name) { return 'ranges=' + encodeURIComponent("'" + name.replace(/'/g,"''") + "'!1:1"); });
  const response = fastSheetsFetch_('?fields=' + encodeURIComponent(fields) + '&' + ranges.join('&'));
  const schema = {timezone: response.properties.timeZone, tables: {}};
  (response.sheets || []).forEach(function (sheet) {
    if (tables.indexOf(sheet.properties.title) < 0) return;
    const headers = (((sheet.data || [])[0] || {}).rowData || [])[0];
    schema.tables[sheet.properties.title] = {id:sheet.properties.sheetId, headers:((headers || {}).values || []).map(function (cell) { return clean_(cell.formattedValue); })};
  });
  tables.forEach(function (name) { if (!schema.tables[name] || !schema.tables[name].headers.length) throw Error('FAST_READ_SCHEMA_MISSING'); });
  writePortalChunkedCache_(cache,key,schema,600);
  return schema;
}
function fastReadLocators_(schema, revision, refresh) {
  const cache = CacheService.getScriptCache(), key = fastReadCacheKey_('locators',revision);
  const cached = readPortalChunkedCache_(cache,key);
  if (cached && !refresh) return cached;
  const specs = [
    [SHEETS.cases,'Mã hồ sơ'],[SHEETS.workOrders,'Mã hồ sơ'],[SHEETS.transfers,'Mã hồ sơ'],
    [SHEETS.issues,'Mã công việc'],[SHEETS.parts,'Mã công việc'],[SHEETS.holds,'Mã công việc'],[SHEETS.audit,'Mã đối tượng']
  ];
  const ranges = specs.map(function (spec) {
    const index = schema.tables[spec[0]].headers.indexOf(spec[1]);
    if (index < 0) throw Error('FAST_READ_KEY_MISSING');
    const col = columnLetter_(index + 1);
    return 'ranges=' + encodeURIComponent("'" + spec[0].replace(/'/g,"''") + "'!" + col + '2:' + col);
  });
  const workIdColumn=columnLetter_(schema.tables[SHEETS.workOrders].headers.indexOf('Mã công việc')+1);
  if(workIdColumn==='')throw Error('FAST_READ_KEY_MISSING');
  ranges.push('ranges='+encodeURIComponent("'"+SHEETS.workOrders.replace(/'/g,"''")+"'!"+workIdColumn+'2:'+workIdColumn));
  const response = fastSheetsFetch_('/values:batchGet?valueRenderOption=FORMATTED_VALUE&' + ranges.join('&'));
  const locators = {};
  specs.forEach(function (spec,index) {
    const byKey = Object.create(null);
    (((response.valueRanges || [])[index] || {}).values || []).forEach(function (row,i) {
      const value = clean_(row[0]);
      if (value) { if (!byKey[value]) byKey[value] = []; byKey[value].push(i + 2); }
    });
    locators[spec[0]] = byKey;
  });
  locators.workIds={};((((response.valueRanges||[])[specs.length]||{}).values)||[]).forEach(function(row,i){locators.workIds[i+2]=clean_(row[0]);});
  // Publishing only under the revision observed before this read prevents reuse
  // after a write; the caller also verifies the revision after the source read.
  writePortalChunkedCache_(cache,key,locators,300);
  return locators;
}
function fastReadCells_(schema, tableRows) {
  const filters = [], byId = {}, result = {};
  Object.keys(tableRows).forEach(function (name) {
    const table = schema.tables[name]; byId[table.id] = name; result[name] = [];
    const rows = Array.from(new Set(tableRows[name])).sort(function (a,b) { return a-b; });
    for (let i=0;i<rows.length;) {
      const first=rows[i++];let last=first;
      while(i<rows.length && rows[i]===last+1)last=rows[i++];
      filters.push({gridRange:{sheetId:table.id,startRowIndex:first-1,endRowIndex:last,startColumnIndex:0,endColumnIndex:table.headers.length}});
    }
  });
  if (!filters.length) return result;
  const fields='sheets(properties(sheetId),data(startRow,startColumn,rowData(values(effectiveValue,effectiveFormat(numberFormat),formattedValue))))';
  // POST getByDataFilter is a read. Grid ranges avoid URL-length limits and do
  // not transfer unrelated rows between disjoint matches.
  const response=fastSheetsFetch_(':getByDataFilter?fields='+encodeURIComponent(fields),{dataFilters:filters,includeGridData:true});
  (response.sheets||[]).forEach(function(sheet){
    const name=byId[sheet.properties.sheetId];if(!name)return;
    (sheet.data||[]).forEach(function(grid){
      (grid.rowData||[]).forEach(function(row,index){
        const object={__rowNumber:(grid.startRow||0)+index+1},cells=row.values||[];
        schema.tables[name].headers.forEach(function(header,column){object[header]=fastReadCellValue_(cells[column]||{},schema.timezone);});
        result[name].push(object);
      });
    });
    result[name].sort(function(a,b){return a.__rowNumber-b.__rowNumber;});
  });
  return result;
}
function fastReadCellValue_(cell, timezone) {
  const value=cell.effectiveValue||{};
  if(Object.prototype.hasOwnProperty.call(value,'stringValue'))return value.stringValue;
  if(Object.prototype.hasOwnProperty.call(value,'boolValue'))return value.boolValue;
  if(Object.prototype.hasOwnProperty.call(value,'numberValue')){
    const type=((cell.effectiveFormat||{}).numberFormat||{}).type;
    if(type==='DATE'||type==='DATE_TIME'||type==='TIME'){
      const wallMs=Math.round((value.numberValue-25569)*86400000);
      if(/^(Asia\/(Saigon|Ho_Chi_Minh|Bangkok)|Etc\/GMT-7)$/.test(timezone))return new Date(wallMs-7*3600000);
      if(/^(UTC|Etc\/UTC|GMT)$/.test(timezone))return new Date(wallMs);
      const wall=new Date(wallMs).toISOString().slice(0,23);
      return Utilities.parseDate(wall,timezone,"yyyy-MM-dd'T'HH:mm:ss.SSS");
    }
    return value.numberValue;
  }
  if(value.errorValue)return cell.formattedValue||'#ERROR!';
  return '';
}
function fastBundlePack_(bundle, decode) {
  function row(value){if(!value)return value;const output={};Object.keys(value).forEach(function(k){const v=value[k];output[k]=decode?(v&&typeof v==='object'&&Object.keys(v).length===1&&typeof v.$date==='number'?new Date(v.$date):v):(v instanceof Date?{$date:v.getTime()}:v);});return output;}
  const out={record:row(bundle.record)};
  ['works','transfers','issues','parts','holds','audit'].forEach(function(k){out[k]=(bundle[k]||[]).map(row);});return out;
}
function readFastCaseBundle_(caseId, revision, attempt, refresh) {
  attempt=attempt||0;
  const cache=CacheService.getScriptCache(),key=fastReadCacheKey_('bundle',caseId+'|'+revision);
  const cached=readPortalChunkedCache_(cache,key);
  if(cached&&!refresh)return {bundle:fastBundlePack_(cached,true),cacheHit:true,revision:revision};
  const schema=fastReadSchema_(refresh),locators=fastReadLocators_(schema,revision,refresh),first={};
  [SHEETS.cases,SHEETS.workOrders,SHEETS.transfers,SHEETS.audit].forEach(function(name){first[name]=locators[name][caseId]||[];});
  const ids=(first[SHEETS.workOrders]||[]).map(function(row){return locators.workIds[row];}).filter(Boolean);
  [SHEETS.issues,SHEETS.parts,SHEETS.holds].forEach(function(name){first[name]=[].concat.apply([],ids.map(function(id){return locators[name][id]||[];}));});
  const primary=fastReadCells_(schema,first),works=primary[SHEETS.workOrders]||[],next=getPortalDatabaseRevision_();
  if(next!==revision){if(attempt<1)return readFastCaseBundle_(caseId,next,attempt+1,refresh);throw Error('FAST_READ_REVISION_CHANGED');}
  const bundle={record:(primary[SHEETS.cases]||[])[0]||null,works:works,transfers:primary[SHEETS.transfers]||[],issues:primary[SHEETS.issues]||[],parts:primary[SHEETS.parts]||[],holds:primary[SHEETS.holds]||[],audit:primary[SHEETS.audit]||[]};
  // IDs are rechecked because this is an optimization of locators, never an
  // authorization source. A mismatch must fall back to the ordinary reader.
  if(bundle.record&&clean_(bundle.record['Mã hồ sơ'])!==caseId)throw Error('FAST_READ_ROW_MOVED');
  if(works.some(function(w){return clean_(w['Mã hồ sơ'])!==caseId;}))throw Error('FAST_READ_ROW_MOVED');
  const actualIds=works.map(function(w){return clean_(w['Mã công việc']);});
  if(bundle.transfers.some(function(r){return clean_(r['Mã hồ sơ'])!==caseId;})||bundle.audit.some(function(r){return clean_(r['Mã đối tượng'])!==caseId;})||['issues','parts','holds'].some(function(k){return bundle[k].some(function(r){return actualIds.indexOf(clean_(r['Mã công việc']))<0;});}))throw Error('FAST_READ_ROW_MOVED');
  writePortalChunkedCache_(cache,key,fastBundlePack_(bundle,false),120);
  return {bundle:bundle,cacheHit:false,revision:revision};
}
function fastWarrantyRequest_(rows, includeNote) {
  for(let i=rows.length-1;i>=0;i--){const row=rows[i],action=clean_(row['Hành động']);
    if(action==='Xác nhận bảo hành'||action==='Xóa hồ sơ trước xác nhận bảo hành')break;
    if(action==='Yêu cầu duyệt bảo hành'){
      const result={requestedBy:clean_(row['Email người dùng']),requestedAt:new Date(row['Thời gian']).toISOString()};
      if(includeNote)result.note=clean_((parseJson_(row['Dữ liệu sau'])||{}).note).slice(0,2000);
      return result;
    }
  }
  return null;
}
