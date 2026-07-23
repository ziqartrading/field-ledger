import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'docs', 'r.js'), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(index.includes("content=\"3.8.3\""), 'HTML release metadata is not v3.8.3');
check(index.includes("APP_VERSION:'3.8.3'"), 'Runtime version is not v3.8.3');
check(worker.includes("const CACHE='fl-r-3.8.3'"), 'Service-worker cache was not advanced');
check(worker.includes("const APP_VERSION='3.8.3'"), 'Service-worker version was not advanced');
check(index.includes("BACKEND_URL:'https://script.google.com/macros/s/AKfycbxoPLCDiuS5I2LLHiCU5iyKMFl1nPFDcllMihuMg5y6U3g7IJSGH1G_YbK6d7t-Sxo/exec'"), 'Working Apps Script endpoint was not preserved');

check(index.includes("/* ===== v3.8.3: one role-aware Storage & Sync center ===== */"), 'Unified center is missing');
check(index.includes("#umOfflineData,#backupSection,#flSyncSection,#flTabletSection{display:none!important}"), 'Redundant legacy entries and panels are not suppressed');
check(index.includes("flRenderOfflineDataV365=flRenderUnifiedStorageV383"), 'Unified renderer is not installed');
check(index.includes("button.textContent=LANG==='ps'?'ذخیره او د معلوماتو لېږد':'Storage & Sync'"), 'Single menu label is missing');
check(index.includes("if(!['admin','editor'].includes(role))return"), 'Viewer role is not blocked from the storage center');

check(index.includes("if(!admin){") && index.includes("[data-fl-offline-import],[data-fl-offline-file],[data-fl-recovery-restore]"), 'Editor recovery restrictions are missing');
check(index.includes("cloud.dataset.flUnifiedAdmin='1'"), 'Administrator-only cloud section is missing');
check(index.includes("data-fl-authoritative-restore"), 'Administrator Google-master recovery was removed');
check(index.includes("data-fl-adopt-google"), 'Protected device adoption was removed');
check(index.includes("data-fl-unified-transfer"), 'Business-data transfer action is missing');
check(index.includes("data-fl-unified-folder"), 'Local-folder controls are missing');
check(index.includes("data-fl-sd-now"), 'Weekly SD backup controls are missing');
check(index.includes("Login, Manage users, permissions, activity and connection testing remain available."), 'Always-on backend explanation is missing');

check(index.includes("const FIELD_LEDGER_SCHEMA=12") || index.includes("FIELD_LEDGER_SCHEMA=12"), 'Data schema changed unexpectedly');
check(index.includes("FieldLedgerPWA"), 'Existing IndexedDB identity changed');
check(index.includes("google-data-sync-enabled-v1"), 'Existing device transfer preference key changed');

if (failures.length) {
  console.error('Unified Storage & Sync verification failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  version: '3.8.3',
  oneMenuEntry: true,
  legacyAdminPanelsHidden: true,
  editorControls: ['local storage', 'download/share', 'folder', 'transfer', 'SD backup', 'device adoption'],
  adminOnlyControls: ['import', 'local restore', 'Google master', 'cloud backup', 'chunk cleanup', 'monthly rebuild'],
  schemaPreserved: 12,
  indexedDbPreserved: true
}, null, 2));
