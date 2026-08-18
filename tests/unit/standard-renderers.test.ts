import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkPageBreak,
  renderHeading,
  renderList,
  renderCodeBlock,
  renderBlockquote,
  renderTable,
} from '../../src/renderers/standard.js';
import type { RenderContext } from '../../src/renderers/standard.js';

describe('Standard Renderers', () => {
  let mockDoc: any;
  let ctx: RenderContext;

  beforeEach(() => {
    const rectChain: any = {
      fillAndStroke: vi.fn().mockReturnThis(),
      fill: vi.fn().mockReturnThis(),
      stroke: vi.fn().mockReturnThis(),
    };
    rectChain.lineWidth = vi.fn().mockReturnValue(rectChain);

    const lineChain = {
      lineWidth: vi.fn().mockReturnValue({
        stroke: vi.fn().mockReturnThis(),
      }),
    };

    mockDoc = {
      y: 100,
      fontSize: vi.fn().mockReturnThis(),
      font: vi.fn().mockReturnThis(),
      fillColor: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      moveDown: vi.fn().mockReturnThis(),
      widthOfString: vi.fn().mockReturnValue(60),
      heightOfString: vi.fn().mockReturnValue(12),
      addPage: vi.fn().mockReturnThis(),
      rect: vi.fn().mockReturnValue(rectChain),
      moveTo: vi.fn().mockReturnValue({
        lineTo: vi.fn().mockReturnValue(lineChain),
      }),
      lineTo: vi.fn().mockReturnThis(),
      lineWidth: vi.fn().mockReturnThis(),
      stroke: vi.fn().mockReturnThis(),
    };

    ctx = {
      doc: mockDoc,
      y: 100,
      pageWidth: 612,
      pageHeight: 792,
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      options: { fontSize: 12, lineHeight: 1.6 },
    };
  });

  describe('checkPageBreak', () => {
    it('should not add page when content fits', () => {
      ctx.doc.y = 400;
      checkPageBreak(ctx, 200);
      expect(mockDoc.addPage).not.toHaveBeenCalled();
    });

    it('should add page when content does not fit', () => {
      ctx.doc.y = 700;
      checkPageBreak(ctx, 200);
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should consider bottom margin', () => {
      ctx.doc.y = 650;
      ctx.margins.bottom = 100;
      checkPageBreak(ctx, 100);
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should not add page when content fits exactly', () => {
      ctx.doc.y = 792 - 72 - 100;
      checkPageBreak(ctx, 100);
      expect(mockDoc.addPage).not.toHaveBeenCalled();
    });
  });

  describe('renderHeading', () => {
    it('should use Helvetica-Bold font', () => {
      renderHeading(ctx, 1, 'Main Title');
      expect(mockDoc.font).toHaveBeenCalledWith('Helvetica-Bold');
    });

    it('should render h1 at 24pt', () => {
      renderHeading(ctx, 1, 'Title');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(24);
    });

    it('should render h2 at 20pt', () => {
      renderHeading(ctx, 2, 'Subtitle');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(20);
    });

    it('should render h3 at 16pt', () => {
      renderHeading(ctx, 3, 'Sub');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(16);
    });

    it('should render h6 at 10pt', () => {
      renderHeading(ctx, 6, 'Tiny');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(10);
    });

    it('should pass content to doc.text', () => {
      renderHeading(ctx, 1, 'Main Title');
      // text is called with (content, x, y, options)
      expect(mockDoc.text).toHaveBeenCalledWith('Main Title', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should call moveDown after heading', () => {
      renderHeading(ctx, 1, 'Title');
      expect(mockDoc.moveDown).toHaveBeenCalled();
    });

    it('should scale font with custom fontSize option', () => {
      ctx.options.fontSize = 16;
      renderHeading(ctx, 1, 'Title');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(16 * (24 / 12));
    });
  });

  describe('renderList', () => {
    it('should make two doc.text calls per item (bullet + content)', () => {
      renderList(ctx, ['Item 1', 'Item 2', 'Item 3'], false);
      // 2 calls per item = 6 total
      expect(mockDoc.text).toHaveBeenCalledTimes(6);
    });

    it('should render bullet prefix for unordered list', () => {
      renderList(ctx, ['Item'], false);
      expect(mockDoc.text).toHaveBeenCalledWith('•', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should render number prefix for ordered list', () => {
      renderList(ctx, ['First', 'Second', 'Third'], true);
      expect(mockDoc.text).toHaveBeenCalledWith('1.', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockDoc.text).toHaveBeenCalledWith('2.', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockDoc.text).toHaveBeenCalledWith('3.', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should render item text as separate call', () => {
      renderList(ctx, ['Hello'], false);
      expect(mockDoc.text).toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should not call text for empty list', () => {
      renderList(ctx, [], false);
      expect(mockDoc.text).not.toHaveBeenCalled();
    });

    it('should use Helvetica font', () => {
      renderList(ctx, ['Item'], false);
      expect(mockDoc.font).toHaveBeenCalledWith('Helvetica');
    });

    it('should call moveDown after list', () => {
      renderList(ctx, ['A', 'B'], false);
      expect(mockDoc.moveDown).toHaveBeenCalled();
    });
  });

  describe('renderCodeBlock', () => {
    it('should draw a background rect', () => {
      renderCodeBlock(ctx, 'const x = 5;', 'javascript');
      expect(mockDoc.rect).toHaveBeenCalled();
      const chain = mockDoc.rect.mock.results[0].value;
      expect(chain.fillAndStroke).toHaveBeenCalled();
    });

    it('should use Courier font', () => {
      renderCodeBlock(ctx, 'code', 'javascript');
      expect(mockDoc.font).toHaveBeenCalledWith('Courier');
    });

    it('should render all code with a single text call', () => {
      // New impl passes the whole code string as one doc.text call
      renderCodeBlock(ctx, 'line 1\nline 2\nline 3', 'javascript');
      expect(mockDoc.text).toHaveBeenCalledTimes(1);
    });

    it('should use fontSize 10 for code', () => {
      renderCodeBlock(ctx, 'code', '');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(10);
    });

    it('should pass x and y explicitly to text', () => {
      renderCodeBlock(ctx, 'code', 'js');
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number), // x inside box
        expect.any(Number), // y inside box
        expect.any(Object)
      );
    });
  });

  describe('renderBlockquote', () => {
    it('should draw a rect for the left border accent', () => {
      renderBlockquote(ctx, 'Quote text');
      // New impl uses rect().fill() for the left accent bar
      expect(mockDoc.rect).toHaveBeenCalled();
      const chain = mockDoc.rect.mock.results[0].value;
      expect(chain.fill).toHaveBeenCalled();
    });

    it('should use Helvetica-Oblique (italic) font', () => {
      renderBlockquote(ctx, 'Quote');
      expect(mockDoc.font).toHaveBeenCalledWith('Helvetica-Oblique');
    });

    it('should render quote text with explicit position', () => {
      renderBlockquote(ctx, 'Famous quote');
      expect(mockDoc.text).toHaveBeenCalledWith(
        'Famous quote',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should use muted grey color for text', () => {
      renderBlockquote(ctx, 'Quote');
      expect(mockDoc.fillColor).toHaveBeenCalledWith('#555');
    });

    it('should reset color to black after blockquote', () => {
      renderBlockquote(ctx, 'Quote');
      expect(mockDoc.fillColor).toHaveBeenCalledWith('black');
    });
  });

  describe('renderTable', () => {
    it('should render headers', () => {
      renderTable(ctx, ['H1', 'H2'], [['A', 'B']]);
      expect(mockDoc.text).toHaveBeenCalledWith('H1', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockDoc.text).toHaveBeenCalledWith('H2', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should render data cells', () => {
      renderTable(ctx, ['H1', 'H2'], [['A', 'B'], ['C', 'D']]);
      expect(mockDoc.text).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockDoc.text).toHaveBeenCalledWith('D', expect.any(Number), expect.any(Number), expect.any(Object));
    });

    it('should draw header background rect', () => {
      renderTable(ctx, ['H1'], [['R1']]);
      expect(mockDoc.rect).toHaveBeenCalled();
    });

    it('should draw column separator lines', () => {
      renderTable(ctx, ['A', 'B', 'C'], [['1', '2', '3']]);
      // Should draw column separators (one per divider between columns)
      expect(mockDoc.moveTo).toHaveBeenCalled();
    });

    it('should use Helvetica-Bold for headers', () => {
      renderTable(ctx, ['H1'], []);
      expect(mockDoc.font).toHaveBeenCalledWith('Helvetica-Bold');
    });

    it('should use Helvetica for data rows', () => {
      renderTable(ctx, ['H1'], [['D1']]);
      expect(mockDoc.font).toHaveBeenCalledWith('Helvetica');
    });

    it('should handle empty rows', () => {
      renderTable(ctx, ['Header'], []);
      expect(mockDoc.text).toHaveBeenCalledWith('Header', expect.any(Number), expect.any(Number), expect.any(Object));
    });
  });

  describe('Font and styling consistency', () => {
    it('should use black fillColor for headings', () => {
      renderHeading(ctx, 1, 'Title');
      expect(mockDoc.fillColor).toHaveBeenCalledWith('black');
    });

    it('should use black fillColor for lists', () => {
      renderList(ctx, ['Item'], false);
      expect(mockDoc.fillColor).toHaveBeenCalledWith('black');
    });
  });
});
