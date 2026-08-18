# Testing and validation

Run application commands from the repository root. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

## Node.js

Install dependencies:

```bash
npm ci
```

Run the standard Node.js quality gate:

```bash
npm test
```

`npm test` runs these checks in order:

```bash
npm run format:check
npm run lint:js
npm run lint:css
npm run typecheck
npm run test:unit
```

Use the individual commands when iterating on a focused problem. Before handoff for JavaScript, TypeScript, JSON, block metadata, CSS, or SCSS changes, use `npm test` so the same quality gate is shared by local development and PR Validation.

Run Jest with coverage reporting when you want to inspect the current unit test coverage baseline:

```bash
npm run test:unit:coverage
```

The coverage report includes Statements, Branches, Functions, and Lines. Coverage thresholds are intentionally not enforced at this stage.

Create the production build separately:

```bash
npm run build
```

The build remains separate from `npm test` because it verifies production asset generation rather than source quality. PR Validation runs both `npm test` and `npm run build`.

Use `npm run format` or `npm run format:css` only when intentionally formatting files. They modify source files and are not validation commands.

Use `npm start` for the watch-based local development build. It is long-running and is not a completion check.

## Playwright E2E

Playwright E2E tests run against the WordPress environment provided by the separate `YamabikoLab/wp-dev` repository. The initial browser target is Chromium only, and tests use one worker because they share the same WordPress environment.

`wp-dev` provides the canonical WordPress URL and administrator credentials to the Dev Container as these environment variables:

- `WP_BASE_URL`
- `WP_USERNAME`
- `WP_PASSWORD`

Do not add credentials to this repository. The authentication setup stores the signed-in browser state under `.playwright/.auth/`, which is excluded from Git.

`wp-dev` also installs the Playwright-managed Chromium browser and Linux dependencies into the Dev Container. Keep the `@playwright/test` version in this repository aligned with `PLAYWRIGHT_VERSION` in `wp-dev`; do not run a separate browser installation during normal setup.

With the `wp-dev` Dev Container open and Yamabiko Editor Tools active in WordPress, run the E2E suite from the repository root:

```bash
npm run test:e2e
```

Run only the authentication setup when refreshing the saved administrator session:

```bash
npm run test:e2e:auth
```

Start Playwright UI Mode with a fresh authentication state:

```bash
npm run test:e2e:ui
```

UI Mode listens on `0.0.0.0:9323` inside the Dev Container so VS Code can forward the port to the host browser.

Playwright writes authentication state to `.playwright/`, HTML reports to `playwright-report/`, and test artifacts to `test-results/`. Failed tests retain trace, screenshot, and video artifacts for investigation. All of these paths are excluded from Git.

WordPress-specific browser operations should use `@wordpress/e2e-test-utils-playwright` where the package provides an appropriate helper. The minimal smoke test uses its admin fixture to verify that Yamabiko Editor Tools is active.

## PHP

Install locked development dependencies:

```bash
composer install
```

Validate Composer metadata:

```bash
composer validate --strict
```

Check the main plugin file for syntax errors:

```bash
php -l yamabiko-editor-tools.php
```

Check WordPress coding standards:

```bash
composer lint:php
```

Run PHPStan:

```bash
composer analyse:php
```

Use `composer format:php` only when intentionally applying automatic fixes.

## Repository checks

Run these commands from the repository root.

Check changed lines for whitespace errors:

```bash
git diff --check origin/main...HEAD
```

The manually triggered `.github/workflows/pr-validation.yml` workflow runs `npm test`, the production build, and the PHP checks on GitHub Actions. Run the repository check above separately before handoff.

## Which checks to run

- Documentation-only changes: `git diff --check origin/main...HEAD`.
- JavaScript, TypeScript, JSON, block metadata, CSS, or SCSS changes: `npm test`, `npm run build`, and the repository check.
- Playwright configuration or E2E test changes: run the Node.js checks above and `npm run test:e2e` when a compatible `wp-dev` WordPress environment is available.
- PHP or Composer changes: Composer validation, PHP syntax, PHP coding standards, and PHPStan.
- Mixed changes: combine the applicable groups.

For checks that require a local WordPress environment, follow the commands documented in the separate `YamabikoLab/wp-dev` repository.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
