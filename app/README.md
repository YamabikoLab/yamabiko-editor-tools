# Yamabiko Editor Tools development

Run the following commands from the `app/` directory.

## Install dependencies

```bash
npm install
```

## Start development mode

```bash
npm start
```

The local WordPress container enables `SCRIPT_DEBUG`, and `wp-scripts start --hot` watches files under `src/` and rebuilds blocks when they change.

## Create a production build

```bash
npm run build
```

Build output is written to `build/`. The generated block manifest is loaded by `yamabiko-editor-tools.php`.

## Check the code

```bash
npm run format
npm run lint:js
npm run typecheck
```

- `format` formats JavaScript, TypeScript, TSX, JSON, and related files with WordPress formatting rules.
- `lint:js` checks JavaScript, TypeScript, and TSX with the WordPress ESLint configuration.
- `typecheck` checks TypeScript types without generating files.

## Add a block

Create each block in its own directory under `src/` and include a `block.json` file.

```text
src/
└── example/
    ├── block.json
    └── index.tsx
```

The build command discovers block metadata under `src/` and generates the files required for WordPress registration.

After building, activate **Yamabiko Editor Tools** in WordPress and confirm that the block is available in the block editor.
