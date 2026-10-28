import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = {Date, console, Session:{getScriptTimeZone:()=> 'Asia/Saigon'},
  Utilities:{formatDate:date=>date.toISOString().slice(0,10)}};
vm.createContext(context);
const source = fs.readFileSync(new URL('../LegacyDashboardApi.gs', import.meta.url), 'utf8');
vm.runInContext(source.replace(
  'return { handlePost: doPost, readDiagnostics: diagnoseReadPaths_, slaDays: slaDays_ };',
  'return {publicTicket_,groupConfirmedIssueCategories_};'
), context);
const api = vm.runInContext('LEGACY_DASHBOARD_API', context);
const record = {
  id:'lot', deviceType:'Fan', receivedDate:new Date('2026-10-15'),
  deliveryStatus:'Chưa giao máy', parts:[],
  issues:['Fan failure', ' Fan   failure ', 'FAN FAILURE', 'Hỏng Relay AC', 'IGBT, AC board', ''],
  fanLot:{totals:{received:5}, lines:[{lineId:'A',quantity:2},{lineId:'B',quantity:3}]},
  fanIssues:[{name:'Fan failure',lineId:'A',quantity:2},{name:'Fan failure',lineId:'B',quantity:3}]
};
const before = JSON.stringify(record);
assert.equal(api.publicTicket_(record).error, 'Fan failure, Hỏng Relay AC, IGBT, AC board');
assert.equal(api.groupConfirmedIssueCategories_([record])[0].count, 5,
  'One displayed fault must still count all five affected Fan across two inverter lines.');
assert.equal(JSON.stringify(record), before, 'Formatting must not mutate canonical history or quantities.');
assert.equal(api.publicTicket_({...record, issues:['Fan failure','Fan failure']}).error, 'Fan failure');
assert.equal(api.publicTicket_({...record, issues:[],errorCode:'70'}).error, '70');
assert.equal(api.publicTicket_({...record, issues:[]}).error, 'Chưa ghi nhận');
assert.equal(api.publicTicket_({...record, fanLot:null,deviceType:'Inverter'}).error,
  'Fan failure, Hỏng Relay AC, IGBT, AC board');
console.log('Dashboard fault labels: unique per case, distinct/comma-containing names preserved, Fan quantities/history unchanged.');
