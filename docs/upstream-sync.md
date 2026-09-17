# Upstream Sync & Fork Maintenance Guide

This repository (`Boz1cod3/ai-factory`) is a modernized fork of [lee-to/ai-factory](https://github.com/lee-to/ai-factory), featuring first-class support for **Google Antigravity 2.0** (Agent Skills layout, native subagents, MCP configuration, and rule triggers).

---

## 1. Remote Architecture

Your Git environment uses two remotes:

| Remote | URL | Role |
|---|---|---|
| **`origin`** | `https://github.com/Boz1cod3/ai-factory.git` | Your personal fork containing Antigravity 2.0 modernizations. |
| **`upstream`** | `https://github.com/lee-to/ai-factory.git` | The official repository by Danil Shutsky (`lee-to`). |

To verify remotes at any time:
```bash
git remote -v
```

If `upstream` is ever missing, configure it with:
```bash
git remote add upstream https://github.com/lee-to/ai-factory.git
```

---

## 2. One-Command Safe Sync

To safely pull updates from the original author while guaranteeing that Antigravity 2.0 is preserved:

```bash
npm run sync:upstream
```

### What this script does automatically:
1. Validates that your working tree is clean.
2. Fetches the latest commits from `upstream`.
3. Merges `upstream/2.x` (or `upstream/main`) into your current branch.
4. Automatically runs:
   - `npm run build` (type-checking)
   - `npm run lint:unused`
   - `node scripts/test-antigravity-e2e.mjs` (Antigravity 2.0 end-to-end verification)
5. Only reports success if all Antigravity 2.0 functionality remains 100% operational.

---

## 3. Why Your Antigravity 2.0 Changes Never Conflict

Our modernizations are cleanly isolated from upstream files:

1. **Native Subagents**: Located in `subagents/antigravity/agents/*.md` — upstream has no conflicting files in this directory.
2. **Transformer**: Located in `src/core/transformers/antigravity.ts` — upstream has not touched Antigravity transformers.
3. **Agent Registry**: Antigravity configuration in `src/core/agents.ts` uses modern `.agents` standards without altering Claude or Codex definitions.
4. **Test Suite**: Tests in `scripts/test-antigravity-e2e.mjs` run independently.

When upstream merges new base skills (e.g. `aif-*`), Git performs a 3-way merge cleanly without overwriting our Antigravity 2.0 infrastructure.

---

## 4. Contributing Upstream (Creating a Pull Request)

Because this implementation follows all `ai-factory` architectural principles and includes full test coverage, you can contribute it back to `lee-to/ai-factory`:

1. Push your branch to GitHub:
   ```bash
   git push origin feature/antigravity-2-0-modernization
   ```
2. Open GitHub:
   [https://github.com/Boz1cod3/ai-factory/pull/new/feature/antigravity-2-0-modernization](https://github.com/Boz1cod3/ai-factory/pull/new/feature/antigravity-2-0-modernization)
3. Select base repository: `lee-to/ai-factory`, base branch: `2.x`.
4. Title: `feat(antigravity): modernize to Antigravity 2.0 with skills, MCP, rule triggers, and native subagents`.
5. Once merged upstream by Danil Shutsky, Antigravity 2.0 will be part of the official releases for all users worldwide.
