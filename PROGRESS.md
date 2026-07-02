# Tardi Development Progress

This file serves as a durable record of ongoing work, updated as tasks are completed.

## ✅ Completed
*(None yet)*

## 🚧 In Progress
- **P0.1: Replace `keytar` with `@napi-rs/keyring`**
  - Replacing keychain dependency to ensure CI/Linux compatibility without native compilation steps.

## ⏭️ Not Started (Priority Order)
### P0: Foundation
1. Package for NPM publish (`bin` field).
2. Setup `vitest` suite and GitHub Actions badge.
3. Validate `tardi.yaml` with `zod-validation-error`.
4. Consistent exit codes + `--json` output mode.
5. `@changesets/cli` and SemVer policy.

### P-Interactive: REPL Shell
1. Interactive `tardi` persistent shell loop.
2. `/help`, `/provider`, `/model`, `/auth`, `/run` commands.
3. `/github <url>` integration.

### P1: Core Capability Gaps
1. Tool-call / Trajectory assertions (sequence, args, hallucination checks).
2. Flakiness scoring (pass rate).
3. Judge self-consistency (majority voting with `samples`).
4. Judge response caching.
5. Token / Cost budget tracking.

## ❓ Open Questions
- None.
