import { InlineSpan } from '../types.js';
import { sanitizeText, type RenderContext } from './standard.js';

export interface InlineTextOptions {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  /** Base style applied to every span (headings render bold, quotes italic). */
  bold?: boolean;
  italic?: boolean;
  color?: string;
  lineGap?: number;
}

const LINK_COLOR = '#0b5cad';

export function fontForSpan(span: InlineSpan, baseBold = false, baseItalic = false): string {
  const bold = span.bold || baseBold;
  const italic = span.italic || baseItalic;

  if (span.code) {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }

  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

/** Spans with all text sanitized and empty runs dropped. */
export function cleanSpans(spans: InlineSpan[]): InlineSpan[] {
  return spans
    .map((span) => ({ ...span, text: sanitizeText(span.text) }))
    .filter((span) => span.text.length > 0);
}

export function spansToPlainText(spans: InlineSpan[]): string {
  return spans.map((span) => span.text).join('');
}

/** Split runs into lines: a `\n` inside a run starts a new line. */
export function splitSpansIntoLines(spans: InlineSpan[]): InlineSpan[][] {
  const lines: InlineSpan[][] = [[]];

  for (const span of spans) {
    const pieces = span.text.split('\n');
    pieces.forEach((piece, index) => {
      if (index > 0) lines.push([]);
      if (piece.length > 0) lines[lines.length - 1].push({ ...span, text: piece });
    });
  }

  return lines;
}

/**
 * Render formatted runs, one source line at a time.
 *
 * PDFKit mispositions the line that follows a `\n` inside a `continued` run,
 * so line breaks are handled here: each source line is its own sequence of
 * continued calls, anchored at the same x, and wraps within `width` as usual.
 */
export function renderInlineSpans(ctx: RenderContext, spans: InlineSpan[], opts: InlineTextOptions): void {
  const { doc } = ctx;
  const lines = splitSpansIntoLines(cleanSpans(spans));
  const codeSize = opts.fontSize * 0.94;
  let isFirstLine = true;

  for (const line of lines) {
    if (line.length === 0) {
      // Blank line between paragraphs of the same block
      if (!isFirstLine) doc.moveDown(0.35);
      continue;
    }

    const y = isFirstLine ? opts.y : doc.y;

    line.forEach((span, index) => {
      const isLast = index === line.length - 1;

      doc
        .font(fontForSpan(span, opts.bold, opts.italic))
        .fontSize(span.code ? codeSize : opts.fontSize)
        .fillColor(span.link ? LINK_COLOR : opts.color || 'black');

      // PDFKit carries options over between `continued` calls, so every optional
      // flag has to be reset explicitly or a single link would swallow the rest.
      const textOptions: any = {
        width: opts.width,
        continued: !isLast,
        link: span.link || null,
        underline: false,
        lineGap: opts.lineGap ?? 0,
      };

      if (index === 0) {
        doc.text(span.text, opts.x, y, textOptions);
      } else {
        doc.text(span.text, textOptions);
      }
    });

    isFirstLine = false;
  }

  doc.fillColor('black').font('Helvetica').fontSize(opts.fontSize);
}
