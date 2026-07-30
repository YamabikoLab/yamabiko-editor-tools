# Testing and quality commands

The `app/` directory is the WordPress plugin root. Run application quality
commands from there.

Related contracts:

- `foundation.md`: runtime, security, compatibility, and dependency rules;
- `source-organization.md`: ownership and test placement;
- `release.md`: distribution and archive inspection.

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

## Complete gates

PHP or shared plugin changes:

```bash
composer check
```

TypeScript, TSX, SCSS, Vite, or build changes:

```bash
npm test
```

Distribution-related changes:

```bash
npm run dist
npm run inspect:dist
```

Inside the Dev Container, prefix complete gates with `quiet-run` when
available. Do not rerun their individual checks after the complete gate passes.

`composer check` should cover PHP syntax, WordPress Coding Standards, PHPUnit,
and any configured static analysis or contract checks.

`npm test` should cover Prettier, ESLint, TypeScript, Vitest, the production
Vite build, and manifest or artifact assertions.

Expected test placement:

```text
src/<Feature>/**/*.test.{ts,tsx}
tests/php/<Feature>/
tests/e2e/
```

The build must verify that React, ReactDOM, the JSX runtime, and
WordPress-provided packages remain external.

## Targeted iteration

Use these only while implementing:

```bash
npm run format:files -- <files...>
npm run lint:files -- <files...>
npm run test:related -- <files...>
npm run test:changed -- <commit>
```

They are not complete quality gates, and file-oriented commands require an
explicit argument.

## Bootstrap compatibility

The main plugin file is `yamabiko-blocks.php`.

It must:

- parse on PHP 7.4;
- reject unsupported hosts before loading Composer or PHP 8.3 runtime classes;
- return safely when `ABSPATH` is undefined;
- avoid a fatal error when the production autoloader is missing.

Runtime classes and the normal PHPUnit suite use PHP 8.3.

```bash
php -l yamabiko-blocks.php
```

CI should separately exercise isolated PHP 7.4 bootstrap scenarios without
loading the normal Composer runtime.

## Notice reference feature

Issue #4 establishes `yamabiko/notice` as the first reference feature.

### TypeScript

Test that:

- `info`, `tip`, and `warning` are accepted;
- unsupported values fall back to `info`;
- values and display labels remain aligned;
- tone logic runs without WordPress, React, DOM, or network access.

### PHP and WordPress

Test that:

- the block registers on the intended hook;
- `block.json` attributes match PHP behavior;
- valid attributes produce the expected HTML;
- invalid tones fall back safely;
- unsafe HTML is removed or neutralized;
- allowed inline markup is retained;
- wrapper attributes and tone classes are present;
- user-facing strings are translatable;
- missing build output does not cause a fatal error.

PHP tests belong under `tests/php/Notice/`.

### Manual acceptance

Until equivalent E2E coverage exists:

1. Insert the Notice block and enter its message directly.
2. Switch among `info`, `tip`, and `warning`.
3. Save and reload the editor.
4. Confirm the message and tone remain unchanged.
5. Confirm dynamic PHP rendering on the front end.
6. Check keyboard operation, focus, and meaning without color.
7. Inspect `wp-content/debug.log`.

## Vite and HMR

Automated tests cover entries, manifests, dependency metadata,
externalization, and production artifacts.

A real Gutenberg browser must still verify:

1. Run `npm run dev` from `app/`.
2. Change editor SCSS in an iframe environment and confirm HMR.
3. Repeat in a configured non-iframe environment.
4. Change TypeScript and confirm HMR or a clean reload.
5. Change PHP or `block.json` and confirm a clean reload.
6. Confirm content, selection, and focus are not unnecessarily lost.
7. Stop Vite and confirm safe production fallback.
8. Remove production output and confirm the feature stops safely.

Production output must contain no Vite client, development-server URL, or
bundled WordPress runtime package.

## Playwright E2E

Playwright is separate from Vitest and is not part of `npm test` unless the
repository explicitly changes that contract.

When the E2E foundation is enabled:

```bash
npm run test:e2e
```

Use uncommitted credentials for an isolated administrator:

```dotenv
E2E_WP_ADMIN_USER=<administrator-login>
E2E_WP_ADMIN_PASSWORD=<administrator-password>
```

E2E rules:

- run serially when sharing a WordPress database;
- derive the origin from the configured WordPress host and port;
- do not hard-code host-only, container-only, or default-port URLs;
- keep auth state, reports, traces, screenshots, videos, and results outside Git;
- keep package, CLI, browser, and container versions aligned;
- do not download browsers during an ordinary test run.

If Playwright setup is split from Issue #4, the manual Notice procedure remains
required.

## WordPress smoke test

From the repository root after starting WordPress:

```bash
docker compose exec --user www-data wordpress   wp plugin activate yamabiko-blocks

docker compose exec --user www-data wordpress   wp eval "var_export( WP_Block_Type_Registry::get_instance()->is_registered( 'yamabiko/notice' ) );"

docker compose exec --user www-data wordpress   wp plugin deactivate yamabiko-blocks
```

The registry check must output `true`. Inspect `wp-content/debug.log` for
warnings, notices, and fatal errors.

## Distribution inspection

`npm run inspect:dist` must reject development files and allow only approved
runtime files.

Exclude at minimum:

- TypeScript, TSX, SCSS, tests, and development documentation;
- Vite development runtime and development-server references;
- unapproved source maps, caches, and development dependencies.

Allow compiled assets, required PHP files, `block.json`, runtime metadata,
translations, and approved production dependencies.

## CI policy

Full CI is manually dispatched rather than running on every branch push.

Before merging to `main`:

- run the pre-merge workflow against the latest commit;
- require all applicable gates to pass;
- rerun it after the commit changes;
- record manual browser checks separately.

A green workflow does not prove iframe HMR, non-iframe behavior, keyboard
interaction, or visual accessibility.
