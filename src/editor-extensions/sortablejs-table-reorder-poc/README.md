# SortableJS Table Reorder PoC

This is an intentionally small proof of concept for replacing the **pointer DnD + external Portal handle + row-position tracking** part of Table Reorder with SortableJS.

It is not production code and does not attempt to reproduce the previous keyboard reorder UI, announcements, or every accessibility behavior.

## What this PoC is testing

- The Gutenberg-owned `<tbody><tr>` elements can be temporarily sorted by SortableJS.
- The same implementation locates the selected Table from its owning `document` in both iframe and non-iframe editors.
- SortableJS is initialized in the `window` that owns the target Table, rather than assuming the top-level editor window.
- PC / fine-pointer environments expose one inline handle only while its row-start gutter is hovered.
- Touch / hover-unavailable environments keep the toolbar reorder mode but do not add row handles or a 32px gutter.
- In touch reorder mode, a movable row starts DnD after a short long press.
- A normal tap in touch reorder mode exits the mode and returns to cell editing.
- Rows participating in a vertical `rowspan` merge are not draggable.
- Long-pressing a `rowspan` row on touch shows a snackbar instead of silently doing nothing.
- Insertion positions inside a `rowspan` range remain forbidden while normal rows may cross the whole merged range.
- PC and touch modes share the same SortableJS row-DnD implementation and `body` update path.
- No row `top / left / width / height` tracking is used.
- No `ResizeObserver` or scroll listener is used for handle positioning.
- SortableJS supplies the pointer sorting animation.
- A small local reorder helper commits the reordered `body` attribute.
- At drag end, the temporary DOM order is restored **before** `setAttributes()` is called, handing DOM ownership back to Gutenberg.

## Files

```text
sortablejs-table-reorder-poc/
├─ index.tsx
├─ rowspan.ts
├─ sortablejs.d.ts
├─ with-sortablejs-table-reorder-poc.tsx
└─ README.md
```

The local `sortablejs.d.ts` intentionally declares only the small API surface used by this PoC, so installing `@types/sortablejs` is not required for the experiment.

## Build integration

The PoC is built directly from:

```text
src/editor-extensions/sortablejs-table-reorder-poc/index.tsx
```

`webpack.config.js` also emits the npm-provided `sortablejs/Sortable.min.js` runtime into the PoC build directory. `yamabiko-editor-tools.php` enqueues the PoC entry directly and exposes that local runtime URL to the editor script.

Run:

```bash
logcut npm run test
logcut npm run build
```

Or use `npm start` if that is your normal local workflow.

## How to use

### PC / mouse

1. Open a Core Table block with body rows.
2. Move the pointer into the 32px gutter at the inline start of a movable body row.
3. Only that row's handle fades in.
4. Drag from the gutter / handle area to reorder the row.
5. Leaving the gutter hides the handle again.

A separate reorder mode is intentionally not required for fine-pointer environments. Rows participating in a vertical `rowspan` merge do not expose a handle.

### Touch / hover unavailable

1. Select a Core Table block with body rows.
2. Normal editing starts without row handles or an additional gutter.
3. Use the reorder icon in the block toolbar to turn reorder mode on.
4. The Table layout remains unchanged while reorder mode is on.
5. Long-press a movable row for about 300ms, then drag vertically to reorder it.
6. A normal tap exits reorder mode and returns to cell editing.
7. Long-pressing a row that participates in a vertical `rowspan` merge does not start DnD and shows: `縦結合を含む行は並び替えできません。`
8. Turn the reorder toggle off to leave reorder mode explicitly.

Reorder mode is also cleared when the Table block is deselected.

## iframe and non-iframe editor check

The PoC deliberately avoids separate drag-and-drop implementations.

The selected block is resolved with this rule:

1. Look for `[data-block="<clientId>"]` in the React anchor's owning `document`.
2. If it is not there, look for the same block in `iframe[name="editor-canvas"]`.
3. Once the block is found, use `blockElement.ownerDocument` and that document's `defaultView` for the Table, handles, and SortableJS runtime.

This keeps the SortableJS setup identical after the target Table has been found. Non-iframe support therefore does not require row-coordinate monitoring, Portal handles, or a second DnD implementation.

When manually validating iframe and non-iframe editors, confirm these Issue #159 points:

- PC / mouse shows only the hovered movable-row handle and can drag directly from the gutter;
- PC `rowspan` rows remain handle-free;
- touch / hover-unavailable normal mode has no handles and preserves normal editing / scrolling;
- touch reorder mode does not change the Table width or add a first-column gutter;
- a movable row starts DnD only after the long-press delay;
- a normal tap exits touch reorder mode and returns to editing;
- long-pressing either row in a two-row vertical merge shows the snackbar and does not start DnD;
- the same 150ms SortableJS push-aside animation runs in both input modes;
- insertion inside a `rowspan` range remains forbidden while crossing the whole range remains possible;
- `oldIndex` / `newIndex` result in the expected row order;
- after drop, Gutenberg's `attributes.body` and rendered order match;
- iframe and non-iframe do not use separate DnD implementations.

## What to inspect

The important questions are not feature completeness. Inspect these instead:

1. Does PC hover make the drag affordance easy to discover without adding persistent UI?
2. Does touch normal mode remain natural for cell editing and scrolling?
3. Does touch reorder mode preserve the Table layout on narrow screens?
4. Does the 300ms long press distinguish row DnD from a normal tap and ordinary scrolling well enough?
5. Does a `rowspan` long press give clear feedback without starting DnD?
6. Does the row push-aside animation feel stable in both input modes?
7. Does full-width Table work without special width shrinking?
8. Does scrolling during drag remain stable without handle-position tracking?
9. After drop, does Gutenberg render the committed row order without flicker or stale DOM?
10. Does the approach behave in both iframe and non-iframe editor versions you support?

## Deliberately out of scope

- Final toolbar wording, icon, and visual polish.
- Keyboard reorder interaction.
- `aria-live` announcements.
- Focus restoration.
- Final snackbar wording / styling.
- Exact visual parity with the previous dnd-kit `DragOverlay`.
- E2E tests.

If the pointer PoC is stable, keyboard interaction should be designed separately rather than forcing the pointer handle to also be the keyboard control.

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

This is the central experiment. If this handoff is stable, much of the previous external-handle positioning layer becomes unnecessary.
