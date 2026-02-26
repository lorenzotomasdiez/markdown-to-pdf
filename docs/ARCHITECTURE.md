# Architecture

This document describes the internal architecture of `markdown-to-pdf`.

## Overview

The conversion pipeline has three stages:

```
Markdown string  →  AST (ParsedElement[])  →  PDF document
```

Each stage is handled by a separate module, keeping concerns cleanly separated.

---

## Stage 1 — Parser (`src/parser/index.ts`)

**Input:** Raw Markdown string
**Output:** `ParsedElement[]` — a flat array of document elements

The parser wraps [markdown-it](https://github.com/markdown-it/markdown-it) and converts its token stream into a simpler intermediate representation.

### Element types

| `type` | Description | Key `attrs` / `children` |
|--------|-------------|--------------------------|
| `heading` | H1–H6 | `attrs.level: number` |
| `paragraph` | Body text | `hasMath: boolean` |
| `list` | Ordered or unordered list | `attrs.ordered`, `children[].content` |
| `code` | Fenced code block | `attrs.lang: string` |
| `blockquote` | Block-level quote | — |
| `table` | Table | `attrs.headers: string[]`, `attrs.rows: string[][]` |
| `hr` | Horizontal rule | — |
| `mermaid` | Mermaid diagram (from ` ```mermaid ``` ` fence) | — |

### Math detection

The parser sets `hasMath: true` on paragraph elements that contain any of:
- `$...$` — inline math
- `$$...$$` — display math
- `\(...\)` — inline math (LaTeX notation)
- `\[...\]` — display math (LaTeX notation)

This flag lets the PDF generator skip the heavier math-processing path for ordinary paragraphs.

### Text extraction

Inline formatting tokens (bold `**`, italic `*`, code spans, links) are flattened to plain text. The PDF generator uses PDFKit's built-in font variants (Helvetica, Helvetica-Bold, etc.) rather than markdown-it's HTML output.

---

## Stage 2 — PDF Generator (`src/pdf/generator.ts`)

**Input:** `ParsedElement[]`
**Output:** PDF file on disk or `Buffer`

Creates a PDFKit `PDFDocument` with the configured page size (Letter) and margins, then iterates through the AST calling the appropriate renderer for each element.

### Page layout defaults

| Property | Value |
|----------|-------|
| Page size | US Letter (612 × 792 pt) |
| Margins | 72 pt all sides (1 inch) |
| Base font size | 12 pt |
| Line height | 1.6 |

### Element dispatch (`renderElement`)

```typescript
switch (element.type) {
  case 'heading'    → renderHeading()
  case 'paragraph'  → renderParagraphWithMath()
  case 'list'       → renderList()
  case 'code'       → renderCodeBlock()
  case 'blockquote' → renderBlockquote()
  case 'table'      → renderTable()
  case 'hr'         → renderHorizontalRule()
  case 'mermaid'    → renderMermaidElement()
}
```

### Math paragraph rendering

When `hasMath` is true, the paragraph goes through `renderParagraphWithMath()`:

1. `parseTextWithMath()` splits the paragraph into alternating text/math segments.
2. Text segments are buffered and flushed as a single `doc.text()` call.
3. **Display math** (`$$...$$`, `\[...\]`):
   - Calls `renderMathToSVG(latex, true)` to get a properly typeset SVG from MathJax.
   - Embeds the SVG centered on the page via `svg-to-pdfkit`.
   - Falls back to `latexToUnicode()` + `sanitizeMathText()` (ASCII) if MathJax fails.
4. **Inline math** (`$...$`, `\(...\)`):
   - Converted to Unicode via `latexToUnicode()` then sanitized to Latin-1 via `sanitizeMathText()`.
   - Appended to the text buffer so it flows naturally with surrounding prose.

### Page break management (`checkPageBreak`)

Before rendering each element, `checkPageBreak(ctx, requiredHeight)` checks:

```
doc.y + requiredHeight > pageHeight - margins.bottom
```

If true, `doc.addPage()` is called. This prevents content from overflowing the printable area.

---

## Stage 3 — Renderers (`src/renderers/`)

### Standard renderer (`standard.ts`)

Handles headings, lists, code blocks, blockquotes, tables, and horizontal rules using PDFKit's drawing primitives.

**Font map:**

| Element | Font | Size |
|---------|------|------|
| H1 | Helvetica-Bold | 24 pt |
| H2 | Helvetica-Bold | 20 pt |
| H3 | Helvetica-Bold | 16 pt |
| H4 | Helvetica-Bold | 14 pt |
| H5 | Helvetica-Bold | 12 pt |
| H6 | Helvetica-Bold | 10 pt |
| Body text | Helvetica | 12 pt (configurable) |
| Code | Courier | 10 pt |
| Blockquote | Helvetica-Oblique | 12 pt |
| Table | Helvetica / Helvetica-Bold | 10 pt |

**Character sanitization (`sanitizeText`):**
PDFKit's built-in fonts (Helvetica, Courier, Times-Roman) use WinAnsi / Latin-1 encoding and cannot render:
- Emoji and non-BMP codepoints (U+10000+)
- Many BMP symbols in the Miscellaneous Symbols block (U+2600–U+27BF)

These are stripped before calling `doc.text()`. Fancy quotes and em-dashes are normalised to ASCII equivalents.

### Math renderer (`math.ts`)

Three layers of math support, used in different contexts:

#### 1. `renderMathToSVG(latex, displayMode)` — MathJax SVG

Used for display math in the PDF. Lazily initialises a singleton MathJax instance with:
- `liteAdaptor` — no browser/DOM required
- `TeX` input with `AllPackages` — full LaTeX support
- `SVG` output with `fontCache: 'none'` — self-contained SVG paths

Post-processing on the raw SVG:
- Extracts `<svg>` from the `<mjx-container>` wrapper
- Converts `ex`-unit dimensions to points (1 ex ≈ 10 pt for display, 8 pt for inline)
- Replaces `currentColor` → `#333333` (svg-to-pdfkit doesn't resolve CSS colour keywords)
- Strips `style="vertical-align:..."` from the root `<svg>` (irrelevant in PDF)

#### 2. `latexToUnicode(latex)` — Unicode conversion

Used as the first pass for inline math and as fallback text. Handles:
- Greek letters: `\alpha` → `α`, …
- Operators: `\times` → `×`, `\int` → `∫`, …
- Fractions: `\frac{a}{b}` → `(a)/(b)`
- Square roots: `\sqrt{x}` → `√(x)`
- Sub/superscripts: `x^{2}` → `x^2`, `x_{n}` → `x_n`
- `\left` / `\right` bracket pairs
- LaTeX spacing commands: `\,` `\;` `\quad` etc.

A `(?![a-zA-Z])` negative lookahead prevents shorter command names from matching as prefixes of longer ones (e.g. `\in` must not consume the start of `\int` or `\infty`).

#### 3. `sanitizeMathText(text)` — Latin-1 fallback

Converts Unicode math symbols (produced by `latexToUnicode`) to ASCII equivalents that PDFKit's built-in fonts can render:
- `√` → `sqrt`, `∞` → `inf`, `∫` → `int`
- Greek letters → their names: `α` → `alpha`, `β` → `beta`, …
- Arrows: `→` → `->`, `⇒` → `=>`

Used only for inline math embedded in text runs.

### Mermaid renderer (`mermaid.ts`)

Renders Mermaid diagram source to an SVG suitable for embedding in PDFKit.

**Key challenges and solutions:**

| Challenge | Solution |
|-----------|----------|
| Mermaid requires a browser DOM | Set up a virtual DOM with `happy-dom` |
| dagre layout engine calls `getBBox()` / `getComputedTextLength()` | Patch stub implementations returning fixed geometry |
| Default `htmlLabels: true` emits `<foreignObject>` nodes | Set `htmlLabels: false` — forces native SVG `<text>` elements |
| svg-to-pdfkit ignores CSS `<style>` blocks | `inlineMermaidStyles()` rewrites CSS classes as `style=` attributes |
| Stub geometry produces wrong `viewBox` | `fixSVGViewBox()` scans `translate()` transforms to infer actual bounds |
| `translate(NaN)` or `translate(undefined)` from unsupported diagrams | Replaced with `translate(0, 0)` |

**`inlineMermaidStyles()` style mapping:**

| Element | Style applied |
|---------|---------------|
| `.label-container` rect | `fill:#ECECFF; stroke:#9370DB` |
| `.background` rect | `fill:none; stroke:none` |
| `.flowchart-link` path | `fill:none; stroke:#333333; stroke-width:1.5px` |
| `.arrowMarkerPath` path/circle | `fill:#333333; stroke:#333333` |
| `<text>` | `fill:#333333; font-family:Helvetica,Arial,sans-serif; font-size:14px` |
| `<tspan>` (without `fill`) | `fill:#333333` |

**`fixSVGViewBox()` algorithm:**
1. Scan all `translate(x, y)` transforms for the maximum X and Y coordinates.
2. Add a 160 × 100 pt padding beyond the last node (accounting for stub node size 100 × 40 pt).
3. Compute aspect ratio → derive `renderHeight` from `targetWidth`.
4. Rewrite `width`, `height`, and `viewBox` **only on the root `<svg>` element** (using a `(<svg\b[^>]*)>` capturing regex to avoid touching inner element attributes).

**Fallback:** If `mermaid.render()` throws, a styled placeholder box is drawn showing the raw diagram source code, with a header labelled "Mermaid Diagram".

### Code renderer (`code.ts`)

Wraps `highlight.js` to produce a tokenised representation of source code. Currently the PDF generator calls `renderCodeBlock()` in `standard.ts` which renders plain monospaced text; the `code.ts` renderer exports `highlightCode()` for consumers that want token-level highlighting.

---

## Data flow diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         INPUT                               │
│               Markdown string / file                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    parseMarkdown()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ParsedElement[]                           │
│  { type, content, attrs, children, hasMath }                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    generatePDF() / generatePDFBuffer()
                            │
               ┌────────────┼────────────┐
               │            │            │
          heading       paragraph      mermaid
               │          (math?)         │
               ▼            │            ▼
        renderHeading()      │    renderMermaidToSVG()
                             │          │
                 ┌───────────┴──┐        │
                 │ hasMath=true │        │ svg-to-pdfkit
                 │              │        │
                 ▼              ▼        ▼
        renderMathToSVG()  renderText()  SVGtoPDF()
              │  (MathJax)
              │
              └── svg-to-pdfkit (centered)
```

---

## Key design decisions

### Why PDFKit?

PDFKit gives low-level control over every PDF primitive: text placement, font metrics, vector drawing, image embedding. This is essential for correct page-break detection, table layout, and SVG embedding. Higher-level libraries abstract too much away.

### Why MathJax over KaTeX?

KaTeX is installed as a dependency but its primary output is HTML+CSS, not clean SVG with path data. MathJax's SVG output mode (`mathjax-full` with `SVG` jax and `liteAdaptor`) produces self-contained SVG files that `svg-to-pdfkit` can embed directly. MathJax initialisation is heavier, so it is lazily loaded and cached as a singleton.

### Why happy-dom for Mermaid?

Mermaid's layout engine (dagre-d3) uses browser DOM APIs. `happy-dom` is faster and lighter than `jsdom` and correctly serialises SVG element trees. Geometry methods (`getBBox`, `getComputedTextLength`, etc.) return stub values since there is no real rendering engine; this is sufficient for dagre to compute node positions.

### Why inline styles for Mermaid SVG?

`svg-to-pdfkit` parses SVG attributes and applies them to PDFKit drawing calls. It does not implement a CSS engine — `<style>` blocks and class-based rules are silently ignored. All visual properties must be expressed as `style="..."` or explicit SVG presentation attributes on each element.
