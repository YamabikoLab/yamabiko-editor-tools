# Table Reorder

Table Reorder extends the Core Table block with row reordering powered by SortableJS.

## Implementation overview

- SortableJS temporarily reorders Gutenberg-owned `<tbody><tr>` elements during dragging.
- The selected Table is resolved from its owning `document`, so the same implementation works in iframe and non-iframe editors.
- SortableJS is initialized in the `window` that owns the target Table.
- On hover-capable devices, an inline handle in the first cell starts dragging without an external Portal handle.
- On touch devices, reorder mode enables long-press dragging.
- Rows involved in vertical merges (`rowspan`) cannot be moved, and insertion positions that would split a merged range are rejected.
- An insertion line shows the destination while dragging.
- At drag end, the temporary DOM order is restored before `setAttributes()` commits the reordered `body`, returning DOM ownership to Gutenberg.
- SortableJS provides the sorting animation and auto-scroll behavior.

## Files

```text
table-reorder/
├─ index.tsx
├─ rowspan.ts
├─ sortablejs.d.ts
├─ with-table-reorder.tsx
└─ README.md
```

The local `sortablejs.d.ts` declares only the SortableJS API surface used by this extension.

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
