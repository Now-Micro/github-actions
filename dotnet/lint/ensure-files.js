// Ensures csharpierrc.yaml and dotnet-tools.json exist, creating defaults if missing
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) {
    console.log(`${filePath} file is missing. Creating default.`);
    fs.writeFileSync(filePath, defaultContent);
  } else {
    const existingContent = fs.readFileSync(filePath, 'utf8');
    console.log(`Existing content of ${filePath}:\n${existingContent}`);
  }
}

function ensureToolsJson(filePath, csharpierVersion) {
  let data;
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.tools) data.tools = {};
    data.tools.csharpier = {
      version: csharpierVersion,
      commands: ['csharpier']
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Ensured csharpier tool definition ${csharpierVersion}`);
  } else {
    // Create default file with csharpier tool
    const defaultJson = {
      version: 1,
      isRoot: true,
      tools: {
        csharpier: {
          version: csharpierVersion,
          commands: ['csharpier']
        }
      }
    };
    fs.writeFileSync(filePath, JSON.stringify(defaultJson, null, 2) + '\n');
    console.log(`Created ${filePath} with csharpier version ${csharpierVersion}`);
  }
}

function run() {
  const csharpierrcPath = process.env.INPUT_CSHARPIERRC_PATH;
  const toolsJsonPath = process.env.INPUT_TOOLS_JSON_PATH;
  const csharpierVersion = process.env.INPUT_CSHARPIER_VERSION || '1.1.2';

  if (!csharpierrcPath || !toolsJsonPath) {
    console.error('INPUT_CSHARPIERRC_PATH and INPUT_TOOLS_JSON_PATH are required');
    process.exit(1);
  }

  ensureDir(csharpierrcPath);
  ensureDir(toolsJsonPath);
  ensureFile(
    csharpierrcPath,
    'printWidth: 120\nuseTabs: false\ntabWidth: 4\nendOfLine: lf\npreprocessorSymbolSets:\n  - ""\n  - "DEBUG"\n  - "DEBUG,CODE_STYLE"\n'
  );
  ensureToolsJson(toolsJsonPath, csharpierVersion);
  console.log('State after ensure:');
  fs.readdirSync(path.dirname(toolsJsonPath)).forEach(f => {
    const stat = fs.statSync(path.join(path.dirname(toolsJsonPath), f));
    console.log(`${stat.isDirectory() ? 'd' : '-'} ${f}`);
  });
}

if (require.main === module) run();
module.exports = { run };
