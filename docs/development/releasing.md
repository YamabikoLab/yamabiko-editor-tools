# Release process

Releases use semantic versions and tags in the form `v<version>`, such as `v0.2.0`.

The plugin header in `yamabiko-table-reorder.php` is the single source of truth for the release version.

## Version rules

Update the release version when preparing a release, not for every issue or pull request.

Choose the next version according to the change:

- patch: backward-compatible fixes
- minor: backward-compatible features
- major: incompatible changes

Only stable `x.y.z` versions can be released. Pre-release versions such as `1.0.0-beta.1` are not accepted by the Release workflow.

For a release, update these values together in the release pull request:

- `yamabiko-table-reorder.php` `Version` to the release version
- `readme.txt` `Stable tag` to the same version
- `readme.txt` `== Changelog ==` with a section for the same version

The following values are intentionally not synchronized with the plugin release version:

- `package.json` `version` stays fixed at `0.0.0`.
- the root package versions in `package-lock.json` stay fixed at `0.0.0`.
- `src/**/block.json` versions describe block metadata and are not the plugin release version.

`readme.txt` is the authoritative source for release notes. Do not maintain an independent `CHANGELOG.md` source of truth.

## Prepare a release

1. Create a release pull request that updates the plugin header `Version`.
2. Update `readme.txt` `Stable tag` to the same version.
3. Add the release notes under `== Changelog ==` using a heading such as `= 0.2.0 =`.
4. Review and merge the pull request into `main`.

Do not create or push the release tag manually before running the Release workflow.

## Publish a release

From the repository's **Actions** tab:

1. Open the **Release** workflow.
2. Choose **Run workflow**.
3. Select `main` as the workflow ref.
4. Enter the release version without the `v` prefix, such as `0.2.0`.
5. Run the workflow.

The workflow then:

1. verifies that it is running from `main`;
2. reads the release version from the plugin header and requires a stable `x.y.z` version;
3. verifies that the entered version, `readme.txt` `Stable tag`, and Changelog section match the plugin version;
4. verifies that npm package metadata remains fixed at `0.0.0`;
5. verifies that the tag and GitHub Release do not already exist;
6. installs dependencies with `npm ci`;
7. runs `npm test`;
8. builds `yamabiko-table-reorder.zip` with `npm run plugin-zip` and verifies that the ZIP contains `readme.txt`;
9. creates `v<version>` at the exact `main` commit validated by the workflow;
10. creates the GitHub Release using the matching `readme.txt` Changelog section as the release notes and attaches the ZIP.

The workflow uses release-wide concurrency, so two releases cannot publish at the same time.

If the workflow fails before creating the tag, fix the cause in a pull request, merge it, and run the workflow again. If it fails after pushing a tag but before creating the GitHub Release, inspect the failed run and remove only the incomplete unpublished tag before retrying. Never move or reuse a published release tag.

## Release announcements

The Release workflow does not create GitHub Discussions automatically.

If an announcement is useful, create it manually after the GitHub Release is published and link to the Release page. This keeps release publication independent from community announcement features.

## Future WordPress.org deployment

`readme.txt` follows the WordPress.org plugin readme format so the repository is ready for a future WordPress.org SVN publishing step.

When WordPress.org publishing is added, keep the same release contract:

- the plugin header remains the release-version source of truth;
- `readme.txt` `Stable tag` and Changelog remain synchronized release metadata;
- the already validated `main` commit is the source for the release;
- the distribution contents stay aligned with the GitHub Release ZIP.

WordPress.org SVN deployment is not automated by the current workflow.
