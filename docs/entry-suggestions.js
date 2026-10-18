/* One lazy, revision-cached catalog read for all normal work forms. No calls per keystroke. */
window.SungrowEntrySuggestions=(()=>{
  let data={issues:SungrowIssueCatalog.names([]),parts:[]},loading=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    for(const [id,items] of [['entry-issue-options',data.issues.map(name=>({value:name,label:''}))],['entry-part-options',data.parts.map(p=>({value:p.partNumber,label:p.name}))]]){
      let list=document.getElementById(id);if(!list){list=document.createElement('datalist');list.id=id;document.body.append(list);}list.innerHTML=items.map(x=>'<option value="'+esc(x.value)+'">'+esc(x.label)+'</option>').join('');
    }
  }
  function merge(incoming){data.issues=SungrowIssueCatalog.names(data.issues.concat(incoming.issues||[]));const parts=new Map(data.parts.map(p=>[p.partNumber.toUpperCase(),p]));for(const p of incoming.parts||[]){const pn=String(p.partNumber||'').trim();if(pn){const old=parts.get(pn.toUpperCase());parts.set(pn.toUpperCase(),{partNumber:pn,name:String(p.name||old?.name||'').trim()});}}data.parts=[...parts.values()].sort((a,b)=>a.partNumber.localeCompare(b.partNumber));render();}
  async function load(){if(!state.entrySuggestions)return;if(!loading)loading=call('getEntrySuggestions',[state.token]).then(merge).catch(()=>{loading=null;});await loading;}
  function attach(form){
    render();load();if(form.dataset.suggestions)return;form.dataset.suggestions='true';
    form.addEventListener('focusin',()=>{if(!loading)load();});
    form.addEventListener('change',e=>{const row=e.target.closest('.parts .repeat-row');if(!row||e.target!==row.children[0]||e.target.readOnly)return;const part=data.parts.find(p=>p.partNumber.toUpperCase()===e.target.value.trim().toUpperCase());if(part){e.target.value=part.partNumber;if(!row.children[1].value.trim())row.children[1].value=part.name;}});
  }
  function remember(payload){merge({issues:(payload.issues||[]).map(i=>i.name),parts:payload.parts||[]});}
  return {attach,remember};
})();
