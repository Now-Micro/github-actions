const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, parseFirstRoot, filesEqual } = require('./copy-relevant-files');

function cap(fn) {
  let out = '', err = '';
  const so = process.stdout.write, se = process.stderr.write;
  process.stdout.write = (c, e, cb) => { out += c; return so.call(process.stdout, c, e, cb); };
  process.stderr.write = (c, e, cb) => { err += c; return se.call(process.stderr, c, e, cb); };
  try { fn(); } finally { process.stdout.write = so; process.stderr.write = se; }
  return { out, err };
}

function withEnv(env, fn) {
  const prev = { ...process.env };
  Object.assign(process.env, env);
  try { return cap(fn); } finally { process.env = prev; }
}

function withExitCapture(fn) {
  const origExit = process.exit;
  let exitCode;
  process.exit = (code) => { exitCode = code || 0; throw new Error(`__EXIT_${exitCode}__`); };
  try {
    try { fn(); } catch (e) { if (!/^__EXIT_/.test(e.message)) throw e; }
  } finally {
    process.exit = origExit;
  }
  return exitCode;
}

test('parseFirstRoot: JSON array', () => {
  assert.strictEqual(parseFirstRoot('["/root"]', '/fallback'), '/root');
});

test('parseFirstRoot: bracketed string', () => {
  assert.strictEqual(parseFirstRoot('["C:/root"]', 'X'), 'C:/root');
});

test('parseFirstRoot: fallback', () => {
  assert.strictEqual(parseFirstRoot('', '/f'), '/f');
});

test('filesEqual: same contents', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  const a = path.join(dir, 'a.txt');
  const b = path.join(dir, 'b.txt');
  fs.writeFileSync(a, 'abc');
  fs.writeFileSync(b, 'abc');
  assert.strictEqual(filesEqual(a, b), true);
});

test('filesEqual: different contents', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  const a = path.join(dir, 'a.txt');
  const b = path.join(dir, 'b.txt');
  fs.writeFileSync(a, 'abc');
  fs.writeFileSync(b, 'abcd');
  assert.strictEqual(filesEqual(a, b), false);
});

test('run: copies editorconfig and analyzers', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  const source = path.join(tmp, 'src');
  const analyzers = path.join(source, 'analyzers', 'CodeStandards.Analyzers');
  fs.mkdirSync(analyzers, { recursive: true });
  fs.writeFileSync(path.join(source, '.editorconfig'), 'root=true\n');
  fs.writeFileSync(path.join(analyzers, 'CodeStandards.Analyzers.csproj'), '<Project/>' );
  const root = path.join(tmp, 'root');
  const r = withEnv({ INPUT_UNIQUE_ROOT_DIRECTORIES: '["' + root.replace(/\\/g, '/') + '"]', INPUT_DIRECTORY: root, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_SOURCE_DIR: source }, () => run());
  assert.ok(fs.existsSync(path.join(root, '.editorconfig')));
  assert.ok(fs.existsSync(path.join(root, 'CodeStandards.Analyzers', 'CodeStandards.Analyzers', 'CodeStandards.Analyzers.csproj')));
});

test('run: skips copying .editorconfig when identical', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  const source = path.join(tmp, 'src');
  const analyzers = path.join(source, 'analyzers', 'CodeStandards.Analyzers');
  fs.mkdirSync(analyzers, { recursive: true });
  const editor = 'root=true\n';
  fs.writeFileSync(path.join(source, '.editorconfig'), editor);
  fs.writeFileSync(path.join(analyzers, 'CodeStandards.Analyzers.csproj'), '<Project/>' );
  const root = path.join(tmp, 'root');
  const targetEditor = path.join(root, '.editorconfig');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(targetEditor, editor);
  const r = withEnv({ INPUT_UNIQUE_ROOT_DIRECTORIES: '["' + root.replace(/\\/g, '/') + '"]', INPUT_DIRECTORY: root, INPUT_CODE_ANALYZERS_NAME: 'CodeStandards.Analyzers', INPUT_SOURCE_DIR: source }, () => run());
  assert.match(r.out, /.editorconfig is up to date/);
});

test('run: errors when source missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-'));
  const code = withExitCapture(() => withEnv({ INPUT_UNIQUE_ROOT_DIRECTORIES: '["' + root.replace(/\\/g, '/') + '"]', INPUT_DIRECTORY: root, INPUT_SOURCE_DIR: path.join(root, 'nope') }, () => run()));
  assert.strictEqual(code, 1);
});
