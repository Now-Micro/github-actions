const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('./inject-analyzer-reference');

function withEnv(env, fn) {
  const prev = { ...process.env };
  Object.assign(process.env, env);
  let out = '', err = '';
  const so = process.stdout.write, se = process.stderr.write;
  process.stdout.write = (c, e, cb) => { out += c; return so.call(process.stdout, c, e, cb); };
  process.stderr.write = (c, e, cb) => { err += c; return se.call(process.stderr, c, e, cb); };
  try { fn(); } finally { process.env = prev; process.stdout.write = so; process.stderr.write = se; }
  return { out, err };
}

function makeProj(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-')); 
  const file = path.join(dir, 'App.csproj');
  fs.writeFileSync(file, content, 'utf8');
  return { dir, file };
}

const baseProj = `<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`;

const defaultInclude = '..\\..\\CodeStandards.Analyzers$\\Demo.Analyzers\\Demo.Analyzers.csproj';
const customInclude = '..\\..\\Custom.Analyzers$\\Demo.Analyzers\\Demo.Analyzers.csproj';

test('skips when no project file provided', () => {
  const r = withEnv({ INPUT_PROJECT_FILE: '', INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  assert.match(r.out, /skipping/);
});

test('skips when project file missing', () => {
  const r = withEnv({ INPUT_PROJECT_FILE: path.join(os.tmpdir(), 'nope.csproj'), INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  assert.match(r.out, /not found/);
});

test('inserts ItemGroup before </Project> (explicit include)', () => {
  const { file } = makeProj(baseProj);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  const updated = fs.readFileSync(file, 'utf8');
  assert.match(updated, /<ItemGroup>[\s\S]*<ProjectReference[\s\S]*OutputItemType="Analyzer"[\s\S]*<\/ItemGroup>[\s\S]*<\/Project>/);
  const expectedInclude = `Include="${defaultInclude}"`;
  assert.ok(updated.includes(expectedInclude), `Include path not found. Expected to contain: ${expectedInclude}\nActual:\n${updated}`);
  assert.match(r.out, /Inserted Analyzer ProjectReference/);
});

// Insert using explicit INPUT_INCLUDE_PATH
test('inserts ItemGroup using explicit INPUT_INCLUDE_PATH', () => {
  const { file } = makeProj(baseProj);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'IGNORED', INPUT_INCLUDE_PATH: customInclude }, () => run());
  const updated = fs.readFileSync(file, 'utf8');
  const expectedInclude = `Include="${customInclude}"`;
  assert.ok(updated.includes(expectedInclude), `Include path not found. Expected to contain: ${expectedInclude}\nActual:\n${updated}`);
  // Ensure it did not fall back to default
  assert.ok(!updated.includes('CodeStandards.Analyzers$'), 'Fallback include used unexpectedly');
});

test('skips if already present by OutputItemType attribute', () => {
  const { file } = makeProj(`<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="${defaultInclude}" OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
  </ItemGroup>
</Project>`);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  assert.match(r.out, /already present/);
  const updated = fs.readFileSync(file, 'utf8');
  const occurrences = (updated.match(/OutputItemType="Analyzer"/g) || []).length;
  assert.strictEqual(occurrences, 1);
});

// Skip when explicit include already present
test('skips if explicit INPUT_INCLUDE_PATH already present', () => {
  const { file } = makeProj(`<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="${customInclude}" />
  </ItemGroup>
</Project>`);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_INCLUDE_PATH: customInclude }, () => run());
  assert.match(r.out, /already present/);
});

test('skips if include path already present without OutputItemType', () => {
  const { file } = makeProj(`<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="${defaultInclude}" />
  </ItemGroup>
</Project>`);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  assert.match(r.out, /already present/);
});

test('appends at end if </Project> missing', () => {
  const { file } = makeProj('<Project></Nope>');
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_INCLUDE_PATH: defaultInclude }, () => run());
  const updated = fs.readFileSync(file, 'utf8');
  assert.match(updated, /<ItemGroup>[\s\S]*OutputItemType="Analyzer"/);
});
