(() => {
 'use strict';
 let config=null,schema=null,preview=null,epoch=0,controller=null,busy=false,root,main,pane,navButton;
 const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const q=s=>pane.querySelector(s);
 const basisLabels={received:'Ngày tiếp nhận',technical:'Ngày hoàn tất kỹ thuật',returned:'Ngày giao trả',open:'Tồn tại ngày chốt'};
 function status(text,error=false){q('[data-report-status]').textContent=text;q('[data-report-status]').classList.toggle('error',error);}
 function setBusy(value){busy=value;pane.querySelectorAll('input,select,[data-preview],[data-export],[data-report-type]').forEach(el=>el.disabled=value);q('[data-cancel]').hidden=!value;q('[data-report-status]').dataset.busy=String(value);}
 function cancel(){controller?.abort();}
 function valid(generation){if(epoch!==generation||controller?.signal.aborted){const error=Error('Đã hủy báo cáo.');error.name='AbortError';throw error;}}
 function checked(selector){return Array.from(pane.querySelectorAll(selector+':checked')).map(el=>el.value);}
 function request(){
  const type=q('[name=type]').value,detail=type==='cases';
  const spec={type,start:q('[name=start]').value,end:q('[name=end]').value,dateBasis:detail?q('[name=dateBasis]').value:'received',centers:checked('[data-center]'),columns:checked('[data-column]'),query:detail?q('[name=query]').value.trim():'',status:detail?q('[name=status]').value:'',warrantyStatus:detail?q('[name=warrantyStatus]').value:'',deviceType:detail?q('[name=deviceType]').value:''};
  if(!spec.start||!spec.end||spec.start>spec.end)throw Error('Chọn khoảng ngày hợp lệ.');if(!spec.columns.length)throw Error('Chọn ít nhất một cột xuất.');return spec;
 }
 function columns(){
  if(!schema)return;const type=q('[name=type]').value;
  q('[data-columns]').innerHTML=schema.columns[type].map(c=>'<label><input type="checkbox" data-column value="'+esc(c.key)+'" '+(c.default?'checked':'')+'> '+esc(c.label)+'</label>').join('');
  q('[data-detail-options]').hidden=type!=='cases';q('[data-report-note]').textContent=type==='centers'?'Tồn được tính tại ngày chốt, gồm hồ sơ từ kỳ trước. Tổng hợp dùng cùng quy tắc với dashboard.':'Mỗi dòng là một lượt tiếp nhận, không gộp theo S/N. Trạng thái và trung tâm là thông tin hiện tại/chặng gần nhất.';
  pane.querySelectorAll('[data-report-type]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reportType===type)));invalidate();
 }
 function invalidate(){preview=null;q('[data-report-table]').innerHTML='';q('[data-report-count]').textContent='';q('[data-export]').disabled=busy||!schema;}
 function render(data){
  const formatted=(value,type)=>value===null||value===undefined?'—':type==='percent'?(value*100).toFixed(1)+'%':type==='date'?String(value).split('-').reverse().join('/'):String(value);
  q('[data-report-count]').textContent=data.spec.type==='cases'?data.total+' hồ sơ · '+data.knownDevices+' thiết bị đã biết số lượng'+(data.unknownQuantityCases?' · '+data.unknownQuantityCases+' hồ sơ thiếu số lượng':''):data.total+' dòng trung tâm';
  q('[data-report-table]').innerHTML='<table><thead><tr>'+data.columns.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'</tr></thead><tbody>'+data.rows.slice(0,20).map(row=>'<tr>'+data.columns.map(c=>'<td>'+esc(formatted(row[c.key],c.type))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 async function run(exportFile){
  if(busy||!schema)return;let spec;try{spec=request()}catch(error){status(error.message,true);return}
  const generation=epoch,operation=new AbortController();controller=operation;setBusy(true);q('[data-progress]').hidden=false;q('[data-progress]').value=0;
  try{
   status(exportFile?'Đang lấy dữ liệu để xuất Excel…':'Đang xem trước báo cáo…');
   const data=await config.request('readReportPage',{...spec,offset:0,limit:exportFile?200:20},controller.signal);valid(generation);preview=data;render(data);
   if(!exportFile){status('Xem trước tối đa 20 dòng. File Excel sẽ xuất toàn bộ kết quả phù hợp.');return}
   const rows=data.rows.slice();q('[data-progress]').max=Math.max(1,data.total);q('[data-progress]').value=rows.length;
   let next=data.nextOffset;
   while(next!==null){
    status('Đang lấy dữ liệu: '+rows.length+'/'+data.total+' dòng…');
    const page=await config.request('readReportPage',{...spec,offset:next,limit:200,revision:data.revision,asOf:data.asOf},controller.signal);valid(generation);
    if(page.revision!==data.revision||page.fingerprint!==data.fingerprint||page.total!==data.total||page.offset!==next||!page.rows.length||page.nextOffset!==null&&page.nextOffset<=next)throw Error('Dữ liệu báo cáo không nhất quán. Vui lòng xuất lại.');
    rows.push(...page.rows);next=page.nextOffset;q('[data-progress]').value=rows.length;
   }
   if(rows.length!==data.total)throw Error('Chưa lấy đủ các dòng báo cáo. Vui lòng xuất lại.');
   status('Đang tạo file Excel…');await new Promise(resolve=>setTimeout(resolve,0));valid(generation);
   const info=[['Mẫu báo cáo',spec.type==='cases'?'Chi tiết hồ sơ':'Tổng hợp trung tâm'],['Từ ngày',spec.start],['Đến ngày',spec.end],['Loại ngày',spec.type==='centers'?'Kỳ báo cáo và tồn tại ngày chốt':basisLabels[spec.dateBasis]],['Ngày chốt (giờ Việt Nam)',new Date(data.asOf).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],['Trung tâm',spec.centers.length?spec.centers.join(', '):'Tất cả, gồm chưa xác định'],['Trạng thái',spec.status||'Tất cả'],['Bảo hành',spec.warrantyStatus||'Tất cả'],['Loại thiết bị',spec.deviceType||'Tất cả'],['Từ khóa',spec.query],['Số dòng xuất',String(rows.length)],['Revision dữ liệu',data.revision],['Thời gian tạo (giờ Việt Nam)',new Date(data.generatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],...data.definitions.map((text,i)=>['Quy tắc '+(i+1),text])];
   const bytes=window.SungrowXlsx.build([{name:'Thông tin báo cáo',columns:[{key:'name',label:'Thông tin',type:'text'},{key:'value',label:'Giá trị',type:'text'}],rows:info.map(([name,value])=>({name,value}))},{name:spec.type==='cases'?'Hồ sơ':'Tổng hợp trung tâm',columns:data.columns,rows}]);
   const final=await config.request('readReportPage',{...spec,offset:data.total,limit:1,revision:data.revision,asOf:data.asOf},controller.signal);valid(generation);
   if(final.revision!==data.revision||final.fingerprint!==data.fingerprint||final.total!==data.total)throw Error('Dữ liệu đã thay đổi. Vui lòng xuất lại.');
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');link.href=url;link.download='Sungrow_'+(spec.type==='cases'?'HoSo':'TongHop')+'_'+spec.start+'_'+spec.end+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   status('Đã xuất '+rows.length+' dòng vào file Excel.');
  }catch(error){if(generation===epoch)status(error.name==='AbortError'?'Đã hủy báo cáo.':error.message,true);}
  finally{if(generation===epoch){setBusy(false);q('[data-progress]').hidden=true;}if(controller===operation)controller=null;}
 }
 function install(){
  if(pane)return;root=document.getElementById('sg-preview');main=root.querySelector('.sg-main');
  navButton=document.createElement('button');navButton.className='sg-nav-parent sg-report-parent';navButton.type='button';navButton.hidden=true;navButton.classList.add('sg-role-hidden');navButton.title='Báo cáo';navButton.setAttribute('aria-label','Báo cáo');navButton.innerHTML='<svg class="sg-rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4M9 1v4m6-4v4"/></svg><span class="sg-rail-name">Báo cáo</span><span class="sg-rail-full">Báo cáo</span>';root.querySelector('.sg-nav').append(navButton);navButton.addEventListener('click',open);
  navButton.dataset.view='reports';pane=document.createElement('section');pane.className='sg-reports-view';pane.hidden=true;pane.setAttribute('aria-label','Báo cáo');
  const date=today();pane.innerHTML='<div class="sg-report-pane"><h1>Báo cáo</h1><p class="sg-report-muted">Chọn nội dung và cột cần xuất. Chỉ quản lý toàn bộ trung tâm được sử dụng.</p><div class="sg-report-templates"><button type="button" data-report-type="cases" aria-pressed="true"><strong>Chi tiết hồ sơ</strong><span>Từng lượt tiếp nhận, ngày xử lý và thông tin được chọn.</span></button><button type="button" data-report-type="centers" aria-pressed="false"><strong>Tổng hợp trung tâm</strong><span>Tiếp nhận, xử lý, tồn và SLA theo kỳ.</span></button></div><input type="hidden" name="type" value="cases"><div class="sg-report-grid"><label>Từ ngày<input name="start" type="date" min="2024-01-01" max="'+date+'" value="'+date.slice(0,8)+'01"></label><label>Đến ngày<input name="end" type="date" min="2024-01-01" max="'+date+'" value="'+date+'"></label></div><fieldset><legend>Trung tâm</legend><div class="sg-report-checks" data-centers></div><small>Không chọn trung tâm cụ thể: lấy tất cả, gồm hồ sơ chưa xác định trung tâm.</small></fieldset><div data-detail-options class="sg-report-grid"><label>Loại ngày<select name="dateBasis">'+Object.entries(basisLabels).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label><label>Trạng thái<select name="status"></select></label><label>Bảo hành<select name="warrantyStatus"></select></label><label>Loại thiết bị<select name="deviceType"></select></label><label class="sg-report-wide">Model, S/N hoặc mã hồ sơ<input name="query" maxlength="100" placeholder="Nhập từ khóa nếu cần"></label></div><p class="sg-report-muted" data-report-note></p><fieldset><legend>Các cột xuất Excel</legend><p class="sg-report-muted">Thông tin khách hàng và ghi chú nội bộ mặc định không chọn.</p><div class="sg-report-checks" data-columns></div></fieldset><div class="sg-report-actions"><button type="button" data-preview disabled>Xem trước</button><button type="button" data-export disabled>Xuất Excel</button><button type="button" data-cancel hidden>Hủy</button></div><div class="sg-report-status" data-report-status role="status" aria-live="polite"></div><progress data-progress hidden value="0" max="1"></progress><p data-report-count></p><div class="sg-report-table" data-report-table></div></div>';main.append(pane);
  pane.querySelectorAll('[data-report-type]').forEach(button=>button.addEventListener('click',()=>{q('[name=type]').value=button.dataset.reportType;columns();}));
  pane.addEventListener('change',invalidate);q('[name=query]').addEventListener('input',invalidate);q('[data-preview]').addEventListener('click',()=>run(false));q('[data-export]').addEventListener('click',()=>run(true));q('[data-cancel]').addEventListener('click',cancel);
  root.addEventListener('click',event=>{if(event.target.closest('button[data-page],button[data-portal-view]'))close();});
 }
 async function open(){
  if(config?.actor?.isGlobalManager!==true||busy)return;install();main.classList.remove('sg-portal-mode');main.classList.add('sg-reports-mode');main.dataset.reportMode='true';pane.hidden=false;navButton.dataset.active='true';root.querySelector('#sg-crumb').textContent='Báo cáo';
  if(!config.available){status('Cần cập nhật Apps Script 1.10.19 và ReportExport.gs để sử dụng Báo cáo.',true);return}
  if(schema)return;const generation=epoch,operation=new AbortController();controller=operation;setBusy(true);status('Đang tải mẫu báo cáo…');
  try{const data=await config.request('getReportBootstrap',{},controller.signal);valid(generation);schema=data;
   q('[data-centers]').innerHTML=data.centers.map(name=>'<label><input type="checkbox" data-center value="'+esc(name)+'"> '+esc(name)+'</label>').join('');
   for(const [field,list] of [['status',data.statuses],['warrantyStatus',data.warrantyStatuses],['deviceType',data.deviceTypes]])q('[name='+field+']').innerHTML='<option value="">Tất cả</option>'+list.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');
   columns();status('Chọn bộ lọc và các cột, sau đó xem trước hoặc xuất Excel.');
  }catch(error){if(generation===epoch)status(error.message,true)}finally{if(generation===epoch)setBusy(false);if(controller===operation)controller=null;}
 }
 function close(){if(!pane)return;cancel();main.classList.remove('sg-reports-mode');main.dataset.reportMode='false';pane.hidden=true;navButton.dataset.active='false';}
 function configure(value){cancel();epoch++;config=value;schema=null;preview=null;install();setBusy(false);navButton.hidden=value?.actor?.isGlobalManager!==true;navButton.classList.toggle('sg-role-hidden',navButton.hidden);q('[name=query]').value='';q('[data-report-table]').innerHTML='';q('[data-report-count]').textContent='';q('[data-columns]').innerHTML='';q('[data-centers]').innerHTML='';status('');q('[data-progress]').hidden=true;q('[data-preview]').disabled=true;q('[data-export]').disabled=true;close();}
 window.SungrowReports={configure,close,isOpen:()=>!!main?.classList.contains('sg-reports-mode'),refresh:()=>run(false)};
})();
