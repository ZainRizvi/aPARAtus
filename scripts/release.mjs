#!/usr/bin/env node

/**
 * Local release script - faster alternative to GitHub Actions workflow
 *
 * Usage:
 *   node scripts/release.mjs [patch|minor|major]        # stable release
 *   node scripts/release.mjs [patch|minor|major] beta   # beta release
 *   node scripts/release.mjs beta                       # next beta (increments beta number)
 *
 * Examples:
 *   0.1.5 + patch       → 0.1.6
 *   0.1.5 + patch beta  → 0.1.6-beta.1
 *   0.1.6-beta.1 + beta → 0.1.6-beta.2
 *   0.1.6-beta.2 + patch → 0.1.6
 */

import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const isBeta = args.includes('beta');
const bumpArg = args.find(a => ['patch', 'minor', 'major'].includes(a));

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
  if (!match) throw new Error(`Invalid version: ${version}`);
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    beta: match[4] ? parseInt(match[4]) : null
  };
}

// Get current version
const manifest = readJson('manifest.json');
const current = parseVersion(manifest.version);
const isCurrentBeta = current.beta !== null;

console.log(`Current version: ${manifest.version}`);

// Calculate new version
let newVersion;

if (isBeta) {
  if (bumpArg) {
    // e.g., "patch beta" → bump then add -beta.1
    let { major, minor, patch } = current;

    // If current is beta, use base version for bump calculation
    switch (bumpArg) {
      case 'major':
        major += 1; minor = 0; patch = 0;
        break;
      case 'minor':
        minor += 1; patch = 0;
        break;
      case 'patch':
        if (!isCurrentBeta) patch += 1;
        // If current is beta, patch beta keeps same base version
        break;
    }
    newVersion = `${major}.${minor}.${patch}-beta.1`;
  } else if (isCurrentBeta) {
    // Just "beta" on a beta version → increment beta number
    newVersion = `${current.major}.${current.minor}.${current.patch}-beta.${current.beta + 1}`;
  } else {
    // Just "beta" on stable → patch + beta.1
    newVersion = `${current.major}.${current.minor}.${current.patch + 1}-beta.1`;
  }
} else {
  // Stable release
  const BUMP_TYPE = bumpArg || 'patch';
  let { major, minor, patch } = current;

  if (isCurrentBeta) {
    // Releasing from beta → use base version (no bump needed)
    newVersion = `${major}.${minor}.${patch}`;
  } else {
    switch (BUMP_TYPE) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }
  }
}

console.log(`New version: ${newVersion}${isBeta ? ' (pre-release)' : ''}`);

// Update manifest.json
manifest.version = newVersion;
writeJson('manifest.json', manifest);
console.log('Updated manifest.json');

// Update package.json
const pkg = readJson('package.json');
pkg.version = newVersion;
writeJson('package.json', pkg);
console.log('Updated package.json');

// Update versions.json (use base version for minAppVersion mapping)
const versions = readJson('versions.json');
const baseVersion = newVersion.replace(/-beta\.\d+$/, '');
versions[newVersion] = manifest.minAppVersion;
writeJson('versions.json', versions);
console.log('Updated versions.json');

// Build
run('npm', ['run', 'build']);

// Git commit, tag, push
run('git', ['add', 'manifest.json', 'package.json', 'versions.json']);
run('git', ['commit', '-m', `Bump version to ${newVersion}`]);
run('git', ['tag', newVersion]);
run('git', ['push', 'origin', 'main', '--tags']);

// Create GitHub release
const releaseArgs = ['release', 'create', newVersion, `--title=v${newVersion}`, '--generate-notes'];
if (isBeta) {
  releaseArgs.push('--prerelease');
}
releaseArgs.push('main.js', 'manifest.json');
run('gh', releaseArgs);

console.log(`\n✓ Released v${newVersion}${isBeta ? ' (pre-release)' : ''}`);
