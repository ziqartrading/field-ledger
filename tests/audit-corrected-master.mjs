import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';

const masterPath = process.argv[2];
if (!masterPath) throw new Error('Usage: node tests/audit-corrected-master.mjs /absolute/path/to/corrected-master.json');
const backendPath = path.resolve('../PRIVATE_GOOGLE_BACKEND/Code.gs');
const source = fs.readFileSync(backendPath, 'utf8');
let uuidCounter = 0;
const context = vm.createContext({
  console,
  Utilities: {
    getUuid: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
    formatDate: date => new Date(date).toISOString(),
    computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
  },
  Session: { getScriptTimeZone: () => 'Etc/UTC' },
  MimeType: { PLAIN_TEXT: 'text/plain' },
});
vm.runInContext(`${source}\n;globalThis.__audit={flMigrateSnapshot_,flSnapshotDuplicateErrors_,flRecordCount_,flImageCount_};`, context, { filename: backendPath });
const { flMigrateSnapshot_, flSnapshotDuplicateErrors_, flRecordCount_, flImageCount_ } = context.__audit;

const file = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const snapshot = file?.payload?.state || file?.payload?.snapshot || file?.state || file?.snapshot || file;
if (!snapshot || snapshot.app !== 'Field Ledger' || !snapshot.data) throw new Error('Corrected master does not contain a Field Ledger state.');

const beforeRecords = flRecordCount_(snapshot.data);
const beforeImages = flImageCount_(snapshot.data);
const migrated = flMigrateSnapshot_(snapshot);
const afterRecords = flRecordCount_(migrated.data);
const afterImages = flImageCount_(migrated.data);
const duplicates = flSnapshotDuplicateErrors_(migrated);
if (beforeRecords !== afterRecords) throw new Error(`Migration changed record count: ${beforeRecords} -> ${afterRecords}`);
if (beforeImages !== afterImages) throw new Error(`Migration changed embedded image count: ${beforeImages} -> ${afterImages}`);
if (duplicates.length) throw new Error(`Migration left duplicate identities: ${duplicates.slice(0, 10).join('; ')}`);

const sectionCounts = Object.fromEntries(Object.entries(migrated.data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
const bookDetails = ['AMANAT_BOOKS', 'HISAB_BOOKS'].map(section => ({
  section,
  books: migrated.data[section].length,
  pages: migrated.data[section].reduce((sum, book) => sum + (book.pages || []).length, 0),
  sheets: migrated.data[section].reduce((sum, book) => sum + (book.pages || []).reduce((pageSum, page) => pageSum + (page.sheets || []).length, 0), 0),
  transactions: migrated.data[section].reduce((sum, book) => sum + (book.pages || []).reduce((pageSum, page) => pageSum + (page.sheets || []).reduce((sheetSum, sheet) => sheetSum + (sheet.txns || []).length, 0), 0), 0),
}));

console.log(JSON.stringify({
  passed: true,
  sourceBytes: fs.statSync(masterPath).size,
  sourceSchema: snapshot.schemaVersion,
  migratedSchema: migrated.schemaVersion,
  records: afterRecords,
  embeddedImages: afterImages,
  duplicateIdentityErrors: duplicates.length,
  sectionCounts,
  bookDetails,
}, null, 2));
