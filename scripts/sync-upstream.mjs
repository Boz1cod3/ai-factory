#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.bold.blue('\n🔄 AI Factory - Safe Upstream Sync Utility\n'));

function run(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: options.silent ? 'pipe' : 'inherit',
    ...options,
  });
}

try {
  // 1. Check working tree cleanliness
  const status = run('git status --porcelain', { silent: true }).trim();
  if (status) {
    console.log(chalk.red('❌ Error: Working tree has uncommitted changes.'));
    console.log(chalk.yellow('Please commit or stash your changes before syncing with upstream.\n'));
    process.exit(1);
  }

  // 2. Ensure upstream remote exists
  const remotes = run('git remote -v', { silent: true });
  if (!remotes.includes('upstream')) {
    console.log(chalk.dim('Adding upstream remote: https://github.com/lee-to/ai-factory.git...'));
    run('git remote add upstream https://github.com/lee-to/ai-factory.git');
    console.log(chalk.green('✓ Added upstream remote.'));
  }

  // 3. Fetch upstream
  console.log(chalk.dim('Fetching latest changes from upstream (lee-to/ai-factory)...'));
  run('git fetch upstream');
  console.log(chalk.green('✓ Upstream fetched.'));

  // 4. Determine upstream branch to merge
  let targetBranch = 'upstream/2.x';
  try {
    run('git rev-parse --verify upstream/2.x', { silent: true });
  } catch {
    targetBranch = 'upstream/main';
  }

  console.log(chalk.bold(`Merging ${chalk.cyan(targetBranch)} into current branch...`));
  run(`git merge ${targetBranch} --no-edit`);
  console.log(chalk.green(`✓ Successfully merged ${targetBranch}.`));

  // 5. Run build and verification suite
  console.log(chalk.dim('\nRunning validation suite (build + lint + Antigravity 2.0 e2e test)...'));
  run('npm run build');
  run('npm run lint:unused');
  run('node scripts/test-antigravity-e2e.mjs');

  console.log(chalk.bold.green('\n🎉 SUCCESS: Upstream synced and Antigravity 2.0 integrity verified!\n'));
  console.log(chalk.dim('You can now push the updated branch to your fork with:'));
  console.log(chalk.cyan('  git push origin HEAD\n'));
} catch (error) {
  console.error(chalk.red(`\n❌ Sync failed: ${error.message}`));
  console.log(chalk.yellow('\nIf there are git merge conflicts, resolve them, commit, and re-run:'));
  console.log(chalk.cyan('  node scripts/sync-upstream.mjs\n'));
  process.exit(1);
}
