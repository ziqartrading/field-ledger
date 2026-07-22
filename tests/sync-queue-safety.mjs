import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';

const backendPath = path.resolve('../PRIVATE_GOOGLE_BACKEND/Code.gs');
const source = fs.readFileSync(backendPath, 'utf8');
let uuidCounter = 0;
const context = vm.createContext({
  console,
  Utilities: {
    getUuid: () => `queue-${++uuidCounter}`,
    formatDate: date => new Date(date).toISOString(),
    computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
  },
  Session: { getScriptTimeZone: () => 'Etc/UTC' },
});
vm.runInContext(source, context, { filename: backendPath });
vm.runInContext(`
  globalThis.__queueRows=[];
  globalThis.__users=[
    {UserId:'u1',Username:'first',Active:true,GoogleSyncAllowed:true},
    {UserId:'u2',Username:'second',Active:true,GoogleSyncAllowed:true},
    {UserId:'u3',Username:'third',Active:true,GoogleSyncAllowed:true}
  ];
  globalThis.__props={};
  flProps_=function(){return{
    getProperty:function(key){return Object.prototype.hasOwnProperty.call(__props,key)?__props[key]:null;},
    setProperty:function(key,value){__props[key]=String(value);},
    deleteProperty:function(key){delete __props[key];}
  };};
  flRows_=function(name){if(name==='SyncQueue')return __queueRows.map(function(row){return Object.assign({},row);});if(name==='Users')return __users.map(function(row){return Object.assign({},row);});return[];};
  flAppend_=function(name,row){if(name==='SyncQueue'){__queueRows.push(Object.assign({},row));return __queueRows.length+1;}throw new Error('Unexpected append '+name);};
  flSyncQueueUpdate_=function(requestId,updates){var row=__queueRows.find(function(item){return String(item.RequestId)===String(requestId);});if(!row)return null;Object.assign(row,updates||{});return Object.assign({},row);};
  flFindUserById_=function(id){return __users.find(function(user){return String(user.UserId)===String(id);})||null;};
  globalThis.__queueApi={flJoinSyncQueue_,flRequireSyncTurn_,flReleaseSyncTurn_,flCancelUserSyncTurns_,flSyncQueuePublicStatus_,FL_PROP};
`, context);

const api = context.__queueApi;
const auth = (id, device) => ({ user: context.__users.find(user => user.UserId === id), session: { DeviceId: device } });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const first = api.flJoinSyncQueue_(auth('u1', 'd1'), { deviceId: 'd1' });
assert(first.granted === true, 'first requester did not receive the active turn');
const second = api.flJoinSyncQueue_(auth('u2', 'd2'), { deviceId: 'd2' });
assert(second.granted === false && second.position === 1, `second requester position was ${second.position}`);
let fenced = false;
try { api.flRequireSyncTurn_(auth('u2', 'd2'), { deviceId: 'd2' }); } catch (error) { fenced = error.code === 'SYNC_QUEUED'; }
assert(fenced, 'queued requester reached a protected data action');

api.flReleaseSyncTurn_(auth('u1', 'd1'), { deviceId: 'd1' }, 'completed test cycle');
const secondGranted = api.flSyncQueuePublicStatus_(auth('u2', 'd2').user, 'd2');
assert(secondGranted.granted === true, 'second requester was not granted immediately after first release');
api.flRequireSyncTurn_(auth('u2', 'd2'), { deviceId: 'd2' });

const third = api.flJoinSyncQueue_(auth('u3', 'd3'), { deviceId: 'd3' });
assert(third.position === 1, `third requester position was ${third.position}`);
api.flCancelUserSyncTurns_('u2', 'disabled by administrator');
const thirdGranted = api.flSyncQueuePublicStatus_(auth('u3', 'd3').user, 'd3');
assert(thirdGranted.granted === true, 'admin cancellation did not advance the FIFO queue');

const activeKey = api.FL_PROP.ACTIVE_SYNC_TURN;
const active = JSON.parse(context.__props[activeKey]);
active.expiresAt = Date.now() - 1;
context.__props[activeKey] = JSON.stringify(active);
const firstAgain = api.flJoinSyncQueue_(auth('u1', 'd4'), { deviceId: 'd4' });
assert(firstAgain.granted === true, 'expired dead-device turn did not advance safely');
assert(context.__queueRows.some(row => row.UserId === 'u3' && row.Status === 'expired'), 'expired turn was not recorded');

console.log(JSON.stringify({
  passed: true,
  fifoOrder: ['u1', 'u2', 'u3', 'u1'],
  queuedRequesterBlocked: fenced,
  adminDisableAdvancedQueue: thirdGranted.granted,
  expiredTurnAdvancedQueue: firstAgain.granted,
  rows: context.__queueRows.map(row => ({ userId: row.UserId, deviceId: row.DeviceId, status: row.Status })),
}, null, 2));
