import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpdateChecker } from '../../src/services/updateChecker.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.serviceWorker
const mockServiceWorker = {
  getRegistration: vi.fn(),
  addEventListener: vi.fn(),
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
});

describe('UpdateChecker', () => {
  let updateChecker: UpdateChecker;
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    updateChecker = new UpdateChecker('1.0.0');
    mockCallback = vi.fn();
  });

  afterEach(() => {
    updateChecker.stopPeriodicChecks();
  });

  describe('version comparison', () => {
    it('should detect newer versions correctly', async () => {
      const mockVersionResponse = {
        appVersion: '1.1.0',
        releasedAt: '2025-08-22T00:00:00.000Z',
        changelogUrl: '/changelog.json',
      };

      const mockChangelogResponse = [
        {
          version: '1.1.0',
          date: '2025-08-22',
          highlights: ['New feature added', 'Bug fixes'],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChangelogResponse),
        });

      const result = await updateChecker.checkForUpdates();

      expect(result).toEqual(mockVersionResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/version.json'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/changelog.json'),
        expect.any(Object)
      );
    });

    it('should not detect same version as update', async () => {
      const mockVersionResponse = {
        appVersion: '1.0.0',
        releasedAt: '2025-08-22T00:00:00.000Z',
        changelogUrl: '/changelog.json',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersionResponse),
      });

      const result = await updateChecker.checkForUpdates();

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not detect older version as update', async () => {
      const mockVersionResponse = {
        appVersion: '0.9.0',
        releasedAt: '2025-08-22T00:00:00.000Z',
        changelogUrl: '/changelog.json',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersionResponse),
      });

      const result = await updateChecker.checkForUpdates();

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle semantic versioning correctly', async () => {
      const testCases = [
        { current: '1.0.0', remote: '1.0.1', shouldUpdate: true },
        { current: '1.0.0', remote: '1.1.0', shouldUpdate: true },
        { current: '1.0.0', remote: '2.0.0', shouldUpdate: true },
        { current: '1.1.0', remote: '1.0.0', shouldUpdate: false },
        { current: '1.0.1', remote: '1.0.0', shouldUpdate: false },
        { current: '2.0.0', remote: '1.0.0', shouldUpdate: false },
      ];

      for (const testCase of testCases) {
        const checker = new UpdateChecker(testCase.current);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              appVersion: testCase.remote,
              releasedAt: '2025-08-22T00:00:00.000Z',
            }),
        });

        const result = await checker.checkForUpdates();

        if (testCase.shouldUpdate) {
          expect(result).not.toBeNull();
        } else {
          expect(result).toBeNull();
        }
      }
    });
  });

  describe('periodic checks', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start periodic checks and call callback on update', async () => {
      const mockVersionResponse = {
        appVersion: '1.1.0',
        releasedAt: '2025-08-22T00:00:00.000Z',
        changelogUrl: '/changelog.json',
      };

      const mockChangelogResponse = [
        {
          version: '1.1.0',
          date: '2025-08-22',
          highlights: ['New feature added'],
        },
      ];

      mockFetch
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVersionResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChangelogResponse),
        });

      updateChecker.startPeriodicChecks(1000, mockCallback);

      // Fast-forward time to trigger interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockCallback).toHaveBeenCalledWith(mockVersionResponse, mockChangelogResponse[0]);
    });

    it('should stop periodic checks', () => {
      updateChecker.startPeriodicChecks(1000, mockCallback);
      updateChecker.stopPeriodicChecks();

      // Fast-forward time - callback should not be called
      vi.advanceTimersByTime(2000);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await updateChecker.checkForUpdates();

      expect(result).toBeNull();
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await updateChecker.checkForUpdates();

      expect(result).toBeNull();
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await updateChecker.checkForUpdates();

      expect(result).toBeNull();
    });
  });

  describe('triggerUpdate', () => {
    beforeEach(() => {
      // Mock window.location.reload
      Object.defineProperty(window, 'location', {
        value: { reload: vi.fn() },
        writable: true,
      });
    });

    it('should trigger service worker update when available', async () => {
      const mockRegistration = {
        waiting: {
          postMessage: vi.fn(),
        },
      };

      mockServiceWorker.getRegistration.mockResolvedValueOnce(mockRegistration);

      await UpdateChecker.triggerUpdate();

      expect(mockRegistration.waiting.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function)
      );
    });

    it('should fallback to reload when no service worker waiting', async () => {
      const mockRegistration = {
        waiting: null,
      };

      mockServiceWorker.getRegistration.mockResolvedValueOnce(mockRegistration);

      await UpdateChecker.triggerUpdate();

      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should fallback to reload when no service worker registration', async () => {
      mockServiceWorker.getRegistration.mockResolvedValueOnce(null);

      await UpdateChecker.triggerUpdate();

      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should fallback to reload when service worker not supported', async () => {
      // Mock navigator without serviceWorker
      const originalNavigator = global.navigator;
      global.navigator = {} as Navigator;

      await UpdateChecker.triggerUpdate();

      expect(window.location.reload).toHaveBeenCalled();

      // Restore navigator
      global.navigator = originalNavigator;
    });
  });
});
