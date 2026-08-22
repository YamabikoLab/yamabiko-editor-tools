# PLAN-428: Yamabiko Table Reorder plugin identity migration

## References

- Parent issue: #428
- Product identity source of truth: `docs/development/foundation.md`
- Validation commands: `docs/development/testing.md`
- Release guidance: `docs/development/releasing.md`

## Goal

Migrate the repository from the former `Yamabiko Editor Tools` / `yamabiko-editor-tools` identity to the standalone `Yamabiko Table Reorder` / `yamabiko-table-reorder` identity defined in `docs/development/foundation.md`, while preserving Table Reorder behavior and avoiding unrelated product changes.

## Scope

### Included

- Rename the main plugin file to `yamabiko-table-reorder.php` and align its plugin header and PHP identity.
- Align the plugin slug, text domain, PHP namespace and project-owned prefixes with the Stable identifiers in `foundation.md`.
- Align script/style handles and the JavaScript runtime global with the new product identity.
- Align npm and Composer package metadata and any related tooling configuration.
- Regenerate and rename translation artifacts for the new text domain.
- Update repository documentation, demo, E2E/CI configuration, release configuration, and package contents that still depend on the old identity.
- Search the repository for remaining `Yamabiko Editor Tools`, `yamabiko-editor-tools`, and corresponding code-form identifiers, then classify intentional historical references separately from active identity references.
- Verify the generated plugin ZIP and the installed plugin use the new identity consistently.

### Not included

- Table Reorder feature, UI, interaction, accessibility, or supported-block behavior changes.
- Column reordering or other new functionality.
- New distribution flows, services, telemetry, REST APIs, or unrelated repository restructuring.
- Broad cleanup that is not required by the identity migration.
- Rewriting historical plans solely to replace old names when the old identity is part of the historical record.

## Approach

Treat `docs/development/foundation.md` as the source of truth for stable identifiers instead of duplicating identifier definitions in implementation files or this plan.

Perform the migration in dependency order so each layer consumes the new identity from the layer beneath it:

1. Inventory active and historical uses of the old identity.
2. Change the plugin entry point and PHP-facing identity.
3. Change JavaScript/runtime handles and project metadata/tooling.
4. Regenerate translations and update packaging/release consumers.
5. Update active documentation and test/demo/CI references.
6. Run a final residual search and the applicable validation gates.

Do not mechanically replace every old string. Historical plans, archived documentation, or migration context may intentionally mention the former identity. Active runtime, packaging, validation, release, and current documentation references must use the new identity unless a compatibility decision explicitly requires otherwise.

## Architecture

- `yamabiko-editor-tools.php` -> `yamabiko-table-reorder.php`
  - Becomes the canonical WordPress plugin entry point.
  - Owns the plugin header, text domain, PHP namespace, script/style handles, and runtime configuration exposed to JavaScript.
- `src/editor-extensions/table-reorder/`
  - Keeps Table Reorder behavior unchanged.
  - Updates only project-owned identity references such as text-domain calls or runtime-global access where required.
- `package.json` / `package-lock.json`
  - Update npm package identity, packaged file list, and i18n commands/output names.
- `composer.json` / `composer.lock`
  - Update Composer package identity or lock metadata when the manifest change requires it.
- `languages/`
  - Replace old-domain POT/PO/JSON artifacts with artifacts generated from `yamabiko-table-reorder`.
- `.github/`, `tests/e2e/`, `demo/`, release/package configuration
  - Update paths, activation targets, artifact/package names, and assumptions that refer to the old plugin entry point or slug.
- Current documentation
  - Update active product/repository references to Yamabiko Table Reorder while retaining intentional historical references where they explain past work.

## Implementation phases

### Phase 1: Inventory and compatibility classification

- Outcome: Every active old-identity reference is classified before edits begin.
- Tasks:
  - Search for `yamabiko-editor-tools`, `Yamabiko Editor Tools`, `yamabikoEditorTools`, `EditorTools`, and old PHP package/namespace forms.
  - Group matches into runtime/PHP, JavaScript, package/tooling, i18n, CI/E2E/demo, current documentation, and historical documentation.
  - Identify any released/public identifiers whose rename could require a compatibility decision under `foundation.md`.
  - Record which old references are intentionally retained as historical context.
- Validation:
  - The implementation scope accounts for all active match categories before mutation starts.

### Phase 2: Canonical plugin and runtime identity

- Outcome: WordPress and runtime-facing code use the new identity consistently.
- Tasks:
  - Rename `yamabiko-editor-tools.php` to `yamabiko-table-reorder.php`.
  - Update Plugin Name, Description as needed for the standalone product, Text Domain, `@package`, and PHP namespace.
  - Align project-owned PHP prefixes with `foundation.md` where they exist.
  - Update `wp_set_script_translations()` to `yamabiko-table-reorder`.
  - Rename script/style/runtime handles to the `yamabiko-table-reorder-` prefix.
  - Rename the JavaScript runtime global and its TypeScript declaration/consumers/tests together so no mixed identity remains.
- Validation:
  - PHP syntax and static/coding-standard checks applicable to the changed PHP files.
  - Focused source tests for any runtime-global/type changes.

### Phase 3: Package, tooling, and i18n identity

- Outcome: Development metadata and generated translation artifacts match the new product identity.
- Tasks:
  - Update `package.json` package name, packaged main PHP filename, and i18n script paths/domain.
  - Update `package-lock.json` metadata as required by the package manifest change.
  - Update `composer.json` package name/description and `composer.lock` metadata if Composer changes require it.
  - Update PHPCS, PHPStan, or other configuration that encodes the former identity.
  - Regenerate POT, PO, and JSON translation files from the new text domain.
  - Remove superseded old-domain translation artifacts after the new generated set is verified.
- Validation:
  - `npm run i18n` completes and produces only the intended new-domain artifacts.
  - Composer metadata validates after manifest changes.

### Phase 4: Consumers, packaging, and documentation

- Outcome: CI, E2E, demo, release/package flows, and current documentation all consume the new identity.
- Tasks:
  - Update GitHub Actions and CI setup that reference the plugin directory, entry file, slug, package, or artifact name.
  - Update Playwright/E2E activation or fixture references that depend on the old identity.
  - Update demo/Playground configuration and helper scripts.
  - Update plugin ZIP contents and release guidance/configuration.
  - Update `README.md`, `readme.txt`, `SECURITY.md`, `AGENTS.md`, `src/AGENTS.md`, and active development/source/testing/releasing documentation where the old identity is current rather than historical.
  - Update validation commands that name the old main PHP file.
- Validation:
  - Current documentation names the new product and points to the new entry file/slug.
  - Packaging configuration includes `yamabiko-table-reorder.php` and excludes the obsolete entry filename.

### Phase 5: Residual search and full verification

- Outcome: The repository has one coherent active product identity and Table Reorder behavior is unchanged.
- Tasks:
  - Repeat repository-wide searches for old human-readable, slug, camelCase, namespace, and package forms.
  - Review every remaining match and retain only intentional historical/migration references.
  - Run the applicable Node, PHP, build, E2E, i18n, and packaging validations from `testing.md` and #428.
  - Inspect the generated plugin ZIP contents and plugin header.
  - Activate the generated/renamed plugin in WordPress and verify existing Table Reorder behavior has no regression.
- Validation:
  - No unintended active old-identity references remain.
  - The plugin ZIP, WordPress plugin metadata, translations, and runtime identifiers consistently use Yamabiko Table Reorder.

## Decisions and validation questions

### Decide before implementation

- Compatibility treatment for identifiers that may already be externally observable or released. `foundation.md` treats released identifiers as compatibility contracts, while #428 explicitly requests an identity replacement. Before implementation, distinguish identifiers that can be renamed directly from any identifier that needs a temporary compatibility alias or an explicit break decision.
- Whether the JavaScript runtime global is considered internal-only and can be renamed without an alias. The implementation should not retain a legacy alias unless there is a concrete consumer that requires it.
- Whether historical plans and archived documents should retain the old product name. Default: retain historical wording when it describes the state at that time; update only links or statements that would otherwise be actively incorrect.

### Validate during implementation

- Whether `wp-scripts plugin-zip` derives the ZIP filename exactly as expected from the updated npm/plugin metadata.
- Whether regenerated Jed JSON filenames match the script handle expected by `wp_set_script_translations()` after the handle/domain rename.
- Whether changing the main plugin filename affects local/CI plugin activation state or requires activation by the new path during validation.
- Whether package-lock or composer-lock contains identity metadata that changes automatically after their manifests are updated.

## Issue breakdown

- [x] Keep #428 as a single coordinated implementation issue unless the implementation reveals an independently reviewable compatibility migration that deserves its own issue.

The identity change is cross-cutting but tightly coupled. Splitting PHP, JavaScript, i18n, and packaging into separate issues would create intermediate states with mixed identities, so the preferred implementation is one coordinated branch/PR after this plan is reviewed.

## Validation

Use `docs/development/testing.md` as the command source of truth. For the completed implementation, the expected validation set is:

- `git diff --check origin/main...HEAD`
- `npm run i18n`
- `npm test`
- `npm run build`
- `npm run test:e2e` in a compatible `wp-dev` environment
- `npm run plugin-zip`
- `composer validate --strict`
- `php -l yamabiko-table-reorder.php`
- `composer lint:php`
- `composer analyse:php`
- Relevant dependency security audits if `package-lock.json` or `composer.lock` changes
- Inspect generated ZIP contents and plugin header
- Activate the plugin in WordPress and verify existing Core Table and Flexible Table Block Table Reorder behavior
- Final repository-wide old-identity search with each remaining match classified as intentional history or a defect

The plan-only PR itself is documentation-only and therefore requires only the documentation check defined in `testing.md`.

## Completion criteria

- `yamabiko-table-reorder.php` is the canonical plugin entry point.
- Plugin Name, slug/text domain, PHP namespace/prefixes, script/style handles, runtime global, package metadata, translations, and package contents use the new identity consistently.
- Active CI/E2E/demo/release/configuration and current documentation no longer depend on the old plugin identity.
- Any retained old-identity references are intentional historical or compatibility references and are understood.
- i18n generation, Node/PHP quality gates, production build, E2E, and plugin ZIP generation succeed.
- The generated ZIP installs/activates as Yamabiko Table Reorder and existing Table Reorder behavior has no regression.
- No unrelated feature or UI changes are included.

## Notes

The main risk is not the string replacement itself but partial migration. The implementation should keep coupled identifiers together, especially the main plugin filename, package contents, translation domain/JSON filenames, script handles, runtime global, and CI/E2E activation paths.

A second risk is over-cleaning historical documents. Residual searches are a review tool, not an instruction to erase valid history.
