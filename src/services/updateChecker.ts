/**
 * Update checker service for detecting new app versions
 * Integrates with the Banner component to show update notifications
 */

import { updatePreferences } from '../storage.js';

export interface VersionInfo {
  appVersion: string;
  releasedAt: string;
  changelogUrl?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export class UpdateChecker {
  private currentVersion: string;
  private checkInterval: number | undefined;
  private onUpdateAvailable:
    | ((versionInfo: VersionInfo, changelog: ChangelogEntry | null) => void)
    | undefined;
  private isChecking = false;

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  /**
   * Sets up automatic version checking with the specified interval
   * @param intervalMs Check interval in milliseconds (default: 30 minutes)
   * @param onUpdateCallback Callback when update is available
   */
  startPeriodicChecks(
    intervalMs = 30 * 60 * 1000, // 30 minutes
    onUpdateCallback?: (versionInfo: VersionInfo, changelog: ChangelogEntry | null) => void
  ): void {
    this.onUpdateAvailable = onUpdateCallback;

    // Check immediately
    this.checkForUpdates();

    // Set up periodic checks
    this.checkInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);
  }

  /**
   * Stops automatic version checking
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Manually checks for updates
   * @returns Promise resolving to version info if update available, null otherwise
   */
  async checkForUpdates(): Promise<VersionInfo | null> {
    if (this.isChecking) {
      return null;
    }

    this.isChecking = true;

    try {
      updatePreferences.updateLastCheckTime();

      const versionInfo = await this.fetchVersionInfo();

      if (this.isNewerVersion(versionInfo.appVersion, this.currentVersion)) {
        const changelog = await this.fetchChangelog(versionInfo);

        if (this.onUpdateAvailable) {
          this.onUpdateAvailable(versionInfo, changelog);
        }

        return versionInfo;
      }

      return null;
    } catch (error) {
      console.warn('Failed to check for updates:', error);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Fetches version information from the server
   */
  private async fetchVersionInfo(): Promise<VersionInfo> {
    const response = await fetch('/version.json?t=' + Date.now(), {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch version info: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Fetches changelog information for the new version
   */
  private async fetchChangelog(versionInfo: VersionInfo): Promise<ChangelogEntry | null> {
    if (!versionInfo.changelogUrl) {
      return null;
    }

    try {
      const response = await fetch(versionInfo.changelogUrl + '?t=' + Date.now(), {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch changelog');
        return null;
      }

      const changelog: ChangelogEntry[] = await response.json();

      // Find the changelog entry for the new version
      return changelog.find((entry) => entry.version === versionInfo.appVersion) ?? null;
    } catch (error) {
      console.warn('Failed to parse changelog:', error);
      return null;
    }
  }

  /**
   * Compares version strings to determine if newVersion is newer than currentVersion
   * Uses semantic versioning comparison (major.minor.patch)
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map((n) => parseInt(n, 10) || 0);
    };

    const newParts = parseVersion(newVersion);
    const currentParts = parseVersion(currentVersion);

    // Ensure both arrays have the same length
    const maxLength = Math.max(newParts.length, currentParts.length);
    while (newParts.length < maxLength) newParts.push(0);
    while (currentParts.length < maxLength) currentParts.push(0);

    for (let i = 0; i < maxLength; i++) {
      const newPart = newParts[i];
      const currentPart = currentParts[i];
      if (newPart !== undefined && currentPart !== undefined) {
        if (newPart > currentPart) {
          return true;
        } else if (newPart < currentPart) {
          return false;
        }
      }
    }

    return false; // Versions are equal
  }

  /**
   * Triggers a service worker update and page reload
   */
  static async triggerUpdate(): Promise<void> {
    try {
      // Check if service worker is available
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();

        if (registration?.waiting) {
          // Tell the waiting service worker to skip waiting and become active
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Listen for the service worker to become active, then reload
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
        } else {
          // No waiting service worker, just reload
          window.location.reload();
        }
      } else {
        // No service worker support, just reload
        window.location.reload();
      }
    } catch (error) {
      console.warn('Failed to trigger service worker update, falling back to reload:', error);
      window.location.reload();
    }
  }
}
