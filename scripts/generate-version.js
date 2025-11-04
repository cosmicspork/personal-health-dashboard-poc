#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Read package.json to get current version
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  // Create version.json content
  const versionInfo = {
    appVersion: packageJson.version,
    releasedAt: new Date().toISOString(),
    changelogUrl: '/changelog.json'
  };
  
  // Ensure public directory exists
  const publicDir = join(__dirname, '..', 'public');
  try {
    mkdirSync(publicDir, { recursive: true });
  } catch (err) {
    // Directory already exists, that's fine
  }
  
  // Write version.json to public directory
  const versionJsonPath = join(publicDir, 'version.json');
  writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2));
  
  console.log(`Generated version.json with version ${packageJson.version}`);
  
} catch (error) {
  console.error('Failed to generate version.json:', error);
  process.exit(1);
}