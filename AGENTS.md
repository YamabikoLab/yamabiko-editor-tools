# Yamabiko Editor Tools repository instructions

These instructions apply to the entire repository.

## Repository boundaries

- The repository root is the WordPress plugin root.
- `src/` contains product source code. Read `src/AGENTS.md` before changing files under `src/`.
- Local WordPress development infrastructure is maintained in the separate `YamabikoLab/wp-dev` repository.
- `docs/development/` explains development principles and the reasons behind them.

## Development documentation

- Read `docs/development/foundation.md` for repository-wide development principles.
- Read `docs/development/source-organization.md` before adding or moving source files.
- Read `docs/development/testing.md` before selecting validation commands.
- Read `docs/development/github-cli.md` when using GitHub CLI.
- Read `docs/development/releasing.md` before updating versions or creating a release tag.
- Use `docs/plans/TEMPLATE.md` for features or changes that require multiple implementation steps or important design decisions.
- Simple fixes and documentation-only changes do not require a plan.

## Working rules

- Make the smallest change that fully satisfies the current issue.
- Keep documentation aligned with the code, commands, and directories that exist on the current branch.
- Do not add placeholder directories or describe unimplemented systems as available.
- Do not commit generated dependencies or build output such as `node_modules/`, `vendor/`, or `build/`.
- Do not commit secrets, credentials, personal paths, machine names, or other local-only environment details.
- Preserve released identifiers and saved content unless the issue explicitly includes a compatibility decision.

## Documentation responsibilities

- Put direct working instructions in `AGENTS.md` files.
- Put architecture, organization, and rationale in `docs/development/`.
- Update the relevant documentation when a command, directory boundary, or development rule changes.
- Avoid repeating detailed command lists across multiple documents. Use `docs/development/testing.md` as the source of truth for validation commands.

## Validation

- Run only the checks applicable to the changed files, as described in `docs/development/testing.md`.
- Documentation-only changes do not require application builds or linters unless code or configuration also changes.
- Never report a command as successful unless it actually ran successfully.

## External tool boundaries

- Distinguish failures caused by repository code or configuration from limitations, defects, or compatibility differences in external tools such as Docker and act, or in the separate local development environment.
- When the available evidence reasonably places the root cause outside the repository, report the evidence and impact, then stop instead of spending extended time investigating the external tool or implementing workarounds.
- Treat GitHub-hosted GitHub Actions runs as the authoritative CI result. Use act only as an optional local feedback tool.
- Do not change product code or GitHub Actions workflows solely to accommodate an act-specific or other external-tool-specific failure.
- Before extending external-tool research, implementing a workaround, or changing the development environment, present the relevant options and ask the user which direction to take.

## Communication

- Do not send routine progress updates while working.
- Continue silently until user approval is required, a blocking issue is found, the requested approach must change, or the task is complete.
- Do not narrate routine file reads, searches, edits, or successful commands.
- Keep all messages concise.

## Approval requests

For simple, low-risk approval requests, report only:

- command or action;
- why approval is required;
- expected effect;
- recommendation.

For destructive, unexpected, or decision-sensitive actions, report:

- observed issue;
- likely cause;
- available options;
- key advantages and disadvantages of each option;
- recommended option and reason.

Do not run an alternative or broaden the scope without approval when the choice could materially affect the repository, environment, dependencies, or user data.

## End-of-turn reports

- When files were changed, commands were run, or an implementation plan was produced, end the final response with a Japanese Markdown summary.
- Do not add the structured summary to simple questions, explanations, or requests that do not perform repository work.
- Include `Work performed`, `Changed files`, `Commands run`, `Decision rationale`, `Open items`, and `Next steps`.
- When changes are pushed, include `<repository-url>/compare/<starting-sha>..<pushed-sha>` in the final response.
- Report up to three inefficient activities, such as large reads, repeated searches, or unnecessary command output.
- Under `Commands run`, list every shell command actually run and its result (`success`, `failure`, or `interrupted`), including failed or interrupted commands. Preserve the command form while following the existing personal-environment and secret-handling rules.
- Write `None` only when a required field has nothing to report.

## Efficient workflow

- Inspect only the files, documentation, and history required for the requested task.
- Do not inspect dependency, generated, cache, build, distribution, or test-output directories unless the task requires them.
- Before reading large diffs, logs, search results, or file listings, inspect a summary or matching-file list and expand only the relevant section.
- Prefer the narrowest relevant validation while iterating. Run complete quality gates only when required by the applicable development documentation or before final handoff.
- Do not re-read unchanged files or repeat successful commands unless new evidence makes it necessary.
- Do not broaden the requested scope unless doing so is necessary to complete the requested outcome.

## Command output

- Use `logcut` only after the execution-environment check confirms Codex is running inside the Dev Container.
- On the host, run the normal command. To invoke the wrapper from the host, use the command documented by the active development environment.
- Use `logcut` only for finite commands whose successful output is not needed.
- Never use `logcut` for commands containing tokens, passwords, Authorization headers, signed URLs, or other secrets. The wrapper omits arguments from its status lines, but the executed command can still write sensitive values to its retained failure log.
- When `logcut` fails, inspect its summary first, then read only the relevant section of the preserved full log when additional context is required.
- Do not rerun a failed command solely to obtain output already available in its preserved log.
- For diagnostic or query commands, constrain output at the source with paths, filters, formats, ranges, counts, time windows, or failed-only options.
- Follow the `YamabikoLab/wp-dev` documentation for commands that operate the local WordPress development environment.
