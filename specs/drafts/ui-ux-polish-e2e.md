# UI/UX Polish and E2E Setup

Status: draft
Created: 2026-03-13 21:35:26 CET

## Request

Deep review the current UI, improve the feel and usability, and set up full end-to-end coverage so the prototype can be iterated with confidence.

## Open Questions

- None blocking. The app is a local Vite prototype with no existing tests or git metadata in the workspace root.

## Risks

- `src/App.tsx` currently mixes theme math, interaction state, and UI rendering in one file, which raises regression risk during refactor.
- The current pointer-only pad interaction has no keyboard path, which makes E2E coverage and accessibility weaker.
- The workspace root is not a git repository, so commit-oriented phase recording is not currently possible.

## Priority

High. The current prototype is functional but visually noisy, structurally brittle, and untested.

## Findings Baseline

- The UI leans heavily on generic AI-dashboard patterns: large radii, repeated glass panels, uppercase eyebrow text, decorative gradients, and oversized shadows.
- The interaction surface is mouse/pointer first. There is no keyboard steering, no reset affordance, and limited state legibility outside the weight bars.
- The specimen page is visually interesting but operationally noisy; it lacks a tighter hierarchy and product-feeling controls.
- There is no E2E harness, no test IDs, no smoke assertions, and no CI-ready verification path.

## Implementation Phases

### Phase 1

Refactor the UI into clearer sections and improve usability:
- reduce decorative shells and exaggerated chrome
- tighten spacing, hierarchy, and component consistency
- add keyboard-accessible control of the blend pad
- add deterministic hooks (`data-testid`) for testing

### Phase 2

Set up Playwright E2E:
- add Playwright config
- add scripts for local run flow
- cover core happy-path interactions across desktop and mobile-ish viewports
- persist artifacts in a conventional location

### Phase 3

Validation and review:
- run production build
- run Playwright suite
- record residual issues and future UX opportunities

## Affected Files

- `src/App.tsx`
- `src/styles.css`
- `package.json`
- `README.md`
- `playwright.config.ts`
- `e2e/*`

## Dependencies

- `@playwright/test`

## Existing Issues or PRs

- None visible from the current workspace because it is not a git repo root.

## Definition Of Done

- UI hierarchy is cleaner and more intentional.
- Blend pad supports pointer and keyboard interaction.
- Main user flows are covered by Playwright E2E.
- `bun run build` passes.
- E2E suite runs locally with clear commands.

## Change Log

- 2026-03-13: Draft created from repo investigation.
