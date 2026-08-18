import PDFDocument from 'pdfkit';
import fs from 'fs';
import { parseMarkdown } from '../parser/index.js';
import { renderMermaidToSVG } from '../renderers/mermaid.js';
import { latexToUnicode, sanitizeMathText, extractMathExpressions, renderMathToSVG, type TextSegment } from '../renderers/math.js';
import {
  renderHeading,
  renderText,
  renderList,
  renderListItem,
  listMarker,
  renderCodeBlock,
  renderBlockquote,
  renderTable,
  renderHorizontalRule,
  checkPageBreak,
  type RenderContext,
} from '../renderers/standard.js';

interface GeneratePDFOptions {
  title?: string;
  author?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

const defaultMargins = {
  top: 72,
  bottom: 72,
  left: 72,
  right: 72,
};

export async function generatePDF(markdown: string, outputPath: string, options: GeneratePDFOptions = {}): Promise<void> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: options.margins?.top ?? defaultMargins.top,
      bottom: options.margins?.bottom ?? defaultMargins.bottom,
      left: options.margins?.left ?? defaultMargins.left,
      right: options.margins?.right ?? defaultMargins.right,
    },
  });

  if (options.title) {
    doc.info.Title = options.title;
  }
  if (options.author) {
    doc.info.Author = options.author;
  }

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const elements = parseMarkdown(markdown);

  const ctx: RenderContext = {
    doc,
    y: doc.y,
    pageWidth: doc.page.width,
    pageHeight: doc.page.height,
    margins: {
      top: options.margins?.top ?? defaultMargins.top,
      bottom: options.margins?.bottom ?? defaultMargins.bottom,
      left: options.margins?.left ?? defaultMargins.left,
      right: options.margins?.right ?? defaultMargins.right,
    },
    options: {
      fontSize: options.fontSize || 12,
      lineHeight: options.lineHeight || 1.6,
    },
  };

  for (const element of elements) {
    await renderElement(ctx, element);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function renderElement(ctx: RenderContext, element: any): Promise<void> {
  switch (element.type) {
    case 'heading':
      renderHeading(ctx, element.attrs.level, richText(element));
      break;

    case 'paragraph':
      await renderParagraphWithMath(ctx, element.content, element.hasMath, element.spans);
      break;

    case 'list':
      await renderListElement(ctx, element, 0);
      break;

    case 'code':
      renderCodeBlock(ctx, element.content, element.attrs.lang);
      break;

    case 'blockquote':
      renderBlockquote(ctx, richText(element));
      break;

    case 'table':
      renderTable(ctx, element.attrs.headers, element.attrs.rows, {
        headerSpans: element.attrs.headerSpans,
        rowSpans: element.attrs.rowSpans,
      });
      break;

    case 'hr':
      renderHorizontalRule(ctx);
      break;

    case 'mermaid':
      await renderMermaidElement(ctx, element.content);
      break;

    default:
      console.warn(`Unknown element type: ${element.type}`);
  }
}

/** Formatted runs when the parser produced them, plain text otherwise. */
function richText(element: any): any {
  return element.spans && element.spans.length > 0 ? element.spans : element.content || '';
}

/**
 * Render a list, keeping each item's nested blocks (sub-lists, code) attached
 * to the item they belong to and indented one level further.
 */
async function renderListElement(ctx: RenderContext, element: any, depth: number): Promise<void> {
  const { doc } = ctx;
  const ordered = !!element.attrs?.ordered;
  const start = element.attrs?.start ?? 1;
  const items = element.children || [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    renderListItem(ctx, richText(item), listMarker(ordered, start + i, depth), { depth, ordered });

    for (const child of item.children || []) {
      doc.moveDown(0.2);
      if (child.type === 'list') {
        await renderListElement(ctx, child, depth + 1);
      } else {
        await renderElement(ctx, child);
      }
    }

    if (i < items.length - 1) doc.moveDown(0.25);
  }

  doc.moveDown(0.3);
}

async function renderParagraphWithMath(ctx: RenderContext, content: string, hasMath: boolean, spans?: any[]): Promise<void> {
  if (!hasMath) {
    renderText(ctx, spans && spans.length > 0 ? spans : content);
    return;
  }

  const segments = parseTextWithMath(content);
  const { doc, margins, pageWidth } = ctx;
  const fontSize = ctx.options.fontSize || 12;
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, fontSize * 3);

  // Separate display math segments from inline content.
  // Build runs of text+inline-math and render each run as one doc.text call.
  // Display math gets its own centred line.
  let inlineBuffer = '';

  const flushInline = () => {
    if (inlineBuffer.trim()) {
      doc.fontSize(fontSize).font('Helvetica').fillColor('black');
      doc.text(inlineBuffer.trim(), margins.left, doc.y, { width: maxWidth, continued: false });
    }
    inlineBuffer = '';
  };

  for (const segment of segments) {
    if (segment.type === 'text') {
      inlineBuffer += segment.content;
    } else if (segment.type === 'math') {
      const unicode = sanitizeMathText(latexToUnicode(segment.content));
      const isDisplay = segment.mathType === 'display';

      if (isDisplay) {
        flushInline();
        doc.moveDown(0.3);
        try {
          const { svg, width, height } = await renderMathToSVG(segment.content, true);
          checkPageBreak(ctx, height + 20);
          // @ts-expect-error - svg-to-pdfkit doesn't have types
          const SVGtoPDF = (await import('svg-to-pdfkit')).default;
          const svgX = margins.left + Math.max(0, (maxWidth - width) / 2);
          SVGtoPDF(doc, svg, svgX, doc.y, { width, height });
          doc.y += height;
        } catch {
          // Fallback to ASCII text if MathJax rendering fails
          const unicode = sanitizeMathText(latexToUnicode(segment.content));
          doc.fontSize(fontSize + 2).font('Times-Roman').fillColor('black');
          doc.text(unicode, margins.left, doc.y, { width: maxWidth, align: 'center', continued: false });
        }
        doc.moveDown(0.3);
      } else {
        // Inline math: append sanitized unicode into the text buffer
        inlineBuffer += unicode;
      }
    }
  }

  flushInline();
  doc.moveDown(0.4);
}

function parseTextWithMath(text: string): TextSegment[] {
  const expressions = extractMathExpressions(text);
  if (expressions.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const expr of expressions) {
    if (expr.start > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, expr.start),
      });
    }

    segments.push({
      type: 'math',
      content: expr.math,
      mathType: expr.type,
    });

    lastIndex = expr.end;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

async function renderMermaidElement(ctx: RenderContext, code: string): Promise<void> {
  const { doc, margins, pageWidth } = ctx;
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, 250);

  try {
    // Cap height to 80% of the content area so diagrams don't overflow the page
    const maxDiagramHeight = (ctx.pageHeight - ctx.margins.top - ctx.margins.bottom) * 0.8;
    let { svg, height } = await renderMermaidToSVG(code, maxWidth);

    if (height > maxDiagramHeight) {
      const scale = maxDiagramHeight / height;
      const scaledWidth = Math.round(maxWidth * scale);
      ({ svg, height } = await renderMermaidToSVG(code, scaledWidth));
      height = maxDiagramHeight;
    }

    checkPageBreak(ctx, height + 20);

    // Strip XML declaration if present
    const cleanedSvg = svg.replace(/<\?xml[^?]*\?>/g, '');

    // @ts-expect-error - svg-to-pdfkit doesn't have types
    const SVGtoPDF = (await import('svg-to-pdfkit')).default;
    const svgStartY = doc.y;
    SVGtoPDF(doc, cleanedSvg, margins.left, svgStartY, { width: maxWidth, height });

    doc.y = svgStartY + height;
    doc.moveDown(0.5);
  } catch (e) {
    // Mermaid render failed — show a clean placeholder with the diagram code
    console.error('Mermaid render error:', e);
    renderMermaidFallback(ctx, code);
  }
}

function renderMermaidFallback(ctx: RenderContext, code: string): void {
  const { doc, margins, pageWidth } = ctx;
  const maxWidth = pageWidth - margins.left - margins.right;
  const fontSize = 9;
  const lineHeight = fontSize * 1.4;
  const padding = 10;
  const headerHeight = 24;
  const lines = code.split('\n');
  const bodyHeight = Math.min(lineHeight * lines.length + padding * 2, 300);
  const totalHeight = headerHeight + bodyHeight;

  checkPageBreak(ctx, totalHeight + 16);

  const boxTop = doc.y;

  // Header bar (teal/blue-grey)
  doc.rect(margins.left, boxTop, maxWidth, headerHeight).fill('#2d6a8a');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('white');
  doc.text('Mermaid Diagram', margins.left + padding, boxTop + 7, {
    width: maxWidth - padding * 2,
    lineBreak: false,
  });

  // Body background
  const bodyTop = boxTop + headerHeight;
  doc.rect(margins.left, bodyTop, maxWidth, bodyHeight).fillAndStroke('#f0f7fb', '#2d6a8a');

  // Note text
  doc.fontSize(8).font('Helvetica').fillColor('#555');
  doc.text('Install @mermaid-js/mermaid-cli to render diagrams', margins.left + padding, bodyTop + 6, {
    width: maxWidth - padding * 2,
    lineBreak: false,
  });

  // Diagram code
  doc.fontSize(fontSize).font('Courier').fillColor('#24292e');
  doc.text(code, margins.left + padding, bodyTop + 20, {
    width: maxWidth - padding * 2,
    lineBreak: true,
    lineGap: 1,
  });

  doc.y = boxTop + totalHeight;
  doc.moveDown(0.8);
}

export function generatePDFBuffer(markdown: string, options: GeneratePDFOptions = {}): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: options.margins?.top ?? defaultMargins.top,
        bottom: options.margins?.bottom ?? defaultMargins.bottom,
        left: options.margins?.left ?? defaultMargins.left,
        right: options.margins?.right ?? defaultMargins.right,
      },
    });

    if (options.title) doc.info.Title = options.title;
    if (options.author) doc.info.Author = options.author;

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const elements = parseMarkdown(markdown);

    const ctx: RenderContext = {
      doc,
      y: doc.y,
      pageWidth: doc.page.width,
      pageHeight: doc.page.height,
      margins: {
        top: options.margins?.top ?? defaultMargins.top,
        bottom: options.margins?.bottom ?? defaultMargins.bottom,
        left: options.margins?.left ?? defaultMargins.left,
        right: options.margins?.right ?? defaultMargins.right,
      },
      options: {
        fontSize: options.fontSize || 12,
        lineHeight: options.lineHeight || 1.6,
      },
    };

    for (const element of elements) {
      await renderElement(ctx, element);
    }

    doc.end();
  });
}
