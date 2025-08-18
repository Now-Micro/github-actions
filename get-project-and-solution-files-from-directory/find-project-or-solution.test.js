const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');
const { run } = require('./find-project-or-solution');

function setupDir(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-soln-'));
  for (const [rel, content] of Object.entries(structure)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content || '');
  }
  return root;
}

function captureRun(env) {
  const logs = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));

  const outputFile = path.join(os.tmpdir(), `gh-out-${Date.now()}-${Math.random()}.txt`);
  const originalEnv = { ...process.env };
  process.env.GITHUB_OUTPUT = outputFile;
  Object.entries(env).forEach(([k,v]) => process.env[k] = v);

  const origExit = process.exit;
  let exitCode = null;
  process.exit = (code) => { exitCode = code; throw new Error(`__exit_${code}__`); };

  try {
    run();
  } catch (e) {
    if (!/__exit_/.test(e.message)) throw e;
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
    Object.keys(process.env).forEach(k => { if (!(k in originalEnv)) delete process.env[k]; });
    Object.entries(originalEnv).forEach(([k,v]) => process.env[k] = v);
  }

  const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
  return { logs, output, exitCode };
}

let root;

beforeEach(() => {
  root = null;
});

afterEach(() => {
  if (root && fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('finds solution and project within depth', () => {
  root = setupDir({
    'src/ProjectA/ProjectA.csproj': '<Project></Project>',
    'src/ProjectA/ProjectA.sln': '',
  });
  const { output } = captureRun({
    INPUT_DIRECTORY: root,
    INPUT_MAX_DEPTH: '4',
    INPUT_FIND_SOLUTION: 'true',
    INPUT_FIND_PROJECT: 'true'
  });
  assert.match(output, /solution-found=.*ProjectA\.sln/);
  assert.match(output, /project-found=.*ProjectA\.csproj/);
});

test('respects max depth (does not find deeper)', () => {
  root = setupDir({ 'deep/one/two/three/file.sln': '' });
  const { output } = captureRun({
    INPUT_DIRECTORY: root,
    INPUT_MAX_DEPTH: '2',
    INPUT_FIND_SOLUTION: 'true',
    INPUT_FIND_PROJECT: 'false'
  });
  assert.ok(!/solution-found=/.test(output));
});

test('errors when directory missing', () => {
  const { exitCode } = captureRun({
    INPUT_DIRECTORY: '',
    INPUT_MAX_DEPTH: '1'
  });
  assert.strictEqual(exitCode, 1);
});

test('finds only project when solution disabled', () => {
  root = setupDir({ 'proj/app.csproj': '<Project></Project>' });
  const { output } = captureRun({
    INPUT_DIRECTORY: root,
    INPUT_MAX_DEPTH: '3',
    INPUT_FIND_SOLUTION: 'false',
    INPUT_FIND_PROJECT: 'true'
  });
  assert.ok(/project-found=.*app\.csproj/.test(output));
  assert.ok(!/solution-found=/.test(output));
});

test('finds only solution when project disabled', () => {
  root = setupDir({ 'proj/app.sln': '' });
  const { output } = captureRun({
    INPUT_DIRECTORY: root,
    INPUT_MAX_DEPTH: '3',
    INPUT_FIND_SOLUTION: 'true',
    INPUT_FIND_PROJECT: 'false'
  });
  assert.ok(/solution-found=.*app\.sln/.test(output));
  assert.ok(!/project-found=/.test(output));
});
