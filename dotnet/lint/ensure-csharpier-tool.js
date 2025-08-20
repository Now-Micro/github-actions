// Ensures csharpier tool entry is present in dotnet-tools.json
const fs = require('fs');

function run() {
  const toolsJsonPath = process.env.INPUT_TOOLS_JSON_PATH;
  const csharpierVersion = process.env.INPUT_CSHARPIER_VERSION;
  if (!toolsJsonPath) {
    console.error('INPUT_TOOLS_JSON_PATH is required');
    process.exit(1);
  }
  let d;
  try {
    d = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read or parse', toolsJsonPath, e);
    process.exit(1);
  }
  if (!d.tools) d.tools = {};
  if (!d.tools.csharpier) {
    d.tools.csharpier = { version: csharpierVersion, commands: ['csharpier'] };
    fs.writeFileSync(toolsJsonPath, JSON.stringify(d, null, 2) + '\n');
    console.log('Injected csharpier tool definition ' + csharpierVersion);
  } else {
    d.tools.csharpier.version = csharpierVersion;
    fs.writeFileSync(toolsJsonPath, JSON.stringify(d, null, 2) + '\n');
    console.log('csharpier tool already present, updated to ' + csharpierVersion);
  }
  console.log('--- dotnet-tools.json ---');
  console.log(fs.readFileSync(toolsJsonPath, 'utf8'));
}

if (require.main === module) run();
module.exports = { run };
