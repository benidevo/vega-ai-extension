#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.version = packageJson.version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✅ Updated manifest.json version to ${packageJson.version}`);

const readmePath = path.join(__dirname, '..', 'README.md');
let readmeContent = fs.readFileSync(readmePath, 'utf8');

const versionBadgeRegex = /\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[\d.]+-(green|blue)\.svg\)\]/g;
const newVersionBadge = `[![Version](https://img.shields.io/badge/version-${packageJson.version}-green.svg)]`;

if (versionBadgeRegex.test(readmeContent)) {
  readmeContent = readmeContent.replace(versionBadgeRegex, newVersionBadge);
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`✅ Updated README.md version badge to ${packageJson.version}`);
} else {
  console.log('⚠️  Could not find version badge in README.md');
}

const requiredFields = ['manifest_version', 'name', 'version', 'description'];
const missingFields = requiredFields.filter(field => !manifest[field]);

if (missingFields.length > 0) {
  console.error(`❌ Missing required manifest fields: ${missingFields.join(', ')}`);
  process.exit(1);
}

console.log('✅ Release preparation complete!');
