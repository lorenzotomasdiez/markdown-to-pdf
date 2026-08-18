export { generatePDF, generatePDFBuffer } from './pdf/generator.js';
export { parseMarkdown } from './parser/index.js';
export { renderMermaidToSVG } from './renderers/mermaid.js';
export { latexToUnicode, extractMathExpressions, parseTextWithMath } from './renderers/math.js';
export { highlightCode } from './renderers/code.js';
export { renderInlineSpans, splitSpansIntoLines, spansToPlainText, fontForSpan } from './renderers/inline.js';
export type { InlineSpan, ParsedElement, RenderOptions, RenderContext } from './types.js';
