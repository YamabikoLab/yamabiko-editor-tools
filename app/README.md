# Yamabiko Editor Tools development

Run the following commands from the `app/` directory.

## Install dependencies

```bash
npm ci
composer install
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
npm run format:check
npm run lint:js
npm run lint:css
npm run typecheck
composer lint:php
composer analyse:php
```

These commands only inspect files and do not rewrite them.

Apply automatic fixes separately when needed:

```bash
npm run format
npm run format:css
composer format:php
```

Review every automatic change before committing it.

When Plugin Check is installed in the development WordPress environment, it can also be run as a complementary check:

```bash
wp plugin check yamabiko-editor-tools
```

Plugin Check does not replace the coding-standard commands above.

## Add a block

Create each block in its own directory under `src/blocks/` and include a `block.json` file.

```text
src/blocks/
└── example/
    ├── block.json
    └── index.tsx
```

The build command discovers block metadata under `src/` and generates the files required for WordPress registration.

After building, activate **Yamabiko Editor Tools** in WordPress and confirm that the block is available in the block editor.
