# Source organization

Yamabiko Editor Tools contains blocks and non-block editor extensions. Keep each feature's metadata, entry code, UI, rendering, styles, and focused tests together in one owning directory.

Keep the structure concrete and small. Add a directory only when current implementation requires it.

## Plugin root

The repository root is the WordPress plugin root.

```text
.
├── src/
│   └── blocks/
│       └── notice/
├── build/              # generated, not committed
├── package.json
├── composer.json
└── yamabiko-editor-tools.php
```

`src/blocks/notice/` is the current reference implementation for a small dynamic block. It keeps metadata, registration, editor UI, rendering, styles, and focused tests together without adding feature-specific PHP registration classes or custom build configuration.

## Notice block example

The notice block uses the following structure:

```text
src/blocks/notice/
├── block.json
├── index.tsx
├── edit.tsx
├── render.php
├── editor.scss
├── style.scss
├── tone.ts
└── tone.test.ts
```

- `block.json` defines metadata, attributes, assets, and the dynamic render file.
- `index.tsx` is the thin registration entry point.
- `edit.tsx` owns the editor UI and attribute updates.
- `render.php` validates attributes and renders the front end.
- `editor.scss` contains editor-only styles.
- `style.scss` contains shared editor and front-end styles.
- `tone.ts` owns the focused tone normalization logic.
- `tone.test.ts` verifies that focused logic beside its source.

Use this as a reference for responsibility placement, not as mandatory scaffolding for every block.

## Feature directories

Use the following top-level directories when their first real feature exists:

```text
src/
├── blocks/             # blocks
├── formats/            # rich-text formats
├── editor-extensions/  # sidebars and other editor-wide extensions
└── shared/             # proven cross-feature code only
```

Use lowercase kebab-case feature directory names.

```text
src/blocks/<block-name>/
src/formats/<format-name>/
src/editor-extensions/<extension-name>/
```

Do not organize implementations into language-oriented trees such as `php/`, `js/`, `styles/`, or `includes/`. A developer should be able to find everything owned by one feature in one place.

## Block shape

A block may use the following files when needed:

```text
src/blocks/<block-name>/
├── block.json
├── index.tsx
├── edit.tsx
├── save.tsx           # static block only
├── render.php         # dynamic block only
├── editor.scss
├── style.scss
├── <focused-module>.ts
└── <focused-module>.test.ts
```

This is a list of permitted responsibilities, not mandatory scaffolding. Do not create empty files or directories to make every block look identical.

A static block normally owns `save.tsx`. A dynamic block normally returns `null` from its JavaScript save function and renders through `render.php`.

Do not add a PHP registration class to every block by default. Add block-specific PHP classes only when a real responsibility cannot remain clear and testable inside `render.php` or another focused file.

## Non-block editor extensions

A non-block extension should follow the same feature-first ownership rule. Create only the files and subdirectories required by the implementation. Do not introduce generic architecture in advance.

## Entry files

Each feature's `index.ts` or `index.tsx` is a thin entry point. It may import metadata, implementations, and styles, then register the feature with public WordPress APIs.

It must not become the main location for substantial UI, state management, transformations, validation, network operations, or unrelated behavior. Move those responsibilities into clearly named files inside the owning feature.

## Rendering and editor boundaries

Editor components own the editing experience, including controls, labels, selection behavior, and editor-facing validation messages.

A `render.php` file is a rendering boundary, not a second plugin bootstrap. It must not register unrelated hooks, enqueue unrelated assets, mutate global state, perform unrelated queries, trust attributes without validation, or output values without context-appropriate escaping.

Use semantic markup and ensure that meaning is not communicated by color alone.

## Shared code

Do not create generic `shared/`, `utils/`, or `helpers/` directories for possible future reuse.

Keep code inside its owning feature until at least two real features need the same stable behavior. When extracting shared code, give it a specific responsibility, keep its public surface small, avoid dependencies on one feature's internal details, and update imports and tests in the same change.

Small duplication is preferable to an unclear abstraction.

## Tests and generated files

Keep focused TypeScript tests beside the modules they verify. Use a top-level test directory only for repository-wide, integration, PHP, or end-to-end behavior that does not belong naturally beside one source module.

`build/` is generated by `npm run build` or `npm start`. Do not edit or commit it. `node_modules/` and `vendor/` are installed dependencies and are also not committed. Lockfiles remain committed so installations are reproducible.

## Evolving the structure

Change this structure only when real implementation pressure justifies it. When a new source boundary becomes part of the actual codebase, document its owner and allowed dependency direction in the same change.
