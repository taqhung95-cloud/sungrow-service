/* Tab-scoped sessions. No token in localStorage, cookies, query strings or logs. */
(() => {
 const isSession=token=>typeof token==='string'&&/^sgs1\.[A-Za-z0-9_-]{43}$/.test(token);
 async function adopt(credential,bootstrap,request){
  if(isSession(credential)||bootstrap.portalSessions!==true)return credential;
  if(!globalThis.crypto?.getRandomValues)throw new Error('Trình duyệt không hỗ trợ phiên đăng nhập an toàn.');
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const candidate='sgs1.'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  const result=await request('createPortalSession',[credential,{sessionToken:candidate}]);
  if(result?.token!==candidate||!Number.isFinite(result.expiresAt))throw new Error('Máy chủ chưa xác nhận phiên đăng nhập 8 giờ.');
  return result.token;
 }
 async function revoke(credential,request){if(isSession(credential))await request('revokePortalSession',[credential]);}
 window.SungrowSessionClient={adopt,revoke,isSession};
})();
