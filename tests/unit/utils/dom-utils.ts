// DOM utilities for testing
export function createMockDOM() {
  document.body.innerHTML = `
    <div id="app">
      <h1 id="main-header">Health Dashboard</h1>
      <form id="health-form">
        <input id="systolic" name="systolic" type="number" />
        <input id="diastolic" name="diastolic" type="number" />
        <input id="heartRate" name="heartRate" type="number" />
        <button type="submit">Submit</button>
      </form>
      
      <div id="latest-reading">--/-- mmHg</div>
      <div id="latest-hr">-- bpm</div>
      <div id="latest-date">No data</div>
      <div id="avg-reading">--/-- mmHg</div>
      <div id="avg-hr-display">-- bpm</div>
      <div id="entry-count">0 entries</div>
      
      <div class="chart-period-btn" data-period="week"></div>
      <div class="chart-period-btn" data-period="month"></div>
      <div class="chart-period-btn" data-period="3months"></div>
      <div class="chart-period-btn" data-period="6months"></div>
      <div class="chart-period-btn" data-period="year"></div>
      <div class="chart-period-btn" data-period="all"></div>
      
      <button id="export-json-btn">Export JSON</button>
      <button id="import-btn">Import</button>
      <input id="import-file-input" type="file" />
      <span id="import-filename"></span>
      
      <canvas id="healthChart"></canvas>
      <div id="data-table"></div>
      <button id="info-toggle">Info</button>
      <div id="info-section" class="hidden"></div>
    </div>
  `;
}

export function getMockFormData(systolic: number, diastolic: number, heartRate: number) {
  const formData = new FormData();
  formData.set('systolic', systolic.toString());
  formData.set('diastolic', diastolic.toString());
  formData.set('heartRate', heartRate.toString());
  return formData;
}

export function createMockEvent(type: string, target?: HTMLElement): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (target) {
    Object.defineProperty(event, 'target', { value: target, enumerable: true });
  }
  return event;
}

export function createMockSubmitEvent(form: HTMLFormElement): SubmitEvent {
  const event = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent;
  Object.defineProperty(event, 'target', { value: form, enumerable: true });
  return event;
}
