# Table Reorder SortableJS 責務分割リファクタリングプラン

## References

- Current implementation: `src/editor-extensions/table-reorder/with-table-reorder.tsx`
- Current feature README: `src/editor-extensions/table-reorder/README.md`
- Existing rowspan logic: `src/editor-extensions/table-reorder/rowspan.ts`
- Source organization: `docs/development/source-organization.md`
- Testing and validation: `docs/development/testing.md`
- Historical dnd-kit refactor plan: `docs/plans/table-reorder/table-reorder-controller-refactor-plan.md`

The historical controller refactor plan describes the former dnd-kit based implementation. It remains useful as project history, but this plan is based on the current SortableJS implementation and does not reuse its controller or hook boundaries mechanically.

## Goal

Preserve the current Table Reorder behavior while separating the responsibilities concentrated in `with-table-reorder.tsx`.

After the refactor, `withTableReorder` should be a thin Gutenberg adapter that renders `BlockEdit`, exposes the touch reorder toolbar control, and connects the feature lifecycle. SortableJS orchestration, editor DOM resolution, runtime loading, drag-only DOM decoration, and deterministic row-order logic should live in focused modules inside the same `table-reorder` feature directory.

The refactor must not change the user-visible interaction model. In particular, iframe and non-iframe editors, hover handles, touch long-press dragging, `rowspan` restrictions, insertion feedback, SortableJS animation and auto-scroll, and the DOM ownership handoff back to Gutenberg must continue to behave as they do before the refactor.

## Scope

### Included

- Split the responsibilities currently concentrated in `with-table-reorder.tsx`.
- Add focused Jest tests that establish a baseline for deterministic row-reorder and `rowspan` behavior before larger structural changes.
- Keep tests beside the modules they verify.
- Extract deterministic row-order helpers from the React/Gutenberg integration layer.
- Localize iframe / non-iframe Table DOM resolution.
- Localize SortableJS runtime loading into the target editor `window`.
- Localize drag-only DOM decoration and restoration.
- Move SortableJS lifecycle orchestration behind a focused controller boundary.
- Move React state/effect lifecycle into a custom hook only after the lower-level boundaries are stable.
- Keep `with-table-reorder.tsx` as the thin Gutenberg integration and rendering boundary.
- Update the feature README after the final source layout is established.

### Not included

- New Table Reorder features.
- Interaction, UI, timing, animation, auto-scroll, or notification changes.
- Replacing SortableJS.
- Changing the Core Table block save format or attribute shape.
- Reworking the existing `rowspan` rules.
- Introducing a generic `shared/`, `utils/`, or `helpers/` layer.
- Introducing a state machine or another state-management library.
- Creating abstractions for hypothetical future reuse.
- Splitting every helper into a separate file solely to reduce line count.
- Adding new Playwright coverage as a prerequisite for this refactor. Existing E2E coverage may be run when useful, but the baseline for this work is focused Jest coverage plus the existing manual editor verification matrix.

## Current responsibilities

`with-table-reorder.tsx` currently owns or coordinates all of the following responsibilities:

1. Gutenberg `BlockEdit` wrapping and Table block filtering.
2. Hover-capability detection and touch reorder mode state.
3. Anchor DOM ownership and target block lookup.
4. iframe / non-iframe editor DOM resolution.
5. `table` / `tbody` lookup.
6. SortableJS runtime URL lookup and target-window script loading.
7. `rowspan` range, non-movable-row, and forbidden-insertion calculations.
8. Hover handle creation, visibility, event propagation, and cell-style restoration.
9. Touch-mode cell editing suppression and non-movable-row decoration.
10. Insertion-line creation, positioning, visibility, and cleanup.
11. Fallback drag cell-width fixing and restoration.
12. Gutenberg block drag suppression and restoration.
13. Touch press tracking, long-press timing, movement threshold, and warning notification.
14. SortableJS `onChoose`, `onStart`, `onMove`, `onEnd`, and `onUnchoose` orchestration.
15. Temporary DOM reorder restoration before Gutenberg attribute commit.
16. `setAttributes({ body })` commit.
17. Event-listener, style, SortableJS, and DOM-node cleanup.
18. Touch toolbar rendering.

The problem is not that these behaviors exist, but that their ownership and lifecycle are concentrated in one React effect and one module. This makes later changes harder to reason about and makes focused tests unnecessarily difficult.

## Approach

Use incremental extraction rather than a rewrite.

Each phase should preserve behavior and keep the extension runnable. Move an existing responsibility to a focused owner, keep its public surface narrow, validate that phase, and only then continue to the next boundary.

Prefer concrete feature-local modules over generic abstractions. A new file should exist because the current implementation has a distinct responsibility that benefits from an explicit owner.

The dependency direction should remain simple:

```text
index.tsx
  ↓
with-table-reorder.tsx
  ↓
use-table-reorder.ts
  ↓
sortable-controller.ts
  ├─ table-context.ts
  ├─ sortable-runtime.ts
  ├─ drag-ui.ts
  ├─ row-order.ts
  └─ rowspan.ts
```

The exact imports may be slightly flatter than this diagram where appropriate, but lower-level modules must not import React/Gutenberg integration code merely to share state.

## Architecture

### `index.tsx`

Responsibility:

- Register `withTableReorder` with `editor.BlockEdit`.

Keep this file unchanged except for import-path adjustments if needed.

### `with-table-reorder.tsx`

Responsibility after the refactor:

- Filter to `core/table`.
- Render the wrapped `BlockEdit`.
- Render the touch-mode `BlockControls` / `ToolbarButton`.
- Render the hidden anchor used to locate the owning editor document.
- Call the Table Reorder hook and pass the minimum required Gutenberg props.

It should not directly create DOM nodes, load SortableJS, track pointer sessions, or implement SortableJS callbacks.

### `use-table-reorder.ts`

Responsibility:

- Own React-facing Table Reorder lifecycle.
- Own hover capability state.
- Own touch reorder mode state and selected-block synchronization.
- Create and destroy the lower-level reorder controller when the feature is active.
- Bridge WordPress notices and `setAttributes` into narrow callbacks used by the controller.

It should not contain low-level DOM decoration helpers or script-loading implementation.

### `row-order.ts`

Responsibility:

- Reorder an immutable row array from `oldIndex` to `newIndex`.
- Calculate the insertion index used by SortableJS move/end events where that calculation is deterministic and independent of React state.
- Restore a captured DOM row order when SortableJS has temporarily moved rows, if keeping that helper beside row-order semantics remains clearer than placing it in `drag-ui.ts`.

Pure data transforms must not depend on WordPress or React.

### `rowspan.ts`

Responsibility:

- Keep the existing `rowspan` range parsing.
- Keep non-movable-row calculations.
- Keep forbidden-insertion-index calculations.

Do not redesign this module as part of the refactor.

### `table-context.ts`

Responsibility:

- Resolve the Table block element from `clientId` starting from the anchor's owning document.
- Fall back to `iframe[name="editor-canvas"]` when the block is not in the root document.
- Return the resolved `blockElement`, owning `document`, owning `window`, `table`, and first `tbody` as one context object.
- Return `null` when the required context cannot be resolved.

This is the explicit iframe / non-iframe boundary. Callers should use the returned owning document/window rather than reaching back to the parent `window` for editor-canvas work.

### `sortable-runtime.ts`

Responsibility:

- Reuse `window.Sortable` when already available.
- Reuse an existing runtime script element when loading is already in progress.
- Insert the configured SortableJS runtime script into the resolved editor document when necessary.
- Resolve to the runtime or `null` on load failure.

This module should not know about Gutenberg block attributes or React state.

### `drag-ui.ts`

Initial responsibility:

- Create/show/hide/remove the insertion line.
- Add/remove hover handles and restore modified first-cell styles.
- Toggle handle visibility.
- Suppress touch cell editing and restore it.
- Add/remove touch chosen styling where still required.
- Fix fallback drag cell widths and restore them.
- Hold other short-lived DOM decoration helpers whose only purpose is visual/interaction support during drag.

Do not immediately split this file further. Only introduce `hover-handles.ts`, `insertion-line.ts`, `touch-ui.ts`, or similar modules later if `drag-ui.ts` itself develops multiple independently changing responsibilities.

### `sortable-controller.ts`

Responsibility:

- Create/destroy the SortableJS instance.
- Coordinate drag start, move, end, and unchoose behavior.
- Own drag-session mutable state that does not need React rendering.
- Suppress and restore Gutenberg block dragging while a row drag owns the pointer.
- Coordinate hover-handle activation/deactivation.
- Coordinate touch press tracking and long-press warning behavior.
- Reject forbidden `rowspan` insertion positions.
- Capture the original row DOM order at drag start.
- Restore the original DOM order before committing the reordered `body`.
- Call a narrow `onCommit(reorderedBody)` callback instead of importing Gutenberg APIs directly.
- Clean up every listener, DOM decoration, timeout, and temporary style created by the controller.

The controller is the imperative integration boundary around SortableJS. It should return a single cleanup/destroy entry point to the React layer.

### `constants.ts` and `types.ts`

These files are optional, not mandatory scaffolding.

Create `constants.ts` only if the extraction leaves mode-independent constants shared by multiple real modules. Keep a constant with its owning module when only that module uses it.

Create `types.ts` only if multiple extracted modules genuinely need the same feature-specific types and keeping those types with their natural owner would introduce a cycle or unclear ownership.

## DOM ownership invariant

The existing DOM ownership handoff is a compatibility requirement and must remain explicit throughout the refactor:

```text
Gutenberg renders canonical <tbody><tr> DOM
        ↓
SortableJS temporarily moves <tr> nodes during drag
        ↓
onEnd captures old/new positions
        ↓
original <tr> DOM order is restored
        ↓
reordered body is committed through setAttributes()
        ↓
Gutenberg renders the new canonical DOM order
```

Do not let the extracted controller treat SortableJS-mutated DOM as the persisted source of truth.

## Implementation phases

### Phase 0: Establish the Jest baseline and first testing seam

Outcome:

- Deterministic behavior has focused unit coverage before the larger lifecycle extraction begins.

Tasks:

- Add `rowspan.test.ts` beside `rowspan.ts`.
- Cover no-rowspan, numeric/string rowspan, invalid values, end clamping, overlapping ranges, non-movable rows, and forbidden insertion indices.
- Extract only the deterministic row-order helpers needed for focused testing from `with-table-reorder.tsx` into `row-order.ts`.
- Add `row-order.test.ts` in the same change.
- Cover upward/downward reorder, equal index, invalid indices, immutability, move insertion index, and end insertion index.
- Keep this extraction deliberately small; do not move React lifecycle or SortableJS setup yet.

Validation:

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`

### Phase 1: Extract editor Table context resolution

Outcome:

- iframe / non-iframe lookup has one explicit owner.

Tasks:

- Add `table-context.ts`.
- Move `findBlockElement` and related document/window/table/tbody resolution into the module.
- Make the returned context the source of editor-canvas DOM ownership for later phases.
- Add focused jsdom tests where they provide stable value, especially direct-document resolution, iframe fallback, and unresolved context.

Validation:

- Focused Jest tests while iterating.
- `npm test`, `npm run build`, and repository diff check before handoff.

### Phase 2: Extract SortableJS runtime loading

Outcome:

- Runtime loading is independent from React and Gutenberg attribute updates.

Tasks:

- Add `sortable-runtime.ts`.
- Move the script ID and runtime-loading implementation out of the HOC.
- Preserve existing-runtime, existing-script, load, and error behavior.
- Keep the runtime attached to the target editor `window`, including iframe editors.
- Add focused tests only where the async script behavior can be tested without over-mocking browser behavior.

Validation:

- `npm test`
- `npm run build`
- Repository diff check.

### Phase 3: Extract drag-only DOM UI helpers

Outcome:

- Temporary DOM decoration and restoration no longer obscure SortableJS lifecycle code.

Tasks:

- Add `drag-ui.ts`.
- Move insertion-line helpers.
- Move hover-handle creation/visibility/restoration.
- Move touch editing suppression/chosen styling.
- Move fallback cell-width fixing/restoration.
- Keep cleanup paired with creation so every helper has an obvious restoration path.
- Add DOM-focused Jest tests for high-value invariants such as restoration of modified inline styles and omission of handles on non-movable rows.

Validation:

- `npm test`
- `npm run build`
- Repository diff check.

### Phase 4: Extract the SortableJS controller

Outcome:

- SortableJS imperative behavior has one lifecycle owner and the React layer no longer implements drag callbacks directly.

Tasks:

- Add `sortable-controller.ts`.
- Move SortableJS options and callbacks into the controller.
- Move drag rows, active handle, drag suppression, touch press, timeout, and cleanup mutable state with the controller.
- Accept resolved context and calculated constraints as inputs.
- Accept narrow callbacks for commit and user notice behavior.
- Preserve the DOM ownership invariant before every successful commit.
- Ensure `destroy()` is safe after partial async initialization and prevents a late runtime load from creating a stale SortableJS instance.

Validation:

- `npm test`
- `npm run build`
- Manual smoke check is recommended at this boundary because lifecycle ownership changes materially here.
- Repository diff check.

### Phase 5: Introduce the React lifecycle hook

Outcome:

- React state/effects have a focused owner and the HOC becomes thin.

Tasks:

- Add `use-table-reorder.ts`.
- Move hover capability detection and media-query lifecycle.
- Move touch reorder mode state and selected-block reset.
- Resolve runtime URL and Table context through the extracted modules.
- Create/destroy the SortableJS controller from the effect.
- Keep the WordPress notice and attribute APIs at this adapter boundary.
- Return only the values/callbacks needed by `with-table-reorder.tsx`.

Validation:

- `npm test`
- `npm run build`
- Repository diff check.

### Phase 6: Thin the HOC and finalize source ownership

Outcome:

- `with-table-reorder.tsx` is primarily a Gutenberg composition/rendering boundary.

Tasks:

- Remove implementation helpers and imperative lifecycle code that now belong to extracted modules.
- Keep `BlockEdit`, toolbar rendering, hidden anchor, and hook wiring readable in one pass.
- Review constants/types and create shared feature-local files only where current cross-module usage justifies them.
- Remove dead local types or duplicated helpers exposed by the extraction.
- Update `src/editor-extensions/table-reorder/README.md` with the final file layout and responsibility boundaries.

Validation:

- `npm test`
- `npm run build`
- `git diff --check origin/main...HEAD`
- Final manual verification matrix below.

## Decisions and validation questions

### Decide before implementation

- Keep the current SortableJS behavior and timings unchanged unless a separate bug is discovered and tracked separately.
- Keep all new modules inside `src/editor-extensions/table-reorder/`.
- Keep `rowspan.ts` as the existing constraint owner rather than merging it into the controller.
- Use incremental extraction rather than a rewrite.
- Make Jest characterization coverage the first implementation phase.
- Do not require new Playwright tests before starting this refactor.
- Do not create `constants.ts` / `types.ts` unless actual cross-module ownership requires them.

### Validate during implementation

- Whether `restoreOriginalRowOrder` is clearer in `row-order.ts` or `drag-ui.ts` once controller extraction makes its callers visible.
- Whether all touch pointer tracking belongs in `sortable-controller.ts` or whether a distinct touch-only module becomes justified by size and independent change pressure.
- Whether `drag-ui.ts` remains cohesive after extraction or later deserves one additional split.
- Whether the existing local `sortablejs.d.ts` remains the clearest type source after runtime/controller extraction.
- Whether any `useEffect` dependency currently causes unnecessary controller recreation after the responsibilities are separated.

These are implementation observations, not reasons to redesign the feature in advance.

## Issue breakdown

Create implementation issues only after this plan has been reviewed and the boundaries are stable.

Suggested implementation units:

- [ ] Jest baseline + `row-order.ts` extraction.
- [ ] `table-context.ts` + `sortable-runtime.ts` extraction.
- [ ] `drag-ui.ts` extraction.
- [ ] `sortable-controller.ts` extraction.
- [ ] `use-table-reorder.ts` + thin HOC + README finalization.

The first two units may be combined or separated depending on review size. Do not split work merely to match this list if a smaller number of coherent PRs is easier to review.

## Validation

### Automated

For implementation changes:

```bash
npm test
npm run build
git diff --check origin/main...HEAD
```

Focused Jest commands may be used while iterating, but the full Node.js quality gate and production build are required before implementation handoff.

For this plan-only documentation PR, the repository testing guide requires only the repository diff/whitespace check. If work is performed through a GitHub connector without a local checkout, verify the PR diff through GitHub and state that the local `git diff --check` command was unavailable rather than claiming it ran.

### Manual editor verification after implementation

Verify the current behavior in both editor modes:

```text
Desktop / hover-capable
├─ iframe
└─ non-iframe

Touch / long-press reorder mode
├─ iframe
└─ non-iframe
```

For each applicable mode, verify:

- Normal Table row can move upward.
- Normal Table row can move downward.
- Hover handle appears only for movable rows on hover-capable devices.
- Touch reorder mode enables long-press drag and a short tap exits the mode as before.
- `rowspan`-participating rows cannot be dragged.
- Insertion positions that split a vertical merged range are rejected.
- Warning notification still appears for long-press on a non-movable merged row.
- Insertion line appears at valid destinations and disappears for forbidden destinations/end/cancel.
- SortableJS animation and auto-scroll remain unchanged.
- Fallback dragged row keeps stable cell widths and restores temporary inline styles afterward.
- Gutenberg block dragging is restored after row drag/cancel/cleanup.
- Reordered data persists through `setAttributes({ body })` and the DOM remains owned by Gutenberg after commit.
- Selecting away from the block disables touch reorder mode as before.

## Completion criteria

- Focused Jest coverage protects the deterministic row-order and `rowspan` rules.
- `with-table-reorder.tsx` no longer owns low-level DOM helper implementations or SortableJS callback bodies.
- iframe / non-iframe resolution has one explicit source owner.
- SortableJS runtime loading has one explicit source owner.
- Temporary drag DOM decoration has clear creation/restoration ownership.
- SortableJS lifecycle and cleanup have one imperative controller owner.
- React/Gutenberg integration remains a thin adapter around that controller.
- No user-visible behavior is intentionally changed.
- No new generic shared architecture or dependency is introduced.
- Automated validation succeeds.
- Manual iframe / non-iframe and hover / touch verification succeeds.
- Feature README matches the final code structure.

## Notes

- The current feature README defines the Gutenberg-to-SortableJS DOM ownership handoff. Treat it as a core invariant during every phase.
- The historical `table-reorder-controller-refactor-plan.md` targeted a different dnd-kit architecture. Do not modify that historical document to describe the new SortableJS implementation; this plan supersedes it for future responsibility refactoring.
- If a behavior bug is discovered while extracting responsibilities, record it separately unless fixing it is required to keep the refactor buildable or testable. Avoid mixing product behavior changes into structural PRs.
