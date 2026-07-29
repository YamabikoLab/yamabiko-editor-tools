# PLAN-NNN: Feature name

## Outcome and boundaries

- User outcome:
- Included:
- Explicitly excluded:
- Supported WordPress/PHP APIs and resulting minimum versions:

## Foundation conformance

- [ ] `docs/development/foundation.md` has been reviewed.
- [ ] New identifiers follow the namespace and prefix table.
- [ ] Stable public hooks, block names/attributes, saved HTML, options, and meta
      are listed below.
- [ ] Lifecycle and side effects run on appropriate WordPress hooks.
- [ ] Input validation, capabilities, nonces, output escaping, and REST
      permissions are specified.
- [ ] External communication, personal data, retention, export, and deletion are
      either absent or fully documented.
- [ ] User-visible strings are translatable with the correct text domain.
- [ ] Keyboard, focus, announcements, semantic HTML, contrast, editor, and
      front-end accessibility checks are defined where applicable.
- [ ] WordPress-provided JavaScript remains external.
- [ ] Every third-party dependency has a need, maintenance, license, security,
      duplication, and redistribution review.
- [ ] Compatibility, migration, deprecation, and uninstall impact are defined.

### UI vertical-slice required acceptance checks

Every UI vertical slice must include these as mandatory acceptance criteria,
not optional manual notes:

- [ ] Editor CSS HMR works inside the Gutenberg Editor iframe.
- [ ] Applying a CSS change through HMR does not unnecessarily lose block
      content, selection, focus, or other editing state.
- [ ] When HMR is unavailable, the fallback reload behavior is verified and
      fails safely.
- [ ] The production build contains no Vite client or development-server URL.

## Interfaces and data

List block metadata, saved markup, REST routes, hooks, options, meta, tables,
script/style handles, CSS classes, and data attributes. State “none” for each
surface that is not introduced.

## Implementation phases

1. Vertical skeleton:
2. Primary behavior:
3. Accessibility and failure behavior:
4. Integration and release:

## Tests and acceptance

- Unit:
- WordPress integration:
- Editor/browser:
- Security and privacy:
- Performance:
- Internationalization:
- Accessibility:
- Distribution and compatibility:

## Rollout and recovery

- Migration/deprecation:
- Failure visibility:
- Rollback:
