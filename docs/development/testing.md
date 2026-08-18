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
npm run test:unit:coverage
```

Use the individual commands when iterating on a focused problem. Before handoff for JavaScript, TypeScript, JSON, block metadata, CSS, or SCSS changes, use `npm test` so the same quality gate is shared by local development and PR Validation.

Run Jest without coverage when you want a faster focused unit test run:

```bash
npm run test:unit
```

Run Jest with coverage reporting directly when you want to inspect the unit test coverage result:

```bash
npm run test:unit:coverage
```

The coverage report includes Statements, Branches, Functions, and Lines. The global threshold is 80% for each metric, and Jest fails when any metric falls below the threshold. `npm test` includes this coverage run, so PR Validation enforces the same threshold without running Jest twice.

### Jest responsibility map

The current Jest suite is concentrated in Table Reorder. Organize the existing test coverage by responsibility rather than by file count.

#### Table and row logic

These tests cover the core rules that can be verified without a real browser or WordPress editor session.

- `src/editor-extensions/table-reorder/block-support.test.ts`
  - supported block detection
- `src/editor-extensions/table-reorder/table-context.test.ts`
  - table and row context resolution
- `src/editor-extensions/table-reorder/rowspan.test.ts`
  - vertical merge (`rowspan`) constraints and boundary handling
- `src/editor-extensions/table-reorder/controller/row-order.test.ts`
  - row order calculation and movement rules
- `src/editor-extensions/table-reorder/messages.test.ts`
  - user-facing message selection and formatting

#### Reorder UI

These tests cover DOM-level UI state and guidance that can be exercised in jsdom.

- `src/editor-extensions/table-reorder/controller/drag-ui.test.ts`
  - drag UI state and visual helper behavior
- `src/editor-extensions/table-reorder/controller/reorder-ui/live-status.test.ts`
  - live-region status updates
- `src/editor-extensions/table-reorder/controller/reorder-ui/reorder-guidance.test.ts`
  - reorder guidance display and positioning behavior
- `src/editor-extensions/table-reorder/controller/reorder-ui/row-controls.test.ts`
  - row handle and control behavior
- `src/editor-extensions/table-reorder/controller/reorder-ui/row-move-targets.test.ts`
  - destination target generation and selection behavior

#### Interaction and controller

These tests cover the controller state machine and input-specific branches while mocking browser or SortableJS integration where appropriate.

- `src/editor-extensions/table-reorder/controller/sortable-controller.test.ts`
  - shared controller lifecycle and state transitions
- `src/editor-extensions/table-reorder/controller/sortable-controller-keyboard.test.ts`
  - keyboard reorder behavior and edge cases
- `src/editor-extensions/table-reorder/controller/sortable-controller-pointer.test.ts`
  - pointer interaction behavior
- `src/editor-extensions/table-reorder/controller/sortable-controller-touch.test.ts`
  - touch-specific controller behavior
- `src/editor-extensions/table-reorder/controller/sortable-runtime-loader.test.ts`
  - SortableJS runtime loading and failure handling

#### WordPress and React integration boundary

These tests verify the local integration contract around hooks, wrappers, and supported WordPress block behavior without treating Jest as a replacement for browser-level integration tests.

- `src/editor-extensions/table-reorder/use-table-reorder.test.ts`
  - controller hook wiring
- `src/editor-extensions/table-reorder/use-table-reorder-interaction.test.ts`
  - interaction hook behavior
- `src/editor-extensions/table-reorder/with-table-reorder.test.tsx`
  - component wrapper integration
- `src/editor-extensions/table-reorder/flexible-table-block.test.tsx`
  - Flexible Table Block integration contract

### Jest and Playwright E2E responsibilities

Use Jest for logic and branches that can be isolated reliably and quickly:

- pure logic and boundary conditions
- small conditional branches
- UI state that can be verified in jsdom
- Keyboard / Pointer / Touch controller logic
- WordPress API and SortableJS integration code where mocks provide a stable contract

Use Playwright E2E for behavior that depends on the real WordPress editor and browser environment:

- actual WordPress / Gutenberg behavior
- real mouse, touch, and keyboard interaction in the browser
- iframe and non-iframe editor environments
- integration with the real SortableJS runtime
- end-to-end flows from user input through completed row movement

This is a responsibility boundary, not a statement that every Playwright area is already covered. Keep Jest focused on fast, deterministic logic checks and add browser-level scenarios to Playwright as those suites are expanded.

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
