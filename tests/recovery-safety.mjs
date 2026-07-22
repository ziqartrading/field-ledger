import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const backendPath = path.resolve('../PRIVATE_GOOGLE_BACKEND/Code.gs');
const source = fs.readFileSync(backendPath, 'utf8');
let uuidCounter = 0;
const context = vm.createContext({
  console,
  Utilities: {
    getUuid: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
    formatDate: date => new Date(date).toISOString(),
    computeDigest: () => [],
    DigestAlgorithm: { SHA_256: 'SHA_256' },
  },
  Session: { getScriptTimeZone: () => 'Etc/UTC' },
  MimeType: { PLAIN_TEXT: 'text/plain' },
});
vm.runInContext(`${source}\n;globalThis.__safety={flMergeSnapshots_,flSnapshotDuplicateErrors_};`, context, { filename: backendPath });
const { flMergeSnapshots_, flSnapshotDuplicateErrors_ } = context.__safety;

const page = ({ id = 'AC18', entityKey, number, title, created, opening = 0 }) => ({
  id, ...(entityKey ? { entityKey } : {}), number, title, created, modified: created, opening,
  sheets: [{ id: `SH-${number}`, title, type: 'normal', created, modified: created, txns: [] }], notes: [], refs: [],
});
const state = (pages, counters = {}) => ({
  app: 'Field Ledger', schemaVersion: 11, savedAt: '2026-07-22T00:00:00Z', counters,
  data: { AMANAT_BOOKS: [{ id: 'BK013', entityKey: 'BK013', name: 'Amanat', created: '2026-01-01T00:00:00Z', pages }], HISAB_BOOKS: [], ACCOUNTS: [], LOGS: [], TRASH: [], HAWALAS: [], HAWALA_NOTES: [], HAWALA_CASH_SALES: [], SALES: [], PRODUCTS: [], NOTES: [] },
});

const original = page({ number: '1', title: 'Original account', created: '2026-07-20T00:00:00Z', opening: 2500 });
const collision = page({ number: '187', title: 'Different customer', created: '2026-07-22T14:37:40Z', opening: 4110 });
const mergedCollision = flMergeSnapshots_(state([original], { acSeq: 40 }), state([collision], { acSeq: 18 }));
const collisionPages = mergedCollision.data.AMANAT_BOOKS[0].pages;
if (collisionPages.length !== 2) throw new Error(`ID collision lost a page: expected 2, received ${collisionPages.length}`);
if (!collisionPages.some(row => row.title === 'Original account') || !collisionPages.some(row => row.title === 'Different customer')) throw new Error('ID collision did not preserve both logical accounts.');
if (new Set(collisionPages.map(row => row.id)).size !== 2) throw new Error('Recovered collision was not re-keyed.');
if (mergedCollision.counters.acSeq !== 40) throw new Error('A stale client regressed a monotonic counter.');

const serverUpdate = page({ id: 'AC-UUID-1', entityKey: 'AC-UUID-1', number: '1', title: 'Before edit', created: '2026-07-20T00:00:00Z', opening: 2500 });
const clientUpdate = page({ id: 'AC-UUID-1', entityKey: 'AC-UUID-1', number: '1', title: 'After edit', created: '2026-07-20T00:00:00Z', opening: 3000 });
clientUpdate.modified = '2026-07-22T15:00:00Z';
const mergedUpdate = flMergeSnapshots_(state([serverUpdate]), state([clientUpdate]));
if (mergedUpdate.data.AMANAT_BOOKS[0].pages.length !== 1) throw new Error('A legitimate same-identity edit was duplicated.');
if (mergedUpdate.data.AMANAT_BOOKS[0].pages[0].title !== 'After edit') throw new Error('A legitimate newer edit did not win.');

const duplicateState = state([original, structuredClone(original)]);
const duplicateErrors = flSnapshotDuplicateErrors_(duplicateState);
if (!duplicateErrors.some(message => message.includes('duplicate id AC18'))) throw new Error('Duplicate upload identities were not detected.');

const stressCount = 1000;
const stressServer = Array.from({ length: stressCount }, (_, index) => page({ id: `AC${index}`, number: String(index), title: `Server ${index}`, created: '2026-07-20T00:00:00Z' }));
const stressClient = Array.from({ length: stressCount }, (_, index) => page({ id: `AC${index}`, number: String(index + stressCount), title: `Client ${index}`, created: '2026-07-22T00:00:00Z' }));
const stressStart = Date.now();
const stressMerged = flMergeSnapshots_(state(stressServer), state(stressClient));
const stressMs = Date.now() - stressStart;
const stressPages = stressMerged.data.AMANAT_BOOKS[0].pages;
if (stressPages.length !== stressCount * 2) throw new Error(`Stress collision merge lost records: expected ${stressCount * 2}, received ${stressPages.length}`);
if (new Set(stressPages.map(row => row.id)).size !== stressCount * 2) throw new Error('Stress collision merge produced duplicate identities.');

console.log(JSON.stringify({
  passed: true,
  preservedCollisionRecords: collisionPages.length,
  distinctCollisionIds: new Set(collisionPages.map(row => row.id)).size,
  legitimateUpdateRecords: mergedUpdate.data.AMANAT_BOOKS[0].pages.length,
  monotonicCounter: mergedCollision.counters.acSeq,
  duplicateErrors: duplicateErrors.length,
  stressCollisionInputs: stressCount * 2,
  stressCollisionOutputs: stressPages.length,
  stressMergeMilliseconds: stressMs,
}, null, 2));
