# Application and WordPress plugin contract

These instructions apply to all files under `app/`. The `app/` directory is the
WordPress plugin root; there is no nested `app/plugin/` directory.

The following documents are authoritative:

- `../docs/development/foundation.md` for architecture, identifiers, security,
  privacy, internationalization, accessibility, compatibility, and dependency
  review;
- `../docs/development/source-organization.md` for Feature First ownership,
  dependency direction, DnD, API boundaries, entries, and test placement;
- `../docs/development/testing.md` for quality gates;
- `../docs/development/release.md` for distribution and inspection rules.

## Quality gates

- Run application commands from `app/`.
- During implementation, run the narrowest relevant checks.
- `npm test` is the complete Node quality gate. It covers formatting, ESLint,
  TypeScript, unit tests, the production build, and Vite fixture verification.
- Inside the Dev Container, use `logcut npm test`. On the host, use
  `npm test` or invoke the container from the repository root.
- After `npm test` succeeds, do not rerun its individual checks separately.
- When it fails, rerun only the failing subcommand while fixing it, then run
  `npm test` once more before handoff.
- PHP or shared application changes require the applicable Composer checks.
- Documentation-only changes do not require application test suites unless
  code or configuration also changed.
- Never report a check as passed unless it actually ran successfully.

Use targeted Node commands only for iteration:

```bash
npm run format:files -- <files...>
npm run lint:files -- <files...>
npm run test:related -- <files...>
npm run test:changed -- <commit>
```

These are not complete quality gates.

## Runtime and identifiers

- Preserve PHP 7.4 parsing and safe-stop behavior in `yamabiko-blocks.php`.
- The bootstrap must reject unsupported hosts before loading Composer or
  runtime code.
- Runtime PHP classes require PHP 8.3.
- Published WordPress and PHP metadata follows the approved release contract;
  do not derive it only from the development environment.
- Runtime classes belong to the `YamabikoLab\Blocks\` namespace.
- Use `yamabiko-blocks` as the plugin slug and text domain.
- Prefix unavoidable global functions with `yamabiko_blocks_` and constants
  with `YAMABIKO_BLOCKS_`.
- Do not conceal duplicate declarations with `function_exists()` or
  `class_exists()`.

## WordPress lifecycle and safety

- Prefer public WordPress APIs, actions, filters, components, and data stores.
- Register work on the narrowest suitable lifecycle hook.
- Loading a PHP file must not perform feature work.
- Do not modify WordPress core, themes, or another plugin's state.
- Apply validation, sanitization, authorization, nonce, REST permission, and
  final escaping at the boundaries defined in `foundation.md`.
- A nonce does not grant a capability, and a capability check does not replace
  CSRF protection when the request context requires it.
- Every REST route requires a meaningful `permission_callback`.
- Use `$wpdb->prepare()` when direct SQL with variables is unavoidable.
- Never use `eval` or unsafe deserialization.
- Activation performs only necessary initialization.
- Deactivation does not delete durable data.
- Durable deletion belongs exclusively to uninstall.

## Public contracts and feature boundaries

- Follow the stable identifier rules in `foundation.md`.
- Keep implementation Feature First under `src/<Feature>/`.
- Keep entries thin and follow the DnD, reordering, and API boundaries in
  `source-organization.md`.
- Do not add blocks, formats, editor plugins, public hooks, REST routes,
  external requests, telemetry, remote assets, or persistent data without an
  approved vertical-slice plan.
- Do not change saved block markup, attributes, post content, or persistent
  state as an incidental implementation detail.
- A new public or persistent surface requires an explicit compatibility,
  privacy, lifecycle, migration, and recovery contract.

## Dependencies

- Separate runtime dependencies from development dependencies.
- Add or update dependencies only under the review requirements in
  `foundation.md`.
- Commit `composer.lock` and `package-lock.json` when their corresponding
  dependency definitions change.
- Update third-party license records when release contents change.
- Do not solve development dependency conflicts by bundling duplicate
  WordPress-provided runtime packages.

## Assets and distribution

- Keep editor-parent, editor-canvas, front-end, and administrative assets
  separate, and load each only where required.
- Keep React, ReactDOM, the JSX runtime, and WordPress-provided JavaScript
  packages external to production bundles.
- Asset-loading failures must disable the affected feature safely rather than
  breaking the editor or site.
- Never commit `node_modules/`, generated `vendor/`, caches, test output, build
  output, or release archives.
- Do not ship development-server references, source maps, uncompiled source,
  tests, or development dependencies.
- Treat release archives as disposable build artifacts.
