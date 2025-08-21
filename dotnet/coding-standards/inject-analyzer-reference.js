#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function log(msg) {
  process.stdout.write(String(msg) + '\n');
}

function run() {
  const projectFile = (process.env.INPUT_PROJECT_FILE || '').trim();
  const codeAnalyzersName = (process.env.INPUT_CODE_ANALYZERS_NAME || 'CodeStandards.Analyzers').trim();

  if (!projectFile) {
    log('No project file path provided; skipping');
    return;
  }
  if (!fs.existsSync(projectFile)) {
    log(`Project file not found: ${projectFile}; skipping`);
    return;
  }

  const original = fs.readFileSync(projectFile, 'utf8');

  // If an Analyzer reference already exists, skip to avoid duplicates
  const includePath = `..\\..\\${codeAnalyzersName}$\\Demo.Analyzers\\Demo.Analyzers.csproj`;
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
