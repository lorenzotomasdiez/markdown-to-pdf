import MarkdownIt from 'markdown-it';
import { InlineSpan, ParsedElement } from '../types.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export function parseMarkdown(markdown: string): ParsedElement[] {
  const tokens = md.parse(markdown, {});
  return convertTokensToElements(tokens);
}

/**
 * Extract plain text from an inline token's children array.
 * markdown-it gives us children like: text, strong_open, text, strong_close, softbreak, etc.
 * We collect the text content and ignore the open/close formatting tokens.
 * Links become their label text. Images are dropped.
 */
function extractInlineText(inlineToken: any): string {
  if (!inlineToken.children || inlineToken.children.length === 0) {
    return inlineToken.content || '';
  }

  const parts: string[] = [];

  for (const child of inlineToken.children) {
    switch (child.type) {
      case 'text':
      case 'code_inline':
        parts.push(child.content);
        break;
      case 'softbreak':
      case 'hardbreak':
        // A source line break is meaningful: the author wrote one thought per
        // line, so keep it instead of collapsing the lines into one blob.
        parts.push('\n');
        break;
      case 'html_inline':
        // strip html tags
        break;
      // strong_open, strong_close, em_open, em_close, link_open, link_close, etc. → skip
      default:
        break;
    }
  }

  return parts.join('');
}

/**
 * Same walk as extractInlineText, but preserving the formatting of each run
 * so renderers can emit bold / italic / code / links instead of flat text.
 */
function extractInlineSpans(inlineToken: any): InlineSpan[] {
  if (!inlineToken.children || inlineToken.children.length === 0) {
    return inlineToken.content ? [{ text: inlineToken.content }] : [];
  }

  const spans: InlineSpan[] = [];
  let bold = 0;
  let italic = 0;
  const linkStack: string[] = [];

  const push = (text: string, code = false) => {
    if (!text) return;
    const span: InlineSpan = { text };
    if (bold > 0) span.bold = true;
    if (italic > 0) span.italic = true;
    if (code) span.code = true;
    if (linkStack.length > 0) span.link = linkStack[linkStack.length - 1];

    const prev = spans[spans.length - 1];
    if (
      prev &&
      !!prev.bold === !!span.bold &&
      !!prev.italic === !!span.italic &&
      !!prev.code === !!span.code &&
      prev.link === span.link
    ) {
      prev.text += span.text;
      return;
    }
    spans.push(span);
  };

  for (const child of inlineToken.children) {
    switch (child.type) {
      case 'text':
        push(child.content);
        break;
      case 'code_inline':
        push(child.content, true);
        break;
      case 'softbreak':
      case 'hardbreak':
        push('\n');
        break;
      case 'strong_open':
        bold++;
        break;
      case 'strong_close':
        bold = Math.max(0, bold - 1);
        break;
      case 'em_open':
        italic++;
        break;
      case 'em_close':
        italic = Math.max(0, italic - 1);
        break;
      case 'link_open': {
        const href = (child.attrs || []).find((a: any[]) => a[0] === 'href');
        linkStack.push(href ? href[1] : '');
        break;
      }
      case 'link_close':
        linkStack.pop();
        break;
      default:
        break;
    }
  }

  return spans;
}

function convertTokensToElements(tokens: any[]): ParsedElement[] {
  const elements: ParsedElement[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    // Tight list items wrap their content in hidden paragraph tokens; those
    // still carry the item's text, so they must not be skipped.
    if (token.hidden && token.type !== 'paragraph_open') {
      i++;
      continue;
    }

    switch (token.type) {
      case 'heading_open': {
        const level = parseInt(token.tag.slice(1));
        i++;
        if (i < tokens.length && tokens[i].type === 'inline') {
          elements.push({
            type: 'heading',
            attrs: { level },
            content: extractInlineText(tokens[i]),
            spans: extractInlineSpans(tokens[i]),
          });
        }
        break;
      }

      case 'paragraph_open': {
        i++;
        if (i < tokens.length && tokens[i].type === 'inline') {
          const inlineToken = tokens[i];
          const plainText = extractInlineText(inlineToken);
          // Check for math in the raw content (before stripping)
          const rawContent = inlineToken.content;
          elements.push({
            type: 'paragraph',
            content: plainText,
            spans: extractInlineSpans(inlineToken),
            hasMath: rawContent.includes('$') || rawContent.includes('\\('),
          });
        }
        break;
      }

      case 'bullet_list_open': {
        const listItems = extractListItems(tokens, i, 'bullet');
        elements.push({
          type: 'list',
          attrs: { ordered: false },
          children: listItems,
        });
        i = findMatchingClose(tokens, i, 'bullet_list_open', 'bullet_list_close');
        break;
      }

      case 'ordered_list_open': {
        const listItems = extractListItems(tokens, i, 'ordered');
        const startAttr = (token.attrs || []).find((a: any[]) => a[0] === 'start');
        elements.push({
          type: 'list',
          attrs: { ordered: true, start: startAttr ? parseInt(startAttr[1], 10) : 1 },
          children: listItems,
        });
        i = findMatchingClose(tokens, i, 'ordered_list_open', 'ordered_list_close');
        break;
      }

      case 'fence':
      case 'code_block': {
        const lang = (token.info || '').trim();
        if (lang === 'mermaid') {
          elements.push({
            type: 'mermaid',
            content: token.content.trim(),
          });
        } else {
          elements.push({
            type: 'code',
            attrs: { lang },
            content: token.content,
          });
        }
        break;
      }

      case 'blockquote_open': {
        const end = findMatchingClose(tokens, i, 'blockquote_open', 'blockquote_close');
        const quoteBlocks = convertTokensToElements(tokens.slice(i + 1, end));
        const quoteSpans: InlineSpan[] = [];
        for (const block of quoteBlocks) {
          if (block.type !== 'paragraph') continue;
          if (quoteSpans.length > 0) quoteSpans.push({ text: '\n' });
          quoteSpans.push(...(block.spans || []));
        }
        elements.push({
          type: 'blockquote',
          content: extractBlockContent(tokens, i),
          spans: quoteSpans,
        });
        i = findMatchingClose(tokens, i, 'blockquote_open', 'blockquote_close');
        break;
      }

      case 'hr': {
        elements.push({ type: 'hr' });
        break;
      }

      case 'html_block': {
        const htmlContent = token.content;
        if (htmlContent.includes('mermaid')) {
          const mermaidCode = extractMermaidCode(htmlContent);
          if (mermaidCode) {
            elements.push({
              type: 'mermaid',
              content: mermaidCode,
            });
          }
        }
        break;
      }

      case 'table_open': {
        const table = extractTable(tokens, i);
        if (table) {
          elements.push(table);
        }
        i = skipToClose(tokens, i, 'table_close');
        break;
      }
    }

    i++;
  }

  return elements;
}

function skipToClose(tokens: any[], startIndex: number, closeType: string): number {
  let i = startIndex;
  while (i < tokens.length && tokens[i].type !== closeType) {
    i++;
  }
  return i;
}

function findMatchingClose(tokens: any[], openIndex: number, openType: string, closeType: string): number {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    if (tokens[i].type === openType) depth++;
    else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

function extractListItems(tokens: any[], startIndex: number, listType: string): ParsedElement[] {
  const items: ParsedElement[] = [];
  const closeType = `${listType === 'bullet' ? 'bullet' : 'ordered'}_list_close`;
  const openLevel = tokens[startIndex].level;
  let i = startIndex + 1;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === closeType && token.level === openLevel) break;

    if (token.type === 'list_item_open') {
      const end = findMatchingClose(tokens, i, 'list_item_open', 'list_item_close');
      items.push(buildListItem(tokens.slice(i + 1, end)));
      i = end + 1;
      continue;
    }
    i++;
  }

  return items;
}

/**
 * A list item can hold several paragraphs plus nested blocks (sub-lists, code).
 * The paragraphs become the item's own text, separated by line breaks; anything
 * else is kept as children so the renderer can indent it under the item.
 */
function buildListItem(innerTokens: any[]): ParsedElement {
  const blocks = convertTokensToElements(innerTokens);
  const paragraphs = blocks.filter((b) => b.type === 'paragraph');
  const others = blocks.filter((b) => b.type !== 'paragraph');

  const spans: InlineSpan[] = [];
  for (const paragraph of paragraphs) {
    if (spans.length > 0) spans.push({ text: '\n' });
    spans.push(...(paragraph.spans || []));
  }

  const item: ParsedElement = {
    type: 'list_item',
    content: paragraphs.map((b) => b.content || '').join('\n'),
    spans,
    hasMath: paragraphs.some((b) => b.hasMath),
  };
  if (others.length > 0) item.children = others;

  return item;
}

function extractBlockContent(tokens: any[], startIndex: number): string {
  const parts: string[] = [];
  let i = startIndex + 1;

  while (i < tokens.length && tokens[i].type !== 'blockquote_close') {
    if (tokens[i].type === 'inline') {
      parts.push(extractInlineText(tokens[i]));
    } else if (tokens[i].type === 'paragraph_open') {
      i++;
      if (i < tokens.length && tokens[i].type === 'inline') {
        parts.push(extractInlineText(tokens[i]));
      }
    }
    i++;
  }

  return parts.join('\n');
}

function extractMermaidCode(html: string): string | null {
  const match = html.match(/<pre[^>]*><code[^>]*class="[^"]*mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/i);
  if (match) return match[1].trim();

  const match2 = html.match(/```mermaid\s*([\s\S]*?)\s*```/);
  if (match2) return match2[1].trim();

  return null;
}

function extractTable(tokens: any[], startIndex: number): ParsedElement | null {
  const headers: string[] = [];
  const rows: string[][] = [];
  const headerSpans: InlineSpan[][] = [];
  const rowSpans: InlineSpan[][][] = [];
  let i = startIndex + 1;

  while (i < tokens.length && tokens[i].type !== 'table_close') {
    if (tokens[i].type === 'thead_open') {
      i++;
      while (i < tokens.length && tokens[i].type !== 'thead_close') {
        if (tokens[i].type === 'tr_open') {
          i++;
          while (i < tokens.length && tokens[i].type !== 'tr_close') {
            if (tokens[i].type === 'th_open') {
              i++;
              if (i < tokens.length && tokens[i].type === 'inline') {
                headers.push(extractInlineText(tokens[i]));
                headerSpans.push(extractInlineSpans(tokens[i]));
              }
            }
            i++;
          }
        }
        i++;
      }
    } else if (tokens[i].type === 'tbody_open') {
      i++;
      while (i < tokens.length && tokens[i].type !== 'tbody_close') {
        if (tokens[i].type === 'tr_open') {
          const row: string[] = [];
          const spanRow: InlineSpan[][] = [];
          i++;
          while (i < tokens.length && tokens[i].type !== 'tr_close') {
            if (tokens[i].type === 'td_open') {
              i++;
              if (i < tokens.length && tokens[i].type === 'inline') {
                row.push(extractInlineText(tokens[i]));
                spanRow.push(extractInlineSpans(tokens[i]));
              }
            }
            i++;
          }
          if (row.length > 0) {
            rows.push(row);
            rowSpans.push(spanRow);
          }
        }
        i++;
      }
    }
    i++;
  }

  if (headers.length === 0) return null;

  return {
    type: 'table',
    attrs: { headers, rows, headerSpans, rowSpans },
  };
}
