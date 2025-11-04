/**
 * Service for requesting persistent storage to prevent data loss
 */
export class StoragePersistence {
  private static hasRequested = false;

  /**
   * Request persistent storage from the browser
   * This helps prevent data eviction under storage pressure
   */
  static async requestPersistent(): Promise<boolean> {
    if (this.hasRequested) {
      return false;
    }

    this.hasRequested = true;

    if (!navigator.storage?.persist) {
      console.warn('Persistent storage API not supported');
      return false;
    }

    try {
      const granted = await navigator.storage.persist();
      if (!granted) {
        console.warn('Persistent storage denied - data may be evicted under storage pressure');
      }
      return granted;
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
      return false;
    }
  }

  /**
   * Check if storage is persistent
   */
  static async isPersistent(): Promise<boolean> {
    if (!navigator.storage?.persisted) {
      return false;
    }

    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
}
