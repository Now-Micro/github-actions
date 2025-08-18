const fs = require('fs');
const path = require('path');

let projectFound, solutionFound;

function walk(dir, maxDepth, findSolution, findProject, currentDepth = 0) {
  console.log(`Searching in: ${dir}, Depth: ${currentDepth}, MaxDepth: ${maxDepth}, FindSolution: ${findSolution}, FindProject: ${findProject}`);
  if (currentDepth > maxDepth) {
    console.log(`Max depth of ${maxDepth} reached at ${dir}`);
    return;
  }
  if (solutionFound && projectFound) {
    return;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    console.error(`Cannot read directory: ${dir}`);
    return;
  }

  for (const entry of entries) {
    if (findSolution && entry.isFile() && entry.name.endsWith('.sln')) {
      solutionFound = path.join(dir, entry.name);
    }
    if (findProject && entry.isFile() && entry.name.endsWith('.csproj')) {
      projectFound = path.join(dir, entry.name);
    }
    if (entry.isDirectory() && !(solutionFound && projectFound)) {
      walk(path.join(dir, entry.name), maxDepth, findSolution, findProject, currentDepth + 1);
    }
  }
}

function run() {
  try {
    // Reset global state each invocation
    projectFound = undefined;
    solutionFound = undefined;

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
        fs.appendFileSync(githubOutput, `solution-found=${solutionFound}\n`);
      }
      if (projectFound && projectFound.endsWith('.csproj')) {
        fs.appendFileSync(githubOutput, `project-found=${projectFound}\n`);
      }
    } else {
      console.error('GITHUB_OUTPUT not set; cannot write outputs');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, walk };
