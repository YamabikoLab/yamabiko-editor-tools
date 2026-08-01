# Source organization

Yamabiko Blocks is a block collection. Each real block should own its metadata, editor code, rendering, styles, and focused tests in one feature directory.

Keep the structure concrete and small. Add a directory only when current implementation requires it.

## Plugin root

`app/` is the WordPress plugin root.

The current source tree contains the foundation verification example:

```text
app/
├── src/
│   └── example/
├── build/              # generated, not committed
├── package.json
├── composer.json
└── yamabiko-blocks.php
```

`app/src/example/` exists only to verify the current `@wordpress/scripts` build and block registration foundation. It is an existing exception, not the standard location for future product blocks. Do not move or expand it as part of unrelated work.

When the first real block is implemented, place it under `app/src/blocks/<block-name>/`. Use a lowercase kebab-case directory name that matches the block's product identity.

```text
app/src/blocks/<block-name>/
```

Do not create `app/src/blocks/` before a real block implementation needs it. Do not organize block implementation into language-oriented trees such as `php/`, `js/`, `styles/`, or `includes/`. A developer should be able to find everything owned by one block in one place.

## Standard block shape

A future block may use the following files when its implementation needs them:

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

### Static blocks

A static block normally owns a `save.tsx` implementation that produces saved markup.

```text
src/blocks/<static-block>/
├── block.json
├── index.tsx
├── edit.tsx
├── save.tsx
├── editor.scss
└── style.scss
```

### Dynamic blocks

A dynamic block normally returns `null` from its JavaScript save function and renders through `render.php`.

```text
src/blocks/<dynamic-block>/
├── block.json
├── index.tsx
├── edit.tsx
├── render.php
├── editor.scss
└── style.scss
```

Do not add a PHP registration class to every block by default. The current plugin registers generated block metadata from `app/build/`. Add block-specific PHP classes only when a real responsibility cannot remain clear and testable inside `render.php` or another focused file.

Document block-specific files only in the Issue or pull request that introduces the implementation. Do not describe an unimplemented block as the repository's current reference implementation.

## Entry files

Each block's `index.tsx` is a thin entry point. It may:

- import `block.json`;
- import the block's editor and save implementations;
- import styles owned by the block;
- register the block with the public WordPress API.

It must not become the main location for:

- substantial UI components;
- attribute transformations or validation rules;
- state management;
- reusable domain logic;
- network operations;
- unrelated block behavior.

Move those responsibilities into clearly named files inside the owning block.

## Editor and rendering boundaries

`edit.tsx` owns the editing experience for its block, including Inspector Controls, editor labels, selection behavior, and editor-facing validation messages.

`render.php` is a rendering boundary, not a second plugin bootstrap. It must not:

- register hooks;
- enqueue unrelated assets;
- mutate global state;
- perform unrelated queries;
- trust attributes without validation;
- output values without context-appropriate escaping.

Use semantic markup and ensure that meaning is not communicated by color alone.

## Growing a block

Keep a small block flat. Introduce responsibility directories only after multiple related files make the boundary useful.

```text
src/blocks/<block-name>/
├── block.json
├── index.tsx
├── edit.tsx
├── save.tsx
├── components/
│   ├── BlockPreview.tsx
│   └── ItemSelector.tsx
├── hooks/
│   └── use-item.ts
├── item.ts
├── editor.scss
└── style.scss
```

Do not create `components/`, `hooks/`, `utils/`, or `helpers/` for a single file or possible future use. Prefer a specific responsibility name over a generic bucket.

## Parent and child blocks

Blocks that form one product feature may remain grouped when the child exists only for its parent.

```text
src/blocks/<feature-name>/
├── parent/
│   ├── block.json
│   ├── index.tsx
│   └── edit.tsx
├── item/
│   ├── block.json
│   ├── index.tsx
│   └── edit.tsx
├── editor.scss
└── style.scss
```

If a child block is independently useful or separately owned, place it in its own block directory instead. Choose the structure based on product ownership rather than file count alone.

## Other editor extensions

The repository may later contain extensions that are not blocks. Add their top-level directory only when the first real implementation exists.

```text
src/
├── blocks/             # real product blocks, when implemented
├── formats/            # rich-text formats, when implemented
├── editor-plugins/     # editor plugins, when implemented
└── shared/             # proven cross-feature code only
```

Do not create these directories in advance.

## Shared code

Do not create generic `shared/`, `utils/`, or `helpers/` directories for possible future reuse.

Keep code inside its owning block until at least two real features need the same stable behavior. When extracting shared code:

- give it a specific responsibility;
- keep its public surface small;
- avoid dependencies on one block's internal details;
- update imports and tests as part of the same change.

Small duplication is preferable to an unclear abstraction.

## Tests

Keep focused TypeScript tests beside the modules they verify when a test framework exists for that code.

Use a top-level test directory only for repository-wide, integration, PHP, or end-to-end behavior that does not belong naturally beside one source module.

Do not add empty test directories or describe test suites that are not currently available.

## Generated files

`app/build/` is generated by `npm run build` or `npm start`. Do not edit or commit it.

`node_modules/` and `vendor/` are installed dependencies and are also not committed. Lockfiles remain committed so installations are reproducible.

## Evolving the structure

Change this structure when real implementation pressure justifies it. Do not introduce Vite-specific entries, custom HMR boundaries, drag-and-drop layers, REST clients, distribution directories, or other future architecture before the corresponding feature exists.

When a new source boundary becomes part of the actual codebase, document its owner and allowed dependency direction in the same change.
