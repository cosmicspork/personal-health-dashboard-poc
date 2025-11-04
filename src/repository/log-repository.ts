import { BaseRepository } from './base-repository.js';
import { db } from '../database/dexie-config.js';
import type { LogEntry } from '../types/database.js';

export class LogRepository extends BaseRepository<LogEntry> {
  constructor() {
    super(db.logEntries);
  }

  async saveEntry(entry: LogEntry): Promise<void> {
    await this.save(entry);
  }

  async getEntries(): Promise<LogEntry[]> {
    return await this.getAll();
  }

  async deleteEntry(id: string): Promise<void> {
    await this.delete(id);
  }

  async updateEntry(entry: LogEntry): Promise<void> {
    await this.update(entry);
  }

  async getEntry(id: string): Promise<LogEntry | undefined> {
    return await this.getById(id);
  }

  async clearAllEntries(): Promise<void> {
    await this.clear();
  }

  async replaceAllEntries(entries: LogEntry[]): Promise<void> {
    await this.replaceAll(entries);
  }
}

export const logRepository = new LogRepository();
