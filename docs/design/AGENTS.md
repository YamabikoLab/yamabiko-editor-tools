# Design documentation instructions

These instructions apply to design documents under `docs/design/`.

## Purpose

- Describe how requirements appear to users as screens, interactions, states, messages, and behavior.
- Define user-visible behavior and interaction flow without describing program internals.
- Keep the design valid even if the implementation approach later changes.

## Abstraction boundary

- Describe concrete user-facing behavior, including relevant screen behavior, interaction flow, focus destination, states, and messages.
- Do not include source files, functions, variables, event names, internal state management, APIs, CSS, DOM structure, or test implementation details.
- Do not write statements that require reading source code to understand their meaning.

## Readability

- Use plain language understandable to non-technical readers, including management-level readers with no programming knowledge.
- Prefer user-visible behavior over implementation terminology.

## Examples

Good:

> During the first-time guidance, make the entry point to row reordering easy to identify.

Bad:

> Focus the ToolbarButton when the first pointer event is handled.
