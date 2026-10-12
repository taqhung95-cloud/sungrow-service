// The parent passes only a case ID; getCaseDetail rechecks scope on the server.
window.addEventListener('message',event=>{
 if(!EMBEDDED||event.origin!==location.origin||event.source!==parent||event.data?.type!=='sungrow-portal-notification-case'||!state.actor)return;
 const caseId=event.data.caseId;
 if(typeof caseId==='string'&&caseId&&caseId.length<=200)openCaseDrawer(JSON.stringify({caseId}));
});
