# Design documentation instructions

These instructions apply to design documents under `docs/design/`.

## Purpose

- Describe how requirements appear to users as screens, interactions, states, messages, and behavior.
- Define user-visible behavior and interaction flow without describing program internals.
- Keep the design valid even if the implementation approach later changes.

## Abstraction boundary

- Describe **How** a requirement is realized through user-visible screens, interactions, states, messages, and behavior.
- Do not merely restate **What** should be achieved; describe the user-visible behavior that makes it happen.
- Include enough detail for a non-technical reader to understand what happens, when it happens, and where it happens.
- Describe concrete user-facing behavior, including relevant screen behavior, interaction flow, focus destination, states, and messages.
- Do not describe the technical **How** of the implementation, such as source files, functions, variables, event names, internal state management, APIs, CSS, DOM structure, or test implementation.
- Do not write statements that require reading source code to understand their meaning.

## Readability

- Use plain language understandable to non-technical readers, including management-level readers with no programming knowledge.
- Prefer user-visible behavior over implementation terminology.

## Examples

Good:

> When the first-time guidance appears, move focus to the row-reordering control so the user can immediately identify where to start. Display the guidance message near the control without covering it.

Bad:

> During the first-time guidance, make the entry point to row reordering easy to identify.
