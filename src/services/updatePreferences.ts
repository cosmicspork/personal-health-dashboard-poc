/**
 * Service for managing user update preferences
 * Stores preferences in localStorage for persistence across sessions
 */

export interface UpdatePreferences {
  updatesEnabled: boolean;
  dismissedVersion: string | null;
  lastCheckTime: number;
}

const STORAGE_KEY = 'health-dashboard-update-preferences';

class UpdatePreferencesService {
  private preferences: UpdatePreferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Load preferences from localStorage or use defaults
   */
  private loadPreferences(): UpdatePreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load update preferences:', error);
    }

    // Default: updates enabled for new users
    return {
      updatesEnabled: true,
      dismissedVersion: null,
      lastCheckTime: 0,
    };
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save update preferences:', error);
    }
  }

  /**
   * Check if updates are enabled
   */
  isUpdatesEnabled(): boolean {
    return this.preferences.updatesEnabled;
  }

  /**
   * Enable or disable updates
   */
  setUpdatesEnabled(enabled: boolean): void {
    this.preferences.updatesEnabled = enabled;
    if (enabled) {
      // Clear dismissed version when re-enabling updates
      this.preferences.dismissedVersion = null;
    }
    this.savePreferences();
  }

  /**
   * Get the dismissed version (if any)
   */
  getDismissedVersion(): string | null {
    return this.preferences.dismissedVersion;
  }

  /**
   * Set the dismissed version
   */
  setDismissedVersion(version: string | null): void {
    this.preferences.dismissedVersion = version;
    this.savePreferences();
  }

  /**
   * Get the last check time
   */
  getLastCheckTime(): number {
    return this.preferences.lastCheckTime;
  }

  /**
   * Update the last check time
   */
  updateLastCheckTime(): void {
    this.preferences.lastCheckTime = Date.now();
    this.savePreferences();
  }

  /**
   * Reset all preferences to defaults
   */
  reset(): void {
    this.preferences = {
      updatesEnabled: true,
      dismissedVersion: null,
      lastCheckTime: 0,
    };
    this.savePreferences();
  }
}

// Export singleton instance
export const updatePreferences = new UpdatePreferencesService();
