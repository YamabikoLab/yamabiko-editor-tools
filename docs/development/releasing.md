# Release process

Releases use semantic versions and tags in the form `v<version>`, such as `v0.2.0`.

## Version rules

Update the version when preparing a release, not for every issue or pull request.

Choose the next version according to the change:

- patch: backward-compatible fixes
- minor: backward-compatible features
- major: incompatible changes

The following version fields must match:

- `app/package.json`
- `app/yamabiko-editor-tools.php`
- every `app/src/**/block.json`

From `app/`, update them together with:

```bash
npm run version:set -- 0.2.0
npm run version:check
```

Commit the version update and merge it into `main` before creating the tag.

## Publish a release

Create and push an annotated tag from the release commit:

```bash
git switch main
git pull --ff-only
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

The `Release` GitHub Actions workflow then:

1. verifies that the tag and all version fields match;
2. installs npm dependencies;
3. runs `npm run plugin-zip`;
4. creates a GitHub Release with generated release notes;
5. attaches `yamabiko-editor-tools.zip`.

If the workflow fails, fix the cause in a pull request and create a new tag after merging. Do not move or reuse a published tag.
