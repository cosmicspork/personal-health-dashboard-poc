/**
 * Service for managing user chart preferences
 * Stores preferences in localStorage for persistence across sessions
 */

type PeriodType = 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

export interface ChartPreferences {
  selectedPeriod: PeriodType;
}

const STORAGE_KEY = 'health-dashboard-chart-preferences';

class ChartPreferencesService {
  private preferences: ChartPreferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  /**
   * Load preferences from localStorage or use defaults
   */
  private loadPreferences(): ChartPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load chart preferences:', error);
    }

    // Default: week period for new users
    return {
      selectedPeriod: 'week',
    };
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.warn('Failed to save chart preferences:', error);
    }
  }

  /**
   * Get the selected period
   */
  getSelectedPeriod(): PeriodType {
    return this.preferences.selectedPeriod;
  }

  /**
   * Set the selected period
   */
  setSelectedPeriod(period: PeriodType): void {
    this.preferences.selectedPeriod = period;
    this.savePreferences();
  }

  /**
   * Reset preferences to defaults
   */
  reset(): void {
    this.preferences = {
      selectedPeriod: 'week',
    };
    this.savePreferences();
  }
}

// Export singleton instance
export const chartPreferences = new ChartPreferencesService();
