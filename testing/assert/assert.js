#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getEnv(name, required = false) {
    const v = process.env[name];
    if (required && (v === undefined || v === '')) {
        console.error(`Missing required env var: ${name}`);
        process.exit(1);
    }
    return v || '';
}

function parseRegex(spec) {
    // Allow forms: pattern, /pattern/, /pattern/flags
    const m = spec.match(/^\/(.*)\/([gimsuy]*)$/);
    if (m) {
        try { return new RegExp(m[1], m[2]); } catch (e) { console.error(`Invalid regex '${spec}': ${e.message}`); return null; }
    }
    try { return new RegExp(spec); } catch (e) { console.error(`Invalid regex '${spec}': ${e.message}`); return null; }
}

function run() {
    const expected = getEnv('INPUT_EXPECTED', true);
    const summaryFile = getEnv('INPUT_SUMMARY_FILE', true);
    const testName = getEnv('INPUT_TEST_NAME', true);
    const mode = (getEnv('INPUT_MODE').toLowerCase() || 'exact');
    const exitOnFail = (getEnv('INPUT_EXIT_ON_FAIL', 'false').toLowerCase() === 'true');
    // Actual is optional for 'absent' mode (may be intentionally empty)
    let actual = getEnv('INPUT_ACTUAL', mode !== 'absent');
    if (mode !== 'absent' && (actual === undefined || actual === '')) {
        // enforce presence for other modes
        console.error('Missing required env var: INPUT_ACTUAL');
        process.exit(1);
    }

    console.log(`[ASSERT] ${testName} :: mode=${mode} expected='${expected}' actual='${actual}'`);

    let pass = false;
    switch (mode) {
        case 'regex': {
            const rx = parseRegex(expected);
            if (rx) pass = rx.test(actual); else pass = false;
            break;
        }
        case 'exact':
            pass = actual === expected; break;
        case 'endswith':
            pass = actual.endsWith(expected); break;
        case 'present':
            pass = actual.length > 0; break;
        case 'absent':
            pass = actual.length === 0; break;
        default:
            console.error(`Unknown mode '${mode}'`);
            process.exit(1);
    }

    try { fs.mkdirSync(path.dirname(summaryFile), { recursive: true }); } catch { }

    if (!pass) {
        const failLine = `FAIL: ${testName} (expected '${expected}' mode=${mode} actual='${actual}')`;
        fs.appendFileSync(summaryFile, failLine + '\n');
        console.error(failLine);
        if (exitOnFail) {
            process.exit(1);
        }
    }

    fs.appendFileSync(summaryFile, `PASS: ${testName}\n`);
    console.log(`PASS: ${testName}`);
}

if (require.main === module) run();

module.exports = { run };
