import { describe, it, expect } from 'vitest';
import { cleanSpans, fontForSpan, splitSpansIntoLines, spansToPlainText } from '../../src/renderers/inline.js';

describe('Inline spans', () => {
  describe('fontForSpan', () => {
    it('should use Helvetica for plain text', () => {
      expect(fontForSpan({ text: 'a' })).toBe('Helvetica');
    });

    it('should use Helvetica-Bold for bold spans', () => {
      expect(fontForSpan({ text: 'a', bold: true })).toBe('Helvetica-Bold');
    });

    it('should use Helvetica-Oblique for italic spans', () => {
      expect(fontForSpan({ text: 'a', italic: true })).toBe('Helvetica-Oblique');
    });

    it('should combine bold and italic', () => {
      expect(fontForSpan({ text: 'a', bold: true, italic: true })).toBe('Helvetica-BoldOblique');
    });

    it('should use Courier for code spans', () => {
      expect(fontForSpan({ text: 'a', code: true })).toBe('Courier');
      expect(fontForSpan({ text: 'a', code: true, bold: true })).toBe('Courier-Bold');
    });

    it('should apply the base style when the span has none', () => {
      expect(fontForSpan({ text: 'a' }, true)).toBe('Helvetica-Bold');
      expect(fontForSpan({ text: 'a' }, false, true)).toBe('Helvetica-Oblique');
    });
  });

  describe('splitSpansIntoLines', () => {
    it('should keep a single line as one line', () => {
      const lines = splitSpansIntoLines([{ text: 'hello world' }]);
      expect(lines).toHaveLength(1);
      expect(spansToPlainText(lines[0])).toBe('hello world');
    });

    it('should split on newlines inside a span', () => {
      const lines = splitSpansIntoLines([{ text: 'one\ntwo' }]);
      expect(lines).toHaveLength(2);
      expect(spansToPlainText(lines[0])).toBe('one');
      expect(spansToPlainText(lines[1])).toBe('two');
    });

    it('should split across spans and keep formatting', () => {
      const lines = splitSpansIntoLines([
        { text: 'bold', bold: true },
        { text: ' tail\nsecond line' },
      ]);
      expect(lines).toHaveLength(2);
      expect(lines[0][0].bold).toBe(true);
      expect(spansToPlainText(lines[0])).toBe('bold tail');
      expect(spansToPlainText(lines[1])).toBe('second line');
    });

    it('should produce an empty line for a blank source line', () => {
      const lines = splitSpansIntoLines([{ text: 'a\n\nb' }]);
      expect(lines).toHaveLength(3);
      expect(lines[1]).toHaveLength(0);
    });
  });

  describe('cleanSpans', () => {
    it('should drop spans that sanitize to nothing', () => {
      const spans = cleanSpans([{ text: '🎉' }, { text: 'ok' }]);
      expect(spans).toHaveLength(1);
      expect(spans[0].text).toBe('ok');
    });

    it('should keep line breaks intact', () => {
      expect(cleanSpans([{ text: 'a\nb' }])[0].text).toBe('a\nb');
    });
  });
});
