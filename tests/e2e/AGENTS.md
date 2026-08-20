# E2E test instructions

These instructions apply to files under `tests/e2e/`.

## Test responsibility

- Use Playwright E2E for behavior that depends on the real browser, WordPress / Gutenberg editor integration, input devices, or runtime integration.
- Keep logic and branches that do not require a real browser in Jest.
- Assert user-observable behavior rather than implementation details.
- Preserve the input path defined by the issue, specification, or implementation plan. Do not substitute a different interaction merely because it is easier to automate.

## WordPress editor interaction

- Prefer `@wordpress/e2e-test-utils-playwright` helpers when they appropriately create WordPress or Gutenberg state.
- Use direct browser input when the input path itself is part of the behavior under test.
- Use the existing `getEditorContext()` helper for editor content that may run in iframe or non-iframe environments.
- Do not hard-code URLs, credentials, or environment-specific paths.

## Input fidelity

- Preserve the intended keyboard, mouse, pointer, or touch input method.
- Do not replace Touch DnD with mouse or pointer drag.
- Do not substitute one Table Reorder interaction model for another, such as destination tap for drag-and-drop.
- Prefer Playwright input APIs.
- When Playwright cannot accurately reproduce the required input, Chromium CDP may be used only inside E2E test support code.
- Do not change product code only to make an E2E test easier to write.
- Derive gesture coordinates from locators or bounding boxes rather than fixed screen coordinates.

## Deterministic tests

- Do not use fixed `waitForTimeout()` calls for synchronization.
- Wait for the state that makes the next operation possible, using Playwright assertions, `expect.poll()`, or another state-based condition.
- Prefer assertions on visible UI, accessibility state, row order, or edited post content.
- Do not make SortableJS internal state or internal event ordering the primary assertion for product behavior.
- Internal state may be used narrowly as a readiness condition when public state alone cannot determine readiness.
- Final assertions must verify behavior observable by the user.

## Test isolation

- Each test must construct the state it requires.
- Do not depend on test execution order or state left by a previous test.
- Explicitly set persistent WordPress preferences when they affect the scenario.
- Disable coachmarks or other first-run experiences during setup when they are not the behavior under test.

## Table Reorder interaction tests

- Keep keyboard, mouse / pointer, touch drag-and-drop, and touch destination-tap scenarios separate.
- Do not treat a touch scroll gesture that starts from table content as drag-and-drop.
- For scenarios that include scrolling, do not assume a fixed viewport position. Assert the behavior required after scrolling.
- Confirm a completed row move through user-observable state such as row order or edited post content.

## Selectors and helpers

- Prefer roles, accessible names, text, and existing helpers over brittle DOM traversal.
- Reuse an existing helper when it represents the same user-level operation.
- Centralize low-level CDP or coordinate handling in test support code instead of duplicating it across specs.
- Do not hide feature assertions inside helpers so deeply that the behavior under test is unclear from the spec.

## Validation

- Follow `docs/development/testing.md` for validation commands.
- Do not duplicate validation command lists in this file.
- If the required WordPress environment is unavailable and E2E tests were not run, do not report them as successful.
