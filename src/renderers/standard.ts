import PDFDocument from 'pdfkit';

/**
 * Remove characters outside the Basic Multilingual Plane that PDFKit's
 * built-in fonts (Helvetica, Courier, Times-Roman) cannot render.
 * Emoji and other non-BMP codepoints would appear as '?' or corrupt output.
 */
function sanitizeText(text: string): string {
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

export function renderHeading(ctx: RenderContext, level: number, content: string): void {
  const { doc, margins, pageWidth, options } = ctx;
  const sizes = [24, 20, 16, 14, 12, 10];
  const fontSize = options.fontSize ? options.fontSize * (sizes[level - 1] / 12) : sizes[level - 1];
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, fontSize * 2 + 20);

  // Add spacing above h2+ to visually separate sections
  if (level > 1) {
    doc.moveDown(0.5);
  }

  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('black');
  doc.text(sanitizeText(content), margins.left, doc.y, { width: maxWidth, continued: false });
  doc.moveDown(0.3);
}

export function renderList(ctx: RenderContext, items: string[], ordered: boolean): void {
  const { doc, margins, pageWidth, options } = ctx;
  const fontSize = options.fontSize || 12;
  const indent = 20;
  const maxWidth = pageWidth - margins.left - margins.right - indent;

  items.forEach((item, index) => {
    checkPageBreak(ctx, fontSize * 2);
    const prefix = ordered ? `${index + 1}.` : '•';

    doc.fontSize(fontSize).font('Helvetica').fillColor('black');
    // Capture Y before any text call so bullet and text share the same baseline
    const lineY = doc.y;
    doc.text(prefix, margins.left, lineY, { width: indent - 4, lineBreak: false });
    doc.text(sanitizeText(item), margins.left + indent, lineY, { width: maxWidth, continued: false });
  });

  doc.moveDown(0.3);
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

export function renderBlockquote(ctx: RenderContext, content: string): void {
  const { doc, margins, pageWidth } = ctx;
  const fontSize = ctx.options.fontSize || 12;
  const maxWidth = pageWidth - margins.left - margins.right - 30;
  const estimatedHeight = fontSize * 1.4 * (Math.ceil(content.length / 80) + 1) + 20;

  checkPageBreak(ctx, estimatedHeight);

  const quoteTop = doc.y;

  // Render quote text first so we can measure the actual rendered height.
  // The accent bar is only 3pt wide and sits to the LEFT of the text (margin.left),
  // so drawing it after the text doesn't obscure anything.
  doc.fontSize(fontSize).font('Helvetica-Oblique').fillColor('#555');
  doc.text(sanitizeText(content), margins.left + 14, quoteTop + 8, {
    width: maxWidth,
    lineBreak: true,
  });

  const quoteBottom = doc.y + 8; // add small bottom padding

  // Left accent bar sized to actual text height
  doc.rect(margins.left, quoteTop, 3, quoteBottom - quoteTop).fill('#d0d7de');

  doc.fillColor('black').fontSize(fontSize).font('Helvetica');
  doc.moveDown(0.6);
}

export function renderTable(ctx: RenderContext, headers: string[], rows: string[][]): void {
  const { doc, margins, pageWidth } = ctx;
  const fontSize = 10;
  const cellPadding = 6;
  const totalWidth = pageWidth - margins.left - margins.right;
  const colWidth = totalWidth / headers.length;

  // Estimate total height to check for page break
  const rowHeight = fontSize * 1.4 + cellPadding * 2;
  const totalHeight = rowHeight * (rows.length + 1) + 10;
  checkPageBreak(ctx, totalHeight);

  let tableTop = doc.y;

  // ── Header row ──────────────────────────────────────────────
  doc.rect(margins.left, tableTop, totalWidth, rowHeight).fill('#f0f0f0');

  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('black');
  headers.forEach((header, col) => {
    const x = margins.left + col * colWidth;
    doc.text(sanitizeText(header), x + cellPadding, tableTop + cellPadding, {
      width: colWidth - cellPadding * 2,
      lineBreak: false,
      ellipsis: true,
    });
  });

  // Bottom border of header
  let currentY = tableTop + rowHeight;
  doc.moveTo(margins.left, currentY).lineTo(margins.left + totalWidth, currentY).lineWidth(1).stroke('#999');

  // ── Data rows ──────────────────────────────────────────────
  doc.fontSize(fontSize).font('Helvetica').fillColor('black');

  rows.forEach((row, rowIndex) => {
    // Alternating row background
    if (rowIndex % 2 === 0) {
      doc.rect(margins.left, currentY, totalWidth, rowHeight).fill('#fafafa');
    }

    row.forEach((cell, col) => {
      const x = margins.left + col * colWidth;
      doc.fillColor('black');
      doc.text(sanitizeText(cell), x + cellPadding, currentY + cellPadding, {
        width: colWidth - cellPadding * 2,
        lineBreak: false,
        ellipsis: true,
      });
    });

    currentY += rowHeight;

    // Row separator
    doc.moveTo(margins.left, currentY).lineTo(margins.left + totalWidth, currentY).lineWidth(0.5).stroke('#ddd');
  });

  // ── Column separators ──────────────────────────────────────
  for (let col = 1; col < headers.length; col++) {
    const x = margins.left + col * colWidth;
    doc.moveTo(x, tableTop).lineTo(x, currentY).lineWidth(0.5).stroke('#ddd');
  }

  // Outer border
  doc.rect(margins.left, tableTop, totalWidth, currentY - tableTop).stroke('#999');

  // Advance cursor past the table
  doc.y = currentY;
  doc.moveDown(0.8);
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
export function renderText(ctx: RenderContext, content: string): void {
  const { doc, margins, pageWidth, options } = ctx;
  const fontSize = options.fontSize || 12;
  const maxWidth = pageWidth - margins.left - margins.right;

  checkPageBreak(ctx, fontSize * 3);

  doc.fontSize(fontSize).font('Helvetica').fillColor('black');
  doc.text(sanitizeText(content), margins.left, doc.y, { width: maxWidth, continued: false });
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
