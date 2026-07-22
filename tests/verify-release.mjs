import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docs = path.join(root, 'docs');
const expectedVersion = '3.6.4';
const required = [
  'docs/index.html',
  'docs/r.js',
  'docs/activation-panel.js',
  'docs/manifest.webmanifest',
  'docs/icons/192.png',
  'docs/icons/512.png',
  'docs/icons/ziqar-logo.svg',
];

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
for (const file of required) check(fs.existsSync(path.join(root, file)), `Missing ${file}`);

const index = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(docs, 'r.js'), 'utf8');
const activation = fs.readFileSync(path.join(docs, 'activation-panel.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(docs, 'manifest.webmanifest'), 'utf8'));

check(index.includes(`const FIELD_LEDGER_VERSION='${expectedVersion}'`), 'HTML app version is not aligned');
check(index.includes(`APP_VERSION:'${expectedVersion}'`), 'Runtime app version is not aligned');
check(index.includes("versionAtLeast(r.backendVersion,'3.6.4')"), 'Required backend version is not aligned');
check(worker.includes(`const APP_VERSION='${expectedVersion}'`), 'Service-worker version is not aligned');
check(worker.includes(`const CACHE='fl-r-${expectedVersion}'`), 'Service-worker cache name is stale');
check(index.includes('activation-panel.js?v=364'), 'Activation panel cache-buster is stale');
check(manifest.name === 'Ziqar Trading' && manifest.display === 'standalone', 'PWA manifest is invalid');
check(worker.includes("cached=await cache.match('./index.html')") && worker.includes('return cached;'), 'Offline navigation is not cache-first');
check(worker.includes('FIELD_LEDGER_CAPABILITIES_RESPONSE') && worker.includes('foregroundUpload:true'), 'Worker upload handoff is missing');
check(worker.includes('@@ZIQAR_IMAGE_REF_SHA256:'), 'Sparse-image transport is missing');
check(index.includes('targetBytes=1200*1024') && index.includes('if(best)return{img:await blobToDataUrl(best.blob)'), 'Fast pre-save image compression is missing');
check(index.includes('compressed:false,fallback:true'), 'Lossless emergency image fallback is missing');
check(index.includes('scheduleLocalBackup=function(){return null;}'), 'Legacy automatic full-copy backup is still enabled');
check(!index.includes("if(BACKUP_SETTINGS.localEveryChange)await performBackup('local',{silent:true});"), 'Boot still duplicates the full local database');
check(index.includes("DB_NAME='FieldLedgerPWA',DB_VERSION=2") && index.includes('DATA_SCHEMA:10'), 'Existing IndexedDB/schema identity changed');
check(!index.includes('CHANGE_THIS_TO_A_STRONG_PASSWORD'), 'Private backend setup secret leaked into the public client');
check(!activation.includes('CHANGE_THIS_TO_A_STRONG_PASSWORD'), 'Private backend setup secret leaked into activation code');

const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
for (let i = 0; i < inlineScripts.length; i += 1) {
  try { new Function(inlineScripts[i]); } catch (error) { failures.push(`Inline script ${i + 1} does not compile: ${error.message}`); }
}
try { new Function(activation); } catch (error) { failures.push(`activation-panel.js does not compile: ${error.message}`); }

if (failures.length) {
  console.error(`Ziqar Trading ${expectedVersion} verification failed:`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Ziqar Trading ${expectedVersion} release verification passed (${required.length} required files, ${inlineScripts.length} inline scripts).`);
