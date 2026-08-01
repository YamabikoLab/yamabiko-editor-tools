# Testing and validation

Run application commands from `app/`. Use the narrowest relevant checks while working, then run the applicable non-mutating checks before handoff.

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

Validate the reference Docker Compose configuration:

```bash
docker compose -f .devcontainer/wp702-default/compose.yaml config --quiet
```

Check changed lines for whitespace errors:

```bash
git diff --check origin/main...HEAD
```

The manually triggered `.github/workflows/pr-validation.yml` workflow runs the current Node.js, PHP, and repository checks on GitHub Actions.

## Which checks to run

- Documentation-only changes: `git diff --check origin/main...HEAD`.
- JavaScript, TypeScript, JSON, block metadata, CSS, or SCSS changes: formatting check, JavaScript lint, style lint, typecheck, unit tests, and build.
- PHP or Composer changes: Composer validation, PHP syntax, PHP coding standards, and PHPStan.
- Docker or Dev Container changes: Docker Compose validation plus any focused checks required by the changed files.
- Mixed changes: combine the applicable groups.

Do not claim checks were run when they were skipped or unavailable. Record the reason when an applicable check cannot be executed.
