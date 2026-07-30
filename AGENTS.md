# Yamabiko Blocks repository contract

These instructions apply to the entire repository. Keep this file focused on
repository-wide rules; more specific guidance lives in nested `AGENTS.md`
files.

## Sources of truth and boundaries

- Treat `docs/development/foundation.md` as the cross-cutting contract for
  every implementation and review. Read the documents it routes to when they
  apply to the task.
- Keep the development workspace in `app/`.
  Follow the additional instructions in those directories when
  working below them.
- Before implementing a feature, complete and obtain approval for a vertical-
  slice plan based on `docs/plans/TEMPLATE.md`.
- Do not add placeholder directories, empty feature classes, public hooks,
  persistent data, network requests, or runtime assets without that approved
  plan.

## Personal local environment data

- Do not include personal local environment information in source code,
  documentation, examples, plans, comments, test fixtures, or committed
  configuration.
- This includes OS user names, home directory paths, machine or device names,
  personal repository locations, local-only IP addresses or host names that
  identify one person's environment, personal editor or IDE install paths,
  account names, personal tokens, secrets, and commands that only work because
  of one person's local setup.
- Use placeholders such as `<repository-root>`,
  `/absolute/path/to/repository`, `<windows-user>`, `<host-ip>`,
  `${localWorkspaceFolder}`, `$CODEX_HOME`, and `~/.codex` in committed files.
- If measured local environment details must be recorded, anonymize or
  generalize personal values before writing them to tracked files. Keep real
  personal values only in Git-ignored local configuration.

## External tool boundaries

- Distinguish failures caused by repository code or configuration from
  limitations, defects, or compatibility differences in external tools such as
  Docker, act, and Dev Containers.
- When the available evidence reasonably places the root cause outside the
  repository, report the evidence and impact, then stop instead of spending
  extended time investigating the external tool or implementing workarounds.
- Treat GitHub-hosted GitHub Actions runs as the authoritative CI result. Use
  act only as an optional local feedback tool.
- Do not change product code or GitHub Actions workflows solely to accommodate
  an act-specific or other external-tool-specific failure.
- Before extending external-tool research, implementing a workaround, or
  changing the development environment, present the relevant options and ask
  the user which direction to take.

## Communication

- Do not send routine progress updates while working.
- Continue silently until user approval is required, a blocking issue is found,
  the requested approach must change, or the task is complete.
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

Do not run an alternative or broaden the scope without approval when the choice
could materially affect the repository, environment, dependencies, or user
data.

## End-of-turn reports

- When files were changed, commands were run, or an implementation plan was
  produced, end the final response with a Japanese Markdown summary.
- Do not add the structured summary to simple questions, explanations, or
  requests that do not perform repository work.
- For implementation plans, keep the plan and final summary in separate
  copyable Markdown blocks.
- For other repository work, use one fenced `md` block for the summary.
- Include `Work performed`, `Changed files`, `Commands run`, `Decision rationale`,
  `Open items`, and `Next steps`.
- Under `Commands run`, list every shell command actually run and its result
  (`success`, `failure`, or `interrupted`), including failed or interrupted
  commands. Preserve the command form so `logcut` use is visible while
  following the existing personal-environment and secret-handling rules.
- Write `None` only when a required field has nothing to report.

## Efficient workflow

- Inspect only the files, documentation, and history required for the requested
  task.
- Do not inspect dependency, generated, cache, build, distribution, or
  test-output directories unless the task requires them.
- Before reading large diffs, logs, search results, or file listings, inspect a
  summary or matching-file list and expand only the relevant section.
- Prefer the narrowest relevant validation while iterating. Run complete
  quality gates only when required by the applicable development documentation
  or before final handoff.
- Do not re-read unchanged files or repeat successful commands unless new
  evidence makes it necessary.
- Do not broaden the requested scope unless doing so is necessary to complete
  the requested outcome.

## Command output

- Use `logcut` only after the execution-environment check confirms Codex is
  running inside the Dev Container.
- On the host, run the normal command. To invoke the wrapper from the host, use
  `docker compose exec --user www-data wordpress logcut <command> ...`.
- Use `logcut` only for finite commands whose successful output is not
  needed.
- Never use `logcut` for commands containing tokens, passwords,
  Authorization headers, signed URLs, or other secrets. The wrapper omits
  arguments from its status lines, but the executed command can still write
  sensitive values to its retained failure log.
- When `logcut` fails, inspect its summary first, then read only the relevant
  section of the preserved full log when additional context is required.
- Do not rerun a failed command solely to obtain output already available in its
  preserved log.
- For diagnostic or query commands, constrain output at the source with paths,
  filters, formats, ranges, counts, time windows, or failed-only options.
- This includes Docker inspection and log commands such as `docker ps`,
  `docker inspect`, and `docker logs`; do not wrap them with `logcut`.
- Do not use `logcut` for interactive, watch-mode, streaming, or long-running
  development commands.
