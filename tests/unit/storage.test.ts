import { describe, it, expect, beforeEach } from 'vitest';
import { bloodPressureDB, type BloodPressureEntry } from '../../src/storage';

describe('BloodPressureRepository', () => {
  let mockEntry: BloodPressureEntry;

  beforeEach(async () => {
    // Clear all data before each test
    await bloodPressureDB.clearAllEntries();
    mockEntry = {
      id: 'test-id-1',
      date: '2023-01-01T12:00:00.000Z',
      systolic: 120,
      diastolic: 80,
      heartRate: 70,
    };
  });

  describe('saveEntry', () => {
    it('should save a health entry', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      const entries = await bloodPressureDB.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(mockEntry);
      expect(entries[0].updatedAt).toBeDefined();
    });

    it('should save multiple entries', async () => {
      const entry2: BloodPressureEntry = {
        id: 'test-id-2',
        date: '2023-01-02T12:00:00.000Z',
        systolic: 130,
        diastolic: 85,
        heartRate: 75,
      };

      await bloodPressureDB.saveEntry(mockEntry);
      await bloodPressureDB.saveEntry(entry2);

      const entries = await bloodPressureDB.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.id === mockEntry.id && e.systolic === mockEntry.systolic)).toBe(
        true
      );
      expect(entries.some((e) => e.id === entry2.id && e.systolic === entry2.systolic)).toBe(true);
      expect(entries.every((e) => e.updatedAt)).toBe(true);
    });
  });

  describe('getEntries', () => {
    it('should return empty array when no entries exist', async () => {
      const entries = await bloodPressureDB.getEntries();
      expect(entries).toEqual([]);
    });

    it('should return all saved entries', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      const entries = await bloodPressureDB.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(mockEntry);
      expect(entries[0].updatedAt).toBeDefined();
    });
  });

  describe('getEntry', () => {
    it('should return undefined for non-existent entry', async () => {
      const entry = await bloodPressureDB.getEntry('non-existent-id');
      expect(entry).toBeUndefined();
    });

    it('should return the correct entry by id', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      const entry = await bloodPressureDB.getEntry(mockEntry.id);
      expect(entry).toMatchObject(mockEntry);
      expect(entry?.updatedAt).toBeDefined();
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry', async () => {
      await bloodPressureDB.saveEntry(mockEntry);

      const updatedEntry: BloodPressureEntry = {
        ...mockEntry,
        systolic: 140,
        diastolic: 90,
        heartRate: 80,
      };

      await bloodPressureDB.updateEntry(updatedEntry);
      const entry = await bloodPressureDB.getEntry(mockEntry.id);
      expect(entry).toMatchObject(updatedEntry);
      expect(entry?.updatedAt).toBeDefined();
    });

    it('should create new entry if id does not exist', async () => {
      const newEntry: BloodPressureEntry = {
        id: 'new-id',
        date: '2023-01-03T12:00:00.000Z',
        systolic: 110,
        diastolic: 70,
        heartRate: 65,
      };

      await bloodPressureDB.updateEntry(newEntry);
      const entry = await bloodPressureDB.getEntry(newEntry.id);
      expect(entry).toMatchObject(newEntry);
      expect(entry?.updatedAt).toBeDefined();
    });
  });

  describe('deleteEntry', () => {
    it('should delete an existing entry', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      expect(await bloodPressureDB.getEntries()).toHaveLength(1);

      await bloodPressureDB.deleteEntry(mockEntry.id);
      expect(await bloodPressureDB.getEntries()).toHaveLength(0);
    });

    it('should not throw error when deleting non-existent entry', async () => {
      await bloodPressureDB.deleteEntry('non-existent-id');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('clearAllEntries', () => {
    it('should clear all entries', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      await bloodPressureDB.saveEntry({
        id: 'test-id-2',
        date: '2023-01-02T12:00:00.000Z',
        systolic: 130,
        diastolic: 85,
        heartRate: 75,
      });

      expect(await bloodPressureDB.getEntries()).toHaveLength(2);

      await bloodPressureDB.clearAllEntries();
      expect(await bloodPressureDB.getEntries()).toHaveLength(0);
    });

    it('should not throw error when clearing empty database', async () => {
      await bloodPressureDB.clearAllEntries();
      expect(await bloodPressureDB.getEntries()).toHaveLength(0);
    });
  });

  describe('replaceAllEntries', () => {
    it('should replace all entries with new set', async () => {
      // Add initial entries
      await bloodPressureDB.saveEntry(mockEntry);
      expect(await bloodPressureDB.getEntries()).toHaveLength(1);

      // Replace with new entries
      const newEntries: BloodPressureEntry[] = [
        {
          id: 'new-1',
          date: '2023-02-01T12:00:00.000Z',
          systolic: 115,
          diastolic: 75,
          heartRate: 68,
        },
        {
          id: 'new-2',
          date: '2023-02-02T12:00:00.000Z',
          systolic: 125,
          diastolic: 82,
          heartRate: 72,
        },
      ];

      await bloodPressureDB.replaceAllEntries(newEntries);
      const entries = await bloodPressureDB.getEntries();

      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.id === 'new-1' && e.systolic === 115)).toBe(true);
      expect(entries.some((e) => e.id === 'new-2' && e.systolic === 125)).toBe(true);
      expect(entries.every((e) => e.updatedAt)).toBe(true);
      expect(entries.some((e) => e.id === mockEntry.id)).toBe(false);
    });

    it('should handle empty array replacement', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      expect(await bloodPressureDB.getEntries()).toHaveLength(1);

      await bloodPressureDB.replaceAllEntries([]);
      expect(await bloodPressureDB.getEntries()).toHaveLength(0);
    });
  });

  describe('data validation', () => {
    it('should handle entries with all required fields', async () => {
      const entry: BloodPressureEntry = {
        id: 'test',
        date: new Date().toISOString(),
        systolic: 120,
        diastolic: 80,
        heartRate: 70,
      };

      await bloodPressureDB.saveEntry(entry);
      const retrieved = await bloodPressureDB.getEntry('test');
      expect(retrieved).toMatchObject(entry);
      expect(retrieved?.updatedAt).toBeDefined();
    });

    it('should preserve data types correctly', async () => {
      await bloodPressureDB.saveEntry(mockEntry);
      const retrieved = await bloodPressureDB.getEntry(mockEntry.id);

      expect(typeof retrieved?.systolic).toBe('number');
      expect(typeof retrieved?.diastolic).toBe('number');
      expect(typeof retrieved?.heartRate).toBe('number');
      expect(typeof retrieved?.date).toBe('string');
      expect(typeof retrieved?.id).toBe('string');
    });
  });
});
