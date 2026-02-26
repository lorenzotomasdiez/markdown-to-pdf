# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A fast, reliable Markdown to PDF converter that properly handles:
- **Mermaid diagrams** — rendered as vector SVG graphics embedded in the PDF
- **Math expressions** — display math typeset via MathJax SVG; inline math converted to Unicode
- Standard Markdown features (headings, lists, code blocks, tables, blockquotes, horizontal rules)

## Architecture

Pipeline: `Markdown string → ParsedElement[] AST → PDF document`

**Core components:**

| File | Responsibility |
|------|---------------|
| `src/parser/index.ts` | Markdown → AST using markdown-it |
| `src/pdf/generator.ts` | AST → PDF using PDFKit; dispatches to renderers |
| `src/renderers/standard.ts` | Headings, lists, tables, blockquotes, text, horizontal rules |
| `src/renderers/math.ts` | LaTeX → Unicode (inline), LaTeX → MathJax SVG (display) |
| `src/renderers/mermaid.ts` | Mermaid source → SVG via mermaid npm package + happy-dom |
| `src/renderers/code.ts` | Syntax highlighting via highlight.js |
| `src/index.ts` | Public API exports |
| `src/cli.ts` | CLI entry point (`md2pdf`) |

## Key Design Decisions

- **Math (display)**: Uses `mathjax-full` with `liteAdaptor` (no browser required). Lazy-initialised singleton. SVG output with `fontCache: 'none'`. Dimensions converted from `ex` units to points.
- **Math (inline)**: `latexToUnicode()` converts commands to Unicode, then `sanitizeMathText()` downgrades to Latin-1 ASCII for PDFKit's built-in fonts.
- **Mermaid**: Uses `mermaid` npm package with `happy-dom` as the virtual DOM. `htmlLabels: false` forces native SVG text (no `<foreignObject>`). CSS inlined manually since `svg-to-pdfkit` ignores `<style>` blocks.
- **PDF**: PDFKit for low-level control over text placement, vector drawing, SVG embedding.
- **SVG embedding**: `svg-to-pdfkit` converts SVG elements to PDFKit drawing calls. Requires all styles to be inline attributes, not CSS classes.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run CLI directly (no build needed)
npm run dev -- input.md output.pdf

# Run tests (158 tests, ~500ms)
npm test

# Interactive test UI
npm run test:ui

# Coverage report
npm run test:coverage
```

## Testing

- **Framework**: Vitest
- **158 tests** across 5 files — all must pass before merging changes
- Test files mirror `src/` layout under `tests/`

```
tests/
├── unit/
│   ├── parser.test.ts             # 27 tests
│   ├── math.test.ts               # 37 tests
│   └── standard-renderers.test.ts # 38 tests
└── integration/
    ├── pdf-generation.test.ts     # 27 tests
    └── pdf-content-validation.test.ts # 29 tests
```

## Adding New Markdown Features

1. Add parser logic in `src/parser/index.ts` (new element type in the `switch` over markdown-it tokens)
2. Add renderer in `src/renderers/[feature].ts`
3. Register the renderer in `renderElement()` in `src/pdf/generator.ts`
4. Export from `src/index.ts` if it forms part of the public API
5. Add unit tests in `tests/unit/[feature].test.ts` and integration tests in `tests/integration/`

## Common Pitfalls

- **PDFKit fonts** are WinAnsi/Latin-1 (U+0000–U+00FF). Characters outside this range render as `?`. Always run text through `sanitizeText()` (standard) or `sanitizeMathText()` (math) before passing to `doc.text()`.
- **svg-to-pdfkit** ignores CSS `<style>` blocks. All SVG visual properties must be in `style="..."` attributes or explicit SVG presentation attributes.
- **`\in` vs `\int`/`\infty`**: The `latexToUnicode` conversion table uses a `(?![a-zA-Z])` negative lookahead on every regex to prevent prefix matching.
- **Mermaid viewBox**: Stub DOM geometry means mermaid's self-computed viewBox is wrong. `fixSVGViewBox()` recomputes it from `translate()` transforms in the output SVG.
- **SVG root attributes**: When rewriting `width`/`height`/`viewBox` on an SVG, scope the regex to the `<svg ...>` opening tag only — inner elements (e.g. `<rect height="...">`) must not be touched.
