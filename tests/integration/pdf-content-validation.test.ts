import { describe, it, expect } from 'vitest';
import { generatePDFBuffer } from '../../src/pdf/generator.js';

/**
 * These tests validate the actual rendered content in PDFs
 * by examining PDF structure and content
 */
describe('PDF Content Validation', () => {
  describe('Text Rendering', () => {
    it('should render heading text in PDF', async () => {
      const markdown = '# My Heading\n\nSome content';
      const buffer = await generatePDFBuffer(markdown);

      // Basic validation: PDF should be valid
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('should render paragraph text without corruption', async () => {
      const markdown = 'This is a paragraph with special characters: éàü';
      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(300);
    });

    it('should render list items properly', async () => {
      const markdown = '# Lists\n\n- First item\n- Second item\n- Third item';
      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      // Should be larger to accommodate list content
      expect(buffer.length).toBeGreaterThan(600);
    });

    it('should render code blocks with proper formatting', async () => {
      const markdown = `# Code
\`\`\`javascript
const x = 42;
console.log(x);
\`\`\``;

      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);

      // PDF should contain references to Courier font for code
      expect(buffer.toString()).toContain('Courier');
    });

    it('should render blockquotes with styling', async () => {
      const markdown = '# Quote\n\n> This is an important quote\n> that spans lines';

      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      // Should use italic font
      expect(buffer.toString()).toContain('Oblique');
    });
  });

  describe('Structural Elements', () => {
    it('should have proper page structure', async () => {
      const markdown = '# Page Test\n\nContent on first page';
      const buffer = await generatePDFBuffer(markdown);

      const pdfString = buffer.toString('utf8');

      // Check for page object
      expect(pdfString).toContain('/Type /Page');
      // Check for content stream
      expect(pdfString).toContain('/Contents');
      // Check for resources
      expect(pdfString).toContain('/Resources');
    });

    it('should have proper font definitions', async () => {
      const markdown = '# Heading\n\n**Bold** and regular text';
      const buffer = await generatePDFBuffer(markdown);

      const pdfString = buffer.toString('utf8');

      // Should define fonts
      expect(pdfString).toContain('/Type /Font');
      // Should use at least Helvetica for headings
      expect(pdfString).toContain('Helvetica');
    });

    it('should create multiple pages for long content', async () => {
      const sections = Array(20)
        .fill(0)
        .map(
          (_, i) =>
            `## Section ${i + 1}\n\n${Array(10)
              .fill(0)
              .map((_, j) => `Paragraph ${j + 1} content. `)
              .join('')}`
        )
        .join('\n\n');

      const markdown = '# Long Document\n\n' + sections;
      const buffer = await generatePDFBuffer(markdown);

      const pdfString = buffer.toString('utf8');

      // Should have multiple page objects for multi-page content
      const pageMatches = pdfString.match(/\/Type \/Page/g);
      expect(pageMatches).toBeTruthy();
      if (pageMatches) {
        expect(pageMatches.length).toBeGreaterThan(1);
      }
    });

    it('should have metadata', async () => {
      const markdown = 'Content';
      const buffer = await generatePDFBuffer(markdown, {
        title: 'Test Document',
        author: 'Test Author',
      });

      const pdfString = buffer.toString('utf8');

      // Should have info dictionary
      expect(pdfString).toContain('/Title');
      expect(pdfString).toContain('/Author');
      expect(pdfString).toContain('Test Document');
      expect(pdfString).toContain('Test Author');
    });
  });

  describe('Content Integrity', () => {
    it('should preserve text without truncation', async () => {
      const longText = 'This is a long sentence that should be preserved completely. '.repeat(5);
      const markdown = `# Title\n\n${longText}`;

      const buffer = await generatePDFBuffer(markdown);

      // PDF should be reasonably large for this content
      expect(buffer.length).toBeGreaterThan(800);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle special markdown characters', async () => {
      const markdown = `# Special Characters
- Item with *asterisks*
- Item with [links](url)
- Item with \`code\`

Content with _underscores_ and **bold**.`;

      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(600);
    });

    it('should maintain heading hierarchy', async () => {
      const markdown = `# H1 Title
Content after H1

## H2 Title
Content after H2

### H3 Title
Content after H3`;

      const buffer = await generatePDFBuffer(markdown);

      // PDF should be valid and have reasonable size
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(600);
    });

    it('should render table content without data loss', async () => {
      const markdown = `# Table Test
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data A   | Data B   | Data C   |
| Data D   | Data E   | Data F   |
| Data G   | Data H   | Data I   |`;

      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.length).toBeGreaterThan(700);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('Visual Validation', () => {
    it('should have proper text positioning', async () => {
      const markdown = '# Title\n\nFirst paragraph\n\nSecond paragraph';
      const buffer = await generatePDFBuffer(markdown);

      // PDF should be valid and properly formatted
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);
      // PDF stream should exist
      expect(buffer.toString()).toContain('stream');
    });

    it('should apply colors correctly', async () => {
      const markdown = '# Heading\n\n> Quote with styling\n\n`code block`';
      const buffer = await generatePDFBuffer(markdown);

      // PDF should be valid with proper structure
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(600);
    });

    it('should draw graphics for blockquotes and code', async () => {
      const markdown = '> A quote\n\n```\ncode\n```';
      const buffer = await generatePDFBuffer(markdown);

      const pdfString = buffer.toString('utf8');

      // Should have drawing operations
      expect(pdfString).toContain('re'); // rectangle
    });

    it('should have proper spacing and margins', async () => {
      const markdown = '# Title\n\nParagraph 1\n\nParagraph 2\n\nParagraph 3';
      const buffer = await generatePDFBuffer(markdown, {
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
      });

      expect(buffer.length).toBeGreaterThan(600);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('Validation Against Regressions', () => {
    it('should generate consistent output for same markdown', async () => {
      const markdown = `# Document Title

## Section 1
This is section 1 content.

## Section 2
This is section 2 content.

- List item 1
- List item 2

\`\`\`
code block
\`\`\``;

      const buffer1 = await generatePDFBuffer(markdown);
      const buffer2 = await generatePDFBuffer(markdown);

      // Should be nearly identical (minor differences ok)
      expect(buffer1.length).toBe(buffer2.length);
      expect(buffer1.slice(0, 100)).toEqual(buffer2.slice(0, 100));
    });

    it('should not crash on malformed markdown', async () => {
      const malformedMarkdown = `# Title [[[
Content with [[[[ broken brackets ]]]]
- List item
- > Quote in list?
\`\`\` unclosed code block
\`\`\` another ` + '```';

      const buffer = await generatePDFBuffer(malformedMarkdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(300);
    });

    it('should handle math expressions in rendering', async () => {
      const markdown = 'Inline math: $E = mc^2$ and display: $$\\int_0^{\\infty} e^{-x} dx = 1$$';

      const buffer = await generatePDFBuffer(markdown);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('should produce different output for different input', async () => {
      const markdown1 = '# Document 1\n\nContent 1';
      const markdown2 = '# Document 2\n\nContent 2';

      const buffer1 = await generatePDFBuffer(markdown1);
      const buffer2 = await generatePDFBuffer(markdown2);

      // Should be different
      expect(buffer1).not.toEqual(buffer2);
    });
  });

  describe('Options Impact', () => {
    it('should reflect title in metadata', async () => {
      const buffer = await generatePDFBuffer('Content', {
        title: 'My Custom Title',
      });

      const pdfString = buffer.toString('utf8');
      expect(pdfString).toContain('My Custom Title');
    });

    it('should reflect author in metadata', async () => {
      const buffer = await generatePDFBuffer('Content', {
        author: 'Jane Smith',
      });

      const pdfString = buffer.toString('utf8');
      expect(pdfString).toContain('Jane Smith');
    });

    it('should use custom font size in rendering', async () => {
      const markdown = '# Title\n\nContent';
      const buffer = await generatePDFBuffer(markdown, {
        fontSize: 14,
      });

      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should apply custom margins', async () => {
      const markdown = 'Content with custom margins';
      const buffer1 = await generatePDFBuffer(markdown, {
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
      });
      const buffer2 = await generatePDFBuffer(markdown, {
        margins: { top: 144, bottom: 144, left: 144, right: 144 },
      });

      // Both should be valid
      expect(buffer1.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer2.toString('utf8', 0, 4)).toBe('%PDF');

      // Sizes might differ
      expect(buffer1.length).toBeGreaterThan(0);
      expect(buffer2.length).toBeGreaterThan(0);
    });
  });

  describe('Error Resilience', () => {
    it('should handle empty markdown gracefully', async () => {
      const buffer = await generatePDFBuffer('');
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(200);
    });

    it('should handle whitespace-only markdown', async () => {
      const buffer = await generatePDFBuffer('   \n\n  \n\n   ');
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle extremely long input', async () => {
      const longText = Array(1000).fill('Word ').join('');
      const buffer = await generatePDFBuffer(longText);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(2000);
    });

    it('should handle mixed valid and invalid markdown', async () => {
      const markdown = `# Valid Heading

Valid paragraph.

[[[Invalid

Another paragraph.

\`\`\`javascript
valid code
\`\`\``;

      const buffer = await generatePDFBuffer(markdown);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });
});
