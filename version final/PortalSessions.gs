// Eight-hour absolute sessions. Tokens never go into Sheets, audit logs or URLs.
const PORTAL_SESSION_PREFIX_ = 'PORTAL_SESSION_V1_';
const PORTAL_SESSION_MS_ = 8 * 60 * 60 * 1000;
function portalSessionKey_(token) {
  if (typeof token !== 'string' || !/^sgs1\.[A-Za-z0-9_-]{43}$/.test(token)) throw publicError_('Phiên đăng nhập không hợp lệ.');
  return PORTAL_SESSION_PREFIX_ + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).replace(/=+$/g, '');
}
function createPortalSession(googleIdToken, payload) {
  // Only a currently valid Google credential can create a session, never an existing session.
  if (typeof googleIdToken !== 'string' || googleIdToken.indexOf('sgs1.') === 0) throw publicError_('Cần đăng nhập Google để tạo phiên mới.');
  const actor = authenticateUncached_(googleIdToken);
  const token = payload && payload.sessionToken;
  const key = portalSessionKey_(token), properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();lock.waitLock(10000);
  try {
    const now = Date.now(), existing = parseJson_(properties.getProperty(key));
    if (existing) {
      if (existing.revokedAt || existing.sub !== actor.googleSub || existing.email !== actor.email || existing.expiresAt <= now) throw publicError_('Phiên đăng nhập không hợp lệ. Vui lòng thử lại.');
      return {token:token, expiresAt:existing.expiresAt, sessionHours:8}; // Idempotent retry, no extension.
    }
    const all = properties.getProperties();let active = 0;
    Object.keys(all).filter(function(k){return k.indexOf(PORTAL_SESSION_PREFIX_) === 0;}).forEach(function(k){
      const record = parseJson_(all[k]);
      if (!record || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) properties.deleteProperty(k);
      else active++;
    });
    if (active >= 1000) throw publicError_('Không thể tạo thêm phiên đăng nhập lúc này. Vui lòng liên hệ quản lý.');
    const expiresAt = now + PORTAL_SESSION_MS_;
    properties.setProperty(key, JSON.stringify({sub:actor.googleSub,email:actor.email,createdAt:now,expiresAt:expiresAt}));
    return {token:token,expiresAt:expiresAt,sessionHours:8};
  } finally {lock.releaseLock();}
}
function authenticatePortalSession_(token) {
  const key = portalSessionKey_(token), record = parseJson_(PropertiesService.getScriptProperties().getProperty(key));
  if (!record || record.revokedAt || !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now() || !record.sub || !record.email) throw publicError_('Phiên đăng nhập đã hết hạn hoặc đã được đăng xuất.');
  // Re-read current access; no cached actor can bypass account disabling or changed roles.
  return portalActorFromIdentity_({sub:record.sub,email:record.email}, false);
}
function revokePortalSession(token) {
  const key = portalSessionKey_(token), lock = LockService.getScriptLock();lock.waitLock(10000);
  try {const properties=PropertiesService.getScriptProperties(),record=parseJson_(properties.getProperty(key));if(record&&!record.revokedAt){record.revokedAt=Date.now();properties.setProperty(key,JSON.stringify(record));}return {ok:true};}
  finally {lock.releaseLock();}
}
