import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docs = path.join(root, 'docs');
const expectedVersion = '3.7.0';
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
check(index.includes("versionAtLeast(r.backendVersion,'3.7.0')"), 'Required backend version is not aligned');
check(worker.includes(`const APP_VERSION='${expectedVersion}'`), 'Service-worker version is not aligned');
check(worker.includes(`const CACHE='fl-r-${expectedVersion}'`), 'Service-worker cache name is stale');
check(index.includes('activation-panel.js?v=370'), 'Activation panel cache-buster is stale');
check(manifest.name === 'Ziqar Trading' && manifest.display === 'standalone', 'PWA manifest is invalid');
check(worker.includes("cached=await cache.match('./index.html')") && worker.includes('return cached;'), 'Offline navigation is not cache-first');
check(worker.includes('FIELD_LEDGER_CAPABILITIES_RESPONSE') && worker.includes('foregroundUpload:true'), 'Worker upload handoff is missing');
check(worker.includes('@@ZIQAR_IMAGE_REF_SHA256:'), 'Sparse-image transport is missing');
check(index.includes('targetBytes=1200*1024') && index.includes('if(best)return{img:await blobToDataUrl(best.blob)'), 'Fast pre-save image compression is missing');
check(index.includes('compressed:false,fallback:true'), 'Lossless emergency image fallback is missing');
check(index.includes('scheduleLocalBackup=function(){return null;}'), 'Legacy automatic full-copy backup is still enabled');
check(!index.includes("if(BACKUP_SETTINGS.localEveryChange)await performBackup('local',{silent:true});"), 'Boot still duplicates the full local database');
check(index.includes("DB_NAME='FieldLedgerPWA',DB_VERSION=2") && index.includes('DATA_SCHEMA:11'), 'Existing IndexedDB identity or v3.7 schema is incorrect');
check(index.includes("accountId=uid('AC')") && index.includes('entityKey:accountId'), 'Collision-safe account identity is missing');
check(index.includes('flRemoteSafetyV370') && index.includes('REMOTE_DATA_SAFETY_BLOCK'), 'Destructive remote-pull guard is missing');
check(index.includes('flDuplicateEntityIdsV370') && index.includes('DUPLICATE_ENTITY_IDS'), 'Client duplicate-identity guard is missing');
check(index.includes('flWriteSdBackupV370') && index.includes('flWeeklySdCatchUpV370'), 'Weekly SD-card recovery is missing');
check(index.includes('includesEmbeddedImages:true') && index.includes('flWriteMediaFolderV370'), 'Complete embedded and separate-image backup is missing');
check(index.includes('id="umAccessibility"') && index.includes("FL_FONT_PREF_KEY_V365='ziqar-accessibility-font-size-v1'"), 'All-role accessibility entry or persistent preference is missing');
check(index.includes('small:.90,standard:1,large:1.14,xlarge:1.28') && index.includes('flApplyFontSizeV365'), 'App-wide font-size choices are incomplete');
check(index.includes('font-size:var(--fl-fs-14,14px)') && index.includes('font-size:clamp(var(--fl-fs-28,28px)'), 'Existing fixed and responsive text is not connected to the font preference');
check(index.includes('document.body.appendChild(menu)') && index.includes('window.visualViewport') && index.includes('flPositionUserMenuV365'), 'Viewport-safe tablet user menu is missing');
check(index.includes('.stage:has(.pagesheet.has-stack){padding-inline:86px!important}') && index.includes('@media(max-width:800px),(pointer:coarse)'), 'Symmetric responsive reader alignment is missing');
check(index.includes('id="umOfflineData"') && index.includes("FL_GOOGLE_SYNC_PREF_V365='google-data-sync-enabled-v1'"), 'All-role offline-data and Google-sync setting is missing');
check(index.includes('FL_GOOGLE_DATA_ACTIONS_V365') && index.includes('GOOGLE_DATA_SYNC_DISABLED') && index.includes('flGoogleDataSyncEnabledV365=false'), 'Google business-data transfer is not safely disabled by default');
check(index.includes('ziqar-offline-transfer-v1') && index.includes('flDownloadOfflineTransferV365') && index.includes('flImportOfflineFileV365') && index.includes('flShareOfflineTransferV365'), 'Offline download, import or device sharing is missing');
check(worker.includes("GOOGLE_DATA_SYNC:'google-data-sync-enabled-v1'") && worker.includes('if(!await googleDataSyncEnabled())return false'), 'Service worker can upload while Google sync is off');
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
