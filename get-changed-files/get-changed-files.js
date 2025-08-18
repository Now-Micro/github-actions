const { execSync } = require('child_process');
const fs = require('fs');

function hasRemoteOrigin() {
    try {
        execSync('git remote get-url origin', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function ensureCommitExists(sha, prNumber) {
    if (!sha) {
        return false;
    }
    // First, attempt to verify the object directly (no ^{commit} to avoid Windows cmd escaping issues)
    try {
        execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
        return true;
    } catch {
        // continue to fetch attempts
    }

    // If there's no remote origin, we cannot fetch – treat as missing
    if (!hasRemoteOrigin()) {
        return false;
    }

    // Try to fetch the PR ref if prNumber is provided
    if (prNumber) {
        try {
            execSync(`git fetch origin pull/${prNumber}/head:pr-${prNumber}`, { stdio: 'ignore' });
            execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
            return true;
        } catch {
            // fall through to generic fetch
        }
    }

    // Try to fetch from origin by branch/sha
    try {
        execSync(`git fetch origin ${sha}`, { stdio: 'ignore' });
        execSync(`git cat-file -e ${sha}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function run() {
    try {
        console.log(`🔍 Getting Changed Files between '${process.env.INPUT_BASE_REF}' and '${process.env.INPUT_HEAD_REF}'`);
        console.log('========================================');

        // Use explicit SHAs if provided, fallback to branch names
        const baseSha = process.env.INPUT_BASE_REF || '';
        const headSha = process.env.INPUT_HEAD_REF || '';
        const prNumber = process.env.GITHUB_PR_NUMBER || '';

        if (baseSha && !ensureCommitExists(baseSha, prNumber)) {
            throw new Error(`Base SHA ${baseSha} not found and could not be fetched.`);
        }
        if (headSha && !ensureCommitExists(headSha, prNumber)) {
            throw new Error(`Head SHA ${headSha} not found and could not be fetched.`);
        }
        let gitCommand;
        if (baseSha && headSha) {
            gitCommand = `git diff --name-only ${baseSha}...${headSha}`;
        } else if (baseSha) {
            gitCommand = `git diff --name-only ${baseSha}...HEAD`;
        } else {
            gitCommand = 'git diff --name-only';
        }
        console.log('Git command:', gitCommand);
        const files = execSync(gitCommand, {
            encoding: 'utf8'
        }).trim();

        console.log('\n=== Changed Files ===');
        if (files) {
            console.log(files);
        } else {
            console.log('(no files changed)');
        }
        console.log('====================\n');

        if (!files) {
            console.log('No changed files found.');
            fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed_files=[]\n`);
            console.log('✅ Complete - no changes detected');
            process.exit(0);
        }

        // Convert newline-separated files to JSON array
        const fileList = files.split('\n').filter(f => f.trim());
        const json = JSON.stringify(fileList);

        console.log(`\n📤 Output:`);
        console.log(`  changed_files: ${json}`);

        // Write to GITHUB_OUTPUT
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed_files=${json}\n`);
        console.log('✅ Complete - outputs written successfully');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = { run, ensureCommitExists };