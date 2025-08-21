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

test('skips when no project file provided', () => {
  const r = withEnv({ INPUT_PROJECT_FILE: '' }, () => run());
  assert.match(r.out, /skipping/);
});

test('skips when project file missing', () => {
  const r = withEnv({ INPUT_PROJECT_FILE: path.join(os.tmpdir(), 'nope.csproj') }, () => run());
  assert.match(r.out, /not found/);
});

test('inserts ItemGroup before </Project>', () => {
  const { file } = makeProj(baseProj);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers' }, () => run());
  const updated = fs.readFileSync(file, 'utf8');
  assert.match(updated, /<ItemGroup>[\s\S]*<ProjectReference[\s\S]*OutputItemType="Analyzer"[\s\S]*<\/ItemGroup>[\s\S]*<\/Project>/);
  assert.match(updated, /Include=\"\.\.(\\\\)\.\.(\\\\)CodeStandards\.Analyzers\$(\\\\)Demo\.Analyzers(\\\\)Demo\.Analyzers\.csproj\"/);
  assert.match(r.out, /Inserted Analyzer ProjectReference/);
});

test('skips if already present by OutputItemType attribute', () => {
  const { file } = makeProj(`<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\\..\\CodeStandards.Analyzers$\\Demo.Analyzers\\Demo.Analyzers.csproj" OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
  </ItemGroup>
</Project>`);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers' }, () => run());
  assert.match(r.out, /already present/);
  const updated = fs.readFileSync(file, 'utf8');
  const occurrences = (updated.match(/OutputItemType="Analyzer"/g) || []).length;
  assert.strictEqual(occurrences, 1);
});

test('skips if include path already present without OutputItemType', () => {
  const { file } = makeProj(`<?xml version="1.0" encoding="utf-8"?>
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\\..\\CodeStandards.Analyzers$\\Demo.Analyzers\\Demo.Analyzers.csproj" />
  </ItemGroup>
</Project>`);
  const r = withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers' }, () => run());
  assert.match(r.out, /already present/);
});

test('appends at end if </Project> missing', () => {
  const { file } = makeProj('<Project></Nope>');
  withEnv({ INPUT_PROJECT_FILE: file, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers' }, () => run());
  const updated = fs.readFileSync(file, 'utf8');
  assert.match(updated, /<ItemGroup>[\s\S]*OutputItemType="Analyzer"/);
});
