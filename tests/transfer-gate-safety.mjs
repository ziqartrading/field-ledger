import fs from 'node:fs';
import path from 'node:path';

const publicRoot = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(publicRoot, 'docs', 'index.html'), 'utf8');
const backendPath = path.resolve(publicRoot, '..', 'PRIVATE_GOOGLE_BACKEND', 'Code.gs');
const backend = fs.existsSync(backendPath) ? fs.readFileSync(backendPath, 'utf8') : '';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const clientSet = app.match(/const FL_GOOGLE_DATA_ACTIONS_V365=new Set\(\[([^\]]+)\]\)/);
check(clientSet, 'Client transfer-action gate was not found.');
const clientActions = clientSet ? [...clientSet[1].matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
for (const action of ['pullManifest', 'pullChunk', 'pushStart', 'pushChunk', 'pushCommit']) {
  check(clientActions.includes(action), `Client does not gate business transfer action ${action}.`);
}
for (const action of ['listUsers', 'listActivity', 'setUserSyncPolicy', 'createUser', 'changePassword']) {
  check(!clientActions.includes(action), `Client incorrectly blocks connected account action ${action}.`);
}

if (backend) {
  const serverSet = backend.match(/function flIsBusinessSyncAction_\(action\)\{return \[([^\]]+)\]/);
  check(serverSet, 'Backend business-transfer gate was not found.');
  const serverActions = serverSet ? [...serverSet[1].matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
  for (const action of ['pullManifest', 'pullChunk', 'pushStart', 'pushChunk', 'pushCommit']) {
    check(serverActions.includes(action), `Backend does not gate business transfer action ${action}.`);
  }
  for (const action of ['listUsers', 'listActivity', 'setUserSyncPolicy', 'createBackup', 'rebuildMonthly']) {
    check(!serverActions.includes(action), `Backend incorrectly blocks connected administration action ${action}.`);
  }
  check(/if\(action==='setUserSyncPolicy'\)return/.test(backend), 'Admin transfer-policy endpoint is missing.');
  check(backend.indexOf("if(action==='setUserSyncPolicy')return") < backend.indexOf("if(flIsBusinessSyncAction_(action)"), 'Admin policy endpoint is evaluated after the transfer gate.');
}
check(/style\.setProperty\('left',[^;]+,'important'\)/.test(app), 'User menu left coordinate is not protected against legacy inset CSS.');
check(/style\.setProperty\('top',[^;]+,'important'\)/.test(app), 'User menu top coordinate is not protected against legacy inset CSS.');

if (failures.length) {
  console.error(JSON.stringify({ passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  backendAlwaysAvailable: ['login', 'listUsers', 'listActivity', 'setUserSyncPolicy'],
  controlledTransfer: ['pullManifest', 'pullChunk', 'pushStart', 'pushChunk', 'pushCommit'],
  menuCoordinatesProtected: true,
}, null, 2));
