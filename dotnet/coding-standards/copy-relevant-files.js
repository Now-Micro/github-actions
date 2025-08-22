#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function log(msg) { process.stdout.write(String(msg) + '\n'); }
function err(msg) { process.stderr.write(String(msg) + '\n'); }

function parseFirstRoot(raw, fallback) {
    if (!raw) return fallback;
    try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0];
    } catch { }
    // Try to strip ["..."]
    const m = /^\["](.+)["]/.exec(raw);
    if (m) return m[1];
    return fallback;
}

function filesEqual(a, b) {
    try {
        const sa = fs.statSync(a), sb = fs.statSync(b);
        if (!sa.isFile() || !sb.isFile()) return false;
        if (sa.size !== sb.size) return false;
        const ca = fs.readFileSync(a);
        const cb = fs.readFileSync(b);
        return ca.equals(cb);
    } catch { return false; }
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function run() {
    const rawRoots = process.env.INPUT_UNIQUE_ROOT_DIRECTORIES || '';
    const directory = process.env.INPUT_DIRECTORY || '';
    const codeAnalyzersName = process.env.INPUT_CODE_ANALYZERS_NAME || 'CodeStandards.Analyzers';
    const sourceDir = process.env.INPUT_SOURCE_DIR;

    const root = parseFirstRoot(rawRoots, directory);
    if (!root) { err('No root directory resolved'); process.exit(1); }
    if (!sourceDir) {
        err('No source directory provided'); 
        process.exit(1);
    }

    log(`Directory: ${directory}`);
    log(`Derived Root: ${root}`);
    log(`Source Dir: ${sourceDir}`);

    ensureDir(root);
    // Fix: remove stray '$' at end of folder name
    const analyzersTarget = path.join(root, `${codeAnalyzersName}`, 'Demo.Analyzers');
    ensureDir(analyzersTarget);

    // .editorconfig copy if different
    const srcEditor = path.join(sourceDir, '.editorconfig');
    const destEditor = path.join(root, '.editorconfig');
    if (!fs.existsSync(srcEditor)) {
        err(`Missing ${srcEditor}`);
        process.exit(1);
    }
    if (fs.existsSync(destEditor) && filesEqual(srcEditor, destEditor)) {
        log('.editorconfig is up to date; skipping copy');
    } else {
        fs.copyFileSync(srcEditor, destEditor);
        log('Copied .editorconfig');
    }

    // Copy analyzers directory (shallow copy)
    const srcAnalyzersDir = path.join(sourceDir, 'analyzers', 'Demo.Analyzers');
    if (!fs.existsSync(srcAnalyzersDir)) {
        err(`Missing ${srcAnalyzersDir}`);
        process.exit(1);
    }
    // Copy all files recursively
    const stack = [srcAnalyzersDir];
    while (stack.length) {
        const cur = stack.pop();
        const rel = path.relative(srcAnalyzersDir, cur);
        const dest = path.join(analyzersTarget, rel);
        ensureDir(dest);
        for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
            const sp = path.join(cur, e.name);
            const dp = path.join(dest, e.name);
            if (e.isDirectory()) {
                stack.push(sp);
            } else if (e.isFile()) {
                ensureDir(path.dirname(dp));
                fs.copyFileSync(sp, dp);
            }
        }
    }
    log(`Copied analyzers to ${analyzersTarget}`);
}

if (require.main === module) {
    try { run(); } catch (e) { err(e?.stack || String(e)); process.exit(1); }
}

module.exports = { run, parseFirstRoot, filesEqual };
