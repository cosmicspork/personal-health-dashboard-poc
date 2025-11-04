import Dexie, { type EntityTable } from 'dexie';
import type {
  DatabaseMetadata,
  BloodPressureEntry,
  LogEntry,
  Settings,
} from '../types/database.js';
import { StoragePersistence } from '../services/storage-persistence.js';

export const DATABASE_NAME = 'BloodPressureDashboard';
export const CURRENT_SCHEMA_VERSION = 1;

export class BloodPressureDatabase extends Dexie {
  bloodPressureEntries!: EntityTable<BloodPressureEntry, 'id'>;
  logEntries!: EntityTable<LogEntry, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  metadata!: EntityTable<DatabaseMetadata, 'id'>;

  constructor() {
    super(DATABASE_NAME);

    // Version 1 (current schema)
    this.version(1).stores({
      bloodPressureEntries: 'id, date, updatedAt',
      logEntries: 'id, date, updatedAt',
      settings: 'id, key, updatedAt',
      metadata: 'id, schemaVersion, updatedAt',
    });

    // Request persistent storage when database is ready
    this.on('ready', () => {
      StoragePersistence.requestPersistent();
    });
  }
}

export const db = new BloodPressureDatabase();
