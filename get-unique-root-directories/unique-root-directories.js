const fs = require('fs');

function run() {
    const pattern = process.env.INPUT_PATTERN;
    const debugMode = process.env.INPUT_DEBUG_MODE === 'true';
    const raw = process.env.INPUT_PATHS || '';

    if (debugMode) {
        console.log(`🔍 Debug mode is ON`);
        console.log(`🔍 INPUT_PATTERN: ${pattern}`);
        console.log(`🔍 INPUT_PATHS: ${raw}`);
    }
    if (!pattern) {
        console.error('INPUT_PATTERN is required'); process.exit(1);
    }
    const dirs = raw.split(',').map(s => {
        if (debugMode) {
            console.log(`🔍 Processing path: ${s}`);
        }
        const afterProcessing = s.trim().replace(/^["']|["']$/g, '')
        if (debugMode) {
            console.log(`🔍 Processed path: ${afterProcessing}`);
        }
        return afterProcessing;
    }).filter(Boolean);
    console.log(`🔍 Getting Unique Root Directories from: ${raw}`);
    console.log(`Using pattern: ${pattern}`);
    let re;
    try {
        re = new RegExp(pattern);
    } catch (e) {
        console.error(`Invalid regex: ${e.message}`);
        process.exit(1);
    }
    const set = new Set();
    for (const d of dirs) {
        if (debugMode) {
            console.log(`🔍 Checking directory: ${d}`);
        }
        const m = d.match(re);
        if (m) {
            if (debugMode) {
                console.log(`🔍 Matched directory: ${m[1]}`);
            }
            if (m[1]) {
                if (!set.has(m[1])) {
                    console.log(`🔍 Unique Root Directory found: '${m[1]}'`);
                }
                set.add(m[1]);
            }
        }
    }
    const arr = [...set];
    const json = JSON.stringify(arr);
    console.log(`🔍 Unique Root Directories: ${json}`);
    const out = process.env.GITHUB_OUTPUT;
    if (!out) {
        console.error('GITHUB_OUTPUT not set');
        process.exit(1);
    }
    fs.appendFileSync(out, `unique_root_directories=${json}\n`);
}

if (require.main === module) run();
module.exports = { run };
