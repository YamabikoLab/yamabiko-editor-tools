# PLAN-004: Stage 2 WordPress Vite assets

Approval: [PR #5 stage 2 implementation request](https://github.com/YamabikoLab/yamabiko-blocks/pull/5#issuecomment-5129194583)

## Outcome and boundaries

- User outcome: the Notice editor entry can be served by Vite during local
  development and loaded from verified production metadata without breaking
  WordPress when either source is unavailable.
- Included: the minimal Notice entry, application TypeScript checking, Vite
  input and HMR discovery, WordPress dependency externalization, production
  manifests, editor-parent asset loading, and focused build and safe-failure
  checks.
- Explicitly excluded: `block.json`, Notice registration, attributes, edit or
  render UI, styles, tones, saved markup, front-end JavaScript, REST, storage,
  PHP quality infrastructure, and every stage 3 or stage 4 concern.
- Supported WordPress/PHP APIs and resulting minimum versions:
  `wp_enqueue_script_module()` requires WordPress 6.5, which is below the
  published WordPress 6.8 minimum; runtime PHP remains 8.1 or later.

## Foundation conformance

- [x] `docs/development/foundation.md` has been reviewed.
- [x] New identifiers follow the namespace and prefix table.
- [x] New stable surfaces are listed below.
- [x] Lifecycle and side effects run on appropriate WordPress hooks.
- [x] No request input, privileged mutation, nonce, output HTML, or REST
      permission boundary is introduced.
- [x] Production performs no external communication. Local development probes
      only the loopback Vite client URL recorded by the running dev server;
      no user or site data is sent.
- [x] No user-visible strings or UI are introduced.
- [x] WordPress-provided JavaScript remains external.
- [x] No third-party dependency is added. Existing Vite and Node APIs provide
      the required build and metadata behavior.
- [x] No persisted data, migration, deprecation, or uninstall behavior is
      introduced.

### UI vertical-slice required acceptance checks

This stage is build and loading infrastructure, not a UI vertical slice. It
still establishes the following acceptance boundaries for the stage 3 UI:

- [x] The Vite client and Notice entry are loaded as script modules in the
      editor parent when the local dev descriptor is valid and reachable.
- [x] HMR acceptance is enabled by the entry without adding registrations or
      state that could be duplicated or lost.
- [x] An unavailable dev server falls back to production assets, and missing
      production output stops without enqueueing or a fatal error.
- [x] The production build check rejects Vite client identifiers, HMR code,
      and development-server URLs.

Editor CSS, iframe behavior, content, selection, and focus become applicable
with the first real Notice UI and styles in stage 3.

## Interfaces and data

- Block metadata, attributes, saved markup, REST routes, options, meta, tables,
  CSS classes, and data attributes: none.
- WordPress lifecycle hook used: the existing public
  `enqueue_block_editor_assets` action.
- Script handles:
  - `yamabiko-blocks-vite-client` for the local Vite client module;
  - `yamabiko-blocks-notice-block-editor` for the Notice editor-parent entry.
- Style handles: generated only when an entry owns emitted CSS; none in this
  stage.
- Normalized build key: `notice/entries/notice-block`.
- Generated metadata:
  - `dist/manifest.json`, the Vite file manifest;
  - `dist/asset-manifest.json`, schema version 1 with entry file, CSS files,
    dependency handles, content version, surface, handle, and external rules;
  - `dist/.vite/dev-server.json`, an ignored, local-only descriptor created
    while the Vite dev server is running.
- WordPress external mappings:
  - `react` to global `React` and handle `react`;
  - `react-dom` and `react-dom/client` to global `ReactDOM` and handle
    `react-dom`;
  - `react/jsx-runtime` and `react/jsx-dev-runtime` to global
    `ReactJSXRuntime` and handle `react-jsx-runtime`;
  - `@wordpress/<package>` to global `wp.<camelCasePackage>` and handle
    `wp-<package>`.
- Persistent data and personal data: none.
- Local request: an HTTP GET to the loopback `@vite/client` URL with a short
  timeout, only when the ignored dev descriptor exists.

## Implementation phases

1. Vertical skeleton: add the thin HMR-aware Notice entry, restore application
   type checking, and configure the normalized Vite input.
2. Primary behavior: emit production metadata, externalize WordPress-provided
   packages, and compose a generic `AssetLoader` from `Plugin`.
3. Accessibility and failure behavior: keep assets editor-parent-only, probe
   loopback development safely, validate metadata and paths, and stop cleanly
   when assets are unavailable.
4. Integration and release: add build inspection and missing-output smoke
   checks, update the implemented quality commands, and run the stage 2 gates.

## Tests and acceptance

- Unit: normalized build keys and external mappings are exercised by the build
  inspection over emitted metadata.
- WordPress integration: activate and deactivate the plugin; confirm no fatal
  error or new debug log entry. Stage 2 does not register a block.
- Editor/browser: confirm the dev client and entry load with Vite running, the
  production entry loads after a build, and neither is enqueued on unrelated
  front-end or admin requests.
- Security and privacy: reject non-loopback dev origins, path traversal,
  malformed metadata, and missing files.
- Performance: probe only the editor parent with a sub-second timeout; use
  content-hashed production files and metadata versions.
- Internationalization: no user-visible strings.
- Accessibility: no UI is introduced.
- Distribution and compatibility: production output contains no development
  runtime or duplicated WordPress React/package sources; bootstrap and changed
  PHP files pass syntax checks.

## Rollout and recovery

- Migration/deprecation: none.
- Failure visibility: development and production loading return without an
  exception or enqueue when their validated source is unavailable.
- Rollback: revert the stage 2 source and configuration changes and remove
  ignored `dist/` output; no persistent state requires recovery.
