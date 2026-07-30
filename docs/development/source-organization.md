# Source organization

This document defines the source-layout conventions for Yamabiko Blocks.

Read it together with `docs/development/foundation.md` when changing feature
topology, responsibility boundaries, Vite entries, React directories, browser
API integration, drag-and-drop behavior, test placement, or distribution rules.

## Goals

The source tree should make it possible to answer these questions without
opening every file:

1. Which product feature owns this file?
2. Which responsibility inside that feature owns it?
3. Which direction may dependencies flow?
4. Is this file an entry, integration, UI, pure logic, transport adapter, or
   test?
5. Will this file be distributed in the plugin release?

The repository uses a Feature First layout. PHP, TypeScript, TSX, SCSS,
`block.json`, and adjacent TypeScript tests that implement one product
capability remain inside the same feature boundary.

Do not split feature code into language-oriented trees such as `includes/`,
`php/`, `js/`, `src/features/`, or `assets/src/`.

## Baseline repository layout

Issue #4 establishes the Notice block as the first reference feature:

```text
app/
├── src/
│   ├── Plugin.php
│   ├── AssetLoader.php
│   └── Notice/
│       ├── Block.php
│       ├── block.json
│       ├── render.php
│       ├── entries/
│       │   └── notice-block.entry.ts
│       ├── editor/
│       │   ├── Edit.tsx
│       │   └── editor.scss
│       ├── style.scss
│       ├── tone.ts
│       └── tone.test.ts
├── tests/
│   ├── php/
│   │   └── Notice/
│   │       ├── BlockTest.php
│   │       └── RenderTest.php
│   └── e2e/
│       └── notice.spec.ts
├── dist/
├── composer.json
├── composer.lock
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── yamabiko-blocks.php
```

This is a concrete starting point, not a template that every feature must copy
in full. Create only the files and directories required by the current
implementation.

Application-level browser API infrastructure may later appear as
`app/src/Api/`, but it must not be created until a real browser API operation
needs a replaceable transport boundary.

## Application root responsibilities

The application root contains only plugin-wide composition and infrastructure
with a clear application-level owner.

| Path | Owner and purpose |
| --- | --- |
| `yamabiko-blocks.php` | WordPress plugin bootstrap and minimum environment guard |
| `src/Plugin.php` | Application composition, feature registration, and plugin lifecycle |
| `src/AssetLoader.php` | Vite development and production asset resolution |
| `src/Api/` | Optional browser transport boundary introduced with the first real API integration |
| `tests/` | Non-distributable PHP integration tests and end-to-end tests |
| `dist/` | Compiled production assets and generated metadata |

`Plugin.php` must compose features. It must not accumulate feature-specific
validation, rendering, UI state, endpoint paths, or ordering logic.

`AssetLoader.php` may understand the Vite manifest, development server,
WordPress dependency metadata, script and style registration, and safe fallback
behavior. It must not contain Notice-specific behavior.

## Feature boundary

Each product feature uses a PascalCase directory under `app/src/`:

```text
app/src/
├── Notice/
├── Accordion/
├── SortableList/
└── TableReorder/
```

A feature owns every implementation detail that exists only for that product
capability.

A feature root may contain:

- a small number of PHP integration classes;
- `block.json` and a dynamic `render.php`;
- small pure TypeScript modules;
- styles shared by the editor and front end;
- only the responsibility directories that the feature currently needs.

Do not create feature-root `components/`, `hooks/`, `utils/`, `helpers/`,
`common/`, or `shared/` directories.

Extract cross-feature code only after multiple real features require the same
stable contract and its owner and dependency direction are understood. Similar
code is not automatically shared code.

## Notice reference feature

The Notice feature is the first canonical example:

```text
app/src/Notice/
├── Block.php
├── block.json
├── render.php
├── entries/
│   └── notice-block.entry.ts
├── editor/
│   ├── Edit.tsx
│   └── editor.scss
├── style.scss
├── tone.ts
└── tone.test.ts
```

### Notice file ownership

| Path | Owner and purpose |
| --- | --- |
| `Block.php` | WordPress hook integration and block registration |
| `block.json` | Block identity, attributes, supports, script/style handles, and metadata |
| `render.php` | Dynamic server-side markup for one render invocation |
| `entries/notice-block.entry.ts` | Block registration, imports, and HMR-safe composition |
| `editor/Edit.tsx` | Block Editor UI and Inspector Controls |
| `editor/editor.scss` | Editor-only presentation |
| `style.scss` | Styles shared by the editor and front end |
| `tone.ts` | Pure tone values, fallback, and display mapping for TypeScript |
| `tone.test.ts` | Adjacent unit tests for `tone.ts` |

`render.php` is a rendering boundary, not a second plugin bootstrap. It must not
register hooks, enqueue assets, mutate global state, or perform unrelated
queries.

The allowed `tone` contract exists in both TypeScript and PHP because the server
must never trust browser input. Tests on both sides must protect the shared
behavior:

- supported values are `info`, `tip`, and `warning`;
- unsupported values fall back to `info`;
- user-facing labels are translatable;
- output is sanitized and escaped at the correct boundary;
- permitted inline markup remains permitted;
- meaning is not communicated by color alone.

If PHP tone behavior becomes independently complex, extract a specifically
named class such as `Tone.php` beside `Block.php`. Do not create a generic
utility directory for it.

## First-level feature responsibilities

A feature may introduce these responsibility directories when real code
requires them:

| Path | Owner and purpose |
| --- | --- |
| `entries/` | Vite entries, registration, CSS imports, dependency composition, and HMR cleanup |
| `editor/` | Block Editor UI, Inspector Controls, selectors, labels, focus, and editor-only styles |
| `canvas/` | Public integration that affects the post-content canvas outside a block's own edit component |
| `dnd/` | Drag session, projection, overlay, temporary order, cancellation, and drop interpretation |
| `reordering/` | Input-independent validation, canonical ordering, mutation, and result verification |
| `api/` | Feature endpoint contracts, request construction, response validation, and feature-specific errors |
| `types/` | Narrow feature-specific ambient declarations missing from authoritative packages |

These names describe ownership, not mandatory scaffolding. Never reserve them
with `.gitkeep`, placeholder modules, or empty index files.

Small pure modules such as `tone.ts` may remain at the feature root. When
several related modules form a real responsibility, introduce a directory with
a specific name rather than a generic `utils/` or `domain/` bucket.

### Feature-root PHP

Keep a few closely related PHP integration classes at the feature root:

```text
Notice/
├── Block.php
├── block.json
├── render.php
└── entries/
```

Do not add `php/` merely to group files by extension.

If a real PHP subdomain forms, introduce a PascalCase directory matching its
namespace and responsibility, for example:

```text
SomeFeature/
├── Rest/
├── Eligibility/
└── Assets/
```

Create such a directory only when multiple related classes make the boundary
clearer.

## Entries

Entries are doors into the product. They are not the room where behavior lives.

An entry may:

- import feature styles;
- import `block.json`;
- compose already-owned dependencies;
- register a block or public WordPress integration;
- create concrete infrastructure adapters;
- unregister or dispose repeatable registrations during HMR.

An entry must not define:

- reusable React components;
- selectors or store adapters;
- tone, ordering, or validation algorithms;
- drag sessions;
- API operations or endpoint paths;
- substantial application state.

Use descriptive entry names:

```text
<feature>-<surface>.entry.ts
<feature>-<surface>.entry.tsx
```

Examples:

```text
Notice/entries/notice-block.entry.ts
SortableList/entries/sortable-list-editor.entry.tsx
SortableList/entries/sortable-list-canvas.entry.ts
```

Do not introduce Vite SPA scaffolding such as `index.html`, `App.tsx`, or an
independent React root. WordPress owns the Editor React tree.

HMR registration must be repeatable. Updating an entry must not leave duplicate
filters, subscriptions, block registrations, timers, or event listeners.

## Editor, canvas, and front-end styles

`editor/` owns the administrative editing experience:

- a block's `edit` component;
- Inspector Controls;
- editor-only labels and notices;
- subscribed WordPress Data state used by the UI;
- editor focus and selection behavior;
- editor-only SCSS.

A feature-root `style.scss` owns styles shared by the Block Editor and front
end for that feature.

`canvas/` is optional. It is for public WordPress integration that affects the
post-content canvas outside the feature's own block edit component, such as:

- `editor.BlockListBlock` wrapper filters;
- safe wrapper prop composition;
- iframe and non-iframe canvas integration;
- canvas-visible transient feedback;
- registration and cleanup of canvas-facing public APIs.

Ownership follows the surface being affected, not the JavaScript execution
realm. Canvas integration may execute from the editor parent document while
still belonging to `canvas/`.

Do not query private Editor DOM, use private WordPress APIs, inject feature data
through `window`, or create a separate React root.

## React subdirectories

`components/` and `hooks/` are optional second-level directories below the
responsibility that owns them:

```text
editor/
├── components/
└── hooks/

canvas/
├── components/
└── hooks/

dnd/
├── components/
└── hooks/
```

Create one only when multiple related files have an independently testable UI
or lifecycle boundary and the extra level improves ownership.

Do not create one:

- for a single file;
- to satisfy a line-count target;
- in anticipation of future code;
- as a dumping ground for unrelated modules.

Use PascalCase for React component filenames and kebab-case for non-component
TypeScript modules and entries.

Keep styles beside the rendering or integration boundary that owns them.

## Future drag-and-drop boundary

DnD is an input method. It answers what happened during a drag and how a drop
maps to an application request. It does not own canonical WordPress state.

A future reorderable feature may grow into this shape:

```text
app/src/SortableList/
├── entries/
│   └── sortable-list-editor.entry.tsx
├── editor/
│   ├── components/
│   └── editor.scss
├── dnd/
│   ├── drag-session.ts
│   ├── drag-session.test.ts
│   ├── projection.ts
│   └── projection.test.ts
├── reordering/
│   ├── move.ts
│   ├── move.test.ts
│   ├── order.ts
│   └── order.test.ts
└── types/
    └── wordpress.d.ts
```

This is an example of possible responsibilities, not a directory template.

### DnD owns

- pointer, touch, and keyboard drag lifecycle;
- active item and over-target snapshots;
- temporary projected or rendered order;
- drag overlay state;
- cancellation and cleanup;
- interpretation of a drop into a reorder request;
- integration with a DnD library.

### Reordering owns

- validation against the latest canonical state;
- calculation of the expected order;
- canonical WordPress Data mutation;
- post-dispatch verification;
- a result that every input method can consume.

Buttons, keyboard controls, pointer DnD, and touch DnD must use the same
`reordering/` contract.

`dnd/` may depend on `reordering/`. `reordering/` must not depend on DnD, React,
the DOM, a DnD library, entries, or visual components.

Keep pure ordering functions independent from WordPress and browser APIs. Pass
a registry or narrow selector/action adapter into the mutation boundary.

This separation prevents DnD from becoming the only way to reorder and keeps
keyboard accessibility and unit testing practical.

## Future browser API boundary

The initial Notice feature does not use REST API or browser API communication.
Therefore Issue #4 must not create either of these speculatively:

```text
app/src/Api/
app/src/Notice/api/
```

Introduce them with the first real API operation.

### Application-level `Api/`

`app/src/Api/` is an external-runtime transport boundary. It may own only:

- an `ApiClient` contract;
- request options common to all features;
- a WordPress adapter implemented with `@wordpress/api-fetch`;
- transport-level error normalization;
- cancellation through `AbortSignal`;
- common request lifecycle behavior;
- tests for the transport adapter and contract behavior.

Example:

```text
app/src/
├── Api/
│   ├── client.ts
│   ├── client.test.ts
│   ├── wordpress-api-client.ts
│   ├── wordpress-api-client.test.ts
│   └── errors.ts
└── TableData/
    └── api/
        ├── fetch-table.ts
        ├── fetch-table.test.ts
        ├── update-table.ts
        └── update-table.test.ts
```

Application `Api/` must not contain:

- feature endpoint paths;
- feature payload or response types;
- feature response validation;
- UI-facing messages;
- React components or hooks;
- WordPress Data mutations;
- product-domain logic;
- dependencies on product features.

### Feature `api/`

A feature-level lowercase `api/` directory owns:

- endpoint paths for that feature;
- request, response, and payload types;
- request construction;
- feature API operation functions or services;
- response validation;
- feature-specific error interpretation.

Feature code must not import `@wordpress/api-fetch`, call `window.fetch`, or
call global `fetch` directly.

Create the concrete WordPress API client at a composition boundary such as an
entry, then inject its narrow contract into the feature operation or UI.

Do not use a global mutable singleton that tests replace.

```text
entries/
  └──> feature UI or integration
           └──> feature api/
                    └──> Api/
```

`Api/` must never depend on a product feature.

Feature API tests inject fakes, stubs, or spies. They verify endpoint paths,
HTTP methods, payloads, response validation, and feature-specific errors
without network I/O and without mocking `@wordpress/api-fetch`.

### PHP REST implementation

Browser `Api/` is distinct from PHP REST implementation.

Each product feature owns its REST routes, permission checks, input validation,
sanitization, handlers, and response generation.

Keep a few related PHP classes at the feature root. Introduce a PascalCase
`Rest/` directory only when multiple related classes form a real PHP subdomain.

REST namespace, `permission_callback`, capabilities, nonces, validation,
sanitization, escaping, `WP_Error`, security, and privacy requirements remain
governed by `docs/development/foundation.md`.

## Dependency direction

The intended TypeScript dependency direction is:

```text
entries/
  ├──> editor/
  ├──> canvas/
  ├──> feature pure modules
  └──> Api/ adapter construction

editor/
  ├──> feature pure modules
  ├──> dnd/
  ├──> reordering/
  └──> feature api/

dnd/ ──────────> reordering/
canvas/ ───────> feature transient state
feature api/ ──> Api/
```

The reverse dependencies are prohibited:

- pure modules must not import entries, React, WordPress Data, DOM APIs, or
  transport adapters;
- `reordering/` must not import editor UI, canvas integration, DnD components,
  or a DnD library;
- `Api/` must not import product features, React, WordPress Data stores, or
  product UI;
- feature `api/` must not import UI components;
- circular imports are prohibited.

PHP dependency direction is:

```text
yamabiko-blocks.php
  └──> Plugin.php
           └──> feature integration classes
                    └──> feature-specific PHP responsibilities
```

Feature PHP code must not depend back on the plugin bootstrap.

## WordPress Data boundary

Use WordPress Data according to lifecycle ownership:

- use `useSelect` for data that drives rendering;
- use `useDispatch` for actions directly invoked by React components;
- use `useRegistry()` for event-time reads that must observe the active registry
  immediately before dispatch;
- pass a registry or narrow selector/action adapter into non-component
  reordering code;
- use global `select()` or `dispatch()` only outside a registry-aware React
  context when default-registry ownership is deliberate;
- never mutate selector results;
- never infer canonical state from DOM order, drag snapshots, or cached
  component state.

Canonical state must have one WordPress owner. DnD may project state but cannot
become the canonical owner.

## Vite and generated identities

Vite is a WordPress asset builder, not an application runtime.

WordPress-provided React, ReactDOM, JSX runtime, and `@wordpress/*` packages are
development dependencies for type checking and module resolution but must be
externalized from production bundles.

Build identity derives from the normalized source path relative to `app/src`,
not from the basename alone.

```text
Source:
Notice/entries/notice-block.entry.ts

Normalized build key:
notice/entries/notice-block
```

Normalization must:

1. use POSIX separators;
2. convert PascalCase path segments to stable kebab-case;
3. remove `.entry.ts` or `.entry.tsx`;
4. reject two source paths that normalize to the same key.

The build must also reject duplicate manifest keys and duplicate emitted
JavaScript, CSS, or metadata paths.

Public WordPress script and style handles remain explicit stable identifiers.
Do not derive public handles only from filenames.

Production asset loading must use the Vite manifest or explicit generated
metadata. It must not guess output filenames from legacy basenames.

Production output must not contain the Vite client or development server URLs.

Development loading must fail safely when the Vite server is unavailable.
Editor iframe and non-iframe environments must both receive the styles they
own.

## Test placement

Keep TypeScript and TSX tests beside the module:

```text
Notice/
├── tone.ts
└── tone.test.ts

SortableList/reordering/
├── order.ts
└── order.test.ts
```

Keep PHP tests under the matching feature directory outside distributable
source:

```text
app/tests/php/
└── Notice/
    ├── BlockTest.php
    └── RenderTest.php
```

Keep end-to-end tests under:

```text
app/tests/e2e/
└── notice.spec.ts
```

Rules:

- pure TypeScript tests must run without WordPress, React, or network access;
- feature API tests inject `ApiClient` fakes, stubs, or spies;
- application API adapter tests stay beside `app/src/Api/`;
- PHPUnit fixtures, doubles, bootstrap classes, and tests never live in
  distributable `app/src/`;
- E2E may be split into a later issue if its infrastructure is too large, but
  the manual acceptance path must remain documented.

## Distribution consequence

Feature co-location does not make development source distributable.

The release builder should include:

- the plugin bootstrap;
- required PHP files from `app/src/`;
- feature `block.json` files;
- compiled `app/dist/` output;
- required runtime metadata and translations;
- explicitly allowlisted runtime assets.

The release builder must exclude:

- TypeScript and TSX source;
- JavaScript or JSX development source;
- SCSS and CSS source that is compiled into `dist/`;
- TypeScript declarations;
- adjacent unit tests;
- PHPUnit and E2E tests;
- Vite, Vitest, ESLint, and Prettier configuration unless explicitly required
  at runtime;
- `AGENTS.md` and development documentation;
- `node_modules/` and `vendor/` unless the release process intentionally builds
  and allowlists production Composer dependencies.

An independent archive inspection must reject development files under
distributable source while allowing compiled JavaScript and CSS under `dist/`.

## Notice implementation checks

When implementing the Notice reference feature, verify:

- `yamabiko/notice` is registered at the correct WordPress hook;
- `block.json` attributes match both editor and PHP behavior;
- the entry remains thin;
- the editor uses the existing WordPress React tree;
- `message` is edited directly in the block;
- `tone` is changed through Inspector Controls;
- invalid tone values fall back to `info` in both TypeScript and PHP;
- dynamic PHP rendering produces the expected wrapper attributes and classes;
- unsafe HTML is removed or neutralized;
- explicitly allowed inline markup is preserved;
- user-facing strings are translatable;
- editor and front-end styles have clear owners;
- no front-end JavaScript is shipped;
- missing production build output does not cause a fatal error;
- HMR does not unnecessarily lose block content, selection, or focus;
- iframe and non-iframe editor environments load their owned styles;
- production bundles do not duplicate WordPress-provided packages.

## Review checklist

When changing source organization, verify:

- the feature owner is clear;
- each responsibility has one clear owner;
- no language-oriented directory was added;
- no speculative directory or placeholder file was added;
- entries remain thin and HMR-safe;
- React subdirectories contain multiple real files;
- editor, canvas, and front-end style ownership remain distinct;
- DnD remains an input boundary;
- every reorder input shares the same reordering contract;
- canonical state has one WordPress owner;
- registry-aware reads occur immediately before canonical mutation;
- browser product API calls use an injected `ApiClient`;
- `Api/` contains transport concerns only;
- feature `api/` owns endpoint contracts and feature response handling;
- PHP REST routes remain feature-owned;
- pure logic stays isolated from React, WordPress, DnD libraries, and transport;
- dependencies are acyclic;
- TypeScript tests remain adjacent;
- PHP tests remain under the matching `app/tests/php/<Feature>/` directory;
- build keys, manifests, emitted paths, handles, and asset metadata stay unique;
- production builds contain no Vite development runtime;
- release archives contain only allowlisted runtime files.
