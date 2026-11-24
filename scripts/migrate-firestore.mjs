// One-off script to copy known VinoLedger collections from the old Firebase
// project into the new one. Run with: node scripts/migrate-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const sourceConfig = {
  apiKey: 'AIzaSyAqpp6peQJKAVJ7r7XQHgGa0cEQRs5Z_UI',
  authDomain: 'vino-ledger-ff60f.firebaseapp.com',
  projectId: 'vino-ledger-ff60f',
  storageBucket: 'vino-ledger-ff60f.firebasestorage.app',
  messagingSenderId: '976076278871',
  appId: '1:976076278871:web:3f3533b6086c7031cf6712',
};

const destConfig = {
  apiKey: 'AIzaSyA0r3EDt5MgswD4rkQeUqs4-jIaR0f8O9M',
  authDomain: 'vino-ledger-prod.firebaseapp.com',
  projectId: 'vino-ledger-prod',
  storageBucket: 'vino-ledger-prod.firebasestorage.app',
  messagingSenderId: '23684132093',
  appId: '1:23684132093:web:5835c9692862d359e22294',
};

const COLLECTIONS = [
  'shops',
  'users',
  'sales',
  'invoices',
  'expenses',
  'daySheets',
  'inventory',
  'openingStock',
  'mrpCatalog',
  'mrpCatalogOverrides',
  'partnerManagement',
];

const sourceDb = getFirestore(initializeApp(sourceConfig, 'source'));
const destDb = getFirestore(initializeApp(destConfig, 'dest'));

async function migrateCollection(name) {
  const snapshot = await getDocs(collection(sourceDb, name));
  let copied = 0;
  let failed = 0;

  for (const docSnap of snapshot.docs) {
    try {
      await setDoc(doc(destDb, name, docSnap.id), docSnap.data());
      copied++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${name}/${docSnap.id}: ${err.message}`);
    }
  }

  return { name, total: snapshot.size, copied, failed };
}

async function main() {
  const results = [];
  for (const name of COLLECTIONS) {
    console.log(`Migrating "${name}"...`);
    const result = await migrateCollection(name);
    console.log(`  -> ${result.copied}/${result.total} documents copied${result.failed ? `, ${result.failed} failed` : ''}`);
    results.push(result);
  }

  console.log('\n--- Migration summary ---');
  for (const r of results) {
    console.log(`${r.name}: ${r.copied}/${r.total} copied${r.failed ? `, ${r.failed} FAILED` : ''}`);
  }

  const anyFailed = results.some((r) => r.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration aborted:', err);
  process.exit(1);
});
