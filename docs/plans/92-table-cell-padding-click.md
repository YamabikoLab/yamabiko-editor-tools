# PLAN-92: Table cell padding click

## References

- Parent issue: #92
- Requirements: A selected core Table block must enter the clicked cell when the
  click lands in the unused vertical space of a one-line cell in a taller row.
- Design: Use the core Table block's existing RichText focus behavior and identify
  the clicked cell from the selected Table block element and pointer coordinates.

## Goal

Make the unused vertical area in a short Table cell enter that cell for editing
without changing interactions with links or other elements inside cells.

## Scope

### Included

- Detect a primary-button pointer down whose coordinates fall within a cell of the
  selected Table block, even when the browser reports the editor root as the event
  target.
- Focus that cell's direct RichText editable and stop the block-level selection
  event.
- Add a focused regression test for a mixed-height row and an interactive link.

### Not included

- Changes to core Table block markup, saved content, or reorder-mode behavior.

## Approach

The core Table block selects a cell from the RichText `onFocus` handler. Manual
browser debugging confirmed that a click in the unused vertical space can report
the iframe editor root as `event.target`, rather than the Table figure or one of
its descendants. The editor extension must therefore use the already resolved
Table `blockElement` and the pointer coordinates to identify the corresponding
cell, then focus its direct RichText editable.

Events that directly target links, buttons, the RichText itself, or other existing
interactive elements must remain untouched.

## Architecture

- `with-table-reorder.tsx` mounts the controller while a core Table block is
  selected and reorder mode is off.
- `table-cell-padding-click.ts` identifies the cell within the selected Table
  block from the pointer coordinates and focuses its direct RichText editable.
- `table-cell-padding-click.test.ts` verifies the mixed-height-row regression
  and non-interference with a link.

## Implementation phases

### Phase 1: Handle padded cell clicks

- Outcome: A qualifying click focuses the correct cell editable.
- Tasks: Add the controller and focused DOM helper.
- Validation: Focused unit test.

### Phase 2: Verify the plugin change

- Outcome: Source and tests pass the applicable JavaScript checks.
- Tasks: Run the documented JavaScript checks and inspect changed whitespace.
- Validation: Commands in `docs/development/testing.md`.

## Decisions and validation questions

### Decide before implementation

- Use focus rather than synthetic click events because the core Table block
  selects cells from the RichText `onFocus` handler.
- Do not infer the target Table from `event.target`; use the selected Table's
  resolved `blockElement` because padding clicks can target the editor root.

### Validate during implementation

- Confirm an editor-root-targeted padding click is mapped to the correct cell by
  coordinates.
- Confirm a link target is not intercepted.

## Issue breakdown

- [x] Single implementation unit; no child issues required.

## Validation

- `npm run format:check`: changed TypeScript and Markdown are formatted.
- `npm run lint:js`: JavaScript and TypeScript lint cleanly.
- `npm run lint:css`: existing stylesheet lint remains clean.
- `npm run typecheck`: TypeScript types pass.
- `npm run test:unit`: focused regression test and existing unit tests pass.
- `npm run build`: production assets build without source changes.
- `git diff --check origin/main...HEAD`: no changed-line whitespace errors.

## Completion criteria

- A mixed-height Table row's short-cell padding focuses that cell for editing.
- Links and other existing in-cell targets retain their normal pointer behavior.
- Applicable automated checks pass.

## Notes

Manual WordPress debugging confirmed that padding clicks can target the iframe
editor root while their coordinates remain within a Table cell. JSDOM cannot
reproduce the browser's table hit-testing and layout, so final manual verification
remains necessary.
