import { Chart, registerables } from 'chart.js';
import { format, isAfter, subDays, subMonths, subYears } from 'date-fns';
import {
  type BloodPressureEntry,
  type LogEntry,
  bloodPressureDB,
  logDB,
  updatePreferences,
  chartPreferences,
} from './storage.js';
import { UpdateChecker, type ChangelogEntry, type VersionInfo } from './services/updateChecker.js';

Chart.register(...registerables);

// Type definitions
type PeriodType = 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

// Constants
const HEALTH_RANGES = {
  SYSTOLIC: { MIN: 60, MAX: 250 },
  DIASTOLIC: { MIN: 40, MAX: 150 },
  HEART_RATE: { MIN: 30, MAX: 220 },
} as const;

const UI_CONSTANTS = {
  CHART_HEIGHT: 96, // h-96 = 384px
  TABLE_LIMIT: 20,
  FOCUS_DELAY: 100,
  REFRESH_DELAY: 100,
  SUMMARY_DAYS: 30,
} as const;

const CSS_CLASSES = {
  BUTTON_PRIMARY:
    'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  BUTTON_SECONDARY:
    'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500',
  BUTTON_DANGER:
    'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  PERIOD_ACTIVE: 'bg-blue-600 text-white',
  PERIOD_INACTIVE: 'bg-gray-200 text-gray-700',
} as const;

/**
 * Banner component for displaying temporary messages at the top of the page
 * Supports auto-hide timeout and dismissal
 */
class Banner {
  private container: HTMLElement;
  private messageElement: HTMLElement;
  private closeButton: HTMLElement;
  private hideTimeout: number | undefined;

  constructor() {
    this.container = this.getRequiredElement('banner-container');
    this.messageElement = this.getRequiredElement('banner-message');
    this.closeButton = this.getRequiredElement('banner-close');

    this.setupEventListeners();
  }

  private getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required banner element with id '${id}' not found`);
    }
    return element;
  }

  private setupEventListeners(): void {
    this.closeButton.addEventListener('click', () => this.hide());

    document.addEventListener('keydown', (e) => {
      if (!this.container.classList.contains('hidden') && e.key === 'Escape') {
        this.hide();
      }
    });
  }

  show(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'update' = 'info',
    autoHideMs?: number
  ): void {
    this.messageElement.innerHTML = message;

    // Reset all type classes
    this.container.classList.remove(
      'banner-info',
      'banner-success',
      'banner-warning',
      'banner-error',
      'banner-update'
    );
    this.container.classList.add(`banner-${type}`);

    this.container.classList.remove('hidden');

    // Clear any existing timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    // Set auto-hide timeout if specified
    if (autoHideMs) {
      this.hideTimeout = window.setTimeout(() => this.hide(), autoHideMs);
    }
  }

  hide(): void {
    this.container.classList.add('hidden');

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
  }

  isVisible(): boolean {
    return !this.container.classList.contains('hidden');
  }

  /**
   * Shows an update notification with view changelog action
   * @param message The update message
   * @param onViewChangelog Callback for viewing changelog
   */
  showUpdate(message: string, onViewChangelog: () => void): void {
    this.messageElement.innerHTML = `
      <div class="flex items-center justify-between w-full">
        <span>${message}</span>
        <button 
          id="banner-changelog-btn" 
          class="ml-4 px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-blue-50 transition-colors">
          View Changelog
        </button>
      </div>
    `;

    // Reset all type classes
    this.container.classList.remove(
      'banner-info',
      'banner-success',
      'banner-warning',
      'banner-error',
      'banner-update'
    );
    this.container.classList.add('banner-update');

    this.container.classList.remove('hidden');

    // Auto-hide after 10 seconds
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    this.hideTimeout = window.setTimeout(() => this.hide(), 10000);

    // Add changelog button handler
    const changelogBtn = document.getElementById('banner-changelog-btn');
    if (changelogBtn) {
      changelogBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        onViewChangelog();
      });
    }
  }
}

/**
 * Modal component for displaying dialogs, alerts, and forms
 * Handles keyboard navigation, backdrop clicks, and various modal types
 */
class Modal {
  private backdrop: HTMLElement;
  private title: HTMLElement;
  private content: HTMLElement;
  private actions: HTMLElement;
  private closeBtn: HTMLElement;

  constructor() {
    this.backdrop = this.getRequiredElement('modal-backdrop');
    this.title = this.getRequiredElement('modal-title');
    this.content = this.getRequiredElement('modal-content');
    this.actions = this.getRequiredElement('modal-actions');
    this.closeBtn = this.getRequiredElement('modal-close');

    this.setupEventListeners();
  }

  /**
   * Gets a required DOM element by ID, throwing an error if not found
   */
  private getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required modal element with id '${id}' not found`);
    }
    return element;
  }

  private setupEventListeners(): void {
    // Close on backdrop click
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.hide();
      }
    });

    // Close button
    this.closeBtn.addEventListener('click', () => this.hide());

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (!this.backdrop.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          this.hide();
        }
      }
    });
  }

  /**
   * Shows an alert modal with a message and OK button
   * @param title The modal title
   * @param message The alert message (can include HTML)
   * @param modalType The alert type (for potential future styling)
   * @returns Promise that resolves when the user clicks OK
   */
  showAlert(title: string, message: string): Promise<void> {
    return new Promise((resolve) => {
      this.title.textContent = title;
      this.content.innerHTML = message;

      // Clear previous actions
      this.actions.innerHTML = '';

      // Add OK button
      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
      okBtn.addEventListener('click', () => {
        this.hide();
        resolve();
      });

      this.actions.appendChild(okBtn);
      this.show();

      // Focus the OK button
      setTimeout(() => okBtn.focus(), UI_CONSTANTS.FOCUS_DELAY);
    });
  }

  /**
   * Shows a confirmation modal with Cancel and OK buttons
   * @param title The modal title
   * @param message The confirmation message (can include HTML)
   * @param onConfirm Callback executed when user confirms
   * @param onCancel Optional callback executed when user cancels
   */
  showConfirm(title: string, message: string, onConfirm: () => void, onCancel?: () => void): void {
    this.title.textContent = title;
    this.content.innerHTML = message;

    // Clear previous actions
    this.actions.innerHTML = '';

    // Add Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = CSS_CLASSES.BUTTON_SECONDARY;
    cancelBtn.addEventListener('click', () => {
      this.hide();
      if (onCancel) {
        onCancel();
      }
    });

    // Add Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'OK';
    confirmBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
    confirmBtn.addEventListener('click', () => {
      this.hide();
      onConfirm();
    });

    this.actions.appendChild(cancelBtn);
    this.actions.appendChild(confirmBtn);
    this.show();

    // Focus the confirm button
    setTimeout(() => confirmBtn.focus(), UI_CONSTANTS.FOCUS_DELAY);
  }

  /**
   * Shows an edit form modal for modifying health entry data
   * @param title The modal title
   * @param currentData Current health data values
   * @param onSubmit Callback executed with the new data
   */
  showEditLogForm(title: string, currentNote: string, onSubmit: (note: string) => void): void {
    this.title.textContent = title;

    // Create form HTML for log entry
    this.content.innerHTML = `
      <div class="space-y-4">
        <div>
          <label for="modal-log-note" class="block text-sm font-medium text-gray-700 mb-1">
            Note
          </label>
          <textarea id="modal-log-note" rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your health log note...">${currentNote}</textarea>
        </div>
      </div>
    `;

    // Clear previous actions
    this.actions.innerHTML = '';

    // Add Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = CSS_CLASSES.BUTTON_SECONDARY;
    cancelBtn.addEventListener('click', () => this.hide());

    // Add Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
    saveBtn.addEventListener('click', () => {
      const noteInput = document.getElementById('modal-log-note') as HTMLTextAreaElement;

      if (noteInput.value.trim()) {
        onSubmit(noteInput.value.trim());
        this.hide();
      }
    });

    this.actions.appendChild(cancelBtn);
    this.actions.appendChild(saveBtn);
    this.show();

    // Focus the textarea
    setTimeout(() => {
      const noteInput = document.getElementById('modal-log-note') as HTMLTextAreaElement;
      noteInput?.focus();
    }, UI_CONSTANTS.FOCUS_DELAY);
  }

  showEditForm(
    title: string,
    currentData: { systolic: number; diastolic: number; heartRate: number },
    onSubmit: (data: { systolic: number; diastolic: number; heartRate: number }) => void
  ): void {
    this.title.textContent = title;

    // Create content with form fields
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `
      <div class="space-y-4">
        <div>
          <label for="edit-systolic" class="block text-sm font-medium text-gray-700 mb-1">
            Systolic BP
          </label>
          <input type="number" id="edit-systolic" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value="${currentData.systolic}" min="${HEALTH_RANGES.SYSTOLIC.MIN}" max="${HEALTH_RANGES.SYSTOLIC.MAX}" required>
        </div>
        <div>
          <label for="edit-diastolic" class="block text-sm font-medium text-gray-700 mb-1">
            Diastolic BP
          </label>
          <input type="number" id="edit-diastolic"
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value="${currentData.diastolic}" min="${HEALTH_RANGES.DIASTOLIC.MIN}" max="${HEALTH_RANGES.DIASTOLIC.MAX}" required>
        </div>
        <div>
          <label for="edit-heartrate" class="block text-sm font-medium text-gray-700 mb-1">
            Heart Rate
          </label>
          <input type="number" id="edit-heartrate"
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value="${currentData.heartRate}" min="${HEALTH_RANGES.HEART_RATE.MIN}" max="${HEALTH_RANGES.HEART_RATE.MAX}" required>
        </div>
      </div>
    `;

    this.content.innerHTML = '';
    this.content.appendChild(contentDiv);

    // Clear previous actions
    this.actions.innerHTML = '';
    this.actions.className = 'flex gap-3 justify-end mb-4';

    // Add Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = CSS_CLASSES.BUTTON_SECONDARY;
    cancelBtn.addEventListener('click', () => {
      this.hide();
    });

    // Add Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
    saveBtn.addEventListener('click', () => {
      const systolicInput = document.getElementById('edit-systolic') as HTMLInputElement;
      const diastolicInput = document.getElementById('edit-diastolic') as HTMLInputElement;
      const heartRateInput = document.getElementById('edit-heartrate') as HTMLInputElement;

      const systolic = parseInt(systolicInput.value);
      const diastolic = parseInt(diastolicInput.value);
      const heartRate = parseInt(heartRateInput.value);

      if (systolic && diastolic && heartRate) {
        this.hide();
        onSubmit({ systolic, diastolic, heartRate });
      }
    });

    this.actions.appendChild(cancelBtn);
    this.actions.appendChild(saveBtn);
    this.show();

    // Focus the first input
    setTimeout(() => {
      const firstInput = document.getElementById('edit-systolic') as HTMLInputElement;
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, UI_CONSTANTS.FOCUS_DELAY);
  }

  showImportConfirm(
    title: string,
    message: string,
    entryCount: number,
    existingCount: number,
    onReplace: () => void,
    onMerge: () => void
  ): void {
    this.title.textContent = title;
    this.content.innerHTML = message;

    // Clear previous actions
    this.actions.innerHTML = '';
    this.actions.className = 'flex gap-3 justify-end mb-4';

    // Add Merge button (secondary)
    const mergeBtn = document.createElement('button');
    mergeBtn.textContent = `Merge Data`;
    mergeBtn.className = CSS_CLASSES.BUTTON_SECONDARY;
    mergeBtn.title = `Add ${entryCount} entries to existing ${existingCount} entries`;
    mergeBtn.addEventListener('click', () => {
      // Don't hide modal immediately - let the operation handle modal states
      onMerge();
    });

    // Add Replace button (primary/warning)
    const replaceBtn = document.createElement('button');
    replaceBtn.textContent = `Replace All Data`;
    replaceBtn.className = CSS_CLASSES.BUTTON_DANGER;
    replaceBtn.title = `Replace all existing data with ${entryCount} new entries`;
    replaceBtn.addEventListener('click', () => {
      // Don't hide modal immediately - let the operation handle modal states
      onReplace();
    });

    this.actions.appendChild(mergeBtn);
    this.actions.appendChild(replaceBtn);
    this.show();

    // Focus the merge button (safer option)
    setTimeout(() => mergeBtn.focus(), UI_CONSTANTS.FOCUS_DELAY);
  }

  updateModalContent(
    title: string,
    message: string,
    buttonText = 'OK',
    onComplete?: () => void
  ): void {
    // Update content without hiding/showing modal to prevent flash
    this.title.textContent = title;
    this.content.innerHTML = message;

    // Clear previous actions
    this.actions.innerHTML = '';
    this.actions.className = 'flex gap-3 justify-end mb-4';

    // Add OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = buttonText;
    okBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
    okBtn.addEventListener('click', () => {
      this.hide();
      if (onComplete) {
        onComplete();
      }
    });

    this.actions.appendChild(okBtn);

    // Focus the OK button
    setTimeout(() => okBtn.focus(), UI_CONSTANTS.FOCUS_DELAY);
  }

  /**
   * Shows update changelog with action buttons
   * @param version The new version available
   * @param changelog The changelog details
   * @param onUpdate Callback when user chooses to update
   * @param onDismiss Callback when user dismisses
   * @param onDisable Callback when user disables updates
   */
  showUpdateChangelog(
    version: string,
    changelog: ChangelogEntry | null,
    onUpdate: () => void,
    onDismiss: () => void,
    onDisable: () => void
  ): void {
    this.title.textContent = `Update Available: Version ${version}`;

    let content = '<div class="space-y-4">';

    if (changelog?.highlights && changelog.highlights.length > 0) {
      content += '<div>';
      content += '<h4 class="font-semibold text-gray-900 mb-2">What\'s New:</h4>';
      content += '<ul class="list-disc list-inside space-y-1 text-sm text-gray-700">';
      changelog.highlights.forEach((highlight) => {
        content += `<li>${highlight}</li>`;
      });
      content += '</ul>';
      content += '</div>';
    } else {
      content += '<p class="text-gray-700">A new version is available for download.</p>';
    }

    content +=
      '<p class="text-xs text-gray-500 mt-4">The update will be applied when you click "Update Now".</p>';
    content += '</div>';

    this.content.innerHTML = content;

    // Clear previous actions
    this.actions.innerHTML = '';
    this.actions.className = 'flex gap-3 justify-between mb-4';

    // Left side: Disable updates button
    const disableBtn = document.createElement('button');
    disableBtn.textContent = 'Disable Updates';
    disableBtn.className = 'text-gray-500 hover:text-gray-700 text-sm underline';
    disableBtn.addEventListener('click', () => {
      this.hide();
      onDisable();
    });

    // Right side container
    const rightButtons = document.createElement('div');
    rightButtons.className = 'flex gap-3';

    // Not now button
    const laterBtn = document.createElement('button');
    laterBtn.textContent = 'Not Now';
    laterBtn.className = CSS_CLASSES.BUTTON_SECONDARY;
    laterBtn.addEventListener('click', () => {
      this.hide();
      onDismiss();
    });

    // Update button
    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Update Now';
    updateBtn.className = CSS_CLASSES.BUTTON_PRIMARY;
    updateBtn.addEventListener('click', () => {
      this.hide();
      onUpdate();
    });

    rightButtons.appendChild(laterBtn);
    rightButtons.appendChild(updateBtn);

    this.actions.appendChild(disableBtn);
    this.actions.appendChild(rightButtons);

    this.show();

    // Focus the update button
    setTimeout(() => updateBtn.focus(), UI_CONSTANTS.FOCUS_DELAY);
  }

  private show(): void {
    this.backdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  private hide(): void {
    this.backdrop.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

/**
 * Main dashboard application for tracking health metrics
 * Manages data entry, visualization, import/export, and data persistence
 */
class HealthDashboard {
  private chart: Chart | null = null;
  private currentPeriod: PeriodType = chartPreferences.getSelectedPeriod();
  private modal!: Modal;
  private banner!: Banner;
  public updateChecker!: UpdateChecker; // Make public for testing

  constructor() {
    try {
      this.modal = new Modal();
      this.banner = new Banner();
      this.initializeUpdateChecker();
      this.init();
    } catch (error) {
      console.error('Failed to initialize HealthDashboard:', error);
      this.showFatalError('Application failed to initialize. Please refresh the page.');
    }
  }

  /**
   * Initializes the update checker service
   */
  private initializeUpdateChecker(): void {
    try {
      // Get current version from build-time injection
      const currentVersion = __APP_VERSION__;

      this.updateChecker = new UpdateChecker(currentVersion);

      // Only start periodic checks if updates are enabled
      if (updatePreferences.isUpdatesEnabled()) {
        this.updateChecker.startPeriodicChecks(
          30 * 60 * 1000, // Check every 30 minutes
          (versionInfo, changelog) => {
            this.handleUpdateAvailable(versionInfo, changelog);
          }
        );
      }
    } catch (error) {
      console.warn('Failed to initialize update checker:', error);
      // Don't fail the entire app if update checker fails
    }
  }

  /**
   * Handles when an update is available
   */
  private handleUpdateAvailable(versionInfo: VersionInfo, changelog: ChangelogEntry | null): void {
    // Check if this version was dismissed
    if (versionInfo.appVersion === updatePreferences.getDismissedVersion()) {
      return;
    }

    // Store the current update info for later use
    const currentVersionInfo = versionInfo;
    const currentChangelog = changelog;

    // Show banner with view changelog option
    this.banner.showUpdate(`New version ${versionInfo.appVersion} is available!`, () => {
      // Show the changelog modal
      this.modal.showUpdateChangelog(
        currentVersionInfo.appVersion,
        currentChangelog,
        // Update Now
        () => {
          UpdateChecker.triggerUpdate();
        },
        // Not Now - just dismiss
        () => {
          // Do nothing, just close modal
        },
        // Disable Updates
        () => {
          updatePreferences.setUpdatesEnabled(false);
          this.updateChecker.stopPeriodicChecks();
          this.banner.show(
            'Update notifications disabled. You can re-enable them in Data Management.',
            'info',
            5000
          );
          // Update the UI to show enable updates option
          this.updateDataManagementUI();
        }
      );
    });
  }

  /**
   * Manually checks for updates
   */
  public async checkForUpdatesManually(): Promise<void> {
    try {
      const versionInfo = await this.updateChecker.checkForUpdates();
      if (versionInfo) {
        // Update was found - the callback will handle it
      } else {
        this.banner.show('You are running the latest version.', 'success', 3000);
      }
    } catch {
      this.banner.show('Failed to check for updates. Please try again later.', 'error', 5000);
    }
  }

  /**
   * Updates the Data Management UI to reflect update preferences
   */
  private updateDataManagementUI(): void {
    const statusEl = document.getElementById('update-status');
    const enableContainer = document.getElementById('enable-updates-container');

    if (updatePreferences.isUpdatesEnabled()) {
      // Updates are enabled
      if (statusEl) {
        const lastCheck = updatePreferences.getLastCheckTime();
        if (lastCheck > 0) {
          const lastCheckDate = new Date(lastCheck);
          statusEl.textContent = `Last checked: ${format(lastCheckDate, 'MMM d, h:mm a')}`;
        } else {
          statusEl.textContent = 'Automatic updates enabled';
        }
      }
      enableContainer?.classList.add('hidden');
    } else {
      // Updates are disabled
      if (statusEl) {
        statusEl.textContent = 'Automatic updates disabled';
      }
      enableContainer?.classList.remove('hidden');
    }
  }

  /**
   * Shows a fatal error message when the application cannot function
   */
  private showFatalError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed inset-0 bg-red-100 flex items-center justify-center p-4 z-50';
    errorDiv.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-md">
        <h2 class="text-xl font-bold text-red-600 mb-4">Application Error</h2>
        <p class="text-gray-700 mb-4">${message}</p>
        <button onclick="window.location.reload()" class="${CSS_CLASSES.BUTTON_PRIMARY}">
          Refresh Page
        </button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }

  private init(): void {
    this.setupEventListeners();
    this.updatePeriodButtonStates();
    this.renderSummary();
    this.renderChart();
    this.renderTable();
    this.renderLogTable();
  }

  private setupEventListeners(): void {
    // Secret refresh feature - click main header to refresh
    document.getElementById('main-header')?.addEventListener('click', () => {
      window.location.reload();
    });

    // Info toggle
    document.getElementById('info-toggle')?.addEventListener('click', () => {
      const infoSection = document.getElementById('info-section');
      infoSection?.classList.toggle('hidden');
    });

    // Data specification toggle
    document.getElementById('data-spec-toggle')?.addEventListener('click', () => {
      const dataSpecSection = document.getElementById('data-spec-section');
      dataSpecSection?.classList.toggle('hidden');
    });

    // Data entry toggle
    document.getElementById('data-entry-toggle')?.addEventListener('click', () => {
      const dataEntrySection = document.getElementById('data-entry-section');
      dataEntrySection?.classList.toggle('hidden');
    });

    // Import/Export toggle
    document.getElementById('import-export-toggle')?.addEventListener('click', () => {
      const importExportSection = document.getElementById('import-export-section');
      importExportSection?.classList.toggle('hidden');
    });

    // BP table toggle
    document.getElementById('bp-table-toggle')?.addEventListener('click', () => {
      const bpTableSection = document.getElementById('bp-table-section');
      bpTableSection?.classList.toggle('hidden');
    });

    // Log table toggle
    document.getElementById('log-table-toggle')?.addEventListener('click', () => {
      const logTableSection = document.getElementById('log-table-section');
      logTableSection?.classList.toggle('hidden');
    });

    // Form type toggles
    const bpFormToggle = document.getElementById('bp-form-toggle');
    const logFormToggle = document.getElementById('log-form-toggle');
    const healthForm = document.getElementById('health-form');
    const logForm = document.getElementById('log-form');

    bpFormToggle?.addEventListener('click', () => {
      // Show BP form, hide log form
      healthForm?.classList.remove('hidden');
      logForm?.classList.add('hidden');
      // Update button styles
      bpFormToggle.className =
        'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';
      logFormToggle!.className =
        'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500';
    });

    logFormToggle?.addEventListener('click', () => {
      // Show log form, hide BP form
      logForm?.classList.remove('hidden');
      healthForm?.classList.add('hidden');
      // Update button styles
      logFormToggle.className =
        'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';
      bpFormToggle!.className =
        'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500';
    });

    // Time option radio buttons for BP form
    document.querySelectorAll('input[name="timeOption"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const customFields = document.getElementById('custom-time-fields');
        const target = e.target as HTMLInputElement;

        if (target.value === 'custom') {
          customFields?.classList.remove('hidden');
          // Set default values to current date/time
          const now = new Date();
          const dateInput = document.getElementById('customDate') as HTMLInputElement;
          const timeInput = document.getElementById('customTime') as HTMLInputElement;

          if (dateInput && !dateInput.value) {
            dateInput.value = now.toISOString().split('T')[0] ?? ''; // YYYY-MM-DD
          }
          if (timeInput && !timeInput.value) {
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`; // HH:MM
          }
        } else {
          customFields?.classList.add('hidden');
        }
      });
    });

    // Time option radio buttons for Log form
    document.querySelectorAll('input[name="logTimeOption"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const customFields = document.getElementById('log-custom-time-fields');
        const target = e.target as HTMLInputElement;

        if (target.value === 'custom') {
          customFields?.classList.remove('hidden');
          // Set default values to current date/time
          const now = new Date();
          const dateInput = document.getElementById('logCustomDate') as HTMLInputElement;
          const timeInput = document.getElementById('logCustomTime') as HTMLInputElement;

          if (dateInput && !dateInput.value) {
            dateInput.value = now.toISOString().split('T')[0] ?? ''; // YYYY-MM-DD
          }
          if (timeInput && !timeInput.value) {
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`; // HH:MM
          }
        } else {
          customFields?.classList.add('hidden');
        }
      });
    });

    // BP Form submission
    const form = document.getElementById('health-form') as HTMLFormElement;
    form?.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Log Form submission
    const logFormElement = document.getElementById('log-form') as HTMLFormElement;
    logFormElement?.addEventListener('submit', (e) => this.handleLogFormSubmit(e));

    // Chart period buttons
    document.querySelectorAll('.chart-period-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const period = (e.target as HTMLButtonElement).getAttribute('data-period') as any;
        this.changePeriod(period);
      });
    });

    // Export button
    document
      .getElementById('export-json-btn')
      ?.addEventListener('click', () => this.exportToJson());

    // Import functionality
    document.getElementById('import-btn')?.addEventListener('click', () => {
      document.getElementById('import-file-input')?.click();
    });

    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) {
        document.getElementById('import-filename')!.textContent = file.name;
        this.handleFileImport(file);
      }
    });

    // Delete all data button
    document.getElementById('delete-all-btn')?.addEventListener('click', () => {
      this.deleteAllData();
    });

    // Update settings buttons
    document.getElementById('check-updates-btn')?.addEventListener('click', () => {
      this.checkForUpdatesManually();
    });

    document.getElementById('enable-updates-btn')?.addEventListener('click', () => {
      updatePreferences.setUpdatesEnabled(true);
      this.updateChecker.startPeriodicChecks(30 * 60 * 1000, (versionInfo, changelog) => {
        this.handleUpdateAvailable(versionInfo, changelog);
      });
      this.banner.show('Automatic update checks enabled.', 'success', 3000);
      this.updateDataManagementUI();
    });

    // Initialize UI state
    this.updateDataManagementUI();
  }

  private async handleFormSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Determine the date to use
    let entryDate: string;
    const timeOption = formData.get('timeOption') as string;

    if (timeOption === 'custom') {
      const customDate = formData.get('customDate') as string;
      const customTime = formData.get('customTime') as string;

      if (customDate && customTime) {
        // Combine date and time into ISO string
        const dateTime = new Date(`${customDate}T${customTime}`);
        entryDate = dateTime.toISOString();
      } else {
        // Fall back to current time if custom fields are incomplete
        entryDate = new Date().toISOString();
      }
    } else {
      // Use current time (default)
      entryDate = new Date().toISOString();
    }

    const entry: BloodPressureEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      systolic: parseInt(formData.get('systolic') as string),
      diastolic: parseInt(formData.get('diastolic') as string),
      heartRate: parseInt(formData.get('heartRate') as string),
    };

    await this.saveEntry(entry);
    form.reset();

    // Reset custom time fields visibility after form reset
    const customFields = document.getElementById('custom-time-fields');
    customFields?.classList.add('hidden');

    // Show success banner
    this.banner.show('Blood pressure entry saved successfully', 'success', 3000);

    await this.renderChart();
    await this.renderSummary();
    await this.renderTable();
  }

  private async handleLogFormSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Determine the date to use
    let entryDate: string;
    const timeOption = formData.get('logTimeOption') as string;

    if (timeOption === 'custom') {
      const customDate = formData.get('logCustomDate') as string;
      const customTime = formData.get('logCustomTime') as string;

      if (customDate && customTime) {
        // Combine date and time into ISO string
        const dateTime = new Date(`${customDate}T${customTime}`);
        entryDate = dateTime.toISOString();
      } else {
        // Fall back to current time if custom fields are incomplete
        entryDate = new Date().toISOString();
      }
    } else {
      // Use current time (default)
      entryDate = new Date().toISOString();
    }

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      date: entryDate,
      note: formData.get('logNote') as string,
    };

    await logDB.saveEntry(entry);
    form.reset();

    // Reset custom time fields visibility after form reset
    const customFields = document.getElementById('log-custom-time-fields');
    customFields?.classList.add('hidden');

    // Show success banner
    this.banner.show('Log entry saved successfully', 'success', 3000);

    await this.renderLogTable();
  }

  private async saveEntry(entry: BloodPressureEntry): Promise<void> {
    await bloodPressureDB.saveEntry(entry);
  }

  private async getEntries(): Promise<BloodPressureEntry[]> {
    return await bloodPressureDB.getEntries();
  }

  private async getFilteredEntries(): Promise<BloodPressureEntry[]> {
    const entries = await this.getEntries();
    const now = new Date();
    let cutoff: Date;

    switch (this.currentPeriod) {
      case 'week':
        cutoff = subDays(now, 7);
        break;
      case 'month':
        cutoff = subMonths(now, 1);
        break;
      case '3months':
        cutoff = subMonths(now, 3);
        break;
      case '6months':
        cutoff = subMonths(now, 6);
        break;
      case 'year':
        cutoff = subYears(now, 1);
        break;
      default:
        return entries;
    }

    return entries.filter((entry) => isAfter(new Date(entry.date), cutoff));
  }

  /**
   * Updates the visual state of period buttons to match the current period
   */
  private updatePeriodButtonStates(): void {
    document.querySelectorAll('.chart-period-btn').forEach((btn) => {
      btn.classList.remove(...CSS_CLASSES.PERIOD_ACTIVE.split(' '));
      btn.classList.add(...CSS_CLASSES.PERIOD_INACTIVE.split(' '));
    });

    const activeBtn = document.querySelector(`[data-period="${this.currentPeriod}"]`);
    if (activeBtn) {
      activeBtn.classList.remove(...CSS_CLASSES.PERIOD_INACTIVE.split(' '));
      activeBtn.classList.add(...CSS_CLASSES.PERIOD_ACTIVE.split(' '));
    }
  }

  /**
   * Changes the current time period filter and updates all visualizations
   * @param period The new time period to filter by
   */
  private async changePeriod(period: PeriodType): Promise<void> {
    try {
      this.currentPeriod = period;
      chartPreferences.setSelectedPeriod(period);

      this.updatePeriodButtonStates();

      await Promise.all([this.renderChart(), this.renderSummary()]);
    } catch (error) {
      console.error('Error changing period:', error);
      this.banner.show('Failed to update chart period. Please try again.', 'error', 5000);
    }
  }

  private async renderChart(): Promise<void> {
    const canvas = document.getElementById('healthChart') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');

    if (!ctx) {
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const entries = (await this.getFilteredEntries()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = entries.map((entry) => format(new Date(entry.date), 'MMM dd'));

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Systolic BP',
            data: entries.map((e) => e.systolic),
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
          },
          {
            label: 'Diastolic BP',
            data: entries.map((e) => e.diastolic),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
          },
          {
            label: 'Heart Rate',
            data: entries.map((e) => e.heartRate),
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Blood Pressure (mmHg)',
            },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Heart Rate (bpm)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }

  private async renderSummary(): Promise<void> {
    const entries = (await this.getEntries()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Latest reading
    if (entries.length > 0) {
      const latest = entries[0];
      if (latest) {
        document.getElementById('latest-reading')!.textContent =
          `${latest.systolic}/${latest.diastolic} mmHg`;
        document.getElementById('latest-hr')!.textContent = `${latest.heartRate} bpm`;
        document.getElementById('latest-date')!.textContent = format(
          new Date(latest.date),
          'MMM dd, yyyy HH:mm'
        );
      }
    } else {
      // Clear latest reading when no data
      document.getElementById('latest-reading')!.textContent = '--/-- mmHg';
      document.getElementById('latest-hr')!.textContent = '-- bpm';
      document.getElementById('latest-date')!.textContent = 'No data';
    }

    // 30-day averages
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentEntries = entries.filter((entry) => isAfter(new Date(entry.date), thirtyDaysAgo));

    if (recentEntries.length > 0) {
      const avgSystolic = Math.round(
        recentEntries.reduce((sum, entry) => sum + entry.systolic, 0) / recentEntries.length
      );
      const avgDiastolic = Math.round(
        recentEntries.reduce((sum, entry) => sum + entry.diastolic, 0) / recentEntries.length
      );
      const avgHr = Math.round(
        recentEntries.reduce((sum, entry) => sum + entry.heartRate, 0) / recentEntries.length
      );

      document.getElementById('avg-reading')!.textContent = `${avgSystolic}/${avgDiastolic} mmHg`;
      document.getElementById('avg-hr-display')!.textContent = `${avgHr} bpm`;
      document.getElementById('entry-count')!.textContent = `${recentEntries.length} entries`;
    } else {
      // Clear averages when no recent data
      document.getElementById('avg-reading')!.textContent = '--/-- mmHg';
      document.getElementById('avg-hr-display')!.textContent = '-- bpm';
      document.getElementById('entry-count')!.textContent = '0 entries';
    }
  }

  /**
   * Renders the data table with recent health entries
   */
  private async renderTable(): Promise<void> {
    const container = document.getElementById('data-table');
    if (!container) {
      console.error('Data table container not found');
      return;
    }

    try {
      const entries = (await this.getEntries())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, UI_CONSTANTS.TABLE_LIMIT);

      if (entries.length === 0) {
        container.innerHTML =
          '<tr><td colspan="6" class="text-center py-4 text-gray-500">No entries yet</td></tr>';
        return;
      }

      container.innerHTML = entries
        .map((entry) => {
          const date = new Date(entry.date);
          const mobileDate = format(date, 'MMM dd');
          const fullDate = format(date, 'MMM dd, yyyy');

          return `
        <tr class="border-b border-gray-100 cursor-pointer sm:cursor-default table-row-entry" data-entry-id="${entry.id}">
          <td class="py-2">
            <span class="sm:hidden">${mobileDate}</span>
            <span class="hidden sm:inline">${fullDate}</span>
            <div class="text-xs text-gray-500 sm:hidden">${format(date, 'HH:mm')}</div>
          </td>
          <td class="py-2 hidden sm:table-cell">${format(date, 'HH:mm')}</td>
          <td class="py-2">${entry.systolic}</td>
          <td class="py-2">${entry.diastolic}</td>
          <td class="py-2">${entry.heartRate}</td>
          <td class="py-2 hidden sm:table-cell">
            <div class="flex gap-2">
              <button onclick="editEntry('${entry.id}')" 
                      class="text-blue-600 hover:text-blue-800 text-xs">
                Edit
              </button>
              <button onclick="deleteBloodPressureEntry('${entry.id}')" 
                      class="text-red-600 hover:text-red-800 text-xs">
                Delete
              </button>
            </div>
          </td>
        </tr>
        <tr class="mobile-actions-row hidden" data-entry-id="${entry.id}">
          <td colspan="5" class="py-2 sm:hidden">
            <div class="flex gap-2 justify-center bg-gray-50 px-4 py-2 rounded">
              <button onclick="editEntry('${entry.id}')" 
                      class="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-300 rounded">
                Edit
              </button>
              <button onclick="deleteBloodPressureEntry('${entry.id}')" 
                      class="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-300 rounded">
                Delete
              </button>
              <button onclick="closeMobileActions('${entry.id}')" 
                      class="text-gray-600 hover:text-gray-800 text-sm px-3 py-1 border border-gray-300 rounded">
                Close
              </button>
            </div>
          </td>
        </tr>
      `;
        })
        .join('');

      // Add event listeners for mobile row taps
      this.setupMobileTableInteractions();
    } catch (error) {
      console.error('Error rendering table:', error);
      container.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-red-500">Error loading data</td></tr>';
    }
  }

  private async renderLogTable(): Promise<void> {
    const container = document.getElementById('log-table');
    if (!container) {
      console.error('Log table container not found');
      return;
    }

    try {
      const entries = (await logDB.getEntries())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, UI_CONSTANTS.TABLE_LIMIT);

      if (entries.length === 0) {
        container.innerHTML =
          '<tr><td colspan="4" class="text-center py-4 text-gray-500">No log entries yet</td></tr>';
        return;
      }

      container.innerHTML = entries
        .map((entry) => {
          const date = new Date(entry.date);
          const mobileDate = format(date, 'MMM dd');
          const fullDate = format(date, 'MMM dd, yyyy');

          // Truncate note to ~50 chars for table display
          const truncatedNote =
            entry.note.length > 50 ? entry.note.substring(0, 50) + '...' : entry.note;

          return `
        <tr class="border-b border-gray-100 cursor-pointer sm:cursor-default log-row-entry" data-entry-id="${entry.id}">
          <td class="py-2">
            <span class="sm:hidden">${mobileDate}</span>
            <span class="hidden sm:inline">${fullDate}</span>
            <div class="text-xs text-gray-500 sm:hidden">${format(date, 'HH:mm')}</div>
          </td>
          <td class="py-2 hidden sm:table-cell">${format(date, 'HH:mm')}</td>
          <td class="py-2">
            <span class="line-clamp-1">${truncatedNote}</span>
          </td>
          <td class="py-2 hidden sm:table-cell">
            <div class="flex gap-2">
              <button onclick="editLogEntry('${entry.id}')" 
                      class="text-blue-600 hover:text-blue-800 text-xs">
                Edit
              </button>
              <button onclick="deleteLogEntry('${entry.id}')" 
                      class="text-red-600 hover:text-red-800 text-xs">
                Delete
              </button>
            </div>
          </td>
        </tr>
        <tr class="mobile-log-actions-row hidden" data-entry-id="${entry.id}">
          <td colspan="3" class="py-2 sm:hidden">
            <div class="bg-gray-50 px-4 py-2 rounded">
              <div class="text-sm text-gray-700 mb-2 whitespace-pre-wrap">${entry.note}</div>
              <div class="flex gap-2 justify-center">
                <button onclick="editLogEntry('${entry.id}')" 
                        class="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-300 rounded">
                  Edit
                </button>
                <button onclick="deleteLogEntry('${entry.id}')" 
                        class="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-300 rounded">
                  Delete
                </button>
                <button onclick="closeLogMobileActions('${entry.id}')" 
                        class="text-gray-600 hover:text-gray-800 text-sm px-3 py-1 border border-gray-300 rounded">
                  Close
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
        })
        .join('');

      // Add event listeners for mobile row taps
      this.setupMobileLogInteractions();
    } catch (error) {
      console.error('Error rendering log table:', error);
      container.innerHTML =
        '<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading log data</td></tr>';
    }
  }

  private setupMobileLogInteractions(): void {
    document.querySelectorAll('.log-row-entry').forEach((row) => {
      row.addEventListener('click', (e) => {
        // Only handle clicks on mobile (screens smaller than sm breakpoint)
        if (window.innerWidth >= 640) return;

        // Don't trigger if clicking on buttons
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;

        const entryId = row.getAttribute('data-entry-id');
        const actionRow = document.querySelector(
          `.mobile-log-actions-row[data-entry-id="${entryId}"]`
        );

        if (actionRow) {
          // Hide all other action rows
          document.querySelectorAll('.mobile-log-actions-row').forEach((otherRow) => {
            if (otherRow !== actionRow) {
              otherRow.classList.add('hidden');
            }
          });

          // Toggle current action row
          actionRow.classList.toggle('hidden');
        }
      });
    });
  }

  private setupMobileTableInteractions(): void {
    document.querySelectorAll('.table-row-entry').forEach((row) => {
      row.addEventListener('click', (e) => {
        // Only handle clicks on mobile (screens smaller than sm breakpoint)
        if (window.innerWidth >= 640) {
          return;
        }

        const entryId = (e.currentTarget as HTMLElement).getAttribute('data-entry-id');
        if (!entryId) {
          return;
        }

        // Hide all other mobile action rows
        document.querySelectorAll('.mobile-actions-row').forEach((actionRow) => {
          if (actionRow.getAttribute('data-entry-id') !== entryId) {
            actionRow.classList.add('hidden');
          }
        });

        // Toggle this row's actions
        const actionRow = document.querySelector(`.mobile-actions-row[data-entry-id="${entryId}"]`);
        if (actionRow) {
          actionRow.classList.toggle('hidden');
        }
      });
    });
  }

  private async exportToJson(): Promise<void> {
    const bloodPressureEntries = (await this.getEntries()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const logEntries = (await logDB.getEntries()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (bloodPressureEntries.length === 0 && logEntries.length === 0) {
      this.banner.show('No data to export. Add some entries first.', 'warning', 5000);
      return;
    }

    // Create data array with typed entry collections
    const dataArray = [
      { type: 'health', entries: bloodPressureEntries },
      { type: 'log', entries: logEntries },
    ];

    // Calculate checksum of the entire data array
    const encoder = new TextEncoder();
    const dataString = JSON.stringify(dataArray);
    const data = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Create export data with manifest and data array
    const exportData = {
      manifest: {
        format: 'health-dashboard-export',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        totalHealthEntries: bloodPressureEntries.length,
        totalLogEntries: logEntries.length,
        checksum: `sha256-${checksum}`,
      },
      data: dataArray,
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-data-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private handleFileImport(file: File): void {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        this.banner.show('Error reading file. Please try again.', 'error', 5000);
        return;
      }

      try {
        let parsedData: { bloodPressureEntries: BloodPressureEntry[]; logEntries: LogEntry[] };

        if (file.name.toLowerCase().endsWith('.json')) {
          parsedData = this.parseJsonFile(content);
        } else {
          this.banner.show('Unsupported file type. Please use JSON files.', 'error', 5000);
          return;
        }

        if (parsedData.bloodPressureEntries.length === 0 && parsedData.logEntries.length === 0) {
          this.banner.show('No valid entries found in the file.', 'warning', 5000);
          return;
        }

        this.showImportConfirmation(parsedData.bloodPressureEntries, parsedData.logEntries);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        this.banner.show(`Error parsing file: ${message}`, 'error', 8000);
      }
    };

    reader.readAsText(file);
  }

  private parseJsonFile(content: string): {
    bloodPressureEntries: BloodPressureEntry[];
    logEntries: LogEntry[];
  } {
    const data = JSON.parse(content);
    let bloodPressureEntries: any[] = [];
    let logEntries: any[] = [];
    let hasManifest = false;
    let hasChecksum = false;

    // Handle export format with manifest
    if (data.manifest && data.data) {
      hasManifest = true;

      // Verify format
      if (data.manifest.format !== 'health-dashboard-export') {
        throw new Error('Unsupported export format. Expected health-dashboard-export format.');
      }

      // Handle v2.0.0 format (array of typed entry collections)
      if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].type) {
        data.data.forEach((collection: any) => {
          if (collection.type === 'health' && Array.isArray(collection.entries)) {
            bloodPressureEntries = collection.entries;
          } else if (collection.type === 'log' && Array.isArray(collection.entries)) {
            logEntries = collection.entries;
          }
        });
      }
      // Handle v1.0.0 format (direct array of health entries)
      else if (Array.isArray(data.data)) {
        bloodPressureEntries = data.data;
      } else {
        throw new Error('Invalid data format in manifest-based export.');
      }

      // Verify checksum if present
      if (data.manifest.checksum) {
        hasChecksum = true;
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(JSON.stringify(data.data));
        crypto.subtle.digest('SHA-256', dataBytes).then((hashBuffer) => {
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const computedChecksum = `sha256-${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
          if (computedChecksum !== data.manifest.checksum) {
            console.warn('Checksum mismatch - data may be corrupted');
            this.banner.show(
              'Warning: Data checksum mismatch detected. The file may be corrupted.',
              'warning',
              8000
            );
          }
        });
      }
    }
    // Handle legacy formats (health entries only)
    else if (Array.isArray(data)) {
      bloodPressureEntries = data;
    } else if (data.entries && Array.isArray(data.entries)) {
      bloodPressureEntries = data.entries;
    } else {
      throw new Error(
        'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
      );
    }

    // Warn user if no manifest or checksum
    if (!hasManifest) {
      this.banner.show(
        'Warning: Importing file without manifest. Data integrity cannot be verified.',
        'warning',
        6000
      );
    } else if (!hasChecksum) {
      this.banner.show(
        'Warning: No checksum found in file. Data integrity cannot be verified.',
        'warning',
        6000
      );
    }

    // Validate and transform health entries
    const validatedBloodPressureEntries = bloodPressureEntries.map((entry: any, index: number) => {
      if (!entry.systolic || !entry.diastolic || !entry.heartRate || !entry.date) {
        throw new Error(`Missing required fields in health entry ${index + 1}`);
      }

      // Validate numeric ranges
      const systolic = Number(entry.systolic);
      const diastolic = Number(entry.diastolic);
      const heartRate = Number(entry.heartRate);

      if (systolic < HEALTH_RANGES.SYSTOLIC.MIN || systolic > HEALTH_RANGES.SYSTOLIC.MAX) {
        throw new Error(
          `Invalid systolic value (${systolic}) in health entry ${index + 1}. Must be ${HEALTH_RANGES.SYSTOLIC.MIN}-${HEALTH_RANGES.SYSTOLIC.MAX}.`
        );
      }
      if (diastolic < HEALTH_RANGES.DIASTOLIC.MIN || diastolic > HEALTH_RANGES.DIASTOLIC.MAX) {
        throw new Error(
          `Invalid diastolic value (${diastolic}) in health entry ${index + 1}. Must be ${HEALTH_RANGES.DIASTOLIC.MIN}-${HEALTH_RANGES.DIASTOLIC.MAX}.`
        );
      }
      if (heartRate < HEALTH_RANGES.HEART_RATE.MIN || heartRate > HEALTH_RANGES.HEART_RATE.MAX) {
        throw new Error(
          `Invalid heart rate (${heartRate}) in health entry ${index + 1}. Must be ${HEALTH_RANGES.HEART_RATE.MIN}-${HEALTH_RANGES.HEART_RATE.MAX}.`
        );
      }

      // Validate and normalize date
      const date = new Date(entry.date);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format in health entry ${index + 1}`);
      }

      return {
        id: crypto.randomUUID(), // Generate new ID to avoid conflicts
        date: date.toISOString(),
        systolic,
        diastolic,
        heartRate,
      };
    });

    // Validate and transform log entries
    const validatedLogEntries = logEntries.map((entry: any, index: number) => {
      if (!entry.note || !entry.date) {
        throw new Error(`Missing required fields in log entry ${index + 1}`);
      }

      // Validate and normalize date
      const date = new Date(entry.date);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format in log entry ${index + 1}`);
      }

      return {
        id: crypto.randomUUID(), // Generate new ID to avoid conflicts
        date: date.toISOString(),
        note: entry.note,
      };
    });

    return {
      bloodPressureEntries: validatedBloodPressureEntries,
      logEntries: validatedLogEntries,
    };
  }

  private async showImportConfirmation(
    bloodPressureEntries: BloodPressureEntry[],
    logEntries: LogEntry[]
  ): Promise<void> {
    const existingBloodPressureEntries = await this.getEntries();
    const existingLogEntries = await logDB.getEntries();

    const message = `Found ${bloodPressureEntries.length} blood pressure entries and ${logEntries.length} log entries to import.<br><br>Current data: ${existingBloodPressureEntries.length} blood pressure entries, ${existingLogEntries.length} log entries<br><br>Choose how to import:`;

    this.modal.showImportConfirm(
      'Import Data',
      message,
      bloodPressureEntries.length + logEntries.length,
      existingBloodPressureEntries.length + existingLogEntries.length,
      async () => {
        // Replace mode
        try {
          // Show loading state
          this.modal.updateModalContent(
            'Importing Data',
            'Replacing all existing data...<br><br>Please wait...',
            'Working...'
          );

          await bloodPressureDB.replaceAllEntries(bloodPressureEntries);
          await logDB.replaceAllEntries(logEntries);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await this.refreshAfterImport();

          // Show success
          this.modal.updateModalContent(
            'Import Successful',
            `Successfully imported ${bloodPressureEntries.length} blood pressure entries and ${logEntries.length} log entries.<br><br>All previous data has been replaced.`,
            'OK',
            () => this.clearFileInput()
          );
        } catch (error) {
          console.error('Error during import:', error);
          this.modal.updateModalContent(
            'Import Error',
            'An error occurred during import. Please try again.',
            'OK',
            () => this.clearFileInput()
          );
        }
      },
      async () => {
        // Merge mode
        try {
          // Show loading state
          this.modal.updateModalContent(
            'Importing Data',
            'Merging with existing data...<br><br>Please wait...',
            'Working...'
          );

          await Promise.all(
            bloodPressureEntries.map((entry: BloodPressureEntry) =>
              bloodPressureDB.saveEntry(entry)
            )
          );
          await Promise.all(logEntries.map((entry: LogEntry) => logDB.saveEntry(entry)));
          await new Promise((resolve) => setTimeout(resolve, 100));
          await this.refreshAfterImport();

          // Show success
          this.modal.updateModalContent(
            'Import Successful',
            `Successfully imported ${bloodPressureEntries.length} blood pressure entries and ${logEntries.length} log entries.<br><br>Total: ${existingBloodPressureEntries.length + bloodPressureEntries.length} blood pressure entries, ${existingLogEntries.length + logEntries.length} log entries`,
            'OK',
            () => this.clearFileInput()
          );
        } catch (error) {
          console.error('Error during import:', error);
          this.modal.updateModalContent(
            'Import Error',
            'An error occurred during import. Please try again.',
            'OK',
            () => this.clearFileInput()
          );
        }
      }
    );
  }

  private async refreshAfterImport(): Promise<void> {
    // Refresh the display
    await this.renderChart();
    await this.renderSummary();
    await this.renderTable();
    await this.renderLogTable();
  }

  private clearFileInput(): void {
    // Clear the file input
    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    document.getElementById('import-filename')!.textContent = '';
  }

  private deleteAllData(): void {
    this.modal.showConfirm(
      'Delete All Data',
      'Are you sure you want to delete all your health data? This action cannot be undone and will permanently remove all entries from this device.',
      async () => {
        try {
          await bloodPressureDB.clearAllEntries();
          await logDB.clearAllEntries();
          await this.refreshAfterImport();
          this.modal.showAlert('Data Deleted', 'All data has been successfully deleted.');
        } catch (error) {
          console.error('Error deleting all data:', error);
          this.modal.showAlert(
            'Delete Error',
            'An error occurred while deleting the data. Please try again.'
          );
        }
      }
    );
  }
}

// Global functions for health entry management
(window as any).editEntry = async (id: string) => {
  const entry = await bloodPressureDB.getEntry(id);
  if (!entry) {
    return;
  }

  const modal = new Modal();
  modal.showEditForm(
    'Edit Health Entry',
    {
      systolic: entry.systolic,
      diastolic: entry.diastolic,
      heartRate: entry.heartRate,
    },
    async (data) => {
      const updatedEntry: BloodPressureEntry = {
        ...entry,
        systolic: data.systolic,
        diastolic: data.diastolic,
        heartRate: data.heartRate,
      };

      await bloodPressureDB.updateEntry(updatedEntry);
      window.location.reload();
    }
  );
};

(window as any).deleteBloodPressureEntry = async (id: string) => {
  const modal = new Modal();
  modal.showConfirm(
    'Delete Entry',
    'Are you sure you want to delete this health entry? This action cannot be undone.',
    async () => {
      await bloodPressureDB.deleteEntry(id);
      window.location.reload();
    }
  );
};

(window as any).closeMobileActions = (id: string) => {
  const actionRow = document.querySelector(`.mobile-actions-row[data-entry-id="${id}"]`);
  if (actionRow) {
    actionRow.classList.add('hidden');
  }
};

// Global functions for log entry management
(window as any).editLogEntry = async (id: string) => {
  const entry = await logDB.getEntry(id);
  if (!entry) {
    return;
  }

  const modal = new Modal();
  modal.showEditLogForm('Edit Log Entry', entry.note, async (note: string) => {
    const updatedEntry: LogEntry = {
      ...entry,
      note: note,
    };

    await logDB.updateEntry(updatedEntry);
    window.location.reload();
  });
};

(window as any).deleteLogEntry = async (id: string) => {
  const modal = new Modal();
  modal.showConfirm(
    'Delete Entry',
    'Are you sure you want to delete this log entry? This action cannot be undone.',
    async () => {
      await logDB.deleteEntry(id);
      window.location.reload();
    }
  );
};

(window as any).closeLogMobileActions = (id: string) => {
  const actionRow = document.querySelector(`.mobile-log-actions-row[data-entry-id="${id}"]`);
  if (actionRow) {
    actionRow.classList.add('hidden');
  }
};

// Initialize the app
const healthDashboard = new HealthDashboard();

// Make dashboard accessible for testing
(window as any).healthDashboard = healthDashboard;
