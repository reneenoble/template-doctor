#!/usr/bin/env node
const semver = require('semver');
const required = '>=18.0.0';
const current = process.version; // e.g. v20.11.1
if(!semver.satisfies(semver.coerce(current), required)) {
  console.error(`\nERROR: Current Node.js version ${current} does not satisfy required ${required}.\n`+
    'Playwright and this project require Node 18+.\n'+
    'Please install a newer Node version (e.g. using nvm: nvm install 20 && nvm use 20).');
  process.exit(1);
}
