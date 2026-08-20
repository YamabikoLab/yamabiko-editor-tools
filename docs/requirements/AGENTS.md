# Requirements documentation instructions

These instructions apply to requirements documents under `docs/requirements/`.

## Purpose

- Describe what users, the product, quality, or the business must be able to achieve.
- Keep requirements focused on **What** and, when it helps explain the requirement, **Why**.
- Do not describe **How** a requirement will be realized. Leave that to design documentation.
- Keep requirements independent from a specific implementation approach.

## Abstraction boundary

- Write from a user, product, quality, or business perspective.
- Leave concrete screen behavior, interaction flow, focus destination, and other realization details to design documents.
- Do not include source files, functions, variables, events, internal state, APIs, CSS, DOM structure, or test implementation details.
- Do not write statements that require reading source code to understand their meaning.

## Readability

- Use plain language understandable to non-technical readers, including management-level readers with no programming knowledge.
- Prefer outcomes and needs over implementation terminology.

## Examples

Good:

> First-time users must be able to clearly identify the entry point to row reordering.

Bad:

> Focus the row-reorder toolbar control when the first pointer event is handled.
