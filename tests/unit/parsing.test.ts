import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDOM } from './utils/dom-utils';

// Mock chart.js and date-fns
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'mocked-date'),
  subDays: vi.fn(),
  subMonths: vi.fn(),
  subYears: vi.fn(),
  isAfter: vi.fn(),
}));

// Health data validation constants (copied from main.ts)
const HEALTH_RANGES = {
  SYSTOLIC: { MIN: 60, MAX: 250 },
  DIASTOLIC: { MIN: 40, MAX: 150 },
  HEART_RATE: { MIN: 30, MAX: 220 },
} as const;

// Simplified parsing functions for testing (extracted from main.ts logic)
function parseJsonContent(content: string): any[] {
  const data = JSON.parse(content);
  let entries: any[];

  // Handle export format with manifest
  if (data.manifest && data.data) {
    // Verify format
    if (data.manifest.format !== 'health-dashboard-export') {
      throw new Error('Unsupported export format. Expected health-dashboard-export format.');
    }

    // Expect JSON array format
    if (!Array.isArray(data.data)) {
      throw new Error('Invalid data format. Expected array of entries.');
    }

    entries = data.data;
  }
  // Handle legacy formats
  else if (Array.isArray(data)) {
    entries = data;
  } else if (data.entries && Array.isArray(data.entries)) {
    entries = data.entries;
  } else {
    throw new Error(
      'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
    );
  }

  return entries.map((entry, index) => {
    if (!entry.systolic || !entry.diastolic || !entry.heartRate || !entry.date) {
      throw new Error(`Missing required fields in entry ${index + 1}`);
    }

    // Validate numeric ranges
    const systolic = Number(entry.systolic);
    const diastolic = Number(entry.diastolic);
    const heartRate = Number(entry.heartRate);

    if (systolic < HEALTH_RANGES.SYSTOLIC.MIN || systolic > HEALTH_RANGES.SYSTOLIC.MAX) {
      throw new Error(
        `Invalid systolic value (${systolic}) in entry ${index + 1}. Must be ${HEALTH_RANGES.SYSTOLIC.MIN}-${HEALTH_RANGES.SYSTOLIC.MAX}.`
      );
    }
    if (diastolic < HEALTH_RANGES.DIASTOLIC.MIN || diastolic > HEALTH_RANGES.DIASTOLIC.MAX) {
      throw new Error(
        `Invalid diastolic value (${diastolic}) in entry ${index + 1}. Must be ${HEALTH_RANGES.DIASTOLIC.MIN}-${HEALTH_RANGES.DIASTOLIC.MAX}.`
      );
    }
    if (heartRate < HEALTH_RANGES.HEART_RATE.MIN || heartRate > HEALTH_RANGES.HEART_RATE.MAX) {
      throw new Error(
        `Invalid heart rate (${heartRate}) in entry ${index + 1}. Must be ${HEALTH_RANGES.HEART_RATE.MIN}-${HEALTH_RANGES.HEART_RATE.MAX}.`
      );
    }

    // Validate and normalize date
    const date = new Date(entry.date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format in entry ${index + 1}`);
    }

    return {
      id: crypto.randomUUID(),
      date: date.toISOString(),
      systolic,
      diastolic,
      heartRate,
    };
  });
}

function parseCsvContent(content: string): any[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row.');
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  // Check for required headers (flexible matching)
  const requiredFields = ['date', 'systolic', 'diastolic', 'heart rate'];
  const headerMap: { [key: string]: number } = {};

  requiredFields.forEach((field) => {
    const index = headers.findIndex(
      (h) =>
        h.includes(field.replace(' ', '')) ||
        h.includes(field) ||
        (field === 'systolic' && h.includes('systolic')) ||
        (field === 'diastolic' && h.includes('diastolic')) ||
        (field === 'heart rate' && (h.includes('heart') || h.includes('hr') || h.includes('bpm')))
    );

    if (index === -1) {
      throw new Error(`Required column '${field}' not found in CSV headers: ${headers.join(', ')}`);
    }
    headerMap[field] = index;
  });

  // Find time column if it exists
  const timeIndex = headers.findIndex((h) => h.includes('time'));

  return lines
    .slice(1)
    .map((line, index) => {
      if (!line.trim()) {
        return null;
      } // Skip empty lines

      const values = line.split(',').map((v) => v.trim());

      if (values.length !== headers.length) {
        throw new Error(
          `Row ${index + 2} has ${values.length} columns, expected ${headers.length}`
        );
      }

      const systolic = Number(values[headerMap['systolic']]);
      const diastolic = Number(values[headerMap['diastolic']]);
      const heartRate = Number(values[headerMap['heart rate']]);

      // Validate numeric values
      if (isNaN(systolic) || isNaN(diastolic) || isNaN(heartRate)) {
        throw new Error(`Invalid numeric values in row ${index + 2}`);
      }

      if (systolic < HEALTH_RANGES.SYSTOLIC.MIN || systolic > HEALTH_RANGES.SYSTOLIC.MAX) {
        throw new Error(
          `Invalid systolic value (${systolic}) in row ${index + 2}. Must be ${HEALTH_RANGES.SYSTOLIC.MIN}-${HEALTH_RANGES.SYSTOLIC.MAX}.`
        );
      }
      if (diastolic < HEALTH_RANGES.DIASTOLIC.MIN || diastolic > HEALTH_RANGES.DIASTOLIC.MAX) {
        throw new Error(
          `Invalid diastolic value (${diastolic}) in row ${index + 2}. Must be ${HEALTH_RANGES.DIASTOLIC.MIN}-${HEALTH_RANGES.DIASTOLIC.MAX}.`
        );
      }
      if (heartRate < HEALTH_RANGES.HEART_RATE.MIN || heartRate > HEALTH_RANGES.HEART_RATE.MAX) {
        throw new Error(
          `Invalid heart rate (${heartRate}) in row ${index + 2}. Must be ${HEALTH_RANGES.HEART_RATE.MIN}-${HEALTH_RANGES.HEART_RATE.MAX}.`
        );
      }

      // Parse date and time
      let dateStr = values[headerMap['date']];
      if (timeIndex !== -1 && values[timeIndex]) {
        dateStr += ' ' + values[timeIndex];
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format '${dateStr}' in row ${index + 2}`);
      }

      return {
        id: crypto.randomUUID(),
        date: date.toISOString(),
        systolic,
        diastolic,
        heartRate,
      };
    })
    .filter((entry) => entry !== null);
}

describe('CSV/JSON Parsing', () => {
  beforeEach(() => {
    createMockDOM();
  });

  describe('JSON Parsing', () => {
    describe('Valid JSON Data', () => {
      it('should parse array format successfully', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
          {
            date: '2023-01-02T12:00:00.000Z',
            systolic: 125,
            diastolic: 82,
            heartRate: 72,
          },
        ];

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(2);
        expect(result[0].systolic).toBe(120);
        expect(result[1].systolic).toBe(125);
      });

      it('should parse new export format with manifest successfully', () => {
        const jsonData = {
          manifest: {
            format: 'health-dashboard-export',
            version: '1.0.0',
            exportedAt: '2023-01-01T00:00:00.000Z',
            totalEntries: 1,
            checksum: 'sha256-test-checksum',
          },
          data: [
            {
              date: '2023-01-01T12:00:00.000Z',
              systolic: 120,
              diastolic: 80,
              heartRate: 70,
            },
          ],
        };

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(1);
        expect(result[0].systolic).toBe(120);
      });

      it('should parse object with entries property successfully', () => {
        const jsonData = {
          exportDate: '2023-01-01T00:00:00.000Z',
          totalEntries: 1,
          entries: [
            {
              date: '2023-01-01T12:00:00.000Z',
              systolic: 120,
              diastolic: 80,
              heartRate: 70,
            },
          ],
        };

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(1);
        expect(result[0].systolic).toBe(120);
      });

      it('should accept various date formats', () => {
        const jsonData = [
          {
            date: '2023-01-01',
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
          {
            date: '01/01/2023',
            systolic: 125,
            diastolic: 82,
            heartRate: 72,
          },
        ];

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(2);
        expect(new Date(result[0].date)).toBeInstanceOf(Date);
        expect(new Date(result[1].date)).toBeInstanceOf(Date);
      });

      it('should handle string numbers correctly', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: '120',
            diastolic: '80',
            heartRate: '70',
          },
        ];

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(1);
        expect(result[0].systolic).toBe(120);
        expect(result[0].diastolic).toBe(80);
        expect(result[0].heartRate).toBe(70);
      });
    });

    describe('Invalid JSON Structure', () => {
      it('should throw error for invalid JSON syntax', () => {
        const invalidJson = '{ invalid json }';
        expect(() => parseJsonContent(invalidJson)).toThrow();
      });

      it('should throw error for unsupported export format', () => {
        const invalidData = {
          manifest: {
            format: 'unknown-format',
            version: '1.0.0',
          },
          data: [],
        };
        expect(() => parseJsonContent(JSON.stringify(invalidData))).toThrow(
          'Unsupported export format. Expected health-dashboard-export format.'
        );
      });

      it('should throw error for manifest with non-array data', () => {
        const invalidData = {
          manifest: {
            format: 'health-dashboard-export',
            version: '1.0.0',
          },
          data: 'not-an-array',
        };
        expect(() => parseJsonContent(JSON.stringify(invalidData))).toThrow(
          'Invalid data format. Expected array of entries.'
        );
      });

      it('should throw error for non-array, non-object-with-entries', () => {
        const invalidData = { someOtherProperty: 'value' };
        expect(() => parseJsonContent(JSON.stringify(invalidData))).toThrow(
          'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
        );
      });

      it('should throw error for primitive values', () => {
        expect(() => parseJsonContent('"just a string"')).toThrow(
          'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
        );
        expect(() => parseJsonContent('123')).toThrow(
          'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
        );
        expect(() => parseJsonContent('true')).toThrow(
          'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
        );
      });

      it('should throw error for object with non-array entries', () => {
        const invalidData = { entries: 'not an array' };
        expect(() => parseJsonContent(JSON.stringify(invalidData))).toThrow(
          'Invalid JSON format. Expected export format with manifest, array of entries, or object with entries property.'
        );
      });
    });

    describe('Missing Required Fields', () => {
      it('should throw error for missing systolic field', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });

      it('should throw error for missing diastolic field', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });

      it('should throw error for missing heartRate field', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 80,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });

      it('should throw error for missing date field', () => {
        const jsonData = [
          {
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });

      it('should report correct entry number for multiple entries', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
          {
            date: '2023-01-02T12:00:00.000Z',
            systolic: 125,
            diastolic: 82,
            // missing heartRate
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 2'
        );
      });
    });

    describe('Invalid Numeric Ranges', () => {
      it('should throw error for systolic value too low', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 30, // Below minimum of 60
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid systolic value (30) in entry 1. Must be 60-250.'
        );
      });

      it('should throw error for systolic value too high', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 300, // Above maximum of 250
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid systolic value (300) in entry 1. Must be 60-250.'
        );
      });

      it('should throw error for diastolic value too low', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 20, // Below minimum of 40
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid diastolic value (20) in entry 1. Must be 40-150.'
        );
      });

      it('should throw error for diastolic value too high', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 200, // Above maximum of 150
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid diastolic value (200) in entry 1. Must be 40-150.'
        );
      });

      it('should throw error for heart rate too low', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 80,
            heartRate: 20, // Below minimum of 30
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid heart rate (20) in entry 1. Must be 30-220.'
        );
      });

      it('should throw error for heart rate too high', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 120,
            diastolic: 80,
            heartRate: 300, // Above maximum of 220
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid heart rate (300) in entry 1. Must be 30-220.'
        );
      });

      it('should validate boundary values correctly', () => {
        const jsonData = [
          {
            date: '2023-01-01T12:00:00.000Z',
            systolic: 60, // Minimum valid
            diastolic: 40, // Minimum valid
            heartRate: 30, // Minimum valid
          },
          {
            date: '2023-01-02T12:00:00.000Z',
            systolic: 250, // Maximum valid
            diastolic: 150, // Maximum valid
            heartRate: 220, // Maximum valid
          },
        ];

        const result = parseJsonContent(JSON.stringify(jsonData));
        expect(result).toHaveLength(2);
        expect(result[0].systolic).toBe(60);
        expect(result[1].systolic).toBe(250);
      });
    });

    describe('Invalid Date Formats', () => {
      it('should throw error for invalid date string', () => {
        const jsonData = [
          {
            date: 'not a date',
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Invalid date format in entry 1'
        );
      });

      it('should throw error for empty date string', () => {
        const jsonData = [
          {
            date: '',
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });

      it('should throw error for null date', () => {
        const jsonData = [
          {
            date: null,
            systolic: 120,
            diastolic: 80,
            heartRate: 70,
          },
        ];

        expect(() => parseJsonContent(JSON.stringify(jsonData))).toThrow(
          'Missing required fields in entry 1'
        );
      });
    });
  });

  describe('CSV Parsing', () => {
    describe('Valid CSV Data', () => {
      it('should parse standard CSV format successfully', () => {
        const csvData = `Date,Time,Systolic BP,Diastolic BP,Heart Rate
2023-01-01,12:00:00,120,80,70
2023-01-02,13:00:00,125,82,72`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(2);
        expect(result[0].systolic).toBe(120);
        expect(result[1].systolic).toBe(125);
      });

      it('should parse CSV without time column', () => {
        const csvData = `Date,Systolic BP,Diastolic BP,Heart Rate
2023-01-01,120,80,70
2023-01-02,125,82,72`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(2);
        expect(result[0].systolic).toBe(120);
      });

      it('should handle flexible header matching', () => {
        const csvData = `date,systolic,diastolic,hr
2023-01-01,120,80,70
2023-01-02,125,82,72`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(2);
        expect(result[0].heartRate).toBe(70);
      });

      it('should handle alternative heart rate column names', () => {
        const testCases = [
          'Date,Systolic,Diastolic,Heart Rate',
          'Date,Systolic,Diastolic,HR',
          'Date,Systolic,Diastolic,BPM',
          'Date,Systolic,Diastolic,heart',
        ];

        testCases.forEach((header) => {
          const csvData = `${header}
2023-01-01,120,80,70`;

          const result = parseCsvContent(csvData);
          expect(result).toHaveLength(1);
          expect(result[0].heartRate).toBe(70);
        });
      });

      it('should skip empty lines', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,70

2023-01-02,125,82,72
`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(2);
      });

      it('should handle whitespace in values', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
 2023-01-01 , 120 , 80 , 70 
2023-01-02,125,82,72`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(2);
        expect(result[0].systolic).toBe(120);
      });
    });

    describe('Invalid CSV Structure', () => {
      it('should throw error for empty CSV', () => {
        expect(() => parseCsvContent('')).toThrow(
          'CSV file must have at least a header row and one data row.'
        );
      });

      it('should throw error for header-only CSV', () => {
        const csvData = 'Date,Systolic,Diastolic,Heart Rate';
        expect(() => parseCsvContent(csvData)).toThrow(
          'CSV file must have at least a header row and one data row.'
        );
      });

      it('should throw error for missing required columns', () => {
        const csvData = `Date,Systolic,Diastolic
2023-01-01,120,80`;

        expect(() => parseCsvContent(csvData)).toThrow(
          "Required column 'heart rate' not found in CSV headers"
        );
      });

      it('should list available headers in error message', () => {
        const csvData = `Date,Systolic,Diastolic,SomeOtherColumn
2023-01-01,120,80,value`;

        expect(() => parseCsvContent(csvData)).toThrow(
          'date, systolic, diastolic, someothercolumn'
        );
      });

      it('should throw error for row with wrong number of columns', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,70
2023-01-02,125,82`; // Missing heart rate

        expect(() => parseCsvContent(csvData)).toThrow('Row 3 has 3 columns, expected 4');
      });
    });

    describe('Invalid CSV Values', () => {
      it('should throw error for non-numeric systolic value', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,abc,80,70`;

        expect(() => parseCsvContent(csvData)).toThrow('Invalid numeric values in row 2');
      });

      it('should throw error for non-numeric diastolic value', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,abc,70`;

        expect(() => parseCsvContent(csvData)).toThrow('Invalid numeric values in row 2');
      });

      it('should throw error for non-numeric heart rate value', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,abc`;

        expect(() => parseCsvContent(csvData)).toThrow('Invalid numeric values in row 2');
      });

      it('should throw error for systolic value out of range', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,30,80,70`;

        expect(() => parseCsvContent(csvData)).toThrow(
          'Invalid systolic value (30) in row 2. Must be 60-250.'
        );
      });

      it('should throw error for diastolic value out of range', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,200,70`;

        expect(() => parseCsvContent(csvData)).toThrow(
          'Invalid diastolic value (200) in row 2. Must be 40-150.'
        );
      });

      it('should throw error for heart rate value out of range', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,300`;

        expect(() => parseCsvContent(csvData)).toThrow(
          'Invalid heart rate (300) in row 2. Must be 30-220.'
        );
      });

      it('should throw error for invalid date format', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
not-a-date,120,80,70`;

        expect(() => parseCsvContent(csvData)).toThrow("Invalid date format 'not-a-date' in row 2");
      });

      it('should handle date and time combination', () => {
        const csvData = `Date,Time,Systolic,Diastolic,Heart Rate
2023-01-01,12:00:00,120,80,70`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(1);
        expect(new Date(result[0].date)).toBeInstanceOf(Date);
      });

      it('should throw error for invalid date and time combination', () => {
        const csvData = `Date,Time,Systolic,Diastolic,Heart Rate
not-a-date,not-a-time,120,80,70`;

        expect(() => parseCsvContent(csvData)).toThrow(
          "Invalid date format 'not-a-date not-a-time' in row 2"
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle single data row', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,70`;

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(1);
        expect(result[0].systolic).toBe(120);
      });

      it('should handle many data rows', () => {
        let csvData = 'Date,Systolic,Diastolic,Heart Rate\n';
        for (let i = 0; i < 28; i++) {
          // Use 28 to avoid invalid dates like Jan 32
          csvData += `2023-01-${String(i + 1).padStart(2, '0')},120,80,70\n`;
        }

        const result = parseCsvContent(csvData);
        expect(result).toHaveLength(28);
      });

      it('should generate unique IDs for each entry', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
2023-01-01,120,80,70
2023-01-02,120,80,70`;

        const result = parseCsvContent(csvData);
        expect(result[0].id).not.toBe(result[1].id);
        expect(result[0].id).toBeTruthy(); // Just check that IDs exist (crypto.randomUUID is mocked)
        expect(result[1].id).toBeTruthy();
      });

      it('should normalize dates to ISO format', () => {
        const csvData = `Date,Systolic,Diastolic,Heart Rate
01/01/2023,120,80,70`;

        const result = parseCsvContent(csvData);
        expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });
  });

  describe('Error Reporting Quality', () => {
    it('should provide helpful error messages for JSON parsing', () => {
      const tests = [
        {
          input: '{ malformed json',
          expectedError: /Expected property name/,
        },
        {
          input: JSON.stringify([
            { date: '2023-01-01', systolic: 30, diastolic: 80, heartRate: 70 },
          ]),
          expectedError: /Invalid systolic value \(30\) in entry 1\. Must be 60-250\./,
        },
        {
          input: JSON.stringify([
            { date: 'invalid-date', systolic: 120, diastolic: 80, heartRate: 70 },
          ]),
          expectedError: /Invalid date format in entry 1/,
        },
      ];

      tests.forEach(({ input, expectedError }) => {
        expect(() => parseJsonContent(input)).toThrow(expectedError);
      });
    });

    it('should provide helpful error messages for CSV parsing', () => {
      const tests = [
        {
          input: 'Date,Systolic\n2023-01-01,120',
          expectedError: /Required column 'diastolic' not found/,
        },
        {
          input: 'Date,Systolic,Diastolic,Heart Rate\n2023-01-01,120,80',
          expectedError: /Row 2 has 3 columns, expected 4/,
        },
        {
          input: 'Date,Systolic,Diastolic,Heart Rate\n2023-01-01,abc,80,70',
          expectedError: /Invalid numeric values in row 2/,
        },
      ];

      tests.forEach(({ input, expectedError }) => {
        expect(() => parseCsvContent(input)).toThrow(expectedError);
      });
    });
  });
});
