#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Read manifest.json
const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update manifest version to match package.json
manifest.version = packageJson.version;

// Write updated manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`✅ Updated manifest.json version to ${packageJson.version}`);

// Validate manifest
const requiredFields = ['manifest_version', 'name', 'version', 'description'];
const missingFields = requiredFields.filter(field => !manifest[field]);

if (missingFields.length > 0) {
  console.error(`❌ Missing required manifest fields: ${missingFields.join(', ')}`);
  process.exit(1);
}

console.log('✅ Release preparation complete!');
