# Testing and validation

Run application commands from the repository root. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

## Node.js

Install dependencies:

```bash
npm ci
```

Validate formatting without changing files:

```bash
npm run format:check
```

Lint JavaScript and TypeScript:

```bash
npm run lint:js
```

Lint CSS and SCSS:

```bash
npm run lint:css
```

Check TypeScript types:

```bash
npm run typecheck
```

Run focused JavaScript and TypeScript unit tests:

```bash
npm run test:unit
```

Run the Playwright end-to-end tests against the local WordPress environment:

```bash
npx playwright install chromium
WP_BASE_URL=http://127.0.0.1:8080 WP_USERNAME=admin WP_PASSWORD=admin npm run test:e2e
```

`WP_BASE_URL` must match the active `YamabikoLab/wp-dev` environment. The
username and password are local WordPress administrator credentials; do not
place non-local credentials in repository files. Playwright outputs traces and
reports to ignored directories when a test fails.

Create the production build:

```bash
npm run build
```

Use `npm run format` or `npm run format:css` only when intentionally formatting files. They modify source files and are not validation commands.

Use `npm start` for the watch-based local development build. It is long-running and is not a completion check.

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

The manually triggered `.github/workflows/pr-validation.yml` workflow runs the current Node.js and PHP checks on GitHub Actions. Run the repository check above separately before handoff.

## Which checks to run

- Documentation-only changes: `git diff --check origin/main...HEAD`.
- JavaScript, TypeScript, JSON, block metadata, CSS, or SCSS changes: formatting check, JavaScript lint, style lint, typecheck, unit tests, and build.
- Playwright E2E changes: install Chromium if needed, then run `npm run test:e2e` against the active local WordPress environment in addition to the applicable Node.js checks.
- PHP or Composer changes: Composer validation, PHP syntax, PHP coding standards, and PHPStan.
- Mixed changes: combine the applicable groups.

For checks that require a local WordPress environment, follow the commands documented in the separate `YamabikoLab/wp-dev` repository.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
