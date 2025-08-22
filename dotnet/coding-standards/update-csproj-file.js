#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function log(msg) {
    process.stdout.write(String(msg) + '\n');
}

function getCommentRanges(xml) {
    const ranges = [];
    const re = /<!--[\s\S]*?-->/g;
    let m;
    while ((m = re.exec(xml))) {
        ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
}

function isInRanges(index, ranges) {
    for (const [s, e] of ranges) {
        if (index >= s && index < e) return true;
    }
    return false;
}

function ensureEnforceCodeStyleTrue(xml) {
    let updated = xml;
    let changed = false;
    const commentRanges = getCommentRanges(updated);

    // Find first uncommented EnforceCodeStyleInBuild element
    const tagRe = /<EnforceCodeStyleInBuild>([\s\S]*?)<\/EnforceCodeStyleInBuild>/gi;
    let m;
    let foundIdx = -1;
    let foundText = '';
    let foundValue = '';
    while ((m = tagRe.exec(updated))) {
        if (!isInRanges(m.index, commentRanges)) {
            foundIdx = m.index;
            foundText = m[0];
            foundValue = (m[1] || '').trim().toLowerCase();
            break;
        }
    }
    if (foundIdx !== -1) {
        if (foundValue !== 'true') {
            const replacement = '<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>';
            updated = updated.slice(0, foundIdx) + replacement + updated.slice(foundIdx + foundText.length);
            changed = true;
            log('Updated EnforceCodeStyleInBuild to true');
        }
        return { updated, changed };
    }

    // Not present (or only commented): insert into first <PropertyGroup>
    const pgOpen = /<PropertyGroup\b[^>]*>/i;
    const mo = pgOpen.exec(updated);
    if (mo) {
        const startIdx = mo.index + mo[0].length;
        const closeIdx = updated.indexOf('</PropertyGroup>', startIdx);
        if (closeIdx !== -1) {
            const indentMatch = /(\r?\n)([ \t]*)<\/PropertyGroup>/.exec(updated.slice(startIdx - 200, closeIdx + 16)) || [];
            const nl = '\n';
            const indent = (indentMatch[2] || '  ');
            const insertion = `${nl}${indent}  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>`;
            updated = updated.slice(0, closeIdx) + insertion + updated.slice(closeIdx);
            changed = true;
            log('Inserted EnforceCodeStyleInBuild into first PropertyGroup');
            return { updated, changed };
        }
    }
    // No PropertyGroup found: create one before </Project> or append
    const closing = '</Project>';
    const idx = updated.lastIndexOf(closing);
    const block = `  <PropertyGroup>\n    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>\n  </PropertyGroup>\n`;
    if (idx >= 0) {
        updated = updated.slice(0, idx) + block + updated.slice(idx);
    } else {
        if (!updated.endsWith('\n')) updated += '\n';
        updated += block;
    }
    changed = true;
    log('Added PropertyGroup with EnforceCodeStyleInBuild');
    return { updated, changed };
}

function hasUncommentedAnalyzerReference(xml, includePath) {
    const ranges = getCommentRanges(xml);
    const prRe = /<ProjectReference\b[^>]*>/gi;
    let m;
    while ((m = prRe.exec(xml))) {
        if (isInRanges(m.index, ranges)) continue;
        const text = m[0];
        if (text.includes('OutputItemType="Analyzer"') || (includePath && text.includes(includePath))) {
            return true;
        }
    }
    return false;
}

function run() {
    console.log(`Injecting Analyzer ProjectReference...`);
    const projectFile = (process.env.INPUT_PROJECT_FILE || '').trim();
    const includePath = (process.env.INPUT_INCLUDE_PATH || '').trim();

    console.log(`projectFile: ${projectFile}`);
    console.log(`includePath: ${includePath}`);
    if (!projectFile || !fs.existsSync(projectFile)) {
        log(`No project file found at '${projectFile}'; skipping update of project file`);
        process.exit(1);
    }
    if (!includePath) {
        log(`No include path provided; skipping update of ${projectFile}`);
        process.exit(1);
    }

    const original = fs.readFileSync(projectFile, 'utf8');
    let updated = original;
    let anyChange = false;

    // Ensure EnforceCodeStyleInBuild is true (ignore commented occurrences)
    const enforced = ensureEnforceCodeStyleTrue(updated);
    updated = enforced.updated;
    anyChange = anyChange || enforced.changed;

    // Analyzer injection: ignore commented references
    if (hasUncommentedAnalyzerReference(updated, includePath)) {
        log('Analyzer ProjectReference already present; skipping insert');
    } else {
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
        const idx = updated.lastIndexOf(closing);
        if (idx >= 0) {
            updated = updated.slice(0, idx) + injection + updated.slice(idx);
        } else {
            if (!updated.endsWith('\n')) updated += '\n';
            updated += injection;
        }
        anyChange = true;
        log('Inserted Analyzer ProjectReference into project');
    }
    if (anyChange) {
        fs.writeFileSync(projectFile, updated, 'utf8');
    }
}

if (require.main === module) {
    try { run(); } catch (e) { console.error(e?.message || String(e)); process.exit(1); }
}

module.exports = { run, ensureEnforceCodeStyleTrue };
