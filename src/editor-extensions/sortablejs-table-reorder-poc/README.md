# SortableJS Table Reorder PoC

This is an intentionally small proof of concept for replacing the **pointer DnD + external Portal handle + row-position tracking** part of Table Reorder with SortableJS.

It is not production code and does not attempt to reproduce the current keyboard reorder UI, hover mode, announcements, or every accessibility behavior.

This PoC branch is intentionally SortableJS-only. The stopped dnd-kit implementation is kept in Git history rather than under a backup source directory.

## What this PoC is testing

- The Gutenberg-owned `<tbody><tr>` elements can be temporarily sorted by SortableJS.
- The first body cell exposes an inline drag handle.
- No external Portal handle is created.
- No row `top / left / width / height` tracking is used.
- No `ResizeObserver` or scroll listener is used for handle positioning.
- SortableJS supplies the pointer sorting animation.
- The PoC commits the reordered Gutenberg `attributes.body` at drag end.
- At drag end, the temporary DOM order is restored **before** `setAttributes()` is called, handing DOM ownership back to Gutenberg.
- The pure `rowspan.ts` constraint helper and its unit test are retained for PoC #149, but are not wired into SortableJS until that issue is implemented.

## Files

```text
sortablejs-table-reorder-poc/
├─ index.tsx
├─ rowspan.test.ts
├─ rowspan.ts
├─ sortablejs.d.ts
├─ with-sortablejs-table-reorder-poc.tsx
└─ README.md
```

The local `sortablejs.d.ts` intentionally declares only the small API surface used by this PoC, so installing `@types/sortablejs` is not required for the experiment.

## Integration in this branch

`webpack.config.js` builds the PoC directly as:

```text
build/editor-extensions/sortablejs-table-reorder-poc/index.js
```

`yamabiko-editor-tools.php` enqueues that PoC build directly. The npm-provided SortableJS runtime is emitted as:

```text
build/editor-extensions/sortablejs-table-reorder-poc/sortable.min.js
```

The old `src/editor-extensions/table-reorder` entry point and content stylesheet are not part of this branch's PoC runtime.

## Verification

Run the repository checks locally:

```bash
logcut npm run test
logcut npm run build
```

Or use `npm start` for the normal local development loop.

For manual PoC verification:

1. Select a Core Table block with body rows.
2. The PoC activates automatically while that Table block is selected.
3. The first body cell of each movable row gets a drag handle.
4. Drag from that handle.
5. Dragging from the editable text area should continue to behave as normal cell editing.

The automatic activation is intentional for this PoC. It removes toolbar/state wiring from the experiment so it is immediately obvious whether the SortableJS DOM integration is running.

## What to inspect

The important questions are not feature completeness. Inspect these instead:

1. Does the row push-aside animation feel as good as the stopped dnd-kit implementation?
2. Does cell editing remain natural, especially in the first column?
3. Does full-width Table work without special width shrinking?
4. Does scrolling during drag remain stable without handle-position tracking?
5. After drop, does Gutenberg render the committed row order without flicker or stale DOM?
6. Do Undo / Redo work normally after `setAttributes()`?
7. Does the approach behave in both iframe and non-iframe editor contexts covered by the remaining PoCs?

`rowspan` constraints are intentionally handled by PoC #149. The helper is retained here so that validation can be wired without restoring the old dnd-kit implementation.

## Deliberately out of scope

- Current keyboard reorder interaction.
- `aria-live` announcements.
- Focus restoration.
- Hover-to-show handles.
- Snackbar messages for forbidden rowspan moves.
- Exact visual parity with the dnd-kit `DragOverlay`.
- E2E tests.

If the pointer PoC is stable, keyboard interaction should be designed separately rather than forcing the pointer drag handle to also be the keyboard control.

## Why the DOM is restored before commit

SortableJS physically moves `<tr>` nodes during a drag. Gutenberg/React still owns those nodes conceptually.

The PoC therefore uses this ownership handoff:

```text
Gutenberg renders original DOM
        ↓
SortableJS temporarily moves <tr> nodes during drag
        ↓
onEnd receives the destination index
        ↓
PoC restores original <tr> DOM order
        ↓
setAttributes({ body: reorderedBody })
        ↓
Gutenberg renders the new canonical DOM order
```

This is the central experiment. If this handoff is stable, much of the current external-handle positioning layer becomes unnecessary.
