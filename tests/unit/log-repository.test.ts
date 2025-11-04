import { describe, it, expect, beforeEach } from 'vitest';
import { logRepository } from '../../src/repository/log-repository';
import type { LogEntry } from '../../src/types/database';

describe('LogRepository', () => {
  let mockEntry: LogEntry;

  beforeEach(async () => {
    // Clear all data before each test
    await logRepository.clearAllEntries();
    mockEntry = {
      id: 'test-log-id-1',
      date: '2023-01-01T12:00:00.000Z',
      note: 'Test health log note',
    };
  });

  describe('saveEntry', () => {
    it('should save a log entry', async () => {
      await logRepository.saveEntry(mockEntry);
      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(mockEntry);
      expect(entries[0].updatedAt).toBeDefined();
    });

    it('should save multiple entries', async () => {
      const entry2: LogEntry = {
        id: 'test-log-id-2',
        date: '2023-01-02T12:00:00.000Z',
        note: 'Second test log note',
      };

      await logRepository.saveEntry(mockEntry);
      await logRepository.saveEntry(entry2);

      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.id === mockEntry.id && e.note === mockEntry.note)).toBe(true);
      expect(entries.some((e) => e.id === entry2.id && e.note === entry2.note)).toBe(true);
      expect(entries.every((e) => e.updatedAt)).toBe(true);
    });
  });

  describe('getEntries', () => {
    it('should return empty array when no entries exist', async () => {
      const entries = await logRepository.getEntries();
      expect(entries).toEqual([]);
    });

    it('should return all saved entries', async () => {
      const entry2: LogEntry = {
        id: 'test-log-id-2',
        date: '2023-01-02T12:00:00.000Z',
        note: 'Second test log note',
      };

      await logRepository.saveEntry(mockEntry);
      await logRepository.saveEntry(entry2);

      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.id === mockEntry.id)).toMatchObject(mockEntry);
      expect(entries.find((e) => e.id === entry2.id)).toMatchObject(entry2);
    });
  });

  describe('getEntry', () => {
    it('should return undefined for non-existent entry', async () => {
      const entry = await logRepository.getEntry('non-existent-id');
      expect(entry).toBeUndefined();
    });

    it('should return the correct entry by id', async () => {
      await logRepository.saveEntry(mockEntry);
      const entry = await logRepository.getEntry(mockEntry.id);
      expect(entry).toMatchObject(mockEntry);
      expect(entry?.updatedAt).toBeDefined();
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry', async () => {
      await logRepository.saveEntry(mockEntry);
      
      const updatedEntry: LogEntry = {
        ...mockEntry,
        note: 'Updated test log note',
      };

      await logRepository.updateEntry(updatedEntry);
      
      const entry = await logRepository.getEntry(mockEntry.id);
      expect(entry?.note).toBe('Updated test log note');
      expect(entry?.updatedAt).toBeDefined();
    });

    it('should create new entry if id does not exist', async () => {
      const newEntry: LogEntry = {
        id: 'new-log-id',
        date: '2023-01-03T12:00:00.000Z',
        note: 'New log entry',
      };

      await logRepository.updateEntry(newEntry);
      
      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(newEntry);
      expect(entries[0].updatedAt).toBeDefined();
    });
  });

  describe('deleteEntry', () => {
    it('should delete an existing entry', async () => {
      await logRepository.saveEntry(mockEntry);
      let entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);

      await logRepository.deleteEntry(mockEntry.id);
      
      entries = await logRepository.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('should not throw error when deleting non-existent entry', async () => {
      await expect(logRepository.deleteEntry('non-existent-id')).resolves.not.toThrow();
      
      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('clearAllEntries', () => {
    it('should clear all entries', async () => {
      const entry2: LogEntry = {
        id: 'test-log-id-2',
        date: '2023-01-02T12:00:00.000Z',
        note: 'Second test log note',
      };

      await logRepository.saveEntry(mockEntry);
      await logRepository.saveEntry(entry2);

      let entries = await logRepository.getEntries();
      expect(entries).toHaveLength(2);

      await logRepository.clearAllEntries();
      
      entries = await logRepository.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('should not throw error when clearing empty database', async () => {
      await expect(logRepository.clearAllEntries()).resolves.not.toThrow();
      
      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('replaceAllEntries', () => {
    it('should replace all entries with new set', async () => {
      // Add initial entry
      await logRepository.saveEntry(mockEntry);
      let entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);

      // Replace with new entries
      const newEntries: LogEntry[] = [
        {
          id: 'replace-log-id-1',
          date: '2023-02-01T12:00:00.000Z',
          note: 'Replacement log entry 1',
        },
        {
          id: 'replace-log-id-2',
          date: '2023-02-02T12:00:00.000Z',
          note: 'Replacement log entry 2',
        },
      ];

      await logRepository.replaceAllEntries(newEntries);
      
      entries = await logRepository.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.id === 'replace-log-id-1')).toMatchObject(newEntries[0]);
      expect(entries.find((e) => e.id === 'replace-log-id-2')).toMatchObject(newEntries[1]);
      expect(entries.find((e) => e.id === mockEntry.id)).toBeUndefined();
    });

    it('should handle empty array replacement', async () => {
      // Add initial entries
      await logRepository.saveEntry(mockEntry);
      let entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);

      // Replace with empty array
      await logRepository.replaceAllEntries([]);
      
      entries = await logRepository.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('data validation', () => {
    it('should handle entries with all required fields', async () => {
      const completeEntry: LogEntry = {
        id: 'complete-log-id',
        date: '2023-01-01T12:00:00.000Z',
        note: 'Complete log entry note',
      };

      await logRepository.saveEntry(completeEntry);
      
      const entries = await logRepository.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(completeEntry.id);
      expect(entries[0].date).toBe(completeEntry.date);
      expect(entries[0].note).toBe(completeEntry.note);
      expect(typeof entries[0].updatedAt).toBe('string');
    });

    it('should preserve data types correctly', async () => {
      await logRepository.saveEntry(mockEntry);
      
      const entries = await logRepository.getEntries();
      const entry = entries[0];
      
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.note).toBe('string');
      expect(typeof entry.updatedAt).toBe('string');
    });
  });
});