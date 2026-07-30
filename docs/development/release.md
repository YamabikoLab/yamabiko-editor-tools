# Distribution contract

The `app/` directory is the WordPress plugin root.

Create and inspect a release archive from `app/`:

```bash
npm run dist
npm run inspect:dist
```

The archive is written to:

```text
app/artifacts/yamabiko-blocks.zip
```

Its only top-level entry is:

```text
yamabiko-blocks/
```

## Release principles

- Build from an explicit allowlist, never from a broad recursive copy.
- Keep development source co-located by feature without shipping it.
- Produce an archive that runs on a WordPress host without Node or Composer.
- Treat the archive as a disposable build artifact.
- Never commit release archives or generated distribution directories.

The source tree and release tree are intentionally different.

## Included files

The release builder may include only approved runtime files such as:

- `yamabiko-blocks.php`;
- required PHP files under `src/`;
- feature `block.json` files under `src/`;
- compiled production output under `dist/`;
- generated WordPress dependency metadata required by compiled entries;
- production Composer autoload files and approved runtime dependencies;
- translation files when present;
- the plugin README;
- license and required third-party license notices;
- other files explicitly added to the release allowlist.

Do not infer inclusion merely because a file is under `app/` or `src/`.

## Excluded files

The release must exclude development-only content, including:

- TypeScript, TSX, JavaScript, and JSX source;
- SCSS and uncompiled CSS source;
- adjacent unit tests;
- PHPUnit and Playwright tests;
- fixtures, test doubles, snapshots, reports, traces, and coverage output;
- Vite, Vitest, ESLint, Prettier, TypeScript, and Playwright configuration unless
  explicitly required at runtime;
- `AGENTS.md`;
- development documentation;
- `node_modules/`;
- development Composer packages;
- caches and temporary files;
- source maps unless explicitly approved;
- environment files, credentials, private keys, and local editor settings;
- Vite development clients, development-server URLs, and HMR runtime code.

Feature co-location does not change these rules. A `.php` or `block.json` file
may be distributable while neighboring TypeScript, SCSS, declarations, and
tests remain development files.

## Composer runtime

The release builder must create or copy a production-only Composer runtime.

It must:

- exclude development dependencies;
- include only packages required at runtime;
- generate an optimized production autoloader when supported;
- avoid absolute development workspace paths;
- avoid requiring Composer on the destination host.

## Vite production output

Production assets must be generated before the archive is assembled.

The release builder and inspector must verify:

- required Vite entries are represented in the production manifest or approved
  generated metadata;
- emitted JavaScript, CSS, and dependency metadata paths are unique;
- public WordPress script and style handles resolve to existing artifacts;
- React, ReactDOM, the JSX runtime, and WordPress-provided packages are not
  bundled;
- no Vite client or development-server URL is present;
- no runtime path points to `node_modules/`;
- source maps are absent unless explicitly approved;
- missing optional feature output cannot break the entire plugin.

Compiled JavaScript and CSS under `dist/` are valid release files. Their source
counterparts under `src/` are not.

## Notice reference feature

Issue #4 establishes `yamabiko/notice` as the first reference feature.

When the Notice feature is included, the release must contain:

- the PHP registration and render files required by the block;
- `src/Notice/block.json`;
- the compiled editor entry and its required CSS;
- shared compiled styles used by the editor and front end;
- required WordPress dependency metadata;
- translation data when generated.

The release must not contain:

- `src/Notice/**/*.ts`;
- `src/Notice/**/*.tsx`;
- `src/Notice/**/*.scss`;
- `src/Notice/**/*.test.*`;
- `tests/php/Notice/`;
- `tests/e2e/`.

The Notice block uses dynamic PHP rendering and ships no front-end JavaScript
unless a later approved vertical slice explicitly introduces it.

## Future DnD and API features

Future DnD or browser API features follow the same allowlist rules.

- DnD libraries may be included only when required by a shipped compiled entry.
- Source drag logic, tests, and development fixtures remain excluded.
- Browser API transport code may be included only through compiled production
  assets.
- Endpoint contracts or PHP REST handlers are included only when their feature
  is part of the release.
- Test clients, stubs, spies, mock servers, and credentials are never shipped.
- Adding external requests, REST routes, persistent data, or remote assets
  requires the approved compatibility, privacy, and lifecycle contracts.

## Archive inspection

`npm run inspect:dist` must independently inspect the completed archive rather
than trusting the builder.

It must reject:

- unexpected files outside the allowlist;
- more than one top-level archive entry;
- an incorrect top-level directory name;
- secrets, credentials, private keys, or environment files;
- absolute workspace or container paths;
- Vite development clients or development-server references;
- source maps unless approved;
- runtime references to `node_modules/`;
- bundled WordPress-provided React runtime;
- development dependencies;
- tests, fixtures, agent contracts, and uncompiled source;
- missing required runtime files or asset metadata;
- duplicate or unresolved manifest and output paths.

It must confirm that:

- the archive opens successfully;
- all paths are relative and normalized;
- required PHP files and `block.json` files are present;
- compiled entries reference existing files;
- Composer autoloading resolves only packaged runtime code;
- the destination host needs neither Node nor Composer.

## Release handoff

Before handing off a distribution change:

1. Run the applicable PHP and Node quality gates.
2. Run `npm run dist`.
3. Run `npm run inspect:dist`.
4. Inspect the archive contents when the allowlist changed.
5. Activate the packaged plugin in a clean WordPress environment.
6. Confirm required blocks and assets load without warnings or fatal errors.
7. Record any manual browser checks not represented by automated tests.

A successful source build is not evidence that the archive is valid. The
completed archive and its clean-install behavior are the release contract.
