#!/usr/bin/env node
const fs = require('fs');

function getEnv(name, required = false) {
  const v = process.env[name];
  if (required && (v === undefined || v === '')) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v || '';
}

function run() {
  const expected = getEnv('INPUT_EXPECTED', true);
  const actual = getEnv('INPUT_ACTUAL', true);
  const summaryFile = getEnv('INPUT_SUMMARY_FILE', true);
  const testName = getEnv('INPUT_TEST_NAME', true);
  const mode = (getEnv('INPUT_MODE').toLowerCase() || 'exact');

  console.log(`[ASSERT] ${testName} :: mode=${mode} expected='${expected}' actual='${actual}' partial=${partialMatchAllowed}`);

  let pass = false;
  switch (mode) {
    case 'exact':
      pass = actual === expected;
      break;
    case 'endswith':
      pass = actual.endsWith(expected);
      break;
    case 'present':
      pass = actual.includes(expected)
      break;
    case 'absent':
      pass = !actual.includes(expected)
      break;
    default:
      console.error(`Unknown mode '${mode}'`);
      process.exit(1);
  }

  try {
    fs.mkdirSync(require('path').dirname(summaryFile), { recursive: true });
  } catch {}

  if (!pass) {
    const failLine = `FAIL: ${testName} (expected '${expected}' mode=${mode} actual='${actual}')`;
    fs.appendFileSync(summaryFile, failLine + '\n');
    console.error(failLine);
    process.exit(1);
  }

  fs.appendFileSync(summaryFile, `PASS: ${testName}\n`);
  console.log(`PASS: ${testName}`);
}

if (require.main === module) run();

module.exports = { run };
