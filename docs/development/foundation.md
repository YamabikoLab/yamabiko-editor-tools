# Development foundation

This document defines the cross-cutting rules for Yamabiko Editor Tools. Working instructions live in `AGENTS.md` files; validation commands live in `testing.md`; source placement lives in `source-organization.md`.

## Product boundary

Yamabiko Editor Tools is a WordPress plugin for site creators. It complements Gutenberg with blocks and editor extensions that improve content creation. The first product area is document structure and outline improvement.

The repository root is the WordPress plugin root. Published minimum versions must stay aligned with the metadata in `yamabiko-editor-tools.php`.

Local WordPress, PHP, Docker, and Dev Container configuration is maintained in the separate `YamabikoLab/wp-dev` repository. This repository contains only the plugin, its product documentation, tests, and release automation.

Do not document or implement future systems such as drag-and-drop, REST endpoints, custom HMR, persistence, telemetry, or distribution flows until an issue requires them.

## Stable identifiers

Use these identifiers consistently:

| Surface | Form |
| --- | --- |
| Plugin slug and text domain | `yamabiko-editor-tools` |
| PHP namespace | `YamabikoLab\EditorTools\` |
| Global PHP function prefix | `yamabiko_editor_tools_` |
| PHP constant prefix | `YAMABIKO_EDITOR_TOOLS_` |
| Action and filter prefix | `yamabiko-editor-tools/` |
| REST namespace | `yamabiko-editor-tools/v1` |
| Script and style handle prefix | `yamabiko-editor-tools-` |
| Block namespace | `yamabiko-editor-tools/` |
| CSS class prefix | `yamabiko-editor-tools-` |

Project-owned CSS class names follow the Gutenberg naming convention. Use the `yamabiko-editor-tools-` prefix, lowercase kebab-case within each segment, `__` for child elements, and `--` for modifiers. Use separate `is-` or `has-` classes for state. Do not rename classes owned by WordPress or third-party dependencies. When an external class does not satisfy the configured Stylelint naming rule, disable only the affected selector with a short explanation.

Released block names, attributes, saved markup, persisted keys, and public hooks are compatibility contracts. Change them only with an explicit migration or compatibility decision.

## WordPress lifecycle

- Prefer public WordPress APIs, actions, filters, components, and data stores.
- Register work on the narrowest suitable hook.
- Load editor, front-end, and admin assets only where needed.
- Keep activation minimal.
- Do not delete durable data during deactivation. Durable deletion belongs to uninstall.

## Security and privacy

- Treat request, stored, decoded, and external values as untrusted.
- Validate expected values, sanitize for storage, authorize privileged operations, and escape at the final output boundary.
- Use nonces where WordPress requires CSRF protection. Nonces do not replace capability checks.
- Give every REST route a meaningful `permission_callback`.
- Prefer WordPress data APIs. Use `$wpdb->prepare()` when variable SQL is unavoidable.
- Do not use `eval` or unsafe deserialization.
- Do not expose secrets, credentials, personal data, stack traces, or local paths.
- Do not add telemetry, remote code, remote fonts, or external services without an explicit requirement and review.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-editor-tools` text domain.
- Put dynamic values in placeholders and escape output for its final context.
- Prefer semantic HTML and WordPress UI primitives.
- Support keyboard operation and visible focus.
- Do not rely on color alone to communicate meaning.

## Dependencies and assets

- Add a dependency only for a current need after checking maintenance, license, security, and overlap with WordPress.
- Keep runtime and development dependencies separate.
- Commit `package-lock.json` and `composer.lock` when their dependency files change.
- Keep WordPress-provided JavaScript runtimes external to production bundles.
- Do not commit generated dependencies, caches, or build output.

## Source and validation

- Follow `source-organization.md` for feature ownership, entries, tests, and shared code.
- Follow `testing.md` for the commands that currently exist.
- Update these documents when the actual structure or command surface changes.
