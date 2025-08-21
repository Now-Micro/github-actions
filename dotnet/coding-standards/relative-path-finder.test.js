const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, computeRelative, sanitize, normalizeToPosix } = require('./relative-path-finder');

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

test('sanitize strips brackets and trims', () => {
  assert.strictEqual(sanitize(' [abc] '), 'abc');
  assert.strictEqual(sanitize('[x]'), 'x');
  assert.strictEqual(sanitize('y'), 'y');
});

test('normalizeToPosix converts backslashes', () => {
  assert.strictEqual(normalizeToPosix('a\\b\\c'), 'a/b/c');
});

test('computeRelative cases from spec', () => {
  const root = './demo/coding-standards/Coding.Standards.sln';
  assert.strictEqual(computeRelative(root, './demo/coding-standards/src/Coding.Standards.csproj'), '../');
  assert.strictEqual(computeRelative(root, './demo/coding-standards/src/subdir/Coding.Standards.csproj'), '../../');
  assert.strictEqual(computeRelative(root, './demo/coding-standards/tests/subdir2/Coding.Standards.Tests.csproj'), '../../');
  assert.strictEqual(computeRelative(root, '[./demo/coding-standards/src/Coding.Standards.csproj]'), '../');
  assert.strictEqual(computeRelative(root, '[./demo/coding-standards/src/subdir/Coding.Standards.csproj]'), '../../');
  assert.strictEqual(computeRelative(root, '[./demo/coding-standards/tests/subdir2/Coding.Standards.Tests.csproj]'), '../../');
});

test('computeRelative throws on comma', () => {
  assert.throws(() => computeRelative('a,b', 'x'), /comma/);
  assert.throws(() => computeRelative('a', 'x,y'), /comma/);
});

test('run writes to GITHUB_OUTPUT and stdout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const out = path.join(tmp, 'out.txt');
  const { out: stdout } = withEnv({
    INPUT_ROOT_FILE: './demo/coding-standards/Coding.Standards.sln',
    INPUT_SUBDIRECTORY_FILE: './demo/coding-standards/src/Coding.Standards.csproj',
    GITHUB_OUTPUT: out
  }, () => run());
  const fileOut = fs.readFileSync(out, 'utf8');
  assert.match(stdout, /\.\.\//); // '../'
  assert.match(fileOut, /relative_path=\.\.\//);
});

test('run exits 1 on errors', () => {
  const origExit = process.exit;
  let code;
  process.exit = (c) => { code = c || 0; throw new Error(`__EXIT_${code}__`); };
  const r = withEnv({ INPUT_ROOT_FILE: 'a,b', INPUT_SUBDIRECTORY_FILE: 'x' }, () => {
    try { run(); } catch (e) { /* swallow sentinel */ }
  });
  process.exit = origExit;
  assert.strictEqual(code, 1);
  assert.match(r.err, /comma/);
});
