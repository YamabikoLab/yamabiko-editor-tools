# Development foundation

This document defines the cross-cutting rules for Yamabiko Blocks. Working instructions live in `AGENTS.md` files; validation commands live in `testing.md`; source placement lives in `source-organization.md`.

## Product boundary

Yamabiko Blocks improves content structure editing in the WordPress block editor.

`app/` is the WordPress plugin root. The current development environment uses WordPress 7.0.2 and PHP 8.3. Published minimum versions must stay aligned with the metadata in `app/yamabiko-blocks.php`.

Do not document or implement future systems such as drag-and-drop, REST endpoints, custom HMR, persistence, telemetry, or distribution flows until an issue requires them.

## Stable identifiers

Use these identifiers consistently:

| Surface | Form |
| --- | --- |
| Plugin slug and text domain | `yamabiko-blocks` |
| PHP namespace | `YamabikoLab\Blocks\` |
| Global PHP function prefix | `yamabiko_blocks_` |
| PHP constant prefix | `YAMABIKO_BLOCKS_` |
| Action and filter prefix | `yamabiko-blocks/` |
| REST namespace | `yamabiko-blocks/v1` |
| Script and style handle prefix | `yamabiko-blocks-` |
| Block namespace | `yamabiko-blocks/` |
| CSS class prefix | `yamabiko-blocks-` |

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

- Translate user-visible strings with the `yamabiko-blocks` text domain.
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

- Follow `source-organization.md` for Feature First ownership, entries, tests, and shared code.
- Follow `testing.md` for the commands that currently exist.
- Update these documents when the actual structure or command surface changes.
