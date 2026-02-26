# Testing Guide

This document covers the automated test suite for the markdown-to-pdf converter.

## Quick Start

Run all tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Generate coverage report:
```bash
npm run test:coverage
```

Update snapshots (when you intentionally change output):
```bash
npm test -- -u
```

## Test Overview

**Total Tests: 149**
- ✅ **Unit Tests: 93** - Test individual components in isolation
- ✅ **Integration Tests: 27** - Test full PDF generation pipeline
- ✅ **Content Validation Tests: 29** - Validate actual PDF content and structure

### Test Files

#### Snapshot Tests

**Snapshots captured: 15**

Snapshots validate:
- ✅ **AST Structure** - Correct parsing of markdown to abstract syntax trees
- ✅ **PDF Sizes** - Consistent file sizes for same content (catches layout regressions)
- ✅ **Content Parsing** - Full document structure validation

Location: `tests/integration/__snapshots__/pdf-generation.test.ts.snap`

When output changes intentionally:
```bash
npm test -- -u  # Update snapshots
```

#### Unit Tests

**1. `tests/unit/parser.test.ts` (21 tests)**
Tests the Markdown parser that converts raw markdown to AST.

- Heading parsing (h1-h6)
- Paragraph parsing with math detection
- Lists (ordered and unordered)
- Code blocks (with language specification)
- Blockquotes
- Horizontal rules
- Tables (headers, rows, data extraction)
- Mixed content documents

**2. `tests/unit/math.test.ts` (37 tests)**
Tests LaTeX/math expression handling.

- **LaTeX to Unicode conversion**: Greek letters, operators, symbols
- **Math expression extraction**: Inline math (`$...$`), display math (`$$...$$`, `\[...\]`, `\(...\)`)
- **Text with math parsing**: Mixed text and math segments
- **Position tracking**: Start and end indices of math expressions
- **Edge cases**: Escaped characters, unclosed math, empty text

**3. `tests/unit/standard-renderers.test.ts` (35 tests)**
Tests the individual PDF renderers for standard markdown elements.

- Page break logic (checking when new page is needed)
- Heading rendering with correct font sizes (h1-h6)
- List rendering (bullets and numbered lists)
- Code block rendering (background, font, multi-line)
- Blockquote rendering (styling, borders)
- Table rendering (headers, rows, cells)
- Font and styling consistency

#### Integration Tests

**`tests/integration/pdf-generation.test.ts` (27 tests)**
Tests the complete PDF generation pipeline with snapshot validation.

**File Output:**
- PDF file creation and validation
- PDF header verification (checks for `%PDF` magic bytes)
- Empty document handling
- Large document handling

**Buffer Output:**
- PDF generation as buffer
- File vs. buffer output comparison
- Valid PDF format verification

**Content Rendering:**
- All markdown element types rendering correctly
- Headings, paragraphs, lists, code, quotes, tables, HR

**Options Handling:**
- Custom title and author metadata
- Custom margins
- Custom font sizes
- Custom line heights

**Complex Documents:**
- Documents with all element types
- Multi-page documents with proper pagination
- Very long content handling
- Malformed markdown gracefully handling

**`tests/integration/pdf-content-validation.test.ts` (29 tests)**
Validates the actual PDF structure and content integrity.

**Content Validation Tests Check:**
- ✅ **PDF Structure** - Valid PDF headers, footers, page objects, content streams
- ✅ **Text Rendering** - All text content renders without truncation or corruption
- ✅ **Formatting** - Fonts, colors, graphics, and layout integrity
- ✅ **Metadata** - Title, author, and other PDF metadata
- ✅ **Multi-page** - Proper page breaks and pagination
- ✅ **Consistency** - Same input produces consistent output
- ✅ **Resilience** - Handles edge cases: empty docs, malformed markdown, very long content
- ✅ **Options Impact** - Custom settings properly applied

## Running Tests

### Run all tests
```bash
npm test
```

Output:
```
✓ tests/unit/math.test.ts (37 tests)
✓ tests/unit/standard-renderers.test.ts (35 tests)
✓ tests/unit/parser.test.ts (21 tests)
✓ tests/integration/pdf-generation.test.ts (27 tests)
✓ tests/integration/pdf-content-validation.test.ts (29 tests)

Snapshots: 15 written
Test Files: 5 passed
Tests: 149 passed
Duration: ~430ms
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run specific test file
```bash
npm test -- parser.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "should parse heading"
```

### Run with coverage
```bash
npm run test:coverage
```

This generates coverage reports in:
- Console output
- `coverage/` directory (HTML report)

### Interactive UI
```bash
npm run test:ui
```

Opens browser UI at `http://localhost:51204` for:
- Test exploration
- Visual test results
- Coverage visualization
- Real-time test running

## Test Structure

Tests use **Vitest** with the following structure:

```typescript
describe('Feature Group', () => {
  describe('Specific Feature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = '# Test';

      // Act
      const result = parseMarkdown(input);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('heading');
    });
  });
});
```

## Key Testing Patterns

### Parser Tests
```typescript
const result = parseMarkdown('# Title\n\nContent');
expect(result).toHaveLength(2);
expect(result[0].type).toBe('heading');
```

### Math Tests
```typescript
const result = latexToUnicode('\\alpha');
expect(result).toBe('α');

const expressions = extractMathExpressions('$x^2$');
expect(expressions[0].type).toBe('inline');
```

### PDF Generation Tests
```typescript
await generatePDF(markdown, outputPath);
expect(fs.existsSync(outputPath)).toBe(true);

const buffer = await generatePDFBuffer(markdown);
expect(Buffer.isBuffer(buffer)).toBe(true);
```

### Renderer Tests (with mocking)
```typescript
renderHeading(ctx, 1, 'Title');
expect(mockDoc.fontSize).toHaveBeenCalledWith(24);
expect(mockDoc.font).toHaveBeenCalledWith('Helvetica-Bold');
```

## Assertions Used

Common assertions in the test suite:

| Assertion | Usage |
|-----------|-------|
| `toHaveLength(n)` | Check array/object length |
| `toBe(value)` | Exact equality check |
| `toContain(value)` | String or array contains value |
| `toHaveBeenCalled()` | Mock was called at least once |
| `toHaveBeenCalledWith(args)` | Mock called with specific args |
| `toHaveBeenCalledTimes(n)` | Mock called exactly n times |
| `toBeDefined()` | Value is not undefined |
| `toBeGreaterThan(n)` | Numeric comparison |
| `rejects.toThrow()` | Async/Promise rejection |

## Coverage

Current coverage targets:

- **Statements**: ~90%
- **Branches**: ~85%
- **Functions**: ~90%
- **Lines**: ~90%

To see coverage:
```bash
npm run test:coverage
open coverage/index.html
```

## Continuous Integration

Tests automatically run on:
- Pre-commit hooks (when configured)
- Pull requests
- Before build/deploy

To ensure tests pass before committing:
```bash
npm test && npm run build
```

## Debugging Tests

### Run single test
```bash
npm test -- --grep "should parse heading"
```

### Run with verbose output
```bash
npm test -- --reporter=verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["--inspect-brk", "--no-file-parallelism"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Writing New Tests

### Add a parser test
```typescript
it('should parse new element type', () => {
  const result = parseMarkdown('[NEW_ELEMENT content]');
  expect(result).toContainEqual({
    type: 'new_element',
    content: expect.any(String)
  });
});
```

### Add a renderer test
```typescript
it('should render new element', () => {
  renderNewElement(ctx, content);
  expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining(content));
});
```

### Add an integration test
```typescript
it('should include new element in PDF', async () => {
  const markdown = '[NEW_ELEMENT test]';
  const buffer = await generatePDFBuffer(markdown);
  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(100);
});
```

## Troubleshooting

### Tests timeout
- Increase timeout: `it('test', async () => {...}, 10000)`
- Check for unresolved promises
- Verify async/await syntax

### Mock-related errors
- Ensure mocks are reset between tests with `beforeEach`
- Use `vi.clearAllMocks()` to reset all mocks
- Check mock return values match expected API

### File system tests
- Use temporary directories created in `beforeEach`
- Clean up in `afterEach`
- Avoid writing to actual project files

## Performance

Current test performance:
- **Total duration**: ~410ms
- **Parser tests**: ~8ms
- **Math tests**: ~7ms
- **Renderer tests**: ~9ms
- **Integration tests**: ~93ms (slower due to file I/O)

Parallel execution is enabled by default for faster runs.

## Best Practices

1. **Keep tests focused** - One assertion per test when possible
2. **Use descriptive names** - Tests should explain what they verify
3. **Arrange-Act-Assert** - Organize test code clearly
4. **DRY** - Use beforeEach/afterEach to avoid duplication
5. **Mock external dependencies** - Isolate units under test
6. **Test behavior, not implementation** - Don't test internal structure
7. **Update tests with code** - Keep tests in sync with changes

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers](https://jestjs.io/docs/expect) (Vitest compatible)

## Contributing

When adding features:
1. Write tests first (TDD) or alongside code
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this documentation if adding new test patterns
