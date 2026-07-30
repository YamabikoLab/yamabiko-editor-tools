# Plugin source contract

These instructions apply to `app/src/` and inherit `app/AGENTS.md`.

Read `../../docs/development/source-organization.md` before changing feature
topology, responsibility directories, entries, DnD/reordering boundaries,
browser API integration, cross-feature ownership, or build identity. Routine
changes inside an established responsibility do not require rereading it.

## Feature boundaries

- Organize product code Feature First under PascalCase `src/<Feature>/`.
- Co-locate feature PHP, TypeScript, TSX, SCSS, `block.json`, declarations, and
  adjacent TypeScript tests.
- Keep PHP tests outside distributable source under
  `app/tests/php/<Feature>/`.
- Create only responsibilities the feature currently owns.
- Do not create language-oriented directories, placeholders, feature-root
  `components/` or `hooks/`, or speculative `utils/`, `helpers/`, `common/`,
  or `shared/`.
- Put `components/` and `hooks/` only below their owning responsibility and
  only when multiple related files justify them.
- Extract cross-feature code only after multiple real features need the same
  stable contract and its owner is clear.

Use these names when applicable:

- `entries/`: registration, styles, composition, and HMR cleanup;
- `editor/`: Block Editor UI, selectors, focus, and editor-only styles;
- `canvas/`: public integration affecting the post-content canvas;
- `dnd/`: drag lifecycle, temporary projection, overlays, and drop
  interpretation;
- `reordering/`: input-independent validation, canonical mutation, and result
  verification;
- `api/`: feature endpoints, payloads, response validation, and feature errors;
- `types/`: narrow feature-specific declarations missing upstream.

Small pure modules may remain at the feature root until several related modules
form a clearer responsibility.

`Api/` is the only application-level source exception. Introduce it only for a
real browser API operation requiring a replaceable transport contract.

## Entries, dependencies, and tests

- Keep entries thin. They may import styles, compose dependencies, register
  integrations, create concrete adapters, and dispose registrations during
  HMR.
- Entries must not own reusable UI, selectors, domain algorithms, API
  operations, drag sessions, or substantial state.
- Name entries `<feature>-<surface>.entry.ts` or
  `<feature>-<surface>.entry.tsx`.
- Keep normalized build keys, manifest keys, emitted paths, metadata paths, and
  public handles unique.
- Keep TypeScript tests beside their source.
- Use explicit imports, avoid circular dependencies, and add a barrel only for
  a deliberate stable boundary.

## DnD and canonical state

- DnD is an input method, not the owner of canonical state.
- Button, keyboard, pointer, and touch operations share the same
  `reordering/` contract.
- `dnd/` may depend on `reordering/`; the reverse dependency is prohibited.
- Keep pure ordering independent from WordPress, React, the DOM, browser APIs,
  and DnD libraries.
- Inject a registry or narrow selector/action adapter at the WordPress Data
  mutation boundary.
- Never infer canonical state from DOM order, drag snapshots, or long-lived
  local state.

## Browser API boundary

- Product features must not import `@wordpress/api-fetch` or call
  `window.fetch` or global `fetch` directly.
- Inject an `ApiClient` into feature API operations.
- Application `Api/` owns transport and the WordPress adapter.
- Feature `api/` owns endpoint contracts and feature response handling.
- `Api/` must not depend on product features, React, WordPress Data, or UI.
- Feature API tests inject fakes, stubs, or spies instead of mocking transport.

## WordPress Data, React, and lifecycle

- Treat the owning public WordPress store as canonical and never mutate
  selector results.
- Use `useSelect` for subscribed render state, `useDispatch` for component
  actions, and `useRegistry()` for event-time reads against the active registry.
- Use global `select()` or `dispatch()` only when deliberately targeting the
  default registry outside registry-aware React code.
- Use the WordPress React runtime and existing Block Editor tree. Do not create
  a separate React root.
- Keep rendering pure, call Hooks only at the top level, and use Effects only
  for external synchronization.
- Clean up registrations, filters, subscriptions, timers, and listeners.
  Code must tolerate repeated mount, registration, and HMR cycles.
- Use local state only for local or temporary interaction state. Do not add
  memoization mechanically.
