import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/parser/index.js';

describe('Markdown Parser', () => {
  describe('headings', () => {
    it('should parse h1 heading', () => {
      const result = parseMarkdown('# Hello World');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('heading');
      expect(result[0].attrs?.level).toBe(1);
      expect(result[0].content).toBe('Hello World');
    });

    it('should parse multiple heading levels', () => {
      const result = parseMarkdown('# H1\n## H2\n### H3');
      expect(result).toHaveLength(3);
      expect(result[0].attrs?.level).toBe(1);
      expect(result[1].attrs?.level).toBe(2);
      expect(result[2].attrs?.level).toBe(3);
    });
  });

  describe('paragraphs', () => {
    it('should parse simple paragraph', () => {
      const result = parseMarkdown('This is a paragraph.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('paragraph');
      expect(result[0].content).toBe('This is a paragraph.');
    });

    it('should strip bold markers from paragraph', () => {
      const result = parseMarkdown('This is **bold** text.');
      expect(result[0].content).toBe('This is bold text.');
    });

    it('should strip italic markers from paragraph', () => {
      const result = parseMarkdown('This is *italic* text.');
      expect(result[0].content).toBe('This is italic text.');
    });

    it('should strip link syntax, keeping label', () => {
      const result = parseMarkdown('Click [here](https://example.com) for more.');
      expect(result[0].content).toBe('Click here for more.');
    });

    it('should strip inline code backticks', () => {
      const result = parseMarkdown('Use `console.log` to debug.');
      expect(result[0].content).toBe('Use console.log to debug.');
    });

    it('should parse multiple paragraphs', () => {
      const result = parseMarkdown('First paragraph\n\nSecond paragraph');
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('paragraph');
      expect(result[1].type).toBe('paragraph');
    });

    it('should detect math in paragraphs', () => {
      const result = parseMarkdown('This has inline math: $x^2$');
      expect(result[0].hasMath).toBe(true);
    });

    it('should detect display math in paragraphs', () => {
      const result = parseMarkdown('Equation: \\(x + y = z\\)');
      expect(result[0].hasMath).toBe(true);
    });
  });

  describe('lists', () => {
    it('should parse unordered list', () => {
      const result = parseMarkdown('- Item 1\n- Item 2\n- Item 3');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('list');
      expect(result[0].attrs?.ordered).toBe(false);
      expect(result[0].children).toHaveLength(3);
    });

    it('should parse ordered list', () => {
      const result = parseMarkdown('1. First\n2. Second\n3. Third');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('list');
      expect(result[0].attrs?.ordered).toBe(true);
      expect(result[0].children).toHaveLength(3);
    });

    it('should extract list item content', () => {
      const result = parseMarkdown('- Item 1\n- Item 2');
      const children = result[0].children || [];
      expect(children[0].content).toBe('Item 1');
      expect(children[1].content).toBe('Item 2');
    });
  });

  describe('mermaid', () => {
    it('should parse mermaid fenced code block as mermaid type', () => {
      const result = parseMarkdown('```mermaid\ngraph TD\n  A --> B\n```');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('mermaid');
      expect(result[0].content).toContain('graph TD');
    });

    it('should not parse non-mermaid fences as mermaid', () => {
      const result = parseMarkdown('```javascript\nconst x = 1;\n```');
      expect(result[0].type).toBe('code');
    });
  });

  describe('code blocks', () => {
    it('should parse fenced code block', () => {
      const result = parseMarkdown('```javascript\nconst x = 5;\n```');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('code');
      expect(result[0].attrs?.lang).toBe('javascript');
      expect(result[0].content?.includes('const x = 5')).toBe(true);
    });

    it('should parse code block without language', () => {
      const result = parseMarkdown('```\nplain code\n```');
      expect(result[0].type).toBe('code');
      expect(result[0].attrs?.lang).toBe('');
    });

    it('should preserve code formatting', () => {
      const code = 'function hello() {\n  console.log("world");\n}';
      const result = parseMarkdown('```\n' + code + '\n```');
      expect(result[0].content).toContain('function hello');
      expect(result[0].content).toContain('console.log');
    });
  });

  describe('blockquotes', () => {
    it('should parse blockquote without duplicating as paragraph', () => {
      const result = parseMarkdown('> This is a quote');
      // Must produce exactly ONE element — the bug was producing a duplicate paragraph
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('blockquote');
      expect(result[0].content).toBe('This is a quote');
    });

    it('should parse multi-line blockquote', () => {
      const result = parseMarkdown('> First line\n> Second line');
      expect(result[0].type).toBe('blockquote');
      expect(result[0].content).toContain('First line');
      expect(result[0].content).toContain('Second line');
    });
  });

  describe('horizontal rules', () => {
    it('should parse horizontal rule', () => {
      const result = parseMarkdown('---');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('hr');
    });

    it('should parse hr with surrounding content', () => {
      const result = parseMarkdown('Before\n\n---\n\nAfter');
      expect(result.some((el) => el.type === 'hr')).toBe(true);
    });
  });

  describe('tables', () => {
    it('should parse simple table', () => {
      const markdown = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
      const result = parseMarkdown(markdown);
      expect(result.some((el) => el.type === 'table')).toBe(true);
    });

    it('should extract table headers', () => {
      const markdown = '| Col A | Col B |\n|-------|-------|\n| A1    | B1    |';
      const result = parseMarkdown(markdown);
      const table = result.find((el) => el.type === 'table');
      expect(table?.attrs?.headers).toContain('Col A');
      expect(table?.attrs?.headers).toContain('Col B');
    });

    it('should extract table rows', () => {
      const markdown = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
      const result = parseMarkdown(markdown);
      const table = result.find((el) => el.type === 'table');
      expect(table?.attrs?.rows).toHaveLength(2);
    });
  });

  describe('mixed content', () => {
    it('should parse heading followed by paragraph', () => {
      const result = parseMarkdown('# Title\n\nDescription here');
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('heading');
      expect(result[1].type).toBe('paragraph');
    });

    it('should parse complex document', () => {
      const markdown = `# Main Title

Introduction paragraph.

## Section 1

Some content here.

- List item 1
- List item 2

\`\`\`javascript
console.log("hello");
\`\`\`

> A quote`;

      const result = parseMarkdown(markdown);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((el) => el.type === 'heading')).toBe(true);
      expect(result.some((el) => el.type === 'paragraph')).toBe(true);
      expect(result.some((el) => el.type === 'list')).toBe(true);
      expect(result.some((el) => el.type === 'code')).toBe(true);
      expect(result.some((el) => el.type === 'blockquote')).toBe(true);
    });
  });
});

describe('Inline formatting', () => {
  it('should mark bold spans', () => {
    const result = parseMarkdown('plain **bold** plain');
    const spans = result[0].spans || [];
    expect(spans.map((s) => s.text)).toEqual(['plain ', 'bold', ' plain']);
    expect(spans[1].bold).toBe(true);
  });

  it('should mark italic spans', () => {
    const spans = parseMarkdown('an *emphasis* here')[0].spans || [];
    expect(spans.find((s) => s.text === 'emphasis')?.italic).toBe(true);
  });

  it('should mark inline code spans', () => {
    const spans = parseMarkdown('use `npm test` now')[0].spans || [];
    expect(spans.find((s) => s.text === 'npm test')?.code).toBe(true);
  });

  it('should keep the link target on link spans', () => {
    const spans = parseMarkdown('see [docs](https://example.com/x)')[0].spans || [];
    expect(spans.find((s) => s.text === 'docs')?.link).toBe('https://example.com/x');
  });

  it('should combine nested bold and italic', () => {
    const spans = parseMarkdown('***both***')[0].spans || [];
    expect(spans[0].bold).toBe(true);
    expect(spans[0].italic).toBe(true);
  });

  it('should keep source line breaks inside a paragraph', () => {
    const result = parseMarkdown('first sentence.\nsecond sentence.');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('first sentence.\nsecond sentence.');
    expect((result[0].spans || [])[0].text).toContain('\n');
  });

  it('should give headings spans too', () => {
    const spans = parseMarkdown('# A **bold** title')[0].spans || [];
    expect(spans.find((s) => s.text === 'bold')?.bold).toBe(true);
  });
});

describe('List structure', () => {
  it('should keep line breaks inside a list item', () => {
    const items = parseMarkdown('1. first line\n   second line')[0].children || [];
    expect(items[0].content).toBe('first line\nsecond line');
  });

  it('should keep every paragraph of a loose list item', () => {
    const items = parseMarkdown('- one\n\n- two\n\n  three')[0].children || [];
    expect(items[1].content).toBe('two\nthree');
  });

  it('should format list item content', () => {
    const items = parseMarkdown('- an **important** item')[0].children || [];
    expect((items[0].spans || []).find((s) => s.text === 'important')?.bold).toBe(true);
  });

  it('should nest sub-lists under their parent item', () => {
    const list = parseMarkdown('- parent\n  - child one\n  - child two');
    expect(list).toHaveLength(1);
    const items = list[0].children || [];
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('parent');
    const nested = items[0].children || [];
    expect(nested).toHaveLength(1);
    expect(nested[0].type).toBe('list');
    expect(nested[0].children).toHaveLength(2);
  });

  it('should honour the start number of an ordered list', () => {
    const list = parseMarkdown('3. three\n4. four')[0];
    expect(list.attrs?.start).toBe(3);
  });
});

describe('Table cells', () => {
  it('should keep formatting in header and body cells', () => {
    const table = parseMarkdown('| **H** | B |\n|---|---|\n| `code` | [l](https://e.com) |')[0];
    expect(table.attrs?.headerSpans[0][0].bold).toBe(true);
    expect(table.attrs?.rowSpans[0][0][0].code).toBe(true);
    expect(table.attrs?.rowSpans[0][1][0].link).toBe('https://e.com');
  });
});
