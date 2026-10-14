import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const backend = { console, Date };
vm.createContext(backend);
vm.runInContext(read('../Code.gs'), backend);
backend.authenticate_ = () => ({});
backend.getPortalDatabaseRevision_ = () => 'r1';
let details = 0, matches = [];
backend.listCasesUncached_ = (_, filters) => {
  assert.equal(filters.exactKey, true);
  return { items: matches, total: matches.length, totalPages: 1 };
};
backend.getCaseDetailForActor_ = (_, caseId) => { details++; return { caseId, workOrders: ['full'] }; };
matches = [{ caseId: 'HS1' }, { caseId: 'HS2' }];
assert.equal(backend.searchCases('t', 'SN1', { exactKey: true }).detailed, false);
assert.equal(details, 0, 'Duplicate S/N search must not hydrate any case');
matches = [{ caseId: 'HS1' }];
assert.equal(backend.searchCases('t', 'HS1', { exactKey: true }).detailed, true);
assert.equal(details, 1, 'Unique match hydrates once in same request');

const nodes = {};
function node() { return { innerHTML: '', children: [], dataset: {}, querySelectorAll() { return this.buttons || []; }, prepend(n) { this.children.unshift(n); }, append(n) { this.children.push(n); }, setAttribute() {}, remove() {} }; }
nodes.updateResults = node(); nodes.updateSearch = node();
let handler, calls = [];
const ui = {
  window: {}, state: { token: 't' }, document: { getElementById: id => nodes[id], createElement: node },
  busy: (btn, value) => { btn.disabled = value; }, esc: value => String(value), shortCenter: value => value,
  renderCase: item => 'FULL:' + item.caseId,
  call: async (name, args) => { calls.push([name, args]); return handler(name, args); }
};
vm.createContext(ui);
vm.runInContext(read('../../docs/exact-case-search.js'), ui);
handler = () => ({ items: [{ caseId: 'HS1', serialNumber: 'SN1' }], totalPages: 1, detailed: true });
await ui.window.SungrowExactSearch.search(' sn1 ', 'updateResults', 'update');
assert.equal(nodes.updateResults.innerHTML, 'FULL:HS1');
assert.equal(calls.length, 1, 'Unique exact lookup uses one request');
calls = [];
const btn = { ...node(), dataset: { caseId: 'HS2' } };
nodes.updateResults.buttons = [btn];
handler = name => name === 'getCaseDetail' ? { caseId: 'HS2' } : { items: [{ caseId: 'HS1', serialNumber: 'SN1' }, { caseId: 'HS2', serialNumber: 'SN1' }], totalPages: 1 };
await ui.window.SungrowExactSearch.search('SN1', 'updateResults', 'update');
assert.match(nodes.updateResults.innerHTML, /Chọn hồ sơ/);
assert.equal(calls.length, 1);
await btn.onclick();
assert.equal(calls[1][0], 'getCaseDetail');
assert.equal(nodes.updateResults.innerHTML, 'FULL:HS2');
nodes.updateResults.buttons = [];
let resolve;
handler = () => new Promise(r => { resolve = r; });
calls = [];
const pending = ui.window.SungrowExactSearch.search('SN1', 'updateResults', 'update');
await ui.window.SungrowExactSearch.search('SN1', 'updateResults', 'update');
assert.equal(calls.length, 1, 'Repeated search must not issue duplicate requests');
await ui.window.SungrowExactSearch.search('', 'updateResults', 'update');
resolve({ items: [{ caseId: 'HS1', serialNumber: 'SN1' }], detailed: true });
await pending;
assert.match(nodes.updateResults.innerHTML, /Nhập đầy đủ/);
handler = () => { throw Error('Mất kết nối'); };
await ui.window.SungrowExactSearch.search('SN1', 'updateResults', 'update');
assert.match(nodes.updateResults.innerHTML, /Mất kết nối/);
assert.equal(nodes.updateSearch.disabled, false);
// Legacy deployment: search cap cannot hide a match on a later index page.
calls = [];
handler = (name, args) => name === 'searchCases' ? [] : name === 'getCaseDetail' ? { caseId: 'HS3' } :
  { items: args[1].page === 1 ? [{ caseId: 'WRONG', serialNumber: 'SN10' }] : [{ caseId: 'HS3', serialNumber: 'SN1' }], totalPages: 2 };
await ui.window.SungrowExactSearch.search('SN1', 'updateResults', 'update');
assert.equal(nodes.updateResults.innerHTML, 'FULL:HS3');
assert.equal(calls.filter(([name]) => name === 'listCases').length, 2);
// Actual filtering retains all duplicate intakes, excludes partial/model hits and canceled cases.
const filter = { console, Date, Session: { getScriptTimeZone: () => 'UTC' } };
vm.createContext(filter); vm.runInContext(read('../Code.gs'), filter);
filter.assertCapability_ = () => {};
filter.canSeeIndexedCase_ = (_, item) => item.visible !== false;
filter.portalReceiptSortKey_ = () => 1;
filter.publicIndexedCase_ = (_, item) => ({ caseId: item['Mã hồ sơ'] });
filter.readPortalCaseIndex_ = () => [
  { 'Mã hồ sơ': 'HS1', 'Số sê-ri (S/N)': 'SN1', 'Tìm kiếm': 'HS1 SN1' },
  { 'Mã hồ sơ': 'HS2', 'Số sê-ri (S/N)': 'sn1', 'Tìm kiếm': 'HS2 SN1' },
  { 'Mã hồ sơ': 'HS3', 'Số sê-ri (S/N)': 'SN10', 'Tìm kiếm': 'HS3 SN10 SN1' },
  { 'Mã hồ sơ': 'HS4', 'Số sê-ri (S/N)': 'SN1', 'Trạng thái hồ sơ': 'Đã hủy' },
  { 'Mã hồ sơ': 'HS5', 'Số sê-ri (S/N)': 'SN1', visible: false }
];
assert.equal(filter.listCasesUncached_('', { query: 'SN1', exactKey: true }, {}, 'r1').total, 2);
assert.equal(filter.listCasesUncached_('', { query: 'hs2', exactKey: true }, {}, 'r1').total, 1);
const html = read('../../docs/entry.html');
assert.match(html, /\['Mã hồ sơ',item.caseId,true\]/);
assert.doesNotMatch(html, /Mã hồ sơ: \$\{esc\(item.caseId/);
console.log('Exact lookup: one-call unique match, duplicate selection, full index compatibility, permissions, race/retry and case ID display passed.');
