# Table Reorder

Table Reorder extends the Core Table block with row reordering powered by SortableJS.

## Implementation overview

- Gutenberg-owned `<tbody><tr>` elements are temporarily sorted by SortableJS during pointer dragging.
- The selected Table is resolved from its owning `document`, so the same implementation works in iframe and non-iframe editors.
- SortableJS is initialized in the `window` that owns the target Table.
- The first body cell provides an inline drag handle without an external Portal handle.
- No row `top / left / width / height` tracking, `ResizeObserver`, or scroll listener is required for handle positioning.
- SortableJS supplies the pointer sorting animation.
- At drag end, the temporary DOM order is restored before `setAttributes()` commits the reordered `body`, returning DOM ownership to Gutenberg.
- Rows participating in vertical merges (`rowspan`) are not movable, and insertion into a `rowspan` range is blocked.

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

The extension is built from:

```text
src/editor-extensions/table-reorder/index.tsx
```

`webpack.config.js` emits the npm-provided `sortablejs/Sortable.min.js` runtime into the Table Reorder build directory. `yamabiko-editor-tools.php` enqueues the editor entry and exposes the local runtime URL to the editor script.

Run:

```bash
logcut npm run test
logcut npm run build
```

Or use `npm start` for the normal local development workflow.

## iframe and non-iframe editors

The block is resolved with this rule:

1. Look for `[data-block="<clientId>"]` in the React anchor's owning `document`.
2. If it is not there, look for the same block in `iframe[name="editor-canvas"]`.
3. Once found, use `blockElement.ownerDocument` and that document's `defaultView` for the Table, handles, and SortableJS runtime.

This keeps the SortableJS setup identical after the target Table has been found and avoids separate drag-and-drop implementations for iframe and non-iframe editors.

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
