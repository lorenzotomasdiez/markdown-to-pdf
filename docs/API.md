# API Reference

## Core functions

### `generatePDF(markdown, outputPath, options?)`

Converts a Markdown string to a PDF file written to disk.

```typescript
import { generatePDF } from 'markdown-to-pdf';

await generatePDF(markdown: string, outputPath: string, options?: GeneratePDFOptions): Promise<void>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `markdown` | `string` | Markdown source text |
| `outputPath` | `string` | Absolute or relative path for the output PDF |
| `options` | `GeneratePDFOptions` | Optional configuration (see below) |

**Example:**

```typescript
import { readFileSync } from 'fs';
import { generatePDF } from 'markdown-to-pdf';

const md = readFileSync('document.md', 'utf-8');
await generatePDF(md, 'document.pdf', {
  title: 'My Document',
  author: 'Jane Doe',
  fontSize: 13,
});
```

---

### `generatePDFBuffer(markdown, options?)`

Same as `generatePDF` but returns the PDF as a `Buffer` instead of writing to disk.

```typescript
generatePDFBuffer(markdown: string, options?: GeneratePDFOptions): Promise<Buffer>
```

**Example:**

```typescript
import express from 'express';
import { generatePDFBuffer } from 'markdown-to-pdf';

app.get('/pdf', async (req, res) => {
  const buffer = await generatePDFBuffer('# Hello\n\nWorld');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
  res.send(buffer);
});
```

---

### `GeneratePDFOptions`

```typescript
interface GeneratePDFOptions {
  /** PDF metadata: document title */
  title?: string;

  /** PDF metadata: document author */
  author?: string;

  /** Base font size in points. Default: 12 */
  fontSize?: number;

  /** Line height multiplier applied to body text. Default: 1.6 */
  lineHeight?: number;

  /** Page margins in points (72pt = 1 inch). All sides default to 72. */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}
```

---

## Parser

### `parseMarkdown(markdown)`

Converts a Markdown string to an AST array. Useful for inspecting or transforming the document structure before rendering.

```typescript
parseMarkdown(markdown: string): ParsedElement[]
```

**Returns:** An array of `ParsedElement` objects (see Types section below).

**Example:**

```typescript
import { parseMarkdown } from 'markdown-to-pdf';

const elements = parseMarkdown('# Hello\n\nSome text.');
// [
//   { type: 'heading', content: 'Hello', attrs: { level: 1 } },
//   { type: 'paragraph', content: 'Some text.', hasMath: false }
// ]
```

---

## Math utilities

### `latexToUnicode(latex)`

Converts a LaTeX expression string to a Unicode approximation. Handles Greek letters, operators, fractions, square roots, subscripts, and superscripts.

```typescript
latexToUnicode(latex: string): string
```

**Examples:**

```typescript
latexToUnicode('\\alpha + \\beta')    // → 'α + β'
latexToUnicode('\\frac{1}{2}')        // → '(1)/(2)'
latexToUnicode('\\sqrt{x^{2}}')       // → '√(x^2)'
latexToUnicode('\\int_0^\\infty')     // → '∫_0^∞'
```

---

### `extractMathExpressions(text)`

Finds all math expressions in a string and returns their positions and content.

```typescript
extractMathExpressions(text: string): Array<{
  type: 'inline' | 'display';
  math: string;
  start: number;
  end: number;
}>
```

Recognises:
- `$...$` → inline
- `$$...$$` → display
- `\(...\)` → inline
- `\[...\]` → display

**Example:**

```typescript
const exprs = extractMathExpressions('Area is $\\pi r^2$ and volume is $$\\frac{4}{3}\\pi r^3$$');
// [
//   { type: 'inline',   math: '\\pi r^2',              start: 8,  end: 18 },
//   { type: 'display',  math: '\\frac{4}{3}\\pi r^3',  start: 33, end: 57 }
// ]
```

---

### `parseTextWithMath(text)`

Splits a string into a sequence of plain-text and math segments. Useful for rendering mixed content.

```typescript
parseTextWithMath(text: string): TextSegment[]

interface TextSegment {
  type: 'text' | 'math';
  content: string;
  mathType?: 'inline' | 'display';  // present when type === 'math'
}
```

**Example:**

```typescript
const segments = parseTextWithMath('Energy is $E = mc^2$ always.');
// [
//   { type: 'text', content: 'Energy is ' },
//   { type: 'math', content: 'E = mc^2', mathType: 'inline' },
//   { type: 'text', content: ' always.' }
// ]
```

---

## Mermaid renderer

### `renderMermaidToSVG(code, targetWidth?)`

Renders Mermaid diagram source code to SVG. Sets up a virtual DOM environment automatically.

```typescript
renderMermaidToSVG(code: string, targetWidth?: number): Promise<{ svg: string; height: number }>
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | — | Mermaid diagram source |
| `targetWidth` | `number` | `400` | Target width in points for the output SVG |

**Example:**

```typescript
import { renderMermaidToSVG } from 'markdown-to-pdf';

const { svg, height } = await renderMermaidToSVG(`
  graph LR
    A --> B --> C
`, 500);

console.log(height); // calculated height at width=500
// svg is a self-contained SVG string ready to embed
```

---

## Code renderer

### `highlightCode(code, language?)`

Applies syntax highlighting to a code string using highlight.js. Returns a token array or annotated string for use in custom renderers.

```typescript
highlightCode(code: string, language?: string): string
```

---

## Types

### `ParsedElement`

```typescript
interface ParsedElement {
  /** Element category */
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'blockquote' | 'table' | 'hr' | 'mermaid';

  /** Primary text content */
  content?: string;

  /** Child elements (used by lists) */
  children?: ParsedElement[];

  /** Element-specific attributes */
  attrs?: {
    level?: number;          // heading level 1–6
    ordered?: boolean;       // list type
    lang?: string;           // code block language
    headers?: string[];      // table column headers
    rows?: string[][];       // table data rows
  };

  /** True if the paragraph text contains math expressions */
  hasMath?: boolean;
}
```

### `RenderContext`

Internal context object passed between renderer functions. Not exported for direct use but useful to understand the rendering model.

```typescript
interface RenderContext {
  doc: PDFDocument;       // PDFKit document instance
  y: number;              // Current vertical cursor position
  pageWidth: number;      // Page width in points
  pageHeight: number;     // Page height in points
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  options: {
    fontSize?: number;
    lineHeight?: number;
  };
}
```
