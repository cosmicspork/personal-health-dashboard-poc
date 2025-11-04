export interface BloodPressureEntry {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  updatedAt?: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string | number | boolean | object;
  updatedAt: string;
}

export interface DatabaseMetadata {
  id: string;
  schemaVersion: number;
  migratedFrom?: string;
  migratedAt?: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  date: string;
  note: string;
  updatedAt?: string;
}
