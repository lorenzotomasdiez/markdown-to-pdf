import MarkdownIt from 'markdown-it';
import { ParsedElement } from '../types.js';

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
        parts.push(' ');
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

function convertTokensToElements(tokens: any[]): ParsedElement[] {
  const elements: ParsedElement[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.hidden) {
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
        i = skipToClose(tokens, i, 'bullet_list_close');
        break;
      }

      case 'ordered_list_open': {
        const listItems = extractListItems(tokens, i, 'ordered');
        elements.push({
          type: 'list',
          attrs: { ordered: true },
          children: listItems,
        });
        i = skipToClose(tokens, i, 'ordered_list_close');
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
        const quoteContent = extractBlockContent(tokens, i);
        elements.push({
          type: 'blockquote',
          content: quoteContent,
        });
        i = skipToClose(tokens, i, 'blockquote_close');
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

function extractListItems(tokens: any[], startIndex: number, listType: string): ParsedElement[] {
  const items: ParsedElement[] = [];
  let i = startIndex + 1;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === `${listType === 'bullet' ? 'bullet' : 'ordered'}_list_close`) {
      break;
    }
    if (token.type === 'list_item_open') {
      const itemContent = extractListItemContent(tokens, i);
      items.push({
        type: 'list_item',
        content: itemContent,
      });
    }
    i++;
  }

  return items;
}

function extractListItemContent(tokens: any[], startIndex: number): string {
  let i = startIndex + 1;
  let content = '';

  while (i < tokens.length && tokens[i].type !== 'list_item_close') {
    if (tokens[i].type === 'inline') {
      content = extractInlineText(tokens[i]);
    } else if (tokens[i].type === 'paragraph_open') {
      i++;
      if (i < tokens.length && tokens[i].type === 'inline') {
        content = extractInlineText(tokens[i]);
      }
    }
    i++;
  }

  return content;
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
          i++;
          while (i < tokens.length && tokens[i].type !== 'tr_close') {
            if (tokens[i].type === 'td_open') {
              i++;
              if (i < tokens.length && tokens[i].type === 'inline') {
                row.push(extractInlineText(tokens[i]));
              }
            }
            i++;
          }
          if (row.length > 0) rows.push(row);
        }
        i++;
      }
    }
    i++;
  }

  if (headers.length === 0) return null;

  return {
    type: 'table',
    attrs: { headers, rows },
  };
}
