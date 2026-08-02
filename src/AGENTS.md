# Yamabiko Editor Tools plugin instructions

These instructions apply to plugin source files under `src/`.

## Plugin root

- The repository root is the plugin root.
- Run npm, Composer, PHP, and build commands from the repository root.
- Source files live under `src/`; generated production assets live under `build/` and are not committed.

## Implementation rules

- Prefer public WordPress APIs, hooks, components, and data stores.
- Keep each block under `src/blocks/<block-name>/` and each non-block editor extension under its owning feature directory, following `../docs/development/source-organization.md`.
- Do not create `shared/`, `utils/`, or `helpers/` until multiple real features need the same code.
- Keep entry files small. They should register or compose a feature, not contain unrelated implementation details.
- Treat saved block markup, attributes, identifiers, hooks, and persisted data as compatibility contracts.

## Security and data handling

- Treat request, stored, decoded, and external values as untrusted.
- Validate expected values, sanitize for storage, authorize privileged actions, and escape at the final output boundary.
- Use nonces where WordPress requires CSRF protection. A nonce does not replace a capability check.
- Give every REST route a meaningful `permission_callback`.
- Prefer WordPress data APIs and use `$wpdb->prepare()` for variable SQL when direct queries are unavoidable.
- Do not use `eval`, unsafe deserialization, telemetry, remote code, or external services without an explicit requirement and review.

## Internationalization and accessibility

- Translate user-visible strings with the `yamabiko-editor-tools` text domain.
- Use semantic HTML and WordPress UI primitives where practical.
- Support keyboard operation and visible focus for interactive controls.
- Do not communicate meaning through color alone.

## Dependencies and generated files

- Add dependencies only when they solve a current need and do not duplicate WordPress-provided runtimes.
- Keep runtime and development dependencies separate.
- Update and commit the relevant lockfile when dependency definitions change.
- Do not edit generated files in `build/`, `vendor/`, or `node_modules/`.

## Validation

Use the applicable commands documented in `../docs/development/testing.md`. Do not substitute formatting commands for non-mutating checks when validating a change.
