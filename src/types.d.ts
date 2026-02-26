declare module 'mathjax-node' {
  export interface MathJaxResult {
    svg?: string;
    mml?: string;
    html?: string;
  }

  export interface MathJax {
    Typeset(config: {
      math: string;
      format: string;
      svg?: boolean;
      mml?: boolean;
      html?: boolean;
      display?: boolean;
    }): Promise<MathJaxResult>;
  }

  export function mathjax(config?: any): MathJax;
}

declare module 'svg-to-pdfkit' {
  import { PDFDocument } from 'pdfkit';

  interface SVGtoPDFOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    valign?: string;
    halign?: string;
    useCSS?: boolean;
  }

  function SVGtoPDF(
    doc: PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: SVGtoPDFOptions
  ): void;

  export default SVGtoPDF;
}

declare module 'pdfkit' {
  interface PDFDocument {
    saveState(): this;
    restoreState(): this;
  }
}
