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
  children?: ParsedElement[];
  attrs?: Record<string, any>;
  hasMath?: boolean;
}
