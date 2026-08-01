# Yamabiko Blocks repository instructions

These instructions apply to the entire repository.

## Repository boundaries

- `app/` is the WordPress plugin root. There is no nested `app/plugin/` directory.
- `.devcontainer/`, `docker/`, and `environments/` contain local development infrastructure.
- `docs/development/` explains development principles and the reasons behind them.
- Read `app/AGENTS.md` before changing files under `app/`.

## Working rules

- Make the smallest change that fully satisfies the current issue.
- Keep documentation aligned with the code, commands, and directories that exist on the current branch.
- Do not add placeholder directories or describe unimplemented systems as available.
- Do not commit generated dependencies or build output such as `node_modules/`, `app/vendor/`, or `app/build/`.
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
