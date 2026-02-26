import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generatePDF, generatePDFBuffer } from '../../src/pdf/generator.js';
import { parseMarkdown } from '../../src/parser/index.js';
import fs from 'fs';
import path from 'path';

describe('PDF Generator Integration Tests', () => {
  const testOutputDir = path.join(process.cwd(), '.test-outputs');

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      files.forEach((file) => {
        try {
          fs.unlinkSync(path.join(testOutputDir, file));
        } catch (e) {
          // ignore
        }
      });
      try {
        fs.rmdirSync(testOutputDir);
      } catch (e) {
        // ignore
      }
    }
  });

  describe('PDF Structure Validation', () => {
    it('should generate valid PDF with proper header and footer', async () => {
      const outputPath = path.join(testOutputDir, 'valid.pdf');
      const markdown = '# Test\n\nContent here';

      await generatePDF(markdown, outputPath);

      const content = fs.readFileSync(outputPath);
      const pdfString = content.toString('utf8');

      // PDF must start with header
      expect(pdfString.slice(0, 4)).toBe('%PDF');
      // PDF must have EOF marker
      expect(pdfString).toContain('%%EOF');
      // PDF must have trailer
      expect(pdfString).toContain('trailer');
    });

    it('should generate consistent PDF structure for same input', async () => {
      const markdown = '# Heading\n\nParagraph with content.';

      const buffer1 = await generatePDFBuffer(markdown);
      const buffer2 = await generatePDFBuffer(markdown);

      // Both should be valid PDFs
      expect(buffer1.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer2.toString('utf8', 0, 4)).toBe('%PDF');

      // Should have similar structure (minor differences ok due to timestamps)
      expect(Math.abs(buffer1.length - buffer2.length)).toBeLessThan(200);
    });
  });

  describe('Content Rendering Snapshots', () => {
    describe('Simple Elements', () => {
      it('should render heading correctly - snapshot', async () => {
        const markdown = '# Main Title';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        expect(ast[0].type).toBe('heading');
        expect(ast[0].content).toBe('Main Title');
        expect(ast[0].attrs?.level).toBe(1);
      });

      it('should render paragraph correctly - snapshot', async () => {
        const markdown = 'This is a simple paragraph.';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        expect(ast[0].type).toBe('paragraph');
        expect(ast[0].content).toBe('This is a simple paragraph.');
      });

      it('should render unordered list - snapshot', async () => {
        const markdown = '- Item 1\n- Item 2\n- Item 3';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        const list = ast.find((el) => el.type === 'list');
        expect(list?.attrs?.ordered).toBe(false);
        expect(list?.children).toHaveLength(3);
      });

      it('should render ordered list - snapshot', async () => {
        const markdown = '1. First\n2. Second\n3. Third';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        const list = ast.find((el) => el.type === 'list');
        expect(list?.attrs?.ordered).toBe(true);
      });
    });

    describe('Code and Quotes', () => {
      it('should render code block - snapshot', async () => {
        const markdown = '```javascript\nconst x = 42;\nconsole.log(x);\n```';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        const code = ast.find((el) => el.type === 'code');
        expect(code?.attrs?.lang).toBe('javascript');
        expect(code?.content).toContain('const x = 42');
      });

      it('should render blockquote - snapshot', async () => {
        const markdown = '> This is a famous quote\n> spanning multiple lines';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        const quote = ast.find((el) => el.type === 'blockquote');
        expect(quote?.type).toBe('blockquote');
      });
    });

    describe('Advanced Elements', () => {
      it('should render table - snapshot', async () => {
        const markdown = '| Header 1 | Header 2 |\n|----------|----------|\n| Data 1   | Data 2   |';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        const table = ast.find((el) => el.type === 'table');
        expect(table?.attrs?.headers).toContain('Header 1');
        expect(table?.attrs?.headers).toContain('Header 2');
        expect(table?.attrs?.rows).toHaveLength(1);
      });

      it('should render math expressions - snapshot', async () => {
        const markdown = 'Inline: $x^2$ and display: $$y = mx + b$$';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        expect(ast[0].hasMath).toBe(true);
      });

      it('should render horizontal rule - snapshot', async () => {
        const markdown = 'Before\n\n---\n\nAfter';
        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();
        expect(ast.some((el) => el.type === 'hr')).toBe(true);
      });
    });

    describe('Complex Documents - Full Snapshots', () => {
      it('should parse complete document correctly - snapshot', async () => {
        const markdown = `# Document Title

This is the introduction paragraph.

## Section 1

Here's a list:
- Item 1
- Item 2
- Item 3

### Subsection

Some code:
\`\`\`javascript
function demo() {
  return 42;
}
\`\`\`

## Section 2

| Feature | Status |
|---------|--------|
| Feature A | Done |
| Feature B | Done |

> Important quote here

---

Final section.`;

        const ast = parseMarkdown(markdown);

        expect(ast).toMatchSnapshot();

        // Verify structure
        expect(ast.some((el) => el.type === 'heading')).toBe(true);
        expect(ast.some((el) => el.type === 'paragraph')).toBe(true);
        expect(ast.some((el) => el.type === 'list')).toBe(true);
        expect(ast.some((el) => el.type === 'code')).toBe(true);
        expect(ast.some((el) => el.type === 'table')).toBe(true);
        expect(ast.some((el) => el.type === 'blockquote')).toBe(true);
        expect(ast.some((el) => el.type === 'hr')).toBe(true);
      });
    });
  });

  describe('PDF Generation with Content', () => {
    it('should generate PDF from heading - snapshot buffer size', async () => {
      const markdown = '# Main Heading\n\nSome content.';
      const buffer = await generatePDFBuffer(markdown);

      // Verify it's a valid PDF
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      // Should have reasonable size for this content
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.length).toBeLessThan(3000);

      expect({ size: buffer.length, isValid: buffer.toString('utf8', 0, 4) === '%PDF' }).toMatchSnapshot();
    });

    it('should generate PDF from lists - snapshot', async () => {
      const markdown = `# Lists

Unordered:
- First
- Second
- Third

Ordered:
1. One
2. Two
3. Three`;

      const buffer = await generatePDFBuffer(markdown);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);

      expect({ size: buffer.length }).toMatchSnapshot();
    });

    it('should generate PDF from code blocks - snapshot', async () => {
      const markdown = `# Code Example

\`\`\`python
def hello(name):
    print(f"Hello, {name}!")
    return True
\`\`\`

More text here.`;

      const buffer = await generatePDFBuffer(markdown);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);

      expect({ size: buffer.length }).toMatchSnapshot();
    });

    it('should generate PDF from table - snapshot', async () => {
      const markdown = `# Table Example

| Name | Age | City |
|------|-----|------|
| Alice | 30 | NYC |
| Bob | 25 | LA |
| Carol | 35 | Chicago |`;

      const buffer = await generatePDFBuffer(markdown);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);

      expect({ size: buffer.length }).toMatchSnapshot();
    });

    it('should handle multiline content properly - snapshot', async () => {
      const markdown = `# Main Title

This is paragraph one with multiple sentences.
It continues on the next line.

This is paragraph two.

\`\`\`
code block
with multiple
lines
\`\`\`

More text after code.

> A blockquote
> that spans
> multiple lines`;

      const buffer = await generatePDFBuffer(markdown);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');

      expect({ size: buffer.length }).toMatchSnapshot();
    });
  });

  describe('Edge Cases - Proper Handling', () => {
    it('should handle empty markdown gracefully', async () => {
      const buffer = await generatePDFBuffer('');
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle only whitespace', async () => {
      const buffer = await generatePDFBuffer('   \n\n   \n');
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle very long paragraphs', async () => {
      const longText = Array(500)
        .fill('This is a very long paragraph that continues indefinitely. ')
        .join('');
      const buffer = await generatePDFBuffer('# Long Content\n\n' + longText);

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should handle many headings without crashing', async () => {
      const headings = Array(50)
        .fill(0)
        .map((_, i) => `## Heading ${i + 1}\nContent for section ${i + 1}`)
        .join('\n\n');

      const buffer = await generatePDFBuffer(headings);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle nested lists (as much as markdown allows)', async () => {
      const markdown = `# List Test
- Item 1
- Item 2
  - Nested 1
  - Nested 2
- Item 3`;

      const ast = parseMarkdown(markdown);
      const list = ast.find((el) => el.type === 'list');
      expect(list?.children?.length).toBeGreaterThan(0);
    });
  });

  describe('Options Application', () => {
    it('should apply title option', async () => {
      const markdown = '# Content';
      const buffer = await generatePDFBuffer(markdown, { title: 'Custom Title' });

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      // Title is in PDF metadata
      expect(buffer.toString()).toContain('Custom Title');
    });

    it('should apply author option', async () => {
      const markdown = '# Content';
      const buffer = await generatePDFBuffer(markdown, { author: 'John Doe' });

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.toString()).toContain('John Doe');
    });

    it('should apply custom margins', async () => {
      const markdown = '# Test with Custom Margins\n\nContent here.';
      const buffer = await generatePDFBuffer(markdown, {
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
      });

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('should apply font size option', async () => {
      const markdown = '# Heading\n\nParagraph text with custom font size.';
      const buffer = await generatePDFBuffer(markdown, { fontSize: 16 });

      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(500);
    });
  });

  describe('File vs Buffer Consistency', () => {
    it('should produce similar output for file and buffer', async () => {
      const markdown = '# Consistent Output\n\n- Item 1\n- Item 2\n\nFinal text.';
      const outputPath = path.join(testOutputDir, 'consistency.pdf');

      await generatePDF(markdown, outputPath);
      const fileBuffer = fs.readFileSync(outputPath);
      const directBuffer = await generatePDFBuffer(markdown);

      // Both should be valid PDFs
      expect(fileBuffer.toString('utf8', 0, 4)).toBe('%PDF');
      expect(directBuffer.toString('utf8', 0, 4)).toBe('%PDF');

      // Size should be similar (timestamps might differ slightly)
      expect(Math.abs(fileBuffer.length - directBuffer.length)).toBeLessThan(200);
    });
  });
});
