# PLAN-102: Table Reorder drag animation

## References

- Parent issue: #102
- Related PR: #93

## Goal

Restore drag-time row avoidance feedback without allowing dnd-kit to reorder Gutenberg-owned table rows.

## Scope

### Included

- CSS transform-based visual displacement for valid row insertion candidates.
- Unified cleanup of temporary row styles and insertion candidates.
- Focused pure and DOM-based regression tests.

### Not included

- Column reordering, keyboard DnD, or changes outside Table Reorder.

## Approach

Use the existing drag-start `body` snapshot and candidate model unchanged. Derive displaced rows from the snapshot insertion index, then apply temporary inline transforms to the affected real rows without changing their DOM order. Restore every saved inline style whenever a candidate is cleared or the drag ends.

## Architecture

- `drag-session.ts` remains responsible for valid candidates and the one-time commit.
- `drag-visuals.ts` owns pure displacement calculation and reversible DOM style application.
- `table-reorder-controller.tsx` applies visuals only for a valid session candidate and routes all termination paths through cleanup.

## Implementation phases

### Phase 1: Safe visual feedback

- Outcome: Valid candidates create a temporary visual gap with no attribute or DOM-order mutation.
- Tasks: Add displacement calculation, style restoration, and controller integration.
- Validation: Focused unit tests and repository Node checks.

## Decisions and validation questions

### Decide before implementation

- Keep `useSortable({ plugins: [] })`; visual movement must not use optimistic sorting.

### Validate during implementation

- Verify different source-row heights determine the displacement distance.
- Verify invalid, outside, canceled, and mode-exit paths restore styles and candidates.

## Validation

- `npm run test:unit`: focused displacement and visual cleanup tests pass.
- Repository Node checks and `git diff --check`: pass.
- Manual editor checks: upward/downward movement, rowspan restrictions, tbody-outside drop, iframe and non-iframe.

## Completion criteria

- Only valid drops update `body` once.
- Drag-time transforms are fully restored on every no-op termination path.
