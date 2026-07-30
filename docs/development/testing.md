# Testing and quality commands

The `app/` directory is the WordPress plugin root. Run application quality
commands from there.

Related contracts:

- `foundation.md`: runtime, security, compatibility, and dependency rules;
- `source-organization.md`: ownership and test placement.

## Principles

- During implementation, run the narrowest relevant check.
- Before handoff, run each applicable complete gate once.
- After fixing a failed subcommand, rerun its complete gate.
- Never report a command as passed unless it actually succeeded.
- Documentation-only changes need no application tests unless code,
  configuration, commands, or generated examples also changed.

## Install

```bash
cd app
composer install
npm ci
```

Commit `composer.lock` or `package-lock.json` when its dependency definition
changes. Local development uses `app/vendor/`; there is no nested
`app/plugin/vendor/`.

## Current Node gate

The complete Node gate currently available is:

```bash
npm test
```

Inside the Dev Container, use:

```bash
logcut npm test
```

It currently runs:

- `npm run format:check`;
- `npm run lint`;
- `npm run typecheck`.

The WordPress-oriented Vite build, unit tests, changed-file test selection, and
E2E tests are not complete gates yet. Add them only with the implementation and
tests that make those commands meaningful.

Use these file-oriented commands only while iterating:

```bash
npm run format:files -- <files...>
npm run lint:files -- <files...>
```

They require explicit file arguments and are not complete quality gates.

## PHP checks

PHPUnit, PHPStan, PHPCS, and WordPress Coding Standards will be introduced with
the PHP testing foundation. Until then, lint each changed PHP file directly:

```bash
php -l path/to/changed-file.php
```

Do not document or invoke `composer check` until that Composer script and its
underlying tools exist.

## Bootstrap compatibility

The main plugin file is `yamabiko-blocks.php`.

It should:

- remain parseable on PHP 7.4 where practical;
- return safely when `ABSPATH` is undefined;
- avoid a fatal error when the production autoloader is missing;
- load runtime classes that support the published PHP 8.1 minimum.

WordPress plugin metadata is the authoritative activation gate. Do not add a
separate runtime PHP version check without changing the approved compatibility
contract.

## Notice reference feature

Issue #4 establishes `yamabiko/notice` as the first reference feature.

When its automated tests are added, verify that:

- `info`, `tip`, and `warning` are accepted;
- unsupported values fall back to `info`;
- values and display labels remain aligned;
- pure tone logic runs without WordPress, React, DOM, or network access;
- the block registers on the intended hook;
- `block.json` attributes match PHP behavior;
- unsafe HTML is removed or neutralized while permitted inline markup remains;
- wrapper attributes and tone classes are present;
- user-facing strings are translatable;
- missing build output does not cause a fatal error.

TypeScript tests belong beside their source. PHP tests belong under
`tests/php/<Feature>/`.

## Manual Notice acceptance

Until equivalent E2E coverage exists:

1. Insert the Notice block and enter its message directly.
2. Switch among `info`, `tip`, and `warning`.
3. Save and reload the editor.
4. Confirm the message and tone remain unchanged.
5. Confirm dynamic PHP rendering on the front end.
6. Check keyboard operation, focus, and meaning without color.
7. Inspect `wp-content/debug.log`.

## WordPress smoke check

From the Dev Container:

```bash
wp plugin activate yamabiko-blocks
wp eval "var_export( WP_Block_Type_Registry::get_instance()->is_registered( 'yamabiko/notice' ) );"
wp plugin deactivate yamabiko-blocks
```

From the host, select the intended environment explicitly:

```bash
docker compose -f .devcontainer/<environment-name>/compose.yaml exec --user www-data wordpress \
  wp plugin activate yamabiko-blocks
```

The registry check must output `true` after the Notice block exists. Inspect
`wp-content/debug.log` for warnings, notices, and fatal errors.

## Vite and E2E status

The current Vite configuration is still the React template baseline. Do not
treat `npm run build` as a WordPress production quality gate until entries,
externalization, generated metadata, output rules, and assertions are
implemented.

Playwright is installed, but `npm run test:e2e` is intentionally absent until a
real test, authentication setup, and environment-aware base URL exist. The
manual Notice procedure remains required until then.

## CI policy

Full CI is manually dispatched rather than running on every branch push.
Before merging to `main`, run the pre-merge workflow against the latest commit
once the workflow contains all applicable implemented gates. Record manual
browser checks separately.
