import PDFDocument from 'pdfkit';
import { InlineSpan } from '../types.js';
import { cleanSpans, fontForSpan, renderInlineSpans, splitSpansIntoLines } from './inline.js';

/** Text that renderers accept: either plain text or formatted runs. */
export type RichText = string | InlineSpan[];

function toSpans(text: RichText): InlineSpan[] {
  return typeof text === 'string' ? [{ text }] : text;
}

/**
 * Remove characters outside the Basic Multilingual Plane that PDFKit's
 * built-in fonts (Helvetica, Courier, Times-Roman) cannot render.
 * Emoji and other non-BMP codepoints would appear as '?' or corrupt output.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  // Replace emoji and non-BMP characters (U+10000+) with an empty string
  // Also replace common problematic Unicode symbols that fall outside Latin extended
  return text.replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    // Replace emoji-like symbols in the BMP that Helvetica doesn't support
    .replace(/[\u2600-\u27BF\u{1F300}-\u{1FFFF}]/gu, '')
    // Normalize fancy quotes and dashes to ASCII equivalents
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...');
}

export interface RenderOptions {
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

export interface RenderContext {
  doc: any;
  y: number;
  pageWidth: number;
  pageHeight: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  options: RenderOptions;
}

export function checkPageBreak(ctx: RenderContext, requiredHeight: number): void {
  const { doc, pageHeight, margins } = ctx;
  if (doc.y + requiredHeight > pageHeight - margins.bottom) {
    doc.addPage();
  }
}

export function renderHeading(ctx: RenderContext, level: number, content: RichText): void {
  const { doc, margins, pageWidth, options } = ctx;
  const sizes = [24, 20, 16, 14, 12, 10];
  const fontSize = options.fontSize ? options.fontSize * (sizes[level - 1] / 12) : sizes[level - 1];
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, fontSize * 2 + 20);

  // Add spacing above h2+ to visually separate sections
  if (level > 1) {
    doc.moveDown(0.5);
  }

  renderInlineSpans(ctx, toSpans(content), {
    x: margins.left,
    y: doc.y,
    width: maxWidth,
    fontSize,
    bold: true,
  });
  doc.moveDown(0.3);
}

export interface ListOptions {
  /** Nesting depth; 0 is a top-level list. */
  depth?: number;
  /** First number of an ordered list (markdown `3.` starts at 3). */
  start?: number;
}

export const BULLETS = ['\u2022', '-', '\u00b7'];

export function renderList(ctx: RenderContext, items: RichText[], ordered: boolean, listOptions: ListOptions = {}): void {
  const { doc } = ctx;
  const depth = listOptions.depth || 0;
  const start = listOptions.start ?? 1;

  items.forEach((item, index) => {
    renderListItem(ctx, item, listMarker(ordered, start + index, depth), { depth, ordered });
    // Breathing room between items; multi-line items would otherwise run together
    if (index < items.length - 1) doc.moveDown(0.25);
  });

  doc.moveDown(0.3);
}

export function listMarker(ordered: boolean, number: number, depth: number): string {
  return ordered ? `${number}.` : BULLETS[depth % BULLETS.length];
}

/** Render one item: marker in the gutter, text in a hanging-indent column. */
export function renderListItem(
  ctx: RenderContext,
  item: RichText,
  marker: string,
  itemOptions: { depth?: number; ordered?: boolean } = {}
): void {
  const { doc, margins, pageWidth, options } = ctx;
  const fontSize = options.fontSize || 12;
  const depth = itemOptions.depth || 0;
  const markerWidth = itemOptions.ordered ? 24 : 18;
  const left = margins.left + depth * 22;
  const textX = left + markerWidth;
  const maxWidth = pageWidth - margins.right - textX;

  checkPageBreak(ctx, fontSize * 2);

  doc.fontSize(fontSize).font('Helvetica').fillColor('black');
  // Capture Y before any text call so marker and text share the same baseline
  const lineY = doc.y;
  doc.text(marker, left, lineY, { width: markerWidth - 4, lineBreak: false, link: null });
  renderInlineSpans(ctx, toSpans(item), {
    x: textX,
    y: lineY,
    width: maxWidth,
    fontSize,
  });
}

export function renderCodeBlock(ctx: RenderContext, code: string, lang: string): void {
  const { doc, pageWidth, margins } = ctx;
  const fontSize = 10;
  const lineHeight = fontSize * 1.4; // realistic PDFKit line height
  const padding = 10;
  const maxWidth = pageWidth - margins.left - margins.right;

  // Strip trailing newline for counting
  const lines = code.replace(/\n$/, '').split('\n');
  const boxHeight = Math.min(lineHeight * lines.length + padding * 2, 400);

  checkPageBreak(ctx, boxHeight + 20);

  const boxTop = doc.y;

  // Draw background box
  doc.rect(margins.left, boxTop, maxWidth, boxHeight).fillAndStroke('#f6f8fa', '#d0d7de');

  // Render code text, explicitly positioned inside the box
  doc.fontSize(fontSize).font('Courier').fillColor('#24292e');
  doc.text(code.replace(/\n$/, ''), margins.left + padding, boxTop + padding, {
    width: maxWidth - padding * 2,
    lineBreak: true,
    lineGap: 2,
  });

  // Move cursor to below the box
  doc.y = boxTop + boxHeight;
  doc.moveDown(0.8);
}

export function renderBlockquote(ctx: RenderContext, content: RichText): void {
  const { doc, margins, pageWidth } = ctx;
  const fontSize = ctx.options.fontSize || 12;
  const maxWidth = pageWidth - margins.left - margins.right - 30;
  const quoteSpans = toSpans(content);
  const quoteLength = quoteSpans.reduce((total, span) => total + span.text.length, 0);
  const estimatedHeight = fontSize * 1.4 * (Math.ceil(quoteLength / 80) + 1) + 20;

  checkPageBreak(ctx, estimatedHeight);

  const quoteTop = doc.y;

  // Render quote text first so we can measure the actual rendered height.
  // The accent bar is only 3pt wide and sits to the LEFT of the text (margin.left),
  // so drawing it after the text doesn't obscure anything.
  renderInlineSpans(ctx, quoteSpans, {
    x: margins.left + 14,
    y: quoteTop + 8,
    width: maxWidth,
    fontSize,
    italic: true,
    color: '#555',
  });

  const quoteBottom = doc.y + 8; // add small bottom padding

  // Left accent bar sized to actual text height
  doc.rect(margins.left, quoteTop, 3, quoteBottom - quoteTop).fill('#d0d7de');

  doc.fillColor('black').fontSize(fontSize).font('Helvetica');
  doc.moveDown(0.6);
}

const TABLE_FONT_SIZE = 10;
const TABLE_PADDING = 6;

/**
 * Measure the natural (unwrapped) width of a cell so columns can be sized by
 * their content instead of splitting the page into equal slices.
 */
function measureSpans(doc: any, spans: InlineSpan[], fontSize: number, bold: boolean): number {
  return cleanSpans(spans).reduce((total, span) => {
    doc.font(fontForSpan(span, bold)).fontSize(span.code ? fontSize * 0.94 : fontSize);
    // Only the longest source line matters: shorter ones never drive the width
    const longest = span.text.split('\n').reduce((a, b) => (a.length >= b.length ? a : b), '');
    return total + doc.widthOfString(longest);
  }, 0);
}

function measureSpansHeight(doc: any, spans: InlineSpan[], width: number, fontSize: number, bold: boolean): number {
  const lines = splitSpansIntoLines(cleanSpans(spans));
  let height = 0;

  for (const line of lines) {
    if (line.length === 0) {
      height += fontSize * 0.5;
      continue;
    }
    // Approximate the wrapped height by measuring the line as one string in the
    // dominant font; mixed fonts differ slightly but never by a whole line.
    const text = line.map((span) => span.text).join('');
    const bolded = line.some((span) => span.bold) || bold;
    doc.font(bolded ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    height += doc.heightOfString(text, { width });
  }

  return height;
}

function computeColumnWidths(doc: any, columns: InlineSpan[][][], totalWidth: number): number[] {
  const count = columns.length;
  const minWidth = Math.min(60, totalWidth / count);

  const natural = columns.map((cells, index) => {
    const widths = cells.map((cell, row) => measureSpans(doc, cell, TABLE_FONT_SIZE, row === 0));
    return Math.max(minWidth, Math.max(...widths, 0) + TABLE_PADDING * 2);
  });

  const naturalTotal = natural.reduce((a, b) => a + b, 0);
  if (naturalTotal <= totalWidth) {
    // Everything fits: hand the slack to the widest columns
    const slack = totalWidth - naturalTotal;
    return natural.map((w) => w + (slack * w) / naturalTotal);
  }

  // Too wide: cap greedy columns, then share the page proportionally
  const cap = totalWidth * 0.5;
  const weights = natural.map((w) => Math.min(w, cap));
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (totalWidth * w) / weightTotal);
}

export function renderTable(ctx: RenderContext, headers: RichText[], rows: RichText[][], spanData?: { headerSpans?: InlineSpan[][]; rowSpans?: InlineSpan[][][] }): void {
  const { doc, margins, pageWidth } = ctx;
  const totalWidth = pageWidth - margins.left - margins.right;

  const headerCells: InlineSpan[][] = spanData?.headerSpans?.length
    ? spanData.headerSpans
    : headers.map((h) => toSpans(h));
  const bodyCells: InlineSpan[][][] = spanData?.rowSpans?.length
    ? spanData.rowSpans
    : rows.map((row) => row.map((cell) => toSpans(cell)));

  if (headerCells.length === 0) return;

  // Columns as [header, ...cells] so widths account for every row
  const columns: InlineSpan[][][] = headerCells.map((header, col) => [
    header,
    ...bodyCells.map((row) => row[col] || []),
  ]);
  const colWidths = computeColumnWidths(doc, columns, totalWidth);
  const colX = colWidths.map((_, index) => margins.left + colWidths.slice(0, index).reduce((a, b) => a + b, 0));

  const rowHeight = (cells: InlineSpan[][], bold: boolean): number => {
    const contentHeight = Math.max(
      ...cells.map((cell, col) => measureSpansHeight(doc, cell, colWidths[col] - TABLE_PADDING * 2, TABLE_FONT_SIZE, bold)),
      TABLE_FONT_SIZE
    );
    return contentHeight + TABLE_PADDING * 2;
  };

  const drawRow = (cells: InlineSpan[][], height: number, bold: boolean, background?: string): void => {
    const top = doc.y;
    if (background) {
      doc.rect(margins.left, top, totalWidth, height).fill(background);
    }

    cells.forEach((cell, col) => {
      renderInlineSpans(ctx, cell, {
        x: colX[col] + TABLE_PADDING,
        y: top + TABLE_PADDING,
        width: colWidths[col] - TABLE_PADDING * 2,
        fontSize: TABLE_FONT_SIZE,
        bold,
      });
    });

    doc.y = top + height;
    doc.moveTo(margins.left, doc.y).lineTo(margins.left + totalWidth, doc.y).lineWidth(0.5).stroke('#ddd');
  };

  const headerHeight = rowHeight(headerCells, true);
  checkPageBreak(ctx, headerHeight * 2);

  let sectionTop = doc.y;
  drawRow(headerCells, headerHeight, true, '#f0f0f0');

  bodyCells.forEach((row, rowIndex) => {
    const cells = headerCells.map((_, col) => row[col] || []);
    const height = rowHeight(cells, false);

    if (doc.y + height > ctx.pageHeight - margins.bottom) {
      // Close the current chunk of the table, then repeat the header on the next page
      drawTableBorders(ctx, colX, sectionTop, doc.y, totalWidth);
      doc.addPage();
      sectionTop = doc.y;
      drawRow(headerCells, headerHeight, true, '#f0f0f0');
    }

    drawRow(cells, height, false, rowIndex % 2 === 0 ? '#fafafa' : undefined);
  });

  drawTableBorders(ctx, colX, sectionTop, doc.y, totalWidth);
  doc.moveDown(0.8);
}

function drawTableBorders(ctx: RenderContext, colX: number[], top: number, bottom: number, totalWidth: number): void {
  const { doc, margins } = ctx;

  for (let col = 1; col < colX.length; col++) {
    doc.moveTo(colX[col], top).lineTo(colX[col], bottom).lineWidth(0.5).stroke('#ddd');
  }
  doc.rect(margins.left, top, totalWidth, bottom - top).lineWidth(1).stroke('#999');
}

export function renderHorizontalRule(ctx: RenderContext): void {
  const { doc, margins, pageWidth } = ctx;

  checkPageBreak(ctx, 20);

  doc.moveDown(0.3);
  const y = doc.y;
  doc
    .moveTo(margins.left, y)
    .lineTo(pageWidth - margins.right, y)
    .lineWidth(1)
    .stroke('#ccc');
  doc.moveDown(0.6);
}

// Helper to render plain text paragraphs
export function renderText(ctx: RenderContext, content: RichText): void {
  const { doc, margins, pageWidth, options } = ctx;
  const fontSize = options.fontSize || 12;
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, fontSize * 3);

  renderInlineSpans(ctx, toSpans(content), {
    x: margins.left,
    y: doc.y,
    width: maxWidth,
    fontSize,
  });
  doc.moveDown(0.4);
}

export function renderInlineImage(ctx: RenderContext, imageData: Buffer, width?: number, height?: number): void {
  const { doc, pageWidth, margins } = ctx;
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, height || 200);

  const imgWidth = width ? Math.min(width, maxWidth) : maxWidth;
  const imgHeight = height || 150;

  doc.image(imageData, margins.left, doc.y, { width: imgWidth, height: imgHeight });
  doc.moveDown(0.5);
}
