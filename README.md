# Chimera VoidZero Prototype

A Runnable React prototype of the Chimera-style design-system morph tool, packaged on VoidZero's public stack via Rolldown-Vite.

## What it includes

- 4-corner XY style pad
- Bilinear theme interpolation
- Discrete token voting for categorical traits
- Live specimen page that re-themes in real time
- Contrast guard
- Corner-bias control to reduce muddy middles

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm install
npm run build
```

## Notes

This stays faithful to the black-box inference: structured corner JSON themes plus deterministic runtime interpolation, not per-frame LLM generation.
