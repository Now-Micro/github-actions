const fs = require('fs');
const path = require('path');

let projectFound, solutionFound;
let debug = false;

function dlog(msg) {
  if (debug) console.log(`[DEBUG] ${msg}`);
}

function walk(dir, maxDepth, findSolution, findProject, currentDepth = 0) {
  dlog(`Entering walk: dir='${dir}' depth=${currentDepth}/${maxDepth} findSolution=${findSolution} findProject=${findProject}`);
  if (currentDepth > maxDepth) {
    dlog(`Depth limit exceeded at ${dir}`);
    return;
  }
  if (solutionFound && projectFound) {
    dlog('Both solution and project already found, pruning traversal');
    return;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`Cannot read directory: ${dir} (${e.message})`);
    return;
  }
  dlog(`Listing ${entries.length} entries in ${dir}`);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile()) {
      dlog(`File: ${full}`);
    } else if (entry.isDirectory()) {
      dlog(`Dir: ${full}`);
    }
    if (!solutionFound && findSolution && entry.isFile() && entry.name.endsWith('.sln')) {
      solutionFound = full;
      console.log(`Found solution: ${solutionFound}`);
    }
    if (!projectFound && findProject && entry.isFile() && entry.name.endsWith('.csproj')) {
      projectFound = full;
      console.log(`Found project: ${projectFound}`);
    }
    if (entry.isDirectory() && !(solutionFound && projectFound)) {
      walk(full, maxDepth, findSolution, findProject, currentDepth + 1);
    }
    if (solutionFound && projectFound) break;
  }
}

function run() {
  try {
    // Reset global state each invocation
    projectFound = undefined;
    solutionFound = undefined;
    debug = (process.env.INPUT_DEBUG_MODE || 'false').toLowerCase() === 'true';

    const rawDir = process.env.INPUT_DIRECTORY || '';
    const inputDir = rawDir ? (path.isAbsolute(rawDir) ? rawDir : path.resolve(rawDir)) : '';
    const maxDepth = parseInt(process.env.INPUT_MAX_DEPTH || '1', 10);
    const findSolution = (process.env.INPUT_FIND_SOLUTION || 'true').toLowerCase() === 'true';
    const findProject = (process.env.INPUT_FIND_PROJECT || 'false').toLowerCase() === 'true';
    const githubOutput = process.env.GITHUB_OUTPUT;

    console.log(`Input directory: ${inputDir}`);
    console.log(`Max depth: ${maxDepth}`);
    console.log(`Find solution: ${findSolution}`);
    console.log(`Find project: ${findProject}`);
    dlog(`Debug mode enabled`);

    if (!inputDir) {
      console.error('Input directory is required.');
      process.exit(1);
    }
    if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
      console.error(`Input directory does not exist or is not a directory: ${inputDir}`);
      process.exit(1);
    }

    console.log(`Searching for .sln or .csproj files in ${inputDir}...`);
    walk(inputDir, maxDepth, findSolution, findProject);

    console.log(`Project found: ${projectFound || 'None'}`);
    console.log(`Solution found: ${solutionFound || 'None'}`);

    if (githubOutput) {
      if (solutionFound && solutionFound.endsWith('.sln')) {
        dlog(`Writing solution-found output: ${solutionFound}`);
        fs.appendFileSync(githubOutput, `solution-found=${solutionFound}\n`);
      }
      if (projectFound && projectFound.endsWith('.csproj')) {
        dlog(`Writing project-found output: ${projectFound}`);
        fs.appendFileSync(githubOutput, `project-found=${projectFound}\n`);
      }
    } else {
      console.error('GITHUB_OUTPUT not set; cannot write outputs');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (debug) console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, walk };
