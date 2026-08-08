# SortableJS Table Reorder PoC

This is an intentionally small proof of concept for replacing the **pointer DnD + external Portal handle + row-position tracking** part of Table Reorder with SortableJS.

It is not production code and does not attempt to reproduce the current keyboard reorder UI, hover mode, announcements, or every accessibility behavior.

## What this PoC is testing

- The Gutenberg-owned `<tbody><tr>` elements can be temporarily sorted by SortableJS.
- The first body cell exposes a 32px inline-start gutter as the drag area.
- No external Portal handle is created.
- No row `top / left / width / height` tracking is used.
- No `ResizeObserver` or scroll listener is used for handle positioning.
- SortableJS supplies the pointer sorting animation.
- The existing `rowspan.ts` restrictions are reused.
- The existing `reorder.ts` function remains the source of truth for the committed `body` update.
- At drag end, the temporary DOM order is restored **before** `setAttributes()` is called, handing DOM ownership back to Gutenberg.

## Files

```text
sortablejs-table-reorder-poc/
├─ index.tsx
├─ sortablejs.d.ts
├─ with-sortablejs-table-reorder-poc.tsx
└─ README.md
```

The local `sortablejs.d.ts` intentionally declares only the small API surface used by this PoC, so installing `@types/sortablejs` is not required for the experiment.

## Install

Place this folder at:

```text
src/editor-extensions/sortablejs-table-reorder-poc/
```

Install SortableJS:

```bash
npm install sortablejs@1.15.7 --save
```

## Fastest way to test it

The existing repository already builds and enqueues:

```text
src/editor-extensions/table-reorder/index.tsx
```

For an isolated comparison, temporarily replace that file with:

```ts
import '../sortablejs-table-reorder-poc';
```

This intentionally disables the current dnd-kit Table Reorder implementation while reusing the existing webpack/PHP entry point. It avoids changing `webpack.config.js` and `yamabiko-editor-tools.php` just for the PoC.

Then run:

```bash
logcut npm run test
logcut npm run build
```

Or use `npm start` if that is your normal local workflow.

After the experiment, restore the original `table-reorder/index.tsx`.

## How to use

1. Select a Core Table block with body rows.
2. The PoC activates automatically while that Table block is selected.
3. The first body cell of each movable row gets a 32px drag gutter at its inline-start edge.
4. Drag from that gutter.
5. Dragging from the editable text area should continue to behave as normal cell editing.

The automatic activation is intentional for this PoC. It removes toolbar/state wiring from the experiment so it is immediately obvious whether the SortableJS DOM integration is running.

The gutter uses `padding-inline-start` / `inset-inline-start`, so the same PoC can also be observed in RTL layout.

## What to inspect

The important questions are not feature completeness. Inspect these instead:

1. Does the row push-aside animation feel as good as the current implementation?
2. Does cell editing remain natural, especially in the first column?
3. Does full-width Table work without special width shrinking?
4. Does scrolling during drag remain stable without handle-position tracking?
5. After drop, does Gutenberg render the committed row order without flicker or stale DOM?
6. Do Undo / Redo work normally after `setAttributes()`?
7. Are rows participating in vertical `rowspan` prevented from invalid moves?
8. Does the approach behave in the iframe editor versions you support?

## Deliberately out of scope

- Current keyboard reorder interaction.
- `aria-live` announcements.
- Focus restoration.
- Hover-to-show handles.
- Snackbar messages for forbidden rowspan moves.
- Exact visual parity with the dnd-kit `DragOverlay`.
- E2E tests.

If the pointer PoC is stable, keyboard interaction should be designed separately rather than forcing the pointer drag gutter to also be the keyboard control.

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
