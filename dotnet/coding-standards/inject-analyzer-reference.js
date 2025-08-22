#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function log(msg) {
    process.stdout.write(String(msg) + '\n');
}

function run() {
    console.log(`Injecting Analyzer ProjectReference...`);
    const projectFile = (process.env.INPUT_PROJECT_FILE || '').trim();
    const includePath = (process.env.INPUT_INCLUDE_PATH || '').trim();

    console.log(`projectFile: ${projectFile}`);
    console.log(`includePath: ${includePath}`);
    if (!includePath) {
        log('No include path provided; skipping injection of reference');
        return;
    }
    if (!projectFile) {
        log('No project file path provided; skipping injection of reference');
        return;
    }
    if (!fs.existsSync(projectFile)) {
        log(`Project file not found: ${projectFile}; skipping injection of reference');`);
        return;
    }

    const original = fs.readFileSync(projectFile, 'utf8');

    // Prefer an explicit include path, otherwise fall back to the default location under the analyzers folder

    log(`includePath: ${includePath}`);
    // If an Analyzer reference already exists, skip to avoid duplicates
    if (original.includes('OutputItemType="Analyzer"') || original.includes(includePath)) {
        log('Analyzer ProjectReference already present; skipping insert');
        return;
    }

    const injection = [
        '  <ItemGroup>',
        '    <ProjectReference',
        `      Include="${includePath}"`,
        '      OutputItemType="Analyzer"',
        '      ReferenceOutputAssembly="false"',
        '    />',
        '  </ItemGroup>',
        ''
    ].join('\n');

    const closing = '</Project>';
    const idx = original.lastIndexOf(closing);
    let updated;
    if (idx >= 0) {
        updated = original.slice(0, idx) + injection + original.slice(idx);
    } else {
        // Fallback: append at end
        updated = original;
        if (!updated.endsWith('\n')) updated += '\n';
        updated += injection;
    }

    fs.writeFileSync(projectFile, updated, 'utf8');
    log(`Inserted Analyzer ProjectReference into ${projectFile}`);
}

if (require.main === module) {
    try { run(); } catch (e) { console.error(e?.message || String(e)); process.exit(1); }
}

module.exports = { run };
