# assign

An assignment / task tracker — what work exists, and who owns it.

## Status

Fresh scaffold. The page you see is still the stock Vite template, kept only to
prove the toolchain works end to end. Replace `src/App.tsx` when the real thing
starts.

## Requirements

Node >= 20 (developed on v25).

## Getting started

```bash
git clone https://github.com/asheewee1771/assign.git
cd assign
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) then bundle to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Lint with oxlint |

## Stack

React 19, TypeScript 6, Vite 8, oxlint. No UI framework, router, or state library
yet — add them when there's something that needs them.

## Layout

```
index.html          entry document
src/
  main.tsx          React root
  App.tsx           the app — currently the stock template
  index.css         global styles
  App.css           component styles
  assets/           bundled images
public/             served as-is, not bundled
```
