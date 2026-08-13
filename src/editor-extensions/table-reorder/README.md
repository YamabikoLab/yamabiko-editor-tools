# Table Reorder

Table Reorder extends the Core Table block with row reordering powered by SortableJS.

## Implementation overview

- `with-table-reorder.tsx` is the thin Gutenberg composition and rendering adapter.
- `use-table-reorder.ts` owns React state / effect lifecycle and connects the adapter to the SortableJS controller.
- `controller/sortable-controller.ts` owns the imperative SortableJS instance and drag session lifecycle.
- SortableJS temporarily reorders Gutenberg-owned `<tbody><tr>` elements during dragging.
- The selected Table is resolved from its owning `document`, so the same implementation works in iframe and non-iframe editors.
- SortableJS is initialized in the `window` that owns the target Table.
- On hover-capable devices, hovering a movable row reveals an inline handle at the left edge of the first cell. Dragging starts only from that handle, not from the row itself.
- On touch devices, reorder mode shows the same row controls. Tapping a handle starts destination selection, while dragging the handle starts SortableJS DnD. Long-pressing a row does not start DnD.
- Touch cell taps remain available for normal editing, and scrolling outside the row handles is not intercepted by Table Reorder.
- Rows involved in vertical merges (`rowspan`) cannot be moved, and insertion positions that would split a merged range are rejected.
- An insertion line shows the destination while dragging.
- At drag end, the temporary DOM order is restored before `setAttributes()` commits the reordered `body`, returning DOM ownership to Gutenberg.
- SortableJS provides the sorting animation and auto-scroll behavior.

## Files and responsibilities

```text
table-reorder/
├─ index.tsx
├─ with-table-reorder.tsx
├─ use-table-reorder.ts
├─ messages.ts
├─ editor.scss
├─ controller/
│  ├─ sortable-controller.ts
│  ├─ sortable-controller.test.ts
│  ├─ sortable-controller-keyboard.test.ts
│  ├─ sortable-controller-pointer.test.ts
│  ├─ reorder-ui.ts
│  ├─ reorder-ui.test.ts
│  ├─ drag-ui.ts
│  ├─ drag-ui.test.ts
│  ├─ row-order.ts
│  ├─ row-order.test.ts
│  ├─ sortable-runtime.ts
│  └─ sortable-runtime.test.ts
├─ table-context.ts
├─ table-context.test.ts
├─ rowspan.ts
├─ rowspan.test.ts
└─ README.md
```

Responsibility boundaries:

- `index.tsx`: registers the HOC with `editor.BlockEdit` and loads the editor styles.
- `with-table-reorder.tsx`: identifies `core/table`, renders the original `BlockEdit`, renders touch reorder controls, and provides the hidden anchor used to locate the Table DOM.
- `use-table-reorder.ts`: owns hover capability state, touch reorder mode state, selection reset, media-query lifecycle, Table context resolution, constraint calculation, and controller creation / destruction. WordPress notices and `setAttributes()` remain at this React / Gutenberg adapter boundary and are passed to the controller as narrow callbacks.
- `controller/sortable-controller.ts`: owns SortableJS callbacks, movable-row hover detection, keyboard / single-pointer sessions, mutable drag session state, temporary block-drag suppression, DOM ownership handoff, and controller cleanup. PC and touch both configure SortableJS with the shared row-control handle, so rows themselves are never drag-start areas.
- `controller/reorder-ui.ts`: owns the shared row controls and destination-selection UI used by mouse, touch, and keyboard interaction.
- `table-context.ts`: resolves the Table block and its owning `document`, `window`, `table`, and `tbody`, including iframe fallback.
- `controller/sortable-runtime.ts`: loads or reuses the SortableJS runtime in the owning editor window.
- `controller/drag-ui.ts`: owns short-lived drag UI and restoration, including the insertion line and fallback row widths.
- `controller/row-order.ts`: owns deterministic row reordering, movement validation, insertion index calculation, valid destination calculation, and restoration of the original DOM row order.
- `rowspan.ts`: owns vertical-merge range analysis and movement / insertion restrictions.
- `messages.ts`: owns translated Table Reorder messages and accessible labels.
- `editor.scss`: owns editor-side presentation for row controls and destination-selection UI.

The former `controller/touch-press.ts` long-press tracker is no longer needed. Touch DnD uses the same handle boundary as PC, so cell taps and normal table scrolling do not require a separate press tracker or touch-mode pointer-event suppression.

The dependency direction stays from the Gutenberg / React boundary toward lower-level modules. Lower-level modules do not depend on the HOC or custom hook.

## Build integration

The extension entry is:

```text
src/editor-extensions/table-reorder/index.tsx
```

`webpack.config.js` emits the npm-provided `sortablejs/Sortable.min.js` runtime into the Table Reorder build directory. `yamabiko-editor-tools.php` enqueues the editor entry and exposes the local runtime URL to the editor script.

Run:

```bash
logcut npm run test
logcut npm run build
```

## iframe and non-iframe editors

The block is resolved with this rule:

1. Look for `[data-block="<clientId>"]` in the React anchor's owning `document`.
2. If it is not there, look for the same block in `iframe[name="editor-canvas"]`.
3. Once found, use `blockElement.ownerDocument` and that document's `defaultView` for the Table and SortableJS runtime.

This keeps one drag-and-drop implementation for both editor modes.

## DOM ownership handoff

SortableJS physically moves `<tr>` nodes while dragging, but Gutenberg/React remains the canonical owner of those nodes.

```text
Gutenberg renders canonical DOM
        ↓
SortableJS temporarily moves <tr> nodes during drag
        ↓
onEnd receives the destination index
        ↓
Original <tr> DOM order is restored
        ↓
setAttributes({ body: reorderedBody })
        ↓
Gutenberg renders the new canonical DOM order
```
