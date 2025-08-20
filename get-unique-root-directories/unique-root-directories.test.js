const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { run } = require('./unique-root-directories');

const LINTING_REGEX = '^([^/.]+)\/';
const TESTING_REGEX = '^([^\/]+)\/(src|tests?)\/.*\.(cs|csproj|sln)$'

function withEnv(env, fn) {
  const prev = { ...process.env };
  Object.assign(process.env, env);
  const showLogs = true;
  let exitCode = 0;
  const origExit = process.exit;
  process.exit = c => { exitCode = c || 0; throw new Error(`__EXIT_${exitCode}__`); };
  let out = '', err = '';
  const so = process.stdout.write, se = process.stderr.write;
  if (showLogs) {
    // Mirror output to console while capturing
    process.stdout.write = (c, e, cb) => { out += c; return so.call(process.stdout, c, e, cb); };
    process.stderr.write = (c, e, cb) => { err += c; return se.call(process.stderr, c, e, cb); };
  } else {
    // Suppress console output, capture silently
    process.stdout.write = (c, e, cb) => { out += c; return true; };
    process.stderr.write = (c, e, cb) => { err += c; return true; };
  }
  try {
    try { fn(); } catch (e) { if (!/^__EXIT_/.test(e.message)) throw e; }
  } finally {
    process.env = prev;
    process.exit = origExit;
    process.stdout.write = so;
    process.stderr.write = se;
  }
  return { exitCode, out, err };
}

function runWith(env) {
  // Replace local repo tmp file with an OS temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urd-'));
  const tmpOut = path.join(tmpDir, 'output.txt');
  fs.writeFileSync(tmpOut, '');
  const r = withEnv({ ...env, GITHUB_OUTPUT: tmpOut }, () => run());
  r.outputFile = tmpOut;
  r.outputContent = fs.readFileSync(tmpOut, 'utf8');
  return r;
}

// 1 valid extraction
test('extracts unique roots', () => {
  const r = runWith({ INPUT_PATTERN: '^(src/[^/]+)/', INPUT_PATHS: 'src/Api/Program.cs,src/Api/Controllers/Home.cs,src/Lib/Util.cs' });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.out, /Api/);
  assert.match(r.out, /Lib/);
  assert.match(r.outputContent, /unique_root_directories=\["src\/Api","src\/Lib"\]/);
});

// 2 no matches
test('no matches writes empty array', () => {
  const r = runWith({ INPUT_PATTERN: '^(foo)/', INPUT_PATHS: 'src/Api/Program.cs' });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.out, /\[\]/);
  assert.match(r.outputContent, /unique_root_directories=\[\]/);
});

// 3 invalid regex
test('invalid regex exits 1', () => {
  const r = runWith({ INPUT_PATTERN: '([unclosed', INPUT_PATHS: 'a,b' });
  assert.strictEqual(r.exitCode, 1);
  assert.match(r.err + r.out, /Invalid regex/);
});

// 4 missing pattern
test('missing pattern exits 1', () => {
  const r = runWith({ INPUT_PATHS: 'a,b' });
  assert.strictEqual(r.exitCode, 1);
  assert.match(r.err + r.out, /INPUT_PATTERN is required/);
});

// 5 missing GITHUB_OUTPUT
test('missing GITHUB_OUTPUT exits 1', () => {
  // Override any runner-provided GITHUB_OUTPUT with empty string to simulate absence
  const r = withEnv({ INPUT_PATTERN: '^(.*)$', INPUT_PATHS: 'a,b', GITHUB_OUTPUT: '' }, () => run());
  assert.strictEqual(r.exitCode, 1);
  assert.match(r.err + r.out, /GITHUB_OUTPUT not set/);
});

// 6 duplicate handling (ensure uniqueness)
test('duplicates only logged once', () => {
  const r = runWith({ INPUT_PATTERN: '^(src/Api)/', INPUT_PATHS: 'src/Api/One.cs,src/Api/Two.cs' });
  assert.strictEqual(r.exitCode, 0);
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 1);
});

test('multiple duplicates across three unique roots', () => {
  const paths = [
    'src/Api/Program.cs',
    'src/Api/Program.cs', // duplicate
    'src/Api/Controllers/Home.cs',
    'src/Lib/Lib.cs',
    'src/Lib/Lib.cs', // duplicate
    'src/Util/Helper.cs',
    'src/Util/Helper.cs', // duplicate
    'src/Util/Another.cs'
  ].join(',');
  const r = runWith({ INPUT_PATTERN: '^(src/[^/]+)/', INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  // Expect three unique roots
  assert.match(r.outputContent, /unique_root_directories=\["src\/Api","src\/Lib","src\/Util"\]/);
  // Each unique root should be logged exactly once
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 3);
});

test('testing regex - matches src, test, tests variants and ignores invalid paths/extensions', () => {
  const paths = [
    // Valid matches (src)
    'ProjectA/src/Program.cs',
    'ProjectA/src/Utils/Helper.cs', // duplicate root ProjectA
    // Valid matches (test)
    'ProjectB/test/ProjectB.csproj',
    'ProjectB/tests/Another.cs', // still matches (tests) duplicate root ProjectB
    // Valid matches (tests)
    'ProjectC/tests/Solution.sln',
    'ProjectC/test/Other.cs', // variant second segment 'test' for same root
    // Root character variation
    'My-App/src/Util.cs',
    'My.App/tests/Suite.sln',
    // Non-matching: wrong second segment
    'ProjectD/lib/Program.cs',
    // Non-matching: wrong extension
    'ProjectE/src/README.md',
    // Non-matching: leading slash
    '/ProjectF/src/Program.cs',
    // Non-matching: bad extension
    'ProjectG/tests/Program.txt',
    // Non-matching: no file extension acceptable
    'ProjectH/src/Dir',
    // Non-matching: similar but wrong extension
    'ProjectI/tests/Program.csx'
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  // Expect roots in order of first valid appearance
  assert.match(r.outputContent, /unique_root_directories=\["ProjectA","ProjectB","ProjectC","My-App","My.App"\]/);
  // Ensure each expected root logged exactly once (5 occurrences)
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 5);
});

// No matches scenario for complex pattern

test('testing regex: no matches returns empty array', () => {
  const paths = [
    'Alpha/lib/File.cs', // wrong segment
    'Beta/source/Program.cs', // wrong segment name
    'Gamma/src/Readme.md', // wrong extension
    '/Delta/src/Program.cs', // leading slash
    'Epsilon/tests/Notes.txt', // wrong extension
    'Zeta/src/Folder' // no extension
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\[\]/);
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 0);
});

test('Linting pattern: extracts valid roots, skips dotted/hidden/invalid, preserves order', () => {
  const paths = [
    'Alpha/src/File.cs',          // match Alpha
    'Beta/tests/Test.cs',         // match Beta
    'Alpha/docs/Readme.md',       // duplicate Alpha
    'Gamma/one/two/three.txt',    // match Gamma
    'Bad.Root/src/File.cs',       // segment has dot -> no match
    '.hidden/src/File.cs',        // starts with dot -> no match
    'delta/',                     // match delta (trailing slash only)
    'epsilon',                    // no slash -> no match
    'foo.bar/',                   // segment has dot -> no match
    'my-app/src/index.cs',        // hyphen allowed -> match my-app
    'my_app/src/index.cs',        // underscore allowed -> match my_app
    'Zeta/Another.cs',            // match Zeta
    'Alpha/more/Deeper.cs',       // duplicate Alpha again
    '  Beta/space.cs',            // leading space trimmed -> Beta duplicate
  ].join(',');
  const r = runWith({ INPUT_PATTERN: LINTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  // Expected unique roots in first-seen order: Alpha, Beta, Gamma, delta, my-app, my_app, Zeta
  assert.match(r.outputContent, /unique_root_directories=\["Alpha","Beta","Gamma","delta","my-app","my_app","Zeta"\]/);
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 7);
});

test('Linting pattern: duplicates only logged once per root', () => {
  const paths = [
    'Proj/one.cs', 'Proj/two.cs', 'Proj/three.cs', // same root
    'Other/file.cs', 'Other/file2.cs',              // second root duplicates
  ].join(',');
  const r = runWith({ INPUT_PATTERN: LINTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["Proj","Other"\]/);
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 2);
});

test('Linting pattern: no matches', () => {
  const paths = [
    '.hidden',       // no slash, starts with dot
    'with.dot',      // no slash, has dot
    '.hidden/file',  // starts with dot
    'bad.root/file', // segment has dot
    'onlyfile',      // no slash
    '/leading/slash/file', // leading slash -> first char '/'
  ].join(',');
  const r = runWith({ INPUT_PATTERN: LINTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\[\]/);
  const occurrences = (r.out.match(/Unique Root Directory found/g) || []).length;
  assert.strictEqual(occurrences, 0);
});

test('complex regex: de-duplicates root across src/test/tests variants and multiple extensions', () => {
  const paths = [
    'ProjMix/src/Main.cs',            // .cs
    'ProjMix/tests/Unit/Spec.cs',     // duplicate root via tests
    'ProjMix/test/ProjMix.csproj',    // duplicate root via test & .csproj
    'ProjMix/src/Nested/More/App.sln' // duplicate root via .sln
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["ProjMix"\]/);
});

test('complex regex: mixed unrelated valid and invalid roots preserve insertion order', () => {
  const paths = [
    'A/src/A.cs',
    'B/tests/BSpec.cs',
    'C/test/C.csproj',
    'D/src/D.sln',
    'E/lib/E.cs',          // invalid second segment
    'F/tests/readme.md',    // invalid extension
    'G/src/file.CS',        // uppercase extension should NOT match (case sensitive)
    'Hsrc/Not/Really.cs',   // missing slash after root segment pattern expects
    'I/tes/Almost.cs',      // wrong segment "tes"
    'J/src/deep/file.cs'    // valid new root
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["A","B","C","D","J"\]/);
});

test('complex regex: backslash path separators do not match (ensures POSIX style required)', () => {
  const paths = [
    'WinProj\\src\\Program.cs', // backslashes -> should NOT match
    'RealProj/src/Program.cs'      // should match
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["RealProj"\]/);
});

test('complex regex: whitespace', () => {
  const paths = [
    '  Solution1/src/Api/Program.cs',
    '   Solution1/src/Api/Program.cs',
    '     Solution1/src/Api/Controllers/Home.cs',
    '     Solution1/src/Lib/Lib.cs',
    '   Solution1/src/Lib/Lib.cs',
    '       Solution1/src/Util/Helper.cs',
    '     Solution1/src/Util/Helper.cs',
    ' Solution1/src/Util/Another.cs',
    '     Solution2/tests/Util/Another.cs',
    '   Solution3/tests/Test.cs',
    ' SkipSolution1/example/tests/README.md',
    '  SkipSolution2/src/Api/README.md',
    '     SkipSolution3/README.md'
  ].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["Solution1","Solution2","Solution3"\]/);
});


test('testing extra characters', () => {
  const paths = ["[\".github/workflows/checks.yml\"","[\"ChannelOnline/tests/Trafera.ChannelOnline.Tests/GlobalUsings.cs]\""].join(',');
  const r = runWith({ INPUT_PATTERN: TESTING_REGEX, INPUT_PATHS: paths });
  assert.strictEqual(r.exitCode, 0);
  assert.match(r.outputContent, /unique_root_directories=\["ChannelOnline"\]/);
});
