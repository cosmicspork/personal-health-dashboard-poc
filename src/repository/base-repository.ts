import type { EntityTable, IDType } from 'dexie';

export abstract class BaseRepository<T extends { id: string; updatedAt?: string }> {
  protected table: EntityTable<T, 'id'>;

  constructor(table: EntityTable<T, 'id'>) {
    this.table = table;
  }

  async save(entity: T): Promise<void> {
    const entityWithTimestamp: T = { ...entity, updatedAt: new Date().toISOString() };
    await this.table.put(entityWithTimestamp);
  }

  async getById(id: IDType<T, 'id'>): Promise<T | undefined> {
    return this.table.get(id);
  }

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async delete(id: IDType<T, 'id'>): Promise<void> {
    await this.table.delete(id);
  }

  async update(entity: T): Promise<void> {
    const entityWithTimestamp: T = { ...entity, updatedAt: new Date().toISOString() };
    await this.table.put(entityWithTimestamp);
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  async count(): Promise<number> {
    return this.table.count();
  }

  async bulkSave(entities: T[]): Promise<void> {
    const withTimestamps: T[] = entities.map((e) => ({
      ...e,
      updatedAt: new Date().toISOString(),
    }));
    await this.table.bulkPut(withTimestamps);
  }

  async replaceAll(entities: T[]): Promise<void> {
    await this.table.clear();
    await this.bulkSave(entities);
  }
}
