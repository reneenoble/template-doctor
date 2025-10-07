#!/usr/bin/env node
const semver = require("semver");
// Enforce supported LTS band: >=20.0.0 <23.0.0 (Functions & Playwright stability)
const range = ">=20.0.0 <23.0.0";
const current = process.version; // e.g. v20.11.1
const coerced = semver.coerce(current);
if (!semver.satisfies(coerced, range)) {
    console.error(
        `\nERROR: Node.js ${current} is unsupported. Required range: ${range}.\n` +
            "Reasons:\n" +
            "  - Azure Functions host & dependencies validated on Node 20.x LTS.\n" +
            "  - Node 23+ introduces breaking changes not yet vetted here.\n" +
            "Fix:\n" +
            "  nvm install 20 && nvm use 20\n" +
            "  (or ensure your CI uses actions/setup-node with node-version: 20.x)\n",
    );
    process.exit(1);
}
console.log(
    `[ensure-node-version] Node version ${current} within supported range ${range}`,
);
