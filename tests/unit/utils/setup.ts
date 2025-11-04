import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
  },
});

// Reset IndexedDB before each test
beforeEach(() => {
  // Clear all databases
  indexedDB.databases().then((databases) => {
    databases.forEach((db) => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  });
});
