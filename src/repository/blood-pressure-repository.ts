import { BaseRepository } from './base-repository.js';
import { db } from '../database/dexie-config.js';
import type { BloodPressureEntry } from '../types/database.js';

export class BloodPressureRepository extends BaseRepository<BloodPressureEntry> {
  constructor() {
    super(db.bloodPressureEntries);
  }

  async saveEntry(entry: BloodPressureEntry): Promise<void> {
    await this.save(entry);
  }

  async getEntries(): Promise<BloodPressureEntry[]> {
    return await this.getAll();
  }

  async deleteEntry(id: string): Promise<void> {
    await this.delete(id);
  }

  async updateEntry(entry: BloodPressureEntry): Promise<void> {
    await this.update(entry);
  }

  async getEntry(id: string): Promise<BloodPressureEntry | undefined> {
    return await this.getById(id);
  }

  async clearAllEntries(): Promise<void> {
    await this.clear();
  }

  async replaceAllEntries(entries: BloodPressureEntry[]): Promise<void> {
    await this.replaceAll(entries);
  }
}

export const bloodPressureRepository = new BloodPressureRepository();
