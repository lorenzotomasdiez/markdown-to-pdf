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
  y: number;
  pageWidth: number;
  pageHeight: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface ParsedElement {
  type: string;
  content?: string;
  /** Formatted version of `content`; renderers prefer this when present. */
  spans?: InlineSpan[];
  children?: ParsedElement[];
  attrs?: Record<string, any>;
  hasMath?: boolean;
}

/**
 * A run of inline text sharing the same formatting.
 * Produced by the parser so renderers can reproduce bold/italic/code/links
 * instead of flattening everything to plain text.
 */
export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}
