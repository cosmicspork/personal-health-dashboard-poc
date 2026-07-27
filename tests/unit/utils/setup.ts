import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '../../../src/database/dexie-config';

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
  },
});

// Reset persisted state before each test by clearing the shared Dexie
// connection's tables. The app opens a single long-lived Dexie instance, so
// the previous approach - deleting every IndexedDB database out from under
// that open connection, fire-and-forget without awaiting the promise - raced
// the tests' own setup and leaked state between them. fake-indexeddb 6.2.x
// tightened its semantics and surfaced that race as a flake. Clearing the
// open tables is deterministic and needs no reopen.
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
